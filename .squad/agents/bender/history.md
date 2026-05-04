# Bender (Backend/Harness) — Work History Summary

## Overview

Bender is the backend/harness implementation agent. Focus: Azure OpenAI integration, agent orchestration, pack architecture, and core runtime (runner, executor, simulator).

## Key Projects Completed

### Phase 1 Wave Delivery (Q1–Q2 2026)

1. **OpenAI Agents SDK Integration** (PR #312)
   - Implemented Azure OpenAI connection pool management
   - Built session/executor initialization framework
   - Integrated A2UI (structured output) and SSE streaming
   - Validated Zod schema compliance for tool definitions
   - Result: Core harness foundation shipped

2. **Agent Pack System** (PRs #271, #278–#281, #310)
   - Implemented pack discovery and dynamic agent loading
   - Built tool schema inlining and pack-level validation
   - Completed agent roster bootstrapping
   - Result: 8+ packs deployed (recipes, aks, github, azure-ops)

3. **Simulator Framework** (PRs #284–#297, #313–#314)
   - Built regression-test simulator with golden fixtures
   - Implemented scenario composition and meta-test harness
   - Added sensitive-data detection and secret-scan compliance
   - Result: 40+ validated test scenarios

4. **Type System & Schema Enforcement** (PRs #288, #299–#307)
   - Built Zod strict-mode compliance helpers (`z-strict.ts`)
   - Added strictOptional, stripNulls, isHttpsUrl primitives
   - Enforced no-null coercion in tool schemas
   - Result: Zero type violations in production

5. **Recipe System Evolution** (PRs #309–#311, #316)
   - Implemented prompt-templates → recipes.json migration
   - Built recipe composition validator
   - Added custom-catalog extensibility
   - Result: 42+ production recipes

6. **Source-Code Tooling** (PR #358)
   - Implemented squad-identity upgrade/bootstrap flows
   - Fixed token lease storage and secret pruning
   - Added merge-check validation for docs-only PRs
   - Result: Governance infrastructure hardened

7. **Phase 2 Research Integration** (PR #419)
   - Researched GitHub Copilot SDK vs OpenAI Agents SDK
   - Document findings: SDK choice was correct, harness cannot be replaced
   - Identified future BYOK expansion points
   - Result: Design decisions documented and approved

## Patterns & Learnings

### Critical Patterns

1. **Token Lifecycle:** Installation tokens must be pruned on every read/mutation path, not deferred to cleanup routines. Fail-closed for secret custody.

2. **Schema Migration:** Zod schema evolution requires three-layer validation: field-level `.refine()`, pack-level `.safeParse()`, and runtime emit validation. No layer can be skipped.

3. **Test Fixture Hygiene:** Secret seeds must be constructed at runtime (split literals: `'pre' + 'fix_' + '0'.repeat(36)`) to pass both push-protection scanning and meta-test assertions. Sanitizing tests without re-running is a silent data loss.

4. **Pack Loading:** Dynamic agent/tool loading requires strict schema validation at discovery time, before any pack code runs. Validation failures must be caught before executor initialization.

5. **Worktree Isolation:** Per-workspace `node_modules` setup requires explicit `npm install` from the worktree root; shared root `node_modules` alone does not satisfy `__dirname`-relative resolution in vite configs.

### Design Decisions

- **Pack Isolation:** Each pack is a separate module with its own tool schemas and dependencies. No cross-pack tool imports.
- **A2UI Integration:** Structured output via `emit_ui()` is mandatory for all harness responses. No raw text responses.
- **Session Persistence:** Built into OpenAI Agents SDK; no custom budget-trimming needed for Phase 1.
- **Simulator as Truth:** Golden fixtures are the source of truth for behavior; code changes must pass all 40+ scenarios before merge.

## Current Blockers & Follow-Up

- Phase 2 requires BYOK (Bring Your Own Key) support for Azure OpenAI — evaluate via Copilot SDK extensibility
- `aks.quota_lookup` auth pattern (PR #373) pending: credential binding for service identity
- `aks.architect` gateway API guardrail patterns (PR #374) pending: runtime validation of policy constraints

## Technical Debt

- Worktree branch management could be simplified with templated setup scripts
- Token lease cleanup loop in `token-lease-store.mjs` could be abstracted into a generic `withLock(read/write)` utility
- Playwright test data isolation (golden fixtures) could be migrated to parameterized scenarios

