import { describe, expect, it } from 'vitest'
import { decideAttendance, isWithinCooldown, mapImportRows, parseStudentId } from '../src/shared/logic'

describe('attendance decision rules', () => {
  it('marks scans at or before cutoff present', () => {
    expect(decideAttendance({ now: new Date(2026, 0, 1, 7, 45, 0), lateCutoff: '07:45', alreadyRecorded: false })).toBe('P')
  })
  it('marks scans after cutoff late', () => {
    expect(decideAttendance({ now: new Date(2026, 0, 1, 7, 45, 1), lateCutoff: '07:45', alreadyRecorded: false })).toBe('L')
  })
  it('does not overwrite an existing daily record', () => {
    expect(decideAttendance({ now: new Date(2026, 0, 1, 9), lateCutoff: '07:45', alreadyRecorded: true })).toBe('duplicate')
  })
})

describe('scan cooldown and payload parsing', () => {
  it('ignores scans within the configured interval but allows the exact boundary', () => {
    expect(isWithinCooldown(1_000, 5_999, 5)).toBe(true)
    expect(isWithinCooldown(1_000, 6_000, 5)).toBe(false)
    expect(isWithinCooldown(undefined, 2_000, 5)).toBe(false)
  })
  it('accepts PASS-prefixed and bare IDs', () => {
    expect(parseStudentId(' PASS|STU-01 ')).toBe('STU-01')
    expect(parseStudentId('STU-02')).toBe('STU-02')
  })
})

describe('spreadsheet column mapping', () => {
  it('maps chosen zero-based columns and rejects blank or duplicate IDs', () => {
    const mapped = mapImportRows([
      ['Ana', '001'],
      ['Ben', '002'],
      ['Duplicate', '001'],
      ['', '003'],
      ['No ID', '']
    ], 1, 0)
    expect(mapped.valid).toEqual([{ studentId: '001', name: 'Ana' }, { studentId: '002', name: 'Ben' }])
    expect(mapped.errors).toHaveLength(3)
    expect(mapped.errors[0]).toContain('duplicate Student ID')
  })
})
