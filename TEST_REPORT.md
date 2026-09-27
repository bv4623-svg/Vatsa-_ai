# Test report: audit of 2026-09-27 (rounds 1 and 2)

## 1. Summary

Round 2 (follow-up, same day) re-ran everything from a clean state, then added security, accessibility, UX and performance work. Every number below is from runs on 2026-09-27 at the head of PR #2.

| Suite | Tool | Cases | Result |
|---|---|---|---|
| Backend unit + API | pytest (FastAPI TestClient, temp SQLite + `DATA_DIR`) | 274 (213 after round 1, +61 in round 2) | **262 passed, 12 skipped by design** (live-provider tests; opt-in, §7) |
| Security tooling | pytest over `tools/security` (temp git repos) | 30 | **30 passed** |
| Frontend unit | Vitest | 125 (118 after round 1, +7) | **125 passed** |
| End-to-end | Playwright on the production build, mocked API, Desktop Chrome + Pixel 7 | 75 scenarios × 2 viewports = 150 runs (27 scenarios after round 1) | **108 passed, 42 skipped by design** (viewport-specific cases plus the opt-in perf report). Any uncaught page error or unhandled rejection fails a test |
| Accessibility | axe-core (WCAG 2.1 A/AA) in Playwright | 9 screens + a conversation, light and dark | **0 serious/critical violations** |
| Lint | ESLint | – | **0 errors** (16 pre-existing warnings, KI-14) |
| Types | `tsc --noEmit` | – | **clean** |
| Production build | `next build` | – | **passes** |
| Pricing gate | `npm run check:pricing` | – | **passes** |
| Secret scan, tree | `forbidden_files.py --tracked` + gitleaks 8.28 | – | **clean** |
| Secret scan, history | `scan_history.py --baseline` (all refs, archive listings, gitleaks) | 163 commits, all refs | **9 known items, 0 new, 0 gitleaks findings**. The 9 are the archives in SECURITY_ACTIONS.md, waiting for the owner's purge (KI-01) |
| Route latency | `Backend/scripts/profile_routes.py` (heavy account) | 33 GET routes | **all under 500 ms**; slowest ~200 ms (§6) |
| Business-info gate | `npm run check:business` | – | **fails, as before the audit**: legal name, postal address and phone must come from the owner (KI-10) |
| CI | GitHub Actions on PR #2 | backend, frontend, e2e, secret-scan | runs 1–4 green. Run 5 (`100d560`) failed: the dark-theme axe test (one test for 10 scans) timed out at 120 s on the CI runner. It was split into 20 tests (`a11y.spec.ts`), which pass locally in 28 s. The latest run is shown on the PR |

Environment: Python 3.11.15, FastAPI 0.141.1, Starlette 1.7.0, Node 22.22.2, Chromium 141 (Playwright 1.56.1).

**Correction to round 1.** Round 1 reported an axe result for `/`. The test browser was signed in, though, so `/` redirected to `/home`, and the result was really `/home`'s. Scanned signed out, the landing page had 92 (light) and 57 (dark) serious violations. They are fixed now (BUG-054), and the specs visit `/` signed out.

**What automated tests cannot prove** here (real providers, real audio, non-Chromium browsers, screen readers, third-party accounts, multiple workers) is in §4, with the reason for each and the manual steps.

## 2. How to run

```bash
# Backend
cd Backend && pip install -r requirements.txt -r requirements-dev.txt && python -m pytest -q
python scripts/profile_routes.py            # route timings against a seeded heavy account

# Security tooling and scans (repo root)
python -m pytest -q tools/security
python tools/security/forbidden_files.py --tracked
GITLEAKS=/path/to/gitleaks python tools/security/scan_history.py --baseline tools/security/history-baseline.json

# Frontend unit, lint, types
cd frontend && npm ci && npm test && npm run lint && npm run typecheck

# End-to-end (builds against the mock API origin, then runs desktop + mobile)
cd frontend && npx playwright install chromium && npm run test:e2e
PERF=1 npx playwright test e2e/perf.spec.ts --project=desktop   # per-page performance report

# Live providers (opt-in; real keys, real network)
cd Backend && VATSA_LIVE_TESTS=1 OPENROUTER_API_KEY=... python -m pytest -m live -rs
```

CI (`.github/workflows/ci.yml`) runs the backend, frontend and E2E suites, plus a secret-scan job (security-tool tests, the tracked-file check, and the full-history scan against the baseline) on every pull request and on pushes to `main`. `.github/workflows/live-providers.yml` runs the live tests weekly or on demand, using repository secrets.

**Mocking policy.** No automated test calls an external service. The model provider is replaced by `Backend/tests/llm_fakes.py`. Search providers, the image provider (at the HTTP-session level, to exercise retries) and the vision model are monkeypatched per test. E2E tests answer every backend request from `frontend/e2e/mock-api.ts`, and voice tests install a scriptable fake `SpeechRecognition`/`speechSynthesis`.

## 3. Test matrix by feature

Coverage categories: **H** happy path · **E** edge case · **I** invalid input · **0** empty input · **L** large input · **S** slow network / timeout · **F** API failure · **R** rate limit / quota · **P** permissions / plan · **A** auth / ownership · **M** mobile · **D** desktop.

### 3.1 Chat core

| ID | Case | Cat. | Test | Result |
|---|---|---|---|---|
| CHAT-01 | Non-streaming reply returned and saved | H | `test_chat.py::test_non_streaming_happy_path_persists` | PASS |
| CHAT-02 | Streaming reply (SSE) returned and saved | H | `::test_streaming_happy_path_persists` | PASS |
| CHAT-03 | Primary model down → fallback model answers | F | `::test_fallback_chain_used_when_primary_fails` | PASS |
| CHAT-04 | All models down → generic retryable error, no provider details (stream + JSON) | F | `::test_provider_failure_never_leaks_provider_details[True/False]` | PASS |
| CHAT-05 | Failed stream is not saved | F | `::test_failed_stream_is_not_persisted` | PASS |
| CHAT-06 | 200,001-char message → 422 | L I | `::test_oversized_message_rejected` | PASS |
| CHAT-07 | Daily limit → 429 with upgrade shape | R | `::test_daily_limit_returns_upgrade_shape` | PASS |
| CHAT-08 | Can't write into another user's conversation | A | `::test_cannot_write_into_someone_elses_conversation` | PASS |
| CHAT-09 | Whitespace-only message → 400 | 0 | `::test_empty_message_rejected` | PASS |
| CHAT-10 | No token → 401/403 | A | `::test_chat_requires_auth` | PASS |
| CHAT-11 | Identity seal is the last system instruction | E | `::test_identity_seal_is_last_system_instruction` | PASS |
| CHAT-12 | Code workspace prompt asks for named files | H | `::test_code_workspace_prompt_requests_named_files` | PASS |
| FE-SSE | Parser: split chunks, split multi-byte chars, final event without newline, comments/[DONE], non-JSON, notice/stage/error; friendly HTTP/network errors | E I F | `src/lib/home/sse.test.ts` (14) | PASS |
| E2E-CHAT-01 | Type → streamed reply; request has no `userId` | H M D | `chat.spec.ts › streams a reply` | PASS ×2 |
| E2E-CHAT-03 | Outage → friendly error → **Try again** recovers, question shown once | F M D | `› provider outage shows a friendly error…` | PASS ×2 |
| E2E-CHAT-04 | HTTP 500 with object detail never shows raw JSON | F M D | `› HTTP errors never show raw JSON` | PASS ×2 |
| E2E-CHAT-05 | Daily limit → upgrade message | R P M D | `› daily limit opens the upgrade flow` | PASS ×2 |
| E2E-CHAT-06 | Message actions visible without hover on phones (computed opacity 1; negative control on desktop = 0) | M | `› message actions are visible without hover on phones` | PASS (mobile) |

### 3.2 Web search

