"""M-08 from TEST_REPORT (automated): a slow document parse must not stall
other requests. Parsing is CPU-bound and synchronous; run on the event loop
it froze the whole server (BUG-007)."""
import asyncio
import time

import httpx

from app.main import app
from app.routers import upload as upload_router

PARSE_SECONDS = 1.5


def test_slow_parse_does_not_block_other_requests(make_user, monkeypatch):
    _, headers = make_user()

    def slow_extract(raw, filename):
        time.sleep(PARSE_SECONDS)  # stands in for a huge PDF
        return "parsed", {}

    monkeypatch.setattr(upload_router, "extract_text_from_bytes", slow_extract)

    async def scenario():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            upload = asyncio.create_task(
                ac.post("/api/upload", files={"file": ("big.txt", b"x" * 1000, "text/plain")}, headers=headers)
            )
            # Timed from before the sleep: if the parse blocks the event
            # loop, the sleep itself can't resume until the parse is over.
            started = time.perf_counter()
            await asyncio.sleep(0.2)  # the parse is now running
            health = await ac.get("/health")
            health_latency = time.perf_counter() - started
            upload_res = await upload
            return health, health_latency, upload_res

    health, latency, upload_res = asyncio.run(scenario())
    assert health.status_code == 200
    assert upload_res.status_code == 200 and upload_res.json()["text"] == "parsed"
    # ~0.2s when parsing runs in a worker thread; >= 1.5s if it blocks the loop.
    assert latency < 0.8, f"/health answered {latency:.2f}s after being scheduled while a parse was running"
