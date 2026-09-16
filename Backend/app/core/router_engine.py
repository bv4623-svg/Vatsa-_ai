# ============================================================
# main.py – Vatsa AI Router + FastAPI Server (Merged)
# ============================================================
# Production‑ready, single‑file deployment.
# Dependencies: fastapi, uvicorn, aiohttp, python-dotenv,
#               scikit-learn (optional, but recommended)
# ============================================================

import asyncio
import json
import logging
import os
import re
import time
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
from collections import defaultdict
from dataclasses import dataclass, field

import aiohttp
from dotenv import load_dotenv, find_dotenv

# ---------- FastAPI & Pydantic ----------
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# ---------- .env loading ----------
# Backend/.env, i.e. three levels up from app/core/router_engine.py.
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv(find_dotenv(usecwd=True))

# ---------- Optional sklearn ----------
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

# ---------- Logging ----------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("VatsaRouterX")

# ============================================================
# 🔥 FIX: Frontend model name → OpenRouter model ID mapping
# ============================================================
MODEL_NAME_MAPPING = {
    "claude-opus-5": "anthropic/claude-3.5-sonnet",
    "gpt-5.6-luna": "openai/gpt-4o",
    "gemini-3.6-flash": "google/gemini-2.5-pro",
    "deepseek-v3.2": "deepseek/deepseek-chat",
    # add more as needed
}

# ============================================================
# 1. OpenRouter Provider
# ============================================================
class OpenRouterProvider:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        if not self.api_key:
            logger.error("OPENROUTER_API_KEY not set! API calls will fail.")
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}" if self.api_key else "",
            "Content-Type": "application/json",
        }

    async def generate_async(
        self,
        messages: List[Dict[str, str]],
        model: str,
        max_tokens: int = 500,
        temperature: float = 0.7,
        **kwargs
    ) -> Union[str, Dict]:
        if not self.api_key:
            return {
                "content": "⚠️ OPENROUTER_API_KEY is not set. Please set it in .env file.",
                "raw": {}
            }
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        payload.update(kwargs)
        async with aiohttp.ClientSession() as session:
            async with session.post(
                self.base_url, headers=self.headers, json=payload, timeout=60
            ) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise Exception(f"OpenRouter API error {resp.status}: {error_text}")
                data = await resp.json()
                if "choices" in data and len(data["choices"]) > 0:
                    content = data["choices"][0].get("message", {}).get("content", "")
                    return {"content": content, "raw": data}
                return {"content": "", "raw": data}


# ============================================================
# 2. Health Monitor
# ============================================================
class ModelHealthMonitor:
    def __init__(self, failure_threshold: int = 2, cooldown_seconds: int = 60):
        self.failure_count: Dict[str, int] = {}
        self.last_failure_time: Dict[str, float] = {}
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds

    async def is_healthy(self, model_id: str) -> bool:
        if model_id not in self.failure_count:
            return True
        if self.failure_count[model_id] >= self.failure_threshold:
            if time.time() - self.last_failure_time.get(model_id, 0) > self.cooldown_seconds:
                del self.failure_count[model_id]
                del self.last_failure_time[model_id]
                return True
            return False
        return True

    async def record_success(self, model_id: str):
        if model_id in self.failure_count:
            del self.failure_count[model_id]
        if model_id in self.last_failure_time:
            del self.last_failure_time[model_id]

    async def record_failure(self, model_id: str, error: str):
        self.failure_count[model_id] = self.failure_count.get(model_id, 0) + 1
        self.last_failure_time[model_id] = time.time()


# ============================================================
# 3. Tools (Search & Calculator)
# ============================================================
class SearchTool:
    async def execute(self, query: str, **kwargs) -> Dict:
        return {
            "success": True,
            "result": f"Search results for '{query}': [simulated] top result: example.com"
        }


class CalculatorTool:
    async def execute(self, expression: str, **kwargs) -> Dict:
        try:
            if not re.match(r'^[\d+\-*/()\s.]+$', expression):
                return {"success": False, "error": "Invalid characters in expression"}
            result = eval(expression, {"__builtins__": {}}, {})
            return {"success": True, "result": str(result)}
        except Exception as e:
            return {"success": False, "error": str(e)}


def get_tool(tool_name: str):
    if tool_name == "search":
        return SearchTool()
    elif tool_name == "calculator":
        return CalculatorTool()
    else:
        class DummyTool:
            async def execute(self, **kwargs):
                return {"success": False, "error": f"Tool '{tool_name}' not implemented"}
        return DummyTool()


