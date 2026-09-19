# Deploying Vatsa AI (Netlify + Razorpay)

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

Working directory: `Backend/`.

```
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"
```

`--proxy-headers` matters: OAuth state cookies are marked `secure` from the request scheme, and behind a TLS-terminating proxy that is only correct with it.

Required environment variables (names in `Backend/.env.example`):

| Variable | Value |
|---|---|
| `JWT_SECRET_KEY` | new random 64+ chars (`python -c "import secrets; print(secrets.token_urlsafe(64))"`) |
| `ALLOWED_ORIGINS` | your Netlify origin(s), e.g. `https://vatsaai.com,https://www.vatsaai.com` |
| `BACKEND_PUBLIC_URL` | the backend's own https URL |
| `FRONTEND_REDIRECT_URL` | your Netlify origin |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | test keys now, live keys at go-live |
| `RAZORPAY_WEBHOOK_SECRET` | any strong string; paste the same one into the dashboard (§4) |
| `ADMIN_EMAILS` | comma-separated emails allowed to look payments up at `/api/admin/payments?email=`; leave empty to disable. Each admin also needs 2FA on and a normal login session |
| `OPENROUTER_API_KEY` | AI provider |
| `EMAIL_*`, `MAIL_FROM` | SMTP for OTP/notification mail |
| `GOOGLE_*`, `GITHUB_*`, `MICROSOFT_*` | only if you keep social login; the `*_REDIRECT_URI` values must use the backend's https URL and be registered with each provider |

**Storage.** SQLite is the database, and uploads and generated images are written to disk too. Set `DATA_DIR` to a directory on a **persistent disk** (e.g. `/data`) and all three go there; leave it unset locally. On an ephemeral filesystem every redeploy wipes users, payments and files. `Backend/render.yaml` is a Render blueprint that does this (paid instance + 5 GB disk + `DATA_DIR=/data`); it has not been run on Render. Render deploys from a Git repo, not a zip. Python 3.14 was used locally; the blueprint pins 3.13.5, which has not been tested against this app.

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
