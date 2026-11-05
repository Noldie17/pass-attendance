import ExcelJS from 'exceljs'
import type { AttendanceStatus, ClassRecord, ExportDayOption, ExportSheetOption, StudentRecord } from '@shared/types'
import { normalizeSection, normalizeStudentName, parseSf2Sheet, type Sf2SheetData } from '@shared/sf2'
import path from 'node:path'

interface Mark { student_id: string; status: AttendanceStatus }

export function getSf2WorkbookPath(record: ClassRecord): string {
  if (!record.source_xlsx_path) throw new Error('This class has no source SF2 workbook.')
  const filePath = record.export_xlsx_path ?? record.source_xlsx_path
  if (path.extname(filePath).toLocaleLowerCase() !== '.xlsx') {
    throw new Error('Legacy .xls files cannot be edited. Open the file in Excel, choose Save As → Excel Workbook (.xlsx), then click "Link .xlsx copy".')
  }
  return filePath
}

export function verifySf2WorkbookCopy(options: {
  record: ClassRecord
  filePath: string
  sheets: Array<Sf2SheetData | null>
  activeNames: string[]
}): void {
  if (path.extname(options.filePath).toLocaleLowerCase() !== '.xlsx') {
    throw new Error('Link an Excel Workbook (.xlsx) copy. Legacy .xls files cannot be used for export.')
  }
  const mapping = JSON.parse(options.record.col_map_json ?? '{}') as { month?: string }
  const selected = options.sheets.find(sheet => sheet &&
    (!mapping.month || sheet.month === mapping.month) &&
    normalYear(sheet.schoolYear) === normalYear(options.record.school_year))
  if (!selected) throw new Error('The .xlsx copy does not contain an SF2 sheet for this class month and school year.')
  const workbookNames = selected.learners.map(learner => normalizeStudentName(learner.name)).sort()
  const rosterNames = options.activeNames.map(normalizeStudentName).sort()
  if (workbookNames.length !== rosterNames.length || workbookNames.some((name, index) => name !== rosterNames[index])) {
    throw new Error('The .xlsx copy does not have the same active learners as this PASS roster.')
  }
}

function valueOf(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('result' in value) return value.result ?? ''
    if ('text' in value) return value.text ?? ''
    if ('richText' in value) return value.richText.map(part => part.text).join('')
  }
  return value
}

function workbookRows(sheet: ExcelJS.Worksheet): unknown[][] {
  return Array.from({ length: sheet.rowCount }, (_, index) => {
    const row = sheet.getRow(index + 1)
    return Array.from({ length: sheet.columnCount }, (_unused, column) => valueOf(row.getCell(column + 1).value))
  })
}

function normalYear(value: string): string {
  return value.replace(/[–—]/g, '-').replace(/\s+/g, '')
}

function isDateInSchoolYear(date: Date, schoolYear: string): boolean {
  const years = schoolYear.match(/\d{4}/g)
  if (!years?.length) return false
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const expectedYear = month >= 6 ? Number(years[0]) : Number(years[1] ?? years[0])
  return year === expectedYear && (years.length === 1 || Number(years[0]) <= Number(years[1]))
}

function isHolidayColumn(sheet: ExcelJS.Worksheet, column: number, data: Sf2SheetData): boolean {
  let marker = ''
  for (let row = data.learnerHeaderRow + 1; row < data.combinedTotalRow; row++) {
    const value = valueOf(sheet.getCell(row, column).value)
    if (typeof value === 'string') marker += value.replace(/\s+/g, '')
  }
  return marker.toLocaleUpperCase().includes('HOLIDAY')
}

