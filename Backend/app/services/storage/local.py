"""Dev-default StorageBackend: plain files under a root directory. `key`
may contain "/" (e.g. "42/abc123.png") -- parent directories are created
on put() the same way the pre-abstraction call sites already did with
os.makedirs(..., exist_ok=True)."""
import os


class LocalDiskStorage:
    def __init__(self, root: str) -> None:
        self._root = root

    def _path(self, key: str) -> str:
        # normpath + the root-prefix check below stop a key containing
        # "../" from writing or reading outside `root`, the same class of
        # bug app/routers/upload.py's sanitize_filename() already guards
        # against for the filename half of a key.
        path = os.path.normpath(os.path.join(self._root, key))
        root_abs = os.path.abspath(self._root)
        if not os.path.abspath(path).startswith(root_abs):
            raise ValueError(f"Storage key resolves outside its root: {key!r}")
        return path

    def put(self, key: str, data: bytes) -> None:
        path = self._path(key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)

    def get(self, key: str) -> bytes:
        path = self._path(key)
        try:
            with open(path, "rb") as f:
                return f.read()
        except FileNotFoundError:
            raise FileNotFoundError(key) from None

    def delete(self, key: str) -> None:
        try:
            os.remove(self._path(key))
        except FileNotFoundError:
            pass

    def url(self, key: str) -> str:
        return self._path(key)
