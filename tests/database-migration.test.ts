import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import initSqlJs from 'sql.js'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { importWorkbook, previewWorkbook } from '../src/main/import-class'
import { readSpreadsheet } from '../src/main/spreadsheet-reader'

const { userDataPath } = vi.hoisted(() => ({ userDataPath: vi.fn() }))
vi.mock('electron', () => ({ app: { getPath: userDataPath } }))

import { PassDatabase } from '../src/main/db'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx') as typeof import('xlsx')

describe('existing database migrations', () => {
  let temporaryDirectory = ''
  const extraDirectories: string[] = []
  afterAll(async () => {
    if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true })
    await Promise.all(extraDirectories.map(directory => fs.rm(directory, { recursive: true, force: true })))
  })

  it('adds SF2 roster columns only when missing and preserves existing learners', async () => {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'pass-db-migration-'))
    userDataPath.mockReturnValue(temporaryDirectory)
    const SQL = await initSqlJs()
    const legacy = new SQL.Database()
    legacy.run(`CREATE TABLE classes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, section TEXT NOT NULL, subject TEXT NOT NULL,
      school_year TEXT NOT NULL, source_xlsx_path TEXT, col_map_json TEXT
    )`)
    legacy.run(`CREATE TABLE students (
      id INTEGER PRIMARY KEY AUTOINCREMENT, class_id TEXT NOT NULL, student_id TEXT NOT NULL, name TEXT NOT NULL,
      UNIQUE(class_id, student_id)
    )`)
    legacy.run('INSERT INTO classes VALUES(?,?,?,?,?,?,?)', ['class', 'Grade 10 ICT', 'ICT', '', '2025-2026', null, null])
    legacy.run('INSERT INTO students(class_id,student_id,name) VALUES(?,?,?)', ['class', '10ICT-01', 'FICTIONAL LEARNER'])
    await fs.writeFile(path.join(temporaryDirectory, 'pass.sqlite'), Buffer.from(legacy.export()))
    legacy.close()

    const database = new PassDatabase()
    await database.initialize()
    const classColumns = database.all<{ name: string }>('PRAGMA table_info(classes)').map(column => column.name)
    const studentColumns = database.all<{ name: string }>('PRAGMA table_info(students)').map(column => column.name)
    expect(classColumns).toContain('grade_level')
    expect(classColumns).toContain('export_xlsx_path')
    expect(studentColumns).toContain('sex')
    expect(studentColumns).toContain('active')
    expect(database.get<{ name: string; sex: string; active: number }>(
      'SELECT students.name,students.sex,students.active FROM students WHERE class_id=?', ['class']
    )).toEqual({ name: 'FICTIONAL LEARNER', sex: '', active: 1 })
  })

  it('imports and confirms SF2 re-import changes identically from both fixture formats', async () => {
    const outputs: Array<Array<{ student_id: string; name: string; sex: string; active: number }>> = []
    for (const extension of ['.xls', '.xlsx']) {
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pass-sf2-import-'))
      extraDirectories.push(directory)
      userDataPath.mockReturnValue(directory)
      const database = new PassDatabase()
      await database.initialize()
      const sourcePath = path.resolve(`tests/fixtures/SF2_sample_anonymized${extension}`)
      const preview = await previewWorkbook(database, sourcePath)
      expect(preview.kind).toBe('sf2')
      if (preview.kind !== 'sf2') throw new Error('Expected the SF2 fixture to be detected.')
      await importWorkbook(database, {
        kind: 'sf2', filePath: sourcePath, sheetName: preview.sheetName,
        className: 'Grade 10 ICT', section: preview.section, subject: '',
        schoolYear: preview.schoolYear, gradeLevel: preview.gradeLevel, confirmReimport: false
      })
      const originalStudents = database.all<{ student_id: string; name: string; sex: string; active: number }>(
        'SELECT student_id,name,sex,active FROM students ORDER BY id'
      )
      expect(originalStudents).toHaveLength(29)
      expect(originalStudents[0].student_id).toBe('10ICT-01')
      expect(originalStudents[28].student_id).toBe('10ICT-29')

      const modified = XLSX.readFile(sourcePath)
      const worksheet = modified.Sheets[preview.sheetName]
      if (!worksheet?.C37) throw new Error("Expected the fixture's last female learner cell.")
      worksheet.C37.v = 'NEW FICTIONAL LEARNER'
      worksheet.C37.w = 'NEW FICTIONAL LEARNER'
      const updatedPath = path.join(directory, `updated${extension}`)
      XLSX.writeFile(modified, updatedPath, { bookType: extension === '.xls' ? 'biff8' : 'xlsx', cellStyles: true })
      const updatedPreview = await previewWorkbook(database, updatedPath)
      expect(updatedPreview.kind).toBe('sf2')
      if (updatedPreview.kind !== 'sf2') throw new Error('Expected the updated workbook to remain SF2.')
      expect(updatedPreview.added.map(learner => learner.studentId)).toEqual(['10ICT-30'])
      expect(updatedPreview.removed).toHaveLength(1)
      await expect(importWorkbook(database, {
        kind: 'sf2', filePath: updatedPath, sheetName: updatedPreview.sheetName,
        className: 'Grade 10 ICT', section: updatedPreview.section, subject: '',
        schoolYear: updatedPreview.schoolYear, gradeLevel: updatedPreview.gradeLevel, confirmReimport: false
      })).rejects.toThrow(/Confirm the re-import/)
      await importWorkbook(database, {
        kind: 'sf2', filePath: updatedPath, sheetName: updatedPreview.sheetName,
        className: 'Grade 10 ICT', section: updatedPreview.section, subject: '',
        schoolYear: updatedPreview.schoolYear, gradeLevel: updatedPreview.gradeLevel, confirmReimport: true
      })
      const current = database.all<{ student_id: string; name: string; sex: string; active: number }>(
        'SELECT student_id,name,sex,active FROM students ORDER BY id'
      )
      expect(current).toHaveLength(30)
      expect(current.find(student => student.student_id === '10ICT-29')?.active).toBe(0)
      expect(current.find(student => student.student_id === '10ICT-30')).toMatchObject({ name: 'NEW FICTIONAL LEARNER', active: 1 })
      outputs.push(current)
    }
    expect(outputs[0]).toEqual(outputs[1])
  })
})
