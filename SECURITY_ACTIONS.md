# Security actions: exposed secrets and history purge

**Status (2026-09-27):**
- ✅ **Git history purged** and force-pushed to every branch (§5). There are no tags. The three archives and everything inside them are gone from all branches.
- ✅ **The app refuses the leaked values:** the backend won't start, and the pre-deploy gate fails the deploy, while any configured secret matches a leaked one (checked by one-way fingerprint, `Backend/app/core/secrets_check.py`).
- ⚠️ **Still needs the owner:** rotate the **5 leaked secrets** in §4 (only you can log in to those dashboards), run the force-reset command (§3), and ask GitHub Support to clear cached commit views (§5, "After the purge").

Values that were public before the purge must be treated as compromised forever, however well the purge worked: anyone could have cloned or forked the repo while they were in history. **Rotation is what actually secures the app.**

---

## 1. What was exposed

Found by `tools/security/scan_history.py`, `git log --all --full-history` and `git ls-tree` over every commit on every branch (169 commits before the purge).

| Commit (old SHA) | Date | File | Secret-bearing contents (names and sizes only; contents deliberately never opened) |
|---|---|---|---|
| `9ca0cba` | 2026-09-15 | `vatsaai.com/vatsaai.zip` (84,540,183 bytes, 374 members) | `Backend/.env` (853 B), `frontend/.env.local` (225 B), `Backend/vatsa.db` (262,144 B), `Backend/test.db` (16,384 B), `Backend/vatsa-ai-debug.zip` (41 MB), which contains another `Backend/vatsa.db` (122,880 B) |
| `43d432c` | 2026-09-19 | `vatsaai-backend.zip` (192,580 B) | `.env.example` only (a source archive) |
| `a8b4a69` | 2026-09-20 | `vatsaai-backend-FINAL.zip` (187,924 B) | `.env.example` only (a source archive) |

**What the leaked env files actually set.** Established by fingerprinting each file through a pipe: names only, no value was ever displayed. See `Backend/scripts/fingerprint_leaked_env.py`.
- `Backend/.env`: `JWT_SECRET_KEY`, `OPENROUTER_API_KEY`, `RAZORPAY_KEY_SECRET`, `GOOGLE_CLIENT_SECRET`, `EMAIL_PASSWORD`, plus `DATABASE_URL`, a local `sqlite+aiosqlite` path with no password, so not a secret.
- `frontend/.env.local`: `RAZORPAY_KEY_SECRET` (a server secret that should never have been in frontend config).
- Not present in either file, so not leaked: `RAZORPAY_WEBHOOK_SECRET`, the GitHub and Microsoft OAuth secrets, all search API keys, and any database password.

Also checked, and clean:
- **Every historical version of the committed env files:** 25 versions of `Backend/.env.example`, `frontend/.env.example` and `frontend/.env.production`. Secret-looking keys are empty everywhere. The only flagged key, `ACCESS_TOKEN_EXPIRE_MINUTES=10080`, is a 7-day setting, not a secret.
- **Plain files in every commit (gitleaks):** one hit, a reviewed fake 18-character `sk-or-abc1…` string in a redaction test, recorded in `.gitleaksignore`. Real OpenRouter keys are 73 characters.
- **Commit messages:** no credentials. They mention key names or patterns only.
- **Hard-coded keys in code** (`sk-`, `ghp_`, `AKIA`, `-----BEGIN`): none. The matches are words like `task-` and `mask-`, and synthetic fixtures in `tools/security/test_security_tools.py`.

## 2. What to do now, in order

1. **Merge PR #2** and deploy it. It adds at-rest encryption for 2FA secrets and the tooling used below.
2. **Set `DATA_ENCRYPTION_KEY`** on Render (row 2 in §4) and redeploy.
3. **Re-encrypt 2FA secrets** under that key. On the Render shell:
   ```bash
   cd Backend
   python -m scripts.reencrypt_two_factor          # dry run: prints counts only
   python -m scripts.reencrypt_two_factor --apply  # must end with undecryptable: 0
   ```
4. **Rotate every secret in §4.** Do `JWT_SECRET_KEY` last among the backend ones: rotating it signs everyone out, which is intended.
5. Handle user notification and password resets (§3).
6. Tick off the checklist in §6.

## 3. Exposed personal data and password resets

Judging by the schema at that commit, the databases may hold user emails and names, password hashes (bcrypt, or pbkdf2 for older accounts), OTP code hashes, payment records (emails, Razorpay order/payment ids) and **conversation contents**. 2FA columns were added on 2026-09-18, after this snapshot.

**Password reset for affected users** (everyone whose account existed on 2026-09-15):
1. **Force the reset** with the admin command, in the Render **Shell** tab:
   ```bash
   cd Backend
   python -m scripts.force_password_reset                   # dry run: lists every account created before 2026-09-16
   python -m scripts.force_password_reset --apply --notify  # signs them out, disables the old password, emails the reset link
   ```
   `--apply` bumps each account's `token_version`, which ends all its sessions, and replaces the password hash with the hash of an unknown random secret. The leaked hash stops working, and `/forgot-password` becomes the way back in. `--notify` sends the email in step 2 for you. Tested on fake users in `Backend/tests/test_force_password_reset.py`.
