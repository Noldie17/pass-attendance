import type { AttendanceStatus } from './types'

export interface ScanDecisionInput {
  now: Date
  lateCutoff: string
  alreadyRecorded: boolean
}

export function decideAttendance({ now, lateCutoff, alreadyRecorded }: ScanDecisionInput): AttendanceStatus | 'duplicate' {
  if (alreadyRecorded) return 'duplicate'
  const [hours, minutes] = lateCutoff.split(':').map(Number)
  const cutoff = new Date(now)
  cutoff.setHours(hours, minutes, 0, 0)
  return now.getTime() > cutoff.getTime() ? 'L' : 'P'
}

export function isWithinCooldown(previousAt: number | undefined, nowAt: number, cooldownSeconds: number): boolean {
  return previousAt !== undefined && nowAt - previousAt < cooldownSeconds * 1000
}

export function parseStudentId(payload: string): string {
  const trimmed = payload.trim()
  if (trimmed.startsWith('PASS|')) return trimmed.slice(5).trim()
  return trimmed
}

export interface StudentImportRow { studentId: string; name: string }

export function mapImportRows(rows: unknown[][], idColumn: number, nameColumn: number): { valid: StudentImportRow[]; errors: string[] } {
  const valid: StudentImportRow[] = []
  const errors: string[] = []
  const seen = new Set<string>()
  rows.forEach((row, index) => {
    const studentId = String(row[idColumn] ?? '').trim()
    const name = String(row[nameColumn] ?? '').trim()
    const rowNumber = index + 2
    if (!studentId) { errors.push(`Row ${rowNumber}: Student ID is empty.`); return }
    if (!name) { errors.push(`Row ${rowNumber}: Name is empty.`); return }
    if (seen.has(studentId)) { errors.push(`Row ${rowNumber}: duplicate Student ID "${studentId}".`); return }
    seen.add(studentId)
    valid.push({ studentId, name })
  })
  return { valid, errors }
}

export function exportAttendanceRows(students: Array<{ student_id: string; name: string }>, statuses: Map<string, AttendanceStatus>): Array<{ studentId: string; name: string; status: AttendanceStatus }> {
  return students.map(student => ({
    studentId: student.student_id,
    name: student.name,
    status: statuses.get(student.student_id) ?? 'A'
  }))
}
