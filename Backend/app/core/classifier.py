"""
IntentClassifier: TF-IDF + keyword matching against the 27-intent catalog
in intents_data.py. Backs the /api/classify, /intents, /health endpoints
in app/main.py.
"""

import re
import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

# --- TF‑IDF ---
# scikit-learn (and its own transitive numpy/scipy) is only actually
# needed once a classification request runs the TF-IDF path -- loading it
# just because this module got imported cost every worker process real
# memory at startup whether or not classification was ever used. Loaded
# lazily on first IntentClassifier() construction instead (see
# _ensure_sklearn_loaded below), cached per-process after that.
HAS_SKLEARN = None
TfidfVectorizer = None
cosine_similarity = None


def _ensure_sklearn_loaded() -> bool:
    global HAS_SKLEARN, TfidfVectorizer, cosine_similarity
    if HAS_SKLEARN is None:
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer as _TfidfVectorizer
            from sklearn.metrics.pairwise import cosine_similarity as _cosine_similarity
            TfidfVectorizer = _TfidfVectorizer
            cosine_similarity = _cosine_similarity
            HAS_SKLEARN = True
        except ImportError:
            HAS_SKLEARN = False
    return HAS_SKLEARN

# Import intents data (must exist)
try:
    from intents_data import INTENTS, confidence_band
except ImportError:
    # Fallback definitions if file missing
    INTENTS = {
        "general": {
            "keywords": ["hello", "hi", "what", "how", "who", "where", "when", "why"],
            "examples": ["What is AI?", "Hello world"],
            "requires_disclaimer": False
        }
    }
    def confidence_band(score):
        if score >= 90: return "HIGH"
        elif score >= 60: return "MEDIUM"
        return "LOW"

# ============================================================
# CONSTANTS & CONFIGURATIONS
# ============================================================
SECONDARY_INTENT_FLOOR = 25.0
KEYWORD_WEIGHT = 0.55
SIMILARITY_WEIGHT = 0.45


# ============================================================
# INTENT CLASSIFIER
# ============================================================
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
                }
                for m in self.secondary_intents
            ],
            "is_multi_intent": self.is_multi_intent,
            "disclaimer": self.disclaimer,
        }


class IntentClassifier:
    def __init__(self, intents: dict = INTENTS):
        self.intents = intents
        self.intent_names = list(intents.keys())

        self._example_texts: List[str] = []
        self._example_intent_index: List[str] = []
        for name, data in intents.items():
            for ex in data.get("examples", []):
                self._example_texts.append(ex)
                self._example_intent_index.append(name)

        if _ensure_sklearn_loaded() and self._example_texts:
            self._vectorizer = TfidfVectorizer(lowercase=True, stop_words="english")
            self._example_matrix = self._vectorizer.fit_transform(self._example_texts)
        else:
            self._vectorizer = None
            self._example_matrix = None

    def _keyword_score(self, query_lower: str, keywords: List[str]) -> Tuple[float, List[str]]:
        matched = []
        for kw in keywords:
            pattern = r"(?<!\w)" + re.escape(kw.lower()) + r"(?!\w)"
            if re.search(pattern, query_lower):
                matched.append(kw)
        if not keywords or not matched:
            return 0.0, matched
        raw = min(1.0, len(matched) * 0.3)
        return raw * 100, matched

    def _similarity_scores(self, query: str) -> dict:
        if self._vectorizer is None or self._example_matrix is None:
            return {name: 0.0 for name in self.intent_names}
        query_vec = self._vectorizer.transform([query])
        sims = cosine_similarity(query_vec, self._example_matrix)[0]
        best = {name: 0.0 for name in self.intent_names}
        for sim, intent_name in zip(sims, self._example_intent_index):
            if sim > best[intent_name]:
                best[intent_name] = sim
        return {name: score * 100 for name, score in best.items()}

    def classify(self, query: str, top_k: int = 5) -> ClassificationResult:
        query_lower = query.lower().strip()
        similarity_scores = self._similarity_scores(query)

        matches: List[IntentMatch] = []
        for name, data in self.intents.items():
            kw_score, matched_kw = self._keyword_score(query_lower, data.get("keywords", []))
            sim_score = similarity_scores.get(name, 0.0)
            combined = KEYWORD_WEIGHT * kw_score + SIMILARITY_WEIGHT * sim_score
            combined = max(0.0, min(100.0, combined))
            matches.append(
                IntentMatch(
                    intent=name,
                    confidence=combined,
                    band=confidence_band(combined),
                    matched_keywords=matched_kw,
                )
            )

        matches.sort(key=lambda m: m.confidence, reverse=True)

        primary = matches[0]
        secondary = [
            m for m in matches[1:top_k]
            if m.confidence >= SECONDARY_INTENT_FLOOR
        ]

        disclaimer = self.intents.get(primary.intent, {}).get("requires_disclaimer")
        if primary.band != "HIGH":
            disclaimer = None

        return ClassificationResult(
            query=query,
            primary_intent=primary,
            secondary_intents=secondary,
            is_multi_intent=len(secondary) > 0,
            disclaimer=disclaimer,
        )

