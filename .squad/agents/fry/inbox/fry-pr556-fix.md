# Fry — PR #556 Security Fix Report

**Working as:** Fry (Full-Stack Dev)
**Branch:** `squad/483-pack-aks`
**Commit:** `bda0fb8`

## Fixes Applied

### B1 — kubectl fail-closed (`validate-manifests.ts`)
- `kubectlDryRun` return type extended with `toolMissing?: boolean`
- Catch block now detects `ENOENT` / `EACCES` from execFile and returns `{ passed: false, toolMissing: true }`
- `execute` function returns `{ valid: false, ... }` immediately when `toolMissing` — never returns `valid: true` without actual kubectl validation

### B2 — Privilege escalation coverage (`no-privileged-containers.ts`)
- Added regex check for `allowPrivilegeEscalation: true` → `kind: 'block'`
- Added DANGEROUS_CAPS set (`SYS_ADMIN`, `NET_ADMIN`, `ALL`, `SYS_PTRACE`, `SYS_MODULE`, `DAC_READ_SEARCH`) with regex scan → `kind: 'block'`
- `safeguards.json`: added `no-dangerous-capabilities` rule (high severity)

## Test Results

**Total: 29 tests, 3 files, all passing**

| File | Tests |
|------|-------|
| `validate-manifests.test.ts` | 9 (7 existing + 2 new: ENOENT + EACCES kubectl tests) |
| `no-privileged-containers.test.ts` | 8 new (clean pass, privileged, allowPrivilegeEscalation, SYS_ADMIN, NET_ADMIN, ALL, safe cap, non-k8s) |
| `validate-safeguards.test.ts` | 12 (unchanged) |

## Build
TypeScript build: ✅ clean (no errors)