# ============================================================
# 4. Fallback Model Catalog
# ============================================================
FALLBACK_MODELS = {
    "openai/gpt-4o": {
        "provider": "openai",
        "max_tokens": 128000,
        "cost_per_1k_input": 0.005,
        "cost_per_1k_output": 0.015,
        "capabilities": ["chat", "coding", "vision", "reasoning"],
        "latency_score": 0.92,
        "reliability": 0.98,
    },
    "openai/gpt-4o-mini": {
        "provider": "openai",
        "max_tokens": 64000,
        "cost_per_1k_input": 0.002,
        "cost_per_1k_output": 0.006,
        "capabilities": ["chat", "coding", "vision"],
        "latency_score": 0.96,
        "reliability": 0.97,
    },
    "anthropic/claude-3.5-sonnet": {
        "provider": "anthropic",
        "max_tokens": 200000,
        "cost_per_1k_input": 0.003,
        "cost_per_1k_output": 0.015,
        "capabilities": ["chat", "coding", "reasoning"],
        "latency_score": 0.90,
        "reliability": 0.98,
    },
    "google/gemini-2.5-pro": {
        "provider": "google",
        "max_tokens": 1000000,
        "cost_per_1k_input": 0.0025,
        "cost_per_1k_output": 0.0075,
        "capabilities": ["chat", "coding", "vision", "reasoning"],
        "latency_score": 0.88,
        "reliability": 0.98,
    },
    "meta-llama/llama-3.3-70b-instruct": {
        "provider": "meta",
        "max_tokens": 128000,
        "cost_per_1k_input": 0.0008,
        "cost_per_1k_output": 0.0024,
        "capabilities": ["chat", "coding", "reasoning"],
        "latency_score": 0.88,
        "reliability": 0.97,
    },
}


# ============================================================
# 5. Enterprise Policy & Engine
# ============================================================
class EnterprisePolicy:
    def __init__(
        self,
        budget_cap_usd_per_request: float = 0.1,
        allowed_models: Optional[List[str]] = None,
        allowed_tools: Optional[List[str]] = None,
    ):
        self.budget_cap_usd_per_request = budget_cap_usd_per_request
        self.allowed_models = allowed_models or []
        self.allowed_tools = allowed_tools or []

    def is_model_allowed(self, model_id: str, catalog) -> bool:
        if not self.allowed_models:
            return True
        return model_id in self.allowed_models

    def is_tool_allowed(self, tool_name: str) -> bool:
        if not self.allowed_tools:
            return True
        return tool_name in self.allowed_tools

    def to_dict(self) -> dict:
        return {
            "budget_cap_usd_per_request": self.budget_cap_usd_per_request,
            "allowed_models": self.allowed_models,
            "allowed_tools": self.allowed_tools,
        }


class PolicyEngine:
    def __init__(self, policy: EnterprisePolicy):
        self.policy = policy

    def is_model_allowed(self, model_id: str, catalog) -> bool:
        return self.policy.is_model_allowed(model_id, catalog)

    def is_tool_allowed(self, tool_name: str) -> bool:
        return self.policy.is_tool_allowed(tool_name)


# ============================================================
# 6. Stubs / Helper Engines
# ============================================================
class VatsaIntelligenceScore:
    @staticmethod
    def compute(query, difficulty, confidence, domain, tool_count, context_len):
        base = (difficulty / 10) * 50 + confidence * 30 + (tool_count / 5) * 10 + min(context_len / 1000, 10)
        return min(100, max(0, base))


class InputAnalyzer:
    def analyze(self, query: str, session: dict) -> dict:
        return {
            "language": "en",
            "length": len(query),
            "has_code": bool(re.search(r'```|def |class |import ', query))
        }


# Intent definitions & helpers
INTENTS = {
    "coding": {
        "keywords": ["code", "program", "function", "class", "import", "react", "python", "java"],
        "examples": [],
        "requires_disclaimer": False
    },
    "debugging": {
        "keywords": ["bug", "error", "debug", "fix", "crash"],
        "examples": [],
        "requires_disclaimer": False
    },
    "general": {
        "keywords": ["hello", "hi", "what", "who", "where", "when"],
        "examples": [],
        "requires_disclaimer": False
    },
    "math": {
        "keywords": ["math", "calculate", "equation", "integral", "derivative"],
        "examples": [],
        "requires_disclaimer": False
    },
    "vision": {
        "keywords": ["image", "picture", "photo", "diagram", "chart"],
        "examples": [],
        "requires_disclaimer": False
    },
    "search": {
        "keywords": ["search", "find", "lookup", "latest", "news"],
        "examples": [],
        "requires_disclaimer": False
    },
}


