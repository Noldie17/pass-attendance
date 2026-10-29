# PASS — Teacher User Guide

**Guide version:** 1.0  
**Application package version:** 0.2.3

## 0. Quick Start

1. Install PASS Attendance or open the portable `.exe` supplied by your school’s ICT coordinator. You should see the PASS Attendance window or Windows may first show a SmartScreen warning.
2. Choose **Import class**, select the `.xlsx` file, map Student ID and Name, and enter the class details. You should see a five-row preview before you import.
3. Open **QR Codes**, select the students, and choose **Print selected** or **Save as PDF**. You should see the print dialog or a PDF save dialog.
4. Open **Scan**, allow camera access, and hold a student QR code in the frame. You should see the student name and Present or Late result; manual ID entry is available below the camera.

## 1. What PASS is and what you need

PASS records attendance locally on a Windows laptop. It does not need internet for normal use. The current project targets Windows 10 and 11 x64; clean installation has not yet been verified.

You need a class `.xlsx` file, a webcam, and printed QR ID cards. Excel is only needed to open or edit the spreadsheet files. PASS can enter an ID manually if a card is damaged or the camera cannot be used.

## 2. Installing PASS

The school’s ICT coordinator should provide the NSIS installer or portable executable from a trusted school location. The GitHub Actions workflow is configured to produce both builds, but the project has not yet published or tested an installer.

### 2.1 Installer version

1. Double-click the `PASS-...-nsis.exe` file provided by ICT. You should see the Windows installer.
2. Follow the installer prompts and choose the install folder if asked. You should see the installation finish message.
3. Start **PASS Attendance** from the Start menu or desktop shortcut. You should see the PASS window.
4. To uninstall, open **Windows Settings → Apps → Installed apps**, choose **PASS Attendance**, then choose **Uninstall**. You should see Windows confirm or complete the removal.

### 2.2 Portable version

1. Copy the portable `PASS-...-portable.exe` to a folder you control. You should see the executable in File Explorer.
2. Double-click it to start PASS. You should see the same application window as the installed version.
3. To remove the portable app, close PASS and delete the executable. Your attendance database and scan-log folder are separate and are not removed by deleting the portable file.

### 2.3 Windows SmartScreen and antivirus

The application is not code-signed in the current project configuration. Windows SmartScreen may show “Windows protected your PC” or an unrecognized-app warning. This warning indicates that Windows cannot verify a publisher; it does not prove the file is safe or unsafe.

1. Continue only if ICT gave you the file through a trusted school channel and confirmed the release. You should see the SmartScreen warning for an unrecognized app.
2. If ICT confirms the file, choose **More info**, check the displayed app name, then choose **Run anyway**. You should see the installer or PASS start.
3. Do not disable antivirus or Windows security. If antivirus blocks the file, stop and ask ICT to verify it. You should see no request to turn off protection.

## 3. First launch and camera access

1. Start PASS. If no class has been imported, you should see **No class yet** and **Import your class record**. [Screenshot 01: PASS first-launch empty state]
2. Choose **Import your class record** and select an `.xlsx` file. The wizard shows **Upload file**, **Map columns**, and **Confirm**. [Screenshot 02: Import wizard with five preview rows]
3. Complete the import before scanning. You should see the new class in the **Current class** switcher in the green top bar.
4. Open **Scan** and allow Windows camera access if prompted. You should see the **Scan attendance** page, a live camera image, and a “Camera ready” message.
5. If the permission prompt was denied, check Windows **Settings → Privacy & security → Camera** and allow desktop apps to use the camera. Back in PASS, you should see the camera status change after reopening the Scan screen. [Screenshot 03: Scan screen with camera permission blocked]
6. If a camera cannot start, choose **Manual entry** to focus the ID field below the camera. You can still type the ID and choose **Record** while you troubleshoot.
## 4. Prepare and import your class record

Use an `.xlsx` file with one header row. Keep Student ID and Name in separate columns. Avoid merged cells. Remove duplicate IDs. Check that IDs are stored as the values you intend to scan; numeric cells with leading zeros may not retain those zeros in Excel.

