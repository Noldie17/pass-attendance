import type { StudentRecord } from './types'

export interface Sf2Learner {
  name: string
  sex: 'M' | 'F'
}

export interface Sf2SheetData {
  schoolName: string
  schoolYear: string
  gradeLevel: string
  gradeNumber: string
  section: string
  month: string
  nameColumn: number
  learnerHeaderRow: number
  maleTotalRow: number
  femaleTotalRow: number
  combinedTotalRow: number
  learners: Sf2Learner[]
}

export interface PlannedLearner extends Sf2Learner {
  studentId: string
  change: 'added' | 'unchanged'
}

export interface Sf2ImportPlan {
  learners: PlannedLearner[]
  added: Array<PlannedLearner & { change: 'added' }>
  removed: StudentRecord[]
  unchanged: Array<PlannedLearner & { change: 'unchanged' }>
}

export function normalizeStudentName(value: string): string {
  return value.normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeSection(value: string): string {
  return value.toLocaleUpperCase().replace(/[^\p{Letter}\p{Number}]/gu, '')
}

export function gradeNumber(value: string): string {
  const match = value.match(/\d+/)
  if (!match) throw new Error('The SF2 Grade Level does not contain a grade number.')
  return match[0]
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function findLabel(rows: unknown[][], matcher: RegExp): { row: number; column: number } | undefined {
  for (let row = 0; row < rows.length; row++) {
    for (let column = 0; column < (rows[row]?.length ?? 0); column++) {
      if (matcher.test(text(rows[row][column]))) return { row, column }
    }
  }
  return undefined
}

function valueToRight(rows: unknown[][], position: { row: number; column: number }): string {
  const row = rows[position.row] ?? []
  const label = text(row[position.column]).toLocaleUpperCase()
  for (let column = position.column + 1; column < row.length; column++) {
    const value = text(row[column])
    if (value && value.toLocaleUpperCase() !== label) return value
  }
  return ''
}

function markerRow(rows: unknown[][], marker: RegExp): number {
  const row = rows.findIndex(values => values.some(value => marker.test(text(value))))
  if (row < 0) throw new Error(`The SF2 is missing the ${marker.source.includes('MALE') ? 'male' : marker.source.includes('FEMALE') ? 'female' : 'combined'} total row.`)
  return row
}

export function parseSf2Sheet(rows: unknown[][]): Sf2SheetData | null {
  const reportMonth = findLabel(rows, /REPORT\s+FOR\s+THE\s+MONTH\s+OF/i)
  const grade = findLabel(rows, /GRADE\s+LEVEL/i)
  const section = findLabel(rows, /^SECTION$/i)
  const schoolYear = findLabel(rows, /^SCHOOL\s+YEAR$/i)
  const learnerHeader = findLabel(rows, /NAME\s*\(\s*LAST\s+NAME/i)
  const maleTotalRow = rows.findIndex(values => values.some(value => /<===\s*MALE\s*\|\s*TOTAL\s+PER\s+DAY\s*===>/i.test(text(value))))
  if (!reportMonth || !grade || !section || !schoolYear || !learnerHeader || maleTotalRow < 0) return null

  const femaleTotalRow = markerRow(rows, /<===\s*FEMALE\s*\|\s*TOTAL\s+PER\s+DAY\s*===>/i)
  const combinedTotalRow = markerRow(rows, /COMBINED\s+TOTAL\s+PER\s+DAY/i)
  const nameColumn = learnerHeader.column
  const maleLearners: Sf2Learner[] = []
  const femaleLearners: Sf2Learner[] = []
  const collect = (from: number, to: number, sex: 'M' | 'F', destination: Sf2Learner[]) => {
    for (let row = from; row < to; row++) {
      const name = text(rows[row]?.[nameColumn])
      if (!name || /^<===/i.test(name) || /^COMBINED\s+TOTAL/i.test(name)) continue
      destination.push({ name, sex })
    }
  }
  collect(learnerHeader.row + 1, maleTotalRow, 'M', maleLearners)
  collect(maleTotalRow + 1, femaleTotalRow, 'F', femaleLearners)
  const learners = [...maleLearners, ...femaleLearners]
  if (!learners.length) throw new Error('The selected SF2 sheet does not contain any learners.')

  const gradeLevel = valueToRight(rows, grade)
  const sectionValue = valueToRight(rows, section)
  const schoolYearValue = valueToRight(rows, schoolYear)
  const month = valueToRight(rows, reportMonth).toLocaleUpperCase()
  if (!gradeLevel || !sectionValue || !schoolYearValue || !/^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)$/.test(month)) {
    throw new Error('The SF2 is missing a valid grade, section, school year, or report month.')
  }
  const schoolLabel = findLabel(rows, /^NAME\s+OF\s+SCHOOL$/i)

  return {
    schoolName: schoolLabel ? valueToRight(rows, schoolLabel) : '',
    schoolYear: schoolYearValue.replace(/\s*-\s*/, '-'),
    gradeLevel,
    gradeNumber: gradeNumber(gradeLevel),
    section: sectionValue,
    month,
    nameColumn,
    learnerHeaderRow: learnerHeader.row + 1,
    maleTotalRow: maleTotalRow + 1,
    femaleTotalRow: femaleTotalRow + 1,
    combinedTotalRow: combinedTotalRow + 1,
    learners
  }
}

function idPrefix(grade: string, section: string): string {
  return `${grade}${normalizeSection(section)}`
}

function idIndex(studentId: string, prefix: string): number {
  const match = studentId.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`, 'i'))
  return match ? Number(match[1]) : 0
}

export function planSf2Import(
  learners: Sf2Learner[],
  grade: string,
  section: string,
  existing: StudentRecord[]
): Sf2ImportPlan {
  const prefix = idPrefix(grade, section)
  let nextIndex = Math.max(0, ...existing.map(student => idIndex(student.student_id, prefix))) + 1
  const matchedIds = new Set<number>()
  const names = new Map<string, StudentRecord[]>()
  for (const student of existing) {
    const key = normalizeStudentName(student.name)
    if (!key) continue
    names.set(key, [...(names.get(key) ?? []), student])
  }
  const added: Array<PlannedLearner & { change: 'added' }> = []
  const unchanged: Array<PlannedLearner & { change: 'unchanged' }> = []
  const planned = learners.map(learner => {
    const key = normalizeStudentName(learner.name)
    const match = names.get(key)?.find(student => !matchedIds.has(student.id))
    if (match) {
      matchedIds.add(match.id)
      const item = { ...learner, studentId: match.student_id, change: 'unchanged' as const }
      unchanged.push(item)
      return item
    }
    const item = {
      ...learner,
      studentId: `${prefix}-${String(nextIndex++).padStart(2, '0')}`,
      change: 'added' as const
    }
    added.push(item)
    return item
  })
  return {
    learners: planned,
    added,
    removed: existing.filter(student => student.active !== 0 && !matchedIds.has(student.id)),
    unchanged
  }
}

export interface PassRoster {
  format: 'PASS-roster'
  version: 1
  class: { gradeLevel: string; section: string; schoolYear: string }
  learners: Array<{ id: string; name: string; sex: 'M' | 'F' | ''; active: boolean }>
}

export function createPassRoster(
  classInfo: PassRoster['class'],
  learners: PassRoster['learners']
): PassRoster {
  return validatePassRoster({ format: 'PASS-roster', version: 1, class: classInfo, learners })
}

export function validatePassRoster(value: unknown): PassRoster {
  if (!value || typeof value !== 'object') throw new Error('This is not a PASS roster file.')
  const roster = value as Partial<PassRoster>
  if (roster.format !== 'PASS-roster' || roster.version !== 1 || !roster.class || !Array.isArray(roster.learners)) {
    throw new Error('This PASS roster file has an unsupported format or version.')
  }
  const { gradeLevel, section, schoolYear } = roster.class
  if (typeof gradeLevel !== 'string' || ![section, schoolYear].every(value => typeof value === 'string' && value.trim())) {
    throw new Error('The PASS roster is missing class details.')
  }
  const seen = new Set<string>()
  const learners = roster.learners.map(learner => {
    if (!learner || typeof learner.id !== 'string' || !learner.id.trim() || typeof learner.name !== 'string' || !learner.name.trim() ||
      !['M', 'F', ''].includes(learner.sex) || typeof learner.active !== 'boolean') {
      throw new Error('The PASS roster contains an invalid learner record.')
    }
    if (seen.has(learner.id)) throw new Error(`The PASS roster contains duplicate ID "${learner.id}".`)
    seen.add(learner.id)
    return { ...learner, id: learner.id.trim(), name: learner.name.trim() }
  })
  return { format: 'PASS-roster', version: 1, class: { gradeLevel, section, schoolYear }, learners }
}
