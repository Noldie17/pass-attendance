# Changelog

## 0.2.3 — Scanner and notification fixes (2026-10-29)
- Fixed QR scans failing against existing databases that require a non-null attendance remark.
- Fixed continuously visible QR codes being held in cooldown indefinitely instead of retrying after the cooldown interval.
- Changed success notifications to appear as non-blocking toasts beneath the header without shifting the interface.

## 0.1.0 — Review patch (2026-10-28)
- Fixed: exporting the class record twice for the same date added a duplicate date column. It now updates the existing column for that date.
- Fixed: the Windows build failed with 'macro target is not defined'. Installer names are now set per target (PASS-Setup-<version>.exe and PASS-Portable-<version>.exe) instead of using an unsupported ${target} macro.
- Added regression tests (tests/export-workbook.test.ts). The suite now has 12 tests.

## 0.1.0 — 2026-10-27

### Phase 6 REFRESH
- Rebuilt the categorized release package and source-code archive from the current PASS project.
- Included the Phase 5B PRD/User Guide and the owner-approved UI reference files (App.tsx, index.css, PASS logo SVG/PNG).
- Reused the existing dependency-free release assembly script in the release source copy; no Windows installer executable is included in the base package.
- Refreshed the fictional sample workbook, scan-log CSV, and QR PDF for the 0.1.0 release.


### Phase 6 REFRESH — preload correction (2026-10-27)
- Fixed the BrowserWindow preload path/build mismatch by emitting sandbox-compatible CommonJS `index.cjs` and loading that exact filename.
- Rebuilt the base release and source-code archives from current project files, documentation, UI reference, records, and synthetic samples.
- Verified build, TypeScript, 10 Vitest tests, 19/19 IPC channel mappings, and an isolated Electron UI smoke run. Native OS file/save dialogs and Windows installation/hardware checks remain unverified; no `.exe` is included in the base package.
