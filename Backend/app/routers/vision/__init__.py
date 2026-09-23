"""One-shot structured image analysis (description/tags/objects/OCR).

Split into router.py (shared APIRouter + constants), parsing.py
(response-JSON parsing) and endpoint.py. `router` is re-exported here so
`app.routers.vision.router` (as used by app/main.py) keeps working
unchanged.
"""
from app.routers.vision.router import router, logger, MAX_IMAGE_BYTES, ALLOWED_CONTENT_TYPES
from app.routers.vision.parsing import _ANALYSIS_PROMPT, _FENCE_RE, _parse_vision_response
from app.routers.vision.endpoint import analyze_image

__all__ = [
    "router", "logger", "MAX_IMAGE_BYTES", "ALLOWED_CONTENT_TYPES",
    "_ANALYSIS_PROMPT", "_FENCE_RE", "_parse_vision_response",
    "analyze_image",
]
