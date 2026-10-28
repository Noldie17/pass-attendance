import ExcelJS from 'exceljs'
import QRCode from 'qrcode'
import { app, BrowserWindow, dialog } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AttendanceStatus, ClassRecord, ScanLogEntry, StudentRecord } from '@shared/types'
import type { PassDatabase } from './db'
import { readScanLog } from './scan-log'

const LOCK_MESSAGE = 'Close the file in Excel, then try again'
function isFileLockError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code
  return code === 'EBUSY' || code === 'EPERM' || code === 'EACCES'
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}
function cloneStyle<T>(value: T): T {
  return value === undefined || value === null ? value : JSON.parse(JSON.stringify(value)) as T
}
export function statusByStudent(students: Array<Pick<StudentRecord, 'student_id'>>, records: Array<{ student_id: string; status: AttendanceStatus }>): Map<string, AttendanceStatus> {
  const statusMap = new Map(records.map(record => [record.student_id, record.status]))
  return new Map(students.map(student => [student.student_id, statusMap.get(student.student_id) ?? 'A']))
}
export function applyAttendanceColumn(workbook: ExcelJS.Workbook, options: {
  sheetName: string; idColumn: number; date: string
  students: Array<{ student_id: string }>; statuses: Map<string, AttendanceStatus>
}): { sheetName: string; columnNumber: number; header: string; matched: number } {
  const sheet = workbook.getWorksheet(options.sheetName) ?? workbook.worksheets[0]
  if (!sheet) throw new Error('The source workbook has no worksheets.')
  const idExcelColumn = options.idColumn + 1
  const lastUsedColumn = Math.max(sheet.columnCount, 1)
  const day = new Date(`${options.date}T12:00:00`)
  if (!Number.isFinite(day.getTime())) throw new Error('Choose a valid attendance date.')
  const header = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  // Re-exporting the same date must update its existing column, not add a duplicate one.
  let existingColumn = 0
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, columnIndex) => {
    if (!existingColumn && String(cell.value ?? '').trim() === header) existingColumn = columnIndex
  })
  const columnNumber = existingColumn || lastUsedColumn + 1
  const headerCell = sheet.getCell(1, columnNumber)
  if (!existingColumn) {
    const sourceCell = sheet.getCell(1, lastUsedColumn)
    headerCell.style = cloneStyle(sourceCell.style)
  }
  headerCell.value = header
  const rowById = new Map<string, number>()
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return
    const value = row.getCell(idExcelColumn).value
    const studentId = value === null || value === undefined ? '' : String(typeof value === 'object' && 'text' in value ? value.text : value).trim()
    if (studentId && !rowById.has(studentId)) rowById.set(studentId, rowNumber)
  })
  let matched = 0
  for (const student of options.students) {
    const rowNumber = rowById.get(student.student_id)
    if (!rowNumber) continue
    const cell = sheet.getCell(rowNumber, columnNumber)
    const sourceRow = sheet.getRow(rowNumber)
    if (!existingColumn) cell.style = cloneStyle(sourceRow.getCell(lastUsedColumn).style)
    cell.value = options.statuses.get(student.student_id) ?? 'A'
    matched++
  }
  return { sheetName: sheet.name, columnNumber, header, matched }
}

export async function updateClassWorkbook(db: PassDatabase, input: { classId: string; date: string }): Promise<{ savedPath: string; backupPath: string; matched: number; header: string }> {
  const record = db.get<ClassRecord>('SELECT * FROM classes WHERE id=?', [input.classId])
  if (!record) throw new Error('Class not found.')
  if (!record.source_xlsx_path) throw new Error('This class has no original .xlsx file. Import a spreadsheet to enable this export.')
  let mapping: { idColumn?: number; sheetName?: string } = {}
  try { mapping = JSON.parse(record.col_map_json ?? '{}') as typeof mapping } catch { /* validate below */ }
  if (!Number.isInteger(mapping.idColumn) || (mapping.idColumn ?? -1) < 0) throw new Error('The imported Student ID column mapping is missing. Re-import the class spreadsheet.')
  const students = db.all<StudentRecord>('SELECT id,class_id,student_id,name FROM students WHERE class_id=? ORDER BY id', [input.classId])
  const attendance = db.all<{ student_id: string; status: AttendanceStatus }>('SELECT student_id,status FROM attendance WHERE class_id=? AND date=?', [input.classId, input.date])
  const statuses = statusByStudent(students, attendance)
  const workbook = new ExcelJS.Workbook()
  try { await workbook.xlsx.readFile(record.source_xlsx_path) }
  catch (error) { if (isFileLockError(error)) throw new Error(LOCK_MESSAGE); throw error }
  const result = applyAttendanceColumn(workbook, {
    sheetName: mapping.sheetName ?? '', idColumn: mapping.idColumn!, date: input.date, students, statuses
  })
  const sourceExtension = path.extname(record.source_xlsx_path)
  const backupPath = path.join(path.dirname(record.source_xlsx_path), `${path.basename(record.source_xlsx_path, sourceExtension)}.bak.xlsx`)
  try {
    try { await fs.copyFile(record.source_xlsx_path, backupPath, fs.constants.COPYFILE_EXCL) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
    const tempPath = `${record.source_xlsx_path}.${randomUUID()}.tmp.xlsx`
    try {
      await workbook.xlsx.writeFile(tempPath)
      await fs.rename(tempPath, record.source_xlsx_path)
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined)
      if (isFileLockError(error)) throw new Error(LOCK_MESSAGE)
      throw error
    }
  } catch (error) {
    if (isFileLockError(error)) throw new Error(LOCK_MESSAGE)
    throw error
  }
  return { savedPath: record.source_xlsx_path, backupPath, matched: result.matched, header: result.header }
}

