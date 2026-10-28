# PASS — Product Requirements Document

**Document version:** 1.0  
**Product:** PASS — PNHS Attendance Scanning System  
**Current package version in `package.json`:** 0.1.0  
**Status:** Requirements and implementation summary; Windows acceptance testing is pending.

## 1. Overview

PASS is an offline Windows desktop attendance system for Pantabangan National High School. A classroom teacher selects a class and scans a student’s ID QR code with a laptop webcam. PASS records the first attendance result for that student on the selected local date, or the teacher can enter an ID manually.

The product addresses slow, error-prone manual roll call and the lack of a scan-attempt record that can help explain what happened during attendance. An append-only CSV log records scan attempts, including duplicate and unknown IDs. PASS keeps its database on the local computer and does not provide cloud synchronization.

This document is version 1.0 as requested for the Phase 5 documentation deliverable. The application package metadata still reports version 0.1.0; it is not evidence that a 1.0 application release has been built or accepted.

## 2. Goals, non-goals, and out of scope

### Goals

- Import students from a teacher-selected `.xlsx` class record.
- Record daily Present or Late results from QR scans, with Absent shown for students without a record.
- Retain scan-attempt proof in an append-only local CSV file.
- Let authorized teachers review attendance and make manual corrections, optionally protected by a PIN.
- Export attendance back to the source workbook and export scan-log data.
- Generate, print, or save selected student QR codes as a PDF.
- Run locally without a network service or account.

### Non-goals and out of scope

- Signed or HMAC-protected QR codes. Current QR payloads contain a student ID and are not cryptographically authenticated.
- Cloud storage, synchronization, accounts, multi-computer collaboration, or conflict resolution.
- Student or parent mobile applications, notifications, biometrics, or remote attendance monitoring.
- Replacing the school’s official student information system or establishing legal retention policy.
- Guaranteeing recovery from every hardware failure or power-loss scenario. Atomic file handling reduces risk but does not replace backups or acceptance testing.
- Exact migration of the supplied prototype design. The referenced UI ZIP and original PASS logo were not available in the project files; the present UI is based on the written palette and product brief.

## 3. Users and needs

**Classroom teacher — primary user.** Needs to import a roster, take attendance quickly, handle damaged or forgotten cards, correct a record, and produce a school workbook or scan-log export without depending on internet access.

**School head or ICT coordinator — secondary user.** Needs a repeatable installation, a clear record location, a basic manual test checklist, and a way to distribute Windows builds. The coordinator also needs to review the school’s data-protection and retention practices.

**Student — indirect user.** Needs a legible ID QR code that can be scanned reliably. Students do not sign in to PASS and do not have an app in the current scope.

## 4. Key user flows

### 4.1 First launch and class import

1. The teacher starts PASS. With no imported class, PASS shows a first-launch empty state.
2. The teacher chooses **Import a class** and selects an `.xlsx` file.
3. PASS reads the first worksheet and shows column names and up to five preview rows.
4. The teacher maps Student ID and Name, enters class details, and imports.
5. PASS rejects empty or duplicate IDs with an error. It stores the class, students, source path, and mapping locally.

### 4.2 Print QR codes

1. The teacher selects a class and opens **QR Codes**.
2. The teacher selects all students or individual students.
3. The teacher chooses **Print selected** or **Save as PDF**.
4. PASS generates `PASS|<studentId>` QR payloads and opens the system print dialog or saves an A4 PDF.

### 4.3 Scan attendance

1. The teacher selects a class and opens **Scan**.
2. PASS requests camera access and processes 640×480 frames at approximately eight frames per second.
3. The teacher holds a student QR code in the camera frame, or enters a student ID manually.
4. For the first record of the local day, PASS stores Present at or before the configured cutoff and Late after it.
5. PASS shows a result and, if enabled, plays a short Web Audio tone.

### 4.4 Duplicate or unknown ID

1. If the student already has a record for that date, PASS leaves it unchanged and displays “Already recorded at HH:MM” when a time is available.
2. If the ID is unknown in the active class, PASS shows “ID not in this class”.
3. If the same QR is submitted again inside the cooldown, the renderer displays no new result. The attempt is logged as `ignored-cooldown`.

### 4.5 Manual attendance correction

1. The teacher opens **Attendance**, selects a date, and finds a student using search or filter chips.
2. The teacher opens **Edit**, selects Present, Late, or Absent, and may enter a remark.
3. If PIN protection is enabled, the teacher enters the PIN.
4. PASS stores the manual record and refreshes the attendance list.

### 4.6 Update class record

