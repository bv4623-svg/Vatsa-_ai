"""AWS Signature Version 4 request signing, implemented against the
stdlib only (hashlib/hmac) rather than boto3 -- no new dependency, and
this is the one piece of the S3 backend genuinely worth unit-testing in
isolation from any network call. Works against real S3 and any
S3-compatible endpoint that implements SigV4 (Cloudflare R2, MinIO).

Reference: https://docs.aws.amazon.com/general/latest/gr/sigv4-signed-request-examples.html
"""
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Dict, Tuple
from urllib.parse import quote


def _hash(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _hmac(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _signing_key(secret_key: str, date_stamp: str, region: str, service: str) -> bytes:
    k_date = _hmac(f"AWS4{secret_key}".encode("utf-8"), date_stamp)
    k_region = _hmac(k_date, region)
    k_service = _hmac(k_region, service)
    return _hmac(k_service, "aws4_request")


def sign_request(
    method: str,
    host: str,
    canonical_uri: str,
    payload: bytes,
    access_key: str,
    secret_key: str,
    region: str,
    service: str = "s3",
    extra_headers: Dict[str, str] = None,
) -> Tuple[Dict[str, str], str]:
    """Returns (headers, url_path) -- `headers` includes Authorization,
    x-amz-date and x-amz-content-sha256; the caller sends the actual HTTP
    request. `canonical_uri` must already be the path component (e.g.
    "/my-bucket/42/abc123.png"), each segment individually percent-encoded
    the way S3 expects (this function does that encoding itself from the
    raw, unencoded path)."""
    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    payload_hash = _hash(payload)

    encoded_uri = "/" + "/".join(quote(seg, safe="") for seg in canonical_uri.strip("/").split("/"))

    headers = dict(extra_headers or {})
    headers["host"] = host
    headers["x-amz-content-sha256"] = payload_hash
    headers["x-amz-date"] = amz_date

    signed_header_names = sorted(headers.keys())
    canonical_headers = "".join(f"{name}:{headers[name].strip()}\n" for name in signed_header_names)
    signed_headers = ";".join(signed_header_names)

    canonical_request = "\n".join([
        method.upper(),
        encoded_uri,
        "",  # no query string for the operations this backend needs
        canonical_headers,
        signed_headers,
        payload_hash,
    ])

    credential_scope = f"{date_stamp}/{region}/{service}/aws4_request"
    string_to_sign = "\n".join([
        "AWS4-HMAC-SHA256",
        amz_date,
        credential_scope,
        _hash(canonical_request.encode("utf-8")),
    ])

    key = _signing_key(secret_key, date_stamp, region, service)
    signature = hmac.new(key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    headers["Authorization"] = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )
    return headers, encoded_uri
