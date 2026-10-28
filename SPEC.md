PROJECT: PASS (PNHS Attendance Scanning System), an offline Windows desktop app for teachers at Pantabangan National High School. A teacher opens a class, points a laptop webcam at a student's ID QR code, and the app records attendance. It must work with no internet and be distributable to other teachers as a .exe.

ATTACHED ZIP = UI REFERENCE. It is a React 19 + Vite + Tailwind 4 prototype with 7 screens (Scan, Attendance, Students, Scan Log, QR Codes, Export, Settings), an Import-class wizard, an Edit-attendance dialog, a first-launch empty state, and the PASS logo. Keep its layout, navigation, components and branding. Its data is hardcoded sample data; replace it with real data. Where the zip conflicts with this brief, this brief wins.

CREDIT RULES (my credit budget is very small, so work lean)
- Do ONLY the phase named under RUN at the bottom, then stop.
- No web browsing or research. Use the stack below with exact pinned versions you already know.
- No image generation, deployments, screenshots, visual QA, GUI or browser testing, Playwright or xvfb. The sandbox can't run Electron windows or webcams; I will test those myself.
- Write files in large batches. Don't re-read files you just wrote.
- If an error persists after 2 attempts, log it in KNOWN_ISSUES.md and move on.
- Final chat reply: 10 lines max.
- Finish by zipping the project (without node_modules) and updating PROGRESS.md.

