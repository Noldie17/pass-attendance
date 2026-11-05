import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { mapImportRows } from '../src/shared/logic'
import { createPassRoster, normalizeStudentName, planSf2Import, validatePassRoster } from '../src/shared/sf2'
import { readSpreadsheet, sheetDataRows } from '../src/main/spreadsheet-reader'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx') as typeof import('xlsx')
const fixtureBase = path.resolve('tests/fixtures')
const fixturePaths = [
  path.join(fixtureBase, 'SF2_sample_anonymized.xls'),
  path.join(fixtureBase, 'SF2_sample_anonymized.xlsx')
]

describe('shared SF2 spreadsheet reader', () => {
  const workbooks = fixturePaths.map(filePath => readSpreadsheet(filePath))
  const results = workbooks.map(workbook => workbook.sheets.map(sheet => sheet.sf2))

  it('parses both fixture formats identically, using the report-month label', () => {
    expect(results[0]).toEqual(results[1])
    expect(results[0].map(sheet => sheet?.month)).toEqual(['FEBRUARY', 'MARCH'])
    expect(results[0].map(sheet => sheet?.learners.length)).toEqual([29, 29])
    expect(results[0][0]?.learners.filter(learner => learner.sex === 'M')).toHaveLength(15)
    expect(results[0][0]?.learners.filter(learner => learner.sex === 'F')).toHaveLength(14)
    expect(results[0][0]).toMatchObject({ gradeNumber: '10', section: 'ICT', schoolYear: '2025-2026' })
    expect(results[0][1]?.month).toBe('MARCH')
    expect(results[0][0]?.learners.some(learner => learner.name.includes('Ñ'))).toBe(true)
  })

  it('defaults the initial ID plan to continuous class-order IDs', () => {
    const plans = results.map(result => {
      const sheet = result[0]!
      return planSf2Import(sheet.learners, sheet.gradeNumber, sheet.section, [])
    })
    expect(plans[0]).toEqual(plans[1])
    expect(plans[0].learners).toHaveLength(29)
    expect(plans[0].learners[0].studentId).toBe('10ICT-01')
    expect(plans[0].learners[28].studentId).toBe('10ICT-29')
  })

  it('preserves matched IDs, never reuses a removed ID, and marks one new learner added', () => {
    const updates = results.map(result => {
      const sheet = result[0]!
      const original = planSf2Import(sheet.learners, sheet.gradeNumber, sheet.section, []).learners
      const existing = original.map((learner, index) => ({
        id: index + 1,
        class_id: 'class',
        student_id: learner.studentId,
        name: learner.name,
        sex: learner.sex,
        active: 1
      }))
      const updatedLearners = [...sheet.learners.slice(0, -1), { name: 'NEW FICTIONAL LEARNER', sex: 'F' as const }]
      return { original, plan: planSf2Import(updatedLearners, sheet.gradeNumber, sheet.section, existing) }
    })
    expect(updates[0].plan).toEqual(updates[1].plan)
    const { original, plan: updated } = updates[0]
    expect(updated.learners.slice(0, -1).map(learner => learner.studentId)).toEqual(original.slice(0, -1).map(learner => learner.studentId))
    expect(updated.added.map(learner => learner.studentId)).toEqual(['10ICT-30'])
    expect(updated.removed.map(learner => learner.student_id)).toEqual([original[28].studentId])
    expect(normalizeStudentName('MUÑOZ,  Ana')).toBe(normalizeStudentName('Munoz Ana'))
  })

  it('round-trips an anonymized class roster, IDs, sex, and active state', () => {
    for (const result of results) {
      const sheet = result[0]!
      const planned = planSf2Import(sheet.learners, sheet.gradeNumber, sheet.section, []).learners
      const roster = createPassRoster(
        { gradeLevel: sheet.gradeLevel, section: sheet.section, schoolYear: sheet.schoolYear },
        planned.map((learner, index) => ({
          id: learner.studentId,
          name: learner.name,
          sex: learner.sex,
          active: index !== 28
        }))
      )
      expect(validatePassRoster(JSON.parse(JSON.stringify(roster)))).toEqual(roster)
      expect(roster.learners[0].id).toBe('10ICT-01')
      expect(roster.learners[28].active).toBe(false)
    }
  })
})

describe('simple-table fallback for both Excel formats', () => {
  let temporaryDirectory = ''
  afterAll(async () => {
    if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true })
  })

  it('reads a simple roster identically from both formats', async () => {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'pass-roster-'))
    const imports = ['.xls', '.xlsx'].map(extension => {
      const filePath = path.join(temporaryDirectory, `roster${extension}`)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['Class list'],
        ['ID', 'Name'],
        ['S-01', 'FICTIONAL, Ana Ñ'],
        [null, null],
        ['S-02', 'FICTIONAL, Ben']
      ]), 'Roster')
      XLSX.writeFile(workbook, filePath, { bookType: extension === '.xls' ? 'biff8' : 'xlsx' })
      const read = readSpreadsheet(filePath)
      const preview = sheetDataRows(read.sheets[0], 2)
      const imported = mapImportRows(read.sheets[0].rows.slice(2), 0, 1, 2)
      return { preview, imported }
    })
    expect(imports[0]).toEqual(imports[1])
    expect(imports[0].preview.rowCount).toBe(2)
    expect(imports[0].imported.errors).toEqual([])
    expect(imports[0].imported.valid).toEqual([
      { studentId: 'S-01', name: 'FICTIONAL, Ana Ñ' },
      { studentId: 'S-02', name: 'FICTIONAL, Ben' }
    ])
    const emptyPath = path.join(temporaryDirectory, 'empty.xlsx')
    const emptyWorkbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(emptyWorkbook, XLSX.utils.aoa_to_sheet([]), 'Empty')
    XLSX.writeFile(emptyWorkbook, emptyPath)
    expect(() => readSpreadsheet(emptyPath)).toThrow(/workbook is empty/i)
    expect(() => readSpreadsheet(path.join(temporaryDirectory, 'not-an-excel.csv'))).toThrow(/\.xls or \.xlsx extension/)
  })
})
