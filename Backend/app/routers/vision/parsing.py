import re
import json

_ANALYSIS_PROMPT = (
    "Analyze this image carefully. Respond with ONLY a JSON object (no markdown "
    "fences, no extra commentary) in exactly this shape:\n"
    '{"description": "a detailed description of the scene, mood, and composition", '
    '"tags": ["short", "keyword", "tags"], '
    '"objects": ["key objects or people visible"], '
    '"extracted_text": "any text visible in the image via OCR, or an empty string if none"}'
)

_FENCE_RE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)


def _parse_vision_response(raw: str) -> dict:
    text = (raw or "").strip()
    fence = _FENCE_RE.match(text)
    if fence:
        text = fence.group(1)
    try:
        data = json.loads(text)
        return {
            "description": data.get("description") or "",
            "tags": data.get("tags") or [],
            "objects": data.get("objects") or [],
            "extracted_text": data.get("extracted_text") or "",
        }
    except (json.JSONDecodeError, AttributeError):
        # Model didn't follow the JSON format -- still return something
        # useful rather than failing the whole request over formatting.
        return {"description": text, "tags": [], "objects": [], "extracted_text": ""}
