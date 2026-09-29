# STATUS.md

Source of truth for what is done. Only verified facts; each has evidence.
Last verified: 2026-09-29. Feature-by-feature PRD mapping: see FEATURES.md.

## Branches and deploys (verified with `git ls-remote` and the GitHub API)

| Thing | State | Evidence |
|---|---|---|
| PR #4 `feat/feedback-and-cleanup` → `main` | **Open, not merged, CI green** | GitHub API `pulls/4`: open, head `0c32543`; CI run 36382501583 all 4 jobs passed |
| `feat/reviews-wall` (this work) | Stacked on PR #4 | branched from `0c32543` |
| Production backend `api.vatsaai.com` (Render) | Runs `feat/ai-router-engine-and-auth-hardening` (`bd3163c`), **not `main`** | Render service settings (checked in an earlier session) |
| Production frontend `vatsaai.com` (Hostinger) | Built from the live branch | earlier session |
| `main` vs live branch | Share history; diverged at `600498f` (2026-09-20). main +65 commits, live +39; trial merge = 36 conflicts | `git merge-base` on a full clone. **Correction:** an earlier version of this file said "no shared history"; that came from a shallow clone. |
| Backup of live | `backup/live-before-merge` → `bd3163c` (local + GitHub) | `git ls-remote origin refs/heads/backup/live-before-merge` |

Consequence: nothing merged to `main` reaches users until live is merged in. Deploying `main` as-is would break sign-ups (`users.oauth_linked` NOT NULL without a DB default). Full report, risks, options and plan: **RECONCILIATION.md**. Waiting on 4 owner decisions listed there.

## Done (PR #4, verified by tests and a local run)

| Task | Commit | Proof |
|---|---|---|
| Sign-up without email code | `212c567` | `Backend/tests/test_signup_no_otp.py`, `frontend/e2e/signup.spec.ts` |
| New logo everywhere | `a688940` | `frontend/src/components/brand/brand.test.ts` |
| Feedback API | `1b8551d` | `Backend/tests/test_feedback.py` (17 tests) |
| Feedback button + modal, toasts fixed | `148991a`, `ee3d475` | `frontend/e2e/feedback.spec.ts` |
| Feedback admin page | `aba83da` | `frontend/e2e/feedback-admin.spec.ts` |
| Timestamps + character counter | `f73dbe9` | `frontend/src/lib/chat-limits.test.ts`, `e2e/ux-extras.spec.ts` |
| `/home` loading skeleton | `84fac6a` | `e2e/ux-extras.spec.ts` |
| 404 + error boundaries | `0c32543` | `e2e/ux-extras.spec.ts` |

Test totals on `0c32543`: backend 325 passed / 12 skipped; frontend unit 140/140; Playwright 140 passed / 46 skipped / 0 failed.

## PRD (AI smartness + reviews/wall): open decisions (PRD §12)

Defaults I am using until the owner answers:

| Question | Default | Why |
|---|---|---|
| LLM provider priority | OpenRouter (existing) | Already the single gateway to OpenAI/Anthropic/Google |
| Vector DB | pgvector later; TF-IDF (scikit-learn, already installed) for v1 | No new service on the 512 MB Render plan |
| Reviews scoped to agent or global | Global (reviews of Vatsa AI); optional `conversation_id` | The app has no "agent" entity |
| "Verified" reviewer | Paid plan, or ≥ 10 chat/code messages sent | Uses existing `users.tier` and `usage_daily` |
| Pre- or post-moderation | PRD §6.6 hybrid: toxic → rejected, spammy/new → queue, trusted → published | As specified |
| Language | English-first | UI is i18n-ready; no auto-translate in v1 |

Blocked on the owner: Langfuse (needs an account + keys), anything needing `OPENROUTER_API_KEY` to verify locally (LLM review summary, eval judge).

## Done: reviews + wall v1 (branch `feat/reviews-wall`, stacked on PR #4)

| Part | Proof |
|---|---|
| Backend API + moderation (22 endpoints, 6 tables) | `Backend/tests/test_reviews.py` (31 API tests), `Backend/tests/test_review_moderation.py` (19 unit tests) |
| Frontend: `/wall`, `/wall/me`, `/users/[id]/wall`, `/admin/reviews`, sidebar "Reviews" link (12 languages) | `frontend/e2e/reviews.spec.ts` (12 tests × desktop/mobile), `frontend/src/services/reviews.test.ts` (5) |
| Checked by hand against the real local backend (2026-09-29) | New email sign-up → wall → helpful vote, pin, report → write review (validation errors, then "will appear once checked") → My wall shows it pending → admin approves → live on wall. Public pin → `/users/7/wall`. Admin signed in with 2FA → `/admin/reviews` shows the report reason; reject with note moves it approved 4→3, rejected 0→1. |

Suite totals on this branch (2026-09-29): backend 375 passed / 12 skipped; frontend unit 145/145; Playwright 160 passed / 50 skipped / 0 failed.

E2E flake fixed: `landing.spec.ts` timed out (45 s) in a loaded full run. Cause: every page loads fonts from Google, and the shared sign-out helper waits for "networkidle", so one stalled font request ate the whole budget. Reproduced with a 50 s simulated stall (timeout at `mock-api.ts:57`); `e2e/fixtures.ts` now answers Google Fonts locally for every test, and the same stall then costs 1.6 s.

Not done in v1: media upload/gallery, language detection/translation, LLM-based moderation, virtualized grid, Postgres full-text search. LLM summary path is unit-tested with a stubbed LLM only (no key locally).

## Not started (PRD part 1, AI smartness)

See FEATURES.md §1. Cheapest real gaps first: save chat 👍/👎 (today they're lost on reload), stop sending the user's email to the LLM, relevance-ranked memory. Tracing (Langfuse) is blocked on an account + keys.
