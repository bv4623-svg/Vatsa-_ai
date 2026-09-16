"""
Authentication router package.

Split by responsibility (previously one 563-line module):
- core.py:   register / login / token / me / onboarding
- otp.py:    OTP send/resend/verify, password reset, username/email checks
- oauth.py:  Google / GitHub / Microsoft OAuth

`router` below is what app/main.py includes -- combining the three keeps
that one import (`from app.routers import auth as auth_router`) working
unchanged.
"""
from fastapi import APIRouter

from app.routers.auth import core, otp, oauth

router = APIRouter()
router.include_router(core.router)
router.include_router(otp.router)
router.include_router(oauth.router)

__all__ = ["router"]
