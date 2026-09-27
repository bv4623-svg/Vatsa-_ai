#!/usr/bin/env python3
"""Audits the ENTIRE git history (every branch and tag) for secrets.

1. Every file ever added, on any ref, whose name is secret-bearing
   (.env, databases, archives, keys), with the commit that added it.
2. Inside every archive ever committed (.zip, .tar, .tar.gz, .tgz): the
   names of secret-bearing members. Contents are never extracted or shown.
3. gitleaks over all refs, redacted (if gitleaks is installed or $GITLEAKS
   points at it); findings listed in .gitleaksignore are reviewed false
   positives and don't count.

  python tools/security/scan_history.py            # report, exit 1 on findings
  python tools/security/scan_history.py --json     # machine-readable
  python tools/security/scan_history.py --baseline tools/security/history-baseline.json
      # known findings (already scheduled for purge, see SECURITY_ACTIONS.md)
      # are reported but don't fail; anything new does. CI runs this.

Run from the repository root. A shallow clone is reported as incomplete;
fetch full history first: git fetch --unshallow --all
"""
import argparse
import io
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from risky_paths import forbidden_reason, normalise  # noqa: E402

ARCHIVE_SUFFIXES = (".zip", ".tar", ".tar.gz", ".tgz")


def git(*args: str, binary: bool = False):
    res = subprocess.run(["git", *args], check=True, capture_output=True, text=not binary)
    return res.stdout


def added_files() -> list[dict]:
    """(commit, date, path) for every file addition on every ref."""
    out = git("log", "--all", "--diff-filter=A", "--name-only", "--format=@@%H %ad", "--date=short")
    rows, commit, date = [], None, None
    for line in out.splitlines():
        if line.startswith("@@"):
            commit, date = line[2:].split(" ", 1)
        elif line.strip():
            rows.append({"commit": commit, "date": date, "path": line.strip()})
    return rows


def archive_members(data: bytes, path: str, depth: int = 0) -> list[str]:
    """Member names, recursing into nested archives (shown as outer!inner).
    Only names are read; nothing is extracted to disk or printed."""
    names: list[str] = []
    try:
        if path.lower().endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                for info in z.infolist():
                    names.append(info.filename)
                    if depth < 3 and normalise(info.filename).lower().endswith(ARCHIVE_SUFFIXES):
                        names += [f"{info.filename}!{n}" for n in archive_members(z.read(info), info.filename, depth + 1)]
        else:
            with tarfile.open(fileobj=io.BytesIO(data)) as t:
                for member in t.getmembers():
                    names.append(member.name)
                    if depth < 3 and member.isfile() and member.name.lower().endswith(ARCHIVE_SUFFIXES):
                        inner = t.extractfile(member)
                        if inner:
                            names += [f"{member.name}!{n}" for n in archive_members(inner.read(), member.name, depth + 1)]
    except (zipfile.BadZipFile, tarfile.TarError):
        names.append("<unreadable archive>")
    return names


def refs_containing(commit: str) -> list[str]:
    out = git("branch", "-a", "--contains", commit, "--format=%(refname:short)")
    return [r for r in out.splitlines() if r]


def run_gitleaks() -> dict:
    exe = os.environ.get("GITLEAKS") or shutil.which("gitleaks")
    if not exe:
        return {"ran": False, "reason": "gitleaks not installed (set $GITLEAKS or put it on PATH)", "findings": []}
    with tempfile.TemporaryDirectory() as tmp:
        report = Path(tmp) / "report.json"
        subprocess.run(
            [exe, "git", "--no-banner", "--redact", "--log-opts=--all", "--report-format", "json",
             "--report-path", str(report), "--exit-code", "0", "."],
            check=True, capture_output=True, text=True,
        )
        findings = json.loads(report.read_text() or "[]")
    return {
        "ran": True,
        "findings": [
            {"rule": f["RuleID"], "file": f["File"], "line": f["StartLine"], "commit": f["Commit"][:12],
             "fingerprint": f["Fingerprint"]}
            for f in findings
        ],
    }


def scan() -> dict:
    shallow = git("rev-parse", "--is-shallow-repository").strip() == "true"
    risky_files, risky_members = [], []
    for row in added_files():
        reason = forbidden_reason(row["path"])
        if reason:
            risky_files.append({**row, "reason": reason, "refs": refs_containing(row["commit"])})
        if row["path"].lower().endswith(ARCHIVE_SUFFIXES):
            data = git("cat-file", "blob", f"{row['commit']}:{row['path']}", binary=True)
            for member in archive_members(data, row["path"]):
                m_reason = forbidden_reason(member.rsplit("!", 1)[-1])
                if m_reason:
                    risky_members.append({"archive": row["path"], "commit": row["commit"], "member": normalise(member),
                                          "reason": m_reason})
    return {
        "shallow_clone": shallow,
        "commits_scanned": int(git("rev-list", "--all", "--count").strip()),
        "risky_files": risky_files,
        "risky_archive_members": risky_members,
        "gitleaks": run_gitleaks(),
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--baseline", help="JSON file of known findings that are pending purge")
    args = ap.parse_args(argv)
    result = scan()
    known = set()
    if args.baseline:
        base = json.loads(Path(args.baseline).read_text())
        known = {(k["commit"][:12], k["path"]) for k in base.get("known", [])}
    for r in result["risky_files"]:
        r["known"] = (r["commit"][:12], r["path"]) in known
    for m in result["risky_archive_members"]:
        m["known"] = (m["commit"][:12], f"{m['archive']} -> {m['member']}") in known
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"Commits scanned (all refs): {result['commits_scanned']}")
        if result["shallow_clone"]:
            print("WARNING: shallow clone, history incomplete. Run: git fetch --unshallow --all")
        print(f"\nSecret-bearing files ever added: {len(result['risky_files'])}")
        for r in result["risky_files"]:
            tag = "KNOWN, pending purge" if r["known"] else "NEW"
            print(f"  [{tag}] {r['commit'][:12]} {r['date']}  {r['path']}  ({r['reason']}; on: {', '.join(r['refs']) or 'no branch'})")
        print(f"\nSecret-bearing members inside archives: {len(result['risky_archive_members'])}")
        for m in result["risky_archive_members"]:
            tag = "KNOWN, pending purge" if m["known"] else "NEW"
            print(f"  [{tag}] {m['commit'][:12]}  {m['archive']} -> {m['member']}")
        gl = result["gitleaks"]
        if gl["ran"]:
            print(f"\ngitleaks findings (not in .gitleaksignore): {len(gl['findings'])}")
            for f in gl["findings"]:
                print(f"  {f['commit']}  {f['file']}:{f['line']}  {f['rule']}")
        else:
            print(f"\ngitleaks: skipped ({gl['reason']})")
    new = [r for r in result["risky_files"] if not r["known"]] + [m for m in result["risky_archive_members"] if not m["known"]]
    dirty = new or result["gitleaks"]["findings"] or result["shallow_clone"]
    if not args.json:
        print(f"\nResult: {'FAIL' if dirty else 'OK'} ({len(new)} new secret-bearing item(s), "
              f"{len(result['gitleaks']['findings'])} gitleaks finding(s))")
    return 1 if dirty else 0


if __name__ == "__main__":
    sys.exit(main())
