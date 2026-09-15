"""
INTENT CLASSIFIER + QUERY UNDERSTANDING ENGINE
This module now provides both:
- Original IntentClassifier (TF‑IDF + keywords) for backward compatibility.
- QueryUnderstandingEngine: a full pipeline that extracts:
  * Language, intent(s), entities, programming language, framework,
  * capabilities (search, vision, code, etc.), difficulty, planning,
  * tool requirements, safety, risk, dynamic confidence,
  * and outputs a rich metadata dict for the router.
All detection is rule‑based and fast; optional ML can be enabled.

Also contains:
- LanguageDetector
- DifficultyEngine
- DomainEngine
- VatsaIntelligenceScore
"""

import re
import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

# --- TF‑IDF (kept for original classifier) ---
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

# --- Optional extras ---
try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False

try:
    import spacy
    HAS_SPACY = True
    nlp = spacy.load("en_core_web_sm")
except ImportError:
    HAS_SPACY = False
    nlp = None

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

# Language detection patterns (simplified)
LANG_PATTERNS = {
    "hindi": r'[\u0900-\u097F]',
    "hinglish": r'\b(ki|ka|ko|se|mein|hai|ho|hum|tum|aap|kya|kyu|kaise)\b',
    "spanish": r'\b(el|la|los|las|de|que|y|en|por|para|con|sin)\b',
    "japanese": r'[\u3040-\u30FF\u4E00-\u9FFF]',
}

# Programming languages
PROG_LANG_PATTERNS = {
    "python": r'\b(python|py|\.py|pip|conda|flask|django|fastapi|pandas|numpy)\b',
    "javascript": r'\b(javascript|js|\.js|node|npm|react|vue|angular|express)\b',
    "typescript": r'\b(typescript|ts|\.ts|tsx)\b',
    "java": r'\b(java|\.java|spring|maven|gradle|javafx)\b',
    "go": r'\b(go|golang|\.go|goroutine|ginkgo)\b',
    "rust": r'\b(rust|\.rs|cargo|tokio)\b',
    "c++": r'\b(c\+\+|cpp|\.cpp|\.hpp|g\+\+|std::)\b',
    "c": r'\b(c\s+program|\.c|stdio\.h|stdlib\.h)\b',
    "c#": r'\b(c#|\.cs|dotnet|asp\.net)\b',
    "php": r'\b(php|\.php|laravel|wordpress)\b',
    "ruby": r'\b(ruby|\.rb|rails|gem)\b',
    "swift": r'\b(swift|\.swift|xcode|ios)\b',
    "kotlin": r'\b(kotlin|\.kt|android)\b',
}

# Frameworks
FRAMEWORK_PATTERNS = {
    "react": r'\b(react|reactjs|react\.js|jsx)\b',
    "nextjs": r'\b(nextjs|next\.js|nextjs)\b',
    "vue": r'\b(vue|vuejs|\.vue)\b',
    "angular": r'\b(angular|angularjs|ng\s+)\b',
    "fastapi": r'\b(fastapi|fastapi)\b',
    "django": r'\b(django|django)\b',
    "flask": r'\b(flask|flask)\b',
    "express": r'\b(express|expressjs)\b',
    "spring": r'\b(spring|springboot|springframework)\b',
    "laravel": r'\b(laravel|laravel)\b',
    "rails": r'\b(ruby on rails|rails)\b',
    "node": r'\b(node\.js|nodejs|node)\b',
}

# Capability keywords
CAPABILITY_PATTERNS = {
    "search": r'\b(search|find|lookup|retrieve|fetch|latest|news|today|current|recent)\b',
    "vision": r'\b(image|picture|photo|diagram|chart|graph|visual|see|look at)\b',
    "code": r'\b(code|program|function|class|def|import|export|algorithm|snippet)\b',
    "reasoning": r'\b(explain|why|how|reason|logic|deduce|infer|analyze|think)\b',
    "math": r'\b(math|calculus|equation|integral|derivative|matrix|vector|probability)\b',
    "long_context": r'\b(long\s+context|large\s+document|big\s+file|lengthy|extensive)\b',
    "image_generation": r'\b(generate\s+image|create\s+image|draw|paint|design\s+image)\b',
    "voice": r'\b(voice|speech|audio|transcribe|listen)\b',
    "translation": r'\b(translate|translation|interpret|convert\s+to\s+[a-z]+)\b',
}