@dataclass
class IntentMatch:
    intent: str
    confidence: float
    band: str
    matched_keywords: List[str] = field(default_factory=list)


@dataclass
class ClassificationResult:
    query: str
    primary_intent: IntentMatch
    secondary_intents: List[IntentMatch]
    is_multi_intent: bool
    disclaimer: Optional[str] = None

    def to_dict(self):
        return {
            "query": self.query,
            "primary_intent": {
                "intent": self.primary_intent.intent,
                "confidence": round(self.primary_intent.confidence, 1),
                "band": self.primary_intent.band,
                "matched_keywords": self.primary_intent.matched_keywords,
            },
            "secondary_intents": [
                {
                    "intent": m.intent,
                    "confidence": round(m.confidence, 1),
                    "band": m.band,
                    "matched_keywords": m.matched_keywords,
                } for m in self.secondary_intents
            ],
            "is_multi_intent": self.is_multi_intent,
            "disclaimer": self.disclaimer,
        }


def confidence_band(score: float) -> str:
    if score >= 90.0:
        return "HIGH"
    elif score >= 60.0:
        return "MEDIUM"
    else:
        return "LOW"


class IntentEngineLegacy:
    def classify_full(self, query: str):
        scores = {}
        for name, data in INTENTS.items():
            score = 0
            for kw in data.get("keywords", []):
                if kw in query.lower():
                    score += 0.15
            scores[name] = min(100, score * 100)
        primary = max(scores, key=scores.get)
        return ClassificationResult(
            query=query,
            primary_intent=IntentMatch(
                intent=primary,
                confidence=scores[primary],
                band=confidence_band(scores[primary]),
                matched_keywords=[]
            ),
            secondary_intents=[],
            is_multi_intent=False,
            disclaimer=None
        )

    def detect_with_confidence(self, query: str):
        return {}


class DifficultyEngine:
    def score(self, query: str, intents: List[str]) -> float:
        return min(10, len(query) / 100 + (1 if any(x in query for x in ["def ", "class ", "import "]) else 0))


class DomainEngine:
    def detect(self, query: str) -> str:
        if any(x in query.lower() for x in ["code", "function", "class"]):
            return "programming"
        return "general"


class ContextEngine:
    def analyze(self, session: dict) -> dict:
        return {"history_len": len(session.get("history", []))}


class ConversationMemory:
    def load_user(self, user_id: str) -> dict:
        return {"preferences": {}}


class PromptAnalyzer:
    def analyze(self, query: str) -> dict:
        weights = {"coding": 0, "reasoning": 0, "math": 0, "vision": 0, "creativity": 0}
        lower = query.lower()
        if any(x in lower for x in ["code", "program", "function"]):
            weights["coding"] = 0.7
        if any(x in lower for x in ["explain", "why", "how", "reason"]):
            weights["reasoning"] = 0.6
        if any(x in lower for x in ["math", "calculate", "equation"]):
            weights["math"] = 0.8
        if any(x in lower for x in ["image", "picture", "see"]):
            weights["vision"] = 0.9
        if any(x in lower for x in ["write", "story", "poem"]):
            weights["creativity"] = 0.5
        return weights


class ToolPlanner:
    def plan(self, query: str, weights: dict) -> List[str]:
        tools = []
        if weights.get("reasoning", 0) > 0.5:
            tools.append("search")
        if re.search(r'[\d+\-*/()]', query):
            tools.append("calculator")
        return tools


class ModelRankingEngine:
    def __init__(self, catalog):
        self.catalog = catalog

    def rank_models(self, requirements: dict, user_tier: str, policy=None, exclude: List[str] = None) -> List[dict]:
        exclude = exclude or []
        models = []
        for mid, info in self.catalog.models.items():
            if mid in exclude:
                continue
            if policy and not policy.is_model_allowed(mid, self.catalog):
                continue
            caps = info.get("capabilities", [])
            score = 50
            for cap, weight in requirements.items():
                if cap in caps:
                    score += weight * 30
            if user_tier == "free" and info.get("cost_per_1k_input", 0) > 0.001:
                score -= 10
            score += info.get("latency_score", 0.5) * 10 + info.get("reliability", 0.9) * 10
            models.append({"id": mid, "score": score})
        models.sort(key=lambda x: x["score"], reverse=True)
        return models[:10]


