import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { SCAN_LOG_HEADERS, scanLogCsvLine } from '@shared/csv'
import type { ScanLogEntry } from '@shared/types'

export interface ScanLogRow {
  timestampIso: string; date: string; time: string; studentId: string; name: string
  className: string; source: string; result: string
}
function safeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().replace(/[. ]+$/g, '') || 'Class'
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = '' }
    else field += char
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row) }
  return rows
}
export async function appendScanLog(documentsPath: string, className: string, row: ScanLogRow): Promise<string> {
  const directory = path.join(documentsPath, 'PASS', safeFolderName(className))
  const filePath = path.join(directory, 'scan-log.csv')
  await fs.mkdir(directory, { recursive: true })
  const handle = await fs.open(filePath, constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY, 0o600)
  try {
    if ((await handle.stat()).size === 0) await handle.writeFile(scanLogCsvLine([...SCAN_LOG_HEADERS]))
    await handle.writeFile(scanLogCsvLine([row.timestampIso, row.date, row.time, row.studentId, row.name, row.className, row.source, row.result]))
    await handle.sync()
  } finally { await handle.close() }
  return filePath
}
export async function readScanLog(documentsPath: string, className: string, dateFrom: string, dateTo: string): Promise<ScanLogEntry[]> {
  const filePath = path.join(documentsPath, 'PASS', safeFolderName(className), 'scan-log.csv')
  let text: string
  try { text = await fs.readFile(filePath, 'utf8') }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  const [headers, ...rows] = parseCsv(text)
  if (!headers) return []
  const index = new Map(headers.map((header, i) => [header, i]))
  const fields = ['timestamp_iso', 'date', 'time', 'student_id', 'name', 'class', 'source', 'result'] as const
  return rows.map(row => Object.fromEntries(fields.map(field => [field, row[index.get(field) ?? -1] ?? ''])) as unknown as ScanLogEntry)
    .filter(entry => entry.date >= dateFrom && entry.date <= dateTo)
    .reverse()
}
