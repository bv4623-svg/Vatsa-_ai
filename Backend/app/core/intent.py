# app/intent/classifier.py

import re
import time
import logging
from typing import Dict, List, Tuple, Optional, Any
from functools import lru_cache
from threading import Lock

import numpy as np

from app.config.settings import settings
from app.cache.router_cache import router_cache  # our advanced cache

logger = logging.getLogger(__name__)

# Optional ONNX runtime
try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False


class BaseIntentClassifier:
    """Abstract base for intent classifiers."""
    
    def classify(self, prompt: str) -> Tuple[str, float]:
        """Return (intent, confidence)."""
        raise NotImplementedError


class RuleBasedIntentClassifier(BaseIntentClassifier):
    """
    Fast regex‑based classifier using compiled patterns.
    Thread‑safe.
    """
    
    def __init__(self, rules: Dict[str, List[str]]):
        self.rules = {}
        self._lock = Lock()
        self._compile_rules(rules)
    
    def _compile_rules(self, rules: Dict[str, List[str]]) -> None:
        """Compile regex patterns for speed."""
        compiled = {}
        for intent, patterns in rules.items():
            # Combine patterns into a single regex (OR) for faster matching
            combined = "|".join(f"({p})" for p in patterns)
            compiled[intent] = re.compile(combined, re.IGNORECASE)
        with self._lock:
            self.rules = compiled
    
    def classify(self, prompt: str) -> Tuple[str, float]:
        """Return (intent, confidence) based on pattern matches."""
        prompt_lower = prompt.lower()
        best_intent = "general"
        best_score = 0.0
        
        with self._lock:
            for intent, pattern in self.rules.items():
                if pattern.search(prompt_lower):
                    # Simple scoring: more matches = higher confidence (optional)
                    matches = len(pattern.findall(prompt_lower))
                    score = min(0.9, 0.5 + 0.1 * matches)  # cap at 0.9
                    if score > best_score:
                        best_score = score
                        best_intent = intent
        
        # If no match, fallback to general with low confidence
        if best_score == 0.0:
            return "general", 0.3
        return best_intent, best_score


