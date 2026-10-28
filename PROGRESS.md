# Progress

## Done — Phase 1
- Created pinned Electron + electron-vite + React 19 + TypeScript + Tailwind 4 scaffold with bundled Inter fonts.
- Added SQL.js schema and atomic persistence in Electron `userData`; ExcelJS class import/column mapping; scan decisions/cooldown; CSV scan logging with fsync; settings and scrypt PIN services.
- Added typed contextBridge API and pure-logic Vitest tests.

## Done — Phase 2 (seven wired screens; owner-approved design migration completed in Phase 5B)
- Implemented seven screen areas: Scan, Attendance, Students, Scan Log, QR Codes, Export, and Settings.
- Wired class import, roster/attendance queries, manual edits/PIN, settings/class management, and read-only scan-log screen.
- Added webcam `getUserMedia` at 640×480 with jsqr scans around 8 fps, manual ID, Web Audio beep, and camera error states.
- Applied first-launch/empty/error states, focus rings, icon labels, non-overlapping recent rows, and current attendance statuses.

## Done — Phase 3
- Added ExcelJS class-record update by mapped Student ID, appending a date header and P/L/A status while copying adjacent formatting. Missing DB records export as Absent.
- Creates `<source-basename>.bak.xlsx` before the first write; writes temp workbook then renames. EBUSY/EPERM/EACCES file-lock errors tell the user to close Excel and retry.
- Added read-only date-range scan-log XLSX export.
- Added qrcode-generated `PASS|<studentId>` QR sheet with selection, native print dialog, and A4 PDF via `webContents.printToPDF`; no output with zero students selected.
- Connected Phase 3 commands through IPC/preload/UI.

## Done — Phase 4
- Added pinned electron-builder, Windows NSIS + portable x64 target config, `npm run dist:win`, Windows `windows-latest` GitHub Actions workflow, and uploaded `.exe` artifacts.
- Added local PASS wordmark ICO/PNG and teacher quick-start guide.
- Verification passed: `npm test`, `npm run build`, and `npx tsc --noEmit`.
- Final source ZIP created and integrity-checked without `node_modules`, build output, or release artifacts.

## Known issues / limits
- The owner-approved React/Vite design ZIP was supplied and migrated in Phase 5B. The prototype source and PASS logo exports are preserved in `docs/ui-reference/`.
- Per the project constraints, no Electron GUI, screenshots, browser, webcam, Excel lock, printing, or Windows installer execution was tested. The `.exe` files must be built on Windows via the workflow and checked on a clean Windows laptop using `HARDWARE_TEST.md`.
- npm reported dependency audit findings after pinned dependencies were installed (22 findings on the final install). No forced audit upgrades were applied to avoid unreviewed stack changes.

## Done — Phase 5 (documentation)
- Added `/docs/PASS_PRD.md` and `/docs/PASS_PRD.docx`, covering the requested requirements, architecture, risks, release plan, not-yet-implemented items, and deviations based on project files.
- Added `/docs/PASS_User_Guide.md` and `/docs/PASS_User_Guide.docx`, with teacher steps, troubleshooting, FAQs, installation caveats, and ICT appendix.
- Added `/docs/SCREENSHOTS_TODO.md` with 16 numbered capture tasks matching all guide placeholders in reading order.
- Verified both DOCX packages, section/table structure, and screenshot numbering. No GUI, browser, or screenshot testing was performed.
- Created the final source ZIP including documentation, excluding `node_modules`, `out`, `release`, and `.git`.

## Done — Phase 6 (release package)
- Staged `PASS_v0.1.0_Release/` entirely from copies; the original project source was not refactored or moved. Added the dependency-free `scripts/assemble-release.mjs` and `assemble-release` npm script only to the copied source project.
- Included documentation, testing checklist, project records, fictional 10-student XLSX/CSV/PDF samples, and a no-installer slot. Original UI ZIP/logo assets were unavailable; `04_UI_Reference` clearly labels current-app copies, and no original SVG logo is represented as supplied.
- Empty-folder assembly check passed: it exits nonzero with “No installer found” and creates no incomplete Complete ZIP. No Windows `.exe` was available or built; the base release ZIP intentionally has no installers, and the Complete ZIP is not generated until Actions artifacts are supplied.
- Checks passed: README index files exist; sample XLSX has 10 fictional records; CSV uses all eight scan-log headers; QR PDF was generated without GUI; source copy excludes dependency/build/local database/class-record files; credential-pattern and personal-path scans found no matches.
- Release folder top two levels:
  - `PASS_v0.1.0_Release/`: `README_FIRST.txt`, `VERSION.txt`, `01_Installer/`, `02_Documentation/`, `03_Source_Code/`, `04_UI_Reference/`, `05_Sample_Files/`, `06_Project_Records/`.
  - `02_Documentation/`: `PRD/`, `User_Guide/`, `Testing/`.
  - `03_Source_Code/`: `.github/`, `build/`, `docs/`, `scripts/`, `src/`, `tests/`, plus project root configuration/files.
  - `01_Installer/`: README and checksum placeholder only; no `.exe` files.
