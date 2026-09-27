# Vatsa AI: Product Requirements Document

| | |
|---|---|
| Status | Current as of 2026-09-27 (audit rounds 1 and 2). Describes shipped behaviour. |
| Owner | Vatsa AI |
| Scope | Web app (Next.js, `frontend/`) and API (FastAPI, `Backend/`) |
| Related | [README.md](README.md), [TEST_REPORT.md](TEST_REPORT.md), [BUG_FIXES.md](BUG_FIXES.md), [KNOWN_ISSUES.md](KNOWN_ISSUES.md), [SECURITY_ACTIONS.md](SECURITY_ACTIONS.md), [CHANGELOG.md](CHANGELOG.md), [DEPLOYMENT.md](DEPLOYMENT.md) |

The previous PRD file was an engineering repair brief and is kept at [docs/archive/REPAIR-BRIEF.md](docs/archive/REPAIR-BRIEF.md).

---

## 1. Product overview and goal

Vatsa AI is a single web workspace for people who want one assistant that can chat, look things up, research a topic in depth, write and run code, make images, read documents and photos, and talk.

**Goal:** a user can go from question to trustworthy, usable output without switching tools. Every answer that depends on the outside world is grounded and cited. Every failure says what happened and what to do next.

**Product principles**

1. **Grounded, not guessed.** Web answers and research reports cite numbered sources, and the model is told never to invent facts.
2. **One identity.** The assistant is always "Vatsa AI". No provider, model or search-backend name reaches the user (API responses, stored messages, errors).
3. **Fail loudly and kindly.** No silent drops: an attachment that can't be used, a search that was skipped, or a model outage is shown to the user in plain language with a retry path.
4. **Safe by default.** Generated code runs in an isolated sandbox; uploads are validated by content, not by name; users only ever see their own data.
5. **Pay for what works.** Daily allowances are charged only when the feature actually delivered.

## 2. Target users and use cases

| Persona | Needs | Typical use cases |
|---|---|---|
| **Student / learner** (Free) | Explanations, homework help, summaries | Explain a concept; summarise a PDF; generate a diagram-style image |
| **Knowledge worker** (Pro) | Fast answers with sources, document work, voice on the go | Web-grounded answers; analyse a spreadsheet; dictate a question on a phone; have a reply read aloud |
| **Developer / maker** (Pro) | Generate and try code quickly | Build a small web page and preview it; run a JS/Python snippet; download the project as a ZIP |
| **Analyst / team lead** (Business) | Deep, cited research | Multi-step research reports with 10–15 sources; recurring scheduled prompts; shared projects |

## 3. Plans and limits (source of truth: `Backend/app/services/feature_access.py`)

| Capability | Free | Pro | Business |
|---|---|---|---|
| Chat messages / day | 25 | 2,000 | 2,000 |
| Code workspace messages / day | 3 | 500 | 500 |
| Image generations / day | 20 | 200 | 200 |
| Web searches / day | 5 | 500 | 500 |
| Vision (image analysis) | – | 100/day | 100/day |
| Voice (dictation + read-aloud) | – | ✓ | ✓ |
| Reasoning ("Think") | – | 200/day | 200/day |
| Code sandbox (live preview beyond 30 s) | preview blurs after 30 s | ✓ | ✓ |
| Deep research | – | – | 20/day |
| API keys | – | ✓ | ✓ |

Prices live only in `Backend/app/config/pricing.py` and `frontend/src/config/pricing.ts` (Pro $24, Business $99 per 30 days). A build-time check enforces that they match.

## 4. Features, user stories and acceptance criteria

Each feature lists its user stories, then acceptance criteria. Each criterion is covered by an automated test unless marked **(manual)**. Test IDs refer to [TEST_REPORT.md](TEST_REPORT.md).

### 4.1 Chat (core)

