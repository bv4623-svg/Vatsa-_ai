# Changelog

All notable changes to Vatsa AI. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]: round-2 follow-up, 2026-09-27

### Security
- **2FA secrets encrypted at rest:** TOTP seeds use Fernet (`DATA_ENCRYPTION_KEY`, rotation via `DATA_ENCRYPTION_KEYS_OLD`; fallback key derived from `JWT_SECRET_KEY`), and backup codes are HMAC'd. `Backend/scripts/reencrypt_two_factor.py` migrates existing rows (BUG-037).
- Backup codes can no longer be redeemed twice by concurrent logins (BUG-039).
- Per-IP rate limits read the client IP from the trusted proxy's `X-Forwarded-For` entry (`TRUSTED_PROXY_COUNT`, default 1), not the forgeable first entry. Expired buckets are pruned (BUG-041, BUG-042).
- **Secret guard:** `tools/security/` provides a full-history scanner (all refs, names inside archives, gitleaks) with a baseline, a tracked/staged forbidden-file check, a pre-commit hook (`git config core.hooksPath .githooks`) and a CI job. `.gitignore` now covers every `.env.*` variant (BUG-058).
- [SECURITY_ACTIONS.md](SECURITY_ACTIONS.md): what was exposed, a 14-row rotation list and rehearsed history-purge commands. **Not executed; needs the owner.**
- Hard account deletion also removes the user's files on disk (BUG-038).

### Added
- Opt-in live-provider tests (`VATSA_LIVE_TESTS=1`) and a weekly `live-providers.yml` workflow.
- `Backend/scripts/profile_routes.py` (route timings against a heavy account) and `e2e/perf.spec.ts` (`PERF=1`, per-page JS/CLS/long tasks).
- `KNOWN_ISSUES.md`.
- Tests: backend 213 → 274, security tooling 30, Vitest 118 → 125, E2E 27 → 57 scenarios, axe on 9 screens in both themes.

### Fixed
- API errors are always one readable sentence: no "[object Object]", no raw codes, no HTML error pages, no raw JSON in the code chat (BUG-050).
- Revoking an API key needs confirmation; key errors are shown (BUG-051). The API-keys gate returns the standard `402 upgrade_required` (BUG-025).
- Library, Projects and Scheduled show a loading state and a retryable error instead of a false "Create your first…" (BUG-052).
- Accessibility: 0 serious/critical axe violations on every scanned screen, light and dark, including the landing page, which had never actually been scanned (BUG-049, BUG-053, BUG-054). "Launch Workspace" on the landing page now works.
- Mobile: 44×44 touch targets, the composer stays above the keyboard and clear of the home indicator (BUG-046, BUG-047).
- `dark:` styles follow the in-app theme, not the OS (BUG-048). Clipboard failures are reported (BUG-045).
- Privacy policy corrected to match what the code does (BUG-040).
- Python runs from a self-hosted Pyodide instead of a CDN (BUG-044).
- `.venv/` is gitignored; the README was verified on a clean clone (BUG-059).

### Performance
- API JSON responses are gzip-compressed; SSE streams are excluded. The heavy-account conversation list goes from 5.40 MB to 1.82 MB on the wire (BUG-055).
- Signed-in visitors to `/` are redirected by the server: 419 → 318 KB of JS (BUG-056). Landing images are lazy-loaded and sized (BUG-057).
- `GET /api/projects` no longer does N+1 queries (BUG-043). The backend test suite runs in 10 s instead of 94 s.

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
- See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) (KI-01 to KI-18), which supersedes the list that used to be here.
