import ExcelJS from 'exceljs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSf2WorkbookPath, previewSf2Workbook, updateSf2Workbook, verifySf2WorkbookCopy } from '../src/main/sf2-export'
import { readSpreadsheet } from '../src/main/spreadsheet-reader'
import { planSf2Import } from '../src/shared/sf2'
import type { ClassRecord, StudentRecord } from '../src/shared/types'

const fixtureXlsx = path.resolve('tests/fixtures/SF2_sample_anonymized.xlsx')
const fixtureXls = path.resolve('tests/fixtures/SF2_sample_anonymized.xls')
const workbookFile = readSpreadsheet(fixtureXlsx)
const februarySheetName = workbookFile.sheets.find(sheet => sheet.sf2?.month === 'FEBRUARY')!.name
const data = workbookFile.sheets.find(sheet => sheet.sf2?.month === 'FEBRUARY')!.sf2!
const planned = planSf2Import(data.learners, data.gradeNumber, data.section, []).learners
const students: StudentRecord[] = planned.map((learner, index) => ({
  id: index + 1,
  class_id: 'class-id',
  student_id: learner.studentId,
  name: learner.name,
  sex: learner.sex,
  active: 1
}))
const record: ClassRecord = {
  id: 'class-id',
  name: 'Grade 10 ICT',
  section: 'ICT',
  subject: '',
  school_year: '2025-2026',
  grade_level: 'Grade 10 (Year IV)',
  source_xlsx_path: fixtureXlsx,
  export_xlsx_path: null,
  col_map_json: JSON.stringify({ kind: 'sf2', sheetName: 'school_form_2_ver2014.2.1.1 (2)', month: 'FEBRUARY' })
}

async function loadFixture(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(fixtureXlsx)
  return workbook
}

function snapshot(sheet: ExcelJS.Worksheet): Map<string, string> {
  const cells = new Map<string, string>()
  sheet.eachRow((row, rowNumber) => row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    if (cell.isMerged && cell.master.address !== cell.address) return
    cells.set(`${rowNumber}:${columnNumber}`, JSON.stringify(cell.value ?? null))
  }))
  return cells
}