1. The teacher opens **Export** and selects the date in the page date control.
2. The teacher closes the original workbook in Excel.
3. PASS creates a sibling `.bak.xlsx` backup if it does not already exist, adds a date column after the last used column, and writes P/L/A values by Student ID.
4. If the source is locked, PASS reports “Close the file in Excel, then try again”. The workbook update is not completed; the original remains the source of truth.

### 4.7 Export scan log

1. The teacher opens **Scan Log** and selects a start and end date.
2. The teacher chooses **Export .xlsx** and selects a save location in the system dialog.
3. PASS writes the date-filtered CSV rows to an Excel workbook. The in-app log view itself has no edit or delete controls.

## 5. Functional requirements

Status describes the code observed in the project, not a completed school acceptance test. Hardware, print, and Excel-lock behavior remain unverified.

| ID | Requirement | Priority | Status | Testable acceptance criterion |
|---|---|---|---|---|
| FR-01 | Show a first-launch state and support multiple imported classes with a class switcher. | Must | Implemented | With no classes, launch shows the empty state; after importing two classes, both appear in the switcher and changing the selection loads that class. |
| FR-02 | Import the first worksheet of an `.xlsx`, preview five rows, map Student ID and Name, remember mappings, and reject empty or duplicate IDs. | Must | Implemented | Import a valid test workbook and verify the selected columns and five-row preview; blank and duplicate IDs return clear errors and do not create the class. |
| FR-03 | Scan `PASS|<studentId>` and bare IDs; first scan saves Present/Late using the cutoff; existing records remain unchanged; unknown IDs show an error. | Must | Partial | In a Windows camera test, scan a valid QR before/after cutoff, rescan the same ID, then scan an unknown ID; verify each visible message and stored result. |
| FR-04 | Ignore the same QR during the configured cooldown and append every submitted scan attempt to an fsync’d CSV log. | Must | Implemented | Submit a valid scan, a cooldown repeat, a later duplicate, and an unknown ID; verify four corresponding append-only CSV rows with the required columns. |
| FR-05 | Show recent scans from today only and use a consistent current attendance status. | Should | Implemented | Scan a known student today and verify that the row appears with today’s attendance status; a student with no scan does not appear. |
| FR-06 | Show attendance by date, support search/filter, display no-record students as Absent on screen only, and allow manual P/L/A plus remark. | Must | Implemented | Select a date with one unrecorded student; verify Absent with “no record”; manually save another status and remark and verify the saved view. |
| FR-07 | Optionally require a PIN for manual attendance changes and store the PIN using scrypt. | Should | Partial | Enable a 4–12 digit PIN; verify a wrong PIN rejects a manual edit and the correct PIN allows it. Verify security review of PIN disable/reset separately. |
| FR-08 | Configure late cutoff, cooldown, sound, default camera, PIN, and class rename/delete. | Must | Partial | Save supported settings and verify persistence after restart; rename a class and verify display; confirm deletion removes the class and its attendance after confirmation. Historical scan-log folder behavior needs improvement. |
| FR-09 | Explain camera-not-found, permission-blocked, and camera-in-use failures; retain manual entry. | Must | Partial | On Windows, test no camera, denied permission, and a camera held by another app; each state must explain the issue while manual entry remains usable. |
| FR-10 | Update the original workbook with a date column, matching by ID, a pre-write backup, and a clear locked-file message. | Must | Partial | On a representative workbook, verify the new column, status mapping, backup, formatting, and that a locked file produces the exact guidance without changing the source. |
| FR-11 | Read the append-only CSV and export a selected date range to `.xlsx`. | Must | Implemented | Export a date range and verify only rows in that range appear with the eight required headers; the CSV must remain unchanged. |
| FR-12 | Generate QR cards for selected students; print or save an A4 PDF; disable output with zero selected. | Must | Implemented | Select zero students and verify both output actions are disabled; select multiple students and verify IDs, names, and QR payloads in print/PDF output. |
| FR-13 | Build Windows NSIS and portable packages on `windows-latest` and upload `.exe` artifacts. | Must | Partial | Run the GitHub Actions workflow on Windows; verify both `.exe` files are uploaded and install/launch on a clean Windows laptop. |
| FR-14 | Provide a teacher guide and numbered screenshot capture checklist. | Should | Implemented | Verify each bracketed guide screenshot number has exactly one entry in `SCREENSHOTS_TODO.md`; review instructions against the actual app. |

## 6. Non-functional requirements

**Offline operation.** The application uses local assets and does not require a runtime account or server. The renderer CSP disallows network connections, and navigation/popups are blocked. Offline behavior has not been exercised on a Windows laptop.

**Scan feedback target.** Proposed target: visible result within one second after a QR is decoded under normal single-user conditions. The camera loop samples at about eight frames per second. This latency target has not been measured.