**Stories**
- As a user, I type a message and see the reply stream in word by word.
- As a user, I can stop a reply, regenerate it, retry a failed one, copy, share and rate it.
- As a user, my conversations are saved, and I can rename, pin, favourite, duplicate, archive and delete them.
- As a user, the assistant remembers facts I told it (long-term memory) and follows my response-style preference and project instructions.

**Acceptance criteria**
- Replies stream over SSE; the stored conversation contains exactly the user message and the final reply (CHAT-01, CHAT-02, E2E-CHAT-01).
- If the primary model fails, the next model in the fallback chain answers and the user sees one coherent reply (CHAT-03).
- If every model fails, the user sees "AI service is temporarily unavailable. Please try again." plus a **Try again** button. No provider name, model id or upstream body is ever shown (CHAT-04, E2E-CHAT-03).
- Failed replies are not saved and do not use the daily allowance (CHAT-05, IMG-14).
- Messages over 200,000 characters or with more than 10 attachments are rejected with 422 (CHAT-06).
- The daily limit returns 429 `daily_limit_reached` and opens the upgrade flow (CHAT-07, E2E-CHAT-05).
- A user can never read or write another user's conversation (CHAT-08, SMOKE-CONV-02).
- Retry and Regenerate replace the previous attempt; the question is never shown twice (E2E-CHAT-03).
- Message actions are visible on touch screens (no hover needed) and every icon button has an accessible name (E2E-CHAT-06).

### 4.2 Web search

**Stories**
- As a user, I switch on **Search** and get an answer grounded in live results with numbered citations and a source list.
- As a user, if search couldn't run, I'm told the answer isn't grounded.

**Acceptance criteria**
- All configured providers run in parallel (DuckDuckGo always, plus SearxNG/Serper/Tavily/Brave/Google CSE/Wikipedia when configured). Results are de-duplicated by URL, ranked by relevance and returned with `index`, `domain`, `favicon` (SEARCH-06..08).
- The query sent to providers is the user's own words: inlined attachment text is removed and the query is capped at 400 characters (SEARCH-01..03).
- Identical queries within `SEARCH_CACHE_TTL_SECONDS` (default 600) are served from cache (SEARCH-09).
- If the daily search limit is reached or every provider fails, the chat still answers and carries a `notice` that is shown on the reply (SEARCH-13..14, E2E-CHAT-02).
- Search quota is used only when results were returned (SEARCH-15).
- Server-side page fetches (snippet enrichment) never reach private, loopback, link-local or metadata addresses and never follow redirects (SEARCH-04..05).
- Source objects never name the search backend (SEARCH-16).

### 4.3 Deep research (Business)

**Stories**
- As a Business user, I switch on **Research**, ask a question and watch progress (planning → searching N queries → reading N sources) before a structured, cited report streams in.
- As a Pro/Free user, the Research button explains that it is a Business feature and opens the upgrade flow.

**Acceptance criteria**
- `POST /api/research` streams `stage` events, report `delta`s, then `done` with `sources` and `queries` (RES-08, E2E-RES-01).
- The model plans 2–5 queries; plans in JSON, fenced JSON or list form are understood; unusable plans fall back to the question itself (RES-01..03, RES-10).
- All queries are searched concurrently. Failed individual searches are skipped. Sources are interleaved, de-duplicated and renumbered, with at most 15 (RES-04..05, RES-11).
- The report has Summary, Key findings, Details, and Open questions sections, cites sources inline, and carries the identity seal (RES-09).
- No sources: a clear error with code `no_sources`, not charged (RES-12, E2E-RES-02).
- Writer failure: generic retryable error, no provider details, not charged (RES-13).
- Business-only (402 for Free/Pro), 20/day, 2,000-character question limit, conversation ownership enforced (RES-06..07, RES-14..15).
- The report, sources and planned searches are saved to the conversation (RES-08).

### 4.4 Image generation

**Stories**
- As a user, I ask "generate an image of…", "draw…", "/imagine…" and get a picture in the chat.
- As a user, asking about drawing conclusions, image carousels or image classifiers gets me a text answer, not a picture.

