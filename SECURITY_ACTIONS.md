# Security actions: exposed secrets and history purge

**Status:** ⚠️ Waiting on the repository owner. Nothing in this file has been run against GitHub. The history purge rewrites every commit and needs your explicit go-ahead. The rotations need access to each provider's dashboard.

Prepared 2026-09-27. Every fact below comes from `tools/security/scan_history.py`, run over all 137 commits on every branch.

---

## 1. What is exposed

| Commit | Date | File in history | Secret-bearing contents (names only; contents deliberately not opened) | On branches |
|---|---|---|---|---|
| `9ca0cba` | 2026-09-15 | `vatsaai.com/vatsaai.zip` (84 MB) | `Backend/.env`, `frontend/.env.local`, `Backend/vatsa.db`, `Backend/test.db`, `Backend/vatsa-ai-debug.zip` → `Backend/vatsa.db` (a second database copy, nested) | `main`, `claude/awesome-volta-npmdue`, `feat/ai-router-engine-and-auth-hardening` |
| `43d432c` | 2026-09-19 | `vatsaai-backend.zip` | none found (source archive; purged anyway) | same |
| `a8b4a69` | 2026-09-20 | `vatsaai-backend-FINAL.zip` | none found (source archive; purged anyway) | same |

The files were removed from the working tree in `82bd096`, but **anyone who cloned or forked the repository, or browses the commits on GitHub, can still download them.** Treat every value in those two `.env` files, and both databases, as public.

A gitleaks scan of all commits found no secrets in plain files. Its only hit is a reviewed false positive, recorded in `.gitleaksignore` (an 18-character fake `sk-or-…` string in a redaction test).

## 2. Order of operations (important)

Do these in order. Step 3 must come before step 4, or users with 2FA are locked out (see §4, row 1).

1. **Merge PR #2** (or at least deploy it). It adds at-rest encryption for 2FA secrets and the tooling used below.
2. **Set `DATA_ENCRYPTION_KEY`** on the backend host (new variable; generate it as shown in §4) and redeploy.
3. **Re-encrypt 2FA secrets** under that key on the backend host:
   ```bash
   cd Backend
   python -m scripts.reencrypt_two_factor          # dry run: prints counts only
   python -m scripts.reencrypt_two_factor --apply  # writes; must end with undecryptable: 0
   ```
4. **Rotate every secret in §4** (JWT secret last among the backend ones; it signs everyone out).
5. **Purge git history** (§5), with your confirmation.
6. **Verify** (§6) and handle notifications (§3).

## 3. Exposed personal data (the two databases)

Based on the schema at that commit, `vatsa.db` and `test.db` may hold: user emails and names, password hashes (bcrypt, or legacy pbkdf2 for older accounts), OTP code hashes, payment records (emails, Razorpay order/payment ids), and **conversation contents**. 2FA columns were added on 2026-09-18, after this snapshot, so the snapshot most likely has no 2FA secrets. The protection added in PR #2 covers future leaks.

Actions:
- **Force a password reset for every account that existed on 2026-09-15.** Bcrypt hashes resist cracking but are not immune, and pbkdf2 legacy hashes are weaker. Increment each affected user's `token_version` to end their sessions (the JWT rotation in §4 does this for everyone).
- **Legal:** a breach of personal data may require notifying the Data Protection Board of India and affected users under the DPDP Act, 2023, and equivalent laws elsewhere for non-Indian users. Get legal advice; this document is not legal advice.
- Tell users who had 2FA enabled to regenerate their backup codes (the re-encrypt script reports how many).

## 4. Secrets to rotate

"Where it was" is where the application reads the value; the leaked `.env` files may contain any of these. Rotate all of them unless you can confirm a value was never set.

