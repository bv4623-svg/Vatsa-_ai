"""Turn a leaked .env file into one-way fingerprints for the startup check.

    <leaked .env on stdin> | python scripts/fingerprint_leaked_env.py [--merge FILE]

Reads KEY=VALUE lines from stdin and prints JSON with, for every non-empty
secret-looking value, its variable name and scrypt fingerprint
(app.core.secrets_check.fingerprint). Values are never printed or stored.
With --merge, the result is merged into the given fingerprints file.
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.core.secrets_check import SECRET_VARS, fingerprint  # noqa: E402

SECRETISH = re.compile(r"(SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE|API_KEY|_KEY$|^KEY$|DATABASE_URL)", re.I)
NOT_SECRET = {"ACCESS_TOKEN_EXPIRE_MINUTES", "JWT_ALGORITHM"}


def parse(text: str):
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.replace("export ", "").strip()
        value = value.strip().strip('"').strip("'")
        if value and name not in NOT_SECRET and (name in SECRET_VARS or SECRETISH.search(name)):
            yield name, value


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--merge", type=Path)
    args = ap.parse_args()
    found = {}
    for name, value in parse(sys.stdin.read()):
        found.setdefault(name, set()).add(fingerprint(value))
    if args.merge:
        existing = json.loads(args.merge.read_text()) if args.merge.exists() else {}
        fps = existing.setdefault("fingerprints", {})
        for name, new in found.items():
            fps[name] = sorted(set(fps.get(name, [])) | new)
        args.merge.write_text(json.dumps(existing, indent=2, sort_keys=True) + "\n")
    else:
        json.dump({"fingerprints": {k: sorted(v) for k, v in found.items()}}, sys.stdout, indent=2, sort_keys=True)
        print()
    print(f"{sum(len(v) for v in found.values())} fingerprint(s) for: {', '.join(sorted(found)) or 'nothing'}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
