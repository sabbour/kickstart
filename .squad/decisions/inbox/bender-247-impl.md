# Decision: Zod v4 migration PR #247 — implementation scope and approach

**Author:** Bender (backend)  
**Date:** 2026-04-28  
**Ceremony:** bender-impl-247

## Decision

Bender implemented the full Zod v4 migration for issue #247, including harness scope expansion (per Nibbler's DR flag), web schema callers, and the zod-to-json-schema → z.toJSONSchema() transition.

## What was included (cross-domain)

1. `packages/web/src/vendor/a2ui/web_core/basic_catalog/functions/basic_functions_api.ts` — v4-native numeric/string coerce helpers
2. `packages/pack-core/src/skills/gen-gha-workflow/schema.ts` — TriggerSchema union+transform+pipe
3. `packages/harness/src/types/a2ui.ts` — 5 callsites, INCLUDED per Nibbler's "fail-loud on regression" guidance
4. `packages/web/api/src/functions/packs.ts` and `message-processor.ts` — zodToJsonSchema → z.toJSONSchema()
5. Root overrides.zod pinned to 4.3.6; bridge deps dropped from web + pack-core

## What is deferred (Kif)

- `.github/workflows/` CI guardrail (no workflows scope on backend token)
- `.squad/skills/zod-monorepo-split/SKILL.md` skill correction (Nibbler noted z.preprocess still exists in v4)

## Key findings

- `zod-to-json-schema@3.25.x` produces empty schema `{"$schema":"..."}` for Zod v4 schemas (internal `_def.typeName` is gone in v4). Migration to `z.toJSONSchema()` is mandatory for correctness, not optional.
- JSON schema format changes from draft-07 to draft/2020-12 by default. For A2UI message-processor, `target: 'draft-2019-09'` used to preserve draft-2019-09 compatibility.
- `TriggerSchema` input type narrowing (unknown → string | string[]) is a minor breaking TS change — documented in changeset.
- All 3 pre-existing failing tests (`appinsights.test.ts`, `schema-conformance.test.ts`, `basic-components.test.tsx`) are unrelated to Zod changes (missing `@opentelemetry/api-logs` dep and React Testing Library issues).