| # | Secret | Where it was | Rotate to | How to verify |
|---|---|---|---|---|
| 1 | `JWT_SECRET_KEY` (and legacy alias `SECRET_KEY`) | `Backend/.env` | `python -c "import secrets; print(secrets.token_urlsafe(64))"`, set on the backend host. **Only after §2 step 3.** Rotating signs out every user (intended) | An old token gets 401: `curl -H "Authorization: Bearer <old token>" $API/auth/me`; a fresh login works |
| 2 | `DATA_ENCRYPTION_KEY` (new) | n/a | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | Re-encrypt script reports `undecryptable: 0`; a 2FA user can log in |
| 3 | `OPENROUTER_API_KEY` | `Backend/.env` | OpenRouter → Keys → delete the old key, create a new one, set a credit limit | Old key: `curl -H "Authorization: Bearer <old>" https://openrouter.ai/api/v1/auth/key` → 401; a chat message works |
| 4 | `RAZORPAY_KEY_SECRET` (+ `RAZORPAY_KEY_ID`) | `Backend/.env` | Razorpay Dashboard → Account & Settings → API Keys → Regenerate (test and live mode separately) | `GET /payment/config` shows the new key id; a test-mode order succeeds (DEPLOYMENT.md §8) |
| 5 | `RAZORPAY_WEBHOOK_SECRET` | `Backend/.env` | Dashboard → Webhooks → edit → new secret (any long random string) | A test webhook delivers with status 200; one signed with the old secret gets 400 |
| 6 | `GOOGLE_CLIENT_SECRET` | `Backend/.env` | Google Cloud Console → APIs & Services → Credentials → OAuth client → Reset secret | "Continue with Google" completes; the old secret is listed as disabled |
| 7 | `GITHUB_CLIENT_SECRET` | `Backend/.env` | GitHub → Settings → Developer settings → OAuth Apps → Generate a new client secret, then delete the old one | "Continue with GitHub" completes |
| 8 | `MICROSOFT_CLIENT_SECRET` | `Backend/.env` | Azure Portal → App registrations → Certificates & secrets → New client secret; delete the old one | "Continue with Microsoft" completes |
| 9 | `EMAIL_PASSWORD` (+ `EMAIL_USERNAME`) | `Backend/.env` | For Gmail: Google Account → Security → App passwords → revoke the old one, create a new one. If it was the account's real password, change it and enable 2FA on that mailbox | A signup OTP email arrives |
| 10 | `SERPER_API_KEY`, `TAVILY_API_KEY`, `BRAVE_API_KEY`, `GOOGLE_CSE_API_KEY`, `SEARXNG_API_KEY` | `Backend/.env` (if set) | Each provider's dashboard → revoke → new key | Web search returns sources; old key rejected by the provider |
| 11 | `DATABASE_URL` password (backend, if not SQLite) | `Backend/.env` | Change the database user's password; update the URL | App starts; old password refused by the database |
| 12 | `DATABASE_URL` password (frontend) | `frontend/.env.local` (the frontend reads `DATABASE_URL` for drizzle/pg) | Same as #11 for that database | Same |
| 13 | Any other value in `frontend/.env.local` (e.g. `NEXTAUTH_SECRET`; next-auth is a dependency) | `frontend/.env.local` | Regenerate: `openssl rand -base64 32` | App builds and signs in |
| 14 | `ADMIN_EMAILS` | `Backend/.env` | Not a secret, but it reveals admin identities: confirm those accounts have strong unique passwords and 2FA (admins require 2FA already) | – |

Not secrets (no rotation needed): `ALLOWED_ORIGINS`, `*_REDIRECT_URI`, `FRONTEND_REDIRECT_URL`, `BACKEND_PUBLIC_URL`, `REASONING_MODEL`, `VISION_MODEL`, `EMAIL_SMTP_HOST/PORT`, `MAIL_FROM`, `NEXT_PUBLIC_*`.

## 5. History purge (needs your explicit confirmation)

Rehearsed on a local mirror in this session, **without pushing**: 139 → 137 commits; 0 archive references left; the scanner reports 0 secret-bearing files and 0 archive members; pack size 123.6 MB → 42.3 MB.

### Before you start
- Merge or close open PRs first. Every commit SHA changes, so open PR branches must be re-created afterwards.
- Tell collaborators: after the purge everyone must **re-clone**. Old clones still contain the files and must not be pushed back.
- Keep a private backup of the current mirror until verification passes: `git clone --mirror https://github.com/bv4623-svg/Vatsa-_ai.git vatsa-backup-$(date +%F).git` (store it offline; it contains the secrets).

