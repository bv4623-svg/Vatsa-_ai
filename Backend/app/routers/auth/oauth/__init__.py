"""Google / GitHub / Microsoft sign-in (not account linking -- that's
app/routers/account/connections.py + connections_callback.py). Split by
provider (each is its own file) with shared user-provisioning/redirect
helpers in shared.py and CSRF state-cookie handling in state.py, mirroring
app/auth/dependencies/'s package split. Every callback verifies the
double-submit `state` cookie before exchanging the authorization code."""
from fastapi import APIRouter

from app.routers.auth.oauth import google, github, microsoft

router = APIRouter()
router.include_router(google.router)
router.include_router(github.router)
router.include_router(microsoft.router)