| ID | Case | Cat. | Test | Result |
|---|---|---|---|---|
| SEARCH-01 | Inlined attachment text stripped from query | L E | `test_web_search.py::test_build_search_query_strips_inlined_attachments` | PASS |
| SEARCH-02 | Query capped at 400 chars, whitespace collapsed | L | `::test_build_search_query_caps_length_and_whitespace` | PASS |
| SEARCH-03 | Empty / attachment-only query → empty | 0 | `::test_build_search_query_empty` | PASS |
| SEARCH-04 | SSRF guard blocks 127.0.0.1, localhost, 169.254.169.254, 10/8, ::1, file://, gopher://, garbage | I A | `::test_ssrf_guard_blocks_internal_targets[8]` | PASS |
| SEARCH-05 | SSRF guard allows a public IP | H | `::test_ssrf_guard_allows_public_ip_literal` | PASS |
| SEARCH-06 | Context is numbered and forbids invention | H | `::test_format_context_numbers_sources_and_forbids_invention` | PASS |
| SEARCH-07 | Ranked, citation-ready results; provider hidden | H | `::test_search_returns_ranked_citation_ready_results` | PASS |
| SEARCH-08 | Same URL (www / trailing slash) de-duplicated | E | `::test_search_dedupes_same_url` | PASS |
| SEARCH-09 | Cache hit skips providers; cached copy can't be mutated | E | `::test_search_cache_hits_skip_providers` | PASS |
| SEARCH-10 | Every provider empty → error | F | `::test_search_raises_when_every_provider_empty` | PASS |
| SEARCH-11 | Blank query rejected | 0 | `::test_empty_query_rejected` | PASS |
| SEARCH-12 | Chat with search returns sources and grounds the prompt (JSON + stream) | H | `::test_chat_with_search_returns_sources_and_grounds_prompt`, `::test_chat_stream_with_search_sends_sources_on_done` | PASS |
| SEARCH-13 | Search quota exhausted → notice, still answers, providers not called | R | `::test_search_quota_exhausted_sends_notice_and_still_answers` | PASS |
| SEARCH-14 | Provider outage → notice | F | `::test_search_outage_sends_notice` | PASS |
| SEARCH-15 | Quota used only on success | R F | `::test_search_uses_quota_only_on_success` | PASS |
| SEARCH-16 | Sources never name the backend | A | `::test_sources_never_name_the_backend` | PASS |
| E2E-CHAT-02 | UI: enable search, notice shown, source list shown | H R M D | `chat.spec.ts › shows web search sources and the notice…` | PASS ×2 |

### 3.3 Deep research

| ID | Case | Cat. | Test | Result |
|---|---|---|---|---|
| RES-01 | Plan parsing: JSON, fenced JSON, numbered list, bullets | E | `test_deep_research.py::test_parse_plan_formats[4]` | PASS |
| RES-02 | Garbage / empty plan → question itself | I 0 | `::test_parse_plan_garbage_falls_back_to_question` | PASS |
| RES-03 | Duplicates removed, capped at 5 queries | L | `::test_parse_plan_dedupes_and_caps` | PASS |
| RES-04 | Sources interleaved, de-duplicated, renumbered | E | `::test_merge_sources_interleaves_dedupes_and_renumbers` | PASS |
| RES-05 | Sources capped | L | `::test_merge_sources_caps_total` | PASS |
| RES-06 | Free and Pro → 402 with Business suggestion | P | `::test_research_is_business_only[free/pro]` | PASS |
| RES-07 | No token → 401/403; empty → 400; >2,000 chars → 422 | A 0 L | `::test_research_requires_auth`, `::test_research_rejects_empty_and_long` | PASS |
| RES-08 | Stages → report → done with de-duplicated sources; saved with planned searches; quota +1 | H | `::test_research_streams_stages_and_persists` | PASS |
| RES-09 | Writer prompt has numbered sources, no-invention rule, identity seal last | E | `::test_report_prompt_contains_sources_and_identity_seal` | PASS |
| RES-10 | Planner down → researches the question | F | `::test_planner_failure_still_researches_the_question` | PASS |
| RES-11 | One search fails → others still used | F | `::test_partial_search_failure_uses_remaining_queries` | PASS |
| RES-12 | No sources → `no_sources`, not charged | F 0 | `::test_no_sources_is_a_clear_error_and_free` | PASS |
| RES-13 | Writer down → generic error, no leak, not charged | F | `::test_writer_failure_does_not_leak_or_charge` | PASS |
| RES-14 | 20/day limit → 429 | R | `::test_daily_limit` | PASS |
| RES-15 | Foreign conversation → 404 | A | `::test_foreign_conversation_rejected` | PASS |
| RES-16 | Sources never name the backend | A | `::test_sources_never_name_search_backend` | PASS |
| E2E-RES-01 | Business: toggle, progress, report heading, sources, planned searches in reasoning panel | H M D | `deep-research.spec.ts › business user gets staged progress…` | PASS ×2 |
| E2E-RES-02 | No sources explained | F M D | `› no sources found is explained` | PASS ×2 |
| E2E-RES-03 | Pro user → Business upgrade, no request sent | P M D | `› pro user is offered the Business plan instead` | PASS ×2 |

### 3.4 Image generation

| ID | Case | Cat. | Test | Result |
|---|---|---|---|---|
| IMG-01 | 26 chat intent cases (12 positive, 14 negative) from `shared/image-intent-cases.json` | H E I 0 | `test_image_generation.py::test_image_intent_chat[…]` | PASS |
| IMG-02 | Never in code workspace | E | `::test_image_intent_never_fires_in_code_workspace[2]` | PASS |
| IMG-03 | Prompt capped at 1,000 chars | L | `::test_image_prompt_is_capped` | PASS |
| IMG-04 | 503 → timeout → success (same seed across retries) | S F | `::test_fetch_retries_transient_failures` | PASS |
| IMG-05 | Gives up after 3 attempts | F | `::test_fetch_gives_up_after_max_attempts` | PASS |
| IMG-06 | 400 / HTML body / empty body are not retried | F I | `::test_fetch_does_not_retry_permanent_failures[3]` | PASS |
| IMG-07 | Oversized provider image rejected | L | `::test_fetch_rejects_oversized_image` | PASS |
| IMG-08 | New seed per generation | E | `::test_each_generation_uses_a_new_seed` | PASS |
| IMG-09 | Trim + brand keeps size; garbage bytes rejected | H I | `::test_process_image_trims_and_brands_at_original_size`, `::test_process_image_rejects_garbage` | PASS |
| IMG-10 | Code workspace "draw a cat on canvas" → model, not image | E | `::test_code_workspace_draw_request_goes_to_the_model` | PASS |
| IMG-11 | Attached image → analysed, not regenerated | E | `::test_attached_image_is_analysed_not_regenerated` | PASS |
| IMG-12 | End to end: stored, served with media token, 401 without, saved to conversation, chat model not called, provider hidden | H A | `::test_image_generation_end_to_end` | PASS |
| IMG-13 | Other user can't view the image | A | `::test_other_user_cannot_view_image` | PASS |
| IMG-14 | Provider failure → 502 generic, quota kept | F R | `::test_provider_failure_returns_502_and_keeps_quota` | PASS |
| IMG-15 | Free 20/day → 429 before calling provider | R | `::test_image_daily_limit` | PASS |
| IMG-16 | Stored links re-signed on read | E | `::test_stored_image_links_are_resigned_on_read` | PASS |
| FE-IMG | Client detector matches the same 28 cases + cap | H E I 0 | `src/lib/home/imageQuery.test.ts` (29) | PASS |
| E2E-IMG-01 | Loading grid during a slow (1.2 s) response, then image with alt text; no search/reasoning flags | H S M D | `image-generation.spec.ts › shows the loading grid…` | PASS ×2 |
| E2E-IMG-02 | "draw conclusions" → text reply, no loader | E M D | `› a non-image request that mentions drawing…` | PASS ×2 |
| E2E-IMG-03 | 502 → server message + Try again | F M D | `› provider failure shows the server's message` | PASS ×2 |

### 3.5 Code generation and execution

| ID | Case | Cat. | Test | Result |
|---|---|---|---|---|
| FE-PREV-01 | Sandbox never includes `allow-same-origin` | A | `preview.test.ts › never grants allow-same-origin` | PASS |
| FE-PREV | Inline referenced/unreferenced CSS and JS; `$` sequences kept; `</script>` escaped; `type=module` kept; folder-prefixed refs; index.html preferred; bridge first; JS runner; Python runner (pinned Pyodide); CSS sample; unsupported explained; waiting state; active file honoured; message validation | H E I 0 | `preview.test.ts` (16) | PASS |
| FE-PREV-standalone | "Open in new tab" wraps in the same sandbox | A | `preview.test.ts › buildStandalonePage…` | PASS |
| FE-PARSE | File names from info string / comment / heading, 14 cases; traversal and absolute paths rejected; fallback names de-duplicated; never two blocks with one name; empty blocks skipped | H E I 0 | `parsing.test.ts` (21) | PASS |
| E2E-CODE-01 | Multi-file project: CSS applied (`h1` red), JS ran, console shows output; generated code **cannot read the session token or parent DOM** (`token:blocked\|parent-blocked`) | H A M D | `code-workspace.spec.ts › multi-file project previews…` | PASS ×2 |
| E2E-CODE-02 | Lone JS runs; console shows output and uncaught error; error badge | H F M D | `› a lone JavaScript file runs…` | PASS ×2 |