**Data integrity.** SQL.js saves a temporary database file, calls `fsync`, then renames it after writes. The CSV log is append-only and calls `fsync`. These mechanisms reduce partial-write risk, but directory metadata is not explicitly synced and no method can guarantee survival of every power loss or storage-device failure. Keep independent backups.

**Windows support.** The project config targets x64 Windows NSIS and portable builds. Windows 10/11 installation, camera permission, printing, SmartScreen, and Excel-lock behavior remain pending the manual checklist.

**Accessibility.** The UI includes labels for icon-only buttons and visible keyboard focus styling. Screen-reader and keyboard-only acceptance testing has not been completed.

**Privacy and security.** The database and CSV remain on the computer and are not encrypted by PASS. The optional scrypt PIN protects manual attendance edits; it does not encrypt files or lock the entire app. QR payloads are unsigned and can be copied. The school should handle student records in line with the Philippine Data Privacy Act of 2012 (RA 10173) and its own policy. The school’s Data Protection Officer should review data collection, access, retention, and backup practices before deployment. This document is not legal advice.

## 7. Screen inventory

**Common shell and first launch.** Navy left navigation, green top bar with the PASS logo and a Current class switcher, offline indicator, and a “No class yet” first-launch empty state with an Import your class record action.

**Scan.** Scan attendance page with live camera and camera-error status, Manual entry control, current scan result card, four attendance summary cards, and Recent scans limited to students actually scanned today with their saved attendance status.

**Attendance.** Date selection, Present/Late/Absent/All filters, search, summary cards, and a student table showing ID, name, status, time, and Edit action. Students without a stored row display Absent on screen only.

**Students.** Searchable imported roster with ID/name and a QR codes action that opens the QR Codes screen, plus Import class.

**Scan Log.** Read-only, date-range-filtered scan attempts with ID, name, date, time, source, and result; the page heading provides Export log (.xlsx).

**QR Codes.** Select-all/per-student selection cards, Generate all, Print selected, and Save as PDF. Print and PDF controls are disabled when no students are selected.

**Export.** Two-card layout: Update class record (.xlsx), with the date, source workbook and attendance counts, and Export scan log (.xlsx), with a date range.

**Settings.** Attendance & scanning and Class management cards. Save settings is inside Attendance & scanning with cutoff, cooldown, sound, default camera and PIN lock; Class management lists classes with edit/delete actions and active-class details.

## 8. Technical architecture

**Stack.** Electron 35.1.5, electron-vite 3.0.0, React 19.0.0, TypeScript 5.8.2, Tailwind 4.0.9, SQL.js 1.13.0, ExcelJS 4.4.0, jsqr 1.4.0, qrcode 1.5.4, `@fontsource/inter` 5.2.5, Vitest 3.0.8, and electron-builder 26.0.12. Dependency versions are pinned in `package.json`.

**Process model.** The Electron main process owns the SQL.js database, filesystem, ExcelJS, settings, scan logging, and export operations. The preload exposes a typed `contextBridge` API that invokes named IPC handlers. The renderer uses React and cannot access Node APIs directly; `contextIsolation` is enabled and `nodeIntegration` is disabled. Only the `media` permission is granted for camera access. The renderer CSP includes `style-src 'unsafe-inline'` in addition to local sources; this is narrower than enabling inline scripts but is not a fully nonce/hash-only CSP.

**Data model.** `classes` stores class metadata, source workbook path, and column mapping. `students` stores class-scoped student IDs and names with a unique `(class_id, student_id)` constraint. `attendance` uses `(class_id, student_id, date)` as its primary key and stores status, time, source, and remark. `settings` stores key/value settings, including the optional PIN hash.

**Local files.** The database is `pass.sqlite` under `app.getPath('userData')` (on Windows, normally below the current Windows user’s AppData/Roaming application folder). Scan proof is `Documents\PASS\<sanitized-class-name>\scan-log.csv`. Updating a source workbook creates `<source-basename>.bak.xlsx` beside that workbook on the first update. Scan-log XLSX and QR PDF destinations are selected through save dialogs; the PDF dialog starts in `Documents\PASS`.

## 9. Risks and mitigations

**Unsigned installer and SmartScreen.** No code-signing certificate is configured. Windows may warn that the app is unrecognized. Distribute only through a trusted school channel, have ICT verify the release, and do not disable antivirus.

**Excel file lock.** Excel can hold the source workbook open. Close it before updating. PASS catches common lock/access error codes and asks the teacher to retry. This has not been hardware-tested.

**Unusual workbook layouts.** Import uses the first worksheet, row 1 as the header row, and teacher-selected columns. The workbook update assumes the saved ID-column mapping remains correct. Merged or irregular layouts and unmatched IDs require manual review.

