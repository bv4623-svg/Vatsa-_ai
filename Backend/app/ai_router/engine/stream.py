"""RouterEngine.stream(): the streaming counterpart to generate() -- no
fallback once a DELTA has reached the caller, cross-chunk identity
redaction via StreamingRedactor, and check_provider_health() for the
scheduler/admin endpoint."""
from __future__ import annotations

import asyncio
import time
from typing import AsyncIterator, Dict, Optional

from app.ai_router.engine.base import logger
from app.ai_router.errors import AllProvidersFailed, ErrorKind, HEALTH_AFFECTING, ProviderError, RouterOverloaded
from app.ai_router.sanitize import StreamingRedactor
from app.ai_router.types import EventType, RouteMeta, RouteRequest, StreamEvent


class _StreamMixin:
    async def stream(self, request: RouteRequest) -> AsyncIterator[StreamEvent]:
        """Streams DELTA/THINKING/USAGE events, then one final DONE.

        Once a DELTA has been yielded to the caller, the response has already
        started reaching the user: the engine will not switch models after
        that point. On failure it yields DONE(truncated=True) instead of
        raising, so a partial answer already shown to the user is not
        followed by a confusing exception.
        """
        start = time.monotonic()
        if not self._admission.try_acquire(request.priority):
            raise RouterOverloaded()
        try:
            deadline = start + self._config.total_timeout_s
            candidates = self._candidates(request)
            attempts_total = 0
            last_error: Optional[ProviderError] = None
            terms = self._terms()

            for idx, spec in enumerate(candidates):
                if time.monotonic() >= deadline:
                    break
                breaker = self._breakers.get(spec.id)
                if not breaker.allow():
                    continue
                adapter = self._adapters.get(spec.provider)
                if adapter is None:
                    breaker.cancel()
                    logger.error("No adapter registered for provider %r (model %r)", spec.provider, spec.id)
                    continue

                started_output = False
                usage_seen = None
                attempts_total += 1
                call_start = time.monotonic()
                self._inflight.begin(spec.id)
                # One redactor per candidate attempt: it holds back the last
                # few words instead of redacting each chunk in isolation, so
                # a leak split across two chunks by the provider (e.g.
                # "Google's" / " Gemini") is still caught as a whole -- see
                # StreamingRedactor's docstring. flush()ed below wherever
                # this attempt stops sending DELTA/THINKING events.
                delta_redactor = StreamingRedactor(terms)
                thinking_redactor = StreamingRedactor(terms)
                try:
                    idle_timeout = min(self._config.timeout_s, max(0.05, deadline - time.monotonic()))
                    agen = adapter.stream(
                        spec.model, request.messages,
                        max_tokens=request.max_tokens, temperature=request.temperature,
                        timeout_s=idle_timeout,
                    )
                    while True:
                        try:
                            event = await asyncio.wait_for(agen.__anext__(), timeout=idle_timeout + 2.0)
                        except StopAsyncIteration:
                            break
                        if event.type == EventType.THINKING:
                            if request.include_reasoning:
                                started_output = True
                                piece = thinking_redactor.feed(event.content)
                                if piece:
                                    yield StreamEvent(EventType.THINKING, content=piece)
                            continue
                        if event.type == EventType.DELTA:
                            started_output = True
                            piece = delta_redactor.feed(event.content)
                            if piece:
                                yield StreamEvent(EventType.DELTA, content=piece)
                            continue
                        if event.type == EventType.USAGE:
                            usage_seen = event.usage
                            continue
                    # Stream ended normally: release whatever was still held back.
                    tail = thinking_redactor.flush()
                    if tail:
                        yield StreamEvent(EventType.THINKING, content=tail)
                    tail = delta_redactor.flush()
                    if tail:
                        yield StreamEvent(EventType.DELTA, content=tail)
                except (ProviderError, asyncio.TimeoutError) as exc:
                    err = exc if isinstance(exc, ProviderError) else ProviderError(
                        ErrorKind.TIMEOUT, detail="stream idle timeout"
                    )
                    self._inflight.end(spec.id)
                    if started_output:
                        # Output already reached the client: count it for health, but
                        # never fail over mid-stream — that would duplicate the answer.
                        if err.kind in HEALTH_AFFECTING:
                            breaker.record_failure()
                            self._health.record_failure(spec.id, err.kind)
                        else:
                            breaker.cancel()
                        # Release whatever text was still held back for cross-chunk
                        # redaction before telling the client the stream broke --
                        # it was legitimately sent before the failure, not lost.
                        tail = thinking_redactor.flush()
                        if tail:
                            yield StreamEvent(EventType.THINKING, content=tail)
                        tail = delta_redactor.flush()
                        if tail:
                            yield StreamEvent(EventType.DELTA, content=tail)
                        duration_ms = (time.monotonic() - start) * 1000
                        self._record_usage(request, spec, status="truncated", error=err.kind.value,
                                            usage=usage_seen, duration_ms=duration_ms)
                        meta = RouteMeta(request.request_id, spec.provider, spec.id, round(duration_ms, 1),
                                          attempts_total, idx)
                        yield StreamEvent(EventType.DONE, truncated=True, usage=usage_seen, meta=meta)
                        return
                    if err.kind in HEALTH_AFFECTING:
                        breaker.record_failure()
                        self._health.record_failure(spec.id, err.kind)
                    else:
                        breaker.cancel()
                    self._metrics.incr("router_requests_total", provider=spec.provider, model=spec.id,
                                        status="error", error=err.kind.value)
                    last_error = err
                    continue
                except asyncio.CancelledError:
                    # The client disconnected. Not the model's fault: hand the
                    # breaker slot back without recording success or failure.
                    self._inflight.end(spec.id)
                    breaker.cancel()
                    raise
                else:
                    latency_ms = (time.monotonic() - call_start) * 1000
                    self._inflight.end(spec.id)
                    breaker.record_success()
                    self._health.record_success(spec.id, latency_ms)
                    self._metrics.incr("router_requests_total", provider=spec.provider, model=spec.id, status="ok")
                    self._metrics.observe_latency(latency_ms, provider=spec.provider, model=spec.id)
                    duration_ms = (time.monotonic() - start) * 1000
                    self._record_usage(request, spec, status="ok", error=None, usage=usage_seen,
                                        duration_ms=duration_ms)
                    meta = RouteMeta(request.request_id, spec.provider, spec.id, round(duration_ms, 1),
                                      attempts_total, idx)
                    if usage_seen:
                        yield StreamEvent(EventType.USAGE, usage=usage_seen)
                    yield StreamEvent(EventType.DONE, truncated=False, usage=usage_seen, meta=meta)
                    return

            duration_ms = (time.monotonic() - start) * 1000
            self._record_usage(request, None, status="error",
                                error=(last_error.kind.value if last_error else "no_candidates"),
                                duration_ms=duration_ms)
            self._metrics.incr("router_requests_exhausted_total")
            raise AllProvidersFailed(retry_after=last_error.retry_after if last_error else None)
        finally:
            self._admission.release()

    # -- active health checks, for the scheduler / admin endpoint -------
    async def check_provider_health(self, timeout_s: float = 5.0) -> Dict[str, bool]:
        if not self._config.health_check_enabled:
            return {}
        return await self._health.check_providers(self._adapters, timeout_s)
