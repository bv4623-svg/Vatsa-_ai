"""Tests for the secret guards, run against throwaway git repositories."""
import io
import os
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from risky_paths import env_content_problems, forbidden_reason  # noqa: E402


@pytest.mark.parametrize("path", [
    ".env", "Backend/.env", "frontend/.env.local", "x/.env.production.local", "Backend\\.env",
    "vatsa.db", "data/app.sqlite3", "site.zip", "backup.tar.gz", "certs/server.pem", "tls.key",
    "id_rsa", "id_ed25519.pub", ".npmrc", "store.p12",
])
def test_forbidden_names(path):
    assert forbidden_reason(path)


@pytest.mark.parametrize("path", [
    "Backend/.env.example", "frontend/.env.example", "frontend/.env.production",
    "README.md", "app/models/api_key.py", "src/components/settings/tabs/ApiKeysTab.tsx", "keyboard.ts",
])
def test_allowed_names(path):
    assert forbidden_reason(path) is None


def test_example_env_secret_values_must_be_empty():
    assert env_content_problems("Backend/.env.example", "JWT_SECRET_KEY=\nEMAIL_PASSWORD=\nHOST=smtp.example.com\n") == []
    problems = env_content_problems("Backend/.env.example", "# c\nOPENROUTER_API_KEY=sk-or-v1-abc\nexport DB_PASSWORD='x'\n")
    assert len(problems) == 2 and "OPENROUTER_API_KEY" in problems[0]


def test_public_frontend_env_only_next_public():
    assert env_content_problems("frontend/.env.production", "NEXT_PUBLIC_API_URL=https://x\n") == []
    assert env_content_problems("frontend/.env.production", "RAZORPAY_KEY_SECRET=abc\n")


# ---- end-to-end against temporary repositories ------------------------------------

def _git(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True).stdout


@pytest.fixture()
def repo(tmp_path):
    _git(tmp_path, "init", "-q", "-b", "main")
    _git(tmp_path, "config", "user.email", "t@example.com")
    _git(tmp_path, "config", "user.name", "t")
    _git(tmp_path, "config", "commit.gpgsign", "false")
    (tmp_path / "README.md").write_text("hi\n")
    _git(tmp_path, "add", ".")
    _git(tmp_path, "commit", "-q", "-m", "init")
    return tmp_path


def _run(tool, repo, *args):
    env = {k: v for k, v in os.environ.items() if k != "GITLEAKS"}
    env["PATH"] = "/usr/bin:/bin"  # no gitleaks: exercise the name-based checks only
    return subprocess.run([sys.executable, str(HERE / tool), *args], cwd=repo, capture_output=True, text=True, env=env)


def test_pre_commit_check_blocks_staged_env_and_db(repo):
    (repo / "Backend").mkdir()
    (repo / "Backend" / ".env").write_text("OPENROUTER_API_KEY=sk-or-v1-" + "a" * 64 + "\n")
    (repo / "app.db").write_bytes(b"SQLite format 3\x00")
    _git(repo, "add", "-f", ".")
    res = _run("forbidden_files.py", repo, "--staged")
    assert res.returncode == 1
    assert "Backend/.env" in res.stderr and "app.db" in res.stderr
    assert "sk-or-v1" not in res.stderr + res.stdout, "must never print file contents"


def test_pre_commit_check_blocks_filled_in_example(repo):
    (repo / ".env.example").write_text("JWT_SECRET_KEY=real-looking-value\n")
    _git(repo, "add", ".")
    res = _run("forbidden_files.py", repo, "--staged")
    assert res.returncode == 1 and "JWT_SECRET_KEY must be empty" in res.stderr


def test_pre_commit_check_passes_clean_changes(repo):
    (repo / "main.py").write_text("print(1)\n")
    (repo / ".env.example").write_text("JWT_SECRET_KEY=\n")
    _git(repo, "add", ".")
    assert _run("forbidden_files.py", repo, "--staged").returncode == 0


def test_history_scan_finds_env_inside_zip_even_after_deletion(repo):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("Backend\\.env", "SECRET=1")
        inner = io.BytesIO()
        with zipfile.ZipFile(inner, "w") as zi:
            zi.writestr("data/vatsa.db", "x")
        z.writestr("Backend/debug.zip", inner.getvalue())
        z.writestr("src/app.py", "print(1)")
    (repo / "site.zip").write_bytes(buf.getvalue())
    _git(repo, "add", "-f", "site.zip")
    _git(repo, "commit", "-q", "-m", "add archive")
    _git(repo, "rm", "-q", "site.zip")
    _git(repo, "commit", "-q", "-m", "remove archive")  # gone from the tree, not from history

    res = _run("scan_history.py", repo)
    assert res.returncode == 1
    assert "site.zip" in res.stdout
    assert "site.zip -> Backend/.env" in res.stdout
    assert "Backend/debug.zip!data/vatsa.db" in res.stdout
    assert "src/app.py" not in res.stdout
    assert "SECRET=1" not in res.stdout, "must never print archive contents"


def test_history_scan_clean_repo_passes(repo):
    res = _run("scan_history.py", repo)
    assert res.returncode == 0, res.stdout + res.stderr
    assert "Secret-bearing files ever added: 0" in res.stdout


def test_history_baseline_tolerates_known_but_fails_new(repo):
    import json
    (repo / "old.db").write_bytes(b"x")
    _git(repo, "add", "-f", "old.db")
    _git(repo, "commit", "-q", "-m", "old leak")
    old = _git(repo, "rev-parse", "HEAD").strip()
    baseline = repo / "baseline.json"
    baseline.write_text(json.dumps({"known": [{"commit": old[:12], "path": "old.db"}]}))
    ok = _run("scan_history.py", repo, "--baseline", str(baseline))
    assert ok.returncode == 0, ok.stdout
    assert "[KNOWN, pending purge]" in ok.stdout

    (repo / ".env").write_text("A=1")
    _git(repo, "add", "-f", ".env")
    _git(repo, "commit", "-q", "-m", "new leak")
    bad = _run("scan_history.py", repo, "--baseline", str(baseline))
    assert bad.returncode == 1
    assert "[NEW]" in bad.stdout and ".env" in bad.stdout
