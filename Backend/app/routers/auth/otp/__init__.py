"""OTP send/resend/verify, password reset, username/email checks.

Split into router.py (the shared APIRouter instance + shared constants)
plus send.py, verify.py, reset.py and checks.py, each importing `router`
from router.py and registering its endpoints as a side effect of import.
`router` and the constants are re-exported here so
`app.routers.auth.otp.router` (the attribute) and
`from app.routers.auth.otp import RESEND_COOLDOWN_SECONDS` keep working
unchanged.
"""
from app.routers.auth.otp.router import router, RESEND_COOLDOWN_SECONDS, _DEBUG_LOG_OTP
from app.routers.auth.otp import send, verify, reset, checks  # noqa: F401
from app.routers.auth.otp.send import logger, send_otp, resend_otp
from app.routers.auth.otp.verify import verify_otp
from app.routers.auth.otp.reset import reset_password
from app.routers.auth.otp.checks import check_username, check_email

__all__ = [
    "router", "RESEND_COOLDOWN_SECONDS", "logger",
    "send_otp", "resend_otp", "verify_otp", "reset_password",
    "check_username", "check_email",
]