**Acceptance criteria**
- Intent detection is identical on server and client and passes every case in `shared/image-intent-cases.json`: 12 positive, 14 negative, 2 code-workspace (IMG-01..03, FE-IMG-*).
- Never triggers in the code workspace or when a file is attached (IMG-10..11).
- Provider calls retry 429/5xx/timeouts (3 attempts, back-off), reject non-image, empty, oversized (>20 MB) or undecodable responses, and use a fresh seed so regenerate gives a new image (IMG-04..09).
- Images are watermark-trimmed, branded, stored under the user's data directory and served only to their owner through a media-scoped token (IMG-09, IMG-12..13).
- Image links in stored conversations are re-signed on every read, so they keep working after the 7-day token expires (IMG-16).
- Failure returns 502 with a generic message and keeps the quota (IMG-14). The limit is 20/day on Free (IMG-15).
- The UI shows an animated loading grid, then the image with alt text (E2E-IMG-01).

### 4.5 Code generation and execution

**Stories**
- As a developer, I describe an app; files appear with their real names; the live preview shows the page with its CSS and JS working.
- As a developer, I can run a lone JavaScript or Python file and see its console output.
- As a developer, I can edit code in the editor, switch device widths, open the preview in a tab and download a ZIP.

**Acceptance criteria**
- File names come from the fence info string, a first-line comment or the preceding heading; otherwise `file.<ext>` with de-duplication; path traversal is rejected (FE-PARSE-*).
- HTML previews inline the referenced `styles.css`/`script.js` (and apply unreferenced ones); `$` sequences and `</script>` inside code are preserved safely (FE-PREV-*).
- A lone `.js` runs in a console runner, a lone `.py` runs in the browser via Pyodide 0.29.5 (stdlib only), and a lone `.css` previews on sample markup. Anything else explains why it can't run (FE-PREV-*, E2E-CODE-02).
- **Security:** the preview iframe is sandboxed **without** `allow-same-origin`. Generated code cannot read the app's localStorage (session token), cookies or parent DOM. "Open in new tab" frames the preview in the same sandbox (FE-PREV-01, FE-PREV-standalone, E2E-CODE-01).
- The console panel shows log/warn/error and uncaught errors, accepts messages only from the preview iframe, and shows an error-count badge (E2E-CODE-01..02).
- The Free plan preview blurs after 30 s (upgrade prompt).

### 4.6 Voice mode (Pro)

**Stories**
- As a Pro user, I tap the mic, speak, and my words appear in the composer as I talk.
- As a Pro user, in **Talk** mode each utterance is sent automatically and the reply is read aloud.
- As a Pro user, I can have any reply read aloud and stop it.

**Acceptance criteria**
- Speech-to-text and text-to-speech use the browser's Web Speech API; no audio is sent to Vatsa AI servers (E2E-VOICE-01..03).
- A live interim transcript is shown while listening; final text is appended to the composer (E2E-VOICE-01).
- Errors are explained: microphone blocked, no microphone, no network, no speech, unsupported language (FE-VOICE-*, E2E-VOICE-04).
- Browsers without SpeechRecognition (e.g. Firefox) show a disabled mic with an explanation (E2E-VOICE-05).
- Read-aloud strips code, links and citations and speaks in sentence-sized chunks, so long replies aren't cut off (FE-VOICE-*).
- Free users get the upgrade flow (E2E-VOICE-06).

### 4.7 PDF and document upload

**Stories**
- As a user, I attach a PDF/DOCX/XLSX or text/code file and ask about it.
- As a user, if the file can't be read, the chip tells me why.

