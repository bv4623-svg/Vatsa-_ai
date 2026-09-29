# FEATURES.md — PRD "AI Smartness + Review/Wall" mapped to the code

Audited 2026-09-29 against branch `feat/feedback-and-cleanup` (PR #4, `main` lineage).
Every "Exists" cites a file. Anything not listed as Exists is not in the code.

Legend: **Exists** · **Partial** (some of it, gap stated) · **Missing** · **Blocked** (needs a decision, account or key from the owner)

## 0. Stack: PRD vs this codebase

| PRD says | Codebase has | Decision (default until the owner says otherwise) |
|---|---|---|
| Node.js + Express | FastAPI (`Backend/app/main.py`) | Keep FastAPI. Rewriting is out of scope. |
| Postgres + UUID ids | SQLAlchemy; SQLite locally/tests, Postgres in prod; integer ids (`users.id`) | Integer ids to match `users.id`; JSON columns instead of `TEXT[]` so SQLite tests run. |
| Qdrant | none; scikit-learn TF-IDF already used (`app/core/classifier.py`) | pgvector on the prod Postgres when vectors are needed; TF-IDF for v1 similarity. No new service. |
| Redis semantic cache, rate limit | in-process rate limiter (`app/utils/rate_limit.py`) | Keep in-process for v1. Redis only if multi-instance. |
| BullMQ | FastAPI BackgroundTasks, APScheduler (`requirements.txt`) | Use those. |
| Langfuse | none | **Blocked**: needs a Langfuse account and keys. |
| LangGraph | none | Deferred to the multi-agent phase. |
| Multi-provider LLM | OpenRouter only (`services/ai_service.py:178,233`), which reaches OpenAI/Anthropic/Google | Keep OpenRouter as the single gateway. |

## 1. Part 1: AI smartness

| ID | Feature | Status | Evidence / gap |
|---|---|---|---|
| F1.1 | Structured system prompt | Partial | `ai_service.py:427` `_build_messages` builds sections (identity, search, memory, project, style, code, identity seal). Not the 5-section role/rules/tone/format/examples layout; **not versioned in DB**, not A/B testable. |
| F1.2 | CoT / ReAct / self-critique | Partial | Reasoning mode routes to `REASONING_MODEL` (`ai_service.py:52,338`). No ReAct loop, no self-critique pass. |
| F1.3 | JSON mode, guardrails | Partial | Identity seal against prompt-extraction (`ai_service.py:71`). No JSON mode, no citation check. **Gap: the user's email is put in every system prompt (`ai_service.py:449`)**, against "PII masked before LLM". |
| F1.4 | Few-shot library in DB | Missing | — |
| F2.1 | Conversation memory | Exists | Last 10 turns (`ai_service.py:494`). |
| F2.2 | User profile memory | Partial | Name, email, tier injected (`ai_service.py:447`); response style setting (`routers/chat.py:84`). No language/tone profile. |
| F2.3 | Fact memory | Partial | Regex fact extraction (`services/memory_extractor.py:74`) upserted per category (`services/memory_service.py`), CRUD API (`routers/memory.py`). Not embedded, no relevance search: latest 20 injected (`memory_service.py:146`). |
| F2.4–F2.5 | Episodic / procedural memory | Missing | — |
| F2.6 | Summarize old turns | Missing | Older turns are dropped, not summarized. |
| F2.7 | Top-K relevant retrieval | Missing | See F2.3. |
| F2.8 | Importance scoring / decay | Partial | `Memory.confidence`, `expires_at` columns exist (`models/memory.py:16-17`); oldest-first eviction at a cap. No decay. |
| 5.3 | RAG pipeline (chunk/embed/hybrid/rerank/citations) | Missing | Uploads are parsed to text and pasted into the prompt (`routers/upload.py`, `ai_service.py:506`). |
| 5.4 | Tools: web search | Exists | `ddgs` via `services/search_service.py`, relevance floor. |
| 5.4 | Tools: image gen / vision | Exists | `routers/chat.py` image path, `routers/vision.py`. |
| 5.4 | Tools: PDF/doc parsing | Exists | `pdfplumber`, `python-docx` in `routers/upload.py`. |
| 5.4 | Tools: code exec | Partial | In-browser only (Pyodide in the code workspace). No server sandbox. |
| 5.4 | Tools: calculator, db_query, api_call, file_io | Missing | No function-calling / tool framework at all. |
| 5.4 | Voice STT/TTS | Exists | Browser Web Speech (`hooks/useVoice.ts`), used on `/home` (`app/home/page.tsx:95,118`). |
| 5.5 | Multi-agent (planner/executor/critic) | Missing | — |
| 5.6 | 👍/👎 feedback per response | Partial | Buttons exist (`ChatMessagesView.tsx:226,239`) but **are never saved**: `useHomeChat.ts` `handleFeedback` only sets React state. |
| 5.6 | Golden dataset, A/B prompts | Missing | `tests/test_live_providers.py` checks providers answer, not quality. |
| 5.7 | Model router by complexity | Missing | Static name map (`ai_service.py:18`). |
| 5.7 | Fallback chain | Exists | `FREE_FALLBACK_MODELS` (`ai_service.py:34,355`). |
| 5.7 | Streaming SSE | Exists | `POST /api/chat/stream` (`routers/chat.py:462`). |
| 5.7 | Temperature per task | Partial | Parameter exists (`ai_service.py:182`), always 0.7. |
| 5.7 | Semantic / prompt cache | Missing | — |
| 5.8 | Eval: golden set, LLM judge, traces | Missing / Blocked | Traces blocked on Langfuse (see §0). |

## 2. Part 2: Reviews + wall

Built on branch `feat/reviews-wall`.

| Area | Status | Evidence / gap |
|---|---|---|
| 6.1 Data model | Exists | `Backend/app/models/review.py`: reviews, review_votes, review_replies, review_reports, wall_pins, plus review_bans. Integer ids and JSON lists (see §0). |
| 6.2 Public wall | Exists | `/wall` (`components/reviews/ReviewWall.tsx`): rating/tag/date/verified filters, recent/top/helpful sort, search, cursor infinite scroll, admin-featured section. Search is a case-insensitive substring match, not Postgres full-text. |
| 6.2 Pin to wall | Exists | 📌 on every card; `/wall/me` with drag-and-drop and up/down reorder and a per-pin public switch; `/users/[id]/wall`. |
| 6.3 API | Exists | 22 endpoints in `Backend/app/routers/reviews/`. Differences: the summary is `GET /api/reviews/summary` (it summarizes all reviews, so there is no `:id`); added `/mine`, `/similar`, `/appeal`, `PUT /api/wall/me/order`, and unban. |
| 6.4 Components | Exists, minus media | ReviewForm, ReviewCard (helpful, pin, report, reply thread, verified badge), ReviewStats, AISummaryCard, filters/sort, empty states, skeletons. **Missing: media upload + MediaGallery** (`media_urls` column exists, the API doesn't accept it yet). Grid is CSS masonry, not virtualized. |
| 6.5 Sentiment, spam, toxicity, auto-tags | Exists (heuristic) | `Backend/app/services/review_moderation.py`: rule-based, no LLM; English + romanized Hindi abuse list. |
| 6.5 AI summary | Exists | LLM text when `OPENROUTER_API_KEY` is set (10-min cache), otherwise built from the numbers. Not verified against the real LLM locally (no key here). |
| 6.5 Helpful prediction / similar | Exists | Wilson-score ranking; TF-IDF similar reviews. |
| 6.5 Language detection + translate | Missing | — |
| 6.6 Moderation | Exists | Queue, approve/reject/hide with a note to the author, feature, shadow ban, full ban, unban, one appeal per review, 3 reports requeue an untrusted review. Page: `/admin/reviews`. |

## 3. Part 3: bonus features

| Feature | Status | Evidence |
|---|---|---|
| File upload (PDF/image/doc) | Exists | `routers/upload.py`, attachment chips on `/home` |
| Regenerate, stop, copy, share | Exists | `ChatMessagesView.tsx` |
| Edit + resend | Partial | Code workspace only (`components/code/MessageActions.tsx`) |
| Slash commands (`/imagine`) | Partial | Only `/imagine` (`ai_service.py` `_IMG_EXPLICIT_RE`) |
| Conversation search | Exists | Sidebar search (`components/layout/sidebar.tsx`) |
| Conversation branching, @mentions | Missing | — |
| Response style / personality | Partial | `responseStyle` setting (`routers/chat.py:84`); no Hinglish mode |
| Language selection | Exists | next-intl (`providers/LocaleProvider.tsx`) |
| Usage / token / cost tracking | Partial | `UsageDaily`, `UsageLog.cost_usd` stored; no user dashboard |
| Rate limiting | Exists | `utils/rate_limit.py` |
| Audit log, kill switch, human-in-the-loop | Missing | — |
| Integrations (Slack, Discord, WhatsApp, …) | Missing | — |
| Payments | Exists | Razorpay (`routers/payment.py`) |
