import os
import httpx
from typing import Optional

class Orchestrator:
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"

    def generate_response(self, user_id: int, conversation_id: int, user_message: str, system_prompt: str) -> str:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Vatsa AI"
        }
        payload = {
            "model": "openai/gpt-3.5-turbo",
            "messages": messages,
            "temperature": 0.7
        }
        with httpx.Client(timeout=60) as client:
            resp = client.post(self.base_url, json=payload, headers=headers)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
