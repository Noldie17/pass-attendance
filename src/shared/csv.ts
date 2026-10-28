export const SCAN_LOG_HEADERS = ['timestamp_iso', 'date', 'time', 'student_id', 'name', 'class', 'source', 'result'] as const

export function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function scanLogCsvLine(values: readonly string[]): string {
  return values.map(csvEscape).join(',') + '\r\n'
}
