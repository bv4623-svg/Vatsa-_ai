"""Keeps generated-image links in stored conversations loadable.

A generated image is embedded as .../api/files/<id>/preview?token=<media
token>, and that token expires (ACCESS_TOKEN_EXPIRE_MINUTES, 7 days by
default). Stored messages keep whatever token was minted at generation
time, so without this every image in an older conversation turned into a
broken <img>. Conversations are re-signed with a fresh token for their
owner each time they are served.
"""
import re
from typing import Any, Dict, List, Optional

from app.auth.jwt import create_media_token

_PREVIEW_TOKEN_RE = re.compile(r"(/api/files/[0-9a-f]{32}/preview\?token=)[A-Za-z0-9._\-]+")


def refresh_media_tokens(messages: Optional[List[Dict[str, Any]]], user_id: int) -> List[Dict[str, Any]]:
    """Returns a copy of `messages` with every preview token replaced by a
    fresh media token for `user_id`. Messages without image links are
    returned unchanged (and no token is minted)."""
    if not messages:
        return messages or []
    token: Optional[str] = None
    out: List[Dict[str, Any]] = []
    for msg in messages:
        if not isinstance(msg, dict):
            out.append(msg)
            continue
        new_msg = msg
        for field in ("content", "imageUrl"):
            value = msg.get(field)
            if isinstance(value, str) and "/preview?token=" in value:
                if token is None:
                    token = create_media_token(user_id)
                replaced = _PREVIEW_TOKEN_RE.sub(lambda m: m.group(1) + token, value)
                if replaced != value:
                    if new_msg is msg:
                        new_msg = dict(msg)
                    new_msg[field] = replaced
        out.append(new_msg)
    return out