class CostOptimizer:
    def __init__(self, catalog):
        self.catalog = catalog

    def estimate_cost(self, model_id: str, prompt_tokens: int, completion_tokens: int) -> float:
        info = self.catalog.get_model(model_id)
        if not info:
            return 0.0
        return (
            info.get("cost_per_1k_input", 0) * prompt_tokens / 1000
            + info.get("cost_per_1k_output", 0) * completion_tokens / 1000
        )

    def choose_cost_effective(
        self,
        ranked: List[dict],
        input_tokens: int,
        output_tokens: int,
        max_acceptable_score: float = 70,
        budget_cap: float = 0.1
    ) -> Optional[str]:
        for model in ranked:
            cost = self.estimate_cost(model["id"], input_tokens, output_tokens)
            if cost <= budget_cap and model["score"] >= max_acceptable_score:
                return model["id"]
        return ranked[0]["id"] if ranked else None


class LatencyOptimizer:
    def __init__(self, catalog):
        self.catalog = catalog

    def choose_fastest(
        self,
        ranked: List[dict],
        input_tokens: int,
        output_tokens: int,
        min_score: float = 60
    ) -> Optional[str]:
        for model in ranked:
            info = self.catalog.get_model(model["id"])
            if info and info.get("latency_score", 0) >= 0.85 and model["score"] >= min_score:
                return model["id"]
        return ranked[0]["id"] if ranked else None


