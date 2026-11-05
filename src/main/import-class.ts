import { randomUUID } from 'node:crypto'
import type { PassDatabase } from './db'
import { readSpreadsheet, sheetDataRows } from './spreadsheet-reader'
import { mapImportRows } from '@shared/logic'
import { normalizeSection, planSf2Import } from '@shared/sf2'
import type { ClassRecord, ImportInput, ImportPreview, ImportSheetOption, StudentRecord } from '@shared/types'

function optionsFor(sheets: ReturnType<typeof readSpreadsheet>['sheets']): ImportSheetOption[] {
  return sheets.map(sheet => ({ name: sheet.name, sf2: Boolean(sheet.sf2), month: sheet.sf2?.month ?? null }))
}

function classForSf2(db: PassDatabase, gradeLevel: string, section: string, schoolYear: string): ClassRecord | undefined {
  return db.all<ClassRecord>('SELECT * FROM classes WHERE school_year=?', [schoolYear])
    .find(record => record.grade_level === gradeLevel && normalizeSection(record.section) === normalizeSection(section))
}

export async function previewWorkbook(db: PassDatabase, filePath: string, requestedSheet?: string, headerRow = 1): Promise<ImportPreview> {
  const file = readSpreadsheet(filePath)
  const sf2Sheets = file.sheets.filter(sheet => sheet.sf2)
  const chosen = requestedSheet
    ? file.sheets.find(sheet => sheet.name === requestedSheet)
    : sf2Sheets[sf2Sheets.length - 1] ?? file.sheets[0]
  if (!chosen) throw new Error('Choose a worksheet from this workbook.')
  const sheets = optionsFor(file.sheets)
  if (chosen.sf2) {
    const data = chosen.sf2
    const existingClass = classForSf2(db, data.gradeLevel, data.section, data.schoolYear)
    const existing = existingClass
      ? db.all<StudentRecord>('SELECT id,class_id,student_id,name,sex,active FROM students WHERE class_id=? ORDER BY id', [existingClass.id])
      : []
    const plan = planSf2Import(data.learners, data.gradeNumber, data.section, existing)
    return {
      kind: 'sf2',
      filePath,
      sheetName: chosen.name,
      sheets,
      schoolName: data.schoolName,
      schoolYear: data.schoolYear,
      gradeLevel: data.gradeLevel,
      gradeNumber: data.gradeNumber,
      section: data.section,
      month: data.month,
      learners: plan.learners,
      added: plan.added,
      removed: plan.removed,
      unchanged: plan.unchanged,
      existingClassId: existingClass?.id ?? null
    }
  }
  const table = sheetDataRows(chosen, headerRow)
  return {
    kind: 'table',
    filePath,
    sheetName: chosen.name,
    sheets,
    headerRow,
    headerRowCount: chosen.rows.length,
    headers: table.headers,
    rows: table.rows,
    rowCount: table.rowCount
  }
}

export async function importWorkbook(db: PassDatabase, input: ImportInput): Promise<ClassRecord> {
  const file = readSpreadsheet(input.filePath)
  const sheet = file.sheets.find(item => item.name === input.sheetName)
  if (!sheet) throw new Error('The selected worksheet is no longer available.')
  if (input.kind === 'sf2') {
    if (!sheet.sf2) throw new Error('The selected worksheet is not a recognized SF2.')
    const data = sheet.sf2
    const existingClass = classForSf2(db, data.gradeLevel, data.section, data.schoolYear)
    const existing = existingClass
      ? db.all<StudentRecord>('SELECT id,class_id,student_id,name,sex,active FROM students WHERE class_id=? ORDER BY id', [existingClass.id])
      : []
    const plan = planSf2Import(data.learners, data.gradeNumber, data.section, existing)
    if (existingClass && plan.removed.length && !input.confirmReimport) {
      throw new Error('Confirm the re-import to deactivate learners missing from this SF2.')
    }
    const record: ClassRecord = {
      id: existingClass?.id ?? randomUUID(),
      name: input.className.trim() || `Grade ${data.gradeNumber} ${data.section}`,
      section: data.section,
      subject: input.subject.trim(),
      school_year: data.schoolYear,
      grade_level: data.gradeLevel,
      source_xlsx_path: input.filePath,
      export_xlsx_path: plan.added.length || plan.removed.length ? null : existingClass?.export_xlsx_path ?? null,
      col_map_json: JSON.stringify({ kind: 'sf2', sheetName: sheet.name, nameColumn: data.nameColumn, month: data.month })
    }
    if (!record.name || !record.section || !record.school_year || !record.grade_level) {
      throw new Error('Class name, section, grade level, and school year are required.')
    }
    await db.write(database => {
      if (existingClass) {
        database.run('UPDATE classes SET name=?,section=?,subject=?,school_year=?,grade_level=?,source_xlsx_path=?,export_xlsx_path=?,col_map_json=? WHERE id=?',
          [record.name, record.section, record.subject, record.school_year, record.grade_level, record.source_xlsx_path, record.export_xlsx_path, record.col_map_json, record.id])
      } else {
        database.run('INSERT INTO classes (id,name,section,subject,school_year,source_xlsx_path,col_map_json,grade_level) VALUES (?,?,?,?,?,?,?,?)',
          [record.id, record.name, record.section, record.subject, record.school_year, record.source_xlsx_path, record.col_map_json, record.grade_level])
      }
      for (const learner of plan.learners) {
        database.run(`INSERT INTO students (class_id,student_id,name,sex,active) VALUES (?,?,?,?,1)
          ON CONFLICT(class_id,student_id) DO UPDATE SET name=excluded.name,sex=excluded.sex,active=1`,
        [record.id, learner.studentId, learner.name, learner.sex])
      }
      for (const removed of plan.removed) database.run('UPDATE students SET active=0 WHERE id=?', [removed.id])
    })
    return record
  }

  const table = sheetDataRows(sheet, input.headerRow)
  const allRows = sheet.rows.slice(input.headerRow)
  const { valid, errors } = mapImportRows(allRows, input.idColumn, input.nameColumn, input.headerRow)
  if (errors.length) throw new Error(`Please fix the spreadsheet before importing:\n${errors.join('\n')}`)
  if (!valid.length) throw new Error(`No student rows were found below row ${input.headerRow} in worksheet "${sheet.name}".`)
  const id = randomUUID()
  const record: ClassRecord = {
    id,
    name: input.className.trim(),
    section: input.section.trim(),
    subject: input.subject.trim(),
    school_year: input.schoolYear.trim(),
    grade_level: '',
    source_xlsx_path: input.filePath,
    export_xlsx_path: null,
    col_map_json: JSON.stringify({
      kind: 'table', idColumn: input.idColumn, nameColumn: input.nameColumn, sheetName: sheet.name,
      headerRow: input.headerRow, headers: table.headers
    })
  }
  if (!record.name || !record.section || !record.subject || !record.school_year) {
    throw new Error('Class name, section, subject, and school year are required for a simple-table import.')
  }
  await db.write(database => {
    database.run('INSERT INTO classes (id,name,section,subject,school_year,source_xlsx_path,col_map_json) VALUES (?,?,?,?,?,?,?)',
      [record.id, record.name, record.section, record.subject, record.school_year, record.source_xlsx_path, record.col_map_json])
    for (const student of valid) database.run('INSERT INTO students (class_id,student_id,name) VALUES (?,?,?)', [id, student.studentId, student.name])
  })
  return record
}
