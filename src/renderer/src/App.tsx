import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import jsQR from 'jsqr'
import type { AppSettings, AttendanceStatus, AttendanceViewRow, ClassRecord, ImportPreview, ScanLogEntry, ScanResult, StudentRecord } from '@shared/types'

type Screen = 'scan' | 'attendance' | 'students' | 'scan-log' | 'qr-codes' | 'export' | 'settings'
const screens: Array<{ id: Screen; label: string; glyph: string }> = [
  { id: 'scan', label: 'Scan', glyph: 'scan' }, { id: 'attendance', label: 'Attendance', glyph: 'calendar' },
  { id: 'students', label: 'Students', glyph: 'users' }, { id: 'scan-log', label: 'Scan Log', glyph: 'list' },
  { id: 'qr-codes', label: 'QR Codes', glyph: 'qr' }, { id: 'export', label: 'Export', glyph: 'export' },
  { id: 'settings', label: 'Settings', glyph: 'settings' }
]
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error)
const statusLabel = (status: AttendanceStatus) => status === 'P' ? 'Present' : status === 'L' ? 'Late' : 'Absent'

export default function App() {
  const [screen, setScreen] = useState<Screen>('scan')
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [activeClassId, setActiveClassId] = useState('')
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [attendance, setAttendance] = useState<AttendanceViewRow[]>([])
  const [logs, setLogs] = useState<ScanLogEntry[]>([])
  const [todayLogs, setTodayLogs] = useState<ScanLogEntry[]>([])
  const [settings, setSettings] = useState<AppSettings>({ late_cutoff: '07:45', cooldown_sec: 5, sound: true, default_camera: '', pin_enabled: false })
  const [date, setDate] = useState(today())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | AttendanceStatus>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [editTarget, setEditTarget] = useState<AttendanceViewRow | null>(null)
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([])
  const [logFrom, setLogFrom] = useState(today())
  const [logTo, setLogTo] = useState(today())
  const [selectedQrIds, setSelectedQrIds] = useState<Set<string>>(new Set())

  const activeClass = classes.find(item => item.id === activeClassId) ?? null
  const reloadClasses = useCallback(async () => {
    const result = await window.pass.classes.list()
    setClasses(result)
    setActiveClassId(current => result.some(item => item.id === current) ? current : result[0]?.id ?? '')
  }, [])
  const reloadScreenData = useCallback(async (classId: string, selectedDate = date, from = logFrom, to = logTo) => {
    if (!classId) { setStudents([]); setAttendance([]); setLogs([]); setTodayLogs([]); return }
    const [nextStudents, nextAttendance, nextLogs, nextTodayLogs] = await Promise.all([
      window.pass.students.list(classId),
      window.pass.attendance.list(classId, selectedDate),
      window.pass.scanLog.list({ classId, dateFrom: from, dateTo: to }),
      window.pass.scanLog.list({ classId, dateFrom: today(), dateTo: today() })
    ])
    setStudents(nextStudents); setAttendance(nextAttendance); setLogs(nextLogs); setTodayLogs(nextTodayLogs)
  }, [date, logFrom, logTo])

  useEffect(() => {
    let alive = true
    Promise.all([window.pass.classes.list(), window.pass.settings.get()]).then(([classRows, appSettings]) => {
      if (!alive) return
      setClasses(classRows); setActiveClassId(classRows[0]?.id ?? ''); setSettings(appSettings)
    }).catch(reason => setError(messageOf(reason)))
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (!activeClassId) return
    reloadScreenData(activeClassId).catch(reason => setError(messageOf(reason)))
  }, [activeClassId, date, logFrom, logTo, reloadScreenData])
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  const playBeep = useCallback(() => {
    if (!settings.sound) return
    try {
      const AudioContextClass = window.AudioContext
      const context = new AudioContextClass()
      const oscillator = context.createOscillator(), gain = context.createGain()
      oscillator.type = 'sine'; oscillator.frequency.value = 880; gain.gain.value = 0.08
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.12)
      oscillator.onended = () => { void context.close() }
    } catch { /* sound is an optional cue; scan state remains authoritative */ }
  }, [settings.sound])
  const handleScan = useCallback(async (payload: string, source: 'webcam' | 'manual') => {
    if (!activeClassId || busy) return
    setBusy(true)
    try {
      const result = await window.pass.attendance.scan({ classId: activeClassId, payload, source })
      if (result.code !== 'cooldown-ignored') setLastResult(result)
      if (result.code === 'recorded') { playBeep(); setToast(`${result.name}: ${result.message}`) }
      if (result.code === 'already-recorded') setToast(result.message)
      if (result.code === 'not-found') setToast(result.message)
      await reloadScreenData(activeClassId)
    } catch (reason) { setError(messageOf(reason)) }
    finally { setBusy(false) }
  }, [activeClassId, busy, playBeep, reloadScreenData])
  const refreshAll = useCallback(async () => {
    await reloadClasses()
    if (activeClassId) await reloadScreenData(activeClassId)
  }, [activeClassId, reloadClasses, reloadScreenData])

  const visibleAttendance = useMemo(() => attendance.filter(row => {
    const matchesFilter = filter === 'all' || row.status === filter
    const needle = query.trim().toLowerCase()
    return matchesFilter && (!needle || row.name.toLowerCase().includes(needle) || row.student_id.toLowerCase().includes(needle))
  }), [attendance, filter, query])
  const recordedToday = attendance.filter(row => row.recorded).length
  const summary = { present: attendance.filter(row => row.status === 'P').length, late: attendance.filter(row => row.status === 'L').length, absent: attendance.filter(row => row.status === 'A').length }
  const recent = useMemo(() => {
    const unique = new Map<string, ScanLogEntry>()
    for (const entry of todayLogs) {
      if (entry.date !== today() || !entry.student_id || entry.result === 'not-found' || entry.result === 'ignored-cooldown') continue
      if (!unique.has(entry.student_id)) unique.set(entry.student_id, entry)
    }
    return [...unique.values()].slice(0, 8)
  }, [todayLogs])

  async function importFinished(record: ClassRecord) {
    await reloadClasses()
    setActiveClassId(record.id); setShowImport(false); setScreen('scan')
    await reloadScreenData(record.id)
    setToast(`Imported ${record.name}`)
  }
  async function deleteClass(record: ClassRecord) {
    if (!window.confirm(`Delete ${record.name} and all its local attendance records? This cannot be undone.`)) return
    try {
      await window.pass.classes.delete(record.id)
      await reloadClasses()
      setToast(`${record.name} deleted`)
    } catch (reason) { setError(messageOf(reason)) }
  }
  async function saveManual(input: { status: AttendanceStatus; remark: string; pin: string }) {
    if (!editTarget || !activeClassId) return
    await window.pass.attendance.setManual({ classId: activeClassId, studentId: editTarget.student_id, date, status: input.status, remark: input.remark, ...(settings.pin_enabled ? { pin: input.pin } : {}) })
    setEditTarget(null); await reloadScreenData(activeClassId); setToast('Attendance updated')
  }
  async function exportLogXlsx() {
    try {
      const filePath = await window.pass.scanLog.exportXlsx({ classId: activeClassId, dateFrom: logFrom, dateTo: logTo })
      if (filePath) setToast(`Scan log exported: ${filePath}`)
    } catch (reason) { setError(messageOf(reason)) }
  }
  async function updateWorkbook() {
    try {
      const result = await window.pass.exports.updateClassRecord({ classId: activeClassId, date })
      setToast(`Updated ${result.header} column · ${result.matched} students. Backup: ${result.backupPath}`)
    } catch (reason) { setError(messageOf(reason)) }
  }
  async function outputQr(mode: 'print' | 'pdf') {
    try {
      const filePath = await window.pass.exports.outputQrSheet({ classId: activeClassId, studentIds: [...selectedQrIds], mode })
      if (mode === 'pdf' && filePath) setToast(`PDF saved: ${filePath}`)
      else if (mode === 'print') setToast('QR sheet sent to printer')
    } catch (reason) { setError(messageOf(reason)) }
  }

  return <div className="app-shell">
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand-mark" title="PASS — PNHS Attendance Scanning System"><PassLogo /></div>
      <nav>{screens.map(item => <button key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => { setScreen(item.id); if (item.id === 'scan') setDate(today()) }} aria-current={screen === item.id ? 'page' : undefined}><Icon name={item.glyph} /><span>{item.label}</span></button>)}</nav>
      <div className="offline"><i /><div><strong>Offline</strong><span>Data saved locally</span></div></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="app-name"><PassLogo inverse /><div><strong>PASS</strong><small>Pantabangan National High School</small></div></div>
        <div className="class-switcher"><div><small>CURRENT CLASS</small><select aria-label="Active class" value={activeClassId || '__none__'} onChange={event => { const value = event.target.value; if (value === '__new__') { setShowImport(true); return } setActiveClassId(value === '__none__' ? '' : value); setLastResult(null) }}>
          {classes.length === 0 ? <option value="__none__">No class yet</option> : classes.map(item => <option key={item.id} value={item.id}>{item.name} · {item.section}</option>)}
          <option value="__new__">+ New class</option>
        </select></div><div className="class-avatar">{activeClass?.section?.slice(0, 2) || '—'}</div></div>
      </header>
      <div className="content">
        {!activeClass && classes.length === 0 ? <EmptyState importClass={() => setShowImport(true)} /> : <div className="page">
          {error && <Alert text={error} onClose={() => setError('')} />}
          {screen === 'scan' && <ScanPage activeClassId={activeClassId} active={screen === 'scan'} settings={settings} devices={cameraDevices} onDevices={setCameraDevices} result={lastResult} recent={recent} attendance={attendance} stats={summary} busy={busy} onScan={handleScan} onImport={() => setShowImport(true)} />}
          {screen === 'attendance' && <AttendancePage rows={visibleAttendance} query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} stats={summary} onEdit={setEditTarget} date={date} onDate={setDate} />}
          {screen === 'students' && <StudentsPage students={students} onImport={() => setShowImport(true)} onQr={() => setScreen('qr-codes')} />}
          {screen === 'scan-log' && <ScanLogPage rows={logs} dateFrom={logFrom} dateTo={logTo} onDateFrom={setLogFrom} onDateTo={setLogTo} onExport={() => void exportLogXlsx()} />}
          {screen === 'qr-codes' && <QrCodesPage students={students} selected={selectedQrIds} setSelected={setSelectedQrIds} onPrint={() => void outputQr('print')} onSavePdf={() => void outputQr('pdf')} />}
          {screen === 'export' && <ExportPage record={activeClass!} rows={attendance} date={date} onDate={setDate} onUpdate={() => void updateWorkbook()} logFrom={logFrom} logTo={logTo} onLogFrom={setLogFrom} onLogTo={setLogTo} onExportLog={() => void exportLogXlsx()} />}
          {screen === 'settings' && <SettingsPage activeClass={activeClass!} classes={classes} settings={settings} devices={cameraDevices} onSaveSettings={async patch => { const next = await window.pass.settings.save(patch); setSettings(next); setToast('Settings saved') }} onSetPin={async value => { await window.pass.settings.setPin(value); setSettings(await window.pass.settings.get()); setToast(value ? 'PIN enabled' : 'PIN disabled') }} onUpdateClass={async patch => { const updated = await window.pass.classes.update(activeClassId, patch); await reloadClasses(); setToast('Class details saved'); return updated }} onDeleteClass={deleteClass} onSelectClass={setActiveClassId} />}
        </div>}
      </div>
    </main>
    {showImport && <ImportWizard onClose={() => setShowImport(false)} onComplete={importFinished} />}
    {editTarget && <EditAttendanceDialog row={editTarget} date={date} pinEnabled={settings.pin_enabled} onClose={() => setEditTarget(null)} onSave={saveManual} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

function PassLogo({ inverse = false }: { inverse?: boolean }) {
  const base = inverse ? '#FFFFFF' : '#1E2A38'
  const accent = inverse ? '#FFFFFF' : '#27AE60'
  return <svg className="pass-logo" viewBox="0 0 512 512" role="img" aria-label="PASS logo"><rect x="40" y="40" width="120" height="120" rx="22" fill={accent} /><rect x="352" y="40" width="120" height="120" rx="22" fill={base} /><rect x="40" y="196" width="120" height="120" rx="22" fill={base} /><rect x="352" y="196" width="120" height="120" rx="22" fill={base} /><rect x="196" y="352" width="120" height="120" rx="22" fill={base} /></svg>
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M8 12h8" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    list: <><path d="M9 6h12M9 12h12M9 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 19v2" /></>,
    export: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63h.02A1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9c.25.61.85 1 1.55 1H21v4h-.08c-.67 0-1.28.4-1.52 1z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    warning: <><path d="M10.3 3.7 2.5 17.2A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.8L13.7 3.7a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" /></>,
    camera: <><path d="M5 7h3l2-3h4l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" /><circle cx="12" cy="13" r="4" /></>,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.list}</svg>
}

