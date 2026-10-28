import ExcelJS from 'exceljs'
import { randomUUID } from 'node:crypto'
import type { PassDatabase } from './db'
import { mapImportRows } from '@shared/logic'
import type { ClassRecord, ImportPreview } from '@shared/types'

function cellValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'text' in value) return String(value.text ?? '')
  if (value instanceof Date) return value.toISOString()
  return value
}

function rowValues(row: ExcelJS.Row): unknown[] {
  return Array.isArray(row.values) ? row.values.slice(1) : []
}

export async function previewWorkbook(filePath: string): Promise<ImportPreview> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('The workbook has no worksheets.')
  const headers = (worksheet.getRow(1).values as unknown[]).slice(1).map((value, index) => String(value ?? `Column ${index + 1}`).trim())
  const rows: unknown[][] = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rows.length < 5) rows.push(rowValues(row).map(value => cellValue(value as ExcelJS.CellValue)))
  })
  return { filePath, sheetName: worksheet.name, headers, rows }
}

export async function importWorkbook(db: PassDatabase, input: {
  filePath: string; className: string; section: string; subject: string; schoolYear: string; idColumn: number; nameColumn: number
}): Promise<ClassRecord> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(input.filePath)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('The workbook has no worksheets.')
  const sourceRows: unknown[][] = []
  worksheet.eachRow((row, rowNumber) => { if (rowNumber > 1) sourceRows.push(rowValues(row).map(value => cellValue(value as ExcelJS.CellValue))) })
  const { valid, errors } = mapImportRows(sourceRows, input.idColumn, input.nameColumn)
  if (errors.length) throw new Error(`Please fix the spreadsheet before importing:\n${errors.join('\n')}`)
  if (!valid.length) throw new Error('No student rows were found in the first worksheet.')
  const id = randomUUID()
  const classRecord: ClassRecord = {
    id, name: input.className.trim(), section: input.section.trim(), subject: input.subject.trim(),
    school_year: input.schoolYear.trim(), source_xlsx_path: input.filePath,
    col_map_json: JSON.stringify({ idColumn: input.idColumn, nameColumn: input.nameColumn, sheetName: worksheet.name })
  }
  if (!classRecord.name || !classRecord.section || !classRecord.subject || !classRecord.school_year) throw new Error('Class name, section, subject, and school year are required.')
  await db.write(database => {
    database.run('INSERT INTO classes (id,name,section,subject,school_year,source_xlsx_path,col_map_json) VALUES (?,?,?,?,?,?,?)',
      [classRecord.id, classRecord.name, classRecord.section, classRecord.subject, classRecord.school_year, classRecord.source_xlsx_path, classRecord.col_map_json])
    for (const student of valid) database.run('INSERT INTO students (class_id,student_id,name) VALUES (?,?,?)', [id, student.studentId, student.name])
  })
  return classRecord
}