function dayColumns(sheet: ExcelJS.Worksheet, data: Sf2SheetData): Array<{ day: number; column: number }> {
  let headerRow = data.learnerHeaderRow - 1
  let bestCount = 0
  for (let row = 1; row <= data.learnerHeaderRow + 2; row++) {
    let count = 0
    for (let column = 6; column <= 37; column++) {
      const cell = sheet.getCell(row, column)
      if (cell.isMerged && cell.master.address !== cell.address) continue
      const value = Number(valueOf(cell.value))
      if (Number.isInteger(value) && value >= 1 && value <= 31) count++
    }
    if (count > bestCount) { bestCount = count; headerRow = row }
  }
  const days: Array<{ day: number; column: number }> = []
  for (let column = 6; column <= 37; column++) {
    const cell = sheet.getCell(headerRow, column)
    if (cell.isMerged && cell.master.address !== cell.address) continue
    const value = valueOf(cell.value)
    const day = typeof value === 'number' ? value : Number(String(value).trim())
    if (Number.isInteger(day) && day >= 1 && day <= 31) days.push({ day, column })
  }
  return days
}

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

function schoolYearYears(value: string): number[] {
  return (value.match(/\d{4}/g) ?? []).map(Number)
}

function dateForSheetDay(data: Sf2SheetData, day: number): string | null {
  const years = schoolYearYears(data.schoolYear)
  const month = MONTHS.indexOf(data.month)
  if (!years.length || month < 0) return null
  const year = month >= 5 ? years[0] : years[1] ?? years[0]
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dateParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, yearText, monthText, dayText] = match
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null
  return { year: Number(yearText), month: Number(monthText), day: Number(dayText) }
}

function yearMatches(date: string, schoolYear: string): boolean {
  const parts = dateParts(date)
  const years = schoolYearYears(schoolYear)
  if (!parts || !years.length) return false
  return parts.year === (parts.month >= 6 ? years[0] : years[1] ?? years[0])
}

function sheetDayOptions(sheet: ExcelJS.Worksheet, data: Sf2SheetData): ExportDayOption[] {
  return dayColumns(sheet, data).map(item => ({
    ...item,
    date: dateForSheetDay(data, item.day) ?? '',
    holiday: isHolidayColumn(sheet, item.column, data)
  }))
}

export function listSf2Sheets(workbook: ExcelJS.Workbook, record: ClassRecord): ExportSheetOption[] {
  return workbook.worksheets.flatMap(sheet => {
    const data = parseSf2Sheet(workbookRows(sheet))
    if (!data) return []
    return [{
      name: sheet.name,
      kind: 'sf2' as const,
      month: data.month,
      schoolYear: data.schoolYear,
      gradeLevel: data.gradeLevel,
      section: data.section,
      learnerCount: data.learners.length,
      differentSection: normalizeSection(data.section) !== normalizeSection(record.section),
      days: sheetDayOptions(sheet, data)
    }]
  })
}

function findLabelRow(sheet: ExcelJS.Worksheet, matcher: RegExp): number | undefined {
  for (let row = 1; row <= sheet.rowCount; row++) {
    for (let column = 39; column <= sheet.columnCount; column++) {
      if (matcher.test(String(valueOf(sheet.getCell(row, column).value)).trim())) return row
    }
  }
  return undefined
}

