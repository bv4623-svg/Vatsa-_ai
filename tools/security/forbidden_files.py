#!/usr/bin/env python3
"""Blocks commits of secret-bearing files: .env files, databases, archives,
keys. Run by .githooks/pre-commit (staged files) and CI (all tracked files).

  python tools/security/forbidden_files.py --staged     # pre-commit
  python tools/security/forbidden_files.py --tracked    # CI
  python tools/security/forbidden_files.py PATH...      # ad hoc

Exit 1 with one line per problem; never prints file contents.
"""
import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from risky_paths import env_content_problems, forbidden_reason, is_env_file  # noqa: E402


def _git(*args: str) -> list[str]:
    out = subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout
    return [line for line in out.splitlines() if line]


def _read(path: str, staged: bool) -> str:
    if staged:
        return subprocess.run(["git", "show", f":{path}"], check=True, capture_output=True, text=True).stdout
    return Path(path).read_text(encoding="utf-8", errors="replace")


def check(paths: list[str], staged: bool = False) -> list[str]:
    problems = []
    for path in paths:
        reason = forbidden_reason(path)
        if reason:
            problems.append(f"{path}: {reason}")
        elif is_env_file(path):
            problems.extend(env_content_problems(path, _read(path, staged)))
    return problems


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = ap.add_mutually_exclusive_group()
    group.add_argument("--staged", action="store_true", help="check files staged for commit")
    group.add_argument("--tracked", action="store_true", help="check every tracked file")
    ap.add_argument("paths", nargs="*")
    args = ap.parse_args(argv)

    if args.staged:
        paths = _git("diff", "--cached", "--name-only", "--diff-filter=ACMR")
    elif args.tracked:
        paths = _git("ls-files")
    else:
        paths = args.paths
    problems = check(paths, staged=args.staged)
    for p in problems:
        print(f"BLOCKED  {p}", file=sys.stderr)
    if problems:
        print(f"\n{len(problems)} problem(s). Remove these files (git rm --cached <file>) "
              "and keep secrets in the host's environment settings.", file=sys.stderr)
        return 1
    print(f"OK  {len(paths)} file(s) checked, nothing secret-bearing.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
