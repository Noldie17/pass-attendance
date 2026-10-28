import { useState, type ReactNode } from 'react'

type Page = 'Scan' | 'Attendance' | 'Students' | 'Scan Log' | 'QR Codes' | 'Export' | 'Settings'
type Status = 'Present' | 'Late' | 'Absent'

const nav: { label: Page; icon: string }[] = [
  { label: 'Scan', icon: 'scan' },
  { label: 'Attendance', icon: 'calendar' },
  { label: 'Students', icon: 'users' },
  { label: 'Scan Log', icon: 'list' },
  { label: 'QR Codes', icon: 'qr' },
  { label: 'Export', icon: 'export' },
  { label: 'Settings', icon: 'settings' },
]

function PassLogo({ inverse = false }: { inverse?: boolean }) {
  const base = inverse ? '#FFFFFF' : '#1E2A38'
  const accent = inverse ? '#FFFFFF' : '#27AE60'
  return <svg className="pass-logo" viewBox="0 0 512 512" role="img" aria-label="PASS logo">
    <rect x="40" y="40" width="120" height="120" rx="22" fill={accent}/>
    <rect x="352" y="40" width="120" height="120" rx="22" fill={base}/>
    <rect x="40" y="196" width="120" height="120" rx="22" fill={base}/>
    <rect x="352" y="196" width="120" height="120" rx="22" fill={base}/>
    <rect x="196" y="352" width="120" height="120" rx="22" fill={base}/>
  </svg>
}

const students = [
  { id: '2024-001', name: 'Amelia Thompson', status: 'Present' as Status, time: '7:38 AM' },
  { id: '2024-002', name: 'Noah Williams', status: 'Present' as Status, time: '7:40 AM' },
  { id: '2024-003', name: 'Sophia Garcia', status: 'Late' as Status, time: '7:51 AM' },
  { id: '2024-004', name: 'Liam Anderson', status: 'Present' as Status, time: '7:42 AM' },
  { id: '2024-005', name: 'Olivia Martinez', status: 'Absent' as Status, time: '—' },
  { id: '2024-006', name: 'Ethan Wilson', status: 'Present' as Status, time: '7:45 AM' },
  { id: '2024-007', name: 'Ava Robinson', status: 'Late' as Status, time: '7:55 AM' },
  { id: '2024-008', name: 'Lucas Brown', status: 'Absent' as Status, time: '—' },
]

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 12h8"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    list: <><path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,
    qr: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 19v2"/></>,
    export: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63h.02A1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9c.25.61.85 1 1.55 1H21v4h-.08c-.67 0-1.28.4-1.52 1z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    warning: <><path d="M10.3 3.7 2.5 17.2A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.8L13.7 3.7a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></>,
    camera: <><path d="M5 7h3l2-3h4l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="4"/></>,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>
}

function Button({ children, variant = 'primary', onClick, icon }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; onClick?: () => void; icon?: string }) {
  return <button className={`button ${variant}`} onClick={onClick}>{icon && <Icon name={icon} size={17}/>} {children}</button>
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`status ${status.toLowerCase()}`}><span className="status-dot"/>{status}</span>
}

function SearchBox({ placeholder = 'Search students...' }: { placeholder?: string }) {
  return <div className="search"><Icon name="search" size={17}/><input aria-label="Search" placeholder={placeholder}/></div>
}

function Summary() {
  return <div className="summary-grid">
    {[['Present','26','present'],['Late','3','late'],['Absent','3','absent'],['Total','32','total']].map(([label,value,tone]) =>
      <div className={`summary-card ${tone}`} key={label}><div className="summary-icon"><Icon name={label === 'Total' ? 'users' : label === 'Absent' ? 'close' : label === 'Late' ? 'warning' : 'check'} size={20}/></div><div><span>{label}</span><strong>{value}</strong></div></div>
    )}
  </div>
}

