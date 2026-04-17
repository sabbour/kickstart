# Step 4–6 routing brief

Date: 2026-04-17T12:06:45.293Z
Author: Bender

## Issue-by-issue readout

### #477 — Step 4: pack-core
- **Owner from labels:** Fry
- **Key implementation risk:** This is the first real consumer of the Step 2/3 contracts, so any wobble in registry shape, loader semantics, or A2UI schema strictness will explode across 3 agents, 5 skills, 6 tools, and 39 components at once. The biggest practical risk is mixing domain-neutral pack-core work with leftover v1 web-shell assumptions and ending up with a pack manifest that only works in the playground, not in the harness.
- **Needs from #475 / #476:**
  - From **#475**: stable primitive types (`Pack`, `AgentContribution`, `Skill`, `ToolContribution`, `UserActionContribution`, `ComponentContribution`, `GuardrailContribution`), `AgentOutput`, A2UI schemas, and `chat-a2ui` helpers.
  - From **#476**: a working `PackRegistry`, `.agent.md` / `SKILL.md` loaders, tool-vs-user-action allowlist resolution, component enumeration, and sealing semantics.

### #478 — Step 4a: Playground on registry
- **Owner from labels:** Fry + Hermes
- **Key implementation risk:** The playground is the first place where registry shape becomes visible in the UI. The danger is rebuilding a second source of truth (another `GALLERY_GROUPS` in disguise) instead of actually driving the page from `registry.components` and `registry.playgroundScenarios`. The other risk is stub dispatch: pack-level `playgroundStubs` need to line up exactly with user-action names or the playground will look healthy while masking broken runtime wiring.
- **Needs from #475 / #476:**
  - From **#475**: component/A2UI/playground scenario types and the moved `chat-a2ui` utility surface.
  - From **#476**: registry component/scenario enumeration, pack enablement, catalog skeleton, and stable contribution naming so unregistered references fail loudly.
  - Also needs **#477** to supply actual `corePack` scenarios/components.

### #479 — Step 5: Runner + SSE
- **Owner from labels:** Fry
- **Key implementation risk:** This is the first end-to-end browser/runtime splice. The main risk is mismatching the typed harness event model with the React hooks and ending up with another ad-hoc streaming protocol. The second risk is starting runner/resume work before the registry/catalog shape is locked, which would hard-code pack discovery or user-action dispatch into the API layer.
- **Needs from #475 / #476:**
  - From **#475**: `SessionCtx`, `AgentOutput`, A2UI schemas, and typed user-action result contracts.
  - From **#476**: sealed registry lookups (`getAgent`, component enumeration, user-action manifests), loader-produced agent instructions, and catalog negotiation skeleton.
  - Also needs **#478** because `/api/packs` and the hook/UI side must align with the registry-driven playground/catalog model.

### #480 — Step 6: Skill resolver
- **Owner from labels:** Bender
- **Key implementation risk:** The resolver is easy to overbuild. The real danger is inventing a scoring/tokenization model that disagrees with the Step 2 `Skill` contract or sneaks runtime policy into pack data. The other risk is wiring it into the runner too early and making debugging Step 5 stream behavior harder.
- **Needs from #475 / #476:**
  - From **#475**: `Skill`, `SessionCtx`, agent names, and the explicit dynamic-instructions contract.
  - From **#476**: registry access to the loaded skill set plus loader-normalized `appliesTo`, `keywords`, and `priority` fields.
  - Also needs **#479** to provide the runner/instructions hook where the resolver is actually applied.

## Parallelism once #476 lands

Short version: **there is very little issue-level parallelism in #477–#480.** The chain is mostly linear.

- **#477 can start immediately once #476 lands.**
- **#478 cannot truly start implementation until #477 has real `corePack` components/scenarios to read.** Hermes can prep the regression-test shape in parallel, but the issue itself is downstream of #477.
- **#479 should not start before #478 lands.** The issue body makes `/api/packs`, typed SSE consumers, and hook rewrites depend on the registry-driven playground/catalog world being real, not hypothetical.
- **#480 should not start before #479 lands.** The resolver can be designed earlier, but implementation is blocked on the runner hook from Step 5.

Practical routing suggestion after #476 clears:
1. **Fry** starts **#477** immediately.
2. **Hermes** shadows #477 with test prep for pack-core/playground surfaces, then pairs into **#478** as soon as the first core scenarios/components exist.
3. **Fry** moves to **#478**, then **#479**.
4. **Bender** holds **#480** until #479 exposes the runner integration point, then picks it up fast.

## Shared utilities / types to avoid duplicating

These should be treated as shared foundations, not re-invented per step:

- **A2UI Zod schemas + message unions** from **#475** — pack-core tool validation, playground rendering, and SSE event payloads all need the same canonical message types.
- **`chat-a2ui` helpers** from **#475** — both playground/session rebuild logic and Step 5 streaming/hydration code should reuse one helper surface.
- **Registry read API** from **#476** — `getAgent`, component enumeration, scenario enumeration, user-action manifest lookup, and enabled-pack filtering must stay centralized.
- **Contribution naming rules** from **#476** — tool `.` names, user-action `:` names, component `/` names, and pack-scoped scenario IDs should be enforced once and then consumed everywhere.
- **Catalog/manifest skeleton** from **#476** — Step 4a playground and Step 5 `/api/packs` should share the same source shape instead of building parallel manifests.
- **SessionCtx contract** from **#475** — Step 4 tools, Step 5 runner/resume plumbing, and Step 6 skill resolution all need one shared session interface.
- **Token budgeting utility** (likely small and harness-owned) should be written once when #480 lands, but designed so Step 4 guardrails / validation helpers do not invent a second approximate budget mechanism.

## Routing bottom line

When #476 clears, Ralph should treat **#477 → #478 → #479 → #480** as the main path, with Hermes joining on validation rather than splitting the chain into competing implementation branches. The only safe concurrency is prep/test work around #477 and early test scaffolding for #478 while Fry is still landing pack-core.
