# PASS hardware and Windows acceptance checklist

Run this checklist on a clean Windows laptop with the Phase 4 installer. These scenarios are not exercised in the sandbox.

## Webcam
- [ ] With no camera attached, show a clear camera-not-found message and keep manual ID entry available.
- [ ] Deny camera permission and verify the permission-blocked message; allow media permission only.
- [ ] Open the camera in another app and verify the in-use message.
- [ ] Scan a valid `PASS|<studentId>` QR and a bare-ID QR; confirm Present/Late cutoff behavior and one consistent daily status.
- [ ] Scan again during cooldown (ignored silently but logged), then scan after cooldown ("Already recorded at HH:MM" without changing attendance).
- [ ] Scan an ID not in the active class and confirm the error result is recorded in the scan log.
- [ ] Confirm sound setting and manual ID entry behavior.

## Excel file lock and data integrity
- [ ] Import a representative `.xlsx`, map Student ID and Name, and verify the five-row preview and full import.
- [ ] Reject blank and duplicate student IDs with actionable messages.
- [ ] Keep the source workbook open in Excel during Update class record; confirm the app asks to close it, writes nothing, and leaves database attendance intact.
- [ ] Close the workbook and update it; verify existing formatting is preserved, a backup is created before first write, and IDs are matched correctly.
- [ ] Confirm repeated attendance rows remain unchanged and no students are silently dropped.

## Clean Windows install
- [ ] Install both NSIS and portable builds on a clean Windows laptop with no Node.js installed.
- [ ] Launch offline; verify bundled Inter fonts, database persistence, and first-launch empty state.
- [ ] Create/import multiple classes, switch between them, restart, and confirm data persists.
- [ ] Verify CSV scan log exists under Documents\PASS and can be opened; confirm each attempt is append-only.
- [ ] Test QR sheet print/PDF, date-range scan-log XLSX export, PIN protection, class rename/delete confirmation, and settings persistence.
- [ ] Uninstall and confirm the documented policy for user data retention.