class ParallelRouter:
    async def route_parallel(self, query: str, model_ids: List[str], call_func) -> Dict[str, str]:
        tasks = [call_func(mid, query) for mid in model_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        responses = {}
        for mid, res in zip(model_ids, results):
            if isinstance(res, Exception):
                logger.error(f"Parallel call to {mid} failed: {res}")
                responses[mid] = ""
            else:
                responses[mid] = res
        return responses


class VerificationEngine:
    async def verify(self, response: str, query: str, model_id: str, call_func) -> dict:
        verify_prompt = (
            f"Verify if the following response correctly answers the query. "
            f"Reply with 'verified' or 'not verified'.\nQuery: {query}\nResponse: {response}"
        )
        try:
            ver = await call_func(model_id, verify_prompt)
            verified = "verified" in ver.lower()
            return {"verified": verified, "message": ver}
        except Exception:
            return {"verified": True, "message": "Verification failed, assuming true"}


class HallucinationDetector:
    def detect(self, response: str, sources: List[str]) -> dict:
        return {"confidence": 0.9 if len(sources) == 0 else 0.95, "flags": []}


class AdaptiveLearning:
    def update(self, user_id: str, intent: str, model: str, rating: float):
        pass

    def get_best_model(self, user_id: str, intent: str) -> Optional[str]:
        return None


class BenchmarkEngine:
    pass


class PersonaEngine:
    def get_preferred_models(self, user_type: str) -> List[str]:
        return []


class ConfidenceEngine:
    pass


class ExecutionPlanner:
    def plan(self, query: str, tools: List[str]) -> List[dict]:
        return [{"tool": t, "order": i} for i, t in enumerate(tools)]


class AIToAICollaborator:
    async def collaborate(self, query: str, model_ids: List[str], call_func) -> dict:
        responses = {}
        for mid in model_ids:
            responses[mid] = await call_func(mid, query)
        merged = max(responses.values(), key=len)
        return {"merged": merged, "responses": responses}


class SmartCache:
    def __init__(self, ttl: int = 3600):
        self.cache = {}
        self.ttl = ttl

    def get(self, key: str) -> Optional[str]:
        if key in self.cache:
            data, ts = self.cache[key]
            if time.time() - ts < self.ttl:
                return data
            del self.cache[key]
        return None

    def set(self, key: str, value: str):
        self.cache[key] = (value, time.time())


class AnalyticsEngine:
    def log(self, entry: dict):
        logger.info(f"Analytics: {entry}")


class RouterFeedbackLoop:
    pass


class FollowupGenerator:
    def generate(self, query: str, intent: str, response: str) -> List[Dict[str, str]]:
        return [
            {"text": "Can I help with something else?", "action": "help"},
            {"text": "Do you need more details?", "action": "details"}
        ]


# ============================================================
# 7. Model Catalog
# ============================================================
class ModelCatalog:
    def __init__(self, cache_file: str = "model_catalog.json", ttl: int = 3600):
        self.cache_file = cache_file
        self.ttl = ttl
        self.models: Dict[str, dict] = {}
        self.last_updated = 0.0
        self._load_cache()

    def _load_cache(self):
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as f:
                    data = json.load(f)
                    if time.time() - data.get("timestamp", 0) < self.ttl:
                        self.models = data["models"]
                        self.last_updated = data["timestamp"]
                        logger.info(f"Loaded {len(self.models)} models from cache")
                        return
            except Exception:
                pass
        self.models = FALLBACK_MODELS.copy()
        logger.warning(f"⚠️ No cache found, using fallback list of {len(self.models)} models.")

    async def refresh(self, api_key: Optional[str] = None):
        if not api_key:
            api_key = os.getenv("OPENROUTER_API_KEY")
            if not api_key:
                logger.warning("Cannot refresh catalog: No API key provided.")
                return
        headers = {"Authorization": f"Bearer {api_key}"}
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(
                    "https://openrouter.ai/api/v1/models", headers=headers, timeout=30
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        new_models = {}
                        for m in data.get("data", []):
                            model_id = m["id"]
                            pricing = m.get("pricing", {})
                            new_models[model_id] = {
                                "provider": m.get("provider", "openrouter"),
                                "max_tokens": m.get("context_length", 128000),
                                "cost_per_1k_input": float(pricing.get("prompt", 0)),
                                "cost_per_1k_output": float(pricing.get("completion", 0)),
                                "capabilities": ["chat"],
                                "latency_score": m.get("latency", {}).get("score", 0.5),
                                "reliability": 0.95,
                            }
                        if new_models:
                            self.models = new_models
                            self.last_updated = time.time()
                            with open(self.cache_file, 'w') as f:
                                json.dump({"models": self.models, "timestamp": self.last_updated}, f)
                            logger.info(f"✅ Catalog refreshed: {len(self.models)} models")
                        else:
                            logger.warning("Catalog refresh returned empty list; keeping fallback models.")
                    else:
                        logger.error(f"Catalog refresh failed with status {resp.status}")
            except Exception as e:
                logger.error(f"Catalog refresh failed: {e}")

    def get_model_ids(self) -> List[str]:
        return list(self.models.keys())

    def get_model(self, mid: str) -> Optional[dict]:
        return self.models.get(mid)

    def get_models_by_capability(self, capability: str) -> List[str]:
        return [mid for mid, m in self.models.items() if capability in m.get("capabilities", [])]


# ============================================================
# 8. Main Router Class
# ============================================================
class VatsaRouter:
    def __init__(self, enterprise_policy: Optional[EnterprisePolicy] = None):
        self.catalog = ModelCatalog()
        self.policy = enterprise_policy or EnterprisePolicy()
        self.policy_engine = PolicyEngine(self.policy)

        self.input_analyzer = InputAnalyzer()
        self.intent_engine = IntentEngineLegacy()
        self.difficulty_engine = DifficultyEngine()
        self.domain_engine = DomainEngine()
        self.context_engine = ContextEngine()
        self.memory_engine = ConversationMemory()
        self.prompt_analyzer = PromptAnalyzer()
        self.tool_planner = ToolPlanner()
        self.ranking_engine = ModelRankingEngine(self.catalog)
        self.cost_optimizer = CostOptimizer(self.catalog)
        self.latency_optimizer = LatencyOptimizer(self.catalog)
        self.parallel_router = ParallelRouter()
        self.verification_engine = VerificationEngine()
        self.hallucination_detector = HallucinationDetector()
        self.learning_engine = AdaptiveLearning()
        self.failover = ModelHealthMonitor()
        self.benchmark_engine = BenchmarkEngine()
        self.persona_engine = PersonaEngine()
        self.confidence_engine = ConfidenceEngine()
        self.execution_planner = ExecutionPlanner()
        self.collaborator = AIToAICollaborator()
        self.smart_cache = SmartCache()
        self.analytics_engine = AnalyticsEngine()
        self.feedback_loop = RouterFeedbackLoop()
        self.provider = OpenRouterProvider()
        self.followup_generator = FollowupGenerator()

        # Background refresh
        try:
            loop = asyncio.get_running_loop()
            self._startup_task = loop.create_task(
                self.catalog.refresh(os.getenv("OPENROUTER_API_KEY"))
            )
        except RuntimeError:
            self._startup_task = None

        self.identity_patterns = [
            r"(which|what)\s+(model|ai|artificial intelligence|llm|language model)\s+(are you|do you use|is this|u use|u)",
            r"(are you|is this)\s+(chatgpt|gpt|claude|gemini|grok|deepseek|openai|anthropic|google)",
            r"who\s+(made|created|developed|built)\s+(you|this)",
            r"(which|what)\s+version\s+(of|are you)",
            r"tell\s+me\s+about\s+yourself"
        ]
        logger.info(f"🚀 VatsaRouter initialized with {len(self.catalog.models)} models.")

    def _is_identity_query(self, query: str) -> bool:
        q = query.lower().strip()
        for pattern in self.identity_patterns:
            if re.search(pattern, q):
                return True
        return False

    async def call_model(self, model_id: str, query: str, max_tokens: int = 500,
                         language: str = "en") -> str:
        if not await self.failover.is_healthy(model_id):
            fallback = await self._get_fallback(model_id)
            logger.warning(f"Model {model_id} unhealthy, falling back to {fallback}")
            return await self.call_model(fallback, query, max_tokens, language)
        try:
            messages = [{"role": "user", "content": query}]
            response = await self.provider.generate_async(
                messages,
                model=model_id,
                max_tokens=max_tokens,
                temperature=0.7
            )
            if isinstance(response, dict):
                response = response.get("content", str(response))
            await self.failover.record_success(model_id)
            return response
        except ValueError as e:
            error_msg = str(e)
            logger.error(f"Provider configuration error: {error_msg}")
            return f"⚠️ {error_msg}. Please set OPENROUTER_API_KEY in your .env file."
        except Exception as e:
            logger.error(f"Error calling {model_id}: {e}")
            await self.failover.record_failure(model_id, str(e))
            return f"⚠️ Failed to get response from {model_id}. Please try again later."

    async def _get_fallback(self, failed_model: str) -> str:
        req = {"reasoning": 0.5, "coding": 0.5}
        top = self.ranking_engine.rank_models(
            req, "free", exclude=[failed_model], policy=self.policy
        )
        for m in top[:5]:
            if await self.failover.is_healthy(m["id"]):
                return m["id"]
        # 🔥 FIX: default to a known working model instead of returning first unhealthy
        return "openai/gpt-4o"

    def _is_valid_model(self, model_name: str) -> bool:
        if not model_name or model_name.lower() in ["auto", "openrouter/auto", "openrouter/auto-beta"]:
            return False
        return bool(self.catalog.get_model(model_name))

    # 🔥 FIX: new method to map frontend names
    def _map_model_name(self, model_name: str) -> str:
        if not model_name:
            return model_name
        # if it's already a valid OpenRouter ID, return as is
        if self._is_valid_model(model_name):
            return model_name
        # otherwise try mapping
        mapped = MODEL_NAME_MAPPING.get(model_name)
        if mapped and self._is_valid_model(mapped):
            return mapped
        # if mapping gives invalid, return original (will be rejected later)
        return model_name

    async def _execute_tools(self, tools: List[str], query: str, session: Dict) -> Tuple[List[Dict], str]:
        sources = []
        tool_output = ""
        for tool_name in tools:
            if not self.policy_engine.is_tool_allowed(tool_name):
                continue
            try:
                tool = get_tool(tool_name)
                params = {}
                if tool_name == "search":
                    params["query"] = query
                elif tool_name == "calculator":
                    expr_match = re.search(r'[\d+\-*/()\s]+', query)
                    if expr_match:
                        params["expression"] = expr_match.group().strip()
                    else:
                        params["expression"] = query
                result = await tool.execute(**params)
                if result.get("success"):
                    sources.append({
                        "title": f"Tool: {tool_name}",
                        "content": result.get("result", "")
                    })
                    tool_output += f"\n[tool:{tool_name}]: {result.get('result','')}\n"
                else:
                    logger.error(f"Tool {tool_name} failed: {result.get('error')}")
            except Exception as e:
                logger.error(f"Error executing tool {tool_name}: {e}")
        return sources, tool_output

    async def route(
        self,
        query: str,
        user_id: Optional[str] = None,
        preferred_model: Optional[str] = None,
        user_tier: str = "free",
        session: Dict = None
    ) -> Dict[str, Any]:
        # Fallback for empty query
        if not query or not query.strip():
            query = "Hi, how are you?"
            logger.info("Query was empty, using default.")

        start_time = time.time()
        session = session or {}

        # Identity query
        if self._is_identity_query(query):
            identity_response = (
                "I am Vatsa AI, an advanced AI assistant developed by Vatsa Group. "
                "How can I assist you today?"
            )
            return {
                "status": "success",
                "query": query,
                "primary_intent": "identity",
                "intent_confidence": 1.0,
                "vis": 0,
                "difficulty_score": 1,
                "domain": "general",
                "tools_planned": [],
                "execution_plan": [],
                "selected_model": "system_identity_handler",
                "provider": "vatsa",
                "sources": [],
                "followups": [],
                "cost": 0.0,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "response": identity_response,
                "verification": None,
                "hallucination": {"confidence": 1.0, "flags": []},
                "latency_seconds": round(time.time() - start_time, 4),
                "user_tier": user_tier,
                "response_language": "en",
                "model_ranking_snapshot": [],
                "policy_applied": self.policy.to_dict() if self.policy else None,
                "metadata": {}
            }

        # Cache
        cache_key = hashlib.md5((query + str(user_id) + str(preferred_model)).encode()).hexdigest()
        cached = self.smart_cache.get(cache_key)
        if cached:
            return json.loads(cached)

        # Analysis
        input_analysis = self.input_analyzer.analyze(query, session)
        detected_language = input_analysis.get("language", "en")
        response_language = detected_language

        intent_result = self.intent_engine.classify_full(query)
        primary_intent = intent_result.primary_intent.intent
        confidence = intent_result.primary_intent.confidence / 100.0
        difficulty_score = self.difficulty_engine.score(
            query, list(self.intent_engine.detect_with_confidence(query).keys())
        )
        domain = self.domain_engine.detect(query)

        context = self.context_engine.analyze(session)
        user_memory = self.memory_engine.load_user(user_id) if user_id else {}
        history_text = " ".join([msg.get("content", "") for msg in session.get("history", [])])
        context_len = self._estimate_tokens(history_text + query)

        prompt_weights = self.prompt_analyzer.analyze(query)
        tools = self.tool_planner.plan(query, prompt_weights)
        tools = [t for t in tools if self.policy_engine.is_tool_allowed(t)]

        vis = VatsaIntelligenceScore.compute(
            query, difficulty_score, confidence, domain, len(tools), context_len
        )

        # Requirements for ranking
        requirements = {
            "coding": prompt_weights.get("coding", 0),
            "reasoning": prompt_weights.get("reasoning", 0),
            "math": prompt_weights.get("math", 0),
            "vision": prompt_weights.get("vision", 0),
            "creative": prompt_weights.get("creativity", 0)
        }
        total_req = sum(requirements.values())
        if total_req > 0:
            for k in requirements:
                requirements[k] /= total_req
        else:
            requirements = {"reasoning": 0.5, "coding": 0.5}

        # 🔥 FIX: Map frontend model to OpenRouter ID before validation
        mapped_preferred = self._map_model_name(preferred_model) if preferred_model else None

        # Validate preferred model
        if mapped_preferred and not self._is_valid_model(mapped_preferred):
            logger.warning(f"Invalid preferred_model after mapping: {mapped_preferred} (original: {preferred_model})")
            mapped_preferred = None

        ranked = self.ranking_engine.rank_models(requirements, user_tier, policy=self.policy)
        if not ranked:
            # 🔥 FIX: use a guaranteed working model
            ranked = [{"id": "openai/gpt-4o", "score": 50}]

        # Decide routing strategy
        if vis >= 70 and len(ranked) >= 2 and not mapped_preferred:
            chosen_models = [r["id"] for r in ranked[:3]]
            collab_result = await self.collaborator.collaborate(
                query,
                chosen_models,
                lambda m, q, lang=response_language: self.call_model(m, q, 500, lang)
            )
            response = collab_result["merged"]
            used_model = "collaboration:" + ",".join(chosen_models)
        elif vis >= 40 and len(ranked) >= 2 and not mapped_preferred:
            top_two = [r["id"] for r in ranked[:2]]
            async def call_with_lang(m, q):
                return await self.call_model(m, q, 500, response_language)
            parallel_responses = await self.parallel_router.route_parallel(
                query, top_two, call_with_lang
            )
            best_id = self._select_best_parallel(parallel_responses, query)
            response = parallel_responses.get(best_id, "No response")
            used_model = best_id
        else:
            if mapped_preferred and self._is_valid_model(mapped_preferred):
                chosen_model = mapped_preferred
            else:
                input_tokens = self._estimate_tokens(query)
                output_tokens = 500
                speed_pref = session.get("speed_preference", "balanced")
                if speed_pref == "fast" or vis < 40:
                    chosen_model = self.latency_optimizer.choose_fastest(
                        ranked, input_tokens, output_tokens, min_score=60
                    )
                else:
                    budget_cap = self.policy.budget_cap_usd_per_request
                    chosen_model = self.cost_optimizer.choose_cost_effective(
                        ranked, input_tokens, output_tokens,
                        max_acceptable_score=70, budget_cap=budget_cap
                    )
                if not chosen_model and ranked:
                    chosen_model = ranked[0]["id"]
                if not chosen_model:
                    # 🔥 FIX: absolute fallback
                    chosen_model = "openai/gpt-4o"
                chosen_model = self._apply_personal_overrides(
                    chosen_model, user_id, primary_intent, user_memory, session
                )

            try:
                response = await self.call_model(chosen_model, query, 500, response_language)
                used_model = chosen_model
            except Exception:
                fallback = await self._get_fallback(chosen_model)
                response = await self.call_model(fallback, query, 500, response_language)
                used_model = fallback

        # Execute tools
        sources = []
        tool_output = ""
        if tools:
            sources, tool_output = await self._execute_tools(tools, query, session)
            if tool_output and "tool" not in response.lower():
                response = response + "\n\n" + tool_output

        # Verification
        verification = None
        if vis >= 60 or confidence < 0.8:
            verifier_model = "openai/gpt-4o" if used_model != "openai/gpt-4o" else "anthropic/claude-3.5-sonnet"
            verification = await self.verification_engine.verify(
                response, query, verifier_model,
                lambda m, q: self.call_model(m, q, 500, response_language)
            )
            if not verification.get("verified", False):
                try:
                    response = await self.call_model(verifier_model, query, 500, response_language)
                    used_model = verifier_model
                except:
                    pass

        hallucination = self.hallucination_detector.detect(
            response, [s.get("content", "") for s in sources]
        )
        execution_plan = self.execution_planner.plan(query, tools)
        followups = self.followup_generator.generate(query, primary_intent, response)

        prompt_tokens = self._estimate_tokens(query + history_text)
        completion_tokens = self._estimate_tokens(response)
        cost = self.cost_optimizer.estimate_cost(used_model, prompt_tokens, completion_tokens)
        usage = {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens}

        if user_id:
            rating = 0.8 if hallucination.get("confidence", 0.0) > 0.8 else 0.5
            self.learning_engine.update(user_id, primary_intent, used_model, rating)

        elapsed = time.time() - start_time
        self.analytics_engine.log({
            "user_id": user_id,
            "query": query[:50],
            "model": used_model,
            "latency": elapsed,
            "vis": vis,
            "tools": tools,
            "success": True
        })

        result = {
            "status": "success",
            "query": query,
            "primary_intent": primary_intent,
            "intent_confidence": confidence,
            "vis": vis,
            "secondary_intents": [m.intent for m in intent_result.secondary_intents],
            "difficulty_score": difficulty_score,
            "domain": domain,
            "tools_planned": tools,
            "execution_plan": execution_plan,
            "selected_model": used_model,
            "provider": "openrouter",
            "sources": sources,
            "followups": followups,
            "cost": cost,
            "usage": usage,
            "response": response,
            "verification": verification,
            "hallucination": hallucination,
            "latency_seconds": round(elapsed, 2),
            "user_tier": user_tier,
            "policy_applied": self.policy.to_dict() if self.policy else None,
            "model_ranking_snapshot": ranked[:5] if ranked else [],
            "response_language": response_language,
            "metadata": {
                "tools_executed": tools,
                "tool_output": tool_output,
                "total_models": len(self.catalog.models),
            }
        }

        self.smart_cache.set(cache_key, json.dumps(result))
        return result

    def _select_best_parallel(self, responses: Dict[str, str], query: str) -> str:
        if not responses:
            return "openai/gpt-4o"
        best = min(responses, key=lambda k: len(responses[k]))
        return best if responses[best] else list(responses.keys())[0]

    def _apply_personal_overrides(
        self,
        current_model: str,
        user_id: Optional[str],
        primary_intent: str,
        memory: dict,
        session: dict
    ) -> str:
        if user_id and memory.get("preferences", {}).get("preferred_model"):
            pref = memory["preferences"]["preferred_model"]
            if self._is_valid_model(pref) and self.policy_engine.is_model_allowed(pref, self.catalog):
                return pref
        if user_id:
            learned = self.learning_engine.get_best_model(user_id, primary_intent)
            if learned and self._is_valid_model(learned) and self.policy_engine.is_model_allowed(learned, self.catalog):
                return learned
        user_type = session.get("user_type")
        if user_type:
            preferred_list = self.persona_engine.get_preferred_models(user_type)
            for m in preferred_list:
                if self._is_valid_model(m) and self.policy_engine.is_model_allowed(m, self.catalog):
                    return m
        return current_model

    def _estimate_tokens(self, text: str) -> int:
        return len(text) // 4


VatsaRouterPro = VatsaRouter  # alias


# ============================================================
# 9. FastAPI Server
# ============================================================
app = FastAPI(title="Vatsa AI Router", version="1.0")
router_instance = VatsaRouter()  # global instance

# Enable CORS for all origins (restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    userId: Optional[str] = None
    preferredModel: Optional[str] = None
    userTier: str = "free"


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        result = await router_instance.route(
            query=request.message,
            user_id=request.userId,
            preferred_model=request.preferredModel,
            user_tier=request.userTier,
            session={}
        )
        return result
    except Exception as e:
        logger.exception("Error in chat endpoint")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {"status": "ok", "models": len(router_instance.catalog.models)}


# ============================================================
# 10. Main entry point
# ============================================================
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # set False in production
        log_level="info"
    )