# Tool detection
TOOL_PATTERNS = {
    "python": r'\b(python|run\s+python|execute\s+python|py)\b',
    "browser": r'\b(browser|open\s+browser|web\s+page|http|url)\b',
    "calculator": r'\b(calculate|compute|math|sum|average|multiply|divide)\b',
    "pdf": r'\b(pdf|\.pdf|extract\s+pdf|read\s+pdf)\b',
    "excel": r'\b(excel|\.xlsx|spreadsheet|sheet|table)\b',
    "terminal": r'\b(terminal|command|shell|bash|cmd|powershell)\b',
    "git": r'\b(git|commit|push|pull|clone|branch|merge)\b',
    "sql": r'\b(sql|database|query|select|insert|update|delete|join)\b',
}

# Goal patterns
GOAL_PATTERNS = {
    "build_project": r'\b(build|create|start|develop|make|construct|project)\b',
    "learn_concept": r'\b(learn|understand|teach|explain|tutorial|guide|how\s+to)\b',
    "debug_problem": r'\b(fix|debug|repair|resolve|issue|bug|error|crash)\b',
    "write_content": r'\b(write|draft|compose|essay|blog|article|story|poem)\b',
    "research_topic": r'\b(research|study|analyze|investigate|survey|literature)\b',
}

# Safety / risk keywords
SAFETY_KEYWORDS = {
    "medical": r'\b(medical|diagnosis|treatment|symptom|disease|doctor|patient|cure|prescription)\b',
    "legal": r'\b(legal|sue|lawyer|court|contract|attorney|rights|lawsuit)\b',
    "finance": r'\b(finance|investment|stock|money|bank|loan|crypto|blockchain|profit|loss)\b',
    "self_harm": r'\b(suicide|self\s+harm|kill\s+myself|harm\s+myself|depression|anxiety)\b',
    "dangerous": r'\b(hack|exploit|malware|ransomware|illegal|drugs|weapon|bomb)\b',
}


# ============================================================
# ORIGINAL INTENT CLASSIFIER (unchanged)
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

        if HAS_SKLEARN and self._example_texts:
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
        if not HAS_SKLEARN or self._vectorizer is None or self._example_matrix is None:
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