### 3.6 Voice mode

| ID | Case | Cat. | Test | Result |
|---|---|---|---|---|
| FE-VOICE | Feature detection (standard, webkit, none, SSR); error messages (permission, device, network, no speech, aborted, unknown); transcript assembly; markdown → speech text; chunking (short, sentence split, overlong sentence, giant word, empty) | H E I 0 L | `src/lib/voice.test.ts` (12) | PASS |
| E2E-VOICE-01 | Mic → live interim transcript → final text in composer | H M D | `voice.spec.ts › dictation fills the composer…` | PASS ×2 |
| E2E-VOICE-02 | Talk mode: utterance auto-sent, reply spoken | H M D | `› Talk mode sends the utterance…` | PASS ×2 |
| E2E-VOICE-03 | Read aloud speaks the reply text | H M D | `› Read aloud reads the message text` | PASS ×2 |
| E2E-VOICE-04 | Permission denied explained | P F M D | `› microphone permission denied is explained` | PASS ×2 |
| E2E-VOICE-05 | No SpeechRecognition → disabled, explained button | E M D | `› browsers without speech recognition…` | PASS ×2 |
| E2E-VOICE-06 | Free plan → Pro upgrade | P M D | `› free plan is offered Pro` | PASS ×2 |

### 3.7 PDF / document upload and image upload

| ID | Case | Cat. | Test | Result |
|---|---|---|---|---|
| UP-01 | Upload without auth → 401/403 | A | `test_uploads.py::test_upload_requires_auth` | PASS |
| UP-02 | In-memory FILE_STORE removed | L | `::test_in_memory_store_removed` | PASS |
| UP-03 | Empty file → 400 | 0 | `::test_empty_file_rejected` | PASS |
| UP-04 | Over size cap → 413 | L | `::test_oversized_file_rejected` | PASS |
| UP-05 | `.exe` → 400 | I | `::test_unsupported_type_rejected` | PASS |
| UP-06 | Renamed binary as `.pdf` → 400 | I | `::test_renamed_binary_rejected_by_magic_bytes` | PASS |
| UP-07 | `../../etc/passwd.txt` sanitised | I A | `::test_path_traversal_filename_is_sanitized` | PASS |
| UP-08 | Rate limit → 429 | R | `::test_upload_rate_limited` | PASS |
| UP-09 | Two-page PDF text + page counts | H | `::test_pdf_text_extracted` | PASS |
| UP-10 | Scanned PDF → warning | E 0 | `::test_scanned_pdf_returns_warning` | PASS |
| UP-11 | Corrupted PDF → 422 specific | I | `::test_corrupted_pdf_returns_clear_error` | PASS |
| UP-12 | Password-protected PDF → 422 specific | I P | `::test_encrypted_pdf_returns_clear_error` | PASS |
| UP-13 | Page cap + truncation flag | L | `::test_large_pdf_is_page_capped_and_flagged` | PASS |
| UP-14 | Char cap + truncation flag | L | `::test_long_text_truncated_and_flagged` | PASS |
| UP-15 | DOCX extracted | H | `::test_docx_extracted` | PASS |
| UP-16 | XLSX extracted | H | `::test_xlsx_extracted` | PASS |
| UP-17 | Zip bomb refused | L I | `::test_zip_bomb_docx_refused` | PASS |
| UP-18 | BOM + invalid UTF-8 handled | E | `::test_text_file_with_bom_and_bad_bytes` | PASS |
| UP-19 | Upload registered in Library | H | `::test_upload_is_registered_in_library` | PASS |
| UP-20 | Image attachment reaches model as vision input | H | `::test_image_attachment_reaches_model_as_vision_input` | PASS |
| UP-21 | SVG, remote URL, bad base64, zip → 400; model not called | I | `::test_bad_image_attachments_rejected[4]` | PASS |
| UP-22 | >8 MB image → 413 | L | `::test_oversized_image_attachment_rejected` | PASS |
| UP-23 | 5 images → 400 | L | `::test_too_many_images_rejected` | PASS |
| UP-24 | Vision on Free → 402 | P | `::test_vision_is_pro_only` | PASS |
| UP-25 | Vision happy path | H | `::test_vision_happy_path` | PASS |
| UP-26 | Non-JSON model output tolerated | E | `::test_vision_tolerates_non_json_model_output` | PASS |
| UP-27 | Spoofed content type → 400, model not called | I | `::test_vision_rejects_spoofed_content_type` | PASS |
| UP-28 | Empty → 400; huge → 413 | 0 L | `::test_vision_rejects_empty_and_huge` | PASS |
| UP-29 | Model failure → 502, no leak, quota kept | F R | `::test_vision_failure_does_not_use_quota_or_leak` | PASS |
| UP-30 | 100/day → 429 | R | `::test_vision_daily_limit` | PASS |
| FE-ATT | classifyFile (14 types), validateFile (empty, unsupported, per-kind limits), error bodies (never "[object Object]"), truncation warnings, data-URL size | H E I 0 L | `src/lib/home/attachments.test.ts` (26) | PASS |
| E2E-UP-01 | PDF extracted, inlined once, `content` not duplicated | H M D | `uploads.spec.ts › PDF text is extracted…` | PASS ×2 |
| E2E-UP-02 | Scanned PDF reason on chip | E M D | `› scanned PDF shows the reason…` | PASS ×2 |
| E2E-UP-03 | Password PDF message on chip | I M D | `› password-protected PDF error…` | PASS ×2 |
| E2E-UP-04 | Storage full readable | R M D | `› storage-full upload error is readable` | PASS ×2 |
| E2E-UP-05 | `.zip` and empty file rejected before upload | I 0 M D | `› unsupported and empty files are rejected…` | PASS ×2 |
| E2E-UP-06 | Image attached as data URL; remove button reachable | H M D | `› image attachment is sent as vision input…` | PASS ×2 |
| E2E-UP-07 | Analyze on Free → upgrade, no "[object Object]" | P M D | `› Analyze image on the free plan…` | PASS ×2 |

### 3.8 Other existing features (smoke + existing suites)

| ID | Case | Test | Result |
|---|---|---|---|
| SMOKE-PLAT-01/02 | Health; security headers | `test_feature_smoke.py::test_health`, `::test_security_headers_present` | PASS |
| SMOKE-CLS-01 | Classifier happy path, empty → 400, unknown intent → 404 | `::test_intent_classifier` | PASS |
| SMOKE-AUTH-01..03 | Wrong password rejected without leaking hashes; token required/validated, no secrets in `/auth/me`; settings update | `::test_login_rejects_wrong_password`, `::test_me_requires_valid_token`, `::test_settings_roundtrip` | PASS |
| SMOKE-CONV-01..03 | Lifecycle (rename, pin, favourite, duplicate, delete); cross-user isolation (get/patch/delete/list); workspace filter | `::test_conversation_*` | PASS |
| SMOKE-MEM-01 | Memory CRUD + isolation | `::test_memory_crud_and_isolation` | PASS |
| SMOKE-LIB-01/02 | Folders, rename, download, storage, public share + revoke; isolation | `::test_library_*` | PASS |
| SMOKE-PROJ-01/02 | Lifecycle (chats detach on delete); validation + isolation | `::test_projects_*` | PASS |
| SMOKE-SCHED-01/02 | Lifecycle (pause/resume/patch/delete); bad cron rejected | `::test_scheduled_tasks_*` | PASS |
| SMOKE-ACC-01..06 | Export has own data only and no secrets; API keys paid gate; key shown once + revoke; notifications/tokens; admin gate; authenticated reads | `::test_account_export_…`, `::test_api_keys_*`, `::test_notifications_and_tokens`, `::test_admin_endpoint_refuses_normal_users`, `::test_authenticated_reads[3]` | PASS |
| PAY | Razorpay orders, signatures, webhooks, ledger, refunds, history API (existing) | `test_payments.py` (15), `test_payment_ledger.py` (17), `test_payment_history_api.py` (8) | PASS |
| CFG | URLs/CORS config, DATA_DIR relocation, blank env vars, verified-user script (existing + 1 new) | `test_urls.py` (5), `test_data_dir.py` (3), `test_create_verified_user.py` (5) | PASS |

### 3.9 Round 2 additions

