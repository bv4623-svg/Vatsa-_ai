import re
from fastapi import HTTPException, status

FORBIDDEN_PATTERNS = [
    r"(?i)ignore\s+all\s+previous\s+instructions",
    r"(?i)reveal\s+(?:another\s+)?user'?s?\s+memory",
    r"(?i)system\s+prompt",
    r"(?i)override\s+(?:the\s+)?system",
    r"(?i)forget\s+(?:all\s+)?(?:previous\s+)?instructions",
    r"(?i)you\s+are\s+now\s+",
    r"(?i)new\s+instructions:",
]

async def sanitize_user_input(text: str) -> str:
    if not text:
        return ""
    if len(text) > 10000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Input too long"
        )
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, text):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Input contains disallowed security patterns."
            )
    return text.strip()