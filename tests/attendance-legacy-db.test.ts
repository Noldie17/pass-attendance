import { afterEach, describe, expect, it, vi } from 'vitest'
import initSqlJs, { type Database } from 'sql.js'
import type { PassDatabase } from '../src/main/db'

const { getPath, appendScanLog } = vi.hoisted(() => ({
  getPath: vi.fn(),
  appendScanLog: vi.fn()
}))

vi.mock('electron', () => ({ app: { getPath } }))
vi.mock('../src/main/scan-log', () => ({ appendScanLog }))

import { AttendanceService } from '../src/main/attendance'
import { PinService } from '../src/main/pin'
import { SettingsService } from '../src/main/settings'

describe('attendance scan with existing database schema', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('records a scan when the existing database requires a non-null remark', async () => {
    const SQL = await initSqlJs()
    const sqlite = new SQL.Database()
    sqlite.run(`CREATE TABLE attendance (
      class_id TEXT NOT NULL, student_id TEXT NOT NULL, date TEXT NOT NULL,
      status TEXT NOT NULL, time_in TEXT, source TEXT NOT NULL, remark TEXT NOT NULL,
      PRIMARY KEY(class_id, student_id, date)
    )`)

    getPath.mockReturnValue('documents')
    appendScanLog.mockResolvedValue(undefined)
    const db = {
      all: vi.fn(() => []),
      get: vi.fn((sql: string) => {
        if (sql.startsWith('SELECT id,name FROM classes')) return { id: 'class-1', name: 'ICT' }
        if (sql.startsWith('SELECT students.student_id')) return { student_id: 'student-1', name: 'Student One', class_name: 'ICT' }
        return undefined
      }),
      write: vi.fn(async (operation: (database: Database) => unknown) => operation(sqlite))
    } as unknown as PassDatabase
    const service = new AttendanceService(db, new SettingsService(db), new PinService(db))

    const result = await service.scan({ classId: 'class-1', payload: 'student-1', source: 'webcam' })

    expect(result.code).toBe('recorded')
    expect(sqlite.exec('SELECT remark FROM attendance')[0].values).toEqual([['']])
    sqlite.close()
  })

  it('lets a continuously visible QR code retry after the original cooldown expires', async () => {
    const now = new Date(2026, 9, 29, 8, 0)
    vi.useFakeTimers()
    vi.setSystemTime(now)
    getPath.mockReturnValue('documents')
    appendScanLog.mockResolvedValue(undefined)

    let recorded = false
    const db = {
      all: vi.fn(() => []),
      get: vi.fn((sql: string) => {
        if (sql.startsWith('SELECT id,name FROM classes')) return { id: 'class-1', name: 'ICT' }
        if (sql.startsWith('SELECT students.student_id')) return { student_id: 'student-1', name: 'Student One', class_name: 'ICT' }
        if (sql.startsWith('SELECT status,time_in FROM attendance')) return recorded ? { status: 'P', time_in: '08:00:00' } : undefined
        return undefined
      }),
      write: vi.fn(async () => { recorded = true })
    } as unknown as PassDatabase
    const service = new AttendanceService(db, new SettingsService(db), new PinService(db))
    const scan = () => service.scan({ classId: 'class-1', payload: 'student-1', source: 'webcam' })

    expect((await scan()).code).toBe('recorded')
    vi.advanceTimersByTime(1_000)
    expect((await scan()).code).toBe('cooldown-ignored')
    vi.advanceTimersByTime(4_000)
    expect((await scan()).code).toBe('already-recorded')
  })
})
