# model_selector.py
class DynamicModelCatalog:
    def __init__(self):
        # Only working OpenRouter models with tags
        self.models = {
            "openai/gpt-4.1-mini": {"id": "openai/gpt-4.1-mini", "score": 95, "tags": ["general", "fast", "cheap"]},
            "openai/gpt-4o-mini": {"id": "openai/gpt-4o-mini", "score": 90, "tags": ["general", "fast", "cheap"]},
            "deepseek/deepseek-chat": {"id": "deepseek/deepseek-chat", "score": 88, "tags": ["coding", "reasoning"]},
            "mistral/mistral-small": {"id": "mistral/mistral-small", "score": 85, "tags": ["general", "fast"]},
            "google/gemini-2.5-flash": {"id": "google/gemini-2.5-flash", "score": 92, "tags": ["fast", "general"]},
            "qwen/qwen-2.5-72b-instruct": {"id": "qwen/qwen-2.5-72b-instruct", "score": 87, "tags": ["reasoning", "coding"]},
        }

    async def refresh(self):
        print("✅ Model catalog with safe models")
        return self.models

    def get_all_model_ids(self):
        return list(self.models.keys())

class ModelRankingEngine:
    def __init__(self, catalog):
        self.catalog = catalog

    def rank_models(self, requirements: dict, user_tier: str) -> list:
        intent = requirements.get("intent", "chat")
        domain = requirements.get("domain", "general")
        difficulty = requirements.get("difficulty", 0)
        priority = requirements.get("priority", "quality")

        models = []
        for mid, data in self.catalog.models.items():
            score = data.get("score", 50)
            tags = data.get("tags", [])

            # Boost based on intent
            if intent == "coding" and "coding" in tags:
                score += 15
            elif intent == "research" and "reasoning" in tags:
                score += 15
            elif intent == "generate" and "creative" in tags:
                score += 10

            # Domain boost
            if domain == "coding" and "coding" in tags:
                score += 10
            if domain == "research" and "reasoning" in tags:
                score += 10

            # Difficulty boost
            if difficulty > 6 and "reasoning" in tags:
                score += 8
            if difficulty > 8 and "coding" in tags:
                score += 8

            # Priority boost
            if priority == "fast" and "fast" in tags:
                score += 5
            if priority == "cheap" and "cheap" in tags:
                score += 5

            models.append({"id": mid, "score": score})

        models.sort(key=lambda x: x["score"], reverse=True)
        return models