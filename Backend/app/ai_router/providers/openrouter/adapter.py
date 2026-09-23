"""OpenRouter adapter. The only place that knows OpenRouter's URL, headers,
response shape or error codes (parsing.py holds the pure-function parts of that)."""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any, AsyncIterator, Callable, Dict, Optional

import aiohttp

from app.ai_router.errors import ErrorKind, ProviderError
from app.ai_router.providers.base import ProviderAdapter, ProviderResult
from app.ai_router.providers.openrouter.parsing import (
    DEFAULT_BASE_URL, _in_band_error, _retry_after, _usage, classify_status,
)
from app.ai_router.types import EventType, StreamEvent


class OpenRouterAdapter(ProviderAdapter):
    name = "openrouter"

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_BASE_URL,
        api_key_getter: Callable[[], Optional[str]] = lambda: os.getenv("OPENROUTER_API_KEY"),
        referer: str = "https://vatsa-ai.local",
        title: str = "Vatsa AI",
        stream_total_timeout_s: float = 90.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key_getter = api_key_getter
        self._referer = referer
        self._title = title
        self._stream_total_timeout_s = stream_total_timeout_s

    # -- helpers -------------------------------------------------------
    def _headers(self) -> Dict[str, str]:
        key = self._api_key_getter()
        if not key:
            raise ProviderError(ErrorKind.AUTH, detail="OPENROUTER_API_KEY is not set")
        return {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": self._referer,
            "X-Title": self._title,
        }

    @staticmethod
    def _transport_error(exc: BaseException) -> ProviderError:
        if isinstance(exc, (asyncio.TimeoutError, aiohttp.ServerTimeoutError)):
            return ProviderError(ErrorKind.TIMEOUT, detail=type(exc).__name__)
        return ProviderError(ErrorKind.CONNECTION, detail=f"{type(exc).__name__}: {exc}"[:300])

    # -- generate ------------------------------------------------------
    async def generate(self, model, messages, *, max_tokens, temperature, timeout_s) -> ProviderResult:
        payload = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature}
        headers = self._headers()
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self._base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=timeout_s),
                ) as resp:
                    # Decode as UTF-8 explicitly: letting aiohttp guess the charset from headers
                    # has produced mojibake for emoji/multibyte text.
                    body = (await resp.read()).decode("utf-8", errors="replace")
                    if resp.status != 200:
                        raise ProviderError(
                            classify_status(resp.status),
                            status=resp.status,
                            retry_after=_retry_after(resp.headers),
                            detail=body[:500],
                        )
        except ProviderError:
            raise
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            raise self._transport_error(exc) from None

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            raise ProviderError(ErrorKind.SERVER_ERROR, detail=f"non-JSON body: {body[:200]}") from None

        in_band = _in_band_error(data)
        if in_band and not data.get("choices"):
            raise in_band
        choices = data.get("choices") or []
        if not choices:
            raise ProviderError(ErrorKind.EMPTY_RESPONSE, detail="no choices returned")
        message = choices[0].get("message") or {}
        return ProviderResult(
            content=message.get("content") or "",
            reasoning=message.get("reasoning") or "",
            usage=_usage(data.get("usage")),
        )

    # -- stream --------------------------------------------------------
    async def stream(self, model, messages, *, max_tokens, temperature, timeout_s) -> AsyncIterator[StreamEvent]:
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        headers = self._headers()
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self._base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    # sock_read is the gap allowed between chunks: a model that connects and then
                    # goes silent needs its own limit, separate from the overall cap that must not
                    # cut off a long but steadily streaming answer.
                    timeout=aiohttp.ClientTimeout(
                        total=self._stream_total_timeout_s, sock_connect=10, sock_read=timeout_s
                    ),
                ) as resp:
                    if resp.status != 200:
                        raw = await resp.read()
                        raise ProviderError(
                            classify_status(resp.status),
                            status=resp.status,
                            retry_after=_retry_after(resp.headers),
                            detail=raw.decode("utf-8", errors="replace")[:500],
                        )

                    buffer = b""
                    async for chunk in resp.content.iter_any():
                        buffer += chunk
                        while b"\n" in buffer:
                            line, buffer = buffer.split(b"\n", 1)
                            line = line.decode("utf-8", errors="replace").strip()
                            if not line or not line.startswith("data:"):
                                continue
                            data_str = line[5:].strip()
                            if data_str == "[DONE]":
                                return
                            try:
                                evt = json.loads(data_str)
                            except json.JSONDecodeError:
                                continue
                            in_band = _in_band_error(evt)
                            if in_band:
                                raise in_band
                            choices = evt.get("choices") or []
                            if choices:
                                delta = choices[0].get("delta") or {}
                                if delta.get("reasoning"):
                                    yield StreamEvent(EventType.THINKING, content=delta["reasoning"])
                                if delta.get("content"):
                                    yield StreamEvent(EventType.DELTA, content=delta["content"])
                            usage = _usage(evt.get("usage"))
                            if usage:
                                yield StreamEvent(EventType.USAGE, usage=usage)
        except ProviderError:
            raise
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            raise self._transport_error(exc) from None

    # -- health --------------------------------------------------------
    async def health_check(self, timeout_s: float = 5.0) -> bool:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self._base_url}/models", timeout=aiohttp.ClientTimeout(total=timeout_s)
                ) as resp:
                    return resp.status == 200
        except (aiohttp.ClientError, asyncio.TimeoutError):
            return False
