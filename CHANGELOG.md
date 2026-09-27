# Changelog

All notable changes to Vatsa AI. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]: end-to-end audit, 2026-09-27

### Security
- **Removed a committed archive that contained `.env` files and a database** (`vatsaai.com/vatsaai.zip`) plus other stray uploads; `*.zip` is gitignored and CI runs gitleaks. Secrets must still be rotated and history purged (BUG-001).
- Code preview no longer grants `allow-same-origin`: AI-generated code could previously read the session token. "Open in new tab" runs in the same sandbox (BUG-003, BUG-004).
- Streaming errors no longer expose provider names, model ids or upstream responses (BUG-002).
- `/api/upload` requires sign-in, is rate limited (30/min), and no longer keeps every upload's text in memory (BUG-006).
- SSRF guard on server-side fetches of search results (BUG-017).
- Server-side validation of image attachments and real image-byte checks in vision (BUG-032, BUG-033).
- Zip-bomb guard for DOCX/XLSX; PDF page cap (BUG-010).
- The user's email is no longer sent as `userId` in chat requests (BUG-030).

### Added
- **Deep research** (Business): `POST /api/research` with streamed planning → parallel search → cited report, and a Research toggle in the chat composer.
- **Voice mode** (Pro): dictation with live transcript, Talk mode (auto-send + spoken replies), and per-message Read aloud, all browser-native.
- **Code execution:** multi-file HTML previews with CSS/JS inlined, a JavaScript console runner, Python in the browser (Pyodide 0.29.5), a console panel with error badge, and a Run button.
- Web-search notices when search was skipped (limit or outage); search result cache (`SEARCH_CACHE_TTL_SECONDS`).
- "Try again" on failed replies; readable error messages for every failure; offline detection.
- Attachment validation with specific reasons on the chip; client-side image downscaling; scanned/password/corrupted PDF messages; truncation warnings.
- `IMAGE_PROVIDER_URL` and `SEARCH_CACHE_TTL_SECONDS` settings.
- Test suites: 161 new backend tests (213 total), 118 frontend unit tests (Vitest), 27 Playwright E2E scenarios on desktop and mobile; GitHub Actions CI.
- Docs: new PRD.md, TEST_REPORT.md, BUG_FIXES.md, root README.md, this changelog.

### Fixed
- Image generation no longer hijacks normal questions ("draw conclusions…", "image carousel component", anything in the code workspace or with a file attached); server and client share one tested case list (BUG-005).
- Image generation retries transient provider failures, validates responses, and gives a new picture on regenerate (BUG-020).
- Images in conversations older than 7 days load again (links re-signed on read) (BUG-019).
- Daily allowances are charged only when chat, image, vision or research succeeded (BUG-018).
- PDF/DOCX/XLSX parsing no longer blocks the server; scanned and unreadable files are explained (BUG-007..009).
- Unsupported attachments are rejected instead of silently dropped (BUG-021); attachment chips update independently (BUG-027).
- Web search uses only the user's words as the query (BUG-015).
- Retry and Regenerate no longer duplicate the question (BUG-023); final SSE event no longer lost (BUG-031).
- Free-plan "Analyze" opens the upgrade flow instead of "[object Object]" (BUG-022).
- Chat input capped at 200k characters / 10 attachments (BUG-026).
- `useDebounce` implemented (was a no-op stub) (BUG-029).
- All ESLint errors resolved (BUG-035); test runs no longer write into `Backend/` (BUG-036).

### Changed
- `fastapi>=0.118` (streaming responses keep their DB session).
- Code-workspace system prompt asks the model to name files in code fences.
- Message actions are visible on touch screens; icon buttons have accessible names and pressed states.
- The previous PRD (an engineering repair brief) moved to `docs/archive/REPAIR-BRIEF.md`.

### Known issues
- BUG-024: Free users can send images to chat (Vision is listed as Pro); product decision pending.
- BUG-025: API-keys paid gate uses 403 instead of the standard 402.
- See PRD.md §10 for all limitations.
