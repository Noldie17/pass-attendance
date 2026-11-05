import ExcelJS from 'exceljs'
import QRCode from 'qrcode'
import { app, BrowserWindow, dialog } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AttendanceStatus, ClassRecord, ClassRecordExportPreview, ExportSheetOption, ScanLogEntry, StudentRecord } from '@shared/types'
import type { PassDatabase } from './db'
import { readScanLog } from './scan-log'
import { getSf2WorkbookPath, listSf2Sheets, previewSf2Workbook, updateSf2Workbook } from './sf2-export'
import { readSpreadsheet } from './spreadsheet-reader'
import { normalizeStudentName } from '@shared/sf2'
import { UserFacingError } from '@shared/errors'

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
function valueOf(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('result' in value) return value.result ?? ''
    if ('text' in value) return value.text ?? ''
    if ('richText' in value) return value.richText.map(part => part.text).join('')
  }
  return value
}
function verificationValues(sheet: ExcelJS.Worksheet): Array<{ address: string; value: unknown }> {
  const values: Array<{ address: string; value: unknown }> = []
  sheet.eachRow(row => row.eachCell({ includeEmpty: false }, cell => {
    if (cell.value !== null && cell.value !== undefined) values.push({
      address: cell.address,
      value: JSON.parse(JSON.stringify(valueOf(cell.value))) as unknown
    })
  }))
  return values
}
export async function writeVerifiedWorkbook(workbook: ExcelJS.Workbook, workbookPath: string, sheetName: string, expected: Array<{ address: string; value: unknown }>): Promise<string> {
  const backupPath = path.join(path.dirname(workbookPath), `${path.basename(workbookPath, path.extname(workbookPath))}.bak.xlsx`)
  const tempPath = `${workbookPath}.${randomUUID()}.tmp.xlsx`
  try {
    await workbook.xlsx.writeFile(tempPath)
    const verified = new ExcelJS.Workbook()
    await verified.xlsx.readFile(tempPath)
    const verifiedSheet = verified.getWorksheet(sheetName)
    if (!verifiedSheet) throw new UserFacingError('The saved workbook could not be verified because the selected worksheet is missing.')
    for (const expectedCell of expected) {
      const actual = valueOf(verifiedSheet.getCell(expectedCell.address).value)
      if (JSON.stringify(actual) !== JSON.stringify(expectedCell.value)) {
        throw new UserFacingError(`The workbook update could not be verified at cell ${expectedCell.address}. The original file was not changed.`)
      }
    }
    try { await fs.copyFile(workbookPath, backupPath, fs.constants.COPYFILE_EXCL) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
    await fs.rename(tempPath, workbookPath)
  } catch (error) {
    try { await fs.rm(tempPath, { force: true }) }
    catch (cleanupError) {
      throw new UserFacingError(`The workbook was not updated. Temporary file cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`, { cause: error })
    }
    if (isFileLockError(error)) throw new UserFacingError(LOCK_MESSAGE, { cause: error })
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(`The workbook was not updated: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
  return backupPath
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

function emptyPreview(filePath: string, errors: string[] = []): ClassRecordExportPreview {
  return {
    filePath, kind: null, sheets: [], sheet: null, month: null, day: null, date: null, dayColumn: null,
    willMarkAbsent: [], willClear: [], unchanged: 0, unmatchedClass: [], unmatchedSheet: [],
    scansCount: 0, errors, warnings: []
  }
}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
}

function fileReadMessage(error: unknown): string {
  if (isFileLockError(error)) return LOCK_MESSAGE
  if (isMissingFile(error)) return 'The selected workbook was not found. Choose the file again.'
  return `Could not read the selected workbook. Check that it is a valid Excel file and not damaged: ${error instanceof Error ? error.message : String(error)}`
}

function zipPartNames(buffer: Buffer): string[] {
  let end = -1
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { end = offset; break }
  }
  if (end < 0 || end + 20 > buffer.length) return []
  const entries = buffer.readUInt16LE(end + 10)
  let offset = buffer.readUInt32LE(end + 16)
  const names: string[] = []
  for (let index = 0; index < entries && offset + 46 <= buffer.length; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    if (offset + 46 + nameLength + extraLength + commentLength > buffer.length) break
    names.push(buffer.toString('utf8', offset + 46, offset + 46 + nameLength))
    offset += 46 + nameLength + extraLength + commentLength
  }
  return names
}

function workbookArtifactWarnings(names: string[]): string[] {
  return names.some(name => /^xl\/(charts|drawings|ctrlProps|activeX|controls)\//i.test(name))
    ? ['This workbook contains charts, drawings, or form controls that ExcelJS may not preserve when saving. Keep the original and inspect the updated copy.']
    : []
}

function tableSheetOptions(workbook: ExcelJS.Workbook): ExportSheetOption[] {
  return workbook.worksheets.map(sheet => ({
    name: sheet.name, kind: 'table', month: null, schoolYear: null, gradeLevel: null, section: null,
    learnerCount: 0, differentSection: false, days: []
  }))
}

function tablePreview(workbook: ExcelJS.Workbook, options: {
  filePath: string
  students: StudentRecord[]
  attendance: Array<{ student_id: string; status: AttendanceStatus }>
  date: string
  sheetName?: string
  mapping: { idColumn?: number; nameColumn?: number; headerRow?: number; sheetName?: string }
}): ClassRecordExportPreview {
  const sheets = tableSheetOptions(workbook)
  const errors: string[] = []
  const warnings: string[] = []
  const sheet = workbook.getWorksheet(options.sheetName ?? options.mapping.sheetName ?? '')
  if (!sheet) errors.push('Choose an available worksheet from this workbook.')
  if (!options.date || !Number.isFinite(new Date(`${options.date}T12:00:00`).getTime())) errors.push('Choose a valid attendance date.')
  if (!Number.isInteger(options.mapping.idColumn) || !Number.isInteger(options.mapping.nameColumn)) {
    errors.push('The saved roster column mapping is incomplete. Re-import the class workbook.')
  }
  if (!sheet || !Number.isInteger(options.mapping.idColumn) || !Number.isInteger(options.mapping.nameColumn)) {
    return {
      ...emptyPreview(options.filePath, errors), kind: 'table', sheets, sheet: sheet?.name ?? null,
      date: options.date || null, scansCount: options.attendance.length, warnings
    }
  }
  const idColumn = options.mapping.idColumn!
  const nameColumn = options.mapping.nameColumn!
  const headerRow = options.mapping.headerRow ?? 1
  const idByStudent = new Map(options.students.map(student => [student.student_id.trim().toLocaleLowerCase(), student]))
  const rowByStudent = new Map<string, number>()
  const unmatchedSheet: string[] = []
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    const id = String(valueOf(row.getCell(idColumn + 1).value)).trim().toLocaleLowerCase()
    const name = String(valueOf(row.getCell(nameColumn + 1).value)).trim()
    if (!id && !name) continue
    const student = idByStudent.get(id)
    if (student) rowByStudent.set(student.student_id, rowNumber)
    else if (name) unmatchedSheet.push(name)
  }
  const unmatchedClass = options.students.filter(student => !rowByStudent.has(student.student_id)).map(student => student.name)
  const matched = rowByStudent.size
  const ratio = options.students.length ? matched / options.students.length : 0
  if (!matched || ratio < 0.5) errors.push(`Only ${matched} of ${options.students.length} active learners match this worksheet. Choose the correct file or sheet.`)
  else if (ratio <= 0.9) warnings.push(`Only ${matched} of ${options.students.length} learners match. Not in PASS: ${unmatchedSheet.join('; ') || 'none'}. Not in worksheet: ${unmatchedClass.join('; ') || 'none'}.`)
  if (!options.attendance.length) warnings.push(`No attendance records are saved for ${options.date}; this update will mark ${matched} matched learners absent.`)
  const parsedDate = new Date(`${options.date}T12:00:00`)
  const header = parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  let dayColumn = Math.max(sheet.columnCount, 1) + 1
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
    if (String(valueOf(cell.value)).trim() === header) dayColumn = column
  })
  const statusById = new Map(options.attendance.map(mark => [mark.student_id.toLocaleLowerCase(), mark.status]))
  const willMarkAbsent: string[] = []
  let unchanged = 0
  for (const student of options.students) {
    const row = rowByStudent.get(student.student_id)
    if (!row) continue
    const value = String(valueOf(sheet.getCell(row, dayColumn).value)).trim()
    const status = statusById.get(student.student_id.toLocaleLowerCase()) ?? 'A'
    if (status === 'A') willMarkAbsent.push(student.name)
    else if (value) unchanged++
  }
  return {
    filePath: options.filePath, kind: 'table', sheets, sheet: sheet.name, month: null, day: parsedDate.getDate(),
    date: options.date, dayColumn, willMarkAbsent, willClear: [], unchanged, unmatchedClass, unmatchedSheet,
    scansCount: options.attendance.length, errors, warnings
  }
}

export async function previewClassWorkbook(db: PassDatabase, input: {
  classId: string; filePath?: string; date?: string; sheetName?: string; day?: number
}): Promise<ClassRecordExportPreview> {
  const record = db.get<ClassRecord>('SELECT * FROM classes WHERE id=?', [input.classId])
  if (!record) return emptyPreview(input.filePath ?? '', ['Class not found. Select a class and try again.'])
  const mapping = JSON.parse(record.col_map_json ?? '{}') as { kind?: string; idColumn?: number; nameColumn?: number; headerRow?: number; sheetName?: string }
  const filePath = input.filePath ?? record.export_xlsx_path ?? record.source_xlsx_path ?? ''
  if (!filePath) return emptyPreview(filePath, ['This class has no linked workbook. Choose an Excel workbook to continue.'])
  const extension = path.extname(filePath).toLocaleLowerCase()
  if (extension === '.xls') return emptyPreview(filePath, ['This is a legacy .xls file, which PASS cannot safely update. Open it in Excel, choose Save As → Excel Workbook (.xlsx), then link the .xlsx copy.'])
  if (extension !== '.xlsx') return emptyPreview(filePath, ['Unsupported file type. Choose an Excel Workbook (.xlsx).'])
  let buffer: Buffer
  try { buffer = await fs.readFile(filePath) }
  catch (error) { return emptyPreview(filePath, [fileReadMessage(error)]) }
  const artifactWarnings = workbookArtifactWarnings(zipPartNames(buffer))
  const workbook = new ExcelJS.Workbook()
  try { await workbook.xlsx.load(buffer) }
  catch (error) { return emptyPreview(filePath, [fileReadMessage(error)]) }
  const students = db.all<StudentRecord>('SELECT id,class_id,student_id,name,sex,active FROM students WHERE class_id=? AND active=1 ORDER BY id', [input.classId])
  if (record.grade_level || mapping.kind === 'sf2') {
    const initial = previewSf2Workbook(workbook, { record, students, attendance: [], filePath, date: input.date, sheetName: input.sheetName, day: input.day })
    const selectedDate = initial.date ?? input.date ?? ''
    const attendance = selectedDate
      ? db.all<{ student_id: string; status: AttendanceStatus }>('SELECT student_id,status FROM attendance WHERE class_id=? AND date=?', [input.classId, selectedDate])
      : []
    const result = previewSf2Workbook(workbook, { record, students, attendance, filePath, date: input.date, sheetName: input.sheetName, day: input.day })
    result.warnings.push(...artifactWarnings)
    return result
  }
  if (!input.date) return emptyPreview(filePath, ['Choose an attendance date.'])
  const attendance = db.all<{ student_id: string; status: AttendanceStatus }>('SELECT student_id,status FROM attendance WHERE class_id=? AND date=?', [input.classId, input.date])
  const result = tablePreview(workbook, { filePath, students, attendance, date: input.date, sheetName: input.sheetName, mapping })
  result.sheets = readSpreadsheet(filePath).sheets.filter(sheet => !sheet.sf2).map(sheet => ({
    name: sheet.name, kind: 'table', month: null, schoolYear: null, gradeLevel: null, section: null,
    learnerCount: 0, differentSection: false, days: []
  }))
  result.warnings.push(...artifactWarnings)
  return result
}

export async function updateClassWorkbook(db: PassDatabase, input: {
  classId: string; date: string; filePath?: string; sheetName?: string; day?: number; confirmWarnings?: boolean
}): Promise<{ savedPath: string; backupPath: string; matched: number; header: string }> {
  const preview = await previewClassWorkbook(db, input)
  if (preview.errors.length) throw new UserFacingError(preview.errors.join('\n'))
  if (preview.warnings.length && !input.confirmWarnings) throw new UserFacingError('Review and confirm the export warnings before updating the workbook.')
  const record = db.get<ClassRecord>('SELECT * FROM classes WHERE id=?', [input.classId])
  if (!record) throw new UserFacingError('Class not found. Select a class and try again.')
  const mapping = JSON.parse(record.col_map_json ?? '{}') as { kind?: string; idColumn?: number; sheetName?: string }
  const workbookPath = input.filePath ?? record.export_xlsx_path ?? record.source_xlsx_path
  if (!workbookPath) throw new UserFacingError('This class has no linked workbook. Choose an Excel workbook to continue.')
  const students = db.all<StudentRecord>('SELECT id,class_id,student_id,name,sex,active FROM students WHERE class_id=? AND active=1 ORDER BY id', [input.classId])
  const attendance = db.all<{ student_id: string; status: AttendanceStatus }>('SELECT student_id,status FROM attendance WHERE class_id=? AND date=?', [input.classId, preview.date ?? input.date])
  const workbook = new ExcelJS.Workbook()
  try { await workbook.xlsx.readFile(workbookPath) }
  catch (error) { throw new UserFacingError(fileReadMessage(error), { cause: error }) }
  const isSf2 = Boolean(record.grade_level || mapping.kind === 'sf2')
  let result: { sheetName: string; matched: number; dayColumn: number; header: string; verification: Array<{ address: string; value: unknown }> }
  if (isSf2) {
    const updated = updateSf2Workbook(workbook, {
      record, students, attendance, date: preview.date ?? input.date, sheetName: preview.sheet ?? undefined,
      day: preview.day ?? undefined, filePath: workbookPath, confirmWarnings: true
    })
    result = {
      ...updated,
      header: `${updated.month} ${String(preview.day ?? Number((preview.date ?? input.date).slice(-2))).padStart(2, '0')}`,
      verification: updated.verification
    }
  } else {
    const updated = applyAttendanceColumn(workbook, {
      sheetName: preview.sheet ?? mapping.sheetName ?? '', idColumn: mapping.idColumn!, date: preview.date ?? input.date,
      students, statuses: statusByStudent(students, attendance)
    })
    const sheet = workbook.getWorksheet(updated.sheetName)!
    result = {
      ...updated,
      dayColumn: updated.columnNumber,
      verification: verificationValues(sheet)
    }
  }
  const backupPath = await writeVerifiedWorkbook(workbook, workbookPath, result.sheetName, result.verification)
  return { savedPath: workbookPath, backupPath, matched: result.matched, header: result.header }
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
