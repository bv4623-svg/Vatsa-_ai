import sys

# Windows consoles default to a legacy codepage (cp1252) that can't encode the
# emoji used in several log/print statements across this codebase; without this
# those prints raise UnicodeEncodeError and crash the process at import time.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path if env_path.exists() else None)

import logging
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field
from typing import List, Optional

from app.middleware import SecurityHeadersMiddleware
from app.middleware.metrics import MetricsMiddleware
from app.middleware.timeout import RequestTimeoutMiddleware
from app.middleware.request_logging import RequestLoggingMiddleware
from app.config.urls import allowed_origins
from app.observability import check_database, check_email_configured, check_redis, db_pool_status, http_metrics, route_status_counters
from app.utils.log_redaction import install as install_log_redaction
from app.utils.structured_logging import install as install_structured_logging
from app.utils.sentry_integration import init_sentry, capture_exception as capture_exception_to_sentry
from app.utils.cache import counters as cache_counters

# Applied at import time (before any router/service logger below can emit a
# line) so a secret can never slip out through a log call made during
# startup either -- see app/utils/log_redaction.py for why this needs more
# than just `logging.getLogger().addFilter(...)`.
install_log_redaction()
# Sets up the root logger's actual output handler (JSON in production,
# human-readable in dev) -- also re-applies the redaction filter above to
# this new handler, since it did not exist yet when install_log_redaction()
# ran a moment ago.
install_structured_logging()
# No-op unless SENTRY_DSN is set (and, even then, only if the optional
# sentry-sdk package is installed -- see the module docstring).
init_sentry()

from app.routers import chat, profile, conversations, auth as auth_router
from app.routers import memory, payment, payment_history, tokens, upload, files, vision
from app.routers import library as library_router
from app.routers import scheduled_tasks as scheduled_tasks_router
from app.routers import chat_projects as chat_projects_router
from app.routers import account as account_router
from app.routers import ai_router_status
from app.core.classifier import IntentClassifier
from intents_data import INTENTS
from app.database import init_db
from app.services.scheduled_tasks import init_scheduler, shutdown_scheduler
from app.services.account import register_account_jobs

# Intent classifier singleton, built lazily on first /api/classify call --
# constructing it eagerly here ran scikit-learn's import plus a TF-IDF
# fit_transform over every intent example on every worker process's
# startup, whether or not classification was ever actually requested.
_intent_classifier: Optional[IntentClassifier] = None
logger = logging.getLogger("Startup")


def _get_intent_classifier() -> IntentClassifier:
    global _intent_classifier
    if _intent_classifier is None:
        _intent_classifier = IntentClassifier()
    return _intent_classifier


def _log_rss_memory(label: str) -> None:
    """Best-effort RSS snapshot for watching memory on a constrained
    instance (e.g. Render's 512MB free tier) -- `resource` is POSIX-only,
    so this is a no-op on Windows dev machines rather than a startup
    failure. ru_maxrss is kilobytes on Linux (where this actually runs in
    production, in Docker) but bytes on macOS -- only the Linux reading is
    trusted enough here to convert to MB."""
    try:
        import platform
        import resource
        rss_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        if platform.system() == "Darwin":
            rss_kb = rss_kb / 1024
        logger.info("RSS MB (%s): %.1f", label, rss_kb / 1024)
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    _log_rss_memory("startup:before")
    try:
        init_db()
        init_scheduler()
        register_account_jobs()
    except Exception:
        logger.exception("Startup failed -- refusing to serve traffic")
        raise
    _log_rss_memory("startup:after")
    yield
    shutdown_scheduler()


# /docs, /redoc and the raw OpenAPI schema are disabled in production so the
# route/schema surface (including anything that could hint at internals) is
# never publicly browsable outside dev/staging.
_is_production = os.getenv("ENV") == "production"

app = FastAPI(
    title="Vatsa AI Backend",
    lifespan=lifespan,
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(MetricsMiddleware)
app.add_middleware(RequestTimeoutMiddleware)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catches anything that isn't already a controlled HTTPException (those
    keep going through FastAPI's normal handling, unaffected by this) --
    an unexpected bug, an unhandled library error, anything. The client
    never sees exception text (which could contain a stack trace, a DB
    error, a file path, or a library version); the full detail is only
    ever logged server-side."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    capture_exception_to_sentry(exc)
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "internal_error", "message": "Something went wrong"}},
    )