| Area | Cases | Tests | Result |
|---|---|---|---|
| 2FA at rest + rotation | encrypted TOTP, keyed backup-code hashes, legacy upgrade, fail closed, key rotation, re-encrypt tool, concurrent backup-code race | `test_two_factor.py` (11), `test_crypto_rotation.py` (4) | PASS |
| Rate limiting | forged `X-Forwarded-For`, 0/1/2 proxies, short header, bucket pruning | `test_rate_limit.py` (7) | PASS |
| Account deletion | files removed from disk | `test_account_deletion.py` (1) | PASS |
| Query performance | 15 hot queries use an index; no N+1 on 5 list endpoints | `test_query_performance.py` (3) | PASS |
| Server responsiveness | a 1.5 s document parse doesn't stall `/health` (M-08) | `test_upload_concurrency.py` | PASS (fails at 1.57 s without the thread-pool fix) |
| Compression | JSON gzipped; SSE never compressed | `test_compression.py` (2) | PASS |
| Live providers | chat, streaming, vision, research, image, DDG, Wikipedia, 5 keyed search providers | `test_live_providers.py` (12) | SKIPPED here (no keys, no egress) |
| Secret guard | forbidden paths, env-file contents, staged/tracked modes, history scan, archive listing, baseline | `tools/security/test_security_tools.py` (30) | PASS |
| Error messages | codes, validation arrays, HTML/long bodies, status fallbacks; login UI | `errors.test.ts` (6), `errors.spec.ts` (3) | PASS |
| Python runtime | self-hosted Pyodide runs real Python; missing package explained (M-07) | `code-workspace.spec.ts` | PASS |
| Network | slow reply + Stop, dropped connection + retry, offline (M-09) | `network.spec.ts` (3) | PASS |
| Destructive actions | API key revoke needs confirmation; failures shown | `destructive.spec.ts` (2) | PASS |
| List states | loading, error + retry, true empty on Library/Projects/Scheduled | `list-states.spec.ts` (6) | PASS |
| Mobile | no sideways scroll on 5 pages, 44×44 named controls, keyboard/notch meta | `mobile.spec.ts` (3) | PASS |
| Accessibility | axe on 9 screens + conversation, light and dark; theme variant | `a11y.spec.ts` (22: 9 screens + conversation × 2 themes, plus 2 theme-variant tests) | PASS |
| Landing | server redirect when signed in; keyboard flip + Launch | `landing-redirect.spec.ts` (2), `landing.spec.ts` (1) | PASS |
| Clipboard, privacy text | copy success/failure; policy matches code | `clipboard.spec.ts` (2), `legal.spec.ts` (1) | PASS |

## 4. Manual test checklist (not automatable in this environment)

Each item says exactly why it couldn't run here. Round 2 automated M-07, M-08 and M-09. Everything else is **NOT RUN** and should be run before release against staging with real keys. M-01 to M-04 now have opt-in live tests (`test_live_providers.py`) that do the provider half automatically once keys and network are available.

| ID | What | Why not automated here | Steps | Expected |
|---|---|---|---|---|
| M-01 | Real chat streaming + fallback | No `OPENROUTER_API_KEY` in this environment; tests must not call paid APIs | Set key; send "hello" with stream; set an invalid primary model id in `MODEL_NAME_MAPPING` temporarily and resend | Streams; second case still answers via fallback; no model names anywhere in UI/network tab |
| M-02 | Real image generation | Outbound network to the image provider is not available here; quality is subjective | "generate an image of a red fox in snow" ×2 | Two different images, no provider watermark, "Vatsa AI" mark bottom-right, loads again after reload |
| M-03 | Live web search relevance | External search is non-deterministic and not reachable here | Search on: "who won the latest Formula 1 race", "capital of Australia" | Current, correct answer with [n] citations matching the source list |
| M-04 | Deep research end to end | Needs real model + search | Business account, Research on: "What are the trade-offs of solid-state batteries?" | Progress stages; report with all four sections; 8–15 sources; reload shows it saved |
| M-05 | Real microphone dictation | Headless Chromium has no audio devices or permission UI | Chrome desktop, Edge, Safari macOS, Chrome Android, Safari iOS: tap mic, allow, speak | Live transcript; text in composer; deny permission → "Microphone access is blocked…" |
| M-06 | Audible read-aloud and Talk mode | No speakers/voices in CI | Read aloud a 1,500-word reply; Talk mode round trip | Whole reply read (chunked, no cut-off at ~15 s); Stop works; next utterance sends automatically |
| M-07 | Python run via Pyodide | **Automated in round 2.** Pyodide is self-hosted (`public/pyodide/`), so E2E runs real Python | – | E2E primes and numpy-missing cases PASS |
| M-08 | Server stays responsive during slow parsing | **Automated in round 2**: `test_upload_concurrency.py` (fails without the fix) | – | PASS. A real 250-page PDF by hand is still worthwhile |
| M-09 | Slow network UX | **Automated in round 2**: `network.spec.ts` (slow reply + Stop, dropped connection, offline) | – | PASS |
| M-10 | Firefox / Safari / iOS | Only Chromium is installed here | Smoke through chat, upload, code preview, voice button | Works; Firefox voice button disabled with explanation |
| M-11 | Screen reader | Needs VoiceOver/NVDA | Navigate composer toolbar and message actions | Every control announced with its name and pressed state; attachment errors announced |
| M-12 | OAuth + Razorpay live | Real third-party accounts | See DEPLOYMENT.md §8 smoke test | As documented |
| M-13 | Multi-worker rate limits | Single process here | Run `uvicorn --workers 4`, hammer `/api/upload` | Documented limitation: effective limit ×4 until Redis-backed |

## 5. Defects found by these tests

59 issues were logged: 36 in round 1 and 23 in round 2 (BUG-037 to BUG-059). Every P0, P1 and P2 is fixed and has a regression test. BUG-025 was fixed in round 2. BUG-024 is an accepted risk (KI-02). Everything else still open is in [KNOWN_ISSUES.md](KNOWN_ISSUES.md) (KI-01 to KI-18). Details, before/after and commits: [BUG_FIXES.md](BUG_FIXES.md).

## 6. Performance (round 2, before → after)

**Backend.** `python Backend/scripts/profile_routes.py` seeds one account with 200 conversations × 40 messages (varied text), 400 library items, 50 projects, 50 scheduled tasks, 150 memories and 200 notifications. It then times every authenticated GET route in-process (median of 5).

| Route | Median (ms) | Response | On the wire before | On the wire after (gzip) |
|---|---|---|---|---|
| `GET /api/account/export` | 186–206 | 1.88 MB zip | 1.88 MB | 1.88 MB (already compressed) |
| `GET /api/conversations` | 123–130 | 5.40 MB JSON | 5.40 MB | **1.82 MB** |
| `GET /api/library/items` | 7 | 16.6 KB | 16.6 KB | 1.8 KB |
| `GET /api/projects` | 6–7 | 10.5 KB | 10.5 KB | 1.5 KB |
| `GET /api/account/notifications` | 7 | 7.1 KB | 7.1 KB | 1.5 KB |
| every other GET (28 routes) | 2–7 | < 12 KB | | |

No route is over the 500 ms budget, so none needed profiling beyond this. The conversation list is the one that matters: its cost is the size, not server time. Gzip cut it 3.0× (BUG-055). Removing messages from the list response entirely is KI-07. The projects list went from 42 to 6 SQL statements for 20 projects (BUG-043).

**Frontend.** `PERF=1 npx playwright test e2e/perf.spec.ts` measures the production build in Chromium. JS is the compressed bytes actually downloaded. "Blocking" is long-task time over 50 ms during load, given as a range over 3 runs because it varies.

| Page | JS before | JS after | Blocking after | Layout shift | Notes |
|---|---|---|---|---|---|
| `/` signed in | **419 KB** (landing + home), 256 ms blocking | **318 KB** (home only) | 90–155 ms | 0 | server redirect instead of a client effect (BUG-056) |
| `/` signed out | 268 KB | 268 KB | 80–322 ms | 0.066–0.082 | 16 → 0 eager below-fold images; 45 → 9 images without dimensions (BUG-057). One shift of ~0.07 from the hero panel (KI-18) |
| `/pricing` | 255 KB | 255 KB | 95–146 ms | 0.001 | |
| `/login` | 246 KB | 246 KB | 0 | 0 | |
| `/home` | 318 KB | 318 KB | 74–140 ms | 0 | |
| `/code` | 357 KB | 357 KB | 74–108 ms | 0 | Pyodide (~10 MB) is fetched only when Python runs |
| `/library` | 258 KB | 258 KB | 0 | 0.003 | |
| `/projects` | 247 KB | 247 KB | 0 | 0 | |

The ~246 KB common to every page is the framework and shared layout. Every page's layout shift is inside the "good" band (< 0.1).

## 7. Real vs. mocked

