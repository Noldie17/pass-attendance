export type AttendanceStatus = 'P' | 'L' | 'A'
export type ScanSource = 'webcam' | 'manual'

export interface ClassRecord {
  id: string
  name: string
  section: string
  subject: string
  school_year: string
  grade_level: string
  source_xlsx_path: string | null
  export_xlsx_path: string | null
  col_map_json: string | null
}
export interface StudentRecord { id: number; class_id: string; student_id: string; name: string; sex: 'M' | 'F' | ''; active: number }
export interface AttendanceRecord {
  class_id: string; student_id: string; date: string; status: AttendanceStatus
  time_in: string | null; source: ScanSource; remark: string | null
}
export interface AttendanceViewRow {
  student_id: string; name: string; status: AttendanceStatus; recorded: boolean
  time_in: string | null; source: ScanSource | null; remark: string | null
}
export interface AppSettings {
  late_cutoff: string; cooldown_sec: number; sound: boolean
  default_camera: string; pin_enabled: boolean
}
export type ScanSound = 'success' | 'duplicate' | 'unknown' | null
export interface ExportDayOption { day: number; date: string; column: number; holiday: boolean }
export interface ExportSheetOption {
  name: string
  kind: 'sf2' | 'table'
  month: string | null
  schoolYear: string | null
  gradeLevel: string | null
  section: string | null
  learnerCount: number
  differentSection: boolean
  days: ExportDayOption[]
}
export interface ClassRecordExportPreview {
  filePath: string
  kind: 'sf2' | 'table' | null
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
export interface ImportSheetOption { name: string; sf2: boolean; month: string | null }
interface ImportPreviewBase { filePath: string; sheetName: string; sheets: ImportSheetOption[] }
export interface Sf2ImportPreview extends ImportPreviewBase {
  kind: 'sf2'
  schoolName: string
  schoolYear: string
  gradeLevel: string
  gradeNumber: string
  section: string
  month: string
  learners: Array<{ name: string; sex: 'M' | 'F'; studentId: string; change: 'added' | 'unchanged' }>
  added: Array<{ name: string; sex: 'M' | 'F'; studentId: string; change: 'added' }>
  removed: StudentRecord[]
  unchanged: Array<{ name: string; sex: 'M' | 'F'; studentId: string; change: 'unchanged' }>
  existingClassId: string | null
}
export interface TableImportPreview extends ImportPreviewBase {
  kind: 'table'
  headerRow: number
  headerRowCount: number
  headers: string[]
  rows: unknown[][]
  rowCount: number
}
export type ImportPreview = Sf2ImportPreview | TableImportPreview
export type ImportInput =
  | { kind: 'sf2'; filePath: string; sheetName: string; className: string; section: string; subject: string; schoolYear: string; gradeLevel: string; confirmReimport: boolean }
  | { kind: 'table'; filePath: string; sheetName: string; headerRow: number; className: string; section: string; subject: string; schoolYear: string; idColumn: number; nameColumn: number }
export interface ScanLogEntry {
  timestamp_iso: string; date: string; time: string; student_id: string; name: string
  class: string; source: string; result: string
}
export type ScanResultCode = 'recorded' | 'already-recorded' | 'not-found' | 'cooldown-ignored'
export interface ScanResult {
  code: ScanResultCode; studentId: string; name: string | null
  status: AttendanceStatus | null; time: string | null; message: string
}
export interface PassApi {
  classes: {
    list(): Promise<ClassRecord[]>
    create(input: Omit<ClassRecord, 'id' | 'source_xlsx_path' | 'col_map_json' | 'grade_level' | 'export_xlsx_path'> & { id?: string; grade_level?: string }): Promise<ClassRecord>
    update(classId: string, patch: Pick<ClassRecord, 'name' | 'section' | 'subject' | 'school_year'>): Promise<ClassRecord>
    chooseImportFile(): Promise<string | null>
    chooseXlsxCopy(): Promise<string | null>
    importPreview(filePath: string, sheetName?: string, headerRow?: number): Promise<ImportPreview>
    importClass(input: ImportInput): Promise<ClassRecord>
    linkXlsxCopy(classId: string, filePath: string): Promise<ClassRecord>
    exportRoster(classId: string): Promise<string | null>
    importRoster(): Promise<ClassRecord | null>
    delete(classId: string): Promise<void>
  }
  students: { list(classId: string): Promise<StudentRecord[]> }
  attendance: {
    scan(input: { classId: string; payload: string; source: ScanSource }): Promise<ScanResult>
    list(classId: string, date: string): Promise<AttendanceViewRow[]>
    setManual(input: { classId: string; studentId: string; date: string; status: AttendanceStatus; remark: string; pin?: string }): Promise<void>
  }
  scanLog: {
    list(input: { classId: string; dateFrom: string; dateTo: string }): Promise<ScanLogEntry[]>
    exportXlsx(input: { classId: string; dateFrom: string; dateTo: string }): Promise<string | null>
  }
  exports: {
    previewClassRecord(input: { classId: string; filePath?: string; date?: string; sheetName?: string; day?: number }): Promise<ClassRecordExportPreview>
    updateClassRecord(input: { classId: string; filePath?: string; date: string; sheetName?: string; day?: number; confirmWarnings?: boolean }): Promise<{ savedPath: string; backupPath: string; matched: number; header: string }>
    outputQrSheet(input: { classId: string; studentIds: string[]; mode: 'print' | 'pdf' }): Promise<string | null>
  }
  settings: {
    get(): Promise<AppSettings>
    save(settings: Partial<AppSettings>): Promise<AppSettings>
    setPin(pin: string | null): Promise<void>
    verifyPin(pin: string): Promise<boolean>
  }
}
declare global { interface Window { pass: PassApi } }