**Acceptance criteria**
- Authenticated only; 30 uploads/minute/user; max 25 MB; empty files rejected; file content must match its extension (UP-01..08).
- PDFs: up to 300 pages; scanned PDFs return a "scanned or image-only" warning; corrupted and password-protected PDFs return specific messages; truncation (50,000 chars or page cap) is flagged (UP-09..14).
- DOCX/XLSX: zip-bomb guard (200 MB inflated), clear errors, large sheets stop at the text budget (UP-15..17).
- Parsing runs off the event loop. Parser exception text is never returned.
- Uploaded bytes are stored in the user's Library (UP-19).
- Client-side, unsupported or oversized files are rejected before upload with a specific reason. Each chip updates independently; chips have accessible names; the remove button works on touch screens (FE-ATT-*, E2E-UP-*).
- Extracted text is inlined into the message once and not sent twice (E2E-UP-01).

### 4.8 Image upload and analysis

**Stories**
- As a user, I attach a photo and ask about it; the model sees the image.
- As a Pro user, I tap **Analyze** on an image for a structured description, tags, objects and OCR text.

**Acceptance criteria**
- PNG/JPEG/WEBP/GIF only. Images are downscaled in the browser to 1,568 px on the long edge before sending (GIF passes through). The server rejects invalid data URLs, >8 MB, or more than 4 images per message with a specific 400/413 (UP-20..23, FE-ATT-*).
- `/api/vision/analyze` checks the real image bytes (not the declared type), caps prompts at 2,000 characters, is Pro-only (402) with 100/day, tolerates non-JSON model output, and uses the allowance only on success (UP-24..30).
- On the Free plan, Analyze opens the upgrade flow rather than showing an error (E2E-UP-07).

### 4.9 Other existing features

| Feature | Summary | Coverage |
|---|---|---|
| Auth | Email + password with OTP verification, Google/GitHub/Microsoft OAuth, TOTP 2FA with backup codes, password reset, rate-limited login | existing + SMOKE-AUTH-* |
| Conversations | CRUD, pin, favourite, archive, duplicate, workspace filter | SMOKE-CONV-* |
| Memory | Automatic fact extraction after each reply + manual CRUD | SMOKE-MEM-01 |
| Library | Every upload, generated image and conversation as a file; folders, rename, download, storage quota, public share links | SMOKE-LIB-* |
| Projects | Group chats and files with a system prompt applied to every message | SMOKE-PROJ-* |
| Scheduled tasks | Cron-scheduled prompts with pause/resume/run-now | SMOKE-SCHED-* |
| Account | Export (ZIP of own data), deletion with grace period, API keys (paid), connected accounts, notifications, sign-out-other-devices | SMOKE-ACC-* |
| Billing | Razorpay orders, signature verification, webhooks, payment ledger, refunds | existing payment suites (40 tests) |
| Intent classifier | 27-intent keyword + TF-IDF classifier (`/api/classify`) | SMOKE-CLS-01 |

## 5. Technical architecture and dependencies

```
Browser (Next.js 16 / React 19, Zustand, Tailwind)
 │  fetch + SSE (Bearer JWT from localStorage; vatsa_session cookie gates pages)
 ▼
FastAPI (Backend/app/main.py) ── SQLAlchemy ── SQLite (DATA_DIR/vatsa.db) or DATABASE_URL
 ├─ routers/chat.py        → services/ai_service.py ──► OpenRouter (model chain)
 │                         → services/search_service.py ──► DDG / SearxNG / Serper / Tavily / Brave / CSE / Wikipedia
 │                         → services/image_service.py ──► image provider (Pollinations by default)
 ├─ routers/research.py    → services/research_service.py (plan → search ×N → synthesize)
 ├─ routers/upload.py      → pdfplumber / python-docx / openpyxl (threadpool)
 ├─ routers/vision.py      → OpenRouter vision model
 ├─ routers/files.py       → generated images (media-token auth)
 ├─ library, projects, scheduled_tasks (APScheduler), memory, account, auth, payment (Razorpay)
 └─ services/feature_access.py  (plan gates + daily limits; charge-on-success)

Code preview:  generated files → lib/code/preview.ts → <iframe srcdoc sandbox="allow-scripts …"> (opaque origin; Python from /pyodide/)
                                                     └─ postMessage console bridge → parent console panel
Voice:         Web Speech API (SpeechRecognition / speechSynthesis) in the browser only
```