# ALLOWED_ORIGINS if set, else the live frontend and API (app/config/urls.py).
_allowed_origins = allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Browsers only expose a small header safelist to JS by default --
    # Retry-After is used by rate-limited/overloaded responses (login, OTP
    # send/resend, the AI router's 503) and needs this to be readable via
    # fetch()/axios in the frontend.
    expose_headers=["Retry-After"],
)
app.add_middleware(RequestLoggingMiddleware)

# Include all routers
app.include_router(chat.router)
app.include_router(profile.router)
app.include_router(auth_router.router)
app.include_router(conversations.router)
app.include_router(memory.router)
app.include_router(payment.router)
app.include_router(payment_history.router)
app.include_router(tokens.router)
app.include_router(upload.router)
app.include_router(files.router)
app.include_router(vision.router)
app.include_router(library_router.router)
app.include_router(scheduled_tasks_router.router)
app.include_router(chat_projects_router.router)
app.include_router(account_router.router)
app.include_router(ai_router_status.router)


# Intent classification endpoints
class ClassifyRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(5, ge=1, le=27)
    model: Optional[str] = None
    user_tier: str = Field("free")


class IntentMatchResponse(BaseModel):
    intent: str
    confidence: float
    band: str
    matched_keywords: List[str]


class ClassifyResponse(BaseModel):
    query: str
    primary_intent: IntentMatchResponse
    secondary_intents: List[IntentMatchResponse]
    is_multi_intent: bool
    disclaimer: Optional[str] = None


@app.get("/health")
def health():
    """Liveness only: no DB/Redis call, so this stays fast (<50ms) and
    healthy even if a downstream dependency is degraded -- a load balancer
    should use /ready for that instead, not this one."""
    return {"status": "ok", "intents_loaded": len(INTENTS)}


@app.get("/ready")
def ready():
    """Readiness for a load balancer: only returns 200 once every
    dependency this process actually needs is reachable. Email is checked
    for configuration presence only, not a live SMTP handshake -- see
    app/observability.py:check_email_configured for why."""
    db_ok = check_database()
    redis_state = check_redis()  # "ok" | "not_configured" | "unreachable"
    email_ok = check_email_configured()
    checks = {
        "database": "ok" if db_ok else "unreachable",
        "redis": redis_state,
        "email_configured": email_ok,
    }
    # Redis is optional (falls back to in-process rate limiting on a single
    # instance) -- only "unreachable" (configured but broken) fails
    # readiness, not "not_configured".
    is_ready = db_ok and redis_state != "unreachable"
    return JSONResponse(
        status_code=200 if is_ready else 503,
        content={"ready": is_ready, "checks": checks},
    )


@app.get("/metrics")
def metrics():
    """Prometheus text exposition format. Deliberately public (matches how
    Prometheus itself is normally scraped) and deliberately free of
    secrets, per-user data, and provider/model names -- those live on the
    separate admin-gated /api/admin/ai-router/status and /metrics instead
    (see app/routers/ai_router_status.py)."""
    lines = [http_metrics.prometheus()]
    pool = db_pool_status()
    for key, value in pool.items():
        if isinstance(value, (int, float)):
            lines.append(f'db_pool_{key}{{dialect="{pool.get("dialect", "?")}"}} {value}\n')
    redis_state = check_redis()
    redis_value = {"ok": 1, "not_configured": -1, "unreachable": 0}.get(redis_state, -1)
    lines.append(f"redis_connection_state {redis_value}\n")
    cache_hits, cache_misses = cache_counters.snapshot()
    lines.append(f"cache_hit_total {cache_hits}\n")
    lines.append(f"cache_miss_total {cache_misses}\n")
    lines.append(route_status_counters.prometheus())
    return PlainTextResponse("".join(lines), media_type="text/plain; version=0.0.4")


@app.get("/intents")
def list_intents():
    return {
        name: {
            "description": data["description"],
            "keywords": data["keywords"],
            "related_intents": data.get("related_intents", []),
        }
        for name, data in INTENTS.items()
    }


@app.get("/intents/{intent_name}")
def get_intent(intent_name: str):
    intent_name = intent_name.upper()
    if intent_name not in INTENTS:
        raise HTTPException(status_code=404, detail=f"Unknown intent: {intent_name}")
    return {intent_name: INTENTS[intent_name]}


@app.post("/api/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty")

    result = _get_intent_classifier().classify(req.query, top_k=req.top_k)
    return result.to_dict()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
