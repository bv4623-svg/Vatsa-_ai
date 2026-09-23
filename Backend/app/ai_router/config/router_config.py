"""RouterConfig: tunables read from the environment. See
app.ai_router.config's package docstring for the full variable list."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping, Optional

from app.ai_router.config.env_helpers import _bool, _number


@dataclass(frozen=True)
class RouterConfig:
    default_route: str = "auto"
    fallback_enabled: bool = True
    max_retries: int = 1
    timeout_s: float = 30.0
    total_timeout_s: float = 90.0
    strategy: str = "priority"
    strategy_weights: Optional[str] = None
    breaker_failure_threshold: int = 5
    breaker_cooldown_s: float = 30.0
    breaker_half_open_max_calls: int = 1
    health_check_enabled: bool = True
    max_inflight: int = 256
    retry_base_delay_s: float = 0.25
    retry_max_delay_s: float = 2.0
    retry_max_retry_after_s: float = 5.0
    config_path: Optional[str] = None

    @classmethod
    def from_env(cls, env: Optional[Mapping[str, str]] = None) -> "RouterConfig":
        env = os.environ if env is None else env
        return cls(
            default_route=(env.get("AI_DEFAULT_ROUTE") or "auto").strip().lower(),
            fallback_enabled=_bool(env, "AI_FALLBACK_ENABLED", True),
            max_retries=_number(env, "AI_MAX_RETRIES", 1, 0, int),
            timeout_s=_number(env, "AI_TIMEOUT_MS", 30000, 100) / 1000.0,
            total_timeout_s=_number(env, "AI_TOTAL_TIMEOUT_MS", 90000, 100) / 1000.0,
            strategy=(env.get("AI_ROUTER_STRATEGY") or "priority").strip().lower(),
            strategy_weights=(env.get("AI_ROUTER_WEIGHTS") or "").strip() or None,
            breaker_failure_threshold=_number(env, "AI_BREAKER_FAILURES", 5, 1, int),
            breaker_cooldown_s=_number(env, "AI_BREAKER_COOLDOWN_S", 30, 0),
            breaker_half_open_max_calls=_number(env, "AI_BREAKER_HALF_OPEN_CALLS", 1, 1, int),
            health_check_enabled=_bool(env, "AI_PROVIDER_HEALTH_CHECK", True),
            max_inflight=_number(env, "AI_MAX_INFLIGHT", 256, 1, int),
            config_path=(env.get("AI_ROUTER_CONFIG_PATH") or "").strip() or None,
        )
