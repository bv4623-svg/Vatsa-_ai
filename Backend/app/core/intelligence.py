# intelligence.py
import re
from typing import Dict, Any

class PrimaryIntent:
    def __init__(self, intent: str, confidence: int):
        self.intent = intent
        self.confidence = confidence

class IntentResult:
    def __init__(self, intent: str, confidence: int):
        self.primary_intent = PrimaryIntent(intent, confidence)

class IntentClassifier:
    def classify(self, text: str) -> IntentResult:
        text_lower = text.lower()
        if any(w in text_lower for w in ["write", "create", "generate", "compose"]):
            intent = "generate"
        elif any(w in text_lower for w in ["analyze", "evaluate", "compare", "research"]):
            intent = "research"
        elif any(w in text_lower for w in ["debug", "fix", "error", "bug"]):
            intent = "coding"
        elif any(w in text_lower for w in ["translate", "convert"]):
            intent = "translate"
        else:
            intent = "chat"
        return IntentResult(intent, 90)  # confidence as int (%)

class LanguageDetector:
    def detect(self, text: str) -> str:
        if re.search(r'[éèêëàâäôöûüîïç]', text, re.I):
            return "fr"
        if re.search(r'[áéíóúñ¿¡]', text, re.I):
            return "es"
        return "en"

class DifficultyEngine:
    @staticmethod
    def score(text: str) -> float:
        # Return a difficulty score (0-10)
        text_lower = text.lower()
        score = 0
        if any(w in text_lower for w in ["algorithm", "data structure", "complexity"]):
            score += 3
        if any(w in text_lower for w in ["python", "javascript", "react", "docker"]):
            score += 2
        if any(w in text_lower for w in ["research", "evaluate", "compare"]):
            score += 2
        return min(score, 10)

class DomainEngine:
    @staticmethod
    def detect(text: str) -> str:
        text_lower = text.lower()
        if any(w in text_lower for w in ["python", "react", "docker", "kubernetes", "api", "code"]):
            return "coding"
        if any(w in text_lower for w in ["medical", "diagnosis", "symptom", "healthcare"]):
            return "medical"
        if any(w in text_lower for w in ["finance", "investment", "accounting", "banking"]):
            return "finance"
        if any(w in text_lower for w in ["legal", "contract", "lawsuit", "compliance"]):
            return "legal"
        if any(w in text_lower for w in ["tutorial", "education", "learn", "teach"]):
            return "education"
        return "general"

class VatsaIntelligenceScore:
    @staticmethod
    def compute(diff: float, conf: float, domain: str) -> float:
        # Return a combined score (0-10)
        base = diff * 0.5 + conf * 0.3
        if domain == "coding":
            base += 1
        elif domain == "research":
            base += 0.5
        return min(base, 10)