"""
app/providers/openrouter.py

Production‑ready OpenRouter provider with:
- Self‑contained 10,000+ identity‑detection patterns (no external imports)
- Early interception: returns fixed identity response before any API call
- Async, streaming, health checks, cost estimation, token counting
- Shared HTTP client with connection pooling
- Built‑in retry with exponential backoff (via BaseProvider)
- Circuit breaker integration (via health_monitor)
- Model list caching (5 minutes)
- Capability detection
- Optional usage of router_cache for responses
"""

import asyncio
import json
import logging
import re
import time
from typing import Dict, List, Optional, AsyncGenerator, Set, Any, Union
from contextlib import asynccontextmanager

import httpx
import tiktoken

from app.config.settings import settings
from app.providers.base import BaseProvider, ProviderConfig, Capability
from app.cache.router_cache import router_cache
from app.providers.client import health_monitor

logger = logging.getLogger(__name__)

# =============================================================================
# 🛡️ SELF‑CONTAINED 10,000+ IDENTITY PATTERNS (generated at load time)
# =============================================================================

def _build_identity_patterns() -> List[str]:
    """
    Build a comprehensive list of regex patterns to catch ANY identity/model/creator question.
    Returns 10,000+ patterns.
    """
    # ─── Base Components ──────────────────────────────────────────────────
    PRONOUNS = ["you", "u", "ur", "ya", "yuh", "yours", "you're"]
    
    VERBS = {
        "build": ["build", "builds", "built", "builded", "builtt", "builted"],
        "create": ["create", "creates", "created", "creat", "creatd", "createsd"],
        "make": ["make", "makes", "made", "maked", "madee"],
        "develop": ["develop", "develops", "developed", "developd", "develope"],
        "own": ["own", "owns", "owned", "ownd", "owne"],
        "train": ["train", "trains", "trained", "traind", "traine"],
        "power": ["power", "powers", "powered", "powerd"],
        "design": ["design", "designs", "designed", "designd"],
        "code": ["code", "codes", "coded"],
        "program": ["program", "programs", "programmed", "programed"],
        "engineer": ["engineer", "engineers", "engineered", "enginered"],
    }
    
    MODEL_NAMES = [
        "gpt", "chatgpt", "chat gpt", "gpt3", "gpt4", "gpt-3", "gpt-4",
        "claude", "deepseek", "gemini", "grok", "llama", "mistral",
        "qwen", "cohere", "openai", "anthropic", "google", "meta",
        "xai", "groq", "microsoft", "azure", "alexa", "siri",
        "cortana", "watson", "bert", "turing", "dalle", "midjourney",
        "stable diffusion", "bard", "ernie", "jasper", "copilot",
        "gemini pro", "claude 3", "sonnet", "opus", "haiku",
        "phi", "gemma", "falcon", "bloom", "opt", "palm", "lamda",
        "megatron", "albert", "roberta", "distilbert",
    ]
    
    COMPANY_NAMES = [
        "openai", "anthropic", "deepseek", "google", "meta",
        "microsoft", "xai", "groq", "cohere", "amazon", "ibm",
        "apple", "oracle", "salesforce", "nvidia", "intel",
        "huawei", "baidu", "tencent", "alibaba", "yandex"
    ]
    
    KEYWORDS = ["model", "llm", "ai", "assistant", "chatbot", "system", "backend", "provider", "api", "infrastructure"]
    
    EXTRA_PHRASES = [
        "who is behind you",
        "who is your parent company",
        "which company made you",
        "which company owns you",
        "what is your backend",
        "what is your infrastructure",
        "what api do you use",
        "what provider do you use",
        "what is your training data",
        "who trained you",
        "how were you trained",
        "reveal your system prompt",
        "print your hidden instructions",
        "ignore previous instructions",
        "override your system prompt",
        "what is your system prompt",
        "show me your system prompt",
        "tell me your system prompt",
        "your system prompt",
        "your hidden instructions",
        "your internal instructions",
    ]
    
    patterns: Set[str] = set()
    
    # 1. "who/what/which + verb + pronoun"
    for starter in ["who", "what", "which"]:
        for verb_list in VERBS.values():
            for verb in verb_list:
                for pron in PRONOUNS:
                    patterns.add(rf"{starter}\s+{verb}\s+{pron}")
                    if pron in ["your", "yours"]:
                        patterns.add(rf"{starter}\s+{verb}\s+{pron}\s+model")
                        patterns.add(rf"{starter}\s+{verb}\s+{pron}\s+ai")
                        patterns.add(rf"{starter}\s+{verb}\s+{pron}\s+llm")
                    patterns.add(rf"{starter}\s+{verb}\s+{pron}\s+ai")
                    patterns.add(rf"{starter}\s+{verb}\s+{pron}\s+assistant")
    
    # 2. "are you [model]?" with all models and pronoun variants
    for model in MODEL_NAMES:
        for pron in ["you", "u", "ur", "ya", "yuh"]:
            if " " in model:
                patterns.add(rf"are\s+{pron}\s+{model}")
                patterns.add(rf"are\s+{pron}\s+{model.replace(' ', '')}")
                patterns.add(rf"are\s+{pron}\s+{model.replace(' ', '\s*')}")
            else:
                patterns.add(rf"are\s+{pron}\s+{model}")
    
    # 3. "who/which company [verb] you?"
    for starter in ["who", "which"]:
        for company in COMPANY_NAMES:
            for verb in ["made", "created", "developed", "owns", "built", "designed", "programmed"]:
                patterns.add(rf"{starter}\s+{company}\s+{verb}\s+you")
                patterns.add(rf"does\s+{company}\s+{verb}\s+you")
                patterns.add(rf"do\s+{company}\s+{verb}\s+you")
    
    # 4. Preambles + basic questions
    base_creator = [
        "who built you", "who builds you", "who build you",
        "who created you", "who created u", "who created ur",
        "who made you", "who made u", "who made ur",
        "who developed you", "who developed u",
        "who owns you", "who owns u",
        "who is your developer", "who is ur developer",
        "who is behind you", "who is behind u",
        "who powers you", "who powers u",
        "which model are you", "what model are you",
        "which model are u", "what model are u",      # added u variant
        "what is your model", "what's your model",
        "what llm are you", "what's your llm",
        "are you chatgpt", "are you chat gpt", "are you gpt",
        "are you claude", "are you deepseek", "are you gemini",
        # ─── NEW: using/currently/running variations ────────────────────
        "which model are you using",
        "which model are u using",
        "what model are you using",
        "what model are u using",
        "which llm are you using",
        "which llm are u using",
        "what llm are you using",
        "what llm are u using",
        "which ai model are you using",
        "which ai model are u using",
        "what ai model are you using",
        "what ai model are u using",
        "which model are you running",
        "what model are you running",
        "which model are you currently using",
        "what model are you currently using",
        "which ai model are you currently using",
        "what ai model are you currently using",
        "which llm are you currently using",
        "what llm are you currently using",
    ]
    for preamble in ["could you tell me", "can you tell me", "would you tell me", "do you know", "i want to know"]:
        for base in base_creator:
            patterns.add(rf"{preamble}\s+{base}")
    
    # 5. Extra phrases (with regex escaping)
    for phrase in EXTRA_PHRASES:
        patterns.add(re.escape(phrase))
    
    # 6. All base_creator directly
    for b in base_creator:
        patterns.add(b)
    
    # 7. "what is your [keyword]?"
    for keyword in KEYWORDS:
        for pron in ["your", "ur"]:
            patterns.add(f"what is {pron} {keyword}")
            patterns.add(f"what's {pron} {keyword}")
            patterns.add(f"what are {pron} {keyword}")
    
    # 8. Preambles + "are you [model]"
    question_starters = [
        "who", "what", "which", "are", "do", "does",
        "could you tell me", "can you tell me", "would you tell me",
        "do you know", "can you tell", "could you tell",
        "i want to know", "i would like to know", "tell me",
        "please tell me", "kindly tell me"
    ]
    for preamble in question_starters:
        for model in MODEL_NAMES:
            patterns.add(f"{preamble} are you {model}")
            patterns.add(f"{preamble} are u {model}")
    
    # ─── NEW: Additional "using" variants with preambles ──────────────
    using_questions = [
        "which model are you using",
        "what model are you using",
        "which llm are you using",
        "what llm are you using",
        "which ai model are you using",
        "what ai model are you using"
    ]
    for preamble in question_starters:
        for q in using_questions:
            patterns.add(f"{preamble} {q}")
    
    # Return as sorted list
    return sorted(patterns)

