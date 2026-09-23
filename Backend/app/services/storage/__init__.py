"""Object storage abstraction (B12): STORAGE_BACKEND=local (default) keeps
every existing local-disk call site's behavior byte-for-byte identical
(same directories, same file layout); STORAGE_BACKEND=s3 switches to
S3-compatible object storage (real S3, Cloudflare R2, MinIO) with no
other code changes needed at the call sites.
"""
import os

from app.services.storage.base import StorageBackend
from app.services.storage.local import LocalDiskStorage
from app.services.storage.s3 import S3Storage

__all__ = ["StorageBackend", "LocalDiskStorage", "S3Storage", "get_storage_backend"]


def get_storage_backend(local_root: str) -> StorageBackend:
    """`local_root` is the caller's own existing directory (e.g.
    STORAGE_ROOT in image_service.py, UPLOAD_STORAGE_ROOT in upload.py) --
    still used, and still the only thing that matters, when
    STORAGE_BACKEND is "local" (the default)."""
    backend = (os.getenv("STORAGE_BACKEND") or "local").strip().lower()
    if backend == "s3":
        endpoint = os.getenv("S3_ENDPOINT", "")
        bucket = os.getenv("S3_BUCKET", "")
        access_key = os.getenv("S3_ACCESS_KEY", "")
        secret_key = os.getenv("S3_SECRET_KEY", "")
        region = os.getenv("S3_REGION", "auto")
        if not (endpoint and bucket and access_key and secret_key):
            raise RuntimeError(
                "STORAGE_BACKEND=s3 requires S3_ENDPOINT, S3_BUCKET, "
                "S3_ACCESS_KEY and S3_SECRET_KEY to all be set."
            )
        return S3Storage(endpoint, bucket, access_key, secret_key, region)
    return LocalDiskStorage(local_root)