export async function exportScanLogXlsx(documentsPath: string, className: string, dateFrom: string, dateTo: string): Promise<string | null> {
  const entries = await readScanLog(documentsPath, className, dateFrom, dateTo)
  const safeName = className.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Class'
  const chosen = await dialog.showSaveDialog({
    title: 'Export scan log', defaultPath: path.join(documentsPath, 'PASS', safeName, `scan-log-${dateFrom}-to-${dateTo}.xlsx`),
    filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }]
  })
  if (chosen.canceled || !chosen.filePath) return null
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PASS Attendance Scanning System'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('Scan Log', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: 'timestamp_iso', key: 'timestamp_iso', width: 28 }, { header: 'date', key: 'date', width: 13 },
    { header: 'time', key: 'time', width: 12 }, { header: 'student_id', key: 'student_id', width: 18 },
    { header: 'name', key: 'name', width: 28 }, { header: 'class', key: 'class', width: 22 },
    { header: 'source', key: 'source', width: 13 }, { header: 'result', key: 'result', width: 24 }
  ]
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2A38' } }
  sheet.addRows(entries.map(entry => ({
    timestamp_iso: entry.timestamp_iso, date: entry.date, time: entry.time, student_id: entry.student_id,
    name: entry.name, class: entry.class, source: entry.source, result: entry.result
  })))
  await workbook.xlsx.writeFile(chosen.filePath)
  return chosen.filePath
}

export async function outputQrSheet(className: string, students: Array<{ student_id: string; name: string }>, mode: 'print' | 'pdf'): Promise<string | null> {
  if (!students.length) throw new Error('Select at least one student.')
  const defaultName = `${className.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}-QR-codes.pdf`
  const saveTarget = mode === 'pdf' ? await dialog.showSaveDialog({
    title: 'Save student QR codes as PDF', defaultPath: path.join(app.getPath('documents'), 'PASS', defaultName),
    filters: [{ name: 'PDF document', extensions: ['pdf'] }]
  }) : null
  if (saveTarget?.canceled || (mode === 'pdf' && !saveTarget?.filePath)) return null
  const cards = await Promise.all(students.map(async student => {
    const qr = await QRCode.toDataURL(`PASS|${student.student_id}`, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
    return `<article class="card"><img src="${qr}" alt="QR code for ${escapeHtml(student.student_id)}"><div class="name">${escapeHtml(student.name)}</div><div class="id">${escapeHtml(student.student_id)}</div></article>`
  }))
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';"><title>PASS QR Codes</title><style>
    @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1e2a38;margin:0}.heading{text-align:center;margin:0 0 7mm}.heading h1{font-size:18pt;margin:0 0 2mm}.heading p{font-size:9pt;color:#526170;margin:0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm}.card{border:1px solid #aeb8bf;border-radius:3mm;min-height:59mm;padding:3mm;display:flex;flex-direction:column;align-items:center;justify-content:center;break-inside:avoid;text-align:center}.card img{width:35mm;height:35mm}.name{font-size:10pt;font-weight:bold;margin-top:2mm;max-width:100%;overflow-wrap:anywhere}.id{font-size:8pt;color:#536271;margin-top:1mm}@media print{.card{border-color:#8b969e}}</style></head><body><header class="heading"><h1>${escapeHtml(className)} — Student QR Codes</h1><p>${students.length} student${students.length === 1 ? '' : 's'} · Scan payload format: PASS|Student ID</p></header><main class="grid">${cards.join('')}</main></body></html>`
  const tempDir = path.join(app.getPath('temp'), `pass-qr-${randomUUID()}`)
  await fs.mkdir(tempDir, { recursive: true })
  const htmlPath = path.join(tempDir, 'sheet.html')
  await fs.writeFile(htmlPath, html, 'utf8')
  const printWindow = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } })
  try {
    await printWindow.loadFile(htmlPath)
    if (mode === 'print') {
      await new Promise<void>((resolve, reject) => printWindow.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        if (success) resolve(); else reject(new Error(failureReason || 'Printing was cancelled.'))
      }))
      return null
    }
    const pdf = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { top: 0.45, bottom: 0.45, left: 0.45, right: 0.45 } })
    await fs.writeFile(saveTarget!.filePath!, pdf)
    return saveTarget!.filePath!
  } finally {
    if (!printWindow.isDestroyed()) printWindow.close()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export function toScanLogRows(entries: ScanLogEntry[]): ScanLogEntry[] { return entries }
