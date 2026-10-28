import { describe, expect, it } from 'vitest'
import { exportAttendanceRows } from '../src/shared/logic'

describe('Excel attendance export cell data', () => {
  it('matches students by ID and represents students without a record as absent', () => {
    const rows = exportAttendanceRows([
      { student_id: 's1', name: 'Student One' },
      { student_id: 's2', name: 'Student Two' }
    ], new Map([['s1', 'L']]))
    expect(rows).toEqual([
      { studentId: 's1', name: 'Student One', status: 'L' },
      { studentId: 's2', name: 'Student Two', status: 'A' }
    ])
  })
})