STACK (do not substitute)
- Electron + electron-vite + React 19 + TypeScript + Tailwind 4 (reuse the zip's components and CSS).
- The main process owns all data. The renderer talks to it only through a typed contextBridge API in preload (contextIsolation on, nodeIntegration off, strict CSP, no remote content, grant only the 'media' permission).
- DB: sql.js (pure WASM, no native modules), saved atomically (write temp file, then rename) after each write. Stored in app.getPath('userData').
- Excel: exceljs. QR scanning: jsqr on getUserMedia frames (~8 fps, 640x480). QR generation: qrcode. QR sheet PDF: webContents.printToPDF.
- Tests: vitest for pure logic only.
- Packaging: electron-builder (Windows NSIS + portable), built by a GitHub Actions workflow on windows-latest. Do NOT try to build the .exe in the sandbox.
- Fonts: Inter bundled locally with @fontsource/inter. No remote fonts or CDNs anywhere.

DATA MODEL
classes(id, name, section, subject, school_year, source_xlsx_path, col_map_json)
students(id, class_id, student_id unique per class, name)
attendance(class_id, student_id, date, status P/L/A, time_in, source webcam|manual, remark) primary key (class_id, student_id, date)
settings(key, value): late_cutoff "07:45", cooldown_sec 5, sound on, default_camera, pin_hash (scrypt, optional)

CORE BEHAVIOR
1. Import class: user picks an .xlsx; ExcelJS reads the first sheet; user maps the Student ID and Name columns (preview 5 rows); the mapping is remembered per class. Reject empty or duplicate IDs with a clear message.
2. Scan: QR payload is "PASS|<studentId>" (also accept a bare student ID). Look it up in the active class.
   - Found, first scan today: save Present, or Late if after late_cutoff.
   - Found, already recorded today: change nothing, show "Already recorded at HH:MM".
   - Not found: show "ID not in this class".
   - Same QR within cooldown_sec is ignored silently.
   - Beep with Web Audio (no audio files). Manual ID entry is also supported.
3. Scan log (proof): EVERY scan attempt, including duplicates and unknown IDs, is appended to scan-log.csv in Documents\PASS\<class>\ with columns timestamp_iso, date, time, student_id, name, class, source, result. Append-only with fsync. No UI to edit or delete rows. The Scan Log screen reads it and exports an .xlsx copy for a date range.
4. Attendance screen: view by date, filter chips, search. Manual Present/Late/Absent with an optional remark (requires the PIN if enabled). Students with no record count as Absent on screen only.
5. Export "Update class record": load the original with ExcelJS, add a column after the last used one (header like "Oct 23"), write P/L/A per student matched by ID, keep existing formatting. Before the first write, save original.bak.xlsx. If the file is locked (EBUSY/EPERM), show "Close the file in Excel, then try again" and write nothing. The DB stays the source of truth.
6. QR Codes: generate for all or selected students; print or save a PDF sheet (grid of cards with name, ID, QR). Print and Save are disabled with 0 selected.
7. Settings: late cutoff, cooldown, sound, default camera, PIN on/off, class management (rename, delete with confirmation).
8. Camera errors handled: not found, permission blocked, in use by another app.
9. Multiple classes with a class switcher; first-launch empty state.
10. Signed (HMAC) QR codes are OUT OF SCOPE. TODO: Do not implement signed QR payloads in the current scope.

UI: MATCH THE ZIP'S LOOK (the owner prefers it exactly as designed)
- Reproduce the zip's visual design faithfully: the same layout, colors (navy #1E2A38, green #27AE60, canvas #F3F5F7), green top bar, cards, status pills, result-card style, spacing, icons, and PASS logo placement. Do NOT restyle, redesign, or "improve" it.
- Only these changes are allowed:
  1. Fonts: keep Inter, but bundle it locally with @fontsource/inter (weights 400 to 700) and remove the Google Fonts @import. The app runs offline.
  2. Fix the Recent scans rows so the time and the status pill no longer overlap. Keep the same look, just without the overlap.
  3. Remove prototype-only items: the three "preview state" dots and the "Preview state 1 of 3" caption on the result card. Result states come from real scans.
  4. Recent scans lists only students actually scanned today. Remove the hardcoded status override, so each student has one consistent status everywhere.
  5. Move "Save settings" into the Attendance & scanning card, since it saves those settings.
  6. Disable "Print selected" and "Save as PDF" when 0 students are selected.
  7. Add aria-labels to icon-only buttons and a visible keyboard focus ring on inputs and buttons. Don't change how anything looks otherwise.
- Replace all hardcoded sample data with real data. Filipino-style names appear only in test fixtures, never in shipped UI.

KEEP THESE FILES CURRENT: SPEC.md (this whole brief including CREDIT RULES), PROGRESS.md (done / next / known issues), README.md (run, test, build), HARDWARE_TEST.md (checklist for me: webcam, Excel file lock, install on a clean Windows laptop).

PHASES
Phase 1: Scaffold the electron-vite project and move the zip UI in. Build the main-process services (db, import, scan logic, scan-log CSV, settings, PIN), the preload API, and vitest tests for the pure logic (late/present rule, cooldown, duplicates, column mapping, CSV append, Excel write). The UI may still show placeholder data.
Phase 2: Wire every screen to the real API, add camera + jsqr scanning, empty and error states, and apply the allowed UI changes above.
Phase 3: Update-class-record export, scan-log .xlsx export, QR generation and PDF sheet, backup and file-lock handling.
Phase 4: electron-builder config, a GitHub Actions workflow (windows-latest, upload .exe artifacts), app icon from the PASS logo, polish, a one-page teacher README, final tests.
Phase 5: DOCUMENTATION. Write the PRD and user guide from the actual project; anything specified but not implemented goes in “Not yet implemented”, and anything implemented differently goes in “Deviations from spec”. No GUI/screenshots; use bracketed placeholders in the guide and create a numbered SCREENSHOTS_TODO.md that matches every placeholder. Deliver `/docs/PASS_PRD.md` plus `/docs/PASS_PRD.docx`, `/docs/PASS_User_Guide.md` plus `/docs/PASS_User_Guide.docx`, and `/docs/SCREENSHOTS_TODO.md`.
  PRD sections: overview (PASS, version 1.0, purpose/problem); goals/non-goals/out of scope; users and needs; numbered flows; numbered FRs with priority/status/testable acceptance; NFRs (offline, scan feedback target, crash/power-loss data integrity, Windows support, accessibility, privacy/security, Philippine Data Privacy Act RA 10173 and school DPO review); screen inventory; architecture/data model/storage layout; risks/mitigations; assumptions/open questions/success targets; Phase 1–5 release plan and HARDWARE_TEST.md pointer; glossary; Not yet implemented; Deviations from spec.
  User guide: one-page Quick Start; what PASS requires; installer/portable install and unsigned SmartScreen guidance/uninstall/antivirus note; first launch/camera; spreadsheet preparation/import; QR creation/printing; attendance messages/cutoff/cooldown/manual entry; corrections/remarks/PIN; class workbook update/backup/locked-file handling; scan log/export; storage/backup/moving laptops; settings; troubleshooting table; FAQ; ICT/developer appendix with requirements, clone/run/test, GitHub Actions artifact build/download, version update.
  Use plain short sentences and numbered teacher steps. Do not invent functionality. Tables only for troubleshooting and requirement lists. Update PROGRESS.md, zip without node_modules, and stop.

Phase 6: RELEASE PACKAGE. Packaging only. Do not change/refactor/rename/move files inside the source project; build release folders from copies. Create `PASS_v<package-version>_Release/` with README_FIRST.txt, VERSION.txt, 01_Installer (README, empty installer slots, CHECKSUMS), 02_Documentation (PRD/User Guide Markdown and DOCX, screenshot checklist, HARDWARE_TEST), 03_Source_Code (full copy excluding node_modules, .git, dist, release, out, logs, local DB/class records; add scripts/assemble-release.mjs and an `assemble-release` npm script only in the copy), 04_UI_Reference (original App.tsx/index.css and PASS logo SVG/PNG if available), 05_Sample_Files (10-fictional-student XLSX, real-format sample CSV, optional GUI-free QR PDF), 06_Project_Records (SPEC, PROGRESS, KNOWN_ISSUES, CHANGELOG v1.0.0, LICENSE or all-rights-reserved notice). The no-dependency assembly script accepts an optional installer folder defaulting to `./release`, copies executables to 01_Installer, writes SHA-256 checksums, and creates sibling `PASS_v<version>_Release_Complete.zip` with `tar.exe -a -cf` on Windows or `zip` on Linux/macOS. It must clearly fail without making an incomplete zip if no `.exe` exists. Add the npm script in the copied project. Make README_FIRST index every folder, reader, and installation steps, and include exactly the requested four release-build steps: push to GitHub/wait for Actions; download artifacts into project release folder; run `npm run assemble-release`; share the Complete ZIP. Cheap checks: scan for node_modules/.git/dist/release/out, secrets/API keys/personal paths/real student data; verify every README_FIRST-mentioned file exists; test final ZIP and list two folder levels and size in PROGRESS; execute assembly against an empty folder and verify the clear no-installer message. Deliver the base release ZIP without installers and a source-project ZIP including the assembly script. Update PROGRESS and stop.

Phase 5B: MATCH THE UI TO THE DESIGN ZIP. Presentation only: adapt renderer markup/CSS/assets to the newly supplied owner-approved React/Tailwind design; preserve every existing data hook, IPC call, handler, and prop. Do not change main, preload, database, scan logic, CSV, Excel, or tests. Screens: Scan, Attendance, Students, Scan Log, QR Codes, Export, Settings, import wizard, edit dialog, first-launch empty state, top-bar class switcher. Match the ZIP layout, palette, cards, status pills, result card, icons, spacing, logo. Allowed deviations only: local Inter/no remote font, non-overlapping recent scans, remove preview dots/caption, recent scans only actual scans today with consistent status, Save settings inside Attendance & scanning card, disable QR output with zero selection, aria labels and focus rings. Preserve real API data and empty/error states. Copy design App.tsx/index.css/logo SVG/PNG into docs/ui-reference. Update PRD screen inventory and User Guide only where labels/buttons/layout changed; do not rewrite documents. Run existing Vitest, TypeScript and build; no test edits. Update progress, zip without node_modules, stop.

Phase 6 REFRESH: RELEASE PACKAGE REFRESH. Packaging only. Rebuild the v<package-version> release tree, documentation, source copy, UI reference, records, samples, and base/source archives from the current project; replace the previous release folder and archives. Reuse the existing no-dependency assembly script and copied-project npm script unless the script is missing or broken. Re-run empty-installer, README index, secrets/student-data, exclusion, and ZIP-integrity checks. No Windows executable build. Update PROGRESS.md and CHANGELOG.md, then stop.

RUN: Phase 6 REFRESH only.