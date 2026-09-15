import asyncio
import logging
import time
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from collections import defaultdict

logger = logging.getLogger(__name__)


@dataclass
class ProviderHealth:
    success_count: int = 0
    failure_count: int = 0
    last_checked: float = 0.0
    last_error: Optional[str] = None
    response_times: List[float] = field(default_factory=list)
    is_circuit_open: bool = False
    circuit_open_time: float = 0.0

    @property
    def error_rate(self) -> float:
        total = self.success_count + self.failure_count
        if total == 0:
            return 0.0
        return self.failure_count / total

    @property
    def avg_response_time(self) -> float:
        if not self.response_times:
            return 0.0
        return sum(self.response_times) / len(self.response_times)


class ModelHealthMonitor:
    def __init__(self, failure_threshold: int = 3, circuit_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.circuit_timeout = circuit_timeout
        self._health: Dict[str, ProviderHealth] = defaultdict(ProviderHealth)
        self._lock = asyncio.Lock()

    async def record_success(self, provider_name: str, response_time: float) -> None:
        async with self._lock:
            health = self._health[provider_name]
            health.success_count += 1
            health.response_times.append(response_time)
            if len(health.response_times) > 100:
                health.response_times = health.response_times[-100:]
            if health.is_circuit_open:
                health.is_circuit_open = False
                logger.info(f"Circuit closed for {provider_name} after success")

    async def record_failure(self, provider_name: str, error: str) -> None:
        async with self._lock:
            health = self._health[provider_name]
            health.failure_count += 1
            health.last_error = error
            if health.failure_count >= self.failure_threshold and not health.is_circuit_open:
                health.is_circuit_open = True
                health.circuit_open_time = time.time()
                logger.warning(f"Circuit opened for {provider_name} due to repeated failures")

    async def is_healthy(self, provider_name: str) -> bool:
        async with self._lock:
            health = self._health.get(provider_name)
            if not health:
                return True
            if health.is_circuit_open:
                if time.time() - health.circuit_open_time > self.circuit_timeout:
                    health.is_circuit_open = False
                    logger.info(f"Circuit timeout expired for {provider_name}, allowing trial")
                    return True
                return False
            return True

    async def get_stats(self, provider_name: str) -> Optional[ProviderHealth]:
        async with self._lock:
            return self._health.get(provider_name)


# Global health monitor instance (used by openrouter.py)
health_monitor = ModelHealthMonitor(
    failure_threshold=3,   # adjust if needed
    circuit_timeout=60
)


# ============================================================
#  MISSING FUNCTION – added to fix ImportError in main.py
# ============================================================
def get_provider_manager():
    """
    Return a provider manager instance (uses OpenRouter by default).
    This function is imported by main.py.
    """
    from app.providers.openrouter import OpenRouterProvider
    return OpenRouterProvider()