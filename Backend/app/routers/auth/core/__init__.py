"""Register / login / token / me / onboarding.

Split into router.py (the shared APIRouter instance) plus register.py,
login.py, profile.py and onboarding.py, each importing `router` from
router.py and registering its endpoints as a side effect of import.
`router` is re-exported here so `app.routers.auth.core.router` (the
attribute, as used by app/routers/auth/__init__.py) keeps working
unchanged.
"""
from app.routers.auth.core.router import router
from app.routers.auth.core import register, login, profile, onboarding  # noqa: F401

__all__ = ["router"]
