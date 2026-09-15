"""
app/providers/client.py – Unified Provider Client for Vatsa AI

Features:
- OpenRouter provider (async, streaming, health checks)
- Circuit breaker & health monitor
- ProviderManager (async + sync initialize for legacy code)
- RouterClient with caching
- get_provider() sync helper
- get_provider_manager() async helper
- Graceful handling of missing API keys (logs warning, doesn't crash)
"""

import asyncio
import json
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import AsyncGenerator, Dict, List, Optional, Set, Tuple, Any

import aiohttp
from aiohttp import ClientTimeout, ClientSession, TCPConnector

from app.config.settings import settings
from app.providers.base import BaseProvider, ProviderConfig, Capability
from app.core.cache import router_cache

logger = logging.getLogger(__name__)


# =============================================================================
# Health Monitor
# =============================================================================

@dataclass
class ProviderHealth:
    """Track health metrics for a single provider."""
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
    """Track health and performance with circuit breaker."""
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
                logger.warning(f"Circuit opened for {provider_name}")

    async def is_healthy(self, provider_name: str) -> bool:
        async with self._lock:
            health = self._health.get(provider_name)
            if not health:
                return True
            if health.is_circuit_open:
                if time.time() - health.circuit_open_time > self.circuit_timeout:
                    health.is_circuit_open = False
                    logger.info(f"Circuit timeout expired for {provider_name}")
                    return True
                return False
            return True

    async def get_stats(self, provider_name: str) -> Optional[ProviderHealth]:
        async with self._lock:
            return self._health.get(provider_name)


# =============================================================================
# Global health monitor instance
# =============================================================================

health_monitor = ModelHealthMonitor(
    failure_threshold=settings.CIRCUIT_BREAKER_THRESHOLD,
    circuit_timeout=settings.CIRCUIT_BREAKER_TIMEOUT
)


# =============================================================================
# OpenRouter Provider Implementation
# =============================================================================

