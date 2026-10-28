# Known issues

- The brief references a React/Vite UI ZIP, but the supplied uploads contained only `pasted_content.txt`. The original seven-screen prototype, icons, PASS logo asset, and exact component layouts could not be migrated during Phase 1. The renderer remains a minimal, data-free scaffold pending the ZIP.
- `npm install` completed but reported 10 dependency audit findings (5 moderate, 3 high, 2 critical). No forced dependency upgrades were applied because that could violate the requested pinned stack.
- Sandbox verification did not exercise Electron windows, webcams, Windows Excel file locking, printing, or Windows packaging. These are manual/hardware acceptance items in `HARDWARE_TEST.md`.
