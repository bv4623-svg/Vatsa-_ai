"""Runtime health of each model, as observed from real traffic, plus optional
active provider checks. Read by routing strategies and by the admin status view."""
from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, Mapping, Optional

from app.ai_router.circuit_breaker import BreakerBoard, BreakerState
from app.ai_router.errors import ErrorKind
from app.ai_router.registry import ModelRegistry


@dataclass
class _ModelStats:
    ewma_latency_ms: Optional[float] = None
    successes: int = 0
    failures: int = 0
    recent: Deque[bool] = field(default_factory=lambda: deque(maxlen=50))
    last_error: Optional[str] = None
    last_success_at: Optional[float] = None
    last_failure_at: Optional[float] = None


class HealthTracker:
    def __init__(self, breakers: BreakerBoard, *, ewma_alpha: float = 0.2, clock=time.time) -> None:
        self._breakers = breakers
        self._alpha = ewma_alpha
        self._clock = clock
        self._stats: Dict[str, _ModelStats] = {}
        self._provider_ok: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def _get(self, model_id: str) -> _ModelStats:
        return self._stats.setdefault(model_id, _ModelStats())

    # -- recording -----------------------------------------------------
    def record_success(self, model_id: str, latency_ms: float) -> None:
        with self._lock:
            s = self._get(model_id)
            s.successes += 1
            s.recent.append(True)
            s.last_success_at = self._clock()
            s.ewma_latency_ms = (
                latency_ms if s.ewma_latency_ms is None
                else self._alpha * latency_ms + (1 - self._alpha) * s.ewma_latency_ms
            )

    def record_failure(self, model_id: str, kind: ErrorKind) -> None:
        with self._lock:
            s = self._get(model_id)
            s.failures += 1
            s.recent.append(False)
            s.last_error = kind.value
            s.last_failure_at = self._clock()

    # -- reading -------------------------------------------------------
    def latency_ms(self, model_id: str) -> Optional[float]:
        with self._lock:
            return self._get(model_id).ewma_latency_ms

    def availability(self, model_id: str) -> float:
        """Share of recent calls that succeeded (1.0 when there is no data yet)."""
        with self._lock:
            recent = self._get(model_id).recent
            return sum(recent) / len(recent) if recent else 1.0

    def status(self, model_id: str) -> str:
        state = self._breakers.get(model_id).peek()
        if state == BreakerState.OPEN:
            return "unhealthy"
        with self._lock:
            has_data = bool(self._get(model_id).recent)
        if state == BreakerState.HALF_OPEN or (has_data and self.availability(model_id) < 0.8):
            return "degraded"
        return "healthy" if has_data else "unknown"

    def snapshot(self, registry: ModelRegistry) -> Dict[str, Any]:
        """Per-model view for the admin status endpoint. Contains provider and
        model names, so it must only ever be served to an administrator."""
        out: Dict[str, Any] = {}
        for spec in registry.models():
            with self._lock:
                s = self._get(spec.id)
                row = {
                    "provider": spec.provider,
                    "model": spec.model,
                    "ewma_latency_ms": None if s.ewma_latency_ms is None else round(s.ewma_latency_ms, 1),
                    "successes": s.successes,
                    "failures": s.failures,
                    "last_error": s.last_error,
                }
            row["availability"] = round(self.availability(spec.id), 3)
            row["status"] = self.status(spec.id)
            row["circuit"] = self._breakers.get(spec.id).peek().value
            out[spec.id] = row
        return out

    # -- active checks -------------------------------------------------
    async def check_providers(self, adapters: Mapping[str, Any], timeout_s: float = 5.0) -> Dict[str, bool]:
        """Asks each adapter's health_check(). The result is remembered for
        reporting; it does not open or close circuits (real traffic does that)."""
        results: Dict[str, bool] = {}
        for name, adapter in adapters.items():
            try:
                ok = bool(await adapter.health_check(timeout_s))
            except Exception:  # a broken check is a failed check, never a crash
                ok = False
            results[name] = ok
            with self._lock:
                self._provider_ok[name] = {"ok": ok, "checked_at": self._clock()}
        return results

    def provider_checks(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            return {k: dict(v) for k, v in self._provider_ok.items()}
