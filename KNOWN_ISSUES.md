# Known issues

Everything open or deliberately accepted after the round-2 audit (2026-09-27). **No P0, P1 or P2 is open.** Each entry has a severity (same scale as BUG_FIXES.md), an owner, and either the plan or the reason it's accepted.

Owners: **Owner** = repository owner / product decision · **Backend** / **Frontend** = engineering · **Ops** = hosting and deployment.

| ID | Sev | Area | Issue | Status | Owner |
|---|---|---|---|---|---|
| KI-01 | P1* | Security | Secrets and databases are still in **git history** (3 archives). The code side is done; the purge and rotations need owner action | Waiting on owner: [SECURITY_ACTIONS.md](SECURITY_ACTIONS.md) | Owner |
| KI-02 | P3 | Plans | Free users can attach images to chat (image understanding), though the plans table lists Vision as Pro (was BUG-024) | Accepted risk | Owner |
| KI-03 | P3 | Scale | Rate limiter and search cache are per process: with N workers, limits are ×N and the cache isn't shared | Accepted for a single worker (the current Render setup) | Backend |
| KI-04 | P3 | Data | Daily limits are check-then-increment: simultaneous requests can exceed a cap by the number in flight | Accepted | Backend |
| KI-05 | P3 | Portability | Hard account deletion lists tables via `sqlite_master`/`PRAGMA` (SQLite only); on Postgres the cascade would fail | Open | Backend |
| KI-06 | P3 | Chat | Regenerate replaces the old reply in the UI, but the server conversation keeps both attempts | Open | Backend + Frontend |
| KI-07 | P3 | Perf | `GET /api/conversations` returns every message of every conversation (see TEST_REPORT §Performance for measurements) | Open | Backend + Frontend |
| KI-08 | P3 | Dead code | `frontend/src/db/` (drizzle/pg template) is imported nowhere but keeps `pg`, `drizzle-orm`, `drizzle-kit` and a frontend `DATABASE_URL` around; `drizzle.config.json` holds a local-dev default `postgres:postgres@127.0.0.1` (not a secret) | Open | Frontend |
| KI-09 | P3 | CI | GitHub warns that checkout@v4 / setup-node@v4 / setup-python@v5 target Node 20 and are forced onto Node 24 | Open | Ops |
| KI-10 | P3 | Launch | `npm run check:business` fails until the legal name, postal address and phone are set (Razorpay verification needs them) | Waiting on owner | Owner |
| KI-11 | P3 | Legal | Privacy policy statements were corrected to match the code (BUG-040); the whole policy needs legal review. The "anonymous usage analytics" paragraph was not verified | Waiting on owner | Owner |
| KI-12 | P3 | Voice | Depends on the browser: Firefox has no speech recognition (button disabled with an explanation); Chrome and Edge send audio to the vendor's speech service | Accepted (documented in the privacy policy) | – |
| KI-13 | P3 | Code | Python runs in the browser with the standard library only (no pip packages) | Accepted; roadmap item | Frontend |
| KI-14 | P3 | Lint | 16 ESLint warnings remain (no errors): `<img>` vs `next/image`, `window.location` navigation, hook dependency hints | Open | Frontend |
| KI-15 | P3 | Library | "Revoke link" in the share dialog acts on one click (the old link stops working; re-sharing issues a new one), and its copy button ignores clipboard failures | Open: needs one new string in all 12 locales, which weren't guessed | Frontend |
| KI-16 | P3 | Dead code | `components/settings/settings-modal.tsx` is mounted with `open={false}` in `RootShell` and can never open; its "Delete all" only cleared local state. The live settings dialog is `components/home/SettingsModal.tsx` | Open: delete it | Frontend |

\* KI-01 is rated P1 only because the exposure is live until the purge and rotations happen; no code change can fix it.

## Details

### KI-01 · Secrets in git history
The full-history scan (`tools/security/scan_history.py`) finds `vatsaai.com/vatsaai.zip` (`Backend/.env`, `frontend/.env.local`, and three database copies, one nested inside `Backend/vatsa-ai-debug.zip`) plus two source archives. CI tolerates exactly these 9 known items (`tools/security/history-baseline.json`) and fails on anything new. The purge commands were rehearsed locally. **Next step:** follow SECURITY_ACTIONS.md §2 in order.

### KI-02 · Free-plan image attachments (accepted risk)
Blocking it would take away a capability free users have today; that's a pricing decision, not a bug fix. The cost is bounded: 25 chat messages/day × at most 4 images per message = **at most 100 image inputs per free user per day** (`MAX_IMAGE_ATTACHMENTS`, `DAILY_LIMITS["chat_messages"]["free"]`). **To change:** add a `vision_chat` daily limit in `feature_access.py` and check it in `chat.py::_parse_attachments` when images are present.

### KI-03 · Per-process rate limits and cache
`app/utils/rate_limit.py` and `search_service._search_cache` live in process memory. They're correct for one worker. **Before scaling out:** move both to Redis (the same keys and windows).

### KI-04 · Daily-limit overshoot under concurrency
`check_daily_limit` runs before the provider call and `increment_usage` (atomic) after success, so N simultaneous requests at the cap can all pass the check. The overshoot is at most the concurrency of one user. This is accepted because charging before success (the old behaviour) billed users for failures (BUG-018).

### KI-05 · SQLite-only deletion cascade
`services/account/deletion.py::_tables_with_user_id` uses SQLite catalog queries. **Fix when moving to Postgres:** use `sqlalchemy.inspect(engine).get_table_names()` / `get_columns()`.

### KI-06 · Regenerate keeps history server-side
The client drops the old exchange before re-sending; the server appends a new pair. Reloading shows both attempts. **Fix:** a `replace_last` flag on `/api/chat` that pops the trailing user/assistant pair before persisting.

### KI-07 · Conversation list payload
The home page loads all conversations with their full message arrays in one request. See TEST_REPORT.md "Performance" for size and time. **Fix:** a summary list endpoint (id, title, flags, timestamps) and messages loaded per conversation when opened; the frontend's `useHomeConversations` currently reads `conv.messages` from the list.

### KI-08 · Unused database template in the frontend
Remove `frontend/src/db/`, `drizzle.config.json` and the `pg`/`drizzle-*` dependencies, regenerate the lockfile, and drop `DATABASE_URL` from the frontend docs.

### KI-09 · Node 20 actions deprecation
Bump to the current majors of `actions/checkout`, `actions/setup-node` and `actions/setup-python`. The versions weren't verified from inside this session, so they weren't guessed.

### KI-14 · Remaining lint warnings
All pre-existing. `no-img-element` fires on user-generated and data-URL images, where `next/image` doesn't apply.
