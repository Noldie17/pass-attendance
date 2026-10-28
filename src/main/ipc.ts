import { app, dialog, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import type { AttendanceStatus, ClassRecord } from '@shared/types'
import type { PassDatabase } from './db'
import { importWorkbook, previewWorkbook } from './import-class'
import { AttendanceService } from './attendance'
import { SettingsService } from './settings'
import { PinService } from './pin'
import { readScanLog } from './scan-log'
import { exportScanLogXlsx, outputQrSheet, updateClassWorkbook } from './export-services'

export function registerIpc(db: PassDatabase, attendance: AttendanceService, settings: SettingsService, pin: PinService): void {
  ipcMain.handle('classes:list', () => db.all<ClassRecord>('SELECT * FROM classes ORDER BY name COLLATE NOCASE'))
  ipcMain.handle('classes:create', async (_event, input) => {
    const record = { ...input, id: input.id || randomUUID(), source_xlsx_path: null, col_map_json: null }
    validateClass(record)
    await db.write(database => database.run('INSERT INTO classes(id,name,section,subject,school_year,source_xlsx_path,col_map_json) VALUES(?,?,?,?,?,?,?)', [record.id, record.name, record.section, record.subject, record.school_year, null, null]))
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
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }] })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('classes:preview-import', (_event, filePath: string) => previewWorkbook(filePath))
  ipcMain.handle('classes:import', (_event, input) => importWorkbook(db, input))
  ipcMain.handle('classes:delete', async (_event, classId: string) => {
    await db.write(database => database.run('DELETE FROM classes WHERE id=?', [classId]))
  })
  ipcMain.handle('students:list', (_event, classId: string) => db.all('SELECT id,class_id,student_id,name FROM students WHERE class_id=? ORDER BY name COLLATE NOCASE', [classId]))
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
  ipcMain.handle('exports:update-class-record', (_event, input: { classId: string; date: string }) => {
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
      'SELECT student_id,name FROM students WHERE class_id=? AND student_id=?', [input.classId, studentId]
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
