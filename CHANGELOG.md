# Changelog

## 1.1.1 — GitHub release downloads
- Added a polished README with a prominent Windows downloads link, project overview, setup instructions, and privacy notes.
- Updated GitHub Actions to publish the versioned installer and portable executable as downloadable assets on tagged GitHub Releases while keeping the Actions artifact.
- Bumped the app version to 1.1.1; the existing remote `v1.1.0` tag is left unchanged.

## 1.1.0 — Multi-sheet exports and release packaging
- Updated the application/package version so Windows installer, portable executable, and Actions artifact names carry version `1.1.0`.
- Simplified the successful workbook-update notification and verified that sequential updates persist on separate monthly sheets without changing the other sheet.

## Unreleased — SF2 import, roster IDs, and attendance export
- Added a vendored SheetJS reader for `.xls` and `.xlsx` workbooks; import tests compare both anonymized SF2 fixtures and retain accented characters.
- Added SF2 worksheet detection by report month, teacher-selectable worksheets, a simple-table fallback with worksheet/header-row selection, and generated class IDs such as `10ICT-01`.
- Added conditional migrations for grade level, learner sex/activity, and linked `.xlsx` export paths; SF2 re-import keeps matched IDs and confirms before deactivating removed learners.
- Added `.passroster` import/export, active-only attendance and QR rosters, and case-insensitive trimmed scan-ID lookup.
- Added multi-sheet SF2 export with worksheet and school-day selection, preview validation, explicit warning confirmation, and protection against holiday or invalid-date updates.
- SF2 export reconciles each matched learner's selected day cell against saved attendance: learners without a saved record or marked absent get `x`; present and late learners are blank. This replaces pre-existing day marks that conflict with PASS attendance, while other sheets/cells remain untouched. Late counts as present.
- Added verified temporary-file writes, first-update `.bak.xlsx` backup preservation, and distinct scan-result sounds with test buttons in Settings.
- Updated export documentation and regression coverage for multi-sheet isolation and failed-write verification. The supplied local workbook could not be tested because `tests/fixtures/local/` was not present.
- Optional creation of a new SF2 workbook from PASS is not included.

## Unreleased — Responsive window and usability updates (2026-10-30)
- Made the app layout adapt to smaller window sizes, including compact navigation, responsive grids/forms, and viewport-fitting dialogs.
- Kept the camera and scan result side by side when there is enough room; stack them only on very narrow windows.
- Extended success notification display time to 5.5 seconds.
- Lowered the minimum Electron window size to 760×540 and added accessible names/tooltips to compact navigation buttons.
- Styled attendance/scan-log helper notes and constrained long workbook paths so they do not enlarge text or force horizontal scrolling.
- Verified the current source with `npm test` (14 tests), `npx tsc --noEmit`, and `npm run build`. The Windows installer still needs to be rebuilt and manually checked.

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
