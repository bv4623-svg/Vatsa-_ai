"""StorageBackend: the one interface every place in this app that reads or
writes a user-facing binary blob (a generated image, an uploaded file)
should go through, instead of calling open()/os.makedirs() directly. Lets
STORAGE_BACKEND=s3 swap in object storage later without touching the
callers again.
"""
from typing import Protocol


class StorageBackend(Protocol):
    def put(self, key: str, data: bytes) -> None:
        """Writes `data` under `key`, creating any needed parent
        directories/prefixes. Overwrites an existing object at the same key."""
        ...

    def get(self, key: str) -> bytes:
        """Raises FileNotFoundError if `key` does not exist."""
        ...

    def delete(self, key: str) -> None:
        """A no-op if `key` does not exist -- callers should not have to
        check existence first just to clean up."""
        ...

    def url(self, key: str) -> str:
        """A locator for `key` -- an absolute filesystem path for
        LocalDiskStorage, an object URL for S3Storage. Not necessarily a
        publicly fetchable URL; callers that need to serve the bytes over
        HTTP still do that themselves (see app/routers/files.py), this is
        just "where is it"."""
        ...
