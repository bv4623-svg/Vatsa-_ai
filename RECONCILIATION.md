# main ⇄ live branch reconciliation: report and plan

Measured 2026-09-29 on a **full** clone (`git fetch --unshallow`). An earlier
note said the two branches share no history. That was wrong: the clone was
shallow (cut at `757788e` / `808148a`), so git could not see the ancestor.

"live" = `feat/ai-router-engine-and-auth-hardening`, which Render deploys to
`api.vatsaai.com`. Backup made: `backup/live-before-merge` → `bd3163c` (local + GitHub).

## Facts

| | Value | How measured |
|---|---|---|
| Common ancestor | `600498f` "merge remote changes" (2026-09-20) | `git merge-base origin/main <live>` |
| Commits only on main | 65 (63 non-merge): PR #2 audit/hardening/tests, PR #3 | `git rev-list --count 600498f..origin/main` |
| Commits only on live | 39 | `git rev-list --count 600498f..<live>` |
| Files changed on both sides | 49 | `git diff --name-only` per side, intersected |
| Trial merge conflicts | **36** (31 content, 2 add/add, 3 modify/delete) | `git merge-tree --write-tree` (in memory, no checkout) |
| Secrets in history, all refs | 0 secret-bearing files, 0 in archives, 192 commits | `tools/security/scan_history.py` (gitleaks not installed here, so file-content scan not run) |

## What each side has that the other lacks

**Only on live (production today):**
- AI router engine: providers, fallback, circuit breaker, load balancer, health, metrics (`Backend/app/ai_router/`, 19 files + 12 test files)
- Redis cache, Redis-backed scheduler and rate limits (Upstash), object-storage abstraction, observability + `/metrics`, `/ready`
- Alembic migration `0baa0aa7e354` (index on subscriptions.user_id); `users.oauth_linked` column
- Render Docker deploy: `Backend/Dockerfile`, `start.sh`, `.dockerignore`, `Backend/render.yaml`; 512 MB memory tuning
- Task 1 (OAuth-only sign-in, Microsoft removed), Task 2 (unified header/footer), Task 3 (pricing enforcement), Task 5 (`POST /api/contact` + `contact_messages` table), login background video, live USD→INR rate, Voice/TTS, unified upload + code-app limit
- Junk that should not be merged: `backend_files.txt` (33,653 lines), `frontend/lint-*.json`, `eslint-*.json`, `typecheck-errors.txt`, a file named `Please add`

**Only on main (+ PR #4 + reviews branch):**
- PR #2 audit: security fixes (forged X-Forwarded-For, 2FA secrets encrypted, backup-code replay, startup refuses leaked secrets), secret-history scanner + CI, privacy fixes, a11y, mobile, list states
- Full Playwright suite + vitest + CI workflow; deep research; self-hosted Pyodide; pre-deploy gate; root `render.yaml` (pip, no Docker)
- PR #4: email sign-up without a code, logo, feedback system, UX extras. Reviews + wall branch.

## Production risks found

1. **Deploying `main` as-is would break sign-ups.** Live's `users.oauth_linked` is `NOT NULL` with a Python-only default, so the production column has no database default. `main`'s User model lacks it, so every new-user INSERT would fail. A real merge keeps the column.
2. `main` has no Dockerfile; the live Render service builds with Docker. Switching the service to plain `main` would fail to build. That failure is safe (Render keeps the old deploy), but it is a dead end.
3. `main` refuses to start with leaked/missing secrets. Production env vars must pass `scripts/predeploy_check` first.
4. `main` adds 7 tables (feedback, reviews…). `create_all` creates them on Postgres, which is safe. Existing tables' columns are otherwise identical (checked model by model).

## Decisions only the owner can make (they decide the 36 conflicts)

1. **Sign-up policy:** live = Google/GitHub only (Task 1); PR #4 = email + password with no code. Pick one.
2. **Microsoft sign-in:** live removed it; main still has it.
3. **Rate limits/cache:** keep live's Redis (Upstash) versions, plus main's security fixes on top? (Recommended: yes.)
4. **INR price:** live's real-time rate or main's fixed rate?

## Strategy

| Option | Rewrites history? | Verdict |
|---|---|---|
| **A. Merge commit** (integration branch → PR → CI → staging → prod) | No | **Recommended.** Keeps both histories; no force-push; the history is already clean of secrets, so nothing needs rewriting. |
| B. Rebase live onto main | Yes (39 commits) | No. Needs a force-push of the branch production deploys from; same conflicts, resolved 39 times. |
| C. Squash live into one commit on main | No (on main) | Acceptable fallback if you want one commit. Loses live's per-commit history, and there's no security reason to. |
| D. Orphan/new root | Yes | No. Only needed if history held secrets; the scan says it doesn't. |

## Plan (nothing destructive; production untouched until step 6)

1. Merge PR #4, then the reviews PR, into `main` (normal PR merges; production doesn't deploy `main`).
2. Branch `integrate/live-into-main` from `main`; `git merge --no-ff origin/feat/ai-router-engine-and-auth-hardening`; resolve the 36 conflicts per the four decisions above; delete the junk files.
3. Full backend + frontend + Playwright suites locally; open a PR; CI green.
4. Staging: a second Render service (or Render preview) on the integration branch, against a **Neon branch** of the production database (instant copy; production data untouched). Check health, sign-up, sign-in, chat, payments test mode.
5. Add an Alembic migration for the new tables so Alembic history stays true.
6. Production: merge the PR; point the Render service at `main` (same Dockerfile, same env vars). Rollback = redeploy `backup/live-before-merge` (`bd3163c`) from the Render dashboard.
7. Frontend on Hostinger: rebuild from `main` after step 6.

Steps 4, 6 and 7 need Render/Hostinger access (dashboard or connectors).
