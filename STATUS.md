# STATUS.md

Source of truth for what is done. Only verified facts; each has evidence.
Last verified: 2026-09-30. Feature-by-feature PRD mapping: see FEATURES.md. Merge report: RECONCILIATION.md.

## Branches and deploys (verified with `git ls-remote` and the GitHub API)

| Thing | State | Evidence |
|---|---|---|
| PR #4 `feat/feedback-and-cleanup` → `main` | **Open, not merged**, CI green | GitHub API `pulls/4` (2026-09-30): open, head `0c32543` |
| PR #5 `feat/reviews-wall` → `feat/feedback-and-cleanup` | **Open, not merged**, CI green (run 36591274233) | GitHub API `pulls/5`: open, head `d3e8fa5` |
| `integration/main-plus-live` | Live merged into PR #5's head (`774bbd5`) + 13 follow-ups; contains `origin/main` (`6a9b902`) | `git merge-base --is-ancestor origin/main HEAD` |
| PR #6 `integration/main-plus-live` → `main` | **Open, not merged**, CI green (all 4 jobs), mergeable | GitHub API `pulls/6` (2026-09-30), head `da5352f` |
| `feat/login-captcha` (from `da5352f`) | Sign-in CAPTCHA, 5 commits, local only (not pushed) | `git log da5352f..feat/login-captcha` |
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

## Done: sign-in CAPTCHA (branch `feat/login-captcha`, 2026-09-30)

Owner decisions:
- **Scope:** Cloudflare Turnstile is enforced when a Google/GitHub sign-in starts, so both `/login` and `/signup` get it (they share that start). Nowhere else.
- **Keys:** built with Cloudflare's public test keys; **off** (`TURNSTILE_ENABLED=false`) until real keys are set (DEPLOY.md §6).

| Commit | What | Proof |
|---|---|---|
| `cee43fd` | Backend: `services/captcha.py`; POST start with the token in the body; one check, 5 s, fail-open on outage; 10 checks/min/IP; startup refuses "on without a key" | `tests/test_login_captcha.py` (15; 10 fail with the gate disabled) |
| `4f7ea11` | Frontend: `TurnstileWidget` (lazy, only on the sign-in buttons), `OAuthSignIn` shared by `/login` and `/signup`, buttons wait for a token; signed-in visitors skip sign-in | `lib/captcha.test.ts` (4), `lib/oauth.test.ts` (+1) |
| `0f116b7` | Fix (from `5dea0fa`): the 2FA code form waited for hydration; a code typed earlier was dropped | 2FA e2e 30/30 repeated (was 26/30) |
| `ce302d6` | E2E with the CAPTCHA on (fake Turnstile, test site key); the signed-in redirect applies only to real page loads (Next strips its prefetch headers) | `e2e/captcha.spec.ts` (8 × 2) |
| docs commit | `.env.example` (both), `render.yaml`, DEPLOY.md §6, SECURITY_ACTIONS.md §4 row 15 + §8 | — |

Not built from the prompt: `POST /api/auth/verify-captcha`. Turnstile tokens are single-use, so checking there and again at sign-in would always fail the second check.

Test totals on `feat/login-captcha`:
- **Backend:** 663 passed / 13 skipped / 0 failed.
- **Frontend:** unit 159/159; tsc clean; eslint 0 errors.
- **Playwright on the CAPTCHA build:** 188 passed / 52 skipped / 0 failed (240).

## Earlier work (still true)

- PR #4: feedback system, logo, UX extras (email sign-up without a code was superseded by Google/GitHub-only).
- Reviews + wall v1: 22 endpoints, `/wall`, `/wall/me`, `/users/[id]/wall`, `/admin/reviews`. Not in v1: media upload, translation, LLM moderation.

## Open

- **Deploy** (needs Render/Neon/Hostinger access): the PR's deployment checklist, staging first.
- **CAPTCHA keys:** create a Turnstile widget, then DEPLOY.md §6 (frontend site key first, then `TURNSTILE_ENABLED` + secret on Render).
- **Phase 0 Fix 2:** the user's email still goes into every system prompt (`ai_service.py:297`).
- **Phase 0 Fix 3:** chat 👍/👎 are not saved (`hooks/home/useHomeChat.ts:384`).
- **Phases 1–5 of the PRD:** not started (FEATURES.md §1).
- **Small, flagged:**
  - Unused `frontend/src/db`.
  - An unreachable second settings dialog.
  - DEPLOY.md/DEPLOYMENT.md still describe main's pip deploy.
  - If the rate request fails, the frontend shows its ₹83 fallback while the backend's fallback charge rate is ₹88.