1. Start an import from **+ New class** in the Current class switcher or from **Import class** on Students. On first launch, choose **Import your class record**. You should see the Import class wizard.
2. Choose the workbook in **Upload file**, then continue to **Map columns**. You should see the first worksheet name and up to five preview rows.
3. Choose the Student ID column and Name column. You should see those columns selected in the mapping controls.
4. Continue to **Confirm**. Enter the class name, section, subject, and school year in the class details. You should see all four fields filled in.
5. Choose **Import students**. If the import succeeds, you should see the class active and the roster available. If an ID is empty or duplicated, you should see a message identifying the problem; correct the workbook and import again.

## 5. Create and print student QR codes

1. Select the class and open **QR Codes**. You should see the imported student roster.
2. Choose **Generate all** or **Select all** to select the roster, or select individual students. You should see the selected count change.
3. Choose **Print selected** to print, or **Save as PDF** to save a file. Both controls are disabled when zero students are selected. You should see a system print dialog or a PDF save dialog after choosing an enabled action. [Screenshot 04: QR Codes screen with students selected]
4. For a PDF, choose a save location and file name. You should see the saved PDF in that location. It contains a grid of student cards and QR payloads in the form `PASS|<studentId>`. [Screenshot 05: Example QR PDF sheet with fictional or redacted student data]
5. Print a test page first. You should see the printed codes clearly separated. Scan a test card before making a full set.

## 6. Take attendance

1. Select a class from **Current class** in the green top bar and open **Scan**. You should see the Scan attendance heading, camera frame, result card, summary cards, and recent scans for today. [Screenshot 06: Scan screen ready with camera status]
2. Hold one QR code flat in the camera frame with good light. You should see a result card with the student name and **Present** or **Late**. If sound is enabled, you should hear a short tone. [Screenshot 07: Scan screen showing a successful Present result]
3. The default late cutoff is 07:45. A first scan after the configured cutoff is recorded Late. A scan at or before the cutoff is Present. You should see the corresponding status pill.
4. If that student already has a saved record for the date, PASS does not overwrite it. You should see **Already recorded at HH:MM** when a scan time is stored. [Screenshot 08: Scan screen showing an already-recorded result]
5. If the ID is not in the active class, you should see **ID not in this class**. Check the selected class and roster. [Screenshot 09: Scan screen showing an unknown-ID result]
6. The default cooldown is five seconds. A repeat inside the cooldown is ignored silently by the result card but remains in the CSV scan log. After the cooldown, another scan of a student already recorded that day shows the duplicate message.
7. If a card is damaged, choose **Manual entry**, type the student ID in the field below the camera, then choose **Record**. You should see the same attendance result as a QR scan. [Screenshot 10: Scan screen showing a Late result]

## 7. View and correct attendance

1. Open **Attendance** and choose a date. You should see summary cards, filters, search, and a roster with student ID, name, status, time, and Edit action. [Screenshot 11: Attendance screen with status filters and an unrecorded student]
2. Use the filter chips or search field. You should see only matching rows.
3. Students with no saved record appear as Absent with a “no record” note. This display alone does not save an Absent row.
4. Choose **Edit** beside a student. You should see the edit dialog with Present, Late, and Absent choices.
5. Select a status and optionally enter a remark. If PIN lock is enabled, enter the PIN. You should see the PIN field in the dialog. [Screenshot 12: Manual attendance dialog with remark and PIN field]
6. Choose **Save changes**. You should see the attendance list refresh with the saved value. If the PIN is wrong, you should see an error and the change should not be saved.

## 8. Update your class record file

