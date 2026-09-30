# Deploy Vatsa AI: copy-paste steps

**Platforms:** backend on **Render** (`render.yaml` at the repo root), frontend on **Netlify** (`netlify.toml` at the repo root). Background and Razorpay details: [DEPLOYMENT.md](DEPLOYMENT.md). Why the secrets must be new: [SECURITY_ACTIONS.md](SECURITY_ACTIONS.md).

A **pre-deploy gate** protects every backend deploy (step 1.4). It stops a deploy that has a missing, malformed or leaked secret.

---

## 1. Backend on Render

**1.1 Create the service.** Go to https://dashboard.render.com/blueprints → **New Blueprint Instance** → connect `bv4623-svg/Vatsa-_ai` → branch `main` → **Apply**.
- Render reads `render.yaml`, which creates the `vatsaai-backend` web service.
- The service runs Python 3.11.9 on the Starter plan, from `Backend/`, with a 5 GB disk at `/data`.
- `JWT_SECRET_KEY` is generated for you.

If a service already exists, open it → **Settings** and check it matches: **Root Directory** `Backend`, the **Start Command** from `render.yaml`, and a disk mounted at `/data`.

**1.2 Fill in the variables Render asks for** (they're never stored in Git). The ones marked **required** must be set, or the gate stops the deploy.

| Variable | Required | Value |
|---|---|---|
| `DATA_ENCRYPTION_KEY` | **required** | run `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` and paste the output |
| `OPENROUTER_API_KEY` | **required** | a **new** key from https://openrouter.ai/settings/keys |
| `ALLOWED_ORIGINS` | **required** | `https://vatsaai.netlify.app` (plus your custom domain, comma-separated) |
| `FRONTEND_REDIRECT_URL` | **required** | `https://vatsaai.netlify.app` |
| `BACKEND_PUBLIC_URL` | **required** | this service's URL, e.g. `https://vatsaai-backend.onrender.com` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | for payments | a **newly regenerated** pair from https://dashboard.razorpay.com (Account & Settings → API Keys) |
| `RAZORPAY_WEBHOOK_SECRET` | for payments | `openssl rand -hex 32`; paste the same value into the Razorpay webhook (step 3) |
| `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `MAIL_FROM` | for password-reset emails | Gmail address + a **new** app password from https://myaccount.google.com/apppasswords |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google and/or GitHub: the only way to sign up | a **reset** secret from https://console.cloud.google.com/apis/credentials |
| `GOOGLE_REDIRECT_URI` | with Google sign-in | `https://vatsaai-backend.onrender.com/auth/google/callback` (blank = Google sign-in fails) |
| `GOOGLE_LINK_REDIRECT_URI` | with Google sign-in | `https://vatsaai-backend.onrender.com/auth/google/link/callback` (blank = falls back to the sign-in URL and "Connect Google" in Settings fails) |
| `GITHUB_CLIENT_ID`/`_SECRET` | Google and/or GitHub | only if you use the GitHub button |
| `SERPER_API_KEY`, `TAVILY_API_KEY`, `BRAVE_API_KEY` | optional | extra search providers |
| `ADMIN_EMAILS` | optional | your email, for `/api/admin/*` (also needs 2FA) |

Set by `render.yaml`, no action needed: `APP_ENV=production`, `DATA_DIR=/data`, `TRUSTED_PROXY_COUNT=1`, `PYTHON_VERSION=3.11.9`, `JWT_SECRET_KEY`.

**1.3 Deploy.** Render builds (`pip install -r requirements.txt`), then starts the service with:
```
python -m scripts.predeploy_check && uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"
```

**1.4 The pre-deploy gate** (`Backend/scripts/predeploy_check.py`). It runs before the server and fails the deploy if:
- a required variable is missing, a placeholder, or (for `JWT_SECRET_KEY`) shorter than 32 characters;
- `DATA_ENCRYPTION_KEY` isn't a valid Fernet key;
- **any secret still has a value that leaked in git history** (checked against one-way fingerprints in `Backend/app/core/leaked_secret_fingerprints.json`);
- the database isn't reachable, or `/data` isn't a writable disk.

On failure, the deploy log lists each problem by variable name (never the value). The new instance never becomes healthy, so Render keeps the previous version live. Fix the variable in **Environment** and redeploy.

The app runs the same secrets check at startup. To run the gate yourself: `cd Backend && python -m scripts.predeploy_check` (CI runs it on every push).

**1.5 Check the backend.**
```bash
curl -s https://vatsaai-backend.onrender.com/health           # {"status":"ok",...}
curl -s https://vatsaai-backend.onrender.com/payment/config   # "configured": true once Razorpay keys are set
```

## 2. Frontend on Netlify

**2.1** Go to https://app.netlify.com → **Add new site → Import an existing project** → GitHub → `bv4623-svg/Vatsa-_ai` → branch `main`. Leave the build settings alone: `netlify.toml` sets base `frontend`, the command `npm run check:pricing && npm run build` and Node 22.

**2.2** **Site configuration → Environment variables:**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | the backend URL from 1.2, no trailing slash |
| `NEXT_PUBLIC_SITE_URL` | `https://vatsaai.netlify.app` (or your domain) |

Never add anything named `RAZORPAY_*`, `*_SECRET` or `DATABASE_URL` to Netlify: `NEXT_PUBLIC_*` values are visible in the browser. Without these variables, the build uses the public values in `frontend/.env.production`.

**2.3** **Deploy site.** Then open `https://<site>/home` in a private window: it must redirect to `/login`.

## 3. Razorpay webhook

https://dashboard.razorpay.com → Account & Settings → **Webhooks** → Add:
- URL: `https://vatsaai-backend.onrender.com/payment/webhook`
- Secret: the `RAZORPAY_WEBHOOK_SECRET` from 1.2
- Events: `payment.captured`, `refund.processed`

## 4. After the first deploy (one time, in the Render **Shell** tab)

```bash
cd /opt/render/project/src/Backend

# 1) Re-encrypt 2FA secrets under DATA_ENCRYPTION_KEY (must end with undecryptable: 0)
python -m scripts.reencrypt_two_factor --apply

# 2) Accounts that were in the leaked database copy: list them, then force a reset and email them
python -m scripts.force_password_reset
python -m scripts.force_password_reset --apply --notify
```

## 5. Verify

- `/health` OK, sign-up email arrives, login works, a chat message gets a reply.
- An old session token fails: `curl -H "Authorization: Bearer <old token>" https://vatsaai-backend.onrender.com/auth/me` → 401.
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
