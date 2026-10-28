export type AttendanceStatus = 'P' | 'L' | 'A'
export type ScanSource = 'webcam' | 'manual'

export interface ClassRecord {
  id: string
  name: string
  section: string
  subject: string
  school_year: string
  source_xlsx_path: string | null
  col_map_json: string | null
}
export interface StudentRecord { id: number; class_id: string; student_id: string; name: string }
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
export interface ImportPreview { filePath: string; sheetName: string; headers: string[]; rows: unknown[][] }
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
    create(input: Omit<ClassRecord, 'id' | 'source_xlsx_path' | 'col_map_json'> & { id?: string }): Promise<ClassRecord>
    update(classId: string, patch: Pick<ClassRecord, 'name' | 'section' | 'subject' | 'school_year'>): Promise<ClassRecord>
    chooseImportFile(): Promise<string | null>
    importPreview(filePath: string): Promise<ImportPreview>
    importClass(input: { filePath: string; className: string; section: string; subject: string; schoolYear: string; idColumn: number; nameColumn: number }): Promise<ClassRecord>
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
    updateClassRecord(input: { classId: string; date: string }): Promise<{ savedPath: string; backupPath: string; matched: number; header: string }>
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