| Dependency | In automated tests | Real run available? | Status in this environment |
|---|---|---|---|
| LLM provider (OpenRouter) | `llm_fakes.py` fakes both transports | `test_live_providers.py` chat, streaming, vision, research | Skipped: no key, egress blocked |
| Image provider | monkeypatched HTTP session (exercises retries) | live image test | Skipped: egress blocked |
| Web search (DDG, Wikipedia, Serper, Tavily, Brave, Google CSE, SearXNG) | monkeypatched per test | live tests per provider | Skipped: no keys, egress blocked |
| SQLite | **real** (temp file per run) | – | Real |
| bcrypt, JWT, Fernet/HMAC | **real** (bcrypt at cost 4 in tests; cost 12 asserted for production) | – | Real |
| File parsing (PDF/DOCX/XLSX) | **real** parsers on generated files | – | Real |
| Browser (Chromium) | **real** production build | – | Real (Firefox/WebKit not installed, M-10) |
| Python in the browser (Pyodide) | **real**, self-hosted | – | Real |
| Backend API in E2E | `e2e/mock-api.ts` answers from memory | backend suite covers the real API | Mocked in E2E only |
| Speech recognition / synthesis | scriptable fakes | manual M-05/M-06 | Mocked: no audio devices |
| Razorpay, OAuth, SMTP | signatures and flows unit-tested with test keys | manual M-12 | Mocked |
| Clipboard | real Chromium clipboard (granted and denied) | – | Real |


## 8. README verified on a clean machine

A fresh `git clone` of `100d560` into an empty temp directory, following README.md's commands exactly:

| Step (as written in the README) | Result |
|---|---|
| `python -m venv .venv`, `pip install -r requirements.txt -r requirements-dev.txt` | installed |
| `cp .env.example .env`, set `JWT_SECRET_KEY`, `ALLOWED_ORIGINS`, `TRUSTED_PROXY_COUNT=0` | – |
| `uvicorn app.main:app --reload --port 8000` | `/health` → `{"status":"ok","intents_loaded":27}`, `/docs` 200, bad login → 400 "Incorrect email or password" |
| `python -m pytest -q` in the clone | 262 passed, 12 skipped |
| `npm ci`, `cp .env.example .env.local`, `npm run dev` | predev copied Pyodide (5 files). `/`, `/login`, `/pricing`, `/pyodide/pyodide.js` all 200. `/health` through the Next proxy reached the API |
| `scripts/create_verified_user.py` (with `VATSA_NEW_USER_PASSWORD`), then sign in through the real `/login` UI in Chromium | landed on `/home`; sending "hello" without an OpenRouter key showed "AI service is temporarily unavailable. Please try again." with Try again; no page errors |
| `git status` in the clone afterwards | only `Backend/.venv/` was untracked but not ignored → fixed (BUG-059, 55bcb41). `.env`, `.env.local`, `vatsa.db` and `public/pyodide/` were already ignored |

## Appendix A: every automated test case (generated from the runners)

Generated with `pytest --collect-only`, `vitest list` and `playwright test --list` at the head of PR #2. Result for every case: **PASS**, except the 12 live-provider tests (SKIPPED: opt-in, no keys or egress here), E2E cases limited to one viewport (skipped on the other), and the opt-in perf report.

### A.1 Backend (pytest, 274 cases)

**test_account_deletion.py**

- `test_hard_delete_removes_uploads_and_generated_images`

**test_chat.py**

- `test_chat_requires_auth`
- `test_empty_message_rejected`
- `test_oversized_message_rejected`
- `test_non_streaming_happy_path_persists`
- `test_streaming_happy_path_persists`
- `test_fallback_chain_used_when_primary_fails`
- `test_provider_failure_never_leaks_provider_details[True]`
- `test_provider_failure_never_leaks_provider_details[False]`
- `test_failed_stream_is_not_persisted`
- `test_daily_limit_returns_upgrade_shape`
- `test_cannot_write_into_someone_elses_conversation`
- `test_identity_seal_is_last_system_instruction`
- `test_code_workspace_prompt_requests_named_files`

**test_compression.py**

- `test_json_responses_are_gzipped`
- `test_chat_stream_is_not_compressed`

**test_create_verified_user.py**

- `test_creates_a_confirmed_user_and_stores_only_a_hash`
- `test_created_user_signs_in_through_the_real_login_endpoint`
- `test_the_signup_password_policy_is_not_weakened`
- `test_an_existing_email_is_refused_and_left_unchanged`
- `test_error_messages_never_contain_the_password`

**test_crypto_rotation.py**

- `test_rotation_old_key_still_decrypts_and_is_flagged`
- `test_without_the_old_key_decryption_fails_closed`
- `test_jwt_derived_fallback_is_used_without_a_primary_key`
- `test_reencrypt_tool_moves_everything_to_the_primary_key`

**test_data_dir.py**

- `test_data_dir_moves_the_database_uploads_and_generated_images`
- `test_without_data_dir_everything_stays_in_the_backend_folder`
- `test_blank_optional_env_vars_fall_back_to_defaults`

**test_deep_research.py**

- `test_parse_plan_formats[["a b c", "d e f"]-a b c]`
- `test_parse_plan_formats[```json\n["x y", "z w"]\n```-x y]`
- `test_parse_plan_formats[Here you go:\n1. first query\n2. second query-first query]`
- `test_parse_plan_formats[- bullet one\n- bullet two-bullet one]`
- `test_parse_plan_garbage_falls_back_to_question`
- `test_parse_plan_dedupes_and_caps`
- `test_merge_sources_interleaves_dedupes_and_renumbers`
- `test_merge_sources_caps_total`
- `test_research_is_business_only[free]`
- `test_research_is_business_only[pro]`
- `test_research_requires_auth`
- `test_research_rejects_empty_and_long`
- `test_research_streams_stages_and_persists`
- `test_report_prompt_contains_sources_and_identity_seal`
- `test_planner_failure_still_researches_the_question`
- `test_partial_search_failure_uses_remaining_queries`
- `test_no_sources_is_a_clear_error_and_free`
- `test_writer_failure_does_not_leak_or_charge`
- `test_daily_limit`
- `test_foreign_conversation_rejected`
- `test_sources_never_name_search_backend`

**test_feature_smoke.py**

- `test_health`
- `test_security_headers_present`
- `test_intent_classifier`
- `test_login_rejects_wrong_password`
- `test_me_requires_valid_token`
- `test_settings_roundtrip`
- `test_conversation_lifecycle`
- `test_conversation_isolation`
- `test_conversation_workspace_filter`
- `test_memory_crud_and_isolation`
- `test_library_folders_items_and_share`
- `test_library_isolation`
- `test_projects_lifecycle`
- `test_projects_validation_and_isolation`
- `test_scheduled_tasks_lifecycle`
- `test_scheduled_tasks_reject_bad_cron`
- `test_account_export_contains_own_data_only`
- `test_api_keys_are_a_paid_feature`
- `test_api_keys_create_list_revoke`
- `test_api_key_authenticates_until_revoked`
- `test_notifications_and_tokens`
- `test_admin_endpoint_refuses_normal_users`
- `test_authenticated_reads[/api/profile]`
- `test_authenticated_reads[/api/account/billing]`
- `test_authenticated_reads[/api/payments/me]`
- `test_production_password_hashing_uses_cost_12`

**test_image_generation.py**

