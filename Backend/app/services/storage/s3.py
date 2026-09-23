"""S3-compatible object storage (real S3, Cloudflare R2, MinIO) over plain
HTTP + hand-rolled SigV4 signing (see s3_sign.py) -- no boto3. Path-style
addressing (https://{endpoint}/{bucket}/{key}) works against all three."""
import logging
from urllib.parse import urlparse

import httpx

from app.services.storage.s3_sign import sign_request

logger = logging.getLogger("S3Storage")


class S3Storage:
    def __init__(self, endpoint: str, bucket: str, access_key: str, secret_key: str, region: str = "auto") -> None:
        self._endpoint = endpoint.rstrip("/")
        self._bucket = bucket
        self._access_key = access_key
        self._secret_key = secret_key
        self._region = region
        self._host = urlparse(self._endpoint).netloc or self._endpoint

    def _request(self, method: str, key: str, data: bytes = b"") -> httpx.Response:
        canonical_uri = f"/{self._bucket}/{key}"
        headers, encoded_path = sign_request(
            method, self._host, canonical_uri, data,
            self._access_key, self._secret_key, self._region,
        )
        url = f"{self._endpoint}{encoded_path}"
        response = httpx.request(method, url, headers=headers, content=data, timeout=30)
        return response

    def put(self, key: str, data: bytes) -> None:
        res = self._request("PUT", key, data)
        if res.status_code not in (200, 201):
            logger.error("S3 PUT %s failed: %s %s", key, res.status_code, res.text[:300])
            raise RuntimeError(f"Object storage PUT failed with status {res.status_code}")

    def get(self, key: str) -> bytes:
        res = self._request("GET", key)
        if res.status_code == 404:
            raise FileNotFoundError(key)
        if res.status_code != 200:
            logger.error("S3 GET %s failed: %s %s", key, res.status_code, res.text[:300])
            raise RuntimeError(f"Object storage GET failed with status {res.status_code}")
        return res.content

    def delete(self, key: str) -> None:
        res = self._request("DELETE", key)
        if res.status_code not in (200, 204, 404):
            logger.error("S3 DELETE %s failed: %s %s", key, res.status_code, res.text[:300])
            raise RuntimeError(f"Object storage DELETE failed with status {res.status_code}")

    def url(self, key: str) -> str:
        return f"{self._endpoint}/{self._bucket}/{key}"
