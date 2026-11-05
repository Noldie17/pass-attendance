# PASS — Attendance Scanning System

Offline Windows desktop attendance system for Pantabangan National High School. The Electron main process owns the local database and file operations; the renderer uses a typed, restricted contextBridge API. Fonts and application assets are local.

## Teacher quick start

PASS imports DepEd SF2 class records from both legacy `.xls` and modern `.xlsx` files, creates stable learner IDs, and can print QR cards. It also retains a simple-table roster importer as a fallback. See [TEACHER_README.md](TEACHER_README.md) for the short workflow and [docs/PASS_User_Guide.md](docs/PASS_User_Guide.md) for SF2 import, roster sharing, legacy-file linking, and attendance export instructions. Student and attendance data stays local; roster share files contain student names and should be handled carefully.

## Development

Requirements: Node.js 22 LTS and npm.

```bash
npm ci
npm run dev
npm test
npx tsc --noEmit
npm run build
```

## Windows distribution

The Windows NSIS installer and portable executable are built on GitHub Actions (`windows-latest`) by pushing a `v*` tag or manually running the workflow. The workflow uploads `.exe` artifacts. Locally, on Windows only, run:

```bash
npm ci
npm run dist:win
```

Output is written to `release/`. Do not run Windows packaging in the Linux sandbox. Review `HARDWARE_TEST.md` on a clean Windows laptop before distributing the app.

## Scope notes

SF2 export scans every worksheet for SF2 records, then lets the teacher select a sheet and one of its school-day columns. A review step validates roster matches and warns before changes. Only absent active learners receive `x`; present and late learners remain blank, and a previous PASS `x` is cleared if the learner is now present or late. Monthly and summary totals are recalculated, and the workbook is verified from a temporary copy before replacement; a `.bak.xlsx` backup is kept. PASS never edits an `.xls` file; link the teacher's `.xlsx` Save As copy before exporting from a legacy source. Late attendance is counted as present in SF2 totals.
