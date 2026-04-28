# `config/` — Data extracted from agent prompts

**Status:** Phase 1.5 deliverable. **Not yet wired into runtime** — these files are *bootstrap data* for Phase 3 ingestion.

---

## What lives here

| File | Source of truth (today) | Purpose |
|---|---|---|
| `tracks.json` | Hardcoded "four tracks" table + `pick_track` handler in `core.triage` agent prompt | Defines the application tracks the triage agent routes between, with triggers, handoff targets, and per-track requirement-gathering rules |
| `inference-backends.json` | `select_inference` handler in `core.triage` agent prompt | Defines the three inference backends for `agentic_app` — Foundry, KAITO on AKS, generic endpoint — with question policies and handoff paths |
| `handoff-rules.json` | `handoffs:` and `asTools:` arrays in every agent's frontmatter | **Extracted (verbatim)** mirror of the coordination wiring currently implemented in agent prompts. Every entry carries `provenance: "extracted"`. (Issue #207) |
| `handoff-rules.proposed.json` | Phase 1 framework docs + Phase 1.6 simulation findings | **Proposed** wiring not yet present in agent frontmatter — track-to-handoff routing, agent-change recommendations, and known wiring gaps. Every entry carries `provenance: "proposed"` (or `"derived"`) plus a `source` citation. Phase 2 implementation MAY land any subset; this file documents intent. (Issue #207) |
| `microsoft-skills.json` | Section 9.1 of `phase1-aks-automatic-grounding.md` | Intent → Microsoft Copilot for Azure skill ID mapping (`microsoft/GitHub-Copilot-for-Azure` skills loaded via `core.read_skill`). Per-skill `loadWhen` triggers and intent groups. (Issue #208) |
| `recipes.json` | Component-Selection-Framework R1-R17 + Phase 1.6 simulation candidates | UI composition recipes catalog (R1-R20+ named patterns). Each recipe carries `composition`, `fires_when`, `validated_by_sims`, and `provenance`. (Issue #209) |
| `component-catalog.json` | `packages/*/src/components/` filesystem inventory + prompt usage | Bootstrap inventory of UI components by pack and category |
| `schemas/*.schema.json` | New | JSON Schema (draft-07) for each data file |

## Extracted vs proposed (Issue #207)

The split between `handoff-rules.json` and `handoff-rules.proposed.json` exists because Phase 1 work conflated *current implementation* with *framework recommendations*. The re-extraction (Issue #207) draws a hard line:

- **`handoff-rules.json` — `provenance: "extracted"`** — Must match `handoffs:` / `asTools:` in `packages/*/src/agents/*.agent.md` frontmatter byte-for-byte (modulo the `provenance` field). If the JSON drifts from frontmatter, that's a drift bug — file it; do not silently edit either side.
- **`handoff-rules.proposed.json` — `provenance: "proposed"` (or `"derived"`)** — Wiring that framework docs or sims recommend but agent frontmatter does not yet implement. Each entry cites its `source` (sim transcript, grounding section, framework doc). Promotion from `proposed` → `extracted` happens when an agent prompt is updated and the change re-extracted into `handoff-rules.json`.

The schema (`handoff-rules.schema.json`) requires the `provenance` field on every agent record, handoff entry, asTools entry, proposed change, and wiring gap.

## Why JSON, not code?

Per the Phase 1 user decisions:

- **Static JSON files in repo** (not a dynamic API) — easy to diff, version, and review.
- **Comprehensive scope** (all packs, not just core) — handoff rules cover every agent.
- **Adaptive behaviour OK** — defaults can evolve here without rewriting prompts.

The "anti-railway" goal is to extract the data agents currently hard-code, so adding (e.g.) a `serverless` track becomes a JSON edit, not a prompt rewrite.

## How to validate

These files are JSON Schema-validated. Either:

```bash
# Using ajv (any version with draft-07):
npx ajv validate -s config/schemas/tracks.schema.json -d config/tracks.json
npx ajv validate -s config/schemas/inference-backends.schema.json -d config/inference-backends.json
npx ajv validate -s config/schemas/handoff-rules.schema.json -d config/handoff-rules.json
npx ajv validate -s config/schemas/handoff-rules.schema.json -d config/handoff-rules.proposed.json
npx ajv validate -s config/schemas/component-catalog.schema.json -d config/component-catalog.json
npx ajv validate -s config/schemas/microsoft-skills.schema.json -d config/microsoft-skills.json
npx ajv validate -s config/schemas/recipes.schema.json -d config/recipes.json
```

Or via any JSON Schema-aware tool that follows the `$schema` reference at the top of each data file.

## Functional equivalence — Phase 1 promise

Phase 1 is non-breaking. These JSON files **must produce exactly the same agent behaviour** as the current hardcoded prompts. The check:

- Every track in `tracks.json` matches the "Four tracks" table in the triage prompt and the `pick_track` handler branches.
- Every backend in `inference-backends.json` matches the three `select_inference` branches verbatim, including the `value: "foundry"` default and the "do not paste secrets" forbidden list.
- Every handoff in `handoff-rules.json` matches the `handoffs:` array of the corresponding agent's frontmatter — same target, same label.
- Every `asTools` entry matches the agent's frontmatter, including `maxTurns`.

If you spot a divergence, that's a bug — file it; do not "fix" by editing the JSON to match the prompt or vice versa without checking which is canonical.

## How prompts will use these files

### Phase 1 (now)

Prompts continue to hardcode the data. These JSON files exist as **shadow data** — the framework documents (in `docs/architecture/`) reference them when explaining "this is the structure agents will reason from".

### Phase 2 (prompt refactor)

Prompts begin to *reference* the data (e.g., "see `config/tracks.json` for the full track list") instead of restating it inline. This requires no new tools — agents still infer from training, but the docs they reference are these JSON files.

### Phase 3 (infrastructure)

Three new tools land:

- `core.get_available_tracks()` — returns `tracks.json` content
- `core.get_inference_backends(track_id)` — returns the relevant `inference-backends.json` entries
- `core.get_component_recommendation(use_case)` — uses `component-catalog.json` + the [Component Selection Framework](../docs/architecture/component-selection-framework.md) decision tree

At that point, agent prompts call the tools instead of duplicating the data. Adding a new track / backend / component becomes a JSON edit (+ tool call cache invalidation).

## Related framework docs

- **[Component Selection Framework](../docs/architecture/component-selection-framework.md)** — decision tree for `component-catalog.json`.
- **[Tool Usage Framework](../docs/architecture/tool-usage-framework.md)** — discriminating-value rule for tool calls; the future `get_*` tools will follow this.
- **[Requirement-Gathering Methodology](../docs/architecture/requirement-gathering-methodology.md)** — `tracks.json.requirementHints` and `inference-backends.json.questionPolicy` are the structured form of those rules.
- **[Agent Coordination Decisions](../docs/architecture/agent-coordination-decisions.md)** — `handoff-rules.json` is the data behind the wiring graph in that doc, including the `wiringGaps` array.

## Conventions

- **Stable IDs.** Anything an agent emits as an event payload (track id, backend id, agent name) is a stable identifier. Renaming requires both the JSON edit *and* a prompt update *and* a runtime migration.
- **No secrets.** These files are public-by-default. No tokens, no endpoint URLs that aren't already in user-visible documentation.
- **Versioned.** Each file has a `version` field (semver). Bump on schema-incompatible changes; document in the file's commit message.
- **Comments-via-keys.** JSON has no comments — wherever guidance is needed, use a key (`note`, `extractedFrom`, `forbidden`) rather than a sidecar.