1. Open **Export**. In the **Update class record (.xlsx)** card, set the Attendance date. You should see the selected date’s student and status counts alongside the source workbook details.
2. Confirm that the displayed source workbook is the correct file. You should see its file name. If it says no source workbook is linked, Update class record is unavailable.
3. Close the workbook in Excel and other spreadsheet programs. You should see no open Excel window using that file.
4. Choose **Update & save file**. PASS adds a new column after the last used worksheet column. Its header looks like `Oct 23`, based on the selected date. It writes P, L, or A by matching Student ID. A student without a stored attendance row is written as A.
5. Before the first successful update, PASS creates a sibling backup named `<source-basename>.bak.xlsx`. You should see a success notification with the added header, matched-student count, and backup path. [Screenshot 13: Export screen after a successful class-record update]
6. If Excel has the file locked, you should see **Close the file in Excel, then try again**. Close Excel and retry. [Screenshot 14: Export screen showing the locked-workbook message]
7. The database remains the source of truth. Repeating an update for the same date currently adds another column; check the workbook before repeating an update.

## 9. Scan log and export

1. Open **Scan Log**. You should see submitted scans in a read-only list on the **Scan log** page. Successful scans, later duplicates, unknown IDs, and cooldown-ignored attempts are logged.
2. Set the From and To dates. You should see the rows for that date range.
3. Choose **Export log (.xlsx)** on Scan Log, or **Export scan log** in the Export screen, and choose a destination in the save dialog. You should see an Excel file at the chosen location. The CSV remains append-only and cannot be edited or deleted from the app. [Screenshot 15: Scan Log with a date range and export control]
4. The CSV is stored at `Documents\PASS\<class>\scan-log.csv`. The folder name is based on the class name. If the class is renamed, older log files stay in the former folder and may no longer appear in the Scan Log screen; export important logs before renaming.

## 10. File locations, backups, and moving to another laptop

The database file is `pass.sqlite` inside Electron’s `userData` folder. On Windows, this is normally under the current Windows user’s AppData/Roaming application folder. The scan log is under `Documents\PASS\<class>\scan-log.csv`. The source `.xlsx` stays wherever you originally selected it. Updated workbooks have a sibling `.bak.xlsx` backup.

1. Close PASS before making a backup. You should see the PASS window close before you copy files.
2. Copy the complete PASS user-data folder and the `Documents\PASS` folder to approved backup storage. You should see both folders in the backup location.
3. To move to another laptop, install the same PASS build, close it, and restore the user-data folder to that installation’s matching `userData` location. Restore `Documents\PASS` as well. You should see your classes and scan logs after starting PASS.
4. The saved workbook path is absolute. If the source workbook is not at that path on the new laptop, the Update class record action may fail. The current app has no in-app relink control. Ask ICT to preserve the path or arrange a supported move before updating the workbook.
5. Protect backups because the database and CSV contain student information and are not encrypted by PASS. You should see the backup stored only in an approved location with access limited by school policy.

## 11. Settings

1. Open **Settings**. You should see the **Attendance & scanning** and **Class management** cards. PIN lock is part of Attendance & scanning.
2. Set the Late cutoff and cooldown seconds. Cooldown accepts whole numbers from 0 through 3600. Choose **Save settings** inside Attendance & scanning. You should see the saved values remain.
3. Set the default camera from the available camera list. You may need to open Scan once for camera names to be available. You should see the selected device name in the list.
4. Turn scan sound on or off. You should hear a short beep after a successful scan only when sound is enabled.
5. To enable a PIN, enter four to twelve digits in the PIN lock field and turn on its toggle. Manual attendance edits should then require the PIN. Turning off the PIN currently does not ask for the existing PIN; keep the app on a trusted Windows account.
6. In Class management, choose the edit icon for the active class, edit its name, section, subject, or school year, then choose **Save class details**. You should see the updated class details in the app.
7. Choose **Delete class** only when intended. You should see a confirmation before the class and its database attendance records are deleted. Scan-log CSV files are separate files in Documents PASS. [Screenshot 16: Settings screen showing cutoff, cooldown, sound, and camera controls]

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Camera not found | No camera is connected, or Windows does not expose it. | Connect a webcam, check Windows Camera settings, then reopen Scan. Use manual ID entry while unavailable. |
| Camera permission blocked | Camera permission was denied or desktop-app access is off. | Open Windows Settings → Privacy & security → Camera and allow desktop apps. Reopen Scan. |
| Camera is in use | Another app has the camera open. | Close the other camera app and try again. |
| QR will not read | Glare, low light, motion, distance, focus, or low print quality. | Flatten the card, improve light, avoid reflections, hold it still, and move it into the camera frame. Try manual ID entry. |
| “ID not in this class” | Wrong class selected or the ID is absent/mismatched in the roster. | Check the class switcher and Students screen. Confirm the ID spelling in the original workbook. |
| Import error | Wrong sheet/column mapping, empty ID/name, duplicate ID, or unsupported workbook. | Use the first worksheet with a header row, map the correct columns, correct empty/duplicate values, and import again. |
| Workbook is locked | Excel or another program has the source workbook open. | Close the workbook in all programs and choose Update class record again. |
| SmartScreen warns about the app | The build is not code-signed or not yet recognized by Windows. | Continue only after ICT verifies the file and source. Choose More info → Run anyway only for that trusted build. Never disable antivirus. |
| PASS will not open | Windows blocked the file, installation is incomplete, or the build is damaged. | Do not bypass security tools. Ask ICT to verify the build and reinstall from the trusted school source. |
| Old scan log is missing after rename | Log folder names follow the class name; rename does not move old CSV files. | Look for the old folder name under `Documents\PASS`. Export/copy the log before renaming next time. |

