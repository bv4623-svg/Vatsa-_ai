"""Security headers on every response. This is a pure API backend (the
Next.js app is what actually renders HTML for users), so most of these are
defense-in-depth rather than the primary control -- except on /docs and
/redoc, which FastAPI itself serves as real HTML and which get a looser
CSP so Swagger/ReDoc's CDN-hosted JS still runs.

No Origin/Referer enforcement here deliberately: every state-changing
route requires a Bearer Authorization header or an API key (see
app/services/account/api_keys.py) -- neither is an ambient credential a
browser attaches automatically to a cross-site request, which is the
precondition CSRF depends on. Blocking on Origin would instead break the
two things that legitimately call this API without one: Razorpay's
webhook and any API-key-authenticated integration."""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

_DOCS_PATHS = {"/docs", "/redoc", "/docs/oauth2-redirect"}

_API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
_DOCS_CSP = (
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; "
    "frame-ancestors 'none'; base-uri 'self'"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        # HSTS only makes sense once the site is actually served over HTTPS
        # -- sending it over plain HTTP dev traffic does nothing harmful,
        # but gating it keeps plain-http local runs from being
        # confusing about why a browser "remembers" HTTPS-only later.
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"

        response.headers["Content-Security-Policy"] = _DOCS_CSP if request.url.path in _DOCS_PATHS else _API_CSP
        return response