# ============================================================
# NEW: QUERY UNDERSTANDING ENGINE (adds all extra features)
# ============================================================
class QueryUnderstandingEngine:
    """
    A comprehensive query analysis pipeline.
    It uses the IntentClassifier plus additional heuristic detectors.
    Returns a rich metadata dict including language, entities, capabilities,
    difficulty, tools, risk, confidence, etc.
    """

    def __init__(self, use_embeddings: bool = False):
        self.intent_classifier = IntentClassifier()
        self.use_embeddings = use_embeddings and HAS_SENTENCE_TRANSFORMERS
        if self.use_embeddings:
            self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        self.nlp = nlp

    def analyze(self, query: str, session: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Perform full analysis on the query.

        Returns a dict with:
          - language
          - intent (primary and secondary)
          - entities
          - programming_language
          - framework
          - capabilities (search, vision, etc.)
          - difficulty (Easy/Medium/Hard/Expert)
          - planning (single/multi-step)
          - needs_search, needs_vision, needs_tools
          - tools (list)
          - safety_risk (bool, risk areas)
          - goal
          - estimated_tokens
          - dynamic_confidence (0-1)
          - execution_type
          - risk_level
          - metadata for router
        """
        result = {
            "language": "en",
            "intent": "general",
            "sub_intent": None,
            "secondary_intents": [],
            "entities": [],
            "programming_language": None,
            "framework": None,
            "capabilities": {},
            "difficulty": "Easy",
            "planning": "single_step",
            "needs_search": False,
            "needs_vision": False,
            "needs_tools": [],
            "safety_risk": False,
            "risk_areas": [],
            "goal": "general_help",
            "estimated_tokens": 500,
            "dynamic_confidence": 0.5,
            "execution_type": "single_step",
            "risk_level": "low",
        }

        q_lower = query.lower()

        # 1. Language Detection
        lang = self._detect_language(query)
        result["language"] = lang

        # 2. Intent Classification (uses TF‑IDF + keywords)
        class_result = self.intent_classifier.classify(query)
        primary = class_result.primary_intent
        result["intent"] = primary.intent
        result["dynamic_confidence"] = primary.confidence / 100.0
        result["secondary_intents"] = [m.intent for m in class_result.secondary_intents]

        # 3. Entity Recognition (spaCy or regex)
        entities = self._extract_entities(query)
        result["entities"] = entities

        # 4. Programming Language Detection
        prog_lang = self._detect_programming_language(query)
        result["programming_language"] = prog_lang

        # 5. Framework Detection
        framework = self._detect_framework(query)
        result["framework"] = framework

        # 6. Capability Detection
        capabilities = self._detect_capabilities(query)
        result["capabilities"] = capabilities

        # 7. Difficulty Estimation
        difficulty = self._estimate_difficulty(query, class_result)
        result["difficulty"] = difficulty

        # 8. Planning Detection
        planning = self._detect_planning(query)
        result["planning"] = planning

        # 9. Search / Vision / Tool requirements
        result["needs_search"] = capabilities.get("search", False)
        result["needs_vision"] = capabilities.get("vision", False)

        # 10. Tool Detection
        tools = self._detect_tools(query)
        result["needs_tools"] = tools

        # 11. Safety & Risk Detection
        safe, risk_areas = self._check_safety(query)
        result["safety_risk"] = not safe
        result["risk_areas"] = risk_areas
        result["risk_level"] = "high" if risk_areas else "low"

        # 12. User Goal Detection
        goal = self._detect_goal(query)
        result["goal"] = goal

        # 13. Estimated tokens (rough)
        result["estimated_tokens"] = self._estimate_tokens(query)

        # 14. Execution type (single vs multi-step)
        if planning == "multi_step" or difficulty in ["Hard", "Expert"]:
            result["execution_type"] = "multi_step"
        else:
            result["execution_type"] = "single_step"

        # 15. Sub-intent (derived from entities / language)
        if prog_lang:
            result["sub_intent"] = prog_lang
        elif framework:
            result["sub_intent"] = framework
        elif "debug" in query.lower():
            result["sub_intent"] = "debugging"
        else:
            result["sub_intent"] = None

        # 16. Dynamic Confidence (blend signals)
        confidence = result["dynamic_confidence"]
        if prog_lang or framework:
            confidence = min(1.0, confidence + 0.05)
        if entities:
            confidence = min(1.0, confidence + 0.05)
        if len(tools) > 0:
            confidence = min(1.0, confidence + 0.05)
        if risk_areas:
            confidence = max(0.3, confidence - 0.1)
        if len(query.split()) < 3:
            confidence = max(0.3, confidence - 0.15)
        result["dynamic_confidence"] = round(confidence, 3)

        return result

    # ---------- Individual detection methods ----------

    def _detect_language(self, query: str) -> str:
        for lang, pattern in LANG_PATTERNS.items():
            if re.search(pattern, query, re.IGNORECASE):
                if lang == "hinglish" and re.search(r'[a-zA-Z]', query):
                    return "Hinglish"
                return lang.capitalize()
        return "English"

    def _extract_entities(self, query: str) -> List[str]:
        entities = []
        if self.nlp:
            doc = self.nlp(query)
            for ent in doc.ents:
                if ent.label_ in ["PERSON", "ORG", "GPE", "PRODUCT", "EVENT", "WORK_OF_ART"]:
                    entities.append(ent.text)
        # Also detect model names, etc.
        model_names = ["GPT-5", "Claude", "Gemini", "DeepSeek", "Llama", "Mistral", "Qwen", "Kimi"]
        for m in model_names:
            if m.lower() in query.lower():
                entities.append(m)
        return list(set(entities))

    def _detect_programming_language(self, query: str) -> Optional[str]:
        for lang, pattern in PROG_LANG_PATTERNS.items():
            if re.search(pattern, query, re.IGNORECASE):
                return lang
        return None

    def _detect_framework(self, query: str) -> Optional[str]:
        for fw, pattern in FRAMEWORK_PATTERNS.items():
            if re.search(pattern, query, re.IGNORECASE):
                return fw
        return None

    def _detect_capabilities(self, query: str) -> Dict[str, bool]:
        caps = {}
        for cap, pattern in CAPABILITY_PATTERNS.items():
            caps[cap] = bool(re.search(pattern, query, re.IGNORECASE))
        return caps

    def _estimate_difficulty(self, query: str, class_result: ClassificationResult) -> str:
        score = 1
        q_lower = query.lower()
        length = len(q_lower)
        if length > 200: score += 1
        if length > 500: score += 1
        if length > 1000: score += 2
        complex_terms = ["distributed","microservices","kubernetes","compiler","interpreter",
                         "algorithm","optimization","machine learning","neural","deep learning",
                         "encryption","blockchain","concurrent","parallel"]
        for term in complex_terms:
            if term in q_lower:
                score += 1
                break
        if class_result.is_multi_intent:
            score += 1
        if "```" in q_lower:
            score += 1
        if "research" in q_lower or "debug" in q_lower:
            score += 1
        caps = self._detect_capabilities(query)
        if caps.get("reasoning"):
            score += 1
        if caps.get("math"):
            score += 1
        score = min(score, 10)
        if score <= 3: return "Easy"
        elif score <= 6: return "Medium"
        elif score <= 8: return "Hard"
        else: return "Expert"

    def _detect_planning(self, query: str) -> str:
        if re.search(r'\b(and\s+then|then\s+after|first|second|next|finally)\b', query, re.IGNORECASE):
            return "multi_step"
        if len(re.findall(r'\b(step|phase|stage)\b', query, re.IGNORECASE)) > 1:
            return "multi_step"
        return "single_step"

    def _detect_tools(self, query: str) -> List[str]:
        tools = []
        for tool, pattern in TOOL_PATTERNS.items():
            if re.search(pattern, query, re.IGNORECASE):
                tools.append(tool)
        return list(set(tools))

    def _check_safety(self, query: str) -> Tuple[bool, List[str]]:
        risk_areas = []
        for area, pattern in SAFETY_KEYWORDS.items():
            if re.search(pattern, query, re.IGNORECASE):
                risk_areas.append(area)
        return (len(risk_areas) == 0, risk_areas)

    def _detect_goal(self, query: str) -> str:
        q_lower = query.lower()
        for goal, pattern in GOAL_PATTERNS.items():
            if re.search(pattern, q_lower):
                return goal
        return "general_help"

    def _estimate_tokens(self, query: str) -> int:
        return max(100, len(query) // 4)


# ============================================================
# ADDITIONAL CLASSES REQUIRED BY ORCHESTRATOR
# ============================================================
class LanguageDetector:
    """Simple language detection based on Unicode ranges and common words."""
    @staticmethod
    def detect(text: str) -> str:
        if not text:
            return "en"
        if re.search(r'[\u0900-\u097F]', text):
            return "hi"
        if re.search(r'[\u4e00-\u9fff]', text):
            return "zh"
        if re.search(r'[\u0600-\u06FF]', text):
            return "ar"
        if re.search(r'[\u0400-\u04FF]', text):
            return "ru"
        return "en"


class DifficultyEngine:
    @staticmethod
    def score(query: str) -> int:
        """Return difficulty score 1-10 based on query complexity."""
        score = 1
        q = query.lower()
        length = len(q)
        if length > 200: score += 1
        if length > 500: score += 1
        if length > 1000: score += 2
        complex_terms = ["distributed","microservices","kubernetes","compiler","interpreter",
                         "algorithm","optimization","machine learning","neural","deep learning",
                         "encryption","blockchain","concurrent","parallel"]
        for term in complex_terms:
            if term in q:
                score += 1
                break
        if "debugging" in q or "debug" in q:
            score += 1
        if "research" in q:
            score += 2
        if "deployment" in q:
            score += 1
        if "```" in q:
            score += 1
        if re.search(r'\b(equation|integral|derivative|matrix|vector)\b', q):
            score += 1
        return min(score, 10)


class DomainEngine:
    @staticmethod
    def detect(query: str) -> str:
        """Detect domain: medical, legal, finance, science, business, general."""
        q = query.lower()
        if re.search(r'\b(medical|health|doctor|patient|symptom|disease|diagnosis)\b', q):
            return "medical"
        if re.search(r'\b(law|legal|court|attorney|contract|sue)\b', q):
            return "legal"
        if re.search(r'\b(finance|investment|stock|money|bank|loan|crypto|blockchain)\b', q):
            return "finance"
        if re.search(r'\b(physics|chemistry|biology|science|experiment)\b', q):
            return "science"
        if re.search(r'\b(business|market|customer|sales|marketing|strategy)\b', q):
            return "business"
        return "general"


class VatsaIntelligenceScore:
    @staticmethod
    def compute(difficulty_score: int, intent_confidence: float,
                domain: str = "general", tool_count: int = 0,
                context_len: int = 0) -> float:
        """Compute VIS (0-100) based on multiple factors."""
        base = difficulty_score * 8
        base += (1.0 - intent_confidence) * 20
        if domain in ["medical", "legal", "finance"]:
            base += 10
        base += min(tool_count * 3, 15)
        if context_len > 5000:
            base += 5
        if context_len > 20000:
            base += 5
        return min(100.0, max(1.0, base))


# ============================================================
# CONVENIENCE FUNCTION: quick analysis
# ============================================================
def analyze_query(query: str, session: Optional[Dict] = None) -> Dict[str, Any]:
    engine = QueryUnderstandingEngine()
    return engine.analyze(query, session)


# ============================================================
# DEMO / TEST
# ============================================================
if __name__ == "__main__":
    # Test original classifier
    clf = IntentClassifier()
    samples = [
        "Write a Python function to fix this TypeError in my Flask app",
        "What's the best way to invest $10,000 and calculate my ROI?",
        "Plan a 5-day trip to Japan and create a budget spreadsheet",
        "What is the capital of France?",
        "Translate this contract from English to Spanish",
    ]
    for s in samples:
        result = clf.classify(s)
        print(f"\nQuery: {s}")
        print(f"  Primary: {result.primary_intent.intent} "
              f"({result.primary_intent.confidence:.1f}%, {result.primary_intent.band})")
        if result.secondary_intents:
            for sec in result.secondary_intents:
                print(f"  Secondary: {sec.intent} ({sec.confidence:.1f}%, {sec.band})")

    # Test new QueryUnderstandingEngine
    print("\n" + "="*60)
    print("QUERY UNDERSTANDING ENGINE OUTPUT")
    engine = QueryUnderstandingEngine()
    queries = [
        "Compare GPT-5, Claude and Gemini for coding tasks",
        "Fix my FastAPI backend – it's throwing a 500 error",
        "Explain quantum computing in simple terms with a diagram",
        "Write a Python script to scrape websites using Selenium",
        "I want to start an AI startup; what should I do first?",
    ]
    for q in queries:
        analysis = engine.analyze(q)
        print(f"\nQuery: {q}")
        print(json.dumps(analysis, indent=2, default=str))