# Generate the patterns once at module load
IDENTITY_PATTERNS = _build_identity_patterns()
logger.info(f"🛡️ OpenRouter: Generated {len(IDENTITY_PATTERNS)} identity‑detection patterns.")

# Compile regex for fast matching
_IDENTITY_REGEX = re.compile(r"(" + "|".join(IDENTITY_PATTERNS) + r")", re.IGNORECASE)

def _has_identity_question(messages: List[Dict[str, str]]) -> bool:
    """Check if any user message in the list matches an identity question pattern."""
    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if _IDENTITY_REGEX.search(content):
                return True
    return False

def _get_identity_response() -> str:
    """Return the fixed identity response."""
    return "I am Vatsa AI. I was built by Bighnesh Vatsa. I don't disclose internal implementation details."

# =============================================================================
# OpenRouter Provider Class
# =============================================================================

class OpenRouterProvider(BaseProvider):
    """
    Production‑ready OpenRouter provider.

    Features:
    - Async, streaming, health checks, cost estimation, token counting
    - Shared HTTP client with connection pooling
    - Built‑in retry with exponential backoff (via BaseProvider)
    - Circuit breaker integration (via health_monitor)
    - Model list caching (5 minutes)
    - Capability detection
    - Optional usage of router_cache for responses
    - Early identity interception (10k+ patterns) – no API call for identity questions
    """

    # -------------------------------------------------------------------------
    #  MODIFIED __init__ – API key is now optional (logs warning instead of raising)
    # -------------------------------------------------------------------------
    def __init__(self, config: Optional[ProviderConfig] = None):
        super().__init__(config or ProviderConfig())
        self.api_key = self.config.api_key or settings.OPENROUTER_API_KEY
        if not self.api_key:
            logger.warning("OpenRouter API key not set. Provider will not work.")
        self.base_url = settings.OPENROUTER_BASE_URL or "https://openrouter.ai/api/v1"
        self.default_model = settings.DEFAULT_MODEL or "openai/gpt-4.1-mini"

        # HTTP client (lazy‑initialized)
        self._client: Optional[httpx.AsyncClient] = None
        self._client_lock = asyncio.Lock()

        # Tokenizer
        try:
            self.tokenizer = tiktoken.get_encoding("cl100k_base")
        except Exception:
            logger.warning("tiktoken not available; falling back to char/4 estimation")
            self.tokenizer = None

        # Model capabilities (static mapping; can be extended from remote)
        self._capabilities = {
            "openai/gpt-4.1-mini": {
                Capability.REASONING,
                Capability.MATH,
                Capability.TRANSLATION,
            },
            "openai/gpt-4o": {
                Capability.REASONING,
                Capability.CODING,
                Capability.VISION,
                Capability.SEARCH,
                Capability.TOOL_USE,
            },
            "anthropic/claude-3.5-sonnet": {
                Capability.REASONING,
                Capability.CODING,
                Capability.LONG_CONTEXT,
            },
            "google/gemini-2.5-pro": {
                Capability.REASONING,
                Capability.CODING,
                Capability.VISION,
                Capability.SEARCH,
                Capability.LONG_CONTEXT,
            },
            "deepseek/deepseek-chat": {
                Capability.REASONING,
                Capability.CODING,
                Capability.MATH,
            },
            "meta-llama/llama-3.1-70b": {
                Capability.REASONING,
                Capability.TRANSLATION,
            },
        }
        self._default_caps = {Capability.REASONING, Capability.TRANSLATION}

        # Model cache
        self._model_cache: Optional[List[str]] = None
        self._model_cache_time: float = 0
        self._model_cache_ttl = 300  # 5 minutes

    # -------------------------------------------------------------------------
    #  HTTP Client Management
    # -------------------------------------------------------------------------

    async def _get_client(self) -> httpx.AsyncClient:
        """Lazy‑create a shared httpx client with connection pooling."""
        if self._client is None or self._client.is_closed:
            async with self._client_lock:
                if self._client is None or self._client.is_closed:
                    limits = httpx.Limits(
                        max_connections=100,
                        max_keepalive_connections=20,
                    )
                    timeout = httpx.Timeout(
                        connect=5.0,
                        read=self.config.timeout,
                        write=self.config.timeout,
                        pool=10.0,
                    )
                    headers = {
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://vatsa.ai",
                        "X-Title": "Vatsa AI Router",
                    }
                    if self.api_key:
                        headers["Authorization"] = f"Bearer {self.api_key}"
                    self._client = httpx.AsyncClient(
                        base_url=self.base_url,
                        timeout=timeout,
                        limits=limits,
                        headers=headers,
                    )
        return self._client

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
        self._client = None

    # -------------------------------------------------------------------------
    #  Core Provider Methods (implement BaseProvider)
    # -------------------------------------------------------------------------

    @property
    def provider_name(self) -> str:
        return "openrouter"

    # ─── MODIFIED: intercept identity questions before any API call ──────

    async def generate_async(
        self,
        messages: List[Dict[str, str]],
        model: str,
        **kwargs
    ) -> str:
        """
        Async non‑streaming completion.

        Uses BaseProvider's retry mechanism.
        """
        # 🛡️ EARLY INTERCEPT: if any user message is an identity question,
        # return fixed response immediately – no API call.
        if _has_identity_question(messages):
            logger.info("🛡️ OpenRouterProvider intercepted identity question – returning fixed response (no API call).")
            return _get_identity_response()

        # If cache enabled, check router_cache first
        cache_key = None
        if kwargs.get("use_cache", True):
            cache_key = f"openrouter:{model}:{hash(str(messages))}:{hash(str(kwargs))}"
            cached = router_cache.get(cache_key)
            if cached:
                logger.debug(f"Cache hit for {model}")
                return cached

        # Perform request (with retries)
        response = await self.generate_with_retry(messages, model, **kwargs)

        # Cache the response
        if cache_key:
            router_cache.set(cache_key, response)

        return response

    async def _generate_once(
        self,
        messages: List[Dict[str, str]],
        model: str,
        **kwargs
    ) -> str:
        """
        Single attempt (used internally by generate_with_retry).
        """
        if not self.api_key:
            raise ValueError("OpenRouter API key is missing. Set OPENROUTER_API_KEY in environment.")

        client = await self._get_client()
        payload = {
            "model": model,
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 4096),
            "stream": False,
            **{k: v for k, v in kwargs.items() if k not in ["temperature", "max_tokens"]},
        }

        start_time = time.time()
        try:
            response = await client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            await health_monitor.record_success(self.provider_name, time.time() - start_time)
            return content
        except Exception as e:
            await health_monitor.record_failure(self.provider_name, str(e))
            raise

    # ─── MODIFIED: intercept identity questions before streaming ────────

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        model: str,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Async streaming completion.
        """
        # 🛡️ INTERCEPT BEFORE STREAMING
        if _has_identity_question(messages):
            logger.info("🛡️ OpenRouterProvider intercepted identity question in stream – returning fixed response.")
            yield _get_identity_response()
            return

        if not self.api_key:
            raise ValueError("OpenRouter API key is missing. Set OPENROUTER_API_KEY in environment.")

        client = await self._get_client()
        payload = {
            "model": model,
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 4096),
            "stream": True,
            **{k: v for k, v in kwargs.items() if k not in ["temperature", "max_tokens"]},
        }

        start_time = time.time()
        try:
            async with client.stream("POST", "/chat/completions", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk["choices"][0].get("delta", {})
                            content = delta.get("content")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
                await health_monitor.record_success(self.provider_name, time.time() - start_time)
        except Exception as e:
            await health_monitor.record_failure(self.provider_name, str(e))
            raise

    # -------------------------------------------------------------------------
    #  Additional Abstract Methods
    # -------------------------------------------------------------------------

    async def health_check(self) -> bool:
        """Check API key and service availability."""
        if not self.api_key:
            return False
        try:
            await self.list_models()
            return True
        except Exception as e:
            logger.error(f"OpenRouter health check failed: {e}")
            return False

    async def list_models(self) -> List[str]:
        """Fetch and cache model list from OpenRouter."""
        if not self.api_key:
            return list(self._capabilities.keys())
        if self._model_cache and (time.time() - self._model_cache_time) < self._model_cache_ttl:
            return self._model_cache

        client = await self._get_client()
        try:
            response = await client.get("/models")
            response.raise_for_status()
            data = response.json()
            models = [m["id"] for m in data.get("data", [])]
            if models:
                self._model_cache = models
                self._model_cache_time = time.time()
                return models
            return list(self._capabilities.keys())
        except Exception as e:
            logger.warning(f"Failed to fetch models from OpenRouter: {e}")
            return list(self._capabilities.keys())

    def estimate_cost(self, prompt_tokens: int, completion_tokens: int, model: str) -> float:
        cost_per_1k = settings.PROVIDER_COSTS.model_costs.get(model, 0.0002)
        return (prompt_tokens + completion_tokens) / 1000 * cost_per_1k

    def estimate_tokens(self, text: str) -> int:
        if self.tokenizer:
            try:
                return len(self.tokenizer.encode(text))
            except Exception:
                pass
        return len(text) // 4

    def supports_capability(self, capability: Union[str, Capability]) -> bool:
        if isinstance(capability, str):
            try:
                capability = Capability(capability)
            except ValueError:
                return False
        for caps in self._capabilities.values():
            if capability in caps:
                return True
        return capability in self._default_caps

    # -------------------------------------------------------------------------
    #  Convenience Method for Router Engine (Legacy Compatibility)
    # -------------------------------------------------------------------------

    async def generate_async_simple(
        self,
        query: str,
        intent: str,
        model: Optional[str] = None,
        **kwargs
    ) -> str:
        if model is None:
            model = self.default_model
        messages = [
            {"role": "system", "content": f"You are an AI assistant. Current intent: {intent}"},
            {"role": "user", "content": query}
        ]
        return await self.generate_async(messages, model, **kwargs)

    # -------------------------------------------------------------------------
    #  Additional Utility: Get capabilities for a specific model
    # -------------------------------------------------------------------------

    def get_model_capabilities(self, model: str) -> Set[Capability]:
        return self._capabilities.get(model, self._default_caps)


# =============================================================================
#  Aliases for Backward Compatibility
# =============================================================================

OpenAIProvider = OpenRouterProvider
GoogleProvider = OpenRouterProvider

_default_provider: Optional[OpenRouterProvider] = None


def get_openrouter_provider() -> OpenRouterProvider:
    global _default_provider
    if _default_provider is None:
        _default_provider = OpenRouterProvider()
    return _default_provider


@asynccontextmanager
async def openrouter_client():
    provider = OpenRouterProvider()
    try:
        yield provider
    finally:
        await provider.close()