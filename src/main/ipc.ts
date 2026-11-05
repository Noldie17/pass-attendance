import { app, dialog, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { AttendanceStatus, ClassRecord } from '@shared/types'
import { createPassRoster, normalizeSection, normalizeStudentName, validatePassRoster } from '@shared/sf2'
import type { PassDatabase } from './db'
import { importWorkbook, previewWorkbook } from './import-class'
import { readSpreadsheet } from './spreadsheet-reader'
import { verifySf2WorkbookCopy } from './sf2-export'
import { AttendanceService } from './attendance'
import { SettingsService } from './settings'
import { PinService } from './pin'
import { readScanLog } from './scan-log'
import { exportScanLogXlsx, outputQrSheet, previewClassWorkbook, updateClassWorkbook } from './export-services'

export function registerIpc(db: PassDatabase, attendance: AttendanceService, settings: SettingsService, pin: PinService): void {
  ipcMain.handle('classes:list', () => db.all<ClassRecord>('SELECT * FROM classes ORDER BY name COLLATE NOCASE'))
  ipcMain.handle('classes:create', async (_event, input) => {
    const record = { ...input, id: input.id || randomUUID(), grade_level: input.grade_level ?? '', source_xlsx_path: null, export_xlsx_path: null, col_map_json: null }
    validateClass(record)
    await db.write(database => database.run('INSERT INTO classes(id,name,section,subject,school_year,source_xlsx_path,col_map_json,grade_level,export_xlsx_path) VALUES(?,?,?,?,?,?,?,?,?)', [record.id, record.name, record.section, record.subject, record.school_year, null, null, record.grade_level, null]))
    return record
  })
  ipcMain.handle('classes:update', async (_event, classId: string, patch) => {
    const record = { ...patch }
    validateClass(record)
    await db.write(database => database.run('UPDATE classes SET name=?,section=?,subject=?,school_year=? WHERE id=?', [record.name, record.section, record.subject, record.school_year, classId]))
    const updated = db.get<ClassRecord>('SELECT * FROM classes WHERE id=?', [classId])
    if (!updated) throw new Error('Class not found.')
    return updated
  })
  ipcMain.handle('classes:choose-import', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Excel files', extensions: ['xls', 'xlsx'] }] })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('classes:choose-xlsx-copy', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Excel Workbook (.xlsx)', extensions: ['xlsx'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('classes:preview-import', (_event, filePath: string, sheetName?: string, headerRow?: number) => previewWorkbook(db, filePath, sheetName, headerRow))
  ipcMain.handle('classes:import', (_event, input) => importWorkbook(db, input))
  ipcMain.handle('classes:link-xlsx-copy', async (_event, classId: string, filePath: string) => {
    const record = db.get<ClassRecord>('SELECT * FROM classes WHERE id=?', [classId])
    if (!record) throw new Error('Class not found.')
    if (path.extname(filePath).toLocaleLowerCase() !== '.xlsx') throw new Error('Link an Excel Workbook (.xlsx) copy. Legacy .xls files cannot be used for export.')
    const spreadsheet = readSpreadsheet(filePath)
    const mapping = JSON.parse(record.col_map_json ?? '{}') as { kind?: string; month?: string; sheetName?: string; nameColumn?: number; headerRow?: number }
    const activeNames = db.all<{ name: string }>('SELECT name FROM students WHERE class_id=? AND active=1', [classId]).map(student => normalizeStudentName(student.name))
    if (!record.grade_level) {
      const worksheet = spreadsheet.sheets.find(sheet => sheet.name === mapping.sheetName)
      if (!worksheet || !Number.isInteger(mapping.nameColumn)) throw new Error('The imported roster mapping is incomplete.')
      const headerRow = Number(mapping.headerRow ?? 1)
      const rosterNames = worksheet.rows.slice(headerRow).map(row => normalizeStudentName(String(row[mapping.nameColumn!] ?? ''))).filter(Boolean)
      if (rosterNames.length !== activeNames.length || rosterNames.some(name => !activeNames.includes(name))) {
        throw new Error('The .xlsx copy does not have the same learners as this PASS roster.')
      }
    } else {
      verifySf2WorkbookCopy({ record, filePath, sheets: spreadsheet.sheets.map(sheet => sheet.sf2), activeNames })
    }
    await db.write(database => database.run('UPDATE classes SET export_xlsx_path=? WHERE id=?', [filePath, classId]))
    const updated = db.get<ClassRecord>('SELECT * FROM classes WHERE id=?', [classId])
    if (!updated) throw new Error('Class not found after linking the workbook.')
    return updated
  })
  ipcMain.handle('classes:export-roster', async (_event, classId: string) => {
    const record = db.get<ClassRecord>('SELECT * FROM classes WHERE id=?', [classId])
    if (!record) throw new Error('Class not found.')
    const learners = db.all<{ student_id: string; name: string; sex: 'M' | 'F' | ''; active: number }>(
      'SELECT student_id,name,sex,active FROM students WHERE class_id=? ORDER BY id', [classId]
    )
    const roster = createPassRoster(
      { gradeLevel: record.grade_level, section: record.section, schoolYear: record.school_year },
      learners.map(student => ({ id: student.student_id, name: student.name, sex: student.sex, active: Boolean(student.active) }))
    )
    const safeName = `${record.name}-${record.section}`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'class'
    const chosen = await dialog.showSaveDialog({
      title: 'Export PASS roster', defaultPath: path.join(app.getPath('documents'), 'PASS', `${safeName}.passroster`),
      filters: [{ name: 'PASS roster', extensions: ['passroster'] }]
    })
    if (chosen.canceled || !chosen.filePath) return null
    await fs.mkdir(path.dirname(chosen.filePath), { recursive: true })
    await fs.writeFile(chosen.filePath, JSON.stringify(roster, null, 2), 'utf8')
    return chosen.filePath
  })
  ipcMain.handle('classes:import-roster', async () => {
    const chosen = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'PASS roster', extensions: ['passroster'] }] })
    if (chosen.canceled || !chosen.filePaths[0]) return null
    let raw: unknown
    try { raw = JSON.parse(await fs.readFile(chosen.filePaths[0], 'utf8')) }
    catch (error) { throw new Error(`Could not read the PASS roster: ${error instanceof Error ? error.message : String(error)}`) }
    const roster = validatePassRoster(raw)
    const existing = db.all<ClassRecord>('SELECT * FROM classes')
      .find(record => record.grade_level === roster.class.gradeLevel && normalizeSection(record.section) === normalizeSection(roster.class.section))
    const id = existing?.id ?? randomUUID()
    const record: ClassRecord = {
      id,
      name: existing?.name ?? [roster.class.gradeLevel, roster.class.section].filter(Boolean).join(' '),
      section: roster.class.section,
      subject: existing?.subject ?? '',
      school_year: roster.class.schoolYear,
      grade_level: roster.class.gradeLevel,
      source_xlsx_path: existing?.source_xlsx_path ?? null,
      export_xlsx_path: existing?.export_xlsx_path ?? null,
      col_map_json: existing?.col_map_json ?? JSON.stringify({ kind: roster.class.gradeLevel ? 'sf2' : 'roster' })
    }
    await db.write(database => {
      if (existing) {
        database.run('UPDATE classes SET section=?,school_year=? WHERE id=?', [record.section, record.school_year, id])
      } else {
        database.run('INSERT INTO classes(id,name,section,subject,school_year,grade_level) VALUES(?,?,?,?,?,?)',
          [record.id, record.name, record.section, record.subject, record.school_year, record.grade_level])
      }
      for (const learner of roster.learners) {
        database.run(`INSERT INTO students(class_id,student_id,name,sex,active) VALUES(?,?,?,?,?)
          ON CONFLICT(class_id,student_id) DO UPDATE SET name=excluded.name,sex=excluded.sex,active=excluded.active`,
        [id, learner.id, learner.name, learner.sex, learner.active ? 1 : 0])
      }
    })
    return record
  })
  ipcMain.handle('classes:delete', async (_event, classId: string) => {
    await db.write(database => database.run('DELETE FROM classes WHERE id=?', [classId]))
  })
  ipcMain.handle('students:list', (_event, classId: string) => db.all('SELECT id,class_id,student_id,name,sex,active FROM students WHERE class_id=? AND active=1 ORDER BY name COLLATE NOCASE', [classId]))
  ipcMain.handle('attendance:scan', (_event, input) => attendance.scan(input))
  ipcMain.handle('attendance:list', (_event, classId: string, date: string) => attendance.list(classId, date))
  ipcMain.handle('attendance:set-manual', (_event, input) => attendance.setManual(input))
  ipcMain.handle('scan-log:list', async (_event, input: { classId: string; dateFrom: string; dateTo: string }) => {
    const classRecord = db.get<{ name: string }>('SELECT name FROM classes WHERE id=?', [input.classId])
    if (!classRecord) throw new Error('Class not found.')
    return readScanLog(app.getPath('documents'), classRecord.name, input.dateFrom, input.dateTo)
  })
  ipcMain.handle('scan-log:export-xlsx', async (_event, input: { classId: string; dateFrom: string; dateTo: string }) => {
    const classRecord = db.get<{ name: string }>('SELECT name FROM classes WHERE id=?', [input.classId])
    if (!classRecord) throw new Error('Class not found.')
    if (input.dateFrom > input.dateTo) throw new Error('Start date must be on or before end date.')
    return exportScanLogXlsx(app.getPath('documents'), classRecord.name, input.dateFrom, input.dateTo)
  })
  ipcMain.handle('exports:preview-class-record', (_event, input: { classId: string; filePath?: string; date?: string; sheetName?: string; day?: number }) => previewClassWorkbook(db, input))
  ipcMain.handle('exports:update-class-record', (_event, input: { classId: string; filePath?: string; date: string; sheetName?: string; day?: number; confirmWarnings?: boolean }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('Choose a valid attendance date.')
    return updateClassWorkbook(db, input)
  })
  ipcMain.handle('exports:output-qr-sheet', async (_event, input: { classId: string; studentIds: string[]; mode: 'print' | 'pdf' }) => {
    if (!Array.isArray(input.studentIds) || input.studentIds.length === 0) throw new Error('Select at least one student.')
    if (input.mode !== 'print' && input.mode !== 'pdf') throw new Error('Choose Print or Save as PDF.')
    const classRecord = db.get<{ name: string }>('SELECT name FROM classes WHERE id=?', [input.classId])
    if (!classRecord) throw new Error('Class not found.')
    const requested = [...new Set(input.studentIds)]
    const students = requested.map(studentId => db.get<{ student_id: string; name: string }>(
      'SELECT student_id,name FROM students WHERE class_id=? AND active=1 AND student_id=?', [input.classId, studentId]
    )).filter((student): student is { student_id: string; name: string } => Boolean(student))
    if (students.length !== requested.length) throw new Error('One or more selected students are not in this class.')
    return outputQrSheet(classRecord.name, students, input.mode)
  })
  ipcMain.handle('settings:get', () => settings.get())
  ipcMain.handle('settings:save', (_event, patch) => settings.save(patch))
  ipcMain.handle('settings:set-pin', (_event, value: string | null) => pin.set(value))
  ipcMain.handle('settings:verify-pin', (_event, value: string) => pin.verify(value))
}

function validateClass(value: { name?: string; section?: string; subject?: string; school_year?: string }): void {
  if (![value.name, value.section, value.subject, value.school_year].every(item => typeof item === 'string' && item.trim())) {
    throw new Error('Class name, section, subject, and school year are required.')
  }
}