function Button({ children, variant = 'primary', onClick, icon, disabled = false, type = 'button' }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; onClick?: () => void; icon?: string; disabled?: boolean; type?: 'button' | 'submit' }) {
  return <button type={type} className={`button ${variant}`} onClick={onClick} disabled={disabled}>{icon && <Icon name={icon} size={17} />}{children}</button>
}
function StatusPill({ status }: { status: AttendanceStatus }) { const tone = status === 'P' ? 'present' : status === 'L' ? 'late' : 'absent'; return <span className={`status ${tone}`}><span className="status-dot" />{statusLabel(status)}</span> }
function Alert({ text, onClose }: { text: string; onClose: () => void }) { return <div className="alert" role="alert"><span>{text}</span><button aria-label="Dismiss error" onClick={onClose}><Icon name="close" size={17} /></button></div> }
function PageHead({ title, sub, actions }: { title: string; sub: string; actions?: ReactNode }) { return <div className="page-head"><div><h1>{title}</h1><p>{sub}</p></div>{actions && <div className="page-actions">{actions}</div>}</div> }
function Summary({ stats, total }: { stats: { present: number; late: number; absent: number }; total: number }) {
  const items = [{ label: 'Present', value: stats.present, tone: 'present', icon: 'check' }, { label: 'Late', value: stats.late, tone: 'late', icon: 'warning' }, { label: 'Absent', value: stats.absent, tone: 'absent', icon: 'close' }, { label: 'Total', value: total, tone: 'total', icon: 'users' }]
  return <div className="summary-grid">{items.map(item => <div className={`summary-card ${item.tone}`} key={item.label}><div className="summary-icon"><Icon name={item.icon} size={20} /></div><div><span>{item.label}</span><strong>{item.value}</strong></div></div>)}</div>
}
function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) { return <div className="table-wrap"><table><thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody></table></div> }
function EmptyInTable({ text }: { text: string }) { return <div className="empty-table"><div className="empty-illustration small"><Icon name="users" size={25} /></div><span>{text}</span></div> }
function EmptyState({ importClass }: { importClass: () => void }) { return <div className="empty-page"><div className="empty-illustration"><Icon name="users" size={43} /><span>+</span></div><h1>No class yet</h1><p>Import your class record to add students and start taking attendance offline.</p><Button onClick={importClass}>Import your class record</Button><small>Supports Microsoft Excel .xlsx files</small></div> }

