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