### Option A: git filter-repo (recommended; this is what was rehearsed)
```bash
pip install git-filter-repo                      # rehearsed with version a40bce548d2c
git clone --mirror https://github.com/bv4623-svg/Vatsa-_ai.git vatsa-purge.git
cd vatsa-purge.git
git filter-repo --invert-paths \
  --path vatsaai.com/vatsaai.zip \
  --path vatsaai-backend.zip \
  --path vatsaai-backend-FINAL.zip

# Verify BEFORE pushing (from a checkout of this repo, pointing at the mirror):
echo '{"known": []}' > /tmp/empty-baseline.json
GITLEAKS=$(command -v gitleaks) python /path/to/Vatsa-_ai/tools/security/scan_history.py --baseline /tmp/empty-baseline.json
git log --all --oneline -- vatsaai.com/vatsaai.zip vatsaai-backend.zip vatsaai-backend-FINAL.zip   # must print nothing

# filter-repo removes the 'origin' remote on purpose; add it back, then push:
git remote add origin https://github.com/bv4623-svg/Vatsa-_ai.git
git push --force --mirror origin
```
If `git push --mirror` is rejected for `refs/pull/*` (GitHub keeps those read-only), push only branches and tags instead:
```bash
git push --force --all origin && git push --force --tags origin
```

### Option B: BFG Repo-Cleaner (equivalent)
```bash
git clone --mirror https://github.com/bv4623-svg/Vatsa-_ai.git vatsa-purge.git
java -jar bfg.jar --delete-files '{vatsaai.zip,vatsaai-backend.zip,vatsaai-backend-FINAL.zip}' vatsa-purge.git
cd vatsa-purge.git && git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```
(BFG leaves the latest commit untouched by default; the archives were already deleted there, so that's fine.)

### After pushing
1. **GitHub Support:** request removal of cached views and pull-request refs that still point at the old commits (docs: *Removing sensitive data from a repository*). Force-pushing alone doesn't clear `refs/pull/*` or cached commit pages. Give them the three commit SHAs from §1.
2. **Forks:** check the repository's forks page. Forks keep the old history; ask their owners to delete them or re-fork.
3. **Update this repo's guard files** (one small PR on the rewritten history):
   - `tools/security/history-baseline.json` → `{"known": []}` (nothing is pending purge any more)
   - `.gitleaksignore`: fingerprints include commit SHAs, which changed. Re-run `gitleaks git --log-opts=--all --report-format json --report-path r.json .` and replace the old line with the new fingerprint for `Backend/tests/test_log_redaction.py:generic-api-key:38` (the reviewed fake key). The rehearsal confirmed this finding reappears with a new SHA.
4. Everyone re-clones.

## 6. Verification checklist

- [ ] `python tools/security/scan_history.py --baseline tools/security/history-baseline.json` exits 0 with an **empty** baseline
- [ ] CI "Secret scan (tree + full history)" is green on `main`
- [ ] `https://github.com/bv4623-svg/Vatsa-_ai/commit/9ca0cba70c9f` returns 404 (after GitHub Support clears caches)
- [ ] Every row in §4 shows its "how to verify" result
- [ ] Re-encrypt script: `undecryptable: 0`
- [ ] Password-reset / notification decision recorded (§3)

## 7. Preventing a repeat (done in PR #2)

- **Pre-commit hook** `.githooks/pre-commit` refuses `.env` files (except examples and the public `frontend/.env.production`), databases, archives and key material; example env files must leave secret-looking keys empty; if gitleaks is installed, the staged diff is scanned too. Enable once per clone: `git config core.hooksPath .githooks`. Verified in this session: committing a `.env` is refused.
- **CI "Secret scan" job:** guard tests (30), a check of every tracked file, and a full-history scan (all branches, gitleaks included). Items listed in `history-baseline.json` are tolerated until purged; anything new fails the build.
- **`.gitignore`:** `*.zip`, `.env*`, `*.db`, `Backend/uploads/`.
- **At rest:** 2FA secrets encrypted, backup codes HMAC-hashed (`Backend/app/services/crypto.py`).
