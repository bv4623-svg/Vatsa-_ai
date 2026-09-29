"""A global backstop timeout: any request still running after
REQUEST_TIMEOUT_SECONDS gets a 504 instead of tying up a worker thread/task
forever. This is a last resort, not the primary defense -- the AI Router
already has its own per-attempt and total timeouts (see
app/ai_router/config.py's AI_TIMEOUT_MS/AI_TOTAL_TIMEOUT_MS), and outbound
calls to Razorpay/Google/Gmail each set their own timeout already. This
exists for whatever isn't covered by one of those (a slow DB query, a stuck
dependency), so no single request can hang a worker indefinitely.

Streaming responses (chat SSE) are exempt: their whole point is to run for
as long as the model takes to finish, and StreamingResponse's body isn't
available yet when call_next() returns anyway (wait_for would just time out
waiting for a stream that's still correctly in progress). Overall streaming
duration is instead bounded by the router's own AI_TOTAL_TIMEOUT_MS."""
import asyncio
import os

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse

REQUEST_TIMEOUT_SECONDS = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "30"))


class RequestTimeoutMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await asyncio.wait_for(call_next(request), timeout=REQUEST_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            return JSONResponse(
                status_code=504,
                content={"detail": "The request took too long to process. Please try again."},
            )
        return response
