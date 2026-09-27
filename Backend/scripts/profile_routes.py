"""Times every read (GET) API route against a heavy, realistic account.

Seeds one user into a throwaway SQLite database with:
  200 conversations x 40 messages (~600 chars each), 400 library items,
  50 projects, 50 scheduled tasks, 150 memories and 200 notifications,
then calls each GET route through the real app (auth, DB, serialisation) and
reports the median of 5 runs plus response size. Routes slower than the
budget (default 500 ms) are flagged and the exit code is 1.

    python scripts/profile_routes.py [--budget-ms 500] [--json out.json]

No network: OAuth redirect/callback routes and provider-backed routes are
skipped (listed in SKIPPED with the reason).
"""
import argparse
import json
import os
import random
import statistics
import sys
import tempfile
import time
import uuid

_tmp = tempfile.mkdtemp(prefix="vatsa-profile-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/profile.db"
os.environ["DATA_DIR"] = _tmp
os.environ.setdefault("JWT_SECRET_KEY", "profile-secret-not-used-elsewhere")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models.chat_project import ChatProject  # noqa: E402
from app.models.conversation import Conversation  # noqa: E402
from app.models.library_item import LibraryItem  # noqa: E402
from app.models.memory import Memory  # noqa: E402
from app.models.notification import Notification  # noqa: E402
from app.models.scheduled_task import ScheduledTask  # noqa: E402
from app.models.user import User  # noqa: E402

PASSWORD = "profile-password-123"
CONVERSATIONS, MESSAGES_PER_CONV, MESSAGE_CHARS = 200, 40, 600

SKIPPED = {
    "OAuth redirects/callbacks": "need a real provider round trip",
    "/api/admin/payments": "admin-only",
    "/api/library/share/{token}*": "public share links; covered by tests/test_library.py",
    "/api/account/connections/{provider}/start": "OAuth redirect",
}


def seed(db):
    user = User(
        email="heavy@example.com", username="heavy", full_name="Heavy User",
        hashed_password=bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode(),
        is_active=True, is_verified=True, tier="pro",
    )
    db.add(user)
    db.commit()
    # Varied text from a 2,000-word vocabulary (fixed seed), so compression
    # ratios resemble real chat rather than a repeated phrase.
    rng = random.Random(42)
    vocab = ["".join(rng.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(rng.randint(2, 10))) for _ in range(2000)]

    def text():
        words, n = [], 0
        while n < MESSAGE_CHARS:
            w = rng.choice(vocab)
            words.append(w)
            n += len(w) + 1
        return " ".join(words)[:MESSAGE_CHARS]

    for c in range(CONVERSATIONS):
        msgs = [{"role": "user" if i % 2 == 0 else "assistant", "content": text(), "timestamp": "2026-09-01T00:00:00Z"} for i in range(MESSAGES_PER_CONV)]
        db.add(Conversation(id=f"conv_{c:04d}", user_id=user.id, title=f"Conversation {c}", workspace="chat" if c % 4 else "code", messages=msgs))
    projects = [ChatProject(id=str(uuid.uuid4()), user_id=user.id, name=f"Project {i}", description="d", system_prompt="s", instructions="i") for i in range(50)]
    db.add_all(projects)
    db.add_all(LibraryItem(id=str(uuid.uuid4()), user_id=user.id, type="upload", name=f"file-{i}.pdf", size_bytes=10_000 + i, mime="application/pdf", tags=[]) for i in range(400))
    db.add_all(ScheduledTask(id=str(uuid.uuid4()), user_id=user.id, title=f"Task {i}", prompt="p", schedule="0 9 * * *") for i in range(50))
    db.add_all(Memory(user_id=user.id, content=f"The user prefers option {i}") for i in range(150))
    db.add_all(Notification(id=str(uuid.uuid4()), user_id=user.id, type="info", title=f"Notice {i}", message="m") for i in range(200))
    db.commit()
    return user.email, projects[0].id


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget-ms", type=float, default=500)
    ap.add_argument("--runs", type=int, default=5)
    ap.add_argument("--json", dest="json_out")
    args = ap.parse_args()

    with TestClient(app) as client:
        db = SessionLocal()
        email, project_id = seed(db)
        db.close()
        token = client.post("/auth/login", json={"email": email, "password": PASSWORD}).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        paths = app.openapi()["paths"]
        concrete = {"{conv_id}": "conv_0000", "{project_id}": project_id}
        targets = []
        for path, ops in sorted(paths.items()):
            if "get" not in ops:
                continue
            if any(k in path for k in ("/login", "/callback", "/start", "/share/", "/admin/", "{image_id}", "{item_id}", "{intent_name}", "/docs", "/redoc")):
                continue
            for k, v in concrete.items():
                path = path.replace(k, v)
            targets.append(path)

        rows = []
        for path in targets:
            client.get(path, headers=headers)  # warm-up
            times, size, status = [], 0, 0
            for _ in range(args.runs):
                t0 = time.perf_counter()
                res = client.get(path, headers={**headers, "Accept-Encoding": "identity"})
                times.append((time.perf_counter() - t0) * 1000)
                size, status = len(res.content), res.status_code
            with client.stream("GET", path, headers={**headers, "Accept-Encoding": "gzip"}) as res:
                wire = sum(len(chunk) for chunk in res.iter_raw())
            rows.append({"path": path, "status": status, "median_ms": round(statistics.median(times), 1), "max_ms": round(max(times), 1), "bytes": size, "wire_bytes_gzip": wire})

    rows.sort(key=lambda r: -r["median_ms"])
    print(f"{'route':45} {'status':>6} {'median ms':>10} {'max ms':>8} {'bytes':>11} {'gzip wire':>11}")
    for r in rows:
        flag = "  <-- over budget" if r["median_ms"] > args.budget_ms else ""
        print(f"{r['path']:45} {r['status']:>6} {r['median_ms']:>10} {r['max_ms']:>8} {r['bytes']:>11,} {r['wire_bytes_gzip']:>11,}{flag}")
    print(f"\n{len(rows)} routes timed; seeded {CONVERSATIONS} conversations x {MESSAGES_PER_CONV} messages. Skipped: " + "; ".join(f"{k} ({v})" for k, v in SKIPPED.items()))
    if args.json_out:
        with open(args.json_out, "w") as f:
            json.dump(rows, f, indent=2)
    return 1 if any(r["median_ms"] > args.budget_ms for r in rows) else 0


if __name__ == "__main__":
    sys.exit(main())