- Final archive sizes: release ZIP 458.9 KiB; source project ZIP 267.4 KiB.
- Both final ZIPs passed `unzip -t`; the base release contains zero `.exe` files and no Complete ZIP was generated.

## Done — Phase 5B (owner-approved renderer design)
- Adapted only the renderer presentation to the newly supplied seven-screen React/Tailwind design: navy sidebar, green top bar, PASS logo, cards, statuses, import wizard, edit dialog, first-launch state, and top-bar class switcher. Existing API data, state hooks, IPC calls, and action handlers were retained; main, preload, database, scan/CSV/Excel services, and tests were not changed.
- Used bundled `@fontsource/inter` (no remote font import in the shipped renderer), removed prototype result-state controls/caption, fixed recent-row layout, kept Recent scans to today’s actual scans with saved status, placed Save settings in Attendance & scanning, and disabled QR output when no students are selected. Added icon labels and visible keyboard focus.
- Copied the supplied prototype `App.tsx` and `index.css` byte-for-byte to `docs/ui-reference/`; exported the inline PASS logo as SVG and PNG there. Updated only the PRD screen inventory and affected User Guide labels/layout instructions, plus their DOCX counterparts.
- Verification passed after the final renderer change: Vitest 10/10, `npx tsc --noEmit`, and `npm run build`. No GUI, browser, camera, screenshot, or visual QA was run, per CREDIT RULES.
- Created `PASS_Phase5B.zip` without `node_modules`, Git metadata, `out`, or other generated build/release output; ZIP integrity verified.

## Done — Phase 6 REFRESH (2026-10-27)
- Restored the prior base release tree from its valid ZIP (the unpacked folder was absent), then refreshed it using current project files.
- Refreshed `02_Documentation/` and `03_Source_Code/` from the latest project; `04_UI_Reference/` contains the current `docs/ui-reference/App.tsx`, `index.css`, `PASS_logo.svg`, and `PASS_logo.png`.
- Reused the existing `scripts/assemble-release.mjs` recovered from the previous source-code ZIP; retained the no-dependency assembly script and `assemble-release` npm command only in the copied source project.
- Replaced sample XLSX/CSV/PDF with clearly fictional Demo Learner data matching the current import and scan-log formats. No real class roster is included.
- Empty-installer assembly test, README file-index check, secrets/student-data scan, source exclusion checks, and final ZIP integrity checks passed. No `.exe` was available or built; no Complete ZIP was generated.
- Release folder top two levels:
  - Root: `README_FIRST.txt`, `VERSION.txt`, `01_Installer/`, `02_Documentation/`, `03_Source_Code/`, `04_UI_Reference/`, `05_Sample_Files/`, `06_Project_Records/`.
  - `01_Installer/`: `README.txt`, `CHECKSUMS.txt` (no executables).
  - `02_Documentation/`: `PRD/`, `User_Guide/`, `Testing/`.
  - `03_Source_Code/`: current project root, including `src/`, `tests/`, `docs/`, `scripts/`, and root configuration.
  - `04_UI_Reference/`: `App.tsx`, `index.css`, `PASS_logo.svg`, `PASS_logo.png`, `README.txt`.
  - `05_Sample_Files/`: fictional class-record XLSX, scan-log CSV, and QR PDF.
  - `06_Project_Records/`: SPEC, PROGRESS, KNOWN_ISSUES, CHANGELOG, and LICENSE.' 
- Final archive sizes: release ZIP 462.8 KiB; source project ZIP 284.8 KiB.


## Done — Preload fix and Phase 6 REFRESH (2026-10-27)
- Corrected the BrowserWindow preload path to the emitted sandbox-compatible `index.cjs`; configured Electron Vite to build the preload as CommonJS while retaining `sandbox: true`.
- Confirmed the built `out/preload/index.cjs` matches the main-process path. TypeScript passed; Vitest passed 10/10; the 19 preload IPC channels matched all 19 main-process handlers.
- The one-time isolated Electron smoke test passed first launch, seven primary screen routes, 10-student API-backed roster, simulated camera QR decode, attendance edit, settings save, manual/duplicate/unknown scans, log display, QR selection guards, workbook update/backup, and class switcher refresh. Native file/save dialogs were not fully automated in Xvfb; Windows hardware/install testing remains outstanding.
- Refreshed the Phase 6 release folder and both archives from current source/docs/UI reference/project records; the source copy includes the corrected preload output contract and reuses the existing assembly script.
- The base release still has no Windows executable; no Complete ZIP was generated. The refreshed release is a single current package, but installation still requires a verified Windows Actions artifact.
- Release tree top two levels: root `README_FIRST.txt`, `VERSION.txt`, and `01_Installer/` through `06_Project_Records/`; source includes `src/`, `tests/`, `docs/`, `scripts/`, and root configuration; `04_UI_Reference/` includes the design App/CSS and PASS SVG/PNG; `05_Sample_Files/` contains synthetic DEMO-prefixed XLSX/CSV/PDF.
- Final archive sizes (rounded to nearest KiB): release ZIP 465 KiB; source project ZIP 286 KiB.
