# main ⇄ live branch reconciliation: report and plan

Measured 2026-09-29 on a **full** clone (`git fetch --unshallow`). An earlier
note said the two branches share no history. That was wrong: the clone was
shallow (cut at `757788e` / `808148a`), so git could not see the ancestor.

"live" = `feat/ai-router-engine-and-auth-hardening`, which Render deploys to
`api.vatsaai.com`. Backup made: `backup/live-before-merge` → `bd3163c` (local + GitHub).

## Status (2026-09-30)

- Merged on branch `integration/main-plus-live`: merge commit `774bbd5` (parents: PR #5 head `d3e8fa5`, live `bd3163c`), 40 conflicts (the trial's 36 plus 4 from the reviews branch), then follow-up commits. Every resolution has a one-line reason in the merge commit message.
- Built from PR #5's head, not `main`: PR #4 and PR #5 are still open (merging them through the API was blocked for me; the owner merges them). The PR to `main` therefore also carries their commits.
- Junk files: already gone. main's `6e82980` deleted all 11 (incl. the 33,653-line `backend_files.txt`), live never touched them after the merge-base, so the merge kept the deletion; `.gitignore` now covers the two names it missed.
- Test results and the PR link: STATUS.md.

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
5. **Found during the merge, in production today:** Google/GitHub sign-in skipped 2FA on both branches, and `require_admin` only checks that 2FA is *on*. With sign-in now Google/GitHub only, 2FA was never asked for, and an admin needed only a provider login. Fixed on the integration branch (`5dea0fa`); production keeps the hole until this is deployed.
6. Existing 2FA secrets in production are plaintext (live never encrypted them). The merged code still reads them and re-encrypts each on its next successful use (`test_legacy_plaintext_secret_and_hashes_still_work_and_get_upgraded`); `scripts/reencrypt_two_factor.py` does all at once after deploy.

Risk 1 is resolved by the merge (the column is kept). On SQLite, the app's own `init_db()` adds it as `BOOLEAN NOT NULL DEFAULT 0` to an old table (legacy row → 0), a new Google sign-up gets 1, no NULLs (checked with raw SQL, 2026-09-30). The Postgres DDL (`DEFAULT FALSE`) is still unverified: check it on the staging Neon branch (PR checklist).

## Owner decisions (answered 2026-09-29, applied in the merge)

1. **Sign-up policy:** Google/GitHub only. Email sign-up returns 410; password reset by emailed code stays for older password accounts.
2. **Microsoft sign-in:** removed (code, env vars, copy; the 12 locale files had no keys left).
3. **Rate limits/cache:** live's Redis (Upstash) backends + main's X-Forwarded-For fix and pruning.
4. **INR price:** live's real-time rate, with the fixed rate as fallback.
5. **AI engine** (asked during the merge): live's `app/ai_router` is the only way the backend calls a model; deep research and the review summary were ported to it.

## Strategy

| Option | Rewrites history? | Verdict |
|---|---|---|
| **A. Merge commit** (integration branch → PR → CI → staging → prod) | No | **Recommended.** Keeps both histories; no force-push; the history is already clean of secrets, so nothing needs rewriting. |
| B. Rebase live onto main | Yes (39 commits) | No. Needs a force-push of the branch production deploys from; same conflicts, resolved 39 times. |
| C. Squash live into one commit on main | No (on main) | Acceptable fallback if you want one commit. Loses live's per-commit history, and there's no security reason to. |
| D. Orphan/new root | Yes | No. Only needed if history held secrets; the scan says it doesn't. |

## Plan (nothing destructive; production untouched until step 6)

1. Merge PR #4, then the reviews PR, into `main` (normal PR merges; production doesn't deploy `main`).
2. ~~Branch from `main`, merge live, resolve per the decisions, delete the junk.~~ **Done** as `integration/main-plus-live` (see Status).
3. ~~Full suites locally; open a PR; CI green.~~ Suites **done** locally (STATUS.md); PR opened to `main`; CI result on the PR.
4. Staging: a second Render service (or Render preview) on the integration branch, against a **Neon branch** of the production database (instant copy; production data untouched). Check health, sign-up, sign-in, chat, payments test mode.
5. Add an Alembic migration for the new tables so Alembic history stays true.
6. Production: merge the PR; point the Render service at `main` (same Dockerfile, same env vars). Rollback = redeploy `backup/live-before-merge` (`bd3163c`) from the Render dashboard.
7. Frontend on Hostinger: rebuild from `main` after step 6.

Steps 4, 6 and 7 need Render/Hostinger access (dashboard or connectors).
