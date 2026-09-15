import os
import re
import json
import logging
import urllib.parse
import aiohttp
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.memory_service import MemoryService
from app.services.token_service import TokenService

logger = logging.getLogger("AIService")

# Model mappings
MODEL_NAME_MAPPING = {
    "claude-opus-5":     "anthropic/claude-3.5-sonnet",
    "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
    "gpt-5.6-luna":      "openai/gpt-4o",
    "gpt-4o":            "openai/gpt-4o",
    "gemini-3.6-flash":  "google/gemini-2.5-pro",
    "gemini-1.5-pro":    "google/gemini-2.5-pro",
    "deepseek-v3.2":     "deepseek/deepseek-chat",
    "deepseek-chat":     "deepseek/deepseek-chat",
    "auto":              "openai/gpt-4o",
}

FREE_FALLBACK_MODELS = [
    "deepseek/deepseek-chat",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "qwen/qwen-2.5-coder-32b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
]

IMAGE_GEN_PATTERNS = [
    r"\b(generate|create|make|draw|paint|render|produce|design)\s+(an?\s+|me\s+)?(ultra[\s-]?realistic\s+|realistic\s+|detailed\s+|hd\s+|high[\s-]?quality\s+)?(image|picture|photo|illustration|artwork|drawing|portrait|art)\b",
    r"\bimage\s+of\s+",
    r"\bpicture\s+of\s+",
    r"\bdraw\s+(me\s+)?",
    r"\bpaint\s+(me\s+)?",
    r"^imagine\s+",
    r"^/imagine\s+",
]

def detect_image_gen(query: str) -> Optional[str]:
    q = query.lower().strip()
    for pat in IMAGE_GEN_PATTERNS:
        if re.search(pat, q):
            # Clean prompt
            cleaned = re.sub(r"^(please\s+)?(generate|create|make|draw|paint|render|produce|design|imagine|show)\s+", "", query, flags=re.I)
            cleaned = re.sub(r"^(me\s+)?(an?\s+)?", "", cleaned, flags=re.I)
            cleaned = re.sub(r"^(image|picture|photo|illustration|drawing|art)\s+(of\s+)?", "", cleaned, flags=re.I)
            return cleaned.strip() or "beautiful realistic artwork"
    return None

async def generate_image(prompt: str) -> Dict[str, Any]:
    encoded = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded}?width=1024&height=1024&model=flux&nologo=true"
    return {"image_url": url, "prompt": prompt, "model": "flux"}

class AIService:
    @staticmethod
    def map_model(preferred: Optional[str]) -> str:
        if not preferred:
            return "openai/gpt-4o"
        return MODEL_NAME_MAPPING.get(preferred.lower(), preferred)

    @staticmethod
    async def call_openrouter(
        messages: List[Dict[str, str]],
        model: str,
        max_tokens: int = 1500,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY is not set in environment.")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://vatsa-ai.local",
            "X-Title": "Vatsa AI"
        }
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=120
            ) as resp:
                body = await resp.text()
                if resp.status != 200:
                    raise RuntimeError(f"OpenRouter [{resp.status}]: {body}")
                data = json.loads(body)
                choices = data.get("choices", [])
                if not choices:
                    raise RuntimeError("No choices returned from OpenRouter")
                content = choices[0].get("message", {}).get("content", "")
                usage = data.get("usage", {})
                return {
                    "content": content,
                    "model": data.get("model", model),
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0)
                }

    @staticmethod
    async def generate_response(
        db: Session,
        user: User,
        query: str,
        conversation_history: List[Dict[str, Any]],
        model_name: Optional[str] = None,
        workspace: str = "chat",
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        target_model = AIService.map_model(model_name)
        is_code = (workspace == "code")

        # Estimate tokens and check allowance
        estimated_tokens = 3000 if is_code else 800
        allowed, reason = TokenService.check_allowance(db, user, estimated_tokens=estimated_tokens, model=target_model)
        if not allowed:
            raise ValueError(reason)

        # 1. Build System Prompt with Real User Identity & Memory
        user_name = user.full_name or user.email.split("@")[0]
        user_memories = MemoryService.get_context_summary(db, user.id)

        system_parts = [
            f"You are Vatsa AI, a high-performance AI assistant and expert programmer.",
            f"Current authenticated user identity:",
            f"- Name: {user_name}",
            f"- Email: {user.email}",
            f"- Account Tier: {user.tier or 'free'}",
            f"Always acknowledge the user's real name ({user_name}) when they ask 'Who am I?' or ask about themselves."
        ]

        if user_memories:
            system_parts.append(f"\nUser preferences and persistent memory:\n{user_memories}")

        if is_code:
            system_parts.append(
                "\n[CODE WORKSPACE MODE]\n"
                "You are generating production-grade code. Follow these rules strictly:\n"
                "1. Provide complete, working code for each file inside markdown code fences with filename comments or language identifiers.\n"
                "2. When generating web projects, provide index.html, styles.css, script.js or React components with full working code.\n"
                "3. Never truncate files with placeholder comments like '// ... rest of code'. Write the complete file."
            )

        system_prompt = "\n".join(system_parts)

        # 2. Assemble Message Sequence
        messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]

        # Include up to last 10 conversation turns for context
        recent_history = conversation_history[-10:] if conversation_history else []
        for msg in recent_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ["user", "assistant"] and content:
                messages.append({"role": role, "content": content})

        # Append current user prompt with any attachments
        user_content = query
        if attachments:
            att_texts = []
            for att in attachments:
                fname = att.get("filename", "file")
                ftext = att.get("text", "")
                if ftext:
                    att_texts.append(f"--- Attachment: {fname} ---\n{ftext}")
            if att_texts:
                user_content += "\n\n" + "\n\n".join(att_texts)

        messages.append({"role": "user", "content": user_content})

        # 3. Call OpenRouter with fallback models
        max_tokens = 4000 if is_code else 1500
        candidate_models = [target_model] + [m for m in FREE_FALLBACK_MODELS if m != target_model]

        last_error = None
        result = None
        used_model = target_model

        for cand in candidate_models:
            try:
                logger.info(f"Calling model {cand} for user {user.email} (workspace={workspace})")
                result = await AIService.call_openrouter(messages, cand, max_tokens=max_tokens)
                used_model = cand
                break
            except Exception as e:
                logger.warning(f"Model {cand} failed: {e}")
                last_error = e

        if not result:
            raise RuntimeError(f"All AI models failed. Last error: {last_error}")

        # 4. Deduct tokens from user's balance
        prompt_tokens = result.get("prompt_tokens", len(query) // 4)
        completion_tokens = result.get("completion_tokens", len(result["content"]) // 4)
        total_tokens = prompt_tokens + completion_tokens

        TokenService.deduct_tokens(
            db=db,
            user_id=user.id,
            tokens=total_tokens,
            reason=f"AI response ({used_model})",
            model=used_model
        )

        return {
            "status": "success",
            "query": query,
            "response": result["content"],
            "selected_model": used_model,
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens
            },
            "workspace": workspace,
            "vis": 95 if is_code else 85,
            "primary_intent": "coding" if is_code else "general_chat"
        }
