# PASS — Quick guide for teachers

## First launch
1. Install **PASS Attendance** or run the portable `.exe` provided by the school.
2. Start the app and select **Import a class**.
3. Choose the class `.xlsx` file. Confirm the Student ID and Name columns, enter class details, and import.
4. Keep the source workbook in a place you can access later; PASS stores attendance locally and keeps a backup before updating the class record.

## Record attendance
1. Select the class at the top of the window and open **Scan**.
2. Allow camera access when Windows asks. Hold a student QR code in the camera frame. If the camera cannot be used, type the student ID in the manual-entry field and press **Record**.
3. A first scan records Present or Late according to the configured cutoff. Re-scans do not change the saved attendance. Unknown IDs are reported.
4. Use **Attendance** to review the selected date, search/filter students, or manually set Present, Late, or Absent. If PIN protection is enabled, enter the PIN to save a manual edit.

## Exports and records
- **Scan Log** shows an append-only record of scan attempts and can export a date range to Excel.
- **QR Codes** lets you select students and print their QR cards or save a PDF sheet.
- **Export** appends the selected date’s P/L/A column to the original class workbook. Close the workbook in Excel first. PASS creates a `.bak.xlsx` copy before its first update.
- Attendance data is stored on this computer. Scan proof is in `Documents\PASS\<class>\scan-log.csv`.

## Need help?
If the camera is blocked, check Windows **Settings → Privacy & security → Camera** and close other apps using it. For a locked Excel file, close Excel and retry. Ask the school’s PASS administrator before deleting a class or its stored records.