**Key dependencies:** FastAPI ≥ 0.118 (keeps the request DB session open during streaming responses), SQLAlchemy 2, aiohttp, ddgs, pdfplumber, python-docx, openpyxl, Pillow, APScheduler, python-jose, bcrypt, pyotp; Next.js 16, React 19, Zustand, react-markdown, Monaco, framer-motion, lucide-react; Pyodide 0.29.5 (self-hosted under `/pyodide/`, copied from npm at build time, loaded only inside the sandbox); Vitest and Playwright for tests.

**Hosting:** frontend on Netlify, API on Render with a persistent disk at `DATA_DIR` (see [DEPLOYMENT.md](DEPLOYMENT.md)).

## 6. API contracts and data flow

All endpoints take `Authorization: Bearer <JWT>` unless noted. Errors are `{"detail": string}` or, for plan and limit gates, `{"detail": {"error": "upgrade_required" | "daily_limit_reached" | "storage_limit_reached", "feature", ...}}`.

### 6.1 `POST /api/chat` (also `/api/chat/stream`, `/api/chat/send`)

Request:
```json
{ "message": "string ≤ 200000", "conversation_id": "conv_…", "workspace": "chat|code",
  "stream": true, "web_search": false, "reasoning": false, "model": "auto",
  "attachments": [{ "name": "p.png", "type": "image/png", "is_base64": true, "content": "data:image/png;base64,…" }] }
```
Streaming response (`text/event-stream`), one JSON object per `data:` line:
```
{"notice": "Daily web search limit reached -- answered without live results. …"}   (optional, first)
{"thinking": "…"}                                    (reasoning mode only)
{"delta": "…"}                                        (repeated)
{"done": true, "usage": {...}, "conversation_id": "…", "sources": [...], "reasoning": "…"}
{"error": "…", "code": "ai_unavailable|insufficient_tokens", "retryable": true|false}   (terminal)
```
Image requests return JSON `{ "response", "image_url", "primary_intent": "image_generation", ... }` even when `stream=true`.

Status codes: 400 empty message or invalid attachment, 402 insufficient tokens, 413 attachment or storage too large, 422 validation, 429 daily limit, 502 image or model unavailable.

### 6.2 `POST /api/research`
Request `{ "message": "≤ 2000 chars", "conversation_id": "optional" }`. SSE events: `{"stage":"planning"}`, `{"stage":"searching","queries":[…]}`, `{"stage":"writing","source_count":n}`, `{"delta":…}`, `{"done":true,"sources":[…],"queries":[…],"usage":{…}}`, or `{"error","code":"no_sources|ai_unavailable|internal","retryable"}`. 402 below Business, 429 over 20/day, 404 foreign conversation.

### 6.3 `POST /api/upload` (multipart `file`)
Response `{ file_id, filename, chars, size_bytes, text, truncated, warning, pages?, pages_parsed?, sheets? }`. Errors: 400 empty, unsupported or mismatched content; 401; 413 too large or storage full; 422 unreadable (corrupted, password-protected, zip bomb); 429 rate limited.

### 6.4 `POST /api/vision/analyze` (multipart `file`, optional `prompt`)
Response `{ status, description, tags[], objects[], extracted_text, usage }`. Errors: 400 invalid image, 402 plan, 413 > 10 MB, 429 limit, 502 model unavailable.

### 6.5 `GET /api/files/{image_id}/preview?token=<media token>`
PNG for the owner only; 401 without or with an invalid token; 404 for other users' images.

### 6.6 Search source object
`{ index, title, url, snippet, domain, favicon, quality: "high|medium|low", published_date }`. The backend provider is never included.

