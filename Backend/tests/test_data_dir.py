"""DATA_DIR relocates everything the backend writes; unset, nothing moves."""
import os
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent

PROBE = (
    "import app.database as d, app.routers.upload as u, app.services.image_service as i;"
    "print(d.DEFAULT_DB_PATH);print(u.UPLOAD_STORAGE_ROOT);print(i.STORAGE_ROOT)"
)


def probe(data_dir):
    env = {**os.environ, "JWT_SECRET_KEY": "x" * 40}
    env.pop("DATABASE_URL", None)
    env.pop("DATA_DIR", None)
    if data_dir is not None:
        env["DATA_DIR"] = str(data_dir)
    res = subprocess.run([sys.executable, "-c", PROBE], cwd=BACKEND, env=env,
                         capture_output=True, text=True, timeout=180)
    assert res.returncode == 0, res.stderr[-800:]
    return [Path(line) for line in res.stdout.strip().splitlines()[-3:]]


def test_data_dir_moves_the_database_uploads_and_generated_images(tmp_path):
    db_path, uploads, images = probe(tmp_path)
    assert db_path == tmp_path / "vatsa.db"
    assert uploads == tmp_path / "uploads"
    assert images == tmp_path / "generated_images"


def test_without_data_dir_everything_stays_in_the_backend_folder():
    db_path, uploads, images = probe(None)
    assert db_path == BACKEND / "vatsa.db"
    assert uploads == BACKEND / "uploads"
    assert images == BACKEND / "generated_images"


def test_blank_optional_env_vars_fall_back_to_defaults(tmp_path):
    """`NAME=` (as .env.example ships them) must mean 'unset', not ''."""
    env = {**os.environ, "JWT_SECRET_KEY": "x" * 40, "DATA_DIR": str(tmp_path),
           "IMAGE_PROVIDER_URL": "", "SEARCH_CACHE_TTL_SECONDS": ""}
    env.pop("DATABASE_URL", None)
    code = ("import app.services.image_service as i, app.services.search_service as s;"
            "print(i._provider_url('cat', 1));print(s.SEARCH_CACHE_TTL_SECONDS)")
    res = subprocess.run([sys.executable, "-c", code], cwd=BACKEND, env=env, capture_output=True, text=True, timeout=180)
    assert res.returncode == 0, res.stderr[-800:]
    url, ttl = res.stdout.strip().splitlines()[-2:]
    assert url.startswith("https://") and "/cat?" in url
    assert ttl == "600"