class OpenRouterProvider(BaseProvider):
    """Provider for OpenRouter API using shared aiohttp session."""
    def __init__(self, config: Optional[ProviderConfig] = None):
        super().__init__(config or ProviderConfig())
        self.api_key = self.config.api_key or settings.OPENROUTER_API_KEY
        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY not set. Calls will fail.")
        self.base_url = f"{settings.OPENROUTER_BASE_URL}/chat/completions"
        self.models_url = f"{settings.OPENROUTER_BASE_URL}/models"
        self._session: Optional[ClientSession] = None
        self._model_cache: Optional[List[str]] = None
        self._model_cache_time: float = 0
        self._model_cache_ttl = 300  # 5 minutes

    async def _get_session(self) -> ClientSession:
        if self._session is None or self._session.closed:
            timeout = ClientTimeout(total=self.config.timeout)
            connector = TCPConnector(limit=100, limit_per_host=20, ttl_dns_cache=300, ssl=False)  # ✅ SSL disabled for dev
            self._session = ClientSession(timeout=timeout, connector=connector)
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def __aenter__(self):
        await self._get_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    @property
    def provider_name(self) -> str:
        return "openrouter"

    async def generate_async(self, messages: List[Dict[str, str]], model: str, **kwargs) -> str:
        if not self.api_key:
            raise ValueError("Missing OPENROUTER_API_KEY")

        max_tokens = kwargs.get("max_tokens", 2000)
        temperature = kwargs.get("temperature", 0.7)
        language = kwargs.get("language", "en")

        if language and language != "auto" and messages:
            lang_instruction = f"[IMPORTANT: You MUST respond ONLY in {language.upper()} language.]\n\n"
            if messages and messages[0]["role"] == "user":
                messages[0]["content"] = lang_instruction + messages[0]["content"]
            else:
                messages.insert(0, {"role": "user", "content": lang_instruction + "Please respond."})

        return await self.generate_with_retry(messages, model, **kwargs)

    async def _generate_once(self, messages: List[Dict[str, str]], model: str, **kwargs) -> str:
        session = await self._get_session()
        start_time = time.time()
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 2000),
            "temperature": kwargs.get("temperature", 0.7),
        }
        try:
            async with session.post(self.base_url, json=payload, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    content = data["choices"][0]["message"]["content"]
                    await health_monitor.record_success(self.provider_name, time.time() - start_time)
                    return content
                else:
                    error_text = await resp.text()
                    raise Exception(f"OpenRouter error {resp.status}: {error_text}")
        except Exception as e:
            await health_monitor.record_failure(self.provider_name, str(e))
            raise

    async def generate_stream(self, messages: List[Dict[str, str]], model: str, **kwargs) -> AsyncGenerator[str, None]:
        if not self.api_key:
            raise ValueError("Missing OPENROUTER_API_KEY")

        max_tokens = kwargs.get("max_tokens", 2000)
        temperature = kwargs.get("temperature", 0.7)
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }
        session = await self._get_session()
        start_time = time.time()
        try:
            async with session.post(self.base_url, json=payload, headers=headers) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    await health_monitor.record_failure(self.provider_name, f"Status {resp.status}")
                    raise Exception(f"OpenRouter error {resp.status}: {error_text}")
                async for line in resp.content:
                    line = line.decode("utf-8").strip()
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk["choices"][0].get("delta", {})
                            if "content" in delta:
                                yield delta["content"]
                        except json.JSONDecodeError:
                            continue
                await health_monitor.record_success(self.provider_name, time.time() - start_time)
        except Exception as e:
            await health_monitor.record_failure(self.provider_name, str(e))
            raise

    async def health_check(self) -> bool:
        try:
            models = await self.list_models()
            return len(models) > 0
        except Exception:
            return False

    async def list_models(self) -> List[str]:
        if self._model_cache and (time.time() - self._model_cache_time) < self._model_cache_ttl:
            return self._model_cache
        if not self.api_key:
            return []
        headers = {"Authorization": f"Bearer {self.api_key}"}
        session = await self._get_session()
        try:
            async with session.get(self.models_url, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    models = [m["id"] for m in data.get("data", [])]
                    self._model_cache = models
                    self._model_cache_time = time.time()
                    return models
                return []
        except Exception:
            return []

    def estimate_cost(self, prompt_tokens: int, completion_tokens: int, model: str) -> float:
        cost_per_1k = getattr(settings, "PROVIDER_COSTS", {}).get("model_costs", {}).get(model, 0.0002)
        return (prompt_tokens + completion_tokens) / 1000 * cost_per_1k

    def estimate_tokens(self, text: str) -> int:
        return len(text) // 4

    def supports_capability(self, capability: Capability) -> bool:
        common = {Capability.CODING, Capability.REASONING, Capability.MATH,
                  Capability.TRANSLATION, Capability.TOOL_USE}
        return capability in common


# =============================================================================
# Provider Manager (Async + Sync compatibility)
# =============================================================================

class ProviderManager:
    """
    Singleton manager for all providers.
    Supports both async (recommended) and sync (legacy) initialization.
    """
    _instance = None
    _lock = asyncio.Lock()

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, '_initialized'):
            self._providers: Dict[str, BaseProvider] = {}
            self._initialized = False
            self._health_monitor = health_monitor

    # --- Async interface (recommended) ---

    async def initialize(self):
        """Async initialization – call this in async startup."""
        if self._initialized:
            return
        async with self._lock:
            if self._initialized:
                return
            try:
                openrouter_config = ProviderConfig(
                    api_key=settings.OPENROUTER_API_KEY,
                    timeout=60,
                    max_retries=3,
                    retry_backoff=1.0
                )
                self._providers["openrouter"] = OpenRouterProvider(openrouter_config)
                logger.info("OpenRouter provider initialized successfully")
            except Exception as e:
                logger.warning(f"OpenRouter initialization failed: {e}. Skipping.")
            self._initialized = True
            logger.info(f"ProviderManager initialized with {len(self._providers)} providers")

    async def get_provider(self, name: str) -> Optional[BaseProvider]:
        await self.initialize()
        provider = self._providers.get(name)
        if provider and await health_monitor.is_healthy(name):
            return provider
        return None

    async def get_all_providers(self) -> Dict[str, BaseProvider]:
        await self.initialize()
        return self._providers.copy()

    async def get_healthy_providers(
        self,
        required_capability: Optional[Capability] = None
    ) -> List[BaseProvider]:
        await self.initialize()
        result = []
        for name, provider in self._providers.items():
            if not await health_monitor.is_healthy(name):
                continue
            if required_capability and not provider.supports_capability(required_capability):
                continue
            result.append(provider)
        return result

    async def get_best_provider(
        self,
        messages: List[Dict[str, str]],
        model: str,
        **kwargs
    ) -> Tuple[BaseProvider, str]:
        openrouter = await self.get_provider("openrouter")
        if openrouter:
            return openrouter, model
        providers = await self.get_healthy_providers()
        if not providers:
            raise RuntimeError("No healthy providers available")
        return providers[0], model

    async def close_all(self):
        for provider in self._providers.values():
            if hasattr(provider, "close"):
                await provider.close()
        self._initialized = False

    @property
    def health_monitor(self) -> ModelHealthMonitor:
        return health_monitor

    # --- Synchronous interface (for backward compatibility) ---

    @classmethod
    def initialize_sync(cls):
        if cls._instance is None:
            cls._instance = cls()
        if cls._instance._initialized:
            return
        try:
            loop = asyncio.get_running_loop()
            logger.warning("Called initialize_sync() inside async context – use async initialize() instead.")
            asyncio.create_task(cls._instance.initialize())
        except RuntimeError:
            asyncio.run(cls._instance.initialize())

    @classmethod
    def get_provider_sync(cls, name: str) -> Optional[BaseProvider]:
        if cls._instance is None:
            cls.initialize_sync()
        try:
            loop = asyncio.get_running_loop()
            raise RuntimeError("Use async get_provider() inside async context.")
        except RuntimeError:
            return asyncio.run(cls._instance.get_provider(name))


