"""B12: StorageBackend implementations and the STORAGE_BACKEND selector.
See app/services/storage/."""
import pytest

from app.services.storage import LocalDiskStorage, S3Storage, get_storage_backend
from app.services.storage.s3_sign import sign_request


def test_local_disk_put_get_round_trips(tmp_path):
    storage = LocalDiskStorage(str(tmp_path))
    storage.put("42/hello.txt", b"hello world")
    assert storage.get("42/hello.txt") == b"hello world"


def test_local_disk_get_missing_key_raises_file_not_found(tmp_path):
    storage = LocalDiskStorage(str(tmp_path))
    with pytest.raises(FileNotFoundError):
        storage.get("does/not/exist.txt")


def test_local_disk_delete_is_a_noop_for_a_missing_key(tmp_path):
    storage = LocalDiskStorage(str(tmp_path))
    storage.delete("never-existed.txt")  # must not raise


def test_local_disk_delete_removes_the_file(tmp_path):
    storage = LocalDiskStorage(str(tmp_path))
    storage.put("f.txt", b"data")
    storage.delete("f.txt")
    with pytest.raises(FileNotFoundError):
        storage.get("f.txt")


def test_local_disk_url_is_an_absolute_path_under_root(tmp_path):
    storage = LocalDiskStorage(str(tmp_path))
    url = storage.url("42/hello.txt")
    assert str(tmp_path) in url
    assert url.endswith("hello.txt")


def test_local_disk_rejects_a_path_traversal_key(tmp_path):
    storage = LocalDiskStorage(str(tmp_path))
    with pytest.raises(ValueError):
        storage.put("../../etc/passwd", b"pwned")


def test_get_storage_backend_defaults_to_local(monkeypatch, tmp_path):
    monkeypatch.delenv("STORAGE_BACKEND", raising=False)
    backend = get_storage_backend(str(tmp_path))
    assert isinstance(backend, LocalDiskStorage)


def test_get_storage_backend_s3_without_config_raises(monkeypatch, tmp_path):
    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    for var in ("S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"):
        monkeypatch.delenv(var, raising=False)
    with pytest.raises(RuntimeError):
        get_storage_backend(str(tmp_path))


def test_get_storage_backend_s3_with_config_returns_s3_storage(monkeypatch, tmp_path):
    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    monkeypatch.setenv("S3_ENDPOINT", "https://fake.r2.example.com")
    monkeypatch.setenv("S3_BUCKET", "my-bucket")
    monkeypatch.setenv("S3_ACCESS_KEY", "AKIAFAKE")
    monkeypatch.setenv("S3_SECRET_KEY", "fakesecret")
    backend = get_storage_backend(str(tmp_path))
    assert isinstance(backend, S3Storage)


def test_sigv4_signature_is_deterministic_for_the_same_inputs():
    headers1, path1 = sign_request(
        "PUT", "example.com", "/bucket/key with space.png", b"data",
        "AKIAFAKE", "fakesecret", "auto",
    )
    # Re-signing must not accidentally depend on mutable shared state.
    headers2, path2 = sign_request(
        "PUT", "example.com", "/bucket/key with space.png", b"data",
        "AKIAFAKE", "fakesecret", "auto",
    )
    assert path1 == path2 == "/bucket/key%20with%20space.png"
    assert headers1["Authorization"].startswith("AWS4-HMAC-SHA256 Credential=AKIAFAKE/")
    assert "x-amz-content-sha256" in headers1
    assert headers2["Authorization"].startswith("AWS4-HMAC-SHA256 Credential=AKIAFAKE/")


def test_sigv4_signature_changes_with_the_payload():
    headers_a, _ = sign_request("PUT", "example.com", "/bucket/k", b"aaa", "AK", "SECRET", "auto")
    headers_b, _ = sign_request("PUT", "example.com", "/bucket/k", b"bbb", "AK", "SECRET", "auto")
    assert headers_a["x-amz-content-sha256"] != headers_b["x-amz-content-sha256"]
    assert headers_a["Authorization"] != headers_b["Authorization"]


def test_s3_storage_put_sends_a_signed_put_and_treats_2xx_as_success():
    import httpx

    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization", "")
        return httpx.Response(200)

    transport = httpx.MockTransport(handler)
    real_request = httpx.request

    def fake_request(method, url, headers=None, content=None, timeout=None):
        with httpx.Client(transport=transport) as client:
            return client.request(method, url, headers=headers, content=content)

    import app.services.storage.s3 as s3_module
    original = s3_module.httpx.request
    s3_module.httpx.request = fake_request
    try:
        storage = S3Storage("https://fake.example.com", "my-bucket", "AK", "SECRET", "auto")
        storage.put("42/image.png", b"bytes")
    finally:
        s3_module.httpx.request = original

    assert captured["method"] == "PUT"
    assert "my-bucket/42/image.png" in captured["url"]
    assert captured["auth"].startswith("AWS4-HMAC-SHA256")


def test_s3_storage_get_missing_object_raises_file_not_found():
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)

    def fake_request(method, url, headers=None, content=None, timeout=None):
        with httpx.Client(transport=transport) as client:
            return client.request(method, url, headers=headers, content=content)

    import app.services.storage.s3 as s3_module
    original = s3_module.httpx.request
    s3_module.httpx.request = fake_request
    try:
        storage = S3Storage("https://fake.example.com", "my-bucket", "AK", "SECRET", "auto")
        with pytest.raises(FileNotFoundError):
            storage.get("missing.png")
    finally:
        s3_module.httpx.request = original
