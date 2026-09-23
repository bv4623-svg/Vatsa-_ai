"""RouterEngine.generate(): one buffered (non-streaming) call, with
per-candidate retry and fallback across the whole request deadline."""
from __future__ import annotations

import asyncio
import time
from typing import Optional

from app.ai_router.engine.base import logger
from app.ai_router.errors import AllProvidersFailed, ErrorKind, ProviderError
from app.ai_router.providers.base import ProviderResult
from app.ai_router.sanitize import redact_identity
from app.ai_router.types import GenerateResult, RouteMeta, RouteRequest


class _GenerateMixin:
    async def generate(self, request: RouteRequest) -> GenerateResult:
        start = time.monotonic()
        with self._admission.slot(request.priority):
            deadline = start + self._config.total_timeout_s
            candidates = self._candidates(request)
            attempts_total = 0
            last_error: Optional[ProviderError] = None

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
                retry_policy = self._retries.for_provider(spec.provider)

                attempt = 0
                model_error: Optional[ProviderError] = None
                result: Optional[ProviderResult] = None
                while True:
                    attempt += 1
                    attempts_total += 1
                    remaining = deadline - time.monotonic()
                    if remaining <= 0.05:
                        model_error = model_error or ProviderError(ErrorKind.TIMEOUT, detail="deadline exceeded")
                        break
                    per_attempt_timeout = min(self._config.timeout_s, remaining)

                    async def call(spec=spec, per_attempt_timeout=per_attempt_timeout):
                        return await asyncio.wait_for(
                            adapter.generate(
                                spec.model, request.messages,
                                max_tokens=request.max_tokens, temperature=request.temperature,
                                timeout_s=per_attempt_timeout,
                            ),
                            timeout=per_attempt_timeout + 2.0,  # guard above the adapter's own timeout
                        )

                    try:
                        result = await self._attempt(spec, breaker, call, deadline=deadline)
                    except ProviderError as err:
                        model_error = err
                        if not retry_policy.should_retry(err.kind, attempt, err.retry_after):
                            break
                        remaining = deadline - time.monotonic()
                        if remaining <= 0:
                            break
                        delay = retry_policy.delay_s(attempt, err.retry_after)
                        await asyncio.sleep(min(delay, remaining))
                        continue
                    else:
                        break

                if result is None:
                    last_error = model_error
                    continue

                duration_ms = (time.monotonic() - start) * 1000
                self._record_usage(request, spec, status="ok", error=None, usage=result.usage,
                                    duration_ms=duration_ms)
                meta = RouteMeta(request.request_id, spec.provider, spec.id, round(duration_ms, 1),
                                  attempts_total, idx)
                terms = self._terms()
                content = redact_identity(result.content, terms)
                reasoning = redact_identity(result.reasoning, terms) if result.reasoning else result.reasoning
                return GenerateResult(content, reasoning, result.usage, meta)

        duration_ms = (time.monotonic() - start) * 1000
        self._record_usage(request, None, status="error",
                            error=(last_error.kind.value if last_error else "no_candidates"),
                            duration_ms=duration_ms)
        self._metrics.incr("router_requests_exhausted_total")
        raise AllProvidersFailed(retry_after=last_error.retry_after if last_error else None)
