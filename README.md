# Vatsa AI

One workspace to chat, search the web, run deep research, generate images, write and run code, read PDFs and photos, and talk, with every answer grounded and every failure explained.

- **Web app:** Next.js 16 / React 19 in [`frontend/`](frontend/)
- **API:** FastAPI in [`Backend/`](Backend/)
- **Docs:** [PRD.md](PRD.md) (product spec, API contracts) · [TEST_REPORT.md](TEST_REPORT.md) · [BUG_FIXES.md](BUG_FIXES.md) · [CHANGELOG.md](CHANGELOG.md) · [DEPLOYMENT.md](DEPLOYMENT.md)

## Features

| Feature | Plan | What it does |
|---|---|---|
| Chat | All | Streaming answers, fallback across models, memory, projects, response styles |
| Web search | All (5/day Free) | Parallel multi-provider search, numbered citations, source list, 10-min cache |
| Deep research | Business | Plans 2–5 queries, searches them in parallel, streams a structured report citing up to 15 sources |
| Image generation | All (20/day Free) | "generate an image of…", "draw…", "/imagine…"; re-hosted, watermark-trimmed |
| Code workspace | All (3/day Free) | Named files, live preview in an isolated sandbox, JS and Python runner, console, ZIP download |
| Voice | Pro | Dictation with live transcript, Talk mode (auto-send + spoken replies), Read aloud |
| PDF / document upload | All | PDF, DOCX, XLSX, text/code files; scanned-PDF detection; up to 25 MB |
| Image upload | All (Analyze: Pro) | Photos as model input (auto-downscaled); structured analysis with OCR |
| Library, projects, scheduled tasks, 2FA, API keys, export | – | See PRD §4.9 |

## Repository layout

```
Backend/            FastAPI app (app/), tests (tests/), Render blueprint
  app/routers/      HTTP endpoints (chat, research, upload, vision, files, library, …)
  app/services/     ai_service, search_service, research_service, image_service, feature_access, …
frontend/           Next.js app
  src/app/          routes (/home = chat, /code = code workspace, …)
  src/lib/          pure logic (SSE parser, preview builder, voice, attachments) + unit tests
  e2e/              Playwright end-to-end tests with a mocked API
shared/             fixtures shared by backend and frontend tests
.github/workflows/  CI
```

## Quick start (local)

**Backend** (Python 3.11+)
```bash
cd Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env         # set JWT_SECRET_KEY, OPENROUTER_API_KEY, ALLOWED_ORIGINS=http://localhost:3000
uvicorn app.main:app --reload --port 8000
```
Interactive API docs: http://localhost:8000/docs

**Frontend** (Node 22)
```bash
cd frontend
npm ci
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                  # http://localhost:3000
```

## Configuration

All secrets come from environment variables. Never commit `.env` files (they are gitignored; CI runs a secret scan). Full, commented list: [`Backend/.env.example`](Backend/.env.example) and [`frontend/.env.example`](frontend/.env.example).

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `JWT_SECRET_KEY` | backend | **yes** | Signs sessions; the app refuses to start without it |
| `OPENROUTER_API_KEY` | backend | yes, for AI | Chat, research, vision models |
| `REASONING_MODEL`, `VISION_MODEL` | backend | no | Override the reasoning / vision model |
| `SEARXNG_URL`, `SERPER_API_KEY`, `TAVILY_API_KEY`, `BRAVE_API_KEY`, `GOOGLE_CSE_*` | backend | no | Extra search providers (DuckDuckGo always runs) |
| `SEARCH_CACHE_TTL_SECONDS` | backend | no | Search cache lifetime (default 600) |
| `IMAGE_PROVIDER_URL` | backend | no | Override the image provider endpoint |
| `DATA_DIR` | backend | prod | Persistent directory for the database, uploads and images |
| `DATABASE_URL` | backend | no | Defaults to SQLite in `DATA_DIR` |
| `ALLOWED_ORIGINS`, `FRONTEND_REDIRECT_URL`, `BACKEND_PUBLIC_URL` | backend | prod | CORS and absolute URLs |
| `EMAIL_*`, `MAIL_FROM` | backend | for OTP email | SMTP |
| `GOOGLE_*`, `GITHUB_*`, `MICROSOFT_*` | backend | for OAuth | OAuth apps |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | backend | for payments | Checkout and webhooks |
| `ADMIN_EMAILS` | backend | no | Admin allow-list |
| `NEXT_PUBLIC_API_URL` | frontend (build time) | yes | Public API origin |
| `NEXT_PUBLIC_SITE_URL` | frontend | prod | Canonical / Open Graph URLs |