# ─── Global manager instance ──────────────────────────────────────────────

_manager = ProviderManager()


async def get_provider_manager() -> ProviderManager:
    """Async helper to get the initialized manager."""
    await _manager.initialize()
    return _manager


def get_provider(name: str = "openrouter") -> Optional[BaseProvider]:
    """
    Synchronous get_provider (legacy).
    WARNING: Not safe to call inside an async event loop – use async version instead.
    """
    return ProviderManager.get_provider_sync(name)


# ─── Router Client (high‑level) ────────────────────────────────────────────

class RouterClient:
    def __init__(self):
        self.manager = _manager

    async def generate(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        use_cache: bool = True,
        **kwargs
    ) -> str:
        model = model or settings.DEFAULT_MODEL
        if use_cache:
            cache_key = f"response:{model}:{hash(str(messages))}:{hash(str(kwargs))}"
            cached = router_cache.get(cache_key)
            if cached:
                return cached
        provider, selected_model = await self.manager.get_best_provider(messages, model, **kwargs)
        response = await provider.generate_async(messages, selected_model, **kwargs)
        if use_cache:
            router_cache.set(cache_key, response)
        return response

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        model = model or settings.DEFAULT_MODEL
        provider, selected_model = await self.manager.get_best_provider(messages, model, **kwargs)
        async for chunk in provider.generate_stream(messages, selected_model, **kwargs):
            yield chunk


router_client = RouterClient()

# ─── Exports ────────────────────────────────────────────────────────────────

__all__ = [
    "OpenRouterProvider",
    "ProviderManager",
    "ModelHealthMonitor",
    "RouterClient",
    "router_client",
    "get_provider_manager",
    "get_provider",
    "health_monitor",
]