- `test_image_intent_chat[generate an image of a red fox in snow]`
- `test_image_intent_chat[Create a realistic photo of a mountain l]`
- `test_image_intent_chat[make me a picture of a cyberpunk city]`
- `test_image_intent_chat[please draw a cat wearing a hat]`
- `test_image_intent_chat[Can you draw me a dragon?]`
- `test_image_intent_chat[paint a sunset over the ocean]`
- `test_image_intent_chat[/imagine a castle on a floating island]`
- `test_image_intent_chat[imagine a robot reading a book]`
- `test_image_intent_chat[image of an astronaut riding a horse]`
- `test_image_intent_chat[design a logo for a coffee shop called B]`
- `test_image_intent_chat[generate a high-quality illustration of ]`
- `test_image_intent_chat[create an image]`
- `test_image_intent_chat[how do I draw conclusions from this data]`
- `test_image_intent_chat[draw a comparison between Python and Go]`
- `test_image_intent_chat[draw a bar chart of monthly sales in mat]`
- `test_image_intent_chat[make an image carousel component in Reac]`
- `test_image_intent_chat[create a picture gallery website]`
- `test_image_intent_chat[build an image uploader with drag and dr]`
- `test_image_intent_chat[write a function to resize an image in p]`
- `test_image_intent_chat[explain the image of a function in set t]`
- `test_image_intent_chat[what paint should I use for a bathroom?]`
- `test_image_intent_chat[create an image classifier with PyTorch]`
- `test_image_intent_chat[generate an image processing pipeline]`
- `test_image_intent_chat[what is in this picture of my receipt]`
- `test_image_intent_chat[summarise this document]`
- `test_image_intent_chat[<empty>]`
- `test_image_intent_never_fires_in_code_workspace[draw a cat using HTML canvas]`
- `test_image_intent_never_fires_in_code_workspace[generate an image of a red fox]`
- `test_image_prompt_is_capped`
- `test_fetch_retries_transient_failures`
- `test_fetch_gives_up_after_max_attempts`
- `test_fetch_does_not_retry_permanent_failures[resp0]`
- `test_fetch_does_not_retry_permanent_failures[resp1]`
- `test_fetch_does_not_retry_permanent_failures[resp2]`
- `test_fetch_rejects_oversized_image`
- `test_each_generation_uses_a_new_seed`
- `test_process_image_trims_and_brands_at_original_size`
- `test_process_image_rejects_garbage`
- `test_image_generation_end_to_end`
- `test_other_user_cannot_view_image`
- `test_code_workspace_draw_request_goes_to_the_model`
- `test_attached_image_is_analysed_not_regenerated`
- `test_provider_failure_returns_502_and_keeps_quota`
- `test_image_daily_limit`
- `test_stored_image_links_are_resigned_on_read`

**test_live_providers.py**

- `test_live_chat_completion`
- `test_live_chat_streaming`
- `test_live_vision_describes_image`
- `test_live_deep_research_end_to_end`
- `test_live_image_generation`
- `test_live_duckduckgo_search`
- `test_live_wikipedia_lookup`
- `test_live_optional_search_provider[_serper-SERPER_API_KEY]`
- `test_live_optional_search_provider[_tavily-TAVILY_API_KEY]`
- `test_live_optional_search_provider[_brave-BRAVE_API_KEY]`
- `test_live_optional_search_provider[_google_cse-GOOGLE_CSE_API_KEY]`
- `test_live_optional_search_provider[_searxng-SEARXNG_URL]`

**test_payment_history_api.py**

- `test_history_requires_a_login`
- `test_me_returns_only_the_callers_rows`
- `test_me_includes_unpaid_and_failed_orders_newest_first`
- `test_me_events_are_only_the_callers_and_never_orphans`
- `test_admin_lookup_refuses_everyone_who_is_not_a_fully_qualified_admin`
- `test_admin_lookup_refuses_a_token_that_cannot_be_revoked`
- `test_admin_finds_payments_by_email_and_by_the_address_used_at_the_time`
- `test_admin_lookup_is_exact_match_and_requires_an_email`

**test_payment_ledger.py**

- `test_ledger_row_is_written_before_razorpay_is_called`
- `test_order_row_carries_snapshot_amounts_and_razorpay_response`
- `test_provider_failure_marks_the_row_failed_and_leaves_no_subscription`
- `test_valid_signature_captures_stores_ids_and_upgrades`
- `test_invalid_signature_records_failure_and_never_upgrades`
- `test_bad_signature_after_capture_cannot_undo_it`
- `test_email_snapshot_survives_the_user_changing_email`
- `test_an_order_from_before_the_ledger_existed_gets_a_row_from_its_own_subscription`
- `test_captured_webhook_upgrades_and_every_duplicate_is_kept`
- `test_webhook_after_browser_verify_still_keeps_razorpays_record`
- `test_card_and_upi_details_never_reach_the_database`
- `test_bad_webhook_signature_is_rejected_and_not_stored`
- `test_webhook_for_an_unknown_order_is_recorded_but_grants_nothing`
- `test_webhook_naming_a_different_user_is_rejected`
- `test_full_refund_marks_the_row_refunded_and_ends_access`
- `test_partial_refund_is_logged_but_changes_neither_status_nor_access`
- `test_hard_deleting_an_account_keeps_its_payment_history`

**test_payments.py**

- `test_catalog_is_exactly_the_two_prices_in_both_currencies`
- `test_order_amounts_match_catalog`
- `test_client_cannot_choose_the_price_or_a_plan_we_dont_sell`
- `test_valid_payment_upgrades_and_is_idempotent`
- `test_business_payment_grants_business_not_pro`
- `test_bad_signature_grants_nothing`
- `test_someone_elses_order_cannot_be_claimed`
- `test_signature_for_an_unknown_order_does_not_fall_back_to_a_pending_one`
- `test_webhook_fulfils_when_the_browser_never_reported_back`
- `test_webhook_rejects_wrong_amount_and_bad_signature`
- `test_repeat_payment_extends_instead_of_overlapping`
- `test_lapsed_access_is_downgraded_and_active_access_is_not`
- `test_full_refund_ends_access_and_is_idempotent`
- `test_partial_refund_leaves_access_alone`
- `test_refund_webhook_needs_a_valid_signature_and_a_known_payment`

**test_query_performance.py**

- `test_hot_query_uses_an_index[conversations list]`
- `test_hot_query_uses_an_index[conversation get]`
- `test_hot_query_uses_an_index[daily usage]`
- `test_hot_query_uses_an_index[token account]`
- `test_hot_query_uses_an_index[token transactions]`
- `test_hot_query_uses_an_index[library list]`
- `test_hot_query_uses_an_index[memories]`
- `test_hot_query_uses_an_index[generated image]`
- `test_hot_query_uses_an_index[api key auth]`
- `test_hot_query_uses_an_index[user by email]`
- `test_hot_query_uses_an_index[payments]`
- `test_hot_query_uses_an_index[otp]`
- `test_hot_query_uses_an_index[scheduled tasks]`
- `test_hot_query_uses_an_index[projects]`
- `test_hot_query_uses_an_index[notifications]`
- `test_list_endpoints_have_no_n_plus_1[/api/conversations-<lambda>]`
- `test_list_endpoints_have_no_n_plus_1[/api/projects-<lambda>]`
- `test_list_endpoints_have_no_n_plus_1[/api/library/items-<lambda>]`
- `test_list_endpoints_have_no_n_plus_1[/api/memory-<lambda>]`
- `test_list_endpoints_have_no_n_plus_1[/api/scheduled-tasks-<lambda>]`
- `test_project_list_still_reports_each_projects_chats_and_files`

**test_rate_limit.py**

- `test_spoofed_forwarded_for_does_not_change_the_client_ip`
- `test_without_a_proxy_the_header_is_ignored`
- `test_two_proxies`
- `test_header_shorter_than_proxy_chain_falls_back_to_socket`
- `test_login_ip_limit_holds_against_rotating_fake_ips`
- `test_expired_buckets_are_pruned`
- `test_limit_still_enforced`

**test_two_factor.py**

- `test_full_flow_totp_and_single_use_backup_codes`
- `test_wrong_code_rejected`
- `test_enable_requires_setup_and_valid_code`
- `test_totp_secret_is_encrypted_at_rest`
- `test_backup_codes_are_not_plain_sha256_at_rest`
- `test_legacy_plaintext_secret_and_hashes_still_work_and_get_upgraded`
- `test_undecryptable_secret_fails_closed`
- `test_disable_requires_password_and_clears_secrets`
- `test_crypto_helpers_handle_empty[]`
- `test_crypto_helpers_handle_empty[None]`
- `test_backup_code_cannot_be_used_twice_concurrently`

**test_upload_concurrency.py**

- `test_slow_parse_does_not_block_other_requests`

**test_uploads.py**

- `test_upload_requires_auth`
- `test_in_memory_store_removed`
- `test_empty_file_rejected`
- `test_oversized_file_rejected`
- `test_unsupported_type_rejected`
- `test_renamed_binary_rejected_by_magic_bytes`
- `test_path_traversal_filename_is_sanitized`
- `test_upload_rate_limited`
- `test_pdf_text_extracted`
- `test_scanned_pdf_returns_warning`
- `test_corrupted_pdf_returns_clear_error`
- `test_encrypted_pdf_returns_clear_error`
- `test_large_pdf_is_page_capped_and_flagged`
- `test_long_text_truncated_and_flagged`
- `test_docx_extracted`
- `test_xlsx_extracted`
- `test_zip_bomb_docx_refused`
- `test_text_file_with_bom_and_bad_bytes`
- `test_upload_is_registered_in_library`
- `test_image_attachment_reaches_model_as_vision_input`
- `test_bad_image_attachments_rejected[att0-400]`
- `test_bad_image_attachments_rejected[att1-400]`
- `test_bad_image_attachments_rejected[att2-400]`
- `test_bad_image_attachments_rejected[att3-400]`
- `test_oversized_image_attachment_rejected`
- `test_too_many_images_rejected`
- `test_vision_is_pro_only`
- `test_vision_happy_path`
- `test_vision_tolerates_non_json_model_output`
- `test_vision_rejects_spoofed_content_type`
- `test_vision_rejects_empty_and_huge`
- `test_vision_failure_does_not_use_quota_or_leak`
- `test_vision_daily_limit`

