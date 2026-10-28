import { describe, expect, it } from 'vitest'
import { SCAN_LOG_HEADERS, scanLogCsvLine } from '../src/shared/csv'

describe('append-only scan-log CSV row serialization', () => {
  it('serializes the required header in the defined order', () => {
    expect(scanLogCsvLine([...SCAN_LOG_HEADERS])).toBe('timestamp_iso,date,time,student_id,name,class,source,result\r\n')
  })
  it('quotes commas, quotes, and line breaks safely for append', () => {
    expect(scanLogCsvLine(['2026-01-01T00:00:00.000Z', '2026-01-01', '08:00:00', '42', 'Doe, "Jane"', 'Grade 7\nA', 'manual', 'not-found']))
      .toBe('2026-01-01T00:00:00.000Z,2026-01-01,08:00:00,42,"Doe, ""Jane""","Grade 7\nA",manual,not-found\r\n')
  })
})
