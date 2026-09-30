# Deploy Vatsa AI: copy-paste steps

**Platforms:** backend on **Render** (`render.yaml` at the repo root), frontend on **Netlify** (`netlify.toml` at the repo root). Background and Razorpay details: [DEPLOYMENT.md](DEPLOYMENT.md). Why the secrets must be new: [SECURITY_ACTIONS.md](SECURITY_ACTIONS.md).

A **startup secrets check** protects every backend deploy (step 1.4). The app refuses to start with a missing, malformed or leaked secret, so Render keeps the previous deploy live.

---

## 1. Backend on Render

**1.0 Before you start**, have these two external services ready (the Render service stores nothing that must survive a redeploy):
- **Neon Postgres** (https://console.neon.tech): the database. Copy its connection string (`postgresql://…`) for `DATABASE_URL`.
- **Upstash Redis** (https://console.upstash.com): shared rate limits, cache and scheduled-task jobs. Copy its Redis connection URL for `REDIS_URL`.

**1.1 Create the service.** Go to https://dashboard.render.com/blueprints → **New Blueprint Instance** → connect `bv4623-svg/Vatsa-_ai` → branch `main` → **Apply**.
- Render reads `render.yaml`, which creates the `vatsaai-backend` web service.
- The service is a **Docker** service on the **Free** plan in Singapore. Render builds `Backend/Dockerfile` with `Backend/` as the build context. There is no disk and no start command: the container runs `Backend/start.sh`.
- `JWT_SECRET_KEY` is generated for you.

If a service already exists, open it → **Settings** and check it matches: **Runtime** Docker, **Dockerfile Path** `./Backend/Dockerfile`, **Docker Build Context Directory** `./Backend`, **Health Check Path** `/health`, **Instance Type** Free, and no Start Command override.

`render.yaml` points the backend at `https://api.vatsaai.com` and the frontend at `https://vatsaai.com` (see "Set by `render.yaml`" below). Attach `api.vatsaai.com` under the service's **Settings → Custom Domains**, or change those values in `render.yaml` for another domain.

**1.2 Fill in the variables Render asks for** (the `sync: false` ones in `render.yaml`; they're never stored in Git). The ones marked **required** must be set: without the startup-check ones the app refuses to start, and without `DATABASE_URL` it starts on a throwaway SQLite file inside the container.

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | **required** | the Neon connection string from 1.0 |
| `DATA_ENCRYPTION_KEY` | **required** (startup check) | run `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` and paste the output |
| `OPENROUTER_API_KEY` | **required** (startup check) | a **new** key from https://openrouter.ai/settings/keys |
| `REDIS_URL` | recommended | the Upstash URL from 1.0 (blank = each feature falls back to in-process memory) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | for payments | a **newly regenerated** pair from https://dashboard.razorpay.com (Account & Settings → API Keys) |
| `RAZORPAY_WEBHOOK_SECRET` | for payments | `openssl rand -hex 32`; paste the same value into the Razorpay webhook (step 3) |
| `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `MAIL_FROM` | for password-reset emails | Gmail address + a **new** app password from https://myaccount.google.com/apppasswords |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google and/or GitHub: the only way to sign up | a **reset** secret from https://console.cloud.google.com/apis/credentials |
| `GOOGLE_LINK_REDIRECT_URI` | with Google sign-in | `https://api.vatsaai.com/auth/google/link/callback` (blank = falls back to the sign-in URL and "Connect Google" in Settings fails). Register it in the Google OAuth client too |
| `ADMIN_EMAILS` | optional | your email, for `/api/admin/*` (also needs 2FA) |

Not in `render.yaml`, so add them yourself under **Environment → Add Environment Variable** if you use them:

| Variable | Value |
|---|---|
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | from your GitHub OAuth app; only if you use the GitHub button |
| `GITHUB_REDIRECT_URI` | `https://api.vatsaai.com/api/auth/github/callback`, registered in the GitHub OAuth app |
| `SERPER_API_KEY`, `TAVILY_API_KEY`, `BRAVE_API_KEY` | optional extra search providers |
| `STORAGE_BACKEND=s3` + `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION` | to keep uploads and generated images across redeploys (see [DEPLOYMENT.md](DEPLOYMENT.md) §2, "Storage") |

Set by `render.yaml`, no action needed: `ENV=production`, `APP_ENV=production`, `TRUSTED_PROXY_COUNT=1`, `JWT_SECRET_KEY` (generated), `ALLOWED_ORIGINS=https://vatsaai.com,https://www.vatsaai.com`, `FRONTEND_REDIRECT_URL=https://vatsaai.com`, `BACKEND_PUBLIC_URL=https://api.vatsaai.com`, `GOOGLE_REDIRECT_URI=https://api.vatsaai.com/api/auth/google/callback`, `EMAIL_SMTP_HOST=smtp.gmail.com`, `EMAIL_SMTP_PORT=587`, `STORAGE_BACKEND=local`, `DB_POOL_SIZE=2`, `DB_MAX_OVERFLOW=2`, `DB_POOL_RECYCLE_SECONDS=300`, `CACHE_ENABLED=true`.

**1.3 Deploy.** Render builds the Docker image from `Backend/Dockerfile` (dependencies from `requirements.txt` on Python 3.14), then the container runs `Backend/start.sh`:
```
python -c "from app.database import init_db; init_db()"   # create missing tables
alembic stamp head                                          # only if there's no alembic_version table yet
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1 --timeout-graceful-shutdown 30
```
Any failing step stops the container, and the deploy log shows which one.

**1.4 The startup secrets check** (`enforce_secrets()` in `Backend/app/main.py`, rules in `Backend/app/core/secrets_check.py`). It runs when uvicorn starts, after the database steps above, and refuses to start if:
- a required variable (`JWT_SECRET_KEY`, `DATA_ENCRYPTION_KEY`, `OPENROUTER_API_KEY`, `ALLOWED_ORIGINS`, `BACKEND_PUBLIC_URL`, `FRONTEND_REDIRECT_URL`) is missing or a placeholder, or `JWT_SECRET_KEY` is shorter than 32 characters;
- `DATA_ENCRYPTION_KEY` isn't a valid Fernet key;
- **any secret still has a value that leaked in git history** (checked against one-way fingerprints in `Backend/app/core/leaked_secret_fingerprints.json`).

It does not check `DATABASE_URL` or `REDIS_URL`. On failure, the deploy log lists each problem by variable name (never the value). The new instance never becomes healthy, so Render keeps the previous version live. Fix the variable in **Environment** and redeploy.

**The pre-deploy check is no longer run automatically.** `Backend/scripts/predeploy_check.py` used to run before uvicorn from `render.yaml`'s `startCommand`; the Docker service has no start command, so Render never runs it now. CI still runs it (pushes to `main` and every pull request) with throwaway values. It can't be run in the Render Shell: the Docker image doesn't include `scripts/`, and free instances have no Shell. To run it against the production values, use a local checkout (`pip install -r requirements.txt` done) and paste each secret from Render → **Environment** at a hidden prompt (bash), so it stays out of your shell history and out of `Backend/.env`. Exported values take precedence over anything in `Backend/.env`.
```bash
cd Backend
export APP_ENV=production ALLOWED_ORIGINS='https://vatsaai.com,https://www.vatsaai.com' BACKEND_PUBLIC_URL='https://api.vatsaai.com' FRONTEND_REDIRECT_URL='https://vatsaai.com'
for v in DATABASE_URL JWT_SECRET_KEY DATA_ENCRYPTION_KEY OPENROUTER_API_KEY; do read -rsp "$v: " val; echo; export "$v=$val"; done
python -m scripts.predeploy_check
```
Add other secrets to the `for` list to have them checked for leaks too (`RAZORPAY_KEY_SECRET`, `EMAIL_PASSWORD`, …). The data-directory check tests your local `Backend/` folder, not the container. Close the terminal afterwards.

**1.5 Check the backend.**
```bash
curl -s https://api.vatsaai.com/health           # {"status":"ok",...}
curl -s https://api.vatsaai.com/payment/config   # "configured": true once Razorpay keys are set
```
A free instance sleeps after 15 minutes without traffic; the first request after that can take a while.

## 2. Frontend on Netlify

**2.1** Go to https://app.netlify.com → **Add new site → Import an existing project** → GitHub → `bv4623-svg/Vatsa-_ai` → branch `main`. Leave the build settings alone: `netlify.toml` sets base `frontend`, the command `npm run check:pricing && npm run build` and Node 22.

**2.2** **Site configuration → Environment variables:**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | the backend URL from 1.1 (`https://api.vatsaai.com`), no trailing slash |
| `NEXT_PUBLIC_SITE_URL` | `https://vatsaai.netlify.app` (or your domain) |

Never add anything named `RAZORPAY_*`, `*_SECRET` or `DATABASE_URL` to Netlify: `NEXT_PUBLIC_*` values are visible in the browser. Without these variables, the build uses the public values in `frontend/.env.production`.

**2.3** **Deploy site.** Then open `https://<site>/home` in a private window: it must redirect to `/login`.

## 3. Razorpay webhook

https://dashboard.razorpay.com → Account & Settings → **Webhooks** → Add:
- URL: `https://api.vatsaai.com/payment/webhook`
- Secret: the `RAZORPAY_WEBHOOK_SECRET` from 1.2
- Events: `payment.captured`, `refund.processed`

## 4. After the first deploy (one time, from a local checkout)

These scripts can't run on Render: the Docker image has no `scripts/` folder and free instances have no Shell. Run them from `Backend/` on your machine, pointed at the production Neon database. Paste the values from Render → **Environment** at the hidden prompt, as in 1.4. Without `DATABASE_URL` they run against a local SQLite file and change nothing in production. Use a checkout of the commit that is deployed: both scripts call `init_db()`, which creates in Neon any table your local models have and production doesn't.

```bash
cd Backend
export FRONTEND_REDIRECT_URL='https://vatsaai.com'
for v in DATABASE_URL JWT_SECRET_KEY DATA_ENCRYPTION_KEY EMAIL_USERNAME EMAIL_PASSWORD MAIL_FROM; do read -rsp "$v: " val; echo; export "$v=$val"; done

# 1) Re-encrypt 2FA secrets under DATA_ENCRYPTION_KEY (must end with undecryptable: 0)
python -m scripts.reencrypt_two_factor --apply

# 2) Accounts that were in the leaked database copy: list them, then force a reset and email them
python -m scripts.force_password_reset
python -m scripts.force_password_reset --apply --notify
```
`JWT_SECRET_KEY` is needed so step 1 can read secrets sealed with the key derived from it. The `EMAIL_*`/`MAIL_FROM` values are only used by `--notify`.

## 5. Verify

- `/health` OK, sign-up email arrives, login works, a chat message gets a reply.
- An old session token fails: `curl -H "Authorization: Bearer <old token>" https://api.vatsaai.com/auth/me` → 401.
- Razorpay test payment completes (DEPLOYMENT.md §8).
- CI is green on `main`: https://github.com/bv4623-svg/Vatsa-_ai/actions

## 6. Optional: CAPTCHA on sign-in (Cloudflare Turnstile)

Starting a Google/GitHub sign-in can require a Cloudflare Turnstile check. It is the only CAPTCHA in the app: `/login` and `/signup` share that start, so both show it; chat, reviews, feedback, 2FA and password reset never do, and a signed-in visitor never sees it. **Off until you do the steps below.**

1. **Keys.** https://dash.cloudflare.com → **Turnstile** → **Add widget**: name `Vatsa AI sign-in`, hostnames `vatsaai.com` and `www.vatsaai.com` (plus any staging host), **Widget mode: Managed** (invisible for most people). Copy the **Site key** and the **Secret key**.
2. **Frontend first.** In the frontend host's build environment set `NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key>`, rebuild and deploy. The buttons now wait for the check; the backend still ignores the token, so nothing can break yet.
3. **Then the backend.** On Render → the API service → *Environment*: `TURNSTILE_SECRET_KEY=<secret key>`, `TURNSTILE_ENABLED=true`, deploy. With `TURNSTILE_ENABLED=true` and no secret the server refuses to start, and Render keeps the previous deploy.
4. **Check.**
   - `/login`: "Checking your browser…" for a moment, then Google/GitHub sign-in works.
   - A sign-in started without a token is refused:
     `curl -s -o /dev/null -w "%{http_code} %{redirect_url}
" https://<backend>/api/auth/google/login` → `307 https://<frontend>/auth/callback?error=captcha_required`.
5. **Turn it off:** `TURNSTILE_ENABLED=false` on Render (the frontend can keep the site key). **Rotate the secret:** Cloudflare → Turnstile → the widget → *Rotate secret key*, then update Render.

Doing step 3 before step 2 refuses every sign-in until the frontend has the site key. If Cloudflare is down, sign-in still works (fail-open, SECURITY_ACTIONS.md §8).
