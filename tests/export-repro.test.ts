import fs from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'

const { userDataPath } = vi.hoisted(() => ({ userDataPath: vi.fn() }))
vi.mock('electron', () => ({
  app: { getPath: userDataPath },
  BrowserWindow: class {},
  dialog: {}
}))

import { PassDatabase } from '../src/main/db'
import { importWorkbook, previewWorkbook } from '../src/main/import-class'
import { updateClassWorkbook, writeVerifiedWorkbook } from '../src/main/export-services'
import { listSf2Sheets } from '../src/main/sf2-export'
import { readSpreadsheet } from '../src/main/spreadsheet-reader'

function cellValues(sheet: ExcelJS.Worksheet): Map<string, string> {
  const values = new Map<string, string>()
  sheet.eachRow((row, rowNumber) => row.eachCell({ includeEmpty: true }, (cell, column) => {
    if (!cell.isMerged || cell.master.address === cell.address) {
      values.set(`${rowNumber}:${column}`, JSON.stringify(cell.value ?? null))
    }
  }))
  return values
}

describe('real class-record export reproduction', () => {
  const directories: string[] = []

  afterAll(async () => {
    await Promise.all(directories.map(directory => fs.rm(directory, { recursive: true, force: true })))
  })

  it('runs the production export function with seeded learners against the anonymized SF2 fixture', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pass-export-repro-'))
    directories.push(directory)
    userDataPath.mockReturnValue(directory)
    const workbookPath = path.join(directory, 'SF2_sample_anonymized.xlsx')
    await fs.copyFile(path.resolve('tests/fixtures/SF2_sample_anonymized.xlsx'), workbookPath)

    const database = new PassDatabase()
    await database.initialize()
    const preview = await previewWorkbook(database, workbookPath)
    expect(preview.kind).toBe('sf2')
    if (preview.kind !== 'sf2') throw new Error('Expected the anonymized fixture to be recognized as SF2.')
    const record = await importWorkbook(database, {
      kind: 'sf2',
      filePath: workbookPath,
      sheetName: preview.sheetName,
      className: 'Grade 10 ICT',
      section: preview.section,
      subject: '',
      schoolYear: preview.schoolYear,
      gradeLevel: preview.gradeLevel,
      confirmReimport: false
    })

    const result = await updateClassWorkbook(database, { classId: record.id, date: '2026-02-02', confirmWarnings: true })
    expect(result.matched).toBe(29)
    expect(result.header).toBe('FEBRUARY 02')
  })

  it('persists attendance independently to two selected monthly sheets', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pass-multi-sheet-export-'))
    directories.push(directory)
    userDataPath.mockReturnValue(directory)
    const workbookPath = path.join(directory, 'SF2_sample_anonymized.xlsx')
    await fs.copyFile(path.resolve('tests/fixtures/SF2_sample_anonymized.xlsx'), workbookPath)

    const database = new PassDatabase()
    await database.initialize()
    const importPreview = await previewWorkbook(database, workbookPath)
    if (importPreview.kind !== 'sf2') throw new Error('Expected the anonymized fixture to be recognized as SF2.')
    const record = await importWorkbook(database, {
      kind: 'sf2', filePath: workbookPath, sheetName: importPreview.sheetName,
      className: 'Grade 10 ICT', section: importPreview.section, subject: '',
      schoolYear: importPreview.schoolYear, gradeLevel: importPreview.gradeLevel, confirmReimport: false
    })
    const students = database.all<{ student_id: string }>(
      'SELECT student_id FROM students WHERE class_id=? AND active=1 ORDER BY id', [record.id]
    )
    const workbookBefore = new ExcelJS.Workbook()
    await workbookBefore.xlsx.readFile(workbookPath)
    const sheetOptions = listSf2Sheets(workbookBefore, record)
    const februaryOption = sheetOptions.find(sheet => sheet.month === 'FEBRUARY')!
    const marchOption = sheetOptions.find(sheet => sheet.month === 'MARCH')!
    const februaryBefore = cellValues(workbookBefore.getWorksheet(februaryOption.name)!)
    const marchBefore = cellValues(workbookBefore.getWorksheet(marchOption.name)!)

    const saveAttendance = async (date: string, absentId: string) => {
      await database.write(sqlDatabase => {
        for (const student of students) {
          sqlDatabase.run(
            'INSERT INTO attendance(class_id,student_id,date,status,time_in,source,remark) VALUES(?,?,?,?,?,?,?)',
            [record.id, student.student_id, date, student.student_id === absentId ? 'A' : 'P', '08:00:00', 'manual', '']
          )
        }
      })
    }
    await saveAttendance('2026-02-02', students[0].student_id)
    await updateClassWorkbook(database, {
      classId: record.id, date: '2026-02-02', sheetName: februaryOption.name, day: 2, confirmWarnings: true
    })
    const afterFebruary = new ExcelJS.Workbook()
    await afterFebruary.xlsx.readFile(workbookPath)
    expect(cellValues(afterFebruary.getWorksheet(marchOption.name)!)).toEqual(marchBefore)
    const februaryAfterUpdate = cellValues(afterFebruary.getWorksheet(februaryOption.name)!)

    await saveAttendance('2026-03-02', students[1].student_id)
    await updateClassWorkbook(database, {
      classId: record.id, date: '2026-03-02', sheetName: marchOption.name, day: 2, confirmWarnings: true
    })
    const afterMarch = new ExcelJS.Workbook()
    await afterMarch.xlsx.readFile(workbookPath)
    const februaryFinalSheet = afterMarch.getWorksheet(februaryOption.name)!
    const marchFinalSheet = afterMarch.getWorksheet(marchOption.name)!
    expect(cellValues(februaryFinalSheet)).toEqual(februaryAfterUpdate)
    expect(cellValues(marchFinalSheet)).not.toEqual(marchBefore)
    expect(februaryFinalSheet.getCell(8, februaryOption.days.find(day => day.day === 2)!.column).value).toBe('x')
    expect(februaryFinalSheet.getCell(9, februaryOption.days.find(day => day.day === 2)!.column).value).toBeNull()
    expect(marchFinalSheet.getCell(8, marchOption.days.find(day => day.day === 2)!.column).value).toBeNull()
    expect(marchFinalSheet.getCell(9, marchOption.days.find(day => day.day === 2)!.column).value).toBe('x')
    expect(cellValues(workbookBefore.getWorksheet(februaryOption.name)!)).toEqual(februaryBefore)
  }, 15000)

  it('marks the six unrecorded learners absent when 23 of 29 are recorded', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pass-attendance-count-export-'))
    directories.push(directory)
    userDataPath.mockReturnValue(directory)
    const workbookPath = path.join(directory, 'SF2_sample_anonymized.xlsx')
    await fs.copyFile(path.resolve('tests/fixtures/SF2_sample_anonymized.xlsx'), workbookPath)

    const database = new PassDatabase()
    await database.initialize()
    const importPreview = await previewWorkbook(database, workbookPath)
    if (importPreview.kind !== 'sf2') throw new Error('Expected the anonymized fixture to be recognized as SF2.')
    const record = await importWorkbook(database, {
      kind: 'sf2', filePath: workbookPath, sheetName: importPreview.sheetName,
      className: 'Grade 10 ICT', section: importPreview.section, subject: '',
      schoolYear: importPreview.schoolYear, gradeLevel: importPreview.gradeLevel, confirmReimport: false
    })
    const students = database.all<{ student_id: string }>(
      'SELECT student_id FROM students WHERE class_id=? AND active=1 ORDER BY id', [record.id]
    )
    expect(students).toHaveLength(29)

    const sheetOptions = await new ExcelJS.Workbook()
    await sheetOptions.xlsx.readFile(workbookPath)
    const february = listSf2Sheets(sheetOptions, record).find(sheet => sheet.month === 'FEBRUARY')!
    const dayColumn = february.days.find(day => day.day === 2)!.column
    const februaryData = readSpreadsheet(workbookPath).sheets.find(sheet => sheet.name === february.name)!.sf2!
    const februarySheet = sheetOptions.getWorksheet(february.name)!
    students.forEach((_student, index) => {
      const row = index < 15 ? index + 8 : index + 9
      februarySheet.getCell(row, dayColumn).value = 'P'
    })
    await sheetOptions.xlsx.writeFile(workbookPath)

    await database.write(sqlDatabase => {
      students.slice(0, 23).forEach((student, index) => {
        sqlDatabase.run(
          'INSERT INTO attendance(class_id,student_id,date,status,time_in,source,remark) VALUES(?,?,?,?,?,?,?)',
          [record.id, student.student_id, '2026-02-02', index % 2 ? 'L' : 'P', '08:00:00', 'webcam', '']
        )
      })
    })
    await updateClassWorkbook(database, {
      classId: record.id, date: '2026-02-02', sheetName: february.name, day: 2, confirmWarnings: true
    })

    const savedWorkbook = new ExcelJS.Workbook()
    await savedWorkbook.xlsx.readFile(workbookPath)
    const savedSheet = savedWorkbook.getWorksheet(february.name)!
    students.forEach((_student, index) => {
      const row = index < 15 ? index + 8 : index + 9
      expect(savedSheet.getCell(row, dayColumn).value).toBe(index < 23 ? null : 'x')
    })
    expect(savedSheet.getCell(februaryData.maleTotalRow, dayColumn).value).toBe(15)
    expect(savedSheet.getCell(februaryData.femaleTotalRow, dayColumn).value).toBe(8)
    expect(savedSheet.getCell(februaryData.combinedTotalRow, dayColumn).value).toBe(23)
  })

  it('leaves the original file untouched when write verification fails', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pass-export-verify-'))
    directories.push(directory)
    const workbookPath = path.join(directory, 'original.xlsx')
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('Sheet1').getCell('A1').value = 'original'
    await workbook.xlsx.writeFile(workbookPath)
    const original = await fs.readFile(workbookPath)
    workbook.getWorksheet('Sheet1')!.getCell('A1').value = 'changed'

    await expect(writeVerifiedWorkbook(workbook, workbookPath, 'Sheet1', [{ address: 'A1', value: 'expected-but-wrong' }]))
      .rejects.toThrow(/could not be verified/)
    expect(await fs.readFile(workbookPath)).toEqual(original)
    expect((await fs.readdir(directory)).sort()).toEqual(['original.xlsx'])
  })

  const localDirectory = path.resolve('tests/fixtures/local')
  const localFiles = existsSync(localDirectory)
    ? readdirSync(localDirectory).filter(file => /\.(xlsx|xls)$/i.test(file))
    : []
  it.skipIf(localFiles.length === 0)('runs the production export for each local workbook fixture', async () => {
    for (const file of localFiles) {
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pass-local-export-'))
      directories.push(directory)
      const workbookPath = path.join(directory, file)
      await fs.copyFile(path.join(localDirectory, file), workbookPath)
      const database = new PassDatabase()
      await database.initialize()
      const preview = await previewWorkbook(database, workbookPath)
      if (preview.kind !== 'sf2') throw new Error(`Local workbook ${file} is not recognized as SF2.`)
      const record = await importWorkbook(database, {
        kind: 'sf2', filePath: workbookPath, sheetName: preview.sheetName,
        className: 'Local test class', section: preview.section, subject: '',
        schoolYear: preview.schoolYear, gradeLevel: preview.gradeLevel, confirmReimport: false
      })
      if (path.extname(file).toLowerCase() === '.xls') {
        await expect(updateClassWorkbook(database, { classId: record.id, date: '2026-02-02' })).rejects.toThrow(/\.xlsx/)
      } else {
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.readFile(workbookPath)
        const options = listSf2Sheets(workbook, record).find(sheet => sheet.month === preview.month &&
          sheet.schoolYear === preview.schoolYear)
        const day = options?.days.find(item => !item.holiday)
        if (!options || !day) throw new Error(`Local workbook ${file} has no usable school day.`)
        await updateClassWorkbook(database, {
          classId: record.id, date: day.date, sheetName: options.name, day: day.day, confirmWarnings: true
        })
      }
    }
  })
})
