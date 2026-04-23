## Design Proposal — #488 v2 Step 13: Docs + Cleanup
**Status:** Proposed — awaiting Leela + Zapp approval
**Working as:** Scribe (Technical Writer)

---

## 1. Approach

Sweep `docs/`, `docs-site/`, and root-level markdown in a single pass. The strategy is delete-first: remove every file that exists solely to describe a v1 concept (integration kits, conversation phases, stepwise FSM), then rewrite surviving files to use v2 terminology. New files are created only where a genuine gap exists (harness API reference, pack authoring guide). The Docusaurus sidebar/nav is updated last, after content is stable. CI (`npm run build` in `docs-site/`) is the acceptance gate.

Deprecated terms to eradicate: `phases`, `stepwise`, `IntegrationKit`, `converse-model-router`, `response-processor`, `KICKSTART_V2`, `KICKSTART_AGENTS_SDK`, `packages/core`.

---

## 2. File inventory

### Files to DELETE (v1 artifacts — no v2 equivalent)

| File | Reason |
|---|---|
| `HERMES-271-TEST-PLAN.md` | Temporary test-plan artifact from Step 1; should have been removed then |
| `QUALITY-DECISION-271.md` | Temporary quality decision artifact from Step 1; no longer needed |
| `docs-site/docs/extending/integration-kits.md` | Describes v1 `IntegrationKit`; replaced by pack authoring guide |
| `docs-site/docs/extending/conversation-phases.md` | Describes v1 phase-based routing; entirely replaced by harness turn model |
| `docs-site/docs/architecture/fsm.md` | Describes v1 FSM step execution; replaced by harness primitives |
| `docs-site/docs/architecture/prompt-pipeline.md` | Describes v1 stepwise prompt pipeline; replaced by `packages/harness` |
| `docs-site/docs/architecture/skill-injection.md` | References v1 skill injection via `packages/core`; rewrite as new file under v2 |

### Files to UPDATE (v1 references → v2 terminology)

| File | What changes |
|---|---|
| `README.md` | Rewrite architecture section: harness + packs model, updated package names (`packages/harness`, `packages/pack-core`, `packages/pack-azure`), remove v1 feature-flag env vars |
| `CONTRIBUTING.md` | Update package paths, remove v1 `IntegrationKit` extension guide, point to new pack authoring guide |
| `docs/architecture.md` | Full rewrite: harness primitives, registry lifecycle, pack dependency model, SSE event taxonomy |
| `docs/v2-implementation-brief.md` | Change status header from "in progress" to "implemented"; add final completion note |
| `docs/api-reference.md` | Update all API surface references; remove v1 endpoints; add harness public API surface |
| `docs/extending.md` | Replace v1 extension patterns with pack authoring patterns |
| `docs/integration-kits.md` | Delete or fully rewrite as pack authoring; title should change to `pack-authoring.md` |
| `docs-site/docs/intro.md` | Update product description; replace v1 framing with harness + packs framing |
| `docs-site/docs/architecture/overview.md` | Rewrite component diagram and narrative for v2 |
| `docs-site/docs/architecture/a2ui-integration.md` | Audit for `packages/core` refs; update to harness SSE/emit_ui model |
| `docs-site/docs/architecture/json-envelope.md` | Audit; update envelope schema if changed in v2 |
| `docs-site/docs/extending/overview.md` | Replace v1 extension taxonomy with pack primitives overview |
| `docs-site/docs/extending/llm-tools.md` | Update to tool registration via pack manifest |
| `docs-site/docs/extending/api-endpoints.md` | Audit for v1 refs; update or retain if still accurate |
| `docs-site/docs/extending/mcp-tools.md` | Audit; update MCP tool registration for v2 harness |
| `docs-site/docs/getting-started/project-structure.md` | Update directory tree: `packages/harness`, `packages/pack-core`, remove `packages/core` |
| `docs-site/docs/getting-started/local-setup.md` | Update env var list; remove v1 feature flags |
| `docs-site/docs/getting-started/deployment.md` | Audit for v1 env vars |
| `docs-site/docs/contributing.md` | Sync with root `CONTRIBUTING.md` updates |
| `docs-site/docs/components/custom-catalog.md` | Audit for `packages/core` A2UI imports |
| `docs-site/docs/components/extending-a2ui.md` | Audit for v1 refs |
| `CHANGELOG.md` | Add v2 sprint section: Added / Changed / Removed covering Steps 1–13 |