**test_urls.py**

- `test_unset_variables_fall_back_to_the_live_site_not_a_developer_machine`
- `test_blank_variables_count_as_unset`
- `test_environment_values_win_and_trailing_slashes_are_dropped`
- `test_allowed_origins_is_read_at_call_time`
- `test_oauth_error_redirect_is_built_from_the_central_frontend_url`

**test_web_search.py**

- `test_build_search_query_strips_inlined_attachments`
- `test_build_search_query_caps_length_and_whitespace`
- `test_build_search_query_empty`
- `test_ssrf_guard_blocks_internal_targets[http://127.0.0.1/admin]`
- `test_ssrf_guard_blocks_internal_targets[http://localhost:8000/]`
- `test_ssrf_guard_blocks_internal_targets[http://169.254.169.254/latest/meta-data/]`
- `test_ssrf_guard_blocks_internal_targets[http://10.0.0.5/]`
- `test_ssrf_guard_blocks_internal_targets[http://[::1]/]`
- `test_ssrf_guard_blocks_internal_targets[file:///etc/passwd]`
- `test_ssrf_guard_blocks_internal_targets[gopher://example.com]`
- `test_ssrf_guard_blocks_internal_targets[not a url]`
- `test_ssrf_guard_allows_public_ip_literal`
- `test_format_context_numbers_sources_and_forbids_invention`
- `test_search_returns_ranked_citation_ready_results`
- `test_search_dedupes_same_url`
- `test_search_cache_hits_skip_providers`
- `test_search_raises_when_every_provider_empty`
- `test_empty_query_rejected`
- `test_chat_with_search_returns_sources_and_grounds_prompt`
- `test_chat_stream_with_search_sends_sources_on_done`
- `test_search_quota_exhausted_sends_notice_and_still_answers`
- `test_search_outage_sends_notice`
- `test_search_uses_quota_only_on_success`
- `test_sources_never_name_the_backend`

### A.2 Security tooling (pytest, 30 cases)

**tools/security/test_security_tools.py**

- `test_forbidden_names[.env]`
- `test_forbidden_names[Backend/.env]`
- `test_forbidden_names[frontend/.env.local]`
- `test_forbidden_names[x/.env.production.local]`
- `test_forbidden_names[Backend\\.env]`
- `test_forbidden_names[vatsa.db]`
- `test_forbidden_names[data/app.sqlite3]`
- `test_forbidden_names[site.zip]`
- `test_forbidden_names[backup.tar.gz]`
- `test_forbidden_names[certs/server.pem]`
- `test_forbidden_names[tls.key]`
- `test_forbidden_names[id_rsa]`
- `test_forbidden_names[id_ed25519.pub]`
- `test_forbidden_names[.npmrc]`
- `test_forbidden_names[store.p12]`
- `test_allowed_names[Backend/.env.example]`
- `test_allowed_names[frontend/.env.example]`
- `test_allowed_names[frontend/.env.production]`
- `test_allowed_names[README.md]`
- `test_allowed_names[app/models/api_key.py]`
- `test_allowed_names[src/components/settings/tabs/ApiKeysTab.tsx]`
- `test_allowed_names[keyboard.ts]`
- `test_example_env_secret_values_must_be_empty`
- `test_public_frontend_env_only_next_public`
- `test_pre_commit_check_blocks_staged_env_and_db`
- `test_pre_commit_check_blocks_filled_in_example`
- `test_pre_commit_check_passes_clean_changes`
- `test_history_scan_finds_env_inside_zip_even_after_deletion`
- `test_history_scan_clean_repo_passes`
- `test_history_baseline_tolerates_known_but_fails_new`

### A.3 Frontend unit (Vitest, 125 cases)

**src/lib/home/sse.test.ts**

- createSseParser › parses one event per data line
- createSseParser › reassembles events split across chunks
- createSseParser › reassembles multi-byte characters split across chunks
- createSseParser › handles a final event without a trailing newline
- createSseParser › ignores comments, blank lines and [DONE]
- createSseParser › treats non-JSON data as plain text
- createSseParser › passes notice, stage, error and done events through
- researchStageLabel › labels each stage
- describeHttpError › never shows raw JSON
- describeHttpError › uses short string details
- describeHttpError › maps gateway errors to a retryable message
- describeNetworkError › detects offline
- describeNetworkError › explains fetch failures when online
- describeNetworkError › keeps app error messages

**src/lib/home/imageQuery.test.ts**

- extractImagePrompt (shared cases with the backend) › chat: 'generate an image of a red fox in snow'
- extractImagePrompt (shared cases with the backend) › chat: 'Create a realistic photo of a mountai…'
- extractImagePrompt (shared cases with the backend) › chat: 'make me a picture of a cyberpunk city'
- extractImagePrompt (shared cases with the backend) › chat: 'please draw a cat wearing a hat'
- extractImagePrompt (shared cases with the backend) › chat: 'Can you draw me a dragon?'
- extractImagePrompt (shared cases with the backend) › chat: 'paint a sunset over the ocean'
- extractImagePrompt (shared cases with the backend) › chat: '/imagine a castle on a floating island'
- extractImagePrompt (shared cases with the backend) › chat: 'imagine a robot reading a book'
- extractImagePrompt (shared cases with the backend) › chat: 'image of an astronaut riding a horse'
- extractImagePrompt (shared cases with the backend) › chat: 'design a logo for a coffee shop calle…'
- extractImagePrompt (shared cases with the backend) › chat: 'generate a high-quality illustration …'
- extractImagePrompt (shared cases with the backend) › chat: 'create an image'
- extractImagePrompt (shared cases with the backend) › chat: 'how do I draw conclusions from this d…'
- extractImagePrompt (shared cases with the backend) › chat: 'draw a comparison between Python and …'
- extractImagePrompt (shared cases with the backend) › chat: 'draw a bar chart of monthly sales in …'
- extractImagePrompt (shared cases with the backend) › chat: 'make an image carousel component in R…'
- extractImagePrompt (shared cases with the backend) › chat: 'create a picture gallery website'
- extractImagePrompt (shared cases with the backend) › chat: 'build an image uploader with drag and…'
- extractImagePrompt (shared cases with the backend) › chat: 'write a function to resize an image i…'
- extractImagePrompt (shared cases with the backend) › chat: 'explain the image of a function in se…'
- extractImagePrompt (shared cases with the backend) › chat: 'what paint should I use for a bathroo…'
- extractImagePrompt (shared cases with the backend) › chat: 'create an image classifier with PyTor…'
- extractImagePrompt (shared cases with the backend) › chat: 'generate an image processing pipeline'
- extractImagePrompt (shared cases with the backend) › chat: 'what is in this picture of my receipt'
- extractImagePrompt (shared cases with the backend) › chat: 'summarise this document'
- extractImagePrompt (shared cases with the backend) › chat: ''
- extractImagePrompt (shared cases with the backend) › code workspace never generates images: 'draw a cat using HTML canvas'
- extractImagePrompt (shared cases with the backend) › code workspace never generates images: 'generate an image of a red fox'
- extractImagePrompt (shared cases with the backend) › caps prompt length

**src/lib/code/preview.test.ts**

- PREVIEW_SANDBOX › never grants allow-same-origin (would expose the session token)
- inlineAssets › replaces referenced stylesheets and scripts with inline tags
- inlineAssets › applies unreferenced CSS in <head> and JS before </body>
- inlineAssets › keeps $ sequences in code intact (jQuery, template literals)
- inlineAssets › escapes a closing script tag inside inlined code
- inlineAssets › preserves attributes such as type=module
- inlineAssets › matches files referenced with a folder prefix
- buildPreviewDocument › prefers index.html and injects the console bridge first
- buildPreviewDocument › runs a lone JavaScript file in a console runner
- buildPreviewDocument › runs Python from the self-hosted runtime, never a CDN
- buildPreviewDocument › pins the runner to the installed Pyodide version
- buildPreviewDocument › previews a lone stylesheet on sample markup
- buildPreviewDocument › explains when nothing can run
- buildPreviewDocument › waits when there is no code
- buildPreviewDocument › honours the active file when several runnable files exist
- buildStandalonePage › frames the preview in the same sandbox instead of running it top-level
- isPreviewMessage › accepts only well-formed bridge messages