## 13. Frequently asked questions

**Does PASS need internet?** No runtime internet service is required by the design. The current build still needs Windows acceptance testing while offline.

**Can several teachers use it?** PASS has no teacher accounts or synchronization. Data is stored in the current Windows user’s local profile. Teachers on separate computers do not share records automatically.

**What if a student forgets the ID?** If the teacher can confirm the student’s correct ID, enter it manually on Scan. The result should appear like a scanned attendance result.

**What if the power goes out?** Database writes use a temporary file, `fsync`, and rename; scan-log appends use `fsync`. These steps reduce risk but cannot guarantee every power-loss case. Restore from your approved backup if needed and ask ICT before editing files manually.

**Can I edit the scan log?** No. The CSV is append-only and the app has no edit/delete controls. Export a date range to Excel for a read-only copy.

## Appendix A. School ICT or developer

### Requirements

Use Node.js 22 LTS and npm for source development. A Windows x64 runner is used for packaging. Hardware acceptance should be performed on a clean Windows 10/11 laptop with a webcam and Excel available for file-lock checks.

### Clone and run

1. Obtain the repository URL and access from the project maintainer. You should see the Git repository clone into a local project folder.
2. Run `npm install` in the project folder. You should see dependencies install from `package-lock.json`.
3. Run `npm run dev`. You should see the Electron development app open on a supported desktop environment.
4. Run `npm test`. You should see Vitest report the pure-logic tests passing.
5. Optionally run `npx tsc --noEmit` and `npm run build`. You should see no TypeScript errors and electron-vite output under `out/`.

### Build Windows artifacts with GitHub Actions

1. Push a version tag matching `v*`, or open the repository’s **Actions** tab and run **Build Windows installers** with **Run workflow**. You should see a workflow run on `windows-latest`.
2. Wait for `npm ci`, `npm run dist:win`, and artifact upload to finish. You should see a green workflow run with an artifact named `PASS-Windows-<ref>`.
3. Open the run’s Artifacts section and download the artifact. You should see the NSIS installer and portable `.exe` files.
4. Follow `HARDWARE_TEST.md` before distribution. The workflow has not yet been run as part of this documentation task.

### Update the application version

1. Choose the next approved semantic version with the project maintainer. You should see the planned version agreed before changing files.
2. Update `package.json` and `package-lock.json` together, for example with `npm version 0.1.1 --no-git-tag-version`. You should see both files report the new version.
3. Run `npm test`, `npx tsc --noEmit`, and `npm run build`. You should see all checks pass before committing.
4. Commit the version change and push a matching `v<version>` tag when approved. You should see the Windows workflow start and publish artifacts to that run.

## Data protection reminder

Student names and IDs are personal information. Follow the Philippine Data Privacy Act of 2012 (RA 10173), the school’s policy, and the school’s retention and access rules. Ask the school’s Data Protection Officer to review deployment and backups.