**Webcam and lighting.** Low light, glare, focus, camera quality, distance, and print quality can prevent decoding. Keep the code flat, well lit, and fully in frame. Manual ID entry is a fallback.

**Printed card quality and lost IDs.** A damaged or lost card can be handled by manual ID entry if the teacher has the correct ID. Reprint QR cards from the class roster.

**Local data loss or exposure.** Device failure, profile deletion, or unauthorized access can affect unencrypted local records. Follow school backup and access policies; copy both the user-data folder and Documents PASS folder while PASS is closed.

## 10. Assumptions, open questions, and success metrics

**Assumptions.** Each class workbook has a usable first worksheet with one header row and stable Student ID values. A teacher has permission to process the roster. A class is normally operated by one teacher on one local Windows profile. The source workbook remains available at its saved path for updates.

**Open questions.** Who owns PIN administration and reset? What is the school’s retention schedule? Where should backups be stored and who may access them? Does ICT require a signed installer? What student-ID formats and workbook variations must be supported? How should historical scan logs be handled after a class rename?

**Proposed success targets, not measured results.** At least 95% of valid QR scans should produce visible feedback within one second in normal classroom lighting. A duplicate scan must not change the saved daily attendance. Every submitted scan attempt must appear in the CSV. On representative workbooks, every roster ID should be matched or reported for review. A clean Windows installation and the full `HARDWARE_TEST.md` checklist should pass before school-wide release.

## 11. Release plan

**Phase 1 — foundation.** Electron/electron-vite scaffold, database, import, scan rules, CSV log, settings/PIN, preload API, pure-logic tests. Recorded complete in `PROGRESS.md`.

**Phase 2 — app wiring.** Seven screen areas, real data APIs, camera/jsqr, empty/error states, and usability/accessibility basics. Recorded complete, but exact visual migration is blocked by the missing UI ZIP.

**Phase 3 — exports.** Workbook update and backup, file-lock messaging, scan-log XLSX export, QR generation, print and PDF. Implemented in code; Windows behavior awaits acceptance testing.

**Phase 4 — packaging.** electron-builder Windows NSIS/portable config, Windows Actions workflow, icon, and quick-start. Configuration exists. `.exe` artifacts have not been built or validated in this sandbox.

**Phase 5 — documentation.** This PRD, teacher guide, and screenshot capture list. Use `HARDWARE_TEST.md` as the manual acceptance checklist before release.

## 12. Glossary

**Attendance record:** One status for one student, class, and local date.

**Cooldown:** The configured interval in which a repeated QR submission is ignored.

**Source workbook:** The original `.xlsx` file selected during class import.

**Scan log:** Append-only CSV proof of submitted webcam or manual scan attempts.

**Student ID:** The class-scoped identifier placed in a QR payload after `PASS|`.

**User data directory:** Electron-managed local folder containing `pass.sqlite`.

## 13. Not yet implemented

- Signed/HMAC QR payloads; explicitly out of scope.
- Exact migration of the absent UI prototype ZIP and original logo asset.
- Built, signed, and clean-Windows-tested NSIS/portable `.exe` artifacts. The workflow is configured but has not been run here.
- Hardware acceptance of camera permissions/errors, scan latency, printing/PDF layout, Excel locking, installer, and uninstall/data-retention behavior.
- In-app relinking of the original workbook after moving a class to a different computer or path.
- Screen-reader and full keyboard-accessibility acceptance testing.
- Automated integration tests for database/filesystem export services; the present Vitest suite is for pure logic and CSV parsing.
- User accounts, cloud sync, multi-teacher synchronization, student/parent apps, and data encryption at rest.

## 14. Deviations from spec

- The ZIP UI reference was not supplied. The current screen design uses the written navy/green/canvas colors and a locally generated PASS wordmark icon, not the original seven-screen layout/components/logo.
- Product documentation is labeled version 1.0 per request, while the application’s `package.json` version is 0.1.0.
- The renderer CSP allows inline styles (`style-src 'unsafe-inline'`); it blocks remote connections and inline scripts, but does not use nonce/hash-only style policy.
- Class scan logs are stored in folders named from the class name. Renaming a class does not migrate old CSV files; the Scan Log screen reads the current name’s folder, so historical logs under the old name may no longer appear there.
- Repeated Update class record actions append another column for the selected date rather than detecting an existing date header. The new-cell styling copies the adjacent last-used cell’s style; complete layout preservation for unusual workbooks is not verified.
- PIN protection is enforced for manual attendance edits, but turning off an enabled PIN does not ask for the current PIN.
- The request’s no-GUI constraint means the documented Windows and print workflows are not verified results. They remain acceptance targets, not measured outcomes.