function PageHead({ title, sub, actions }: { title: string; sub: string; actions?: ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1><p>{sub}</p></div><div className="page-actions">{actions}</div></div>
}

function ScanPage() {
  const [result, setResult] = useState<'success' | 'duplicate' | 'error'>('success')
  const resultData = {
    success: { icon: 'check', eyebrow: 'SCAN SUCCESSFUL', name: 'Amelia Thompson', id: '2024-001', time: '7:38 AM', note: 'Present' },
    duplicate: { icon: 'warning', eyebrow: 'ALREADY SCANNED', name: 'Liam Anderson', id: '2024-004', time: '7:42 AM', note: 'Already recorded at 7:42 AM' },
    error: { icon: 'close', eyebrow: 'NOT FOUND', name: 'Unknown ID', id: '2023-481', time: '7:59 AM', note: 'ID not in this class' },
  }[result]
  return <div className="page">
    <PageHead title="Scan attendance" sub="Point the camera at a student ID QR code." actions={<Button variant="secondary">Manual entry</Button>}/>
    <Summary/>
    <div className="scan-layout">
      <section className="card camera-card">
        <div className="card-top"><div><h2>Live camera</h2><span className="live"><i/>LIVE</span></div><select aria-label="Camera"><option>Integrated Webcam</option><option>USB Camera</option></select></div>
        <div className="camera-view"><div className="camera-glow"/><div className="scan-frame"><i/><i/><i/><i/></div><div className="scan-line"/><div className="camera-hint"><Icon name="camera" size={16}/> Hold QR code inside the frame</div></div>
      </section>
      <section className={`result-card ${result}`}>
        <div className="state-switch">
          <button aria-label="Show success state" className={result === 'success' ? 'active' : ''} onClick={() => setResult('success')}/>
          <button aria-label="Show duplicate state" className={result === 'duplicate' ? 'active' : ''} onClick={() => setResult('duplicate')}/>
          <button aria-label="Show error state" className={result === 'error' ? 'active' : ''} onClick={() => setResult('error')}/>
        </div>
        <div className="result-icon"><Icon name={resultData.icon} size={33}/></div>
        <small>{resultData.eyebrow}</small><h2>{resultData.name}</h2><p>{resultData.id}</p>
        <div className="result-time"><span>Time scanned</span><strong>{resultData.time}</strong></div>
        <div className="result-status">{resultData.note}</div>
        <div className="state-caption">Preview state {result === 'success' ? '1' : result === 'duplicate' ? '2' : '3'} of 3</div>
      </section>
    </div>
    <section className="card recent">
      <div className="card-title"><div><h2>Recent scans</h2><p>Latest activity for today</p></div><span>8 scans</span></div>
      <div className="recent-grid">{students.map((s, i) => <div className="recent-item" key={s.id}><div className="avatar">{s.name.split(' ').map(n => n[0]).join('')}</div><div><strong>{s.name}</strong><span>{s.id}</span></div><time>{s.time}</time><StatusPill status={i === 4 ? 'Present' : s.status}/></div>)}</div>
    </section>
  </div>
}

function EditModal({ close }: { close: () => void }) {
  return <div className="modal-backdrop"><div className="modal small"><div className="modal-head"><div><h2>Edit attendance</h2><p>Olivia Martinez · 2024-005</p></div><button className="icon-button" onClick={close}><Icon name="close"/></button></div>
    <label>Status</label><div className="status-options"><button>Present</button><button>Late</button><button className="selected">Absent</button></div>
    <label>Remark <span>Optional</span></label><textarea placeholder="Add a note..."/>
    <div className="modal-actions"><Button variant="secondary" onClick={close}>Cancel</Button><Button onClick={close}>Save changes</Button></div>
  </div></div>
}

function AttendancePage() {
  const [editing, setEditing] = useState(false)
  return <div className="page"><PageHead title="Attendance" sub="Review and update today's class record." actions={<div className="date-control"><span>Date</span><input type="date" defaultValue="2025-05-14"/></div>}/>
    <Summary/><section className="card table-card"><div className="toolbar"><div className="chips">{['All 32','Present 26','Late 3','Absent 3'].map((x,i)=><button className={i===0?'active':''} key={x}>{x}</button>)}</div><SearchBox/></div>
    <Table headers={['ID No.','Student name','Status','Time in','']} rows={students.map(s => [s.id,<b>{s.name}</b>,<StatusPill status={s.status}/>,s.time,<button className="text-action" onClick={()=>setEditing(true)}><Icon name="edit" size={15}/> Edit</button>])}/></section>{editing && <EditModal close={()=>setEditing(false)}/>}</div>
}

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>
}

