<div align="center">

# PASS Attendance

### Every scan counts. Attendance made simple, secure, and offline.

Scan attendance and manage SF2 records offline.

[Download for Windows](https://github.com/Noldie17/pass-attendance/releases/latest) ·
[Teacher guide](docs/PASS_User_Guide.md) ·
[Report an issue](https://github.com/Noldie17/pass-attendance/issues)

![Build Windows installers](https://github.com/Noldie17/pass-attendance/actions/workflows/build-windows.yml/badge.svg)
![Latest release](https://img.shields.io/github/v/release/Noldie17/pass-attendance)

</div>

---

## About

PASS (PNHS Attendance Scanning System) is a local-first Windows desktop app for classroom attendance. It uses student QR cards, stores attendance on the computer, and works without a cloud account or network service.

> **Privacy:** Student rosters and attendance records contain sensitive information. PASS stores its database locally. Share exported roster/workbook files only through school-approved channels.

## Features

- Scan student QR cards or enter IDs manually; PASS cards use `PASS|<ID>` payloads.
- Import SF2 workbooks in legacy `.xls` and modern `.xlsx` formats.
- Generate stable learner IDs and print selected QR cards or save them as PDF.
- Review attendance, make manual corrections, and export a read-only scan log.
- Update a selected month and school day in multi-sheet SF2 `.xlsx` workbooks.
- Reconcile the selected SF2 day against PASS attendance: learners without a saved record or marked absent receive `x`; present and late learners remain blank.
- Keep a backup before the first workbook update. PASS does not edit legacy `.xls` files.

## Download and install

Go to **[GitHub Releases](https://github.com/Noldie17/pass-attendance/releases/latest)** and download either:

| File | Use |
|---|---|
| `PASS-Setup-<version>.exe` | Install PASS on Windows; creates Start menu and optional desktop shortcuts. |
| `PASS-Portable-<version>.exe` | Run PASS without installing it. |

The latest release page contains the Windows executables attached by GitHub Actions. Windows may show a SmartScreen warning because the app is not code-signed. Install or run it only if you trust the source; do not disable antivirus or Windows security.

## Build and download with GitHub Actions

Every push to `main` builds the Windows installer and portable executable and uploads them as a temporary Actions artifact. To create permanent downloadable files on the Releases page, push a version tag matching `package.json` (currently `v1.1.3`). The workflow attaches both `.exe` files to the GitHub Release and retains the Actions artifact. Follow progress under **Actions → Build Windows installers**.

## Development

Requirements: Node.js 22 LTS and npm.

```powershell
npm ci
npm run dev
npm test
npx tsc --noEmit
npm run build
```

To package locally on Windows:

```powershell
npm ci
npm run dist:win
```

The installer and portable executable are written to `release/`.

## Project documentation

- [Teacher quick start](TEACHER_README.md)
- [Full teacher user guide](docs/PASS_User_Guide.md)
- [Product requirements](docs/PASS_PRD.md)
- [Hardware and release checklist](HARDWARE_TEST.md)
- [Changelog](CHANGELOG.md)

## Technology

Electron 35 · React 19 · TypeScript · electron-vite · Tailwind CSS 4 · SQL.js · ExcelJS · SheetJS · jsQR

---

Built for Pantabangan National High School. This is a school project; review and test the app against school procedures before operational use.