### 6.7 Data flow: chat with web search
1. The client sends the message (text attachments inlined after `--- File:` markers; images as data URLs).
2. The server checks the plan and daily limit, loads history, and validates attachments.
3. If web search is on, the server builds a clean query, reads cache or runs providers in parallel, and formats numbered context.
4. The system prompt is assembled: identity, search results, memory, project instructions, style, and the identity seal last.
5. The server streams from the model chain, then saves the exchange, syncs the Library item, charges usage, and extracts memory in the background.

## 7. Error handling and edge cases

| Situation | Behaviour |
|---|---|
| All models down | Generic retryable error; nothing saved; allowance not charged; UI offers **Try again** |
| Stream fails part-way | Partial text kept with "⚠️ …" appended; marked as error |
| Slow network / long image generation | Loading grid / typing indicator; image provider 60 s timeout ×3 attempts; chat model 30 s gap timeout per model |
| Offline | "You're offline. Check your connection and try again." |
| Provider rate limit (429) | Image: retried with back-off. Search: that provider is skipped. Chat: next model in chain |
| User rate limit | Daily limits → 429 + upgrade flow; uploads 30/min; login attempts limited |
| Session expired | 401 → "Your session expired. Please sign in again." / redirect to login |
| Empty input | Send disabled; server 400 |
| Huge input | 200k-char message cap; 25 MB upload cap; 50k extracted chars (flagged); 300 PDF pages (flagged) |
| Scanned PDF | Chip shows "No selectable text found… attach pages as images" |
| Unsupported file | Chip shows the supported types; never silently dropped |
| Web search skipped | Reply carries a visible notice |
| Research finds nothing | "Couldn't find any sources…" (not charged) |
| Voice unsupported / blocked | Disabled mic with reason / "Microphone access is blocked…" |
| Generated code misbehaves | Runs in an opaque-origin sandbox; errors appear in the console panel |

## 8. Security, privacy and rate limits

- **Secrets:** read from environment only. `JWT_SECRET_KEY` is required at startup. Razorpay secrets live on the backend only. A pre-commit hook and CI block secret-bearing files (`tools/security/forbidden_files.py`), and CI scans the full history of every branch against a baseline (`scan_history.py`). Archives containing `.env` files and a database are still in git history; SECURITY_ACTIONS.md has the rotation list and purge commands for the owner (KI-01).
- **Data at rest:** 2FA TOTP secrets are Fernet-encrypted with `DATA_ENCRYPTION_KEY` (rotation via `DATA_ENCRYPTION_KEYS_OLD`; fallback derived from `JWT_SECRET_KEY`). Backup codes are stored as keyed HMACs and redeemed with a compare-and-swap, so each works exactly once. Deleting an account removes its files from disk.
- **AuthN/Z:** bcrypt passwords (legacy pbkdf2 upgraded on login), 7-day JWTs with `token_version` revocation, optional TOTP 2FA, admin endpoints require allow-listed email + verified email + 2FA. Every owned resource is filtered by `user_id`; foreign ids return 404.
- **Media:** generated images are served with a `scope=media` token that is useless against other endpoints and re-signed on each conversation read.
- **Uploads:** content sniffing (magic bytes / PIL), filename sanitisation, zip-bomb guard, size caps, parsing in a threadpool.
- **SSRF:** server-side fetches of search result URLs are limited to public addresses, with no redirects.
- **Generated code:** sandboxed iframe without `allow-same-origin`; standalone preview wrapped in the same sandbox.
- **Privacy:** voice audio never reaches Vatsa AI servers (browser speech services apply). Account export returns only the requester's data, without password hashes or 2FA secrets. Private mode disables history. "Auto-save chats" off means exchanges aren't stored.
- **Identity:** provider/model names are redacted from all client-visible output and stored messages.
- **Headers:** security headers middleware (API) and HSTS/nosniff/frame/referrer (frontend). CORS is restricted to exact origins.
- **Rate limits:** daily plan limits (section 3), 30 uploads/min/user, login throttling by email and by IP (in-process; see limitations). The client IP is the `X-Forwarded-For` entry added by the outermost trusted proxy (`TRUSTED_PROXY_COUNT`, default 1), so a forged header can't rotate IPs.
- **Transport:** JSON responses over 1 KB are gzip-compressed; SSE streams are not, so they stay incremental.

