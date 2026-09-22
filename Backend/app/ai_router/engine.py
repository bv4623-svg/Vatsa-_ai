"""The Router Engine: the one place application code calls to reach an AI
provider. It ties every other module together — registry, strategy,
fallback planning, retry, circuit breaker, admission control, health,
metrics and usage accounting — behind two methods, `generate` and `stream`.

Nothing here imports a provider SDK or builds a provider URL: that stays
inside providers/*. Nothing here is specific to chat, code or vision: those
distinctions are just capability requirements on RouteRequest.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import AsyncIterator, Dict, Mapping, Optional

from app.ai_router.admission import AdmissionController
from app.ai_router.circuit_breaker import BreakerBoard, CircuitBreaker
from app.ai_router.config import RouterConfig
from app.ai_router.errors import AllProvidersFailed, ErrorKind, HEALTH_AFFECTING, ProviderError, RouterOverloaded
from app.ai_router.fallback import plan_candidates
from app.ai_router.health import HealthTracker
from app.ai_router.load_balancer import InFlightTracker
from app.ai_router.metrics import RouterMetrics
from app.ai_router.providers.base import ProviderAdapter, ProviderResult
from app.ai_router.registry import ModelRegistry
from app.ai_router.retry import RetryPolicies, RetryPolicy
from app.ai_router.sanitize import redact_identity
from app.ai_router.strategy import Strategy, StrategyContext, build_strategy, parse_weights
from app.ai_router.types import EventType, GenerateResult, ModelSpec, RouteMeta, RouteRequest, StreamEvent
from app.ai_router.usage import InMemoryUsageSink, LoggingUsageSink, UsageRecord, UsageSink, estimate_cost

logger = logging.getLogger("AIRouter.engine")


class RouterEngine:
    def __init__(
        self,
        registry: ModelRegistry,
        adapters: Mapping[str, ProviderAdapter],
        config: RouterConfig,
        *,
        strategy: Optional[Strategy] = None,
        retry_policies: Optional[RetryPolicies] = None,
        usage_sink: Optional[UsageSink] = None,
        metrics: Optional[RouterMetrics] = None,
    ) -> None:
        self._registry = registry
        self._adapters: Dict[str, ProviderAdapter] = dict(adapters)
        self._config = config
        self._strategy = strategy or build_strategy(config.strategy, parse_weights(config.strategy_weights))
        self._retries = retry_policies or RetryPolicies(
            default=RetryPolicy(
                max_attempts=config.max_retries + 1,
                base_delay_s=config.retry_base_delay_s,
                max_delay_s=config.retry_max_delay_s,
                max_retry_after_s=config.retry_max_retry_after_s,
            )
        )
        self._breakers = BreakerBoard(
            failure_threshold=config.breaker_failure_threshold,
            cooldown_s=config.breaker_cooldown_s,
            half_open_max_calls=config.breaker_half_open_max_calls,
            on_transition=self._on_breaker_transition,
        )
        self._inflight = InFlightTracker()
        self._health = HealthTracker(self._breakers)
        self._admission = AdmissionController(config.max_inflight)
        self._usage = usage_sink or LoggingUsageSink()
        self._metrics = metrics or RouterMetrics()
        self._strategy_ctx = StrategyContext(self._health, self._inflight)

    # -- introspection, for an admin status endpoint only --------------
    @property
    def registry(self) -> ModelRegistry:
        return self._registry

    @property
    def health(self) -> HealthTracker:
        return self._health

    @property
    def metrics(self) -> RouterMetrics:
        return self._metrics

    @property
    def adapters(self) -> Mapping[str, ProviderAdapter]:
        return self._adapters

    @property
    def config(self) -> RouterConfig:
        return self._config

    @property
    def strategy_name(self) -> str:
        return self._strategy.name

    @property
    def inflight_total(self) -> int:
        return self._inflight.total()

    @property
    def admission_inflight(self) -> int:
        return self._admission.inflight

    def breaker_states(self) -> Dict[str, str]:
        return {k: v.value for k, v in self._breakers.states().items()}

    def _on_breaker_transition(self, name: str, old, new) -> None:
        logger.warning("Circuit breaker %s: %s -> %s", name, old.value, new.value)
        self._metrics.incr("router_breaker_transitions_total", model=name, to=new.value)

    def _terms(self):
        return self._registry.internal_terms()

    # -- shared candidate/attempt machinery -----------------------------
    def _candidates(self, request: RouteRequest):
        return plan_candidates(
            self._registry, request, self._strategy, self._strategy_ctx,
            fallback_enabled=self._config.fallback_enabled,
        )

    async def _attempt(
        self, spec: ModelSpec, breaker: CircuitBreaker, call, *, deadline: float,
    ):
        """Runs `call()` (an adapter.generate/stream coroutine factory bound to
        one timeout) and updates breaker/health/metrics/inflight around it.
        Returns the call's result, or raises the classified ProviderError."""
        self._inflight.begin(spec.id)
        start = time.monotonic()
        try:
            result = await call()
        except asyncio.TimeoutError:
            err = ProviderError(ErrorKind.TIMEOUT, detail="engine-level timeout")
        except ProviderError as e:
            err = e
        except Exception as e:  # an adapter bug must never crash the router
            err = ProviderError(ErrorKind.UNKNOWN, detail=f"{type(e).__name__}: {e}"[:300])
        else:
            latency_ms = (time.monotonic() - start) * 1000
            self._inflight.end(spec.id)
            breaker.record_success()
            self._health.record_success(spec.id, latency_ms)
            self._metrics.incr("router_requests_total", provider=spec.provider, model=spec.id, status="ok")
            self._metrics.observe_latency(latency_ms, provider=spec.provider, model=spec.id)
            return result

        self._inflight.end(spec.id)
        if err.kind in HEALTH_AFFECTING:
            breaker.record_failure()
            self._health.record_failure(spec.id, err.kind)
        else:
            breaker.cancel()
        self._metrics.incr(
            "router_requests_total", provider=spec.provider, model=spec.id, status="error", error=err.kind.value
        )
        raise err

    def _record_usage(self, request: RouteRequest, spec: Optional[ModelSpec], *, status: str,
                       error: Optional[str], usage=None, duration_ms: float = 0.0) -> None:
        self._usage.record(UsageRecord(
            request_id=request.request_id,
            user_id=request.user_id,
            provider=spec.provider if spec else "",
            model=spec.id if spec else "",
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
            total_tokens=usage.total_tokens if usage else 0,
            duration_ms=round(duration_ms, 1),
            status=status,
            error=error,
            estimated_cost=estimate_cost(spec, usage) if spec else None,
            tokens_estimated=usage is None,
        ))

    # -- generate (buffered) --------------------------------------------
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

    # -- stream -----------------------------------------------------------
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
                                yield StreamEvent(EventType.THINKING, content=redact_identity(event.content, terms))
                            continue
                        if event.type == EventType.DELTA:
                            started_output = True
                            yield StreamEvent(EventType.DELTA, content=redact_identity(event.content, terms))
                            continue
                        if event.type == EventType.USAGE:
                            usage_seen = event.usage
                            continue
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