**src/lib/voice.test.ts**

- feature detection › finds the standard and webkit-prefixed recognisers
- feature detection › reports unsupported browsers (Firefox) and SSR
- speechErrorMessage › explains permission, device and network problems
- speechErrorMessage › is silent for a deliberate stop
- speechErrorMessage › has a fallback
- readTranscript › separates final and interim text from resultIndex on
- appendTranscript › joins with one space
- toSpeakableText › drops code, links, images, citations and markdown symbols
- chunkForSpeech › keeps short text in one chunk
- chunkForSpeech › splits on sentence boundaries under the limit
- chunkForSpeech › word-wraps a single overlong sentence and hard-splits giant words
- chunkForSpeech › returns nothing for empty text

**src/lib/code/parsing.test.ts**

- detectFileName › html index.html
- detectFileName › css:styles.css
- detectFileName › js title="app.js"
- detectFileName › html
- detectFileName › js
- detectFileName › css
- detectFileName › python
- detectFileName › js
- detectFileName › css
- detectFileName › js
- detectFileName › js
- detectFileName › python
- detectFileName › html
- detectFileName › sh
- detectFileName › rejects path traversal and absolute names
- extractAllCodeBlocks › uses the names the model gave, so the page's references resolve
- extractAllCodeBlocks › falls back to file.<ext> with de-duplication
- extractAllCodeBlocks › never gives two blocks the same name
- extractAllCodeBlocks › skips empty blocks
- normalizeResponse › handles null
- normalizeResponse › extracts files from a text response

**src/lib/home/attachments.test.ts**

- classifyFile › { name: 'a.pdf', type: 'application/pdf', size: 100 } -> document
- classifyFile › { name: 'A.DOCX', type: '', size: 100 } -> document
- classifyFile › { name: 's.xlsx', type: 'application/vnd.ms-excel', size: 100 } -> document
- classifyFile › { name: 'p.png', type: 'image/png', size: 100 } -> image
- classifyFile › { name: 'p.jpg', type: 'image/jpeg', size: 100 } -> image
- classifyFile › { name: 'p.webp', type: 'image/webp', size: 100 } -> image
- classifyFile › { name: 'v.svg', type: 'image/svg+xml', size: 100 } -> unsupported
- classifyFile › { name: 'h.heic', type: 'image/heic', size: 100 } -> unsupported
- classifyFile › { name: 'main.py', type: '', size: 100 } -> text
- classifyFile › { name: 'data.json', type: 'application/json', size: 100 } -> text
- classifyFile › { name: 'notes.txt', type: 'text/plain', size: 100 } -> text
- classifyFile › { name: 'a.zip', type: 'application/zip', size: 100 } -> unsupported
- classifyFile › { name: 'app.exe', type: 'application/octet-stream', size: 100 } -> unsupported
- classifyFile › { name: 'deck.pptx', type: '', size: 100 } -> unsupported
- validateFile › accepts normal files
- validateFile › rejects empty files
- validateFile › rejects unsupported types instead of silently dropping them
- validateFile › enforces per-kind size limits
- errorMessageFromBody › uses string details as-is
- errorMessageFromBody › never renders [object Object] for structured details
- errorMessageFromBody › falls back by status
- documentWarning › prefers the server warning (e.g. scanned PDF)
- documentWarning › describes page-capped PDFs
- documentWarning › describes char-truncated docs
- documentWarning › is empty for complete docs
- dataUrlBytes › estimates decoded size

**src/lib/api-client/errors.test.ts**

- describeApiError › uses a plain string detail
- describeApiError › turns plan/limit codes into sentences, never raw codes
- describeApiError › summarises FastAPI validation errors instead of [object Object]
- describeApiError › never shows long or HTML bodies
- describeApiError › falls back by status, with the caller's fallback for unknown statuses
- normalizeResponse › never dumps raw backend JSON into the chat

### A.4 End-to-end (Playwright, 75 scenarios; each listed once, run on `desktop` and `mobile`)

**a11y.spec.ts**

- no serious accessibility violations (light theme) › /
- no serious accessibility violations (light theme) › /pricing
- no serious accessibility violations (light theme) › /privacy
- no serious accessibility violations (light theme) › /login
- no serious accessibility violations (light theme) › /code
- no serious accessibility violations (light theme) › /library
- no serious accessibility violations (light theme) › /projects
- no serious accessibility violations (light theme) › /scheduled
- no serious accessibility violations (light theme) › /home
- no serious accessibility violations (light theme) › /home with a conversation
- no serious accessibility violations (dark theme) › /
- no serious accessibility violations (dark theme) › /pricing
- no serious accessibility violations (dark theme) › /privacy
- no serious accessibility violations (dark theme) › /login
- no serious accessibility violations (dark theme) › /code
- no serious accessibility violations (dark theme) › /library
- no serious accessibility violations (dark theme) › /projects
- no serious accessibility violations (dark theme) › /scheduled
- no serious accessibility violations (dark theme) › /home
- no serious accessibility violations (dark theme) › /home with a conversation
- dark: styles follow the in-app theme (dark), not the OS (light)
- dark: styles follow the in-app theme (light), not the OS (dark)

**chat.spec.ts**

- chat › streams a reply
- chat › shows web search sources and the notice when search was skipped
- chat › provider outage shows a friendly error and Try again recovers
- chat › HTTP errors never show raw JSON
- chat › daily limit opens the upgrade flow
- message actions are visible without hover on phones

**clipboard.spec.ts**

- copy to clipboard › copying a code block puts the code on the clipboard
- copy to clipboard › when the clipboard is blocked, copy fails visibly without breaking the page

**code-workspace.spec.ts**

- code workspace › multi-file project previews with CSS/JS inlined, inside an isolated sandbox
- code workspace › a lone JavaScript file runs and prints to the console
- code workspace › a Python script really runs in the browser (self-hosted runtime, no CDN)
- code workspace › importing a third-party Python package explains the stdlib-only limit

**deep-research.spec.ts**

- deep research › business user gets staged progress, a cited report and sources
- deep research › no sources found is explained
- deep research › pro user is offered the Business plan instead

**destructive.spec.ts**

- API keys › revoking a key needs a second, explicit click
- API keys › create and revoke failures are shown, not swallowed

**errors.spec.ts**

- validation errors are summarised, not shown as [object Object]
- a proxy's HTML error page becomes a plain sentence
- the server's own message is shown as-is

**image-generation.spec.ts**

- image generation › shows the loading grid, then the generated image
- image generation › a non-image request that mentions drawing gets a text answer, no image loader
- image generation › provider failure shows the server's message

**landing-redirect.spec.ts**

- landing page for signed-in users › server redirects / to /home when a session cookie is present
- landing page for signed-in users › signed-out visitors still get the landing page

**landing.spec.ts**

- workspace cards flip from the keyboard and Launch goes somewhere

**legal.spec.ts**

- privacy policy matches how data is really handled

**list-states.spec.ts**

- /library › shows a loading indicator, not the empty state, while fetching
- /library › a failed load shows the error with a retry, without the empty state
- /projects › shows a loading indicator, not the empty state, while fetching
- /projects › a failed load shows the error with a retry, without the empty state
- /scheduled › shows a loading indicator, not the empty state, while fetching
- /scheduled › a failed load shows the error with a retry, without the empty state

**mobile.spec.ts**

- mobile › no page scrolls sideways
- mobile › every chat control is at least 44x44 and has an accessible name
- mobile › keyboard and notch aware: viewport resizes with the keyboard, safe areas respected

**network.spec.ts**

- slow and failing network › a slow reply shows progress and Stop cancels it
- slow and failing network › a dropped connection is explained with a retry
- slow and failing network › going offline is detected

**perf.spec.ts**

- performance report

**uploads.spec.ts**

- PDF and image uploads › PDF text is extracted and sent inlined with the message
- PDF and image uploads › scanned PDF shows the reason instead of attaching nothing
- PDF and image uploads › password-protected PDF error from the server is shown on the chip
- PDF and image uploads › storage-full upload error is readable
- PDF and image uploads › unsupported and empty files are rejected before upload
- PDF and image uploads › image attachment is sent as vision input and can be removed
- PDF and image uploads › Analyze image on the free plan opens the upgrade flow

**voice.spec.ts**

- voice mode › dictation fills the composer with a live transcript
- voice mode › Talk mode sends the utterance and reads the reply aloud
- voice mode › Read aloud reads the message text
- voice mode › microphone permission denied is explained
- voice mode › browsers without speech recognition get a disabled, explained button
- voice mode › free plan is offered Pro