## 9. Testing strategy

| Layer | Tooling | Scope |
|---|---|---|
| Backend unit + API | pytest + FastAPI TestClient, throwaway SQLite, `DATA_DIR` temp dir | 274 tests: every router and feature, with providers faked (`tests/llm_fakes.py`, mocked search/image/HTTP), plus query-plan/N+1 guards and a concurrency test. 12 opt-in live-provider tests (`VATSA_LIVE_TESTS=1`) |
| Frontend unit | Vitest | 125 tests: intent parity, attachments, SSE parser, preview builder, parser, voice helpers, API error messages |
| End-to-end | Playwright, production build, mocked API (`e2e/mock-api.ts`), Desktop Chrome + Pixel 7 | 75 scenarios × 2 viewports; any uncaught page error fails a test; axe WCAG 2.1 AA scan of 9 screens in both themes |
| Static | ESLint (0 errors), `tsc --noEmit`, pricing consistency check | CI |
| Security | forbidden-file guard (pre-commit + CI), full-history scan with baseline, gitleaks, sandbox isolation E2E, SSRF/upload/ownership/2FA/rate-limit tests | CI + suites |
| Performance | `scripts/profile_routes.py` (500 ms route budget, heavy account), `e2e/perf.spec.ts` (`PERF=1`) | On demand; results in TEST_REPORT §6 |
| Manual | Checklist in TEST_REPORT.md §4 for things that need real providers, microphones or devices | Before each release |

Rule: every bug fix ships with a test that fails without the fix.

## 10. Known limitations

The complete, maintained list, with severity, owner and plan, is [KNOWN_ISSUES.md](KNOWN_ISSUES.md) (KI-01 to KI-18). The most important:

1. **Git history still contains archives with `.env` files and databases** (KI-01). The owner must rotate the secrets and purge history as described in SECURITY_ACTIONS.md.
2. Real-provider behaviour is covered by opt-in live tests that haven't run yet (they need keys and network), plus the manual checklist.
3. Python runs with the standard library only (KI-13). Voice depends on the browser (KI-12).
4. Rate limits and the search cache are per process (KI-03). The deletion cascade is SQLite-only (KI-05).
5. The conversation list returns every message (KI-07), measured at 5.4 MB (1.8 MB gzipped) for a heavy account.
6. Free-plan image attachments are an accepted risk, capped at 100 images per user per day (KI-02).
7. `npm run check:business` fails until the owner fills in the legal details (KI-10).

## 11. Roadmap

**Next (0–1 month)**
- Rotate secrets, purge history (SECURITY_ACTIONS.md), enable GitHub secret scanning push protection.
- Redis-backed rate limiting and search cache shared across workers.
- Server-side regenerate (replace the last exchange instead of appending).
- Conversation summary endpoint with lazy message loading (KI-07).

**Soon (1–3 months)**
- Research: follow-up questions on a report, export to PDF/Doc, per-source quote extraction.
- Code: npm-style packages via an import map / esm.sh in the sandbox; Pyodide micropip for pure-Python wheels; share a runnable preview link.
- Voice: server-side neural TTS voices (Pro), push-to-talk on mobile, language auto-detect.
- Uploads: OCR for scanned PDFs (render pages → vision model), PPTX support, chunked retrieval for documents over 50k chars.
- Image: size/aspect options, image editing (inpainting) from an attached image.

**Later**
- Team workspaces (Business): shared projects, roles, SSO.
- Tool use / agents with explicit, auditable steps.
- Postgres by default; object storage for uploads and images.
