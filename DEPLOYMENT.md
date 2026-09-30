# Deploying Vatsa AI (Netlify + Razorpay)

> **Short version:** [DEPLOY.md](DEPLOY.md) has the copy-paste steps. This file has the background.

**Architecture.** Netlify hosts the Next.js frontend. The FastAPI backend runs on a separate host (Render, Railway, Fly.io or a VPS), because Netlify Functions are JavaScript only. The browser talks to the backend directly over HTTPS at `NEXT_PUBLIC_API_URL`.

**Prices.** Exactly two things can be bought: **Pro $24** and **Business $99**, each one payment for 30 days, no auto-renewal, tax-inclusive. INR uses one fixed rate, **$1 = ₹83** (Pro ₹1,992, Business ₹8,217), USD shown first everywhere.

| Where prices live | File |
|---|---|
| Frontend (single source) | `frontend/src/config/pricing.ts` |
| Backend (single source) | `Backend/app/config/pricing.py` |

To change a price or the rate, edit **both** files and nothing else. `npm run check:pricing` fails if they disagree or if any other file contains a currency amount. Netlify runs it before every build.

---

## 1. Razorpay setup (test mode first)

1. Sign in at dashboard.razorpay.com and switch the toggle to **Test Mode**.
2. **Account & Settings → API Keys → Generate Test Key.** Copy the Key Id (`rzp_test_…`) and Key Secret. The secret is shown once.
3. **International Payments** must be enabled on the account for USD charges (request it from the dashboard's Account & Settings if it is not already on). INR works without it. Razorpay will not take USD payments until it is enabled.
4. Set **payment capture to Automatic** in the dashboard's Account & Settings. Manual capture would leave payments authorised but never settled, and this app only upgrades on `captured`.
5. Put the keys in the **backend** environment only (see §2). Never in Netlify, never in frontend code.

> The test key pair that was in `frontend/.env.local` returned **401 Unauthorized** from Razorpay's Orders API when this build was checked, so it has been revoked or regenerated. Generate a fresh pair, and treat the old one as compromised (its secret appeared in a development session log).

## 2. Deploy the backend

The backend ships as a Docker image built from `Backend/Dockerfile` (build context `Backend/`, Python 3.14 slim, runs as a non-root user). The image contains `app/`, `alembic/`, `alembic.ini`, `intents_data.py` and `start.sh`; it does **not** contain `scripts/` or `tests/`. The container's entrypoint is `Backend/start.sh`, which runs, in order:

| Step | Command | What it does |
|---|---|---|
| 1 | `python -c "from app.database import init_db; init_db()"` | creates any missing tables from the models; never touches existing data |
| 2 | `alembic stamp head` | only if the database has no `alembic_version` table yet: marks the schema `init_db()` just built as current |
| 3 | `alembic upgrade head` | applies migrations added since |
| 4 | `uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1 --timeout-graceful-shutdown 30` | serves the API (one worker: each extra worker is a full copy of the process on a 512 MB instance) |

Any failing step stops the container. When uvicorn starts, `enforce_secrets()` (`Backend/app/main.py`, lifespan) refuses to serve if a secret is missing, malformed or leaked (`Backend/app/core/secrets_check.py`). This runs after steps 1–3, so the database is touched before the secrets are checked.

Required environment variables (names in `Backend/.env.example`). In production (`APP_ENV=production`, or `RENDER=true`, which Render sets) the app refuses to start without the ones marked **startup check**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string (`postgresql://…`). Not in the startup check: if it is unset the app silently falls back to SQLite inside the container, which is wiped on every redeploy |
| `REDIS_URL` | Upstash Redis connection URL. Optional: rate limits, the read cache and the scheduled-task job store use it; unset or unreachable, each falls back to in-process memory |
| `JWT_SECRET_KEY` | **startup check**, 32+ chars; new random 64+ chars (`python -c "import secrets; print(secrets.token_urlsafe(64))"`) |
| `DATA_ENCRYPTION_KEY` | **startup check**; Fernet key for 2FA secrets (`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`) |
| `ALLOWED_ORIGINS` | **startup check**; your Netlify origin(s), e.g. `https://vatsaai.com,https://www.vatsaai.com` |
| `BACKEND_PUBLIC_URL` | **startup check**; the backend's own https URL |
| `FRONTEND_REDIRECT_URL` | **startup check**; your Netlify origin |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | test keys now, live keys at go-live |
| `RAZORPAY_WEBHOOK_SECRET` | any strong string; paste the same one into the dashboard (§4) |
| `ADMIN_EMAILS` | comma-separated emails allowed to look payments up at `/api/admin/payments?email=`; leave empty to disable. Each admin also needs 2FA on and a normal login session |
| `OPENROUTER_API_KEY` | **startup check**; AI provider |
| `EMAIL_*`, `MAIL_FROM` | SMTP for OTP/notification mail |
| `GOOGLE_*`, `GITHUB_*` | at least one of the two: Google/GitHub are the only way to sign up. The `*_REDIRECT_URI` values must use the backend's https URL and be registered with each provider |

**Storage.** Users, payments and every other table live in **Neon Postgres** (`DATABASE_URL`); shared rate limits, the read cache and scheduled-task jobs use **Upstash Redis** (`REDIS_URL`). Both are external, so a redeploy loses nothing in them. Uploads and generated images are different: with `STORAGE_BACKEND=local` (what `render.yaml` sets) they are written under `DATA_DIR`, which is unset on Render, so they land in `/app/uploads` and `/app/generated_images` inside the container. A free instance has no persistent disk, and Render wipes that filesystem on every redeploy, restart and idle spin-down, so those files are lost then. To keep them, set `STORAGE_BACKEND=s3` with the `S3_*` variables (see `Backend/.env.example`). `DATA_DIR` and SQLite remain the local-development defaults only.

**Render.** `render.yaml` at the repo root is the Blueprint that runs all of the above: service `vatsaai-backend`, `runtime: docker`, `dockerfilePath: ./Backend/Dockerfile`, `dockerContext: ./Backend`, `plan: free`, region Singapore, health check `/health`, auto-deploy on push. It has no start command; the container runs `start.sh`. A free instance spins down after 15 minutes without traffic, so the first request after that waits for a cold start. If `enforce_secrets()` or any `start.sh` step fails, the new instance never passes its health check and Render keeps the previous deploy live. Copy-paste steps: [DEPLOY.md](DEPLOY.md).

**Proxy headers.** `start.sh` starts uvicorn without `--proxy-headers --forwarded-allow-ips`, which the previous start command passed. OAuth state cookies take `secure` from the request scheme (`Backend/app/routers/auth/oauth/state.py`), and uvicorn only trusts `X-Forwarded-Proto` from `127.0.0.1` unless told otherwise, so behind Render's proxy those cookies are set without `Secure`.

**Pre-deploy check.** `Backend/scripts/predeploy_check.py` (secrets, database reachable, data directory writable) is **no longer run automatically on Render**: the old `startCommand` that ran it is gone, and the startup secrets check above replaces its secrets part. CI still runs it (pushes to `main` and every pull request) with throwaway values. It can't run in the Render Shell: the image has no `scripts/`, and free instances have no Shell. To run it against production values yourself, see [DEPLOY.md §1.4](DEPLOY.md#1-backend-on-render).

Check: `GET https://<backend>/health` returns `{"status":"ok",…}` and `GET https://<backend>/payment/config` returns `"configured": true`.

## 3. Deploy the frontend on Netlify

1. New site → import the Git repo. `netlify.toml` at the repo root already sets base directory `frontend`, the build command (`npm run check:pricing && npm run build`) and Node 22. Netlify installs its Next.js adapter automatically.
2. **Site configuration → Environment variables:** set `NEXT_PUBLIC_API_URL` to the backend's https origin (no trailing slash). It is inlined at build time, so redeploy after changing it. Set nothing named `RAZORPAY_*`.
3. Deploy, then **Domain management → add your domain**. Netlify provisions the HTTPS certificate automatically; enable "Force HTTPS".
4. Go back to the backend and make sure `ALLOWED_ORIGINS` contains the final Netlify/custom origin exactly (scheme + host, no path).

Not verified from here: Netlify's docs confirm Next.js 16 support through its adapter but do not mention the Next 16 `proxy.ts` file specifically. This app's `proxy.ts` gates private pages on a session cookie and forwards `/api/*`. After the first deploy, open `/chat` while logged out. It must redirect to `/login`. If it does not, the adapter is not running `proxy.ts` and that needs fixing before launch.

## 4. Razorpay webhook

Dashboard → Account & Settings → Webhooks → Add New Webhook (in Test Mode first):

- URL: `https://<backend>/payment/webhook`
- Secret: the value of `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured` and `refund.processed`

`payment.captured` upgrades the account even if the customer closes the tab right after paying. `refund.processed` ends access for a fully refunded payment.

## 5. Business details Razorpay will check

Fill in `frontend/src/config/business.json`:

```json
{
  "legalName": "<name exactly as on your Razorpay KYC>",
  "addressLines": ["<street>", "<area>", "<city>, <state> <6-digit PIN>", "India"],
  "phone": "+91 …"
}
```

These feed About, Contact, Terms, Privacy, Cookies, Refund and Payments, so every page shows the same details. Then run `npm run check:business` in `frontend/`. It must print no FAIL before you submit the site to Razorpay.

## 6. Verification-readiness checklist

Status as of this build.

| # | Requirement | Status |
|---|---|---|
| 1 | Only $24 and $99 anywhere (`npm run check:pricing`) | PASS |
| 2 | INR from one documented rate, both currencies shown, USD first | PASS |
| 3 | Razorpay is the only gateway; no other SDK or mention | PASS |
| 4 | Secrets server-side only; `/payment/config` exposes only the public key id | PASS |
| 5 | Signature verification + webhook + refund handling, covered by 40 backend tests | PASS |
| 6 | Home, Pricing, Contact, Privacy, Terms, Refund & Cancellation, About, Payments pages exist and link to each other | PASS |
| 7 | No placeholder/stub pages (`/payment` was an empty stub and is rebuilt) | PASS |
| 8 | Same business identity on every page (fake San Francisco address and `@vatsa.ai` emails removed) | PASS |
| 9 | Mobile (375 px) has no horizontal scroll on 11 checked pages | PASS |
| 10 | Production build succeeds (42 routes) | PASS |
| 11 | Legal business name shown | **FAIL**, set `legalName` (§5) |
| 12 | Full postal address with PIN shown | **FAIL**, set `addressLines` (§5) |
| 13 | Phone number shown | **FAIL**, set `phone` (§5) |
| 14 | A real Razorpay test order can be created | **FAIL**, current test key returns 401; generate a new pair (§1) |
| 15 | USD payments enabled on the Razorpay account | **UNVERIFIED**, needs a valid key to test |
| 16 | Public HTTPS URL on Netlify | **PENDING**, deploy (§3) |
| 17 | Webhook registered and receiving events | **PENDING**, needs the deployed backend (§4) |
| 18 | `proxy.ts` behaves on Netlify | **UNVERIFIED**, see the note in §3 |

## 7. Go live

Do these only after the smoke tests in §8 pass in test mode.

1. Complete Razorpay's KYC/activation so Live Mode is available.
2. Live Mode → **Generate Live Key** (`rzp_live_…`). Enable **International Payments** in Live Mode if you sell in USD.
3. Add the webhook again in **Live Mode** (§4). Live and test webhooks are separate, and each has its own secret.
4. On the backend host, replace `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` with the live values and restart.
5. No frontend change or Netlify redeploy is needed: the checkout page reads the key id from the backend.
6. Run §8 again with real money.

## 8. Smoke test

Test mode uses the test cards and UPI ids in Razorpay's documentation (search "Razorpay test card details"); use an international test card for the USD payments. Live mode uses a real card and real money.

1. **$24 transaction.** Sign in with a fresh account, open `/pricing`, choose Pro, pay in **USD**. Expect the celebration screen, the account showing Pro, and one row in the Razorpay dashboard for 24.00 USD with status `captured`.
2. **$99 transaction.** With a second fresh account, choose Business, pay in USD. Expect Business, 99.00 USD.
3. **INR path.** Choose Pro, switch the toggle to INR. Expect ₹1,992.00 charged.
4. **Refund test.** In the dashboard open the $24 payment → **Refund → Full**. Within a few seconds `refund.processed` reaches the backend; the account drops back to Free. In the webhook log the delivery shows 200.
5. **Browser closed test.** Start a payment, complete it, and close the tab before the success screen. Sign in again: the account is Pro (the webhook fulfilled it).
6. **Failure test.** Use Razorpay's documented failing test method; expect an error message and the account still on Free.
