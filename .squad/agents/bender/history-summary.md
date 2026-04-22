# Bender Session History Summary

**Agent:** Bender (Implementation, Backend, Hotfix)
**Span:** 2026-04-01 (earliest session) → 2026-04-22 (latest)
**Total sessions in archive:** 17 (bender-1 through bender-17)
**Status:** Latest: Production hotfix incident #1041 resolved (PRs #1051, #1052 merged)

---

## Major Workstreams

### 1. Observability & AppInsights Pipeline (PR #1030, #1034) [MERGED]

- Comprehensive OTel/AppInsights migration: replaced classic `applicationinsights` with `@azure/monitor-opentelemetry`
- Externalization strategy: bundled in `packages/web/api/node_modules/`, externalized via esbuild, verified in CI
- T1–T12 binding test matrix for handler-level trace/span bridging
- Redaction pipeline: `RedactingSpanExporter` + `RedactingLogRecordProcessor` (Proxy pattern)
- Final size: PR #1034 merged with 1119/1119 tests passing, zero lint errors
- **Key learning:** Externalizing OTel for Functions is a deployment hazard — bundling is safer

### 2. Production Incident #1041 — SWA 404 Revert & Guard Inversion [MERGED]

- **bender-16:** Implemented PR #1051 — reverted #1030 OTel externalization, restored bundle-inline strategy
  - Deleted materialize scripts, moved workspace deps to devDependencies
  - 8 evidence gates passed; smoke check validated
  - Root cause: Azure SWA server-side `npm install` overwrites materialized packages when workspace deps are in runtime `dependencies`
- **bender-17:** Hotfix PR #1052 — inverted CI regression guard to match new contract
  - Guard assertion flipped from "OTel externals exist" to "OTel externals do NOT exist + bundled code present"
  - Established rule: When contracts change, invert guards; never delete them
  - Production verified 05:40 UTC (deploy run 24762235453)

### 3. Episodic Task Completions

- **bender-13:** .funcignore curation (attempted safety improvement, disproven by post-mortem)
- **bender-14:** PR #1046 OTel CI check (added `@opentelemetry/api` assertion)
- **bender-15:** Forensic investigation of 404 (empirical evidence chain leading to root cause identification)

---

## Technical Insights Captured

1. **SWA Deploy Hazard:** Server-side `npm install` runs post-upload regardless of `skip_api_build` flag. Only safe if all `dependencies` are public npm packages or bundles are self-contained.
2. **Workspace Packages in Dependencies:** Critical hazard — they resolve locally via npm workspace symlinks but fail on registry fetches. Must move to `devDependencies` or delete.
3. **Regression Guards as Contracts:** Guards must be inverted when build contracts change, not deleted. Inversion preserves intent while reflecting new architecture.
4. **Module-Load Side Effects:** Unconditional IIFEs at import time are deployment landmines. Module-level throws cascade to worker startup failure.
5. **Bundling vs. Externalization:** For SWA Functions, bundling everything provides deployment immunity. Externalization couples code to post-deploy install behavior (unreliable).

---

## Latest Status (2026-04-22)

✅ Production 404 incident resolved
✅ Root cause documented
✅ Regression guards updated
✅ Follow-up issues filed (#1049, #1040, #1050)
✅ Decision log captured
✅ Team history updated

**Next:** Implementation of follow-ups #1049 (deploy gate), #1040 (OTel stacktrace), #1050 (schema validation).