function ImportModal({ close }: { close: () => void }) {
  const [step, setStep] = useState(1)
  return <div className="modal-backdrop"><div className="modal import-modal"><div className="modal-head"><div><h2>Import class</h2><p>Add students from an Excel class record</p></div><button className="icon-button" onClick={close}><Icon name="close"/></button></div>
    <div className="steps">{['Upload file','Map columns','Confirm'].map((x,i)=><div className={step >= i+1 ? 'active' : ''} key={x}><span>{step > i+1 ? '✓' : i+1}</span>{x}</div>)}</div>
    {step===1 && <div className="drop-zone"><Icon name="export" size={34}/><h3>Drop your .xlsx file here</h3><p>or click to browse your computer</p><Button variant="secondary">Choose file</Button><small>Excel files up to 10 MB</small></div>}
    {step===2 && <div className="mapping"><div className="map-fields"><label>Student ID column<select><option>Student Number</option></select></label><label>Name column<select><option>Full Name</option></select></label></div><h3>Preview</h3><Table headers={['Student Number','Full Name','Section']} rows={students.slice(0,5).map(s=>[s.id,s.name,'10-A'])}/></div>}
    {step===3 && <div className="confirm-import"><div className="confirm-icon"><Icon name="check" size={30}/></div><h3>Ready to import</h3><p>Review the class details before continuing.</p><div><span>Class name<strong>Grade 10 – Mathematics</strong></span><span>Students found<strong>32</strong></span><span>Source file<strong>class-record.xlsx</strong></span></div></div>}
    <div className="modal-actions"><Button variant="secondary" onClick={step===1?close:()=>setStep(step-1)}>{step===1?'Cancel':'Back'}</Button><Button onClick={step===3?close:()=>setStep(step+1)}>{step===3?'Import 32 students':'Continue'}</Button></div>
  </div></div>
}

function StudentsPage() {
  const [showImport,setShowImport]=useState(false)
  return <div className="page"><PageHead title="Students" sub="32 students in Grade 10 – Mathematics" actions={<Button icon="users" onClick={()=>setShowImport(true)}>Import class</Button>}/>
    <section className="card table-card"><div className="toolbar"><div className="muted-label">CLASS LIST · SCHOOL YEAR 2024–2025</div><SearchBox/></div>
    <Table headers={['ID No.','Student name','QR code','Edit','Delete']} rows={students.map(s=>[s.id,<div className="student-cell"><div className="avatar">{s.name.split(' ').map(n=>n[0]).join('')}</div><b>{s.name}</b></div>,<button className="qr-preview"><Icon name="qr" size={17}/> Preview</button>,<button className="icon-button"><Icon name="edit" size={17}/></button>,<button className="icon-button danger-icon"><Icon name="trash" size={17}/></button>])}/></section>{showImport&&<ImportModal close={()=>setShowImport(false)}/>}</div>
}

function ScanLogPage() {
  return <div className="page"><PageHead title="Scan log" sub="A complete, read-only history of every scan." actions={<Button icon="export">Export log (.xlsx)</Button>}/>
    <div className="notice"><Icon name="list" size={17}/><span><strong>Audit record</strong> Entries cannot be edited or deleted.</span></div>
    <section className="card table-card"><div className="toolbar"><div className="range"><label>From<input type="date" defaultValue="2025-05-14"/></label><span>to</span><label>To<input type="date" defaultValue="2025-05-14"/></label></div><SearchBox placeholder="Search ID or name..."/></div>
    <Table headers={['Student ID','Name','Date','Time','Scan source']} rows={students.map((s,i)=>[s.id,<b>{s.name}</b>,'May 14, 2025',s.time,<span className="source"><Icon name={i===4?'edit':'camera'} size={15}/>{i===4?'Manual':'Webcam'}</span>])}/></section>
  </div>
}

function QRMark({ seed = 0 }: { seed?: number }) {
  const cells = Array.from({length:64},(_,i)=> ((i*7 + seed*11)%13 < 6 || [0,1,2,8,9,10,16,17,18,5,6,7,13,14,15,21,22,23,40,41,42,48,49,50,56,57,58].includes(i)))
  return <div className="qr-mark">{cells.map((on,i)=><i className={on?'on':''} key={i}/>)}</div>
}

function QRCodesPage() {
  return <div className="page"><PageHead title="QR codes" sub="Generate, print, or save student ID codes." actions={<><Button variant="secondary">Generate all</Button><Button variant="secondary">Print selected</Button><Button>Save as PDF</Button></>}/>
    <div className="selection-bar"><label><input type="checkbox"/> Select all students</label><span>0 of 32 selected</span></div>
    <div className="qr-grid">{students.slice(0,6).map((s,i)=><div className="qr-card" key={s.id}><label><input type="checkbox"/></label><QRMark seed={i}/><strong>{s.name}</strong><span>{s.id}</span></div>)}</div>
  </div>
}

function ExportPage() {
  return <div className="page"><PageHead title="Export" sub="Save attendance records to your computer."/>
    <div className="export-grid">
      <ExportCard icon="calendar" title="Update class record (.xlsx)" text="Write attendance status into your original class record format."><label>Attendance date<input type="date" defaultValue="2025-05-14"/></label><Button icon="export">Update & save file</Button></ExportCard>
      <ExportCard icon="list" title="Export scan log (.xlsx)" text="Save the complete append-only scan history for a date range."><div className="two-dates"><label>From<input type="date" defaultValue="2025-05-01"/></label><label>To<input type="date" defaultValue="2025-05-14"/></label></div><Button icon="export">Export scan log</Button></ExportCard>
    </div>
  </div>
}

