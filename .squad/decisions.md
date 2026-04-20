# Decision: keep a temporary `@kickstart/core` compatibility seam during v2 Step 1

**Date:** 2026-04-17T12:06:45.293Z
**Author:** Bender (Backend Dev)
**Issue:** #474

## Decision

Treat `packages/harness/` as the canonical Step 1 stub surface, but keep a temporary `@kickstart/core` compatibility seam until import/path-map fallout is fully absorbed. The seam is compile-preservation only; it must not become a new long-term runtime contract.

## Why

Keeps the delete-first slice surgical. Lets Fry and Bender split work cleanly: Fry preserves the UI shell while Bender removes backend/runtime v1 code and stabilizes package wiring.

## Consequences

- Step 1 can delete aggressively without breaking TypeScript on the first file removal.
- Step 2+ must explicitly burn down remaining `@kickstart/core` imports and remove the seam once harness/pack surfaces are real.

---

# Decision: cut backend packages directly to `@kickstart/harness` in Step 1

**Date:** 2026-04-17T12:06:45.293Z
**Author:** Bender (Backend Dev)
**Issue:** #474

## Decision

Move the backend-owned package graph straight to `@kickstart/harness` in Step 1: source imports, tsconfig path maps, esbuild aliases, and root build scripts all target harness directly. Keep the temporary `@kickstart/core` package only for preserved web-shell fallout until Fry finishes that cleanup.

## Why

Shrinks the compatibility seam without widening it. Lets Step 2 work against the real harness package boundary.

## Consequences

- Backend runtime no longer depends on the temporary compatibility package.
- Dead SDK/route-planner adapter files can be deleted fail-closed with the converse stub in place.
- Remaining `@kickstart/core` imports are a shell-cleanup problem, not a backend package-graph blocker.

---

# Zapp Decision — DP #474 Step 1 compatibility seam security

**Date:** 2026-04-17T12:06:45.293Z
**Author:** Zapp (Security Architect)
**Issue:** #474
**Status:** APPROVE WITH CONDITIONS

## Decision

The Step 1 delete-first migration is security-positive only if it remains a shrink-only change to reachable runtime surface. A temporary `@kickstart/core` → `packages/harness` compatibility seam is acceptable as a compile-preserving shim with no new behavior.

## Required Conditions

1. The compatibility seam is compile-only and time-bounded to Step 1; no new exports, fallback logic, or side effects may be introduced there.
2. Deleting v1 helpers must fail closed — no silent fallback to demo, mock, or legacy paths.
3. All v1 feature flags and step gates must be removed entirely.
4. Existing secret/auth trust boundaries must not move client-side during file preservation or rename work.
5. Step 1 merge requires proof that deleted module imports are gone and preserved packages did not gain broader runtime access.

---

# Zapp Decision — DP #475 Harness Types Security Review

**Date:** 2026-04-17
**Author:** Zapp (Security Architect)
**Issue:** #475
**Status:** APPROVE_WITH_CONDITIONS
**DP Comment:** https://github.com/sabbour/kickstart/issues/475#issuecomment-4268038324

## Findings

1. **Fail-closed schema behavior must be explicit.** `AgentOutput` and every nested A2UI object should reject unknown fields, not strip or pass them through.
2. **Hybrid A2UI messages must be impossible.** A payload mixing `createSurface` with `deleteSurface` must fail validation outright — exactly one operation per message.
3. **`SessionCtx` is too broad.** Raw identity (`upn`, `tid`, `oid`) and secret-returning helpers (`getGithubToken`) create unnecessary exposure. Default context should be least-privilege.
4. **Compile-only needs enforcement, not just intent.** A static/CI check should lock in the absence of `eval`, `new Function`, or dynamic loading.
5. **Transport-valid A2UI is not yet trusted A2UI.** Negotiated-catalog validation must remain mandatory before render/SSE trust.

## Required Conditions

1. `AgentOutput` uses a strict top-level schema; `intent` is a closed enum.
2. All A2UI message schemas are strict at every object layer.
3. A2UI union enforces one-and-only-one operation key.
4. `SessionCtx` is narrowed/redacted; credential access is capability-scoped.
5. CI/static checks enforce compile-only boundary and reject dynamic code-loading/execution primitives.
6. Later runtime steps must treat catalog validation as a second mandatory gate, not optional hardening.

## Outcome

Security gate is conditionally clear. Conditions must be reflected in Step 2 acceptance criteria and verified in tests.

---

# Zapp Security Review — #476 v2 Step 3: Registry + loaders

**Date:** 2026-04-17
**Author:** Zapp (Security Architect)
**Issue:** #476
**Verdict:** APPROVE_WITH_CONDITIONS
**DP comment:** https://github.com/sabbour/kickstart/issues/476#issuecomment-4268049161

## Summary

Startup-only registry model is directionally sound and `seal()` is the right control surface. Key risks: namespace squatting across packs, unrestricted cross-pack tool/user-action references, unsafe YAML expansion, mutable post-seal registry state, and path escape in file-backed loaders.

## Required Conditions

1. **Pack-owned names only.** Every contribution name validated against owning pack before indexing (agents/tools: `${pack.name}.…`, user actions: `${pack.name}:…`, components/skills: `${pack.name}/…`).
2. **Dependency-scoped reference resolution.** Agent allowlists may reference only same-pack contributions plus declared transitive dependencies. Reject wire names like `pack__action`; only canonical `:` names valid in frontmatter.
3. **Frontmatter parser hardening.** If upgrading to a general YAML library: safe parsing only, no custom tags/functions, bounded aliases, bounded frontmatter/file size, schema validation immediately after parse.
4. **Loader path confinement.** Canonicalize `agentsDir`/`skillsDir` with `realpath`-equivalent checks, reject symlink escapes, ensure every loaded file remains under pack root.
5. **Seal must be immutable.** After `seal()`, no external code may mutate registry indexes through returned arrays/maps. Snapshot/freeze exported views; fail closed on concurrent lifecycle misuse.
6. **Cycle detection must be iterative.** Bounded graph walk (iterative DFS or Kahn) with visited/in-progress tracking.

## Security consequence

With conditions above, Step 3 remains acceptable as design foundation for Step 4. Without them, the registry becomes a trust-boundary weak point.
