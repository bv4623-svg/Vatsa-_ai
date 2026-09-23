"""RouterEngine's shared state and the small helpers both generate.py and
stream.py's mixins call into: __init__, the admin-facing introspection
properties, and the per-attempt bookkeeping (breaker/health/metrics/usage)
common to both a buffered call and one stream chunk-loop iteration."""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Dict, Mapping, Optional

from app.ai_router.admission import AdmissionController
from app.ai_router.circuit_breaker import BreakerBoard, CircuitBreaker
from app.ai_router.config import RouterConfig
from app.ai_router.errors import ErrorKind, HEALTH_AFFECTING, ProviderError
from app.ai_router.fallback import plan_candidates
from app.ai_router.health import HealthTracker
from app.ai_router.load_balancer import InFlightTracker
from app.ai_router.metrics import RouterMetrics
from app.ai_router.providers.base import ProviderAdapter
from app.ai_router.registry import ModelRegistry
from app.ai_router.retry import RetryPolicies, RetryPolicy
from app.ai_router.strategy import Strategy, StrategyContext, build_strategy, parse_weights
from app.ai_router.types import ModelSpec, RouteRequest
from app.ai_router.usage import LoggingUsageSink, UsageRecord, UsageSink, estimate_cost

logger = logging.getLogger("AIRouter.engine")


class _RouterEngineBase:
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