### Files to CREATE (net-new v2 content)

| File | Content |
|---|---|
| `docs/harness-api-reference.md` | Harness public API: `AgentHarness`, `PackRegistry`, `ToolRegistry`, `UserActionRegistry`, `GuardrailRegistry`, `emit_ui` SSE contract |
| `docs/pack-authoring-guide.md` | How to write a pack: `.agent.md`, `SKILL.md`, tool, user action, component, guardrail; pack manifest schema; dependency model |
| `docs-site/docs/extending/pack-authoring.md` | Docusaurus-facing version of pack authoring guide (can be a shorter summary linking to `docs/pack-authoring-guide.md`) |
| `docs-site/docs/architecture/harness.md` | Harness primitives, turn lifecycle, SSE event taxonomy, registry lifecycle diagram |
| `docs-site/docs/architecture/skill-injection-v2.md` | Replaces deleted `skill-injection.md`; describes v2 skill resolution via pack registry |

---

## 3. Phases

### Phase A — Delete v1 artifacts
Remove the 7 files listed under "Files to DELETE". Update Docusaurus sidebar config (`docs-site/sidebars.js` or equivalent) to drop those entries.

### Phase B — Core `/docs` rewrite
Rewrite `docs/architecture.md`, `docs/api-reference.md`, `docs/extending.md`. Create `docs/harness-api-reference.md` and `docs/pack-authoring-guide.md`. Update `docs/v2-implementation-brief.md` status.

### Phase C — Docusaurus site refresh
Update all surviving `docs-site/docs/**` pages. Create new `docs-site/docs/architecture/harness.md`, `docs-site/docs/architecture/skill-injection-v2.md`, `docs-site/docs/extending/pack-authoring.md`. Run `npm run build` in `docs-site/`; fix any broken sidebar refs.

### Phase D — Root-level cleanup
Rewrite `README.md` architecture section. Update `CONTRIBUTING.md`. Delete `HERMES-271-TEST-PLAN.md` and `QUALITY-DECISION-271.md`.

### Phase E — CHANGELOG + validation
Append v2 sprint section to `CHANGELOG.md`. Run `grep -r "phases\|stepwise\|IntegrationKit\|converse-model-router\|response-processor\|KICKSTART_V2\|KICKSTART_AGENTS_SDK\|packages/core" docs/ docs-site/ README.md CONTRIBUTING.md` — must return zero matches. Confirm `npm run build` in `docs-site/` is green.

---

## 4. Acceptance criteria

- Zero occurrences of: `phases`, `stepwise`, `IntegrationKit`, `converse-model-router`, `response-processor`, `KICKSTART_V2`, `KICKSTART_AGENTS_SDK`, `packages/core` in any doc file
- `HERMES-271-TEST-PLAN.md` and `QUALITY-DECISION-271.md` deleted from repo root
- `docs/harness-api-reference.md` and `docs/pack-authoring-guide.md` created and complete
- `docs/v2-implementation-brief.md` status updated to "implemented"
- `docs-site/` Docusaurus build passes (`npm run build`)
- `README.md` architecture section describes harness + packs, not v1 phases
- `CHANGELOG.md` has a v2 sprint entry covering Steps 1–13
- Pack authoring guide covers: `.agent.md`, `SKILL.md`, tool, user action, component, guardrail

---

## 5. No security surface

This is docs-only. No new endpoints, no data access changes, no auth changes, no runtime behaviour modifications. Zero security surface delta.

---

## 6. Scribe notes (product/DX review)

- The new pack authoring guide is the single most important deliverable for a newcomer. It should be self-contained: a reader should be able to write their first pack in under ten minutes.
- Naming in new docs must match the wire conventions table in `v2-implementation-brief.md` section 16 exactly (tool `.`, user action `:`, component `/`, skill id `/`, agent `.`, pack bare).
- The CHANGELOG entry should group by: **Added** (harness, pack-core, pack-azure, A2UI v2), **Changed** (package renames), **Removed** (phases, stepwise, IntegrationKit, converse-model-router, response-processor).
- No em dashes. No passive-voice hedges. Write like a human wrote it.
