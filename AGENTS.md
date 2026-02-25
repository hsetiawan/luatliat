# AGENTS.md

## Project Overview

LuatLiat is an Indonesian-language organizational finance/dues management web app built on **Google Apps Script (GAS)**. It runs as a GAS web app backed by Google Sheets as its database.

**Source files:** `Kode.gs` (server-side GAS), `index.html` (main template), `javascript.html` (client-side JS), `style.html` (CSS), `logo.html` (base64 logo image).

## Cursor Cloud specific instructions

### Local Development

- **Dev server:** `npm run dev` starts a local Express server on port 3000 that processes the GAS `<?!= include() ?>` template directives and serves the app with mock `google.script.run` API responses.
- **Mock accounts:** `demo@luatliat.com` / `demo123` (bendahara role), `admin@luatliat.com` / `admin123` (superadmin role).
- The mock server simulates all GAS backend calls (login, getSaldo, getStatusIuran, etc.) with realistic sample data. It does not connect to any real Google Sheets.

### Linting

- `npm run lint` runs ESLint on `.gs` and `.js` files. GAS-specific globals (SpreadsheetApp, HtmlService, Utilities, etc.) are pre-configured.
- Existing code has pre-existing lint warnings (loose equality, unused vars) — these are from the original GAS codebase.

### Key Gotchas

- The `logo.html` file is ~6 MB (base64-encoded PNG). It is excluded from linting via `.eslintignore`.
- GAS template syntax (`<?!= include('...') ?>`) only works through the dev server; opening HTML files directly in a browser will not process includes.
- The `.gs` file extension is treated as JavaScript by ESLint.
- There are no automated tests in this repository. Testing is manual via the dev server.
- This project has no build step. For production deployment, files are pushed to Google Apps Script via `clasp` (requires Google account authentication via `npx clasp login`).
