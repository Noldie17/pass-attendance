# PASS — Attendance Scanning System

Offline Windows desktop attendance system for Pantabangan National High School. The Electron main process owns the local database and file operations; the renderer uses a typed, restricted contextBridge API. Fonts and application assets are local.

## Teacher quick start

See [TEACHER_README.md](TEACHER_README.md) for class import, scanning, manual attendance, and export instructions. The app stores its database under Electron `userData`; scan proof is appended to `Documents/PASS/<class>/scan-log.csv`.

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

Phase 3 implements class workbook update/backup/file-lock handling, scan-log XLSX export, and QR card print/PDF. The UI reference ZIP and original PASS logo were not supplied, so current branding uses the described palette and a locally generated PASS wordmark icon rather than an exact prototype migration. Windows packaging, printing, webcam behavior, and Excel file locks still require the documented hardware checks.