class MLIntentClassifier(BaseIntentClassifier):
    """
    ONNX‑based DistilBERT classifier for fallback.
    Lazy‑loads the model on first use.
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.INTENT_ML_MODEL_PATH
        self._session = None
        self._lock = Lock()
        self._labels = []  # e.g., ['math', 'code', ...]
        self._initialized = False
    
    def _initialize(self) -> None:
        """Load ONNX model and label mapping."""
        if not ONNX_AVAILABLE:
            logger.warning("ONNX runtime not installed; ML classifier disabled.")
            return
        if not self.model_path:
            logger.warning("No ONNX model path provided; ML classifier disabled.")
            return
        
        try:
            # Load ONNX session
            self._session = ort.InferenceSession(self.model_path, providers=['CPUExecutionProvider'])
            # Assume model expects input: input_ids, attention_mask
            # Output: logits over intents
            # Labels should be stored alongside model, e.g., in a labels.txt file
            labels_path = self.model_path.replace(".onnx", "_labels.txt")
            if os.path.exists(labels_path):
                with open(labels_path, "r") as f:
                    self._labels = [line.strip() for line in f if line.strip()]
            else:
                # Fallback: use settings intent list
                self._labels = list(settings.INTENT_RULES.keys()) + ["general"]
            self._initialized = True
        except Exception as e:
            logger.error(f"Failed to load ONNX model: {e}")
            self._session = None
    
    def classify(self, prompt: str) -> Tuple[str, float]:
        """Run ML inference if available; else return general with low confidence."""
        if not self._initialized:
            self._initialize()
        if self._session is None or not self._labels:
            return "general", 0.0
        
        try:
            # Tokenize (simplified – actual implementation would use tokenizer)
            # For brevity, we assume a pre‑processed input; in production use HuggingFace tokenizer
            # This is a placeholder – you need a proper tokenizer.
            # We'll assume the model expects raw text and does tokenization internally? Not typical.
            # Usually you'd run a tokenizer separately. Here we'll simulate.
            # In practice, you'd call a tokenizer (e.g., from transformers) that outputs numpy arrays.
            # We'll just raise an error to show proper implementation needed.
            raise NotImplementedError("Tokenization not implemented – integrate with your tokenizer.")
            
            # Placeholder for actual inference:
            # inputs = tokenizer(prompt, return_tensors="np", truncation=True, max_length=128)
            # outputs = self._session.run(None, inputs)
            # logits = outputs[0]
            # probs = softmax(logits)
            # best_idx = np.argmax(probs)
            # confidence = probs[best_idx]
            # intent = self._labels[best_idx] if best_idx < len(self._labels) else "general"
            # return intent, float(confidence)
        except Exception as e:
            logger.error(f"ML inference failed: {e}")
            return "general", 0.0


class IntentClassifier:
    """
    Combined classifier with rule‑based + optional ML fallback.
    Uses caching to speed up repeated prompts.
    """
    
    def __init__(
        self,
        rules: Optional[Dict[str, List[str]]] = None,
        enable_ml: bool = None,
        ml_model_path: Optional[str] = None,
        confidence_threshold: float = None,
    ):
        self.rules_classifier = RuleBasedIntentClassifier(rules or settings.INTENT_RULES)
        self.enable_ml = enable_ml if enable_ml is not None else settings.INTENT_ENABLE_ML
        self.ml_classifier = MLIntentClassifier(ml_model_path) if self.enable_ml else None
        self.threshold = confidence_threshold or settings.INTENT_CONFIDENCE_THRESHOLD
        self._cache = router_cache  # reuse our global cache
        self._stats = {"total": 0, "rule_hits": 0, "ml_fallbacks": 0}
        self._stats_lock = Lock()
    
    def _make_cache_key(self, prompt: str) -> str:
        """Simple key for cache."""
        return f"intent:{hashlib.md5(prompt.encode()).hexdigest()}"
    
    def classify(self, prompt: str, use_cache: bool = True) -> Tuple[str, float]:
        """
        Classify intent with optional caching.
        If cache hit, return cached result.
        Else, run rules; if confidence below threshold and ML enabled, run ML.
        Update cache and stats.
        """
        if use_cache:
            key = self._make_cache_key(prompt)
            cached = self._cache.get(key)
            if cached is not None:
                return cached  # expects (intent, confidence)
        
        # Rules first
        intent, conf = self.rules_classifier.classify(prompt)
        
        # If low confidence and ML is available, try ML
        if conf < self.threshold and self.enable_ml and self.ml_classifier:
            ml_intent, ml_conf = self.ml_classifier.classify(prompt)
            if ml_conf > conf:
                intent, conf = ml_intent, ml_conf
                with self._stats_lock:
                    self._stats["ml_fallbacks"] += 1
            else:
                # If ML not better, keep rule result but cap confidence
                conf = max(conf, 0.4)  # at least 0.4
        else:
            with self._stats_lock:
                self._stats["rule_hits"] += 1
        
        # Ensure confidence within [0,1]
        conf = min(1.0, max(0.0, conf))
        
        # Update total stats
        with self._stats_lock:
            self._stats["total"] += 1
        
        result = (intent, conf)
        if use_cache:
            self._cache.set(key, result, ttl=settings.CACHE_TTL)
        
        return result
    
    def classify_batch(self, prompts: List[str], use_cache: bool = True) -> List[Tuple[str, float]]:
        """Classify multiple prompts (sequential for now)."""
        return [self.classify(p, use_cache) for p in prompts]
    
    def get_stats(self) -> Dict[str, Any]:
        """Return classification statistics."""
        with self._stats_lock:
            stats = self._stats.copy()
        stats["cache_stats"] = self._cache.stats()
        return stats
    
    def update_rules(self, new_rules: Dict[str, List[str]]) -> None:
        """Dynamically update regex rules."""
        self.rules_classifier._compile_rules(new_rules)


# ============================================================================
# Global singleton instance
# ============================================================================

_intent_classifier: Optional[IntentClassifier] = None


def get_intent_classifier() -> IntentClassifier:
    """Lazy singleton with settings."""
    global _intent_classifier
    if _intent_classifier is None:
        _intent_classifier = IntentClassifier(
            rules=settings.INTENT_RULES,
            enable_ml=settings.INTENT_ENABLE_ML,
            ml_model_path=settings.INTENT_ML_MODEL_PATH,
            confidence_threshold=settings.INTENT_CONFIDENCE_THRESHOLD,
        )
    return _intent_classifier


# For backward compatibility with your original usage
FastIntentClassifier = get_intent_classifier  # or just alias