function ExportCard({icon,title,text,children}:{icon:string;title:string;text:string;children:ReactNode}) {
  return <section className="card export-card"><div className="export-icon"><Icon name={icon} size={25}/></div><h2>{title}</h2><p>{text}</p><div className="export-form">{children}</div><div className="last-export"><span>Last exported</span><strong>May 10, 2025 · 3:24 PM</strong><code>C:\Documents\QR Attendance\Exports</code><button><Icon name="folder" size={15}/> Open folder</button></div></section>
}

function Toggle({on=true}:{on?:boolean}) { return <button className={`toggle ${on?'on':''}`} aria-label="Toggle setting"><i/></button> }

function SettingsPage() {
  return <div className="page"><PageHead title="Settings" sub="Configure attendance rules, scanning, and classes."/>
    <div className="settings-grid"><section className="card settings-card"><h2>Attendance & scanning</h2><p className="section-sub">Defaults used for every scanning session.</p>
      <Setting label="Late cutoff time" help="Scans after this time are marked Late."><input type="time" defaultValue="07:45"/></Setting>
      <Setting label="Scan cooldown" help="Wait time before the same QR can scan again."><div className="suffix-input"><input type="number" defaultValue="5"/><span>seconds</span></div></Setting>
      <Setting label="Scan sound" help="Play a sound after each successful scan."><Toggle/></Setting>
      <Setting label="Default camera" help="Camera selected when the app starts."><select><option>Integrated Webcam</option><option>USB Camera</option></select></Setting>
      <Setting label="PIN lock" help="Require a PIN to edit records or settings."><Toggle on={false}/></Setting>
    </section>
    <section className="card settings-card"><div className="card-title"><div><h2>Class management</h2><p>Create, rename, or remove local classes.</p></div><Button>+ Add class</Button></div>
      {['Grade 10 – Mathematics','Grade 9 – Science','Grade 11 – Physics'].map((c,i)=><div className="class-row" key={c}><div className="class-icon">{10-i}</div><div><strong>{c}</strong><span>{32-i*4} students {i===0&&'· Active'}</span></div><button className="icon-button"><Icon name="edit" size={17}/></button><button className="icon-button danger-icon"><Icon name="trash" size={17}/></button></div>)}
      <div className="settings-save"><Button>Save settings</Button></div>
    </section></div>
  </div>
}

function Setting({label,help,children}:{label:string;help:string;children:ReactNode}) {
  return <div className="setting-row"><div><strong>{label}</strong><span>{help}</span></div>{children}</div>
}

function EmptyState({importClass}:{importClass:()=>void}) {
  return <div className="empty-page"><div className="empty-illustration"><Icon name="users" size={43}/><span>+</span></div><h1>No class yet</h1><p>Import your class record to add students and start taking attendance offline.</p><Button onClick={importClass}>Import your class record</Button><small>Supports Microsoft Excel .xlsx files</small></div>
}

export default function App() {
  const [page,setPage]=useState<Page>('Scan')
  const [className,setClassName]=useState('Grade 10 – Mathematics')
  const [importing,setImporting]=useState(false)
  const changeClass=(value:string)=>{ if(value==='new'){setImporting(true)} else setClassName(value) }
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand-mark" title="PASS — PNHS Attendance Scanning System"><PassLogo/></div><nav>{nav.map(item=><button className={page===item.label?'active':''} onClick={()=>setPage(item.label)} key={item.label}><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav><div className="offline"><i/><div><strong>Offline</strong><span>Data saved locally</span></div></div></aside>
    <main className="main"><header className="topbar"><div className="app-name"><PassLogo inverse/><div><strong>PASS</strong><small>PNHS Attendance Scanning System</small></div></div><div className="class-switcher"><div><small>CURRENT CLASS</small><select value={className} onChange={e=>changeClass(e.target.value)}><option>Grade 10 – Mathematics</option><option>Grade 9 – Science</option><option>Grade 11 – Physics</option><option value="empty">No class (first launch)</option><option value="new">+ New class</option></select></div><div className="class-avatar">10A</div></div></header>
      <div className="content">{className==='empty'?<EmptyState importClass={()=>setImporting(true)}/>:page==='Scan'?<ScanPage/>:page==='Attendance'?<AttendancePage/>:page==='Students'?<StudentsPage/>:page==='Scan Log'?<ScanLogPage/>:page==='QR Codes'?<QRCodesPage/>:page==='Export'?<ExportPage/>:<SettingsPage/>}</div>
    </main>{importing&&<ImportModal close={()=>setImporting(false)}/>}
  </div>
}