function ScanPage(props: { activeClassId: string; active: boolean; settings: AppSettings; devices: MediaDeviceInfo[]; onDevices: (devices: MediaDeviceInfo[]) => void; result: ScanResult | null; recent: ScanLogEntry[]; attendance: AttendanceViewRow[]; stats: { present: number; late: number; absent: number }; busy: boolean; onScan: (payload: string, source: 'webcam' | 'manual') => Promise<void>; onImport: () => void }) {
  const [manualId, setManualId] = useState(''), [deviceId, setDeviceId] = useState(props.settings.default_camera), [cameraMessage, setCameraMessage] = useState('Starting camera…')
  const manualRef = useRef<HTMLInputElement>(null)
  const result = props.result
  async function submitManual(event: React.FormEvent) { event.preventDefault(); const value = manualId.trim(); if (!value) { manualRef.current?.focus(); return } await props.onScan(value, 'manual'); setManualId('') }
  const resultTone = !result ? 'idle' : result.code === 'recorded' ? 'success' : result.code === 'already-recorded' ? 'duplicate' : result.code === 'not-found' ? 'error' : 'success'
  const resultIcon = !result ? 'camera' : result.code === 'recorded' ? 'check' : result.code === 'not-found' ? 'close' : 'warning'
  return <div className="page">
    <PageHead title="Scan attendance" sub="Point the camera at a student ID QR code." actions={<Button variant="secondary" icon="edit" onClick={() => manualRef.current?.focus()}>Manual entry</Button>} />
    <Summary stats={props.stats} total={props.attendance.length} />
    <div className="scan-layout">
      <section className="card camera-card">
        <div className="card-top"><div><h2>Live camera</h2><span className="live"><i />LIVE</span></div>
          <select aria-label="Camera" value={deviceId} onChange={event => setDeviceId(event.target.value)}><option value="">System default</option>{props.devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select>
        </div>
        <CameraScanner active={props.active && Boolean(props.activeClassId)} deviceId={deviceId} onStatus={setCameraMessage} onDevices={props.onDevices} onScan={payload => { void props.onScan(payload, 'webcam') }} />
        <div className="camera-status" role="status"><Icon name="camera" size={15} />{cameraMessage}</div>
        <form className="manual-form" onSubmit={submitManual}><label htmlFor="manual-id">Enter student ID manually</label><div><input ref={manualRef} id="manual-id" value={manualId} onChange={event => setManualId(event.target.value)} placeholder="Student ID" autoComplete="off" /><Button type="submit" disabled={props.busy || !manualId.trim()}>Record</Button></div></form>
      </section>
      <section className={`result-card ${resultTone}`} aria-live="polite">
        <div className="result-icon"><Icon name={resultIcon} size={33} /></div>
        <small>{!result ? 'READY TO SCAN' : result.code === 'recorded' ? 'SCAN SUCCESSFUL' : result.code === 'already-recorded' ? 'ALREADY SCANNED' : result.code === 'not-found' ? 'NOT FOUND' : 'SCAN RESULT'}</small>
        <h2>{result?.name || (!result ? 'Scan result' : result.studentId || 'Unknown ID')}</h2><p>{result?.studentId ?? 'Point the camera at a student ID QR code.'}</p>
        {result?.time && <div className="result-time"><span>Time scanned</span><strong>{result.time}</strong></div>}
        <div className="result-status">{result?.message ?? 'Ready for the first scan'}</div>
        {result?.status && <div className="result-status result-status-pill"><StatusPill status={result.status} /></div>}
      </section>
    </div>
    <section className="card recent"><div className="card-title"><div><h2>Recent scans</h2><p>Latest activity for today</p></div><span>{props.recent.length} students</span></div>
      {props.recent.length ? <div className="recent-grid">{props.recent.map((entry, index) => {
        const attendanceRow = props.attendance.find(row => row.student_id === entry.student_id)
        if (!attendanceRow) return null
        return <div className="recent-item" key={`${entry.student_id}-${entry.timestamp_iso}-${index}`}><div className="avatar">{entry.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || '—'}</div><div className="recent-student"><strong>{entry.name || entry.student_id}</strong><span>{entry.student_id}</span></div><time>{entry.time.slice(0, 5)}</time><StatusPill status={attendanceRow.status} /></div>
      })}</div> : <div className="empty-table compact-empty">No students scanned today yet.</div>}
    </section>
  </div>
}

function CameraScanner({ active, deviceId, onStatus, onDevices, onScan }: { active: boolean; deviceId: string; onStatus: (status: string) => void; onDevices: (devices: MediaDeviceInfo[]) => void; onScan: (payload: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null), canvasRef = useRef<HTMLCanvasElement>(null), scanRef = useRef(onScan), statusRef = useRef(onStatus)
  scanRef.current = onScan; statusRef.current = onStatus
  useEffect(() => {
    if (!active) return
    let stream: MediaStream | undefined, interval = 0, disposed = false, previousPayload = ''
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable in this environment.')
        statusRef.current('Requesting camera access…')
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }), width: { ideal: 640 }, height: { ideal: 480 } } })
        if (disposed) { stream.getTracks().forEach(track => track.stop()); return }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream; await video.play()
        const devices = await navigator.mediaDevices.enumerateDevices()
        onDevices(devices.filter(item => item.kind === 'videoinput'))
        statusRef.current('Camera ready · hold a QR code in the frame')
        const canvas = canvasRef.current, context = canvas?.getContext('2d', { willReadFrequently: true })
        if (!canvas || !context) { statusRef.current('Unable to start the QR reader.'); return }
        canvas.width = 640; canvas.height = 480
        interval = window.setInterval(() => { if (!video.videoWidth || !video.videoHeight) return; context.drawImage(video, 0, 0, 640, 480); const frame = context.getImageData(0, 0, 640, 480); const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' }); if (code?.data) { if (code.data !== previousPayload) { previousPayload = code.data; scanRef.current(code.data) } } else previousPayload = '' }, 125)
      } catch (reason) {
        const name = reason instanceof DOMException ? reason.name : ''
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') statusRef.current('Camera not found. Connect a webcam or enter the ID manually.')
        else if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') statusRef.current('Camera permission blocked. Allow camera access in Windows privacy settings.')
        else if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') statusRef.current('Camera is in use by another app. Close it there and try again.')
        else statusRef.current(reason instanceof Error ? reason.message : 'Unable to open camera. Manual ID entry is available.')
      }
    }
    void start()
    return () => { disposed = true; window.clearInterval(interval); stream?.getTracks().forEach(track => track.stop()); if (videoRef.current) videoRef.current.srcObject = null }
  }, [active, deviceId, onDevices])
  return <div className="camera-view"><video ref={videoRef} playsInline muted aria-label="Live webcam preview" /><div className="camera-glow" /><div className="scan-frame"><i /><i /><i /><i /></div><div className="scan-line" /><div className="camera-hint"><Icon name="camera" size={16} />Hold QR code inside the frame</div><canvas ref={canvasRef} className="hidden-canvas" /></div>
}