## Testing

```bash
cd Backend  && python -m pytest -q                         # 213 tests, providers mocked
cd frontend && npm test                                    # 118 unit tests (Vitest)
cd frontend && npm run lint && npm run typecheck
cd frontend && npx playwright install chromium && npm run test:e2e   # 54 E2E runs, desktop + mobile
```
No test calls a real model, search or image service. See [TEST_REPORT.md](TEST_REPORT.md) for the full matrix and the manual pre-release checklist.

## API

The main contracts (chat SSE events, research stages, upload/vision responses, error shapes, status codes) are documented in [PRD.md §6](PRD.md#6-api-contracts-and-data-flow). Every endpoint is browsable at `/docs` (Swagger) on a running backend.

Error shapes:
- `{"detail": "human sentence"}`
- `{"detail": {"error": "upgrade_required" | "daily_limit_reached" | "storage_limit_reached", "feature": "…", …}}` (402/429/413; the UI opens the upgrade flow)
- Streaming errors: `data: {"error": "…", "code": "…", "retryable": true}`

## User guide

- **Chat:** type and press Enter (Shift+Enter for a new line). Stop with the square button. Each reply has Copy, Regenerate, Read aloud (Pro), rating and Share. On a phone the actions are always visible.
- **Web search:** switch on **Search** (globe). Answers cite sources like [1] and list them underneath. If search couldn't run (limit or outage), a yellow note on the reply says so.
- **Deep research (Business):** switch on **Research** (telescope) and ask a question. You'll see "Planning… → Searching (N queries)… → Reading N sources…", then a report with Summary, Key findings, Details and Open questions. Expand **Reasoning** to see the searches it ran.
- **Images:** ask "generate an image of…", "draw…" or start with "/imagine". Questions *about* images or drawing (e.g. "draw conclusions from this data") get normal answers. In the Code workspace, "draw…" means write code.
- **Code workspace (/code):** describe what to build. Files open with their real names; the preview runs HTML with its CSS/JS, a lone JavaScript file, or a Python script (in your browser; standard library only). **Run** re-runs, **Console** shows output and errors, the arrow button opens the preview in a new tab, and the download button saves a ZIP. Generated code runs in an isolated sandbox and cannot access your account.
- **Voice (Pro):** tap the mic and speak; your words appear as you talk. Turn on **Talk** (headphones) to have each question sent when you stop speaking and the reply read aloud. Voice uses your browser's speech features: Chrome, Edge and Safari support dictation; Firefox doesn't.
- **Files:** use the paperclip. PDF, Word, Excel, text and code files are read into the conversation; images (PNG/JPEG/WEBP/GIF) are shown to the model. A chip turns red with the reason if a file can't be used (e.g. scanned PDF, password-protected, too large, unsupported type). On Pro, the sparkle on an image chip gives a structured analysis with any text in the image.

## Deployment

Frontend on Netlify, API on Render with a persistent disk: see [DEPLOYMENT.md](DEPLOYMENT.md). Set every production secret in the host's environment settings, never in the repository.

## Security

Report vulnerabilities privately to the support email set in `frontend/src/config/business.json` (`supportEmail`). See PRD §8 for the security model (sandboxed code preview, ownership checks, upload validation, SSRF guard, secret handling).