function writeSummary(
  sheet: ExcelJS.Worksheet,
  data: Sf2SheetData,
  classes: StudentRecord[],
  rowByName: Map<string, number>,
  schoolDays: Array<{ day: number; column: number }>
): void {
  const sexes: Array<'M' | 'F'> = ['M', 'F']
  const bySex = new Map(sexes.map(sex => [sex, classes.filter(student => student.sex === sex)]))
  const summaryRows = {
    registered: findLabelRow(sheet, /REGISTERED\s+LEARNERS\s+AS\s+OF/i),
    enrollmentPercentage: findLabelRow(sheet, /PERCENTAGE\s+OF\s+ENROLMENT\s+AS\s+OF/i),
    average: findLabelRow(sheet, /^AVERAGE\s+DAILY\s+ATTENDANCE$/i),
    attendancePercentage: findLabelRow(sheet, /^PERCENTAGE\s+OF\s+ATTENDANCE\s+FOR\s+THE\s+MONTH$/i)
  }
  let allPresentDays = 0
  for (const sex of sexes) {
    const learners = bySex.get(sex)!
    let absences = 0
    for (const student of learners) {
      const row = rowByName.get(normalizeStudentName(student.name))
      if (!row) throw new Error(`Could not match "${student.name}" to a learner row in this SF2 sheet.`)
      let studentAbsences = 0
      for (const dateColumn of schoolDays) {
        if (String(valueOf(sheet.getCell(row, dateColumn.column).value)).trim().toLocaleLowerCase() === 'x') studentAbsences++
      }
      absences += studentAbsences
      sheet.getCell(row, 39).value = studentAbsences
      sheet.getCell(row, 41).value = schoolDays.length - studentAbsences
    }
    const presentDays = learners.length * schoolDays.length - absences
    allPresentDays += presentDays
    const sexColumn = sex === 'M' ? 44 : 45
    const average = schoolDays.length ? presentDays / schoolDays.length : 0
    if (summaryRows.registered) sheet.getCell(summaryRows.registered, sexColumn).value = learners.length
    if (summaryRows.enrollmentPercentage) {
      const enrollment = Number(valueOf(sheet.getCell(42, sexColumn).value)) || 0
      sheet.getCell(summaryRows.enrollmentPercentage, sexColumn).value = enrollment ? learners.length / enrollment : 0
    }
    if (summaryRows.average) sheet.getCell(summaryRows.average, sexColumn).value = average
    if (summaryRows.attendancePercentage) sheet.getCell(summaryRows.attendancePercentage, sexColumn).value = learners.length ? average / learners.length : 0
  }
  const maleTotalRow = data.maleTotalRow
  const femaleTotalRow = data.femaleTotalRow
  const combinedTotalRow = data.combinedTotalRow
  for (const [row, sex] of [[maleTotalRow, 'M'], [femaleTotalRow, 'F'], [combinedTotalRow, 'ALL']] as const) {
    const learners = sex === 'ALL' ? classes : bySex.get(sex)!
    const absences = learners.reduce((sum, student) => {
      const rowNumber = rowByName.get(normalizeStudentName(student.name))
      if (!rowNumber) return sum
      return sum + schoolDays.filter(day => String(valueOf(sheet.getCell(rowNumber, day.column).value)).trim().toLocaleLowerCase() === 'x').length
    }, 0)
    const present = learners.length * schoolDays.length - absences
    sheet.getCell(row, 39).value = absences
    sheet.getCell(row, 41).value = present
  }
  if (summaryRows.registered) {
    const total = classes.length
    sheet.getCell(summaryRows.registered, 46).value = total
  }
  if (summaryRows.enrollmentPercentage) {
    const enrollment = Number(valueOf(sheet.getCell(42, 46).value)) || 0
    sheet.getCell(summaryRows.enrollmentPercentage, 46).value = enrollment ? classes.length / enrollment : 0
  }
  if (summaryRows.average) sheet.getCell(summaryRows.average, 46).value = schoolDays.length ? allPresentDays / schoolDays.length : 0
  if (summaryRows.attendancePercentage) sheet.getCell(summaryRows.attendancePercentage, 46).value = classes.length ? (allPresentDays / schoolDays.length) / classes.length : 0
}

interface SourceLearner { name: string; row: number; sex: 'M' | 'F' }
interface Sf2Plan {
  result: {
    filePath: string
    kind: 'sf2'
    sheets: ExportSheetOption[]
    sheet: string | null
    month: string | null
    day: number | null
    date: string | null
    dayColumn: number | null
    willMarkAbsent: string[]
    willClear: string[]
    unchanged: number
    unmatchedClass: string[]
    unmatchedSheet: string[]
    scansCount: number
    errors: string[]
    warnings: string[]
  }
  sheet?: ExcelJS.Worksheet
  data?: Sf2SheetData
  column?: number
  matchedStudents: StudentRecord[]
  rowByName: Map<string, number>
  sourceLearners: SourceLearner[]
  statusById: Map<string, AttendanceStatus>
}

