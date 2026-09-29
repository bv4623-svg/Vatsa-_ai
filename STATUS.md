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
| `main` vs live branch | **No shared history** | `git merge-base origin/main origin/feat/ai-router-engine-and-auth-hardening` returns nothing (main was rewritten by the PR #2 history purge). Live has 63 commits; 401 files differ. |

Consequence: nothing merged to `main` reaches users until the owner decides how to reconcile the two lines (port live-only features onto `main` and redeploy, or the reverse). Live-only features `main` lacks include `/api/contact`, the unified upload, the new pricing tiers, USD/INR rates and the OAuth-only login (Task 1).

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

## In progress

- Reviews + wall v1 on `feat/reviews-wall`. Updated below as each part lands.