describe('SF2 export', () => {
  it('links only an .xlsx copy with the same learners and requires one for legacy .xls sources', () => {
    expect(() => getSf2WorkbookPath({ ...record, source_xlsx_path: fixtureXls })).toThrow(/Link \.xlsx copy/)
    expect(getSf2WorkbookPath({ ...record, source_xlsx_path: fixtureXls, export_xlsx_path: fixtureXlsx })).toBe(fixtureXlsx)
    const source = readSpreadsheet(fixtureXlsx)
    expect(() => verifySf2WorkbookCopy({
      record,
      filePath: fixtureXlsx,
      sheets: source.sheets.map(sheet => sheet.sf2),
      activeNames: students.map(student => student.name)
    })).not.toThrow()
    expect(() => verifySf2WorkbookCopy({
      record,
      filePath: fixtureXlsx,
      sheets: source.sheets.map(sheet => sheet.sf2),
      activeNames: students.slice(1).map(student => student.name)
    })).toThrow(/same active learners/)
  })

  it('writes present, absent, and late to the matching day and updates monthly totals only', async () => {
    const workbook = await loadFixture()
    const sheet = workbook.getWorksheet(februarySheetName)!
    const before = snapshot(sheet)
    const statuses = students.map((student, index) => ({
      student_id: student.student_id,
      status: index === 1 ? 'A' as const : index === 2 ? 'L' as const : 'P' as const
    }))
    const result = updateSf2Workbook(workbook, { record, students, attendance: statuses, date: '2026-02-02' })
    expect(result).toMatchObject({ month: 'FEBRUARY', matched: 29, dayColumn: 6 })
    expect(sheet.getCell(8, 6).value).toBeNull()
    expect(sheet.getCell(9, 6).value).toBe('x')
    expect(sheet.getCell(10, 6).value).toBeNull()
    expect(sheet.getCell(10, 6).fill).toMatchObject({ type: 'pattern', pattern: 'none' })
    expect(sheet.getCell(data.maleTotalRow, 6).value).toBe(14)
    expect(sheet.getCell(data.femaleTotalRow, 6).value).toBe(14)
    expect(sheet.getCell(data.combinedTotalRow, 6).value).toBe(28)
    expect(sheet.getCell(8, 39).value).toBe(0)
    expect(sheet.getCell(8, 41).value).toBe(19)
    expect(sheet.getCell(9, 39).value).toBe(1)
    expect(sheet.getCell(9, 41).value).toBe(18)
    expect(sheet.getCell(data.combinedTotalRow, 39).value).toBe(1)
    expect(sheet.getCell(data.combinedTotalRow, 41).value).toBe(550)
    expect(sheet.getCell(48, 44).value).toBe(15)
    expect(sheet.getCell(48, 45).value).toBe(14)
    expect(sheet.getCell(48, 46).value).toBe(29)
    expect(sheet.getCell(50, 44).value).toBe(1)
    expect(sheet.getCell(50, 45).value).toBe(1)
    expect(sheet.getCell(52, 44).value).toBeCloseTo(284 / 19)
    expect(sheet.getCell(52, 45).value).toBe(14)
    expect(sheet.getCell(54, 44).value).toBeCloseTo((284 / 19) / 15)
    expect(sheet.getCell(54, 45).value).toBe(1)
    expect(workbook.calcProperties.fullCalcOnLoad).toBe(true)

    const allowed = new Set<string>()
    const allowMergedCell = (row: number, column: number) => {
      allowed.add(`${row}:${column}`)
    }
    for (const student of students) {
      const row = data.learners.findIndex(learner => learner.name === student.name)
      const sheetRow = row < 15 ? row + 8 : row + 9
      allowMergedCell(sheetRow, 6)
      allowMergedCell(sheetRow, 39)
      allowMergedCell(sheetRow, 41)
    }
    for (const row of [data.maleTotalRow, data.femaleTotalRow, data.combinedTotalRow]) {
      for (const column of [6, 39, 41]) allowMergedCell(row, column)
    }
    for (const row of [48, 50, 52, 54]) for (const column of [44, 45, 46]) allowMergedCell(row, column)
    const after = snapshot(sheet)
    const changed = [...after].filter(([cell, value]) => before.get(cell) !== value).map(([cell]) => cell)
    expect(changed.every(cell => allowed.has(cell))).toBe(true)
  })

  it('updates the same date column when re-run', async () => {
    const workbook = await loadFixture()
    const first = updateSf2Workbook(workbook, {
      record, students, attendance: [{ student_id: students[0].student_id, status: 'L' }], date: '2026-02-02'
    })
    const sheet = workbook.getWorksheet(februarySheetName)!
    expect(sheet.getCell(8, first.dayColumn).value).toBeNull()
    expect(sheet.getCell(8, first.dayColumn).fill).toMatchObject({ type: 'pattern', pattern: 'none' })
    const second = updateSf2Workbook(workbook, {
      record, students, attendance: [{ student_id: students[0].student_id, status: 'P' }], date: '2026-02-02'
    })
    expect(second.dayColumn).toBe(first.dayColumn)
    expect(sheet.getCell(8, first.dayColumn).value).toBeNull()
    const fill = sheet.getCell(8, first.dayColumn).fill
    expect(fill.type === 'pattern' ? fill.pattern : '').toBe('none')
    expect(sheet.columnCount).toBe(47)
  })

  it('refuses missing-month, holiday, and non-school-day exports', async () => {
    const workbook = await loadFixture()
    expect(() => updateSf2Workbook(workbook, { record, students, attendance: [], date: '2026-01-05' })).toThrow('This file has no SF2 sheet for JANUARY.')
    expect(() => updateSf2Workbook(workbook, { record, students, attendance: [], date: '2026-02-17' })).toThrow(/marked as a holiday/)
    expect(() => updateSf2Workbook(workbook, { record, students, attendance: [], date: '2026-02-01' })).toThrow(/no school-day column/)
  })

  it('updates February and March independently in one workbook', async () => {
    const workbook = await loadFixture()
    const february = workbook.getWorksheet(februarySheetName)!
    const marchName = workbookFile.sheets.find(sheet => sheet.sf2?.month === 'MARCH')!.name
    const march = workbook.getWorksheet(marchName)!
    const marchDayTwoBefore = march.getCell(8, 6).value
    const februaryBeforeMarch = snapshot(february)
    const marchBeforeFebruary = snapshot(march)

    updateSf2Workbook(workbook, {
      record, students, attendance: students.map((student, index) => ({
        student_id: student.student_id, status: index === 0 ? 'A' as const : 'P' as const
      })),
      date: '2026-02-02', sheetName: februarySheetName
    })
    const februaryAfterUpdate = snapshot(february)
    expect(february.getCell(8, 6).value).toBe('x')
    expect([...snapshot(march)]).toEqual([...marchBeforeFebruary])

    updateSf2Workbook(workbook, {
      record, students, attendance: students.map((student, index) => ({
        student_id: student.student_id, status: index === 1 ? 'A' as const : 'P' as const
      })),
      date: '2026-03-02', sheetName: marchName, confirmWarnings: true
    })
    expect(march.getCell(8, 6).value).toBe(marchDayTwoBefore)
    expect(march.getCell(9, 6).value).toBe('x')
    expect(snapshot(february)).toEqual(februaryAfterUpdate)
    expect([...februaryBeforeMarch].some(([cell, value]) => februaryAfterUpdate.get(cell) !== value)).toBe(true)
    const marchAfterUpdate = snapshot(march)
    expect([...marchBeforeFebruary].some(([cell, value]) => marchAfterUpdate.get(cell) !== value)).toBe(true)
  })

  it('leaves other marks untouched and removes only a previous x for a present learner', async () => {
    const workbook = await loadFixture()
    const sheet = workbook.getWorksheet(februarySheetName)!
    sheet.getCell(8, 6).value = 'x'
    sheet.getCell(9, 6).value = 'H'
    updateSf2Workbook(workbook, {
      record, students, attendance: [{ student_id: students[0].student_id, status: 'P' }],
      date: '2026-02-02', confirmWarnings: true
    })
    expect(sheet.getCell(8, 6).value).toBeNull()
    expect(sheet.getCell(9, 6).value).toBe('H')
  })

  it('previews blocking match/year errors and confirmable roster/mark warnings', async () => {
    const workbook = await loadFixture()
    const noAttendance = previewSf2Workbook(workbook, {
      record, students, attendance: [], filePath: fixtureXlsx, sheetName: februarySheetName, date: '2026-02-02'
    })
    expect(noAttendance.errors).toEqual([])
    expect(noAttendance.willMarkAbsent).toHaveLength(29)
    expect(noAttendance.warnings.some(warning => warning.includes('No attendance records'))).toBe(true)

    const partiallyMatched = students.map((student, index) => index < 3 ? { ...student, name: `UNMATCHED ${index}` } : student)
    const partialWarning = previewSf2Workbook(workbook, {
      record, students: partiallyMatched, attendance: students.map(student => ({ student_id: student.student_id, status: 'P' as const })),
      filePath: fixtureXlsx, sheetName: februarySheetName, date: '2026-02-02'
    })
    expect(partialWarning.errors).toEqual([])
    expect(partialWarning.warnings.some(warning => warning.includes('Only 26 of 29'))).toBe(true)
    expect(partialWarning.unmatchedClass).toHaveLength(3)

    const mostlyUnmatched = students.map((student, index) => index < 15 ? { ...student, name: `UNMATCHED ${index}` } : student)
    const mismatchError = previewSf2Workbook(workbook, {
      record, students: mostlyUnmatched, attendance: [], filePath: fixtureXlsx,
      sheetName: februarySheetName, date: '2026-02-02'
    })
    expect(mismatchError.errors.some(error => error.includes('Only 14 of 29'))).toBe(true)

    const wrongYear = previewSf2Workbook(workbook, {
      record: { ...record, school_year: '2024-2025' }, students, attendance: [],
      filePath: fixtureXlsx, sheetName: februarySheetName, date: '2026-02-02'
    })
    expect(wrongYear.errors.some(error => error.includes('school year'))).toBe(true)

    const sheet = workbook.getWorksheet(februarySheetName)!
    sheet.getCell(8, 6).value = 'H'
    const otherMark = previewSf2Workbook(workbook, {
      record, students, attendance: students.map(student => ({ student_id: student.student_id, status: 'P' as const })),
      filePath: fixtureXlsx, sheetName: februarySheetName, date: '2026-02-02'
    })
    expect(otherMark.warnings.some(warning => warning.includes('marks other than "x"'))).toBe(true)
    expect(otherMark.unchanged).toBe(29)
  })
})
