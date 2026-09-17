"""Auth dependencies: JWT session validation (with an additive API-key
fallback), the media-scoped-token variant, and the optional/non-raising
variant. Import from here (app.auth.dependencies) rather than the
submodules directly -- every existing `from app.auth.dependencies import
get_current_user`-style import keeps working unchanged.
"""
from app.auth.dependencies.core import security, get_current_user
from app.auth.dependencies.media import get_user_for_media
from app.auth.dependencies.optional import get_current_user_optional

__all__ = ["security", "get_current_user", "get_user_for_media", "get_current_user_optional"]
