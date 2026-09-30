# STATUS.md

Source of truth for what is done. Only verified facts; each has evidence.
Last verified: 2026-09-30. Feature-by-feature PRD mapping: see FEATURES.md. Merge report: RECONCILIATION.md.

## Branches and deploys (verified with `git ls-remote` and the GitHub API)

| Thing | State | Evidence |
|---|---|---|
| PR #4 `feat/feedback-and-cleanup` → `main` | **Open, not merged**, CI green | GitHub API `pulls/4` (2026-09-30): open, head `0c32543` |
| PR #5 `feat/reviews-wall` → `feat/feedback-and-cleanup` | **Open, not merged**, CI green (run 36591274233) | GitHub API `pulls/5`: open, head `d3e8fa5` |
| `integration/main-plus-live` | Live merged into PR #5's head (`774bbd5`) + 13 follow-ups; contains `origin/main` (`6a9b902`) | `git merge-base --is-ancestor origin/main HEAD` |
| PR to `main` from `integration/main-plus-live` | see the PR link in the session report | — |
| Production backend `api.vatsaai.com` (Render) | Still runs live `bd3163c` | nothing deployed from this work |
| Backup of live | `backup/live-before-merge` → `bd3163c` (local + GitHub) | `git ls-remote origin refs/heads/backup/live-before-merge` |

Merging PR #4 and #5 through the API was blocked for me (auto-mode classifier); the owner merges them, or merges the integration PR, which contains both.

## Done: integration branch (2026-09-30)

| Commit | What | Proof |
|---|---|---|
| `774bbd5` | Merge of live: 40 conflicts, owner decisions (Google/GitHub-only sign-up, no Microsoft, real-time INR, AI router only) | reasons per file in the commit message |
| `1bf0827` | Deep research + review summary through `app/ai_router`; test fakes on the router | backend starts; `tests/llm_fakes.py` |
| `7f3026e`, `d009b35` | Review-test flake (digits read as a phone number); empty OTP purpose refused | `test_reviews.py`, `test_otp*` |
| `3b63dd2` | Voice settings reachable: Settings → Voice (on/off, voice, auto-read) | `e2e/voice.spec.ts`, `lib/voice/tts.test.ts` |
| `db3adc9`, `105794a` | Lint fix; test expectations (413, sign-in for uploads, no email sign-up) | `test_upload_unified.py`, `test_email_codes_and_unverified_accounts.py` |
| `b85a735` | `/signup` Google/GitHub only; `?redirect` kept across OAuth (pricing → checkout) | `e2e/signup.spec.ts`, `src/lib/oauth.test.ts` |
| `fad4666`, `5ac2eb3` | Microsoft gone from copy/docs; a11y contrast (6 axe failures) | `e2e/a11y.spec.ts` |
| `5dea0fa` | **Security:** Google/GitHub sign-in now asks for the 2FA code (it never did, on any branch; production still doesn't) | `test_two_factor.py` (+2), `e2e/signup.spec.ts` |
| `c6a50d8`, `be986cb` | Error-wording e2e on the reset form; `.env.example` line that failed CI's secret check | `e2e/errors.spec.ts`, `forbidden_files.py --tracked` |
| `3cf80db` | Live INR everywhere: landing + FAQ quoted ₹83-rate prices (₹1,992) while checkout charges the live rate (₹2,300) | `e2e/landing.spec.ts` |

## Test totals on the integration branch (2026-09-30)

| Suite | Result |
|---|---|
| Backend pytest | 648 passed / 13 skipped / 0 failed |
| Frontend | eslint 0 errors (15 warnings); tsc clean; vitest 154/154; `check:pricing` PASS; `next build --webpack` OK |
| Playwright (desktop + mobile) | **172 passed, 52 skipped (desktop-only/mobile-only by design), 0 failed** (224) |
| Security | `scan_history.py --baseline`: 207 commits, 0 findings (gitleaks only in CI); `forbidden_files.py --tracked`: OK, 906 files; `tools/security` tests 24 pass, 6 Linux-only (run in CI) |
| `predeploy_check` with CI's env | passed |
| `users.oauth_linked` | raw SQL through `init_db()`: old table gets `BOOLEAN NOT NULL DEFAULT 0` (legacy row 0), new Google sign-up 1, no NULLs (SQLite; Postgres to check on staging) |

Smoke-tested by hand against the real local backend + frontend (2026-09-30):
- `/signup` is Google/GitHub only.
- The Google and GitHub buttons reach the backend, which answers "not configured": there are no OAuth apps locally, so the real round trip is for staging.
- The admin 2FA account, through the new OAuth path: wrong code → 400, right code → 200; `/admin/reviews` loads.
- Posting a review → 201 and it's on the wall; hiding it as admin → the counts update.
- Chat goes through the router; with no `OPENROUTER_API_KEY` locally it shows the clean "temporarily unavailable" + Retry.
- `/pricing`: live $1 = ₹95.98 → ₹2,300 / ₹9,500.

## Earlier work (still true)

- PR #4: feedback system, logo, UX extras (email sign-up without a code was superseded by Google/GitHub-only).
- Reviews + wall v1: 22 endpoints, `/wall`, `/wall/me`, `/users/[id]/wall`, `/admin/reviews`. Not in v1: media upload, translation, LLM moderation.

## Open

- **Deploy** (needs Render/Neon/Hostinger access): the PR's deployment checklist, staging first.
- **Phase 0 fixes (branch `feat/phase-0-fixes`, off `integration/main-plus-live` `da5352f`):**
  - Fix 2 (`bd9d40e`): no email, or name built from it, in any model prompt; `tests/test_prompt_privacy.py` (5).
  - Fix 3: 👍/👎 saved per reply (`chat_feedback` table, `POST/DELETE/GET /api/chat/feedback`), back after a reload, 👎 reason chips, admin `/admin/chat-feedback` (stats at `/api/admin/chat-feedback/stats`). Tests: `tests/test_chat_feedback.py` (11), `services/chatFeedback.test.ts` (7), `e2e/chat-feedback.spec.ts` (6 × 2).
- **Phases 1–5 of the PRD:** not started (FEATURES.md §1).
- **Small, flagged:**
  - Unused `frontend/src/db`.
  - An unreachable second settings dialog.
  - DEPLOY.md/DEPLOYMENT.md still describe main's pip deploy.
  - If the rate request fails, the frontend shows its ₹83 fallback while the backend's fallback charge rate is ₹88.