function AttendancePage({ rows, query, onQuery, filter, onFilter, stats, onEdit, date, onDate }: { rows: AttendanceViewRow[]; query: string; onQuery: (value: string) => void; filter: 'all' | AttendanceStatus; onFilter: (value: 'all' | AttendanceStatus) => void; stats: { present: number; late: number; absent: number }; onEdit: (row: AttendanceViewRow) => void; date: string; onDate: (value: string) => void }) {
  return <div className="page"><PageHead title="Attendance" sub="Review and update today's class record." actions={<div className="date-control"><span>Date</span><input type="date" value={date} onChange={event => onDate(event.target.value)} aria-label="Attendance date" /></div>} />
    <Summary stats={stats} total={stats.present + stats.late + stats.absent} />
    <section className="card table-card"><div className="toolbar"><div className="chips">{(['all', 'P', 'L', 'A'] as const).map(value => <button className={filter === value ? 'active' : ''} key={value} onClick={() => onFilter(value)}>{value === 'all' ? `All ${stats.present + stats.late + stats.absent}` : `${statusLabel(value)} ${stats[value === 'P' ? 'present' : value === 'L' ? 'late' : 'absent']}`}</button>)}</div><label className="search"><Icon name="search" size={17} /><input aria-label="Search attendance" value={query} onChange={event => onQuery(event.target.value)} placeholder="Search students..." /></label></div>
      <Table headers={['ID No.', 'Student name', 'Status', 'Time in', '']} rows={rows.map(row => [row.student_id, <b>{row.name}</b>, <StatusPill status={row.status} />, row.time_in ?? '—', <button className="text-action" onClick={() => onEdit(row)}><Icon name="edit" size={15} /> Edit</button>])} />
      {rows.length === 0 && <EmptyInTable text="No students match this view." />}<div className="table-foot">Students without a saved record appear as Absent on screen only.</div>
    </section>
  </div>
}

