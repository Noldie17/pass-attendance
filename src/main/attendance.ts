import { app } from 'electron'
import { decideAttendance, isWithinCooldown, parseStudentId } from '@shared/logic'
import type { AttendanceStatus, AttendanceViewRow, ScanResult, ScanSource } from '@shared/types'
import type { PassDatabase } from './db'
import { appendScanLog } from './scan-log'
import { SettingsService } from './settings'
import { PinService } from './pin'

interface StudentLookup { student_id: string; name: string; class_name: string }
function localDateTime(now: Date): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  return { date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` }
}
export class AttendanceService {
  private readonly lastScan = new Map<string, number>()
  constructor(private readonly db: PassDatabase, private readonly settings: SettingsService, private readonly pin: PinService) {}

  list(classId: string, date: string): AttendanceViewRow[] {
    return this.db.all<AttendanceViewRow>(`SELECT s.student_id,s.name,COALESCE(a.status,'A') AS status,
      CASE WHEN a.student_id IS NULL THEN 0 ELSE 1 END AS recorded,a.time_in,a.source,a.remark
      FROM students s LEFT JOIN attendance a ON a.class_id=s.class_id AND a.student_id=s.student_id AND a.date=?
      WHERE s.class_id=? ORDER BY s.name COLLATE NOCASE`, [date, classId]).map(row => ({ ...row, recorded: Boolean(row.recorded) }))
  }

  async setManual(input: { classId: string; studentId: string; date: string; status: AttendanceStatus; remark: string; pin?: string }): Promise<void> {
    if (!['P', 'L', 'A'].includes(input.status)) throw new Error('Choose Present, Late, or Absent.')
    if (this.settings.get().pin_enabled && (!input.pin || !await this.pin.verify(input.pin))) throw new Error('PIN is incorrect.')
    const student = this.db.get<{ id: number }>('SELECT id FROM students WHERE class_id=? AND student_id=?', [input.classId, input.studentId])
    if (!student) throw new Error('Student is not in this class.')
    const now = localDateTime(new Date())
    await this.db.write(database => database.run(`INSERT INTO attendance(class_id,student_id,date,status,time_in,source,remark)
      VALUES(?,?,?,?,?,'manual',?) ON CONFLICT(class_id,student_id,date) DO UPDATE SET
      status=excluded.status,time_in=excluded.time_in,source='manual',remark=excluded.remark`,
      [input.classId, input.studentId, input.date, input.status, input.status === 'A' ? null : now.time, input.remark.trim() || null]))
  }

  async scan(input: { classId: string; payload: string; source: ScanSource }): Promise<ScanResult> {
    const now = new Date(), timestampIso = now.toISOString(), { date, time } = localDateTime(now)
    const studentId = parseStudentId(input.payload)
    const classRecord = this.db.get<{ id: string; name: string }>('SELECT id,name FROM classes WHERE id=?', [input.classId])
    if (!classRecord) throw new Error('Select a class before scanning.')
    const lookup = this.db.get<StudentLookup>('SELECT students.student_id,students.name,classes.name AS class_name FROM students JOIN classes ON classes.id=students.class_id WHERE students.class_id=? AND students.student_id=?', [input.classId, studentId])
    const cooldownKey = `${input.classId}:${studentId}`, nowMs = now.getTime()
    if (isWithinCooldown(this.lastScan.get(cooldownKey), nowMs, this.settings.get().cooldown_sec)) {
      this.lastScan.set(cooldownKey, nowMs)
      await this.log(classRecord.name, { timestampIso, date, time, studentId, name: lookup?.name ?? '', className: classRecord.name, source: input.source, result: 'ignored-cooldown' })
      return { code: 'cooldown-ignored', studentId, name: lookup?.name ?? null, status: null, time: null, message: '' }
    }
    this.lastScan.set(cooldownKey, nowMs)
    if (!lookup) {
      await this.log(classRecord.name, { timestampIso, date, time, studentId, name: '', className: classRecord.name, source: input.source, result: 'not-found' })
      return { code: 'not-found', studentId, name: null, status: null, time: null, message: 'ID not in this class' }
    }
    const existing = this.db.get<{ status: AttendanceStatus; time_in: string | null }>('SELECT status,time_in FROM attendance WHERE class_id=? AND student_id=? AND date=?', [input.classId, studentId, date])
    if (existing) {
      await this.log(classRecord.name, { timestampIso, date, time, studentId, name: lookup.name, className: classRecord.name, source: input.source, result: `already-recorded:${existing.status}` })
      return { code: 'already-recorded', studentId, name: lookup.name, status: existing.status, time: existing.time_in, message: `Already recorded at ${existing.time_in ?? '--:--'}` }
    }
    const status = decideAttendance({ now, lateCutoff: this.settings.get().late_cutoff, alreadyRecorded: false }) as AttendanceStatus
    await this.db.write(database => database.run('INSERT INTO attendance(class_id,student_id,date,status,time_in,source,remark) VALUES(?,?,?,?,?,?,NULL)', [input.classId, studentId, date, status, time, input.source]))
    await this.log(classRecord.name, { timestampIso, date, time, studentId, name: lookup.name, className: classRecord.name, source: input.source, result: `recorded:${status}` })
    return { code: 'recorded', studentId, name: lookup.name, status, time, message: status === 'L' ? 'Late' : 'Present' }
  }
  private async log(className: string, row: Parameters<typeof appendScanLog>[2]): Promise<void> {
    await appendScanLog(app.getPath('documents'), className, row)
  }
}
