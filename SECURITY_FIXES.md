# SECURITY_FIXES.md

Security fixes for the code production runs. Branch `fix/security`, based on `feat/ai-router-engine-and-auth-hardening` (`bd3163c`).

## Which branch production is built from

Production's frontend on Hostinger was traced to `feat/ai-router-engine-and-auth-hardening` (2026-10-01). It is the only branch that matches everything the live site shows:
- the email sign-up form;
- the "5x more power than Pro" pricing badge;
- the Hostinger build note in `next.config.js`;
- no `/wall` and no `/admin/feedback`, matching the live 404s.

Its framework chunks also have the same content hashes as a local build of `next@16.3.5`. Render's backend runs the same branch.

**To confirm in hPanel:** which branch Hostinger builds, and whether it builds automatically or from an upload.

## Findings (2026-10-01)

**Sources:**
- `npm audit` on production's lockfile;
- `pip-audit` on the backend's installed packages;
- the live site's response headers;
- a CORS probe of the live API.

Hostinger's own list (11 items) hasn't been compared yet.

| Vulnerability | Severity | Type | Where | Fix | Status |
|---|---|---|---|---|---|
| Remote code execution in `next/og` ImageResponse ([GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j)) | Critical | Framework | `next` 16.3.5 | `next` and `eslint-config-next` 16.3.8 | **Fixed** (step 2) |
| Quadratic-time brace expansion ([GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr)) | High | Dev dependency (eslint) | `brace-expansion` 1.1.18 / 5.0.9 | `npm audit fix` → 1.1.21 / 5.0.12 | **Fixed** (step 2) |
| DOMPurify IN_PLACE hook ([GHSA-p98j-92pf-mc4p](https://github.com/advisories/GHSA-p98j-92pf-mc4p)), also reported as `monaco-editor` | Low ×2 | Dependency of the code editor | `dompurify` 3.4.15, pinned in `overrides` | pin raised to 3.4.16 | **Fixed** (step 2) |
| esbuild dev server accepts any site's requests ([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)) | Moderate ×4 | Dev-only, unused (`drizzle-kit` chain) | `drizzle-kit` 0.31.10 | removed the unused drizzle template and its packages (as in PR #11) | **Fixed** (step 3a) |
| Minerva timing attack (CVE-2024-23342) | Low here | Backend dependency | `ecdsa` 0.19.2, via `python-jose` | none released; tokens use HS256, which never calls `ecdsa` | Not exploitable; replace `python-jose` with PyJWT later |
| `X-Powered-By: Next.js` | Low | Information leak | `next.config.js` | `poweredByHeader: false` | Step 3 |
| No `Permissions-Policy`; CSP only upgrades http to https | Medium | Missing headers | `next.config.js` | add the header; CSP in report-only mode first | Steps 3 and 6 |

**`next/og` exposure:**
- `src/app/opengraph-image.tsx`, `icon.tsx` and `apple-icon.tsx` use `ImageResponse`.
- All three are built ahead of time (`○` in the build output) and take no visitor input, so the vulnerable path was most likely unreachable.
- Upgraded anyway.

**Checked and fine:**
- **CORS:** a foreign origin gets 400 and no `Access-Control-Allow-Origin`; `https://vatsaai.com` is allowed.
- **API headers:** strict CSP, `X-Frame-Options: DENY`, HSTS.
- **Git history:** no secrets (`tools/security/scan_history.py`).

## Step 2: the upgrade

**`frontend/package.json`:**
- `next` 16.3.5 → 16.3.8;
- `eslint-config-next` 16.3.5 → 16.3.8;
- `overrides.dompurify` 3.4.15 → 3.4.16.

**`frontend/package-lock.json`:** only those packages changed.
- 12 Next.js packages (`next`, `@next/env`, `@next/swc-*`, `@next/eslint-plugin-next`, `eslint-config-next`): 16.3.5 → 16.3.8.
- `dompurify` 3.4.15 → 3.4.16.
- `brace-expansion` 1.1.18 → 1.1.21 and 5.0.9 → 5.0.12.

| Check | Before | After |
|---|---|---|
| `npm audit` | 8 (1 critical, 1 high, 4 moderate, 2 low) | 4 (4 moderate, all the dev-only drizzle chain) |
| `tsc --noEmit` | clean | clean |
| `eslint .` | 10 errors, 15 warnings (existing) | the same 10 errors, 15 warnings (none new) |
| `next build --webpack` | — | OK, `Next.js 16.3.8` |
| Smoke test (`next start`) | — | `/`, `/pricing`, `/signup`, `/login`, `/privacy`, `/terms` → 200. `/code` → 307 to sign-in (as live). `/opengraph-image`, `/icon`, `/apple-icon` → 200 PNG. No console errors on `/`, `/pricing`, `/signup`, `/login`. |

**Not available on this branch:** a CI workflow, unit tests and e2e tests. The checks above are the full set that exists here.

**Rollback:** revert the step 2 commit and redeploy. No data or schema change.

## Step 3a: the unused drizzle template is gone

`frontend/src/db/` (a drizzle schema and a `pg` pool) and `frontend/drizzle.config.json` came from a starter template.
- **Nothing imports them.** `git grep` finds no `@/db`, `./db` or `pg` imports, and nothing in the scripts or configs refers to them.
- **The real database is the backend's** (SQLAlchemy).
- **Removed:**
  - the three files;
  - `drizzle-orm`, `pg` and `@types/pg` (dependencies);
  - `drizzle-kit` (dev dependency).
- **The lockfile only loses entries:** 102 package entries removed (including every per-platform esbuild binary), 0 added, 0 versions changed. The large line count in the diff comes from git reordering the JSON.

| Check | After step 2 | After step 3a |
|---|---|---|
| `npm audit` | 4 moderate | **0 vulnerabilities** |
| `tsc --noEmit` | clean | clean |
| `eslint .` | 10 errors, 15 warnings (existing) | the same |
| `next build --webpack` | OK | OK |
| Smoke test | all pages OK | `/`, `/pricing`, `/signup`, `/login`, `/privacy`, `/terms` and the three image routes → 200; `/code` → 307; no console errors on `/`, `/signup` |

**Rollback:** revert the step 3a commit; `npm ci` restores the packages.