function StudentsPage({ students, onImport, onQr }: { students: StudentRecord[]; onImport: () => void; onQr: () => void }) {
  const [query, setQuery] = useState('')
  const filtered = students.filter(student => `${student.name} ${student.student_id}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="page"><PageHead title="Students" sub={`${students.length} students in the active class.`} actions={<Button icon="users" onClick={onImport}>Import class</Button>} />
    <section className="card table-card"><div className="toolbar"><div className="muted-label">CLASS LIST</div><label className="search"><Icon name="search" size={17} /><input aria-label="Search students" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search students..." /></label></div>
      <Table headers={['ID No.', 'Student name', 'QR code']} rows={filtered.map((student, index) => [student.student_id, <div className="student-cell"><div className="avatar">{student.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || '—'}</div><b>{student.name}</b></div>, <button className="qr-preview" onClick={onQr} aria-label={`Open QR codes for ${student.name}`}><Icon name="qr" size={17} /> QR codes</button>])} />
      {filtered.length === 0 && <EmptyInTable text={students.length ? 'No students match your search.' : 'No students in this class yet. Import a class spreadsheet to add the roster.'} />}
    </section>
  </div>
}

function ScanLogPage({ rows, dateFrom, dateTo, onDateFrom, onDateTo, onExport }: { rows: ScanLogEntry[]; dateFrom: string; dateTo: string; onDateFrom: (value: string) => void; onDateTo: (value: string) => void; onExport: () => void }) {
  return <div className="page"><PageHead title="Scan log" sub="A complete, read-only history of every scan." actions={<Button variant="secondary" icon="export" onClick={onExport} disabled={dateFrom > dateTo}>Export log (.xlsx)</Button>} />
    <div className="notice"><Icon name="list" size={17} /><span><strong>Audit record</strong> Entries cannot be edited or deleted.</span></div>
    <section className="card table-card"><div className="toolbar"><div className="range"><label>From<input type="date" value={dateFrom} onChange={event => onDateFrom(event.target.value)} aria-label="Scan log start date" /></label><span>to</span><label>To<input type="date" value={dateTo} onChange={event => onDateTo(event.target.value)} aria-label="Scan log end date" /></label></div><label className="search"><Icon name="search" size={17} /><input aria-label="Search scan log" placeholder="Search ID or name..." /></label></div>
      <Table headers={['Student ID', 'Name', 'Date', 'Time', 'Scan source', 'Result']} rows={rows.map((row, index) => [row.student_id || '—', <b>{row.name || '—'}</b>, row.date, row.time, row.source, <span className={`log-result ${row.result.startsWith('recorded') ? 'good' : row.result === 'not-found' ? 'bad' : ''}`}>{row.result}</span>])} />
      {rows.length === 0 && <EmptyInTable text="No scan attempts found for this date range." />}<div className="table-foot">Rows cannot be edited or deleted here. CSV source: Documents\PASS\{rows[0]?.class || 'class'}\scan-log.csv</div>
    </section>
  </div>
}

function QRMark() { return <div className="qr-mark" aria-hidden="true"><Icon name="qr" size={70} /></div> }
function QrCodesPage({ students, selected, setSelected, onPrint, onSavePdf }: { students: StudentRecord[]; selected: Set<string>; setSelected: (set: Set<string>) => void; onPrint: () => void; onSavePdf: () => void }) {
  const allSelected = students.length > 0 && selected.size === students.length
  const setAll = () => setSelected(allSelected ? new Set() : new Set(students.map(student => student.student_id)))
  const toggle = (id: string) => { const next = new Set(selected); next.has(id) ? next.delete(id) : next.add(id); setSelected(next) }
  return <div className="page"><PageHead title="QR codes" sub="Generate, print, or save student ID codes." actions={<><Button variant="secondary" onClick={setAll} disabled={students.length === 0}>Generate all</Button><Button variant="secondary" onClick={onPrint} disabled={selected.size === 0}>Print selected</Button><Button onClick={onSavePdf} disabled={selected.size === 0}>Save as PDF</Button></>} />
    <div className="selection-bar"><label><input type="checkbox" checked={allSelected} onChange={setAll} /> Select all students</label><span>{selected.size} of {students.length} selected</span></div>
    <div className="qr-grid">{students.map(student => <div className="qr-card" key={student.student_id}><label><input type="checkbox" checked={selected.has(student.student_id)} onChange={() => toggle(student.student_id)} aria-label={`Select ${student.name}`} /></label><QRMark /><strong>{student.name}</strong><span>{student.student_id}</span></div>)}</div>
    {students.length === 0 && <section className="card empty-qr"><EmptyInTable text="Import a class roster before selecting students." /></section>}
  </div>
}

function ExportPage({ record, rows, date, onDate, onUpdate, logFrom, logTo, onLogFrom, onLogTo, onExportLog }: { record: ClassRecord; rows: AttendanceViewRow[]; date: string; onDate: (value: string) => void; onUpdate: () => void; logFrom: string; logTo: string; onLogFrom: (value: string) => void; onLogTo: (value: string) => void; onExportLog: () => void }) {
  const present = rows.filter(row => row.status === 'P').length, late = rows.filter(row => row.status === 'L').length, absent = rows.filter(row => row.status === 'A').length
  return <div className="page"><PageHead title="Export" sub="Save attendance records to your computer." />
    <div className="export-grid">
      <ExportCard icon="calendar" title="Update class record (.xlsx)" text="Write attendance status into your original class record format.">
        <label>Attendance date<input type="date" value={date} onChange={event => onDate(event.target.value)} aria-label="Attendance date" /></label>
        <div className="source-file"><span className="file-icon">XLSX</span><div><strong>{record.source_xlsx_path ? record.source_xlsx_path.split(/[\\/]/).pop() : 'No source workbook linked'}</strong><small>{record.source_xlsx_path || 'Import an .xlsx file to link the original class record.'}</small></div></div>
        <div className="export-preview"><span>{rows.length} students</span><span>{present} Present</span><span>{late} Late</span><span>{absent} Absent</span></div>
        <Button icon="export" disabled={!record.source_xlsx_path} onClick={onUpdate}>Update &amp; save file</Button>
      </ExportCard>
      <ExportCard icon="list" title="Export scan log (.xlsx)" text="Save the append-only scan history for a date range.">
        <div className="two-dates"><label>From<input type="date" value={logFrom} onChange={event => onLogFrom(event.target.value)} /></label><label>To<input type="date" value={logTo} onChange={event => onLogTo(event.target.value)} /></label></div>
        <Button icon="export" disabled={logFrom > logTo} onClick={onExportLog}>Export scan log</Button>
      </ExportCard>
    </div>
  </div>
}
function ExportCard({ icon, title, text, children }: { icon: string; title: string; text: string; children: ReactNode }) { return <section className="card export-card"><div className="export-icon"><Icon name={icon} size={25} /></div><h2>{title}</h2><p>{text}</p><div className="export-form">{children}</div></section> }

function SettingsPage({ activeClass, classes, settings, devices, onSaveSettings, onSetPin, onUpdateClass, onDeleteClass, onSelectClass }: { activeClass: ClassRecord; classes: ClassRecord[]; settings: AppSettings; devices: MediaDeviceInfo[]; onSaveSettings: (patch: Partial<AppSettings>) => Promise<void>; onSetPin: (pin: string | null) => Promise<void>; onUpdateClass: (patch: Pick<ClassRecord, 'name' | 'section' | 'subject' | 'school_year'>) => Promise<ClassRecord>; onDeleteClass: (record: ClassRecord) => Promise<void>; onSelectClass: (id: string) => void }) {
  const [draft, setDraft] = useState(settings), [classDraft, setClassDraft] = useState({ name: activeClass.name, section: activeClass.section, subject: activeClass.subject, school_year: activeClass.school_year }), [pin, setPin] = useState(''), [saving, setSaving] = useState(false), [localError, setLocalError] = useState(''), [editingClass, setEditingClass] = useState(false)
  useEffect(() => { setDraft(settings) }, [settings])
  useEffect(() => { setClassDraft({ name: activeClass.name, section: activeClass.section, subject: activeClass.subject, school_year: activeClass.school_year }) }, [activeClass])
  async function saveAttendanceSettings() { setSaving(true); setLocalError(''); try { await onSaveSettings({ late_cutoff: draft.late_cutoff, cooldown_sec: draft.cooldown_sec, sound: draft.sound, default_camera: draft.default_camera }) } catch (reason) { setLocalError(messageOf(reason)) } finally { setSaving(false) } }
  async function togglePin() { setSaving(true); setLocalError(''); try { if (settings.pin_enabled) { await onSetPin(null); setPin('') } else { await onSetPin(pin) } } catch (reason) { setLocalError(messageOf(reason)) } finally { setSaving(false) } }
  async function saveClass() { setSaving(true); setLocalError(''); try { await onUpdateClass(classDraft); setEditingClass(false) } catch (reason) { setLocalError(messageOf(reason)) } finally { setSaving(false) } }
  return <div className="page"><PageHead title="Settings" sub="Configure attendance rules, scanning, and classes." />
    {localError && <Alert text={localError} onClose={() => setLocalError('')} />}
    <div className="settings-grid">
      <section className="card settings-card"><h2>Attendance &amp; scanning</h2><p className="section-sub">Defaults used for every scanning session.</p>
        <Setting label="Late cutoff time" help="Scans after this time are marked Late."><input type="time" value={draft.late_cutoff} onChange={event => setDraft({ ...draft, late_cutoff: event.target.value })} aria-label="Late cutoff time" /></Setting>
        <Setting label="Scan cooldown" help="Wait time before the same QR can scan again."><div className="suffix-input"><input type="number" min="0" max="3600" value={draft.cooldown_sec} onChange={event => setDraft({ ...draft, cooldown_sec: Number(event.target.value) })} aria-label="Scan cooldown seconds" /><span>seconds</span></div></Setting>
        <Setting label="Scan sound" help="Play a sound after each successful scan."><input type="checkbox" checked={draft.sound} onChange={event => setDraft({ ...draft, sound: event.target.checked })} aria-label="Scan sound" /></Setting>
        <Setting label="Default camera" help="Camera selected when the app starts."><select value={draft.default_camera} onChange={event => setDraft({ ...draft, default_camera: event.target.value })} aria-label="Default camera"><option value="">System default</option>{devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select></Setting>
        <div className="setting-row"><div><strong>PIN lock</strong><span>Require a PIN to edit attendance records.</span></div><div className="pin-setting">{!settings.pin_enabled && <input type="password" inputMode="numeric" maxLength={12} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} placeholder="4–12 digits" aria-label="New PIN" />}<button className={`toggle ${settings.pin_enabled ? 'on' : ''}`} aria-label={settings.pin_enabled ? 'Disable PIN lock' : 'Enable PIN lock'} aria-pressed={settings.pin_enabled} onClick={() => void togglePin()} disabled={saving || (!settings.pin_enabled && pin.length < 4)}><i /></button></div></div>
        <div className="settings-save"><Button onClick={() => void saveAttendanceSettings()} disabled={saving}>Save settings</Button></div>
      </section>
      <section className="card settings-card"><div className="card-title"><div><h2>Class management</h2><p>Create, rename, or remove local classes.</p></div><span className="muted-label">{classes.length} classes</span></div>
        {classes.map(record => <div className={`class-row ${activeClass.id === record.id ? 'selected-class' : ''}`} key={record.id}><div className="class-icon">{record.section.slice(0, 2) || '—'}</div><div className="class-details"><strong>{record.name}</strong><span>{record.section} · {record.subject}{activeClass.id === record.id ? ' · Active' : ''}</span></div><button className="icon-button" aria-label={`Edit ${record.name}`} title="Edit class" onClick={() => { if (record.id !== activeClass.id) onSelectClass(record.id); setEditingClass(true) }}><Icon name="edit" size={17} /></button><button className="icon-button danger-icon" aria-label={`Delete ${record.name}`} title="Delete class" onClick={() => void onDeleteClass(record)}><Icon name="trash" size={17} /></button></div>)}
        {editingClass && <div className="class-edit-fields"><strong>Edit active class</strong><div className="class-fields"><label>Class name<input value={classDraft.name} onChange={event => setClassDraft({ ...classDraft, name: event.target.value })} /></label><label>Section<input value={classDraft.section} onChange={event => setClassDraft({ ...classDraft, section: event.target.value })} /></label><label>Subject<input value={classDraft.subject} onChange={event => setClassDraft({ ...classDraft, subject: event.target.value })} /></label><label>School year<input value={classDraft.school_year} onChange={event => setClassDraft({ ...classDraft, school_year: event.target.value })} /></label></div><div className="settings-save"><Button onClick={() => void saveClass()} disabled={saving}>Save class details</Button><Button variant="secondary" onClick={() => setEditingClass(false)}>Cancel</Button></div></div>}
      </section>
    </div>
  </div>
}
function Setting({ label, help, children }: { label: string; help: string; children: ReactNode }) { return <div className="setting-row"><div><strong>{label}</strong><span>{help}</span></div>{children}</div> }

function ImportWizard({ onClose, onComplete }: { onClose: () => void; onComplete: (record: ClassRecord) => Promise<void> }) {
  const [filePath, setFilePath] = useState(''), [preview, setPreview] = useState<ImportPreview | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [step, setStep] = useState(1)
  const [form, setForm] = useState({ className: '', section: '', subject: '', schoolYear: '' }), [idColumn, setIdColumn] = useState(0), [nameColumn, setNameColumn] = useState(1)
  async function chooseFile() { setError(''); try { const selected = await window.pass.classes.chooseImportFile(); if (!selected) return; setBusy(true); setFilePath(selected); const next = await window.pass.classes.importPreview(selected); setPreview(next); setIdColumn(0); setNameColumn(Math.min(1, next.headers.length - 1)); setForm(current => ({ ...current, className: current.className || next.sheetName })); setStep(2) } catch (reason) { setError(messageOf(reason)) } finally { setBusy(false) } }
  async function importClass(event: React.FormEvent) { event.preventDefault(); if (!filePath || !preview) return; setBusy(true); setError(''); try { const record = await window.pass.classes.importClass({ filePath, ...form, schoolYear: form.schoolYear, idColumn, nameColumn }); await onComplete(record) } catch (reason) { setError(messageOf(reason)) } finally { setBusy(false) } }
  const stepLabels = ['Upload file', 'Map columns', 'Confirm']
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="modal-head"><div><h2 id="import-title">Import class</h2><p>Add students from an Excel class record</p></div><button className="icon-button" aria-label="Close import wizard" onClick={onClose}><Icon name="close" /></button></div>
    <div className="steps">{stepLabels.map((label, index) => <div className={step >= index + 1 ? 'active' : ''} key={label}><span>{step > index + 1 ? '✓' : index + 1}</span>{label}</div>)}</div>{error && <div className="form-error" role="alert">{error}</div>}
    {step === 1 && <div className="drop-zone"><Icon name="export" size={34} /><h3>Drop your .xlsx file here</h3><p>or click to browse your computer</p><Button onClick={() => void chooseFile()} disabled={busy}>{busy ? 'Reading…' : 'Choose file'}</Button><small>Excel files up to 10 MB</small></div>}
    {step === 2 && preview && <div className="mapping"><div className="selected-file"><span className="file-icon">XLSX</span><div><strong>{filePath.split(/[\\/]/).pop()}</strong><small>Worksheet: {preview.sheetName}</small></div><button type="button" className="text-action" onClick={() => { setPreview(null); setFilePath(''); setStep(1) }}>Change</button></div><div className="map-fields"><label>Student ID column<select value={idColumn} onChange={event => setIdColumn(Number(event.target.value))}>{preview.headers.map((header, index) => <option key={index} value={index}>{header}</option>)}</select></label><label>Name column<select value={nameColumn} onChange={event => setNameColumn(Number(event.target.value))}>{preview.headers.map((header, index) => <option key={index} value={index}>{header}</option>)}</select></label></div><h3>Preview · first {preview.rows.length} rows</h3><div className="mapping-table"><Table headers={preview.headers} rows={preview.rows.map(row => preview.headers.map((_, column) => String(row[column] ?? '')))} /></div></div>}
    {step === 3 && preview && <form id="pass-import-form" onSubmit={importClass}><div className="confirm-import"><div className="confirm-icon"><Icon name="check" size={30} /></div><h3>Confirm class details</h3><p>Review the class details before importing.</p><div className="confirm-fields"><label>Class name<input required value={form.className} onChange={event => setForm({ ...form, className: event.target.value })} /></label><label>Section<input required value={form.section} onChange={event => setForm({ ...form, section: event.target.value })} /></label><label>Subject<input required value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} /></label><label>School year<input required value={form.schoolYear} onChange={event => setForm({ ...form, schoolYear: event.target.value })} placeholder="2026–2027" /></label></div><div className="confirm-summary"><span>Students in preview<strong>{preview.rows.length}</strong></span><span>Source file<strong>{filePath.split(/[\\/]/).pop()}</strong></span></div></div></form>}
    <div className="modal-actions"><Button variant="secondary" onClick={() => step === 1 ? onClose() : setStep(step - 1)}>{step === 1 ? 'Cancel' : 'Back'}</Button>{step < 3 ? <Button onClick={() => setStep(step + 1)} disabled={!preview || busy}>{step === 1 ? 'Continue' : 'Continue'}</Button> : <Button type="submit" disabled={busy || !preview} onClick={() => { const formElement = document.getElementById('pass-import-form') as HTMLFormElement | null; formElement?.requestSubmit() }}>{busy ? 'Importing…' : 'Import students'}</Button>}</div>
  </section></div>
}

function EditAttendanceDialog({ row, date, pinEnabled, onClose, onSave }: { row: AttendanceViewRow; date: string; pinEnabled: boolean; onClose: () => void; onSave: (input: { status: AttendanceStatus; remark: string; pin: string }) => Promise<void> }) {
  const [status, setStatus] = useState(row.status), [remark, setRemark] = useState(row.remark ?? ''), [pin, setPin] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false)
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await onSave({ status, remark, pin }) } catch (reason) { setError(messageOf(reason)) } finally { setSaving(false) } }
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><form className="modal small" role="dialog" aria-modal="true" aria-labelledby="edit-title" onSubmit={submit}><div className="modal-head"><div><h2 id="edit-title">Edit attendance</h2><p>{row.name} · {row.student_id}</p></div><button type="button" className="icon-button" aria-label="Close edit dialog" onClick={onClose}><Icon name="close" /></button></div>
    <p className="dialog-date">{date}</p>{error && <div className="form-error" role="alert">{error}</div>}<label className="dialog-label">Status</label><div className="status-options">{(['P', 'L', 'A'] as const).map(value => <label className={status === value ? `selected status-${value.toLowerCase()}` : ''} key={value}><input type="radio" name="attendance-status" value={value} checked={status === value} onChange={() => setStatus(value)} /><StatusPill status={value} /></label>)}</div>
    <label className="dialog-label" htmlFor="attendance-remark">Remark <span>Optional</span></label><textarea id="attendance-remark" value={remark} onChange={event => setRemark(event.target.value)} placeholder="Add a note..." />
    {pinEnabled && <label className="dialog-pin">PIN<input type="password" inputMode="numeric" maxLength={12} value={pin} onChange={event => setPin(event.target.value)} required /></label>}
    <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></div>
  </form></div>
}
