# PASS — Quick guide for teachers

## First launch
1. Install **PASS Attendance** or run the portable `.exe` provided by the school.
2. Start the app and select **Import a class**.
3. Choose the class SF2 `.xls` or `.xlsx`. PASS previews the detected month, learners, generated IDs, and sex; select another SF2 worksheet if needed. A simple roster table is also supported as a fallback.
4. Keep the original workbook in a place you can access later. PASS stores attendance locally and creates a `.bak.xlsx` backup before updating an `.xlsx` class record.

## Record attendance
1. Select the class at the top of the window and open **Scan**.
2. Allow camera access when Windows asks. Hold a student QR code in the camera frame. If the camera cannot be used, type the student ID in the manual-entry field and press **Record**.
3. A first scan records Present or Late according to the configured cutoff. Re-scans do not change the saved attendance. Unknown IDs are reported.
4. Use **Attendance** to review the selected date, search/filter students, or manually set Present, Late, or Absent. If PIN protection is enabled, enter the PIN to save a manual edit.

## Exports and records
- **Scan Log** shows an append-only record of scan attempts and can export a date range to Excel.
- **QR Codes** lets you select students and print their QR cards or save a PDF sheet.
- **Students** can export/import a `.passroster` file. It contains student names, so share it carefully.
- **Export** updates the selected date in the SF2's existing day column and refreshes totals. Close the workbook in Excel first. PASS creates a `.bak.xlsx` copy before its first update.
- PASS never edits legacy `.xls` files. In Excel, use **Save As → Excel Workbook (.xlsx)**, then use **Link .xlsx copy** on Export.
- Attendance data is stored on this computer. Scan proof is in `Documents\PASS\<class>\scan-log.csv`.

## Need help?
If the camera is blocked, check Windows **Settings → Privacy & security → Camera** and close other apps using it. For a locked Excel file, close Excel and retry. Ask the school’s PASS administrator before deleting a class or its stored records.