function sourceLearnersIn(sheet: ExcelJS.Worksheet, data: Sf2SheetData): SourceLearner[] {
  const learners: SourceLearner[] = []
  for (let row = data.learnerHeaderRow + 1; row < data.maleTotalRow; row++) {
    const name = String(valueOf(sheet.getCell(row, data.nameColumn + 1).value)).trim()
    if (name && !/^NAME\s*\(/i.test(name) && !/^<===/i.test(name)) learners.push({ name, row, sex: 'M' })
  }
  for (let row = data.maleTotalRow + 1; row < data.femaleTotalRow; row++) {
    const name = String(valueOf(sheet.getCell(row, data.nameColumn + 1).value)).trim()
    if (name && !/^NAME\s*\(/i.test(name) && !/^<===/i.test(name)) learners.push({ name, row, sex: 'F' })
  }
  return learners
}

export function previewSf2Workbook(workbook: ExcelJS.Workbook, options: {
  record: ClassRecord
  students: StudentRecord[]
  attendance: Mark[]
  filePath: string
  date?: string
  sheetName?: string
  day?: number
}): Sf2Plan['result'] {
  const errors: string[] = []
  const warnings: string[] = []
  const sheets = listSf2Sheets(workbook, options.record)
  const candidates = workbook.worksheets.flatMap(sheet => {
    const data = parseSf2Sheet(workbookRows(sheet))
    return data ? [{ sheet, data }] : []
  })
  const requestedDate = options.date ?? ''
  const requestedParts = dateParts(requestedDate)
  const requestedMonth = requestedParts ? MONTHS[requestedParts.month - 1] : ''
  if (requestedParts && !candidates.some(candidate => candidate.data.month === requestedMonth &&
    normalYear(candidate.data.schoolYear) === normalYear(options.record.school_year))) {
    errors.push(`This file has no SF2 sheet for ${requestedMonth}.`)
  }
  let selected = options.sheetName
    ? candidates.find(candidate => candidate.sheet.name === options.sheetName)
    : undefined
  if (options.sheetName && !selected) errors.push(`The selected worksheet "${options.sheetName}" is not a recognized SF2 sheet.`)
  if (!selected && !options.sheetName) {
    const month = requestedParts ? MONTHS[requestedParts.month - 1] : ''
    selected = candidates.find(candidate => candidate.data.month === month &&
      normalYear(candidate.data.schoolYear) === normalYear(options.record.school_year) &&
      candidate.data.gradeNumber === (options.record.grade_level.match(/\d+/)?.[0] ?? '') &&
      normalizeSection(candidate.data.section) === normalizeSection(options.record.section))
      ?? candidates.find(candidate => normalYear(candidate.data.schoolYear) === normalYear(options.record.school_year) &&
        normalizeSection(candidate.data.section) === normalizeSection(options.record.section))
      ?? candidates[0]
  }
  const date = selected && options.day !== undefined
    ? dateForSheetDay(selected.data, options.day)
    : requestedDate
  const parts = dateParts(date ?? '')
  const month = selected?.data.month ?? (parts ? MONTHS[parts.month - 1] : null)
  const day = parts?.day ?? options.day ?? null
  let column: number | undefined
  let sourceLearners: SourceLearner[] = []
  let matchedStudents: StudentRecord[] = []
  let rowByName = new Map<string, number>()
  const statusById = new Map(options.attendance.map(mark => [mark.student_id.toLocaleLowerCase(), mark.status]))
  const willMarkAbsent: string[] = []
  const willClear: string[] = []
  let unchanged = 0

  if (!candidates.length) errors.push('This workbook does not contain a recognized SF2 worksheet.')
  if (selected) {
    if (normalYear(selected.data.schoolYear) !== normalYear(options.record.school_year)) {
      errors.push(`The selected SF2 sheet is for school year ${selected.data.schoolYear}, not ${options.record.school_year}.`)
    }
    if (selected.data.gradeNumber !== (options.record.grade_level.match(/\d+/)?.[0] ?? '') ||
      normalizeSection(selected.data.section) !== normalizeSection(options.record.section)) {
      if (!warnings.includes('The selected SF2 sheet is for a different grade or section.')) {
        warnings.push('The selected SF2 sheet is for a different grade or section.')
      }
    }
    if (!parts) errors.push('Choose a valid attendance date from this SF2 sheet.')
    else {
      const expectedMonth = MONTHS[parts.month - 1]
      if (selected.data.month !== expectedMonth) {
        if (options.sheetName) errors.push(`The selected SF2 sheet is for ${selected.data.month}, not ${expectedMonth}. Choose a day from the selected sheet.`)
      }
      if (!yearMatches(date!, selected.data.schoolYear)) {
        errors.push(`The selected date does not match the SF2 school year ${selected.data.schoolYear}.`)
      }
      const selectedDay = selected.data.month === expectedMonth
        ? sheetDayOptions(selected.sheet, selected.data).find(item => item.day === parts.day)
        : undefined
      if (!selectedDay) {
        errors.push(`${date} has no school-day column in the selected SF2 sheet.`)
      } else {
        column = selectedDay.column
        if (selectedDay.holiday) errors.push(`${date} is marked as a holiday in this SF2 form.`)
      }
    }
    sourceLearners = sourceLearnersIn(selected.sheet, selected.data)
    const sourceByName = new Map<string, SourceLearner>()
    for (const learner of sourceLearners) {
      const key = normalizeStudentName(learner.name)
      if (sourceByName.has(key)) errors.push(`The SF2 sheet contains duplicate normalized learner names, including "${learner.name}".`)
      else sourceByName.set(key, learner)
    }
    const activeByName = new Map<string, StudentRecord>()
    for (const student of options.students) {
      const key = normalizeStudentName(student.name)
      if (!activeByName.has(key)) activeByName.set(key, student)
    }
    const unmatchedClass = options.students.filter(student => !sourceByName.has(normalizeStudentName(student.name))).map(student => student.name)
    const unmatchedSheet = sourceLearners.filter(learner => !activeByName.has(normalizeStudentName(learner.name))).map(learner => learner.name)
    matchedStudents = options.students.filter(student => sourceByName.has(normalizeStudentName(student.name)))
    rowByName = new Map(matchedStudents.map(student => [normalizeStudentName(student.name), sourceByName.get(normalizeStudentName(student.name))!.row]))
    if (options.students.some(student => student.sex !== 'M' && student.sex !== 'F')) {
      errors.push('Every active learner needs a recorded sex before exporting to SF2.')
    }
    const matchedRatio = options.students.length ? matchedStudents.length / options.students.length : 0
    if (!options.students.length || matchedRatio < 0.5) {
      errors.push(`Only ${matchedStudents.length} of ${options.students.length} active learners match this SF2 sheet. Choose the correct workbook or worksheet.`)
    } else if (matchedRatio <= 0.9) {
      warnings.push(`Only ${matchedStudents.length} of ${options.students.length} learners match. Not in PASS: ${unmatchedSheet.join('; ') || 'none'}. Not in SF2: ${unmatchedClass.join('; ') || 'none'}.`)
    }
    if (!options.attendance.length) {
      warnings.push(`No attendance records are saved for ${date || 'the selected date'}; this update will mark ${matchedStudents.length} matched learners absent.`)
    }
    if (column !== undefined) {
      for (const student of matchedStudents) {
        const row = rowByName.get(normalizeStudentName(student.name))!
        const value = String(valueOf(selected.sheet.getCell(row, column).value)).trim()
        const isX = value.toLocaleLowerCase() === 'x'
        const absent = (statusById.get(student.student_id.toLocaleLowerCase()) ?? 'A') === 'A'
        if (value && !isX) {
          unchanged++
          continue
        }
        if (absent && !value) willMarkAbsent.push(student.name)
        else if (!absent && isX) willClear.push(student.name)
        else unchanged++
      }
      const otherMarks = matchedStudents.filter(student => {
        const row = rowByName.get(normalizeStudentName(student.name))!
        const value = String(valueOf(selected.sheet!.getCell(row, column!).value)).trim()
        return value && value.toLocaleLowerCase() !== 'x'
      }).map(student => student.name)
      if (otherMarks.length) warnings.push(`The selected day has marks other than "x" for: ${otherMarks.join('; ')}. PASS will leave those cells unchanged.`)
    }
  }

  return {
    filePath: options.filePath,
    kind: 'sf2',
    sheets,
    sheet: selected?.sheet.name ?? null,
    month,
    day,
    date: date ?? null,
    dayColumn: column ?? null,
    willMarkAbsent,
    willClear,
    unchanged,
    unmatchedClass: selected ? options.students.filter(student => !rowByName.has(normalizeStudentName(student.name))).map(student => student.name) : [],
    unmatchedSheet: selected ? sourceLearners.filter(learner => !options.students.some(student => normalizeStudentName(student.name) === normalizeStudentName(learner.name))).map(learner => learner.name) : [],
    scansCount: options.attendance.length,
    errors,
    warnings
  }
}

export function updateSf2Workbook(workbook: ExcelJS.Workbook, options: {
  record: ClassRecord
  students: StudentRecord[]
  attendance: Mark[]
  date: string
  sheetName?: string
  day?: number
  filePath?: string
  confirmWarnings?: boolean
}): { sheetName: string; month: string; matched: number; dayColumn: number; verification: Array<{ address: string; value: unknown }> } {
  const result = previewSf2Workbook(workbook, { ...options, filePath: options.filePath ?? '' })
  if (result.errors.length) throw new Error(result.errors.join('\n'))
  if (result.warnings.length && !options.confirmWarnings) throw new Error(`Confirm these export warnings before updating:\n${result.warnings.join('\n')}`)
  const sheet = workbook.getWorksheet(result.sheet!)
  const data = sheet ? parseSf2Sheet(workbookRows(sheet)) : null
  if (!sheet || !data || result.dayColumn === null) throw new Error('The SF2 export preview is incomplete; preview the update again.')
  const sourceLearners = sourceLearnersIn(sheet, data)
  const sourceByName = new Map(sourceLearners.map(learner => [normalizeStudentName(learner.name), learner]))
  const matchedStudents = options.students.filter(student => sourceByName.has(normalizeStudentName(student.name)))
  const rowByName = new Map(matchedStudents.map(student => [normalizeStudentName(student.name), sourceByName.get(normalizeStudentName(student.name))!.row]))
  const statusById = new Map(options.attendance.map(mark => [mark.student_id.toLocaleLowerCase(), mark.status]))
  for (const student of matchedStudents) {
    const row = rowByName.get(normalizeStudentName(student.name))!
    const cell = sheet.getCell(row, result.dayColumn)
    const value = String(valueOf(cell.value)).trim()
    if (value && value.toLocaleLowerCase() !== 'x') continue
    const status = statusById.get(student.student_id.toLocaleLowerCase()) ?? 'A'
    if (status === 'A') cell.value = 'x'
    else if (value.toLocaleLowerCase() === 'x') cell.value = null
  }
  const schoolDays = dayColumns(sheet, data).filter(item => !isHolidayColumn(sheet, item.column, data))
  const groups = {
    M: matchedStudents.filter(student => student.sex === 'M'),
    F: matchedStudents.filter(student => student.sex === 'F')
  }
  const absentOnDay = (students: StudentRecord[]) => students.filter(student =>
    String(valueOf(sheet.getCell(rowByName.get(normalizeStudentName(student.name))!, result.dayColumn!).value)).trim().toLocaleLowerCase() === 'x'
  ).length
  sheet.getCell(data.maleTotalRow, result.dayColumn).value = groups.M.length - absentOnDay(groups.M)
  sheet.getCell(data.femaleTotalRow, result.dayColumn).value = groups.F.length - absentOnDay(groups.F)
  sheet.getCell(data.combinedTotalRow, result.dayColumn).value = matchedStudents.length - absentOnDay(matchedStudents)
  writeSummary(sheet, data, matchedStudents, rowByName, schoolDays)
  workbook.calcProperties.fullCalcOnLoad = true
  const verification: Array<{ address: string; value: unknown }> = []
  for (let row = 1; row <= sheet.rowCount; row++) {
    for (let col = 1; col <= sheet.columnCount; col++) {
      const cell = sheet.getCell(row, col)
      if (cell.value !== null && cell.value !== undefined) verification.push({ address: cell.address, value: valueOf(cell.value) })
    }
  }
  return {
    sheetName: sheet.name,
    month: data.month,
    matched: matchedStudents.length,
    dayColumn: result.dayColumn,
    verification
  }
}
