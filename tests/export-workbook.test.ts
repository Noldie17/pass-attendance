import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { applyAttendanceColumn } from '../src/main/export-services'

function sampleBook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet1')
  sheet.addRow(['Student ID', 'Name'])
  sheet.addRow(['2026-0001', 'Student One'])
  sheet.addRow(['2026-0002', 'Student Two'])
  return workbook
}
const students = [{ student_id: '2026-0001' }, { student_id: '2026-0002' }]

describe('applyAttendanceColumn', () => {
  it('adds one new date column per date after the last used column', () => {
    const workbook = sampleBook()
    const first = applyAttendanceColumn(workbook, { sheetName: 'Sheet1', idColumn: 0, date: '2026-10-28', students, statuses: new Map([['2026-0001', 'P']]) })
    const second = applyAttendanceColumn(workbook, { sheetName: 'Sheet1', idColumn: 0, date: '2026-10-29', students, statuses: new Map([['2026-0001', 'L']]) })
    expect(first.columnNumber).toBe(3)
    expect(second.columnNumber).toBe(4)
    expect(workbook.worksheets[0].getCell(2, 3).value).toBe('P')
    expect(workbook.worksheets[0].getCell(3, 3).value).toBe('A')
  })
  it('re-exporting the same date updates its column instead of adding a duplicate', () => {
    const workbook = sampleBook()
    applyAttendanceColumn(workbook, { sheetName: 'Sheet1', idColumn: 0, date: '2026-10-28', students, statuses: new Map([['2026-0001', 'P']]) })
    const again = applyAttendanceColumn(workbook, { sheetName: 'Sheet1', idColumn: 0, date: '2026-10-28', students, statuses: new Map([['2026-0001', 'L'], ['2026-0002', 'P']]) })
    const sheet = workbook.worksheets[0]
    expect(again.columnNumber).toBe(3)
    expect(sheet.columnCount).toBe(3)
    expect(sheet.getCell(2, 3).value).toBe('L')
    expect(sheet.getCell(3, 3).value).toBe('P')
  })
})