2. **The email** (`--notify` sends it; send it yourself if SMTP isn't configured yet): "As a precaution, please reset your password at https://vatsaai.netlify.app/forgot-password. If you used the same password elsewhere, change it there too."
3. **How the reset works (already in the app):** `/forgot-password` emails a one-time code. `/reset-password` sets the new password through `POST /auth/reset-password` (`Backend/app/routers/auth/otp.py:158`), which also increments `token_version` and ends any remaining sessions.
4. **2FA users:** ask them to regenerate backup codes (Settings → Security). The re-encrypt script reports how many accounts have 2FA.
5. **Legal:** a personal-data breach may require notifying the Data Protection Board of India and affected users under the DPDP Act, 2023, and equivalent laws elsewhere for non-Indian users. Get legal advice; this document is not legal advice.

## 4. Secrets to rotate

**Rows 1, 3, 4, 6 and 9 leaked and must be rotated.** The app refuses to start until they are (the fingerprint check). Row 2 is new. The other rows weren't in the leaked files; rotate them only if you want a clean slate.

**Where to put new values:** backend variables go in the **Render** dashboard (https://dashboard.render.com → the API service → *Environment*). Frontend variables go in **Netlify** (https://app.netlify.com → the site → *Site configuration → Environment variables*). Redeploy after changing them. Dashboard menus move over time; the paths below were correct when this was written.

| # | Secret | Used for | Rotate at | Rotate to | How to verify |
|---|---|---|---|---|---|
| 1 | `JWT_SECRET_KEY` (legacy alias `SECRET_KEY`) | Signs every login session | Render → Environment | `python -c "import secrets; print(secrets.token_urlsafe(64))"`. **Only after §2 step 3** | `curl -H "Authorization: Bearer <old token>" https://vatsa-ai.onrender.com/auth/me` → 401; a fresh login works |
| 2 | `DATA_ENCRYPTION_KEY` (new) | Encrypts 2FA secrets at rest | Render → Environment | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | Re-encrypt script prints `undecryptable: 0`; a 2FA user can log in |
| 3 | `OPENROUTER_API_KEY` | All AI chat, research and vision | https://openrouter.ai/settings/keys (delete the old key, create a new one, set a credit limit) | new key | `curl -H "Authorization: Bearer <old key>" https://openrouter.ai/api/v1/auth/key` → 401; a chat message gets a reply |
| 4 | `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` | Payments | https://dashboard.razorpay.com → Account & Settings → API Keys → Regenerate (test and live mode separately) | new key pair | `GET https://vatsa-ai.onrender.com/payment/config` shows the new key id; a test-mode order succeeds |
| 5 | `RAZORPAY_WEBHOOK_SECRET` | Verifies payment webhooks | https://dashboard.razorpay.com → Account & Settings → Webhooks → edit | any long random string (`openssl rand -hex 32`) | A test webhook shows 200 in Razorpay's delivery log |
| 6 | `GOOGLE_CLIENT_SECRET` | "Continue with Google" | https://console.cloud.google.com/apis/credentials → the OAuth client → *Reset secret* | new secret | Google sign-in completes |
| 7 | `GITHUB_CLIENT_SECRET` | "Continue with GitHub" | https://github.com/settings/developers → OAuth Apps → the app → *Generate a new client secret*, then delete the old one | new secret | GitHub sign-in completes |
| 8 | `MICROSOFT_CLIENT_SECRET` | Nothing now: Microsoft sign-in was removed | https://portal.azure.com → App registrations → the app → Certificates & secrets → delete the secret (and the app registration if nothing else uses it); remove the variable from Render | nothing | `/auth/microsoft/login` returns 404 |
| 9 | `EMAIL_PASSWORD` (+ `EMAIL_USERNAME`) | Sends OTP and notification email | Gmail: https://myaccount.google.com/apppasswords (revoke the old one, create a new one). If it was the mailbox's real password, change it and turn on 2FA for that mailbox | new app password | A password-reset code email arrives |
| 10 | `SERPER_API_KEY` | Web search | https://serper.dev/api-key | new key | Web search returns sources |
| 11 | `TAVILY_API_KEY` | Web search | https://app.tavily.com | new key | same |
| 12 | `BRAVE_API_KEY` | Web search | https://api-dashboard.search.brave.com | new key | same |
| 13 | `GOOGLE_CSE_API_KEY` | Web search | https://console.cloud.google.com/apis/credentials → the API key → *Regenerate* | new key | same |
| 14 | `DATABASE_URL` password (backend if not SQLite; frontend `frontend/.env.local` for drizzle/pg), `NEXTAUTH_SECRET` or any other value in `frontend/.env.local` | Database access; auth secret | your database provider's dashboard; for `NEXTAUTH_SECRET`, `openssl rand -base64 32` in Netlify | new password / secret | App starts and connects; the old password is refused |

Not secrets (no rotation needed): `ALLOWED_ORIGINS`, `*_REDIRECT_URI`, `FRONTEND_REDIRECT_URL`, `BACKEND_PUBLIC_URL`, `REASONING_MODEL`, `VISION_MODEL`, `EMAIL_SMTP_HOST/PORT`, `MAIL_FROM`, `NEXT_PUBLIC_*`. `ADMIN_EMAILS` isn't secret, but it reveals admin identities: make sure those accounts have strong, unique passwords and 2FA.

## 5. History purge: done 2026-09-27

**Backups taken first** (in the session container, and removed when the session ends; the originals also remain on GitHub until its GC or GitHub Support clears them):
- a byte-for-byte copy of the working directory: `Vatsa-_ai-backup-20260927` (1.4 GB);
- `git bundle` of all refs: `vatsa-full-backup.bundle` (129,664,863 bytes, `git bundle verify` OK);
- a mirror clone of GitHub before the rewrite.

**Command run** (one pass, on a fresh mirror clone with `refs/pull/*` removed):
```bash
git filter-repo --force --invert-paths \
  --path vatsaai.com/vatsaai.zip --path vatsaai-backend.zip --path vatsaai-backend-FINAL.zip \
  --path-glob '*.env' --path-glob '*.env.local' --path-glob '*.db' --path-glob '*.sqlite' --path-glob '*.sqlite3' \
  --path-glob '*.zip' --path-glob '*.tar' --path-glob '*.tar.gz' --path-glob '*.tgz' --path-glob '*.rar' --path-glob '*.7z' \
  --path-glob '*.pem' --path-glob '*.key'
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```
(`*.env` doesn't match `.env.example` or `frontend/.env.production`, which contain no secrets and stay.)

**Verified before pushing:**
- `git log --all --full-history -- '*.zip' '*.env' '*.db' '*.sqlite' '*.sqlite3' '*.tar' '*.tar.gz' '*.rar' '*.pem' '*.key'` → empty.
- The three archive blobs (`bbec56e…`, `340b50a…`, `cbcc068…`) are no longer in the repository.
- Commits 169 → 167 (the two commits that only added archives became empty). Pack 123.75 MiB → 42.29 MiB.
- File trees: `claude/awesome-volta-npmdue` is byte-identical (tree `dd47587…`). `main` and `feat/ai-router-engine-and-auth-hardening` differ only by the two deleted archives (`git diff --name-status`: `D vatsaai-backend-FINAL.zip`, `D vatsaai.com/vatsaai.zip`).
- `scan_history.py` with an empty baseline: 0 secret-bearing items. The fake test key's `.gitleaksignore` fingerprint was re-issued for its new commit SHA.
- Full test suites on the rewritten branch (see TEST_REPORT.md).

**After the purge (owner):**
1. **GitHub Support:** a force-push doesn't delete the old commits from GitHub's storage. They stay reachable by SHA (for example `https://github.com/bv4623-svg/Vatsa-_ai/commit/9ca0cba70c9f`) and through closed pull requests' refs until GitHub Support removes them. Open a request at https://support.github.com/contact with the repository name and the old SHAs `9ca0cba70c9f`, `43d432c6cb6b` and `a8b4a691e1cb`, citing *Removing sensitive data from a repository*.
2. **Forks and old clones** keep the old history. Check https://github.com/bv4623-svg/Vatsa-_ai/forks. Anyone with a clone must delete it and re-clone; never push from an old clone, or the files come back (the CI history scan would then fail).
3. **Open PRs** were rewritten along with their branches. PR #2 now points at the new SHAs.

## 6. Verification checklist

- [x] `git log --all --full-history -- '*.zip' '*.env' '*.db' '*.sqlite'` is empty (local, and in a fresh clone from GitHub)
- [x] `python tools/security/scan_history.py --baseline tools/security/history-baseline.json` exits 0 with an **empty** baseline
- [ ] CI "Secret scan (tree + full history)" green on `main` after PR #2 merges (it is green on the PR branch)
- [ ] `https://github.com/bv4623-svg/Vatsa-_ai/commit/9ca0cba70c9f` returns 404 (after GitHub Support)
- [ ] Every row in §4 shows its "how to verify" result
- [ ] Re-encrypt script: `undecryptable: 0`
- [ ] Password-reset emails sent / notification decision recorded (§3)

## 7. Preventing a repeat

- **Pre-commit hook** `.githooks/pre-commit` refuses `.env` files (except examples and the public `frontend/.env.production`), databases, archives and key material. It requires example env files to leave secret-looking keys empty, and scans the staged diff with gitleaks if it's installed. Enable once per clone: `git config core.hooksPath .githooks`.
- **CI "Secret scan" job:** 30 guard tests, a check of every tracked file, and a full-history scan of all branches with gitleaks. With the baseline now empty, **any** secret-bearing file anywhere in history fails the build.
- **`.gitignore`:** `.env*`, `*.env`, `*.db`, `*.sqlite*`, `*.zip`, `*.tar*`, `*.tgz`, `*.rar`, `*.7z`, `Backend/uploads/`, `Backend/generated_images/`, `frontend/.next/`, virtualenvs.
- **At rest:** 2FA secrets encrypted, backup codes HMAC-hashed (`Backend/app/services/crypto.py`).
