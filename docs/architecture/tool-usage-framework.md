# Tool Usage Framework

**Status:** Phase 1 Documentation | **Scope:** All agents in core, azure, aks, github packs

---

## Purpose

This document defines **when** and **why** agents call tools — not what tools do. The "what" is in each tool's `description` field; the "when" lives here.

The current pain point: prompts say things like *"call X when needed"* — which is subjective. This framework replaces subjective triggers with a single decision rule based on **discriminating value**: does this tool call change what I do next?

---

## The One Rule

**Call a tool only when its output will change your next decision.**

Three checks before any tool call:

1. **Will I act differently** based on the result? If no → don't call.
2. **Can I infer the answer** from context already? If yes → don't call.
3. **Have I already called this** in the conversation? If yes → reuse the result.

If a tool call passes all three, make it — and tell the user *why* you called it ("I'm checking the live KAITO catalog because you mentioned a Phi-3 variant and I want to confirm it's still supported").

---

## Tool Inventory (current, by pack)

This is the actual surface as of `main`. Tools are the only tools — anything not in this list does not exist yet.

### `core` pack — 15 tools

| Tool | Category | One-line purpose |
|---|---|---|
| `core.emit_ui` | UI emission | Validate and emit an A2UI v0.9 message (createSurface / updateComponents) |
| `core.show_card` | UI emission | Convenience wrapper that creates a card surface |
| `core.show_form` | UI emission | Convenience wrapper that creates a form surface |
| `core.confirm` | UI emission | Render a confirmation dialog on an existing surface |
| `core.navigate` | UI emission | Emit an A2UI navigation event (route changes) |
| `core.read_file` | Workspace I/O | Read a text file from the session workspace |
| `core.write_file` | Workspace I/O | Write a UTF-8 file to the session workspace |
| `core.list_files` | Workspace I/O | List workspace files (≤ 500 entries) |
| `core.read_skill` | Workspace I/O | Load a skill document for the calling agent |
| `core.fetch_webpage` | External | HTTPS fetch with SSRF guard; returns markdown-ish text |
| `core.inspect_repo` | Discovery | Detect language/framework/runtime/deps from a public GitHub repo |
| `core.search_kaito_models` | Discovery | Search the live KAITO `supported_models.yaml` catalog |
| `core.search_components` | Discovery | Search the sealed component catalog |
| `core.scaffold_app` | Generation | Scaffold a new application skeleton |
| `core.gen_dockerfile` | Generation | Generate a Dockerfile from detected stack |
| `core.gen_helm` | Generation | Generate a Helm chart skeleton |
| `core.gen_kaito_crd` | Generation | Generate a KAITO Workspace CRD |
| `core.gen_foundry_wiring` | Generation | Generate Azure AI Foundry wiring (secrets, env, ConfigMap) |
| `core.check_safeguards` | Validation | Analyse a manifest against AKS Automatic safeguards |
| `core.fix_safeguards` | Generation | Suggest patches that resolve safeguard violations |
| `core.validate_artifacts` | Validation | Lint generated artifacts (currently: hadolint for Dockerfiles) |

### `azure` pack — 8 tools

| Tool | Category | One-line purpose |
|---|---|---|
| `azure.arm_get` | Read | Read an Azure resource via ARM REST (token from session) |
| `azure.arm_deploy_resource` | Write | Deploy an ARM/Bicep template |
| `azure.arm_update_resource` | Write | Update an existing Azure resource |
| `azure.arm_delete_resource` | Write | Delete an Azure resource |
| `azure.what_if` | Validation | ARM `what-if` dry-run (preview changes) |
| `azure.pricing_lookup` | External | Live Azure Retail Prices API lookup |
| `azure.estimate_cost` | Computation | Sum up monthly cost from a list of line items |
| `azure.validate_bicep` | Validation | Static analysis of a Bicep template |
| `azure.propose_services` | Generation | Recommend Azure services for a workload profile |

### `aks` pack — 3 tools

| Tool | Category | One-line purpose |
|---|---|---|
| `aks.validate_manifests` | Validation | `kubectl --dry-run=client` against a YAML manifest |
| `aks.validate_safeguards` | Validation | AKS Automatic safeguard rule checks |
| `aks.build_architecture_diagram` | Generation | Deterministic diagram JSON from a plan artifact |

### `github` pack — 1 tool + user actions

| Tool | Category | One-line purpose |
|---|---|---|
| `github.api_get` | Read | Read-only GitHub REST GET (token from session) |
| *user actions* | — | `github:login`, `github:pick_org/repo`, `github:create_repo/pr`, `github:set_secret` (browser-side, not LLM tools) |

---

## Tool Categories — when each category fires

Categories cluster tools by *the kind of decision they support*. The rule for the **whole category** is the same; per-tool nuance is in the appendix.

### Category 1: Discovery (`inspect_repo`, `search_kaito_models`, `search_components`)

**Fire when:** an agent's next decision depends on a fact about an external catalogue or user-supplied artefact, AND the agent cannot reliably answer from training/context.

**Don't fire when:**
- The user has already supplied the fact ("use Phi-3-mini-4k-instruct" → don't search KAITO).
- The agent has a recent cached result from earlier in the conversation.
- Calling would feel like "looking busy" rather than informing a decision.

**Examples:**
- ✅ Triage on agentic_app track, user said "small open-source model" → `search_kaito_models("phi")` to enumerate variants.
- ❌ Triage knows the user wants Foundry-hosted GPT-4o → searching KAITO is noise.
- ✅ Triage on repo_uplift track, user pasted a GitHub URL → `inspect_repo` once, before track confirmation.
- ❌ Same conversation, second turn → reuse previous `inspect_repo` result; don't refetch.
- ✅ Codesmith about to emit a domain-specific UI → `search_components` if uncertain whether a specialised component exists.
- ❌ Codesmith emitting a plain Card → no need; `Card` is in core and well-known.

### Category 2: Validation (`validate_artifacts`, `validate_bicep`, `validate_manifests`, `validate_safeguards`, `check_safeguards`, `what_if`)

**Fire when:** the agent has produced an artifact that will be surfaced to the user OR sent to a real Azure/AKS API. Validation is a **gate**, not a "nice-to-have".

**Don't fire when:**
- The artifact is a draft mid-generation (validate the *finished* output).
- The artifact came from the user (you didn't generate it; trust them or ask).
- The validator doesn't apply (e.g., `validate_artifacts` skips non-Dockerfiles today — calling it on a YAML file just returns `skipped`).

**Examples:**
- ✅ Codesmith generated a Dockerfile → call `validate_artifacts` before emitting the file or handing off.
- ✅ AKS manifests author finished a Deployment YAML → call `validate_manifests` + `validate_safeguards` before handoff.
- ✅ Azure ops about to deploy a Bicep template → `azure.what_if` is mandatory before `arm_deploy_resource`.
- ❌ Codesmith generated a README.md → no validator applies; skip.
- ❌ Reviewer is *reading* a file the user provided → trust input; don't validate user content.

**Hard rule:** if validation **fails**, surface the failures. Never silently emit a known-bad artifact.

### Category 3: Read / External fetch (`arm_get`, `api_get`, `pricing_lookup`, `fetch_webpage`)

**Fire when:** the agent needs *current, ground-truth* data the LLM cannot have ("what's the current price of D4s_v5 in westeurope?", "does this RG exist already?", "what does this CNCF page say?").

**Don't fire when:**
- The data is stable enough to know without checking (CIDR rules, K8s field names).
- Fetching would expose private content unnecessarily (only `arm_get` what you need).
- The question is hypothetical ("what *would* the price be if…") — use `estimate_cost` instead.

**Examples:**
- ✅ Azure architect drafting a cost section → `pricing_lookup` for each SKU, then `estimate_cost`.
- ❌ Azure architect explaining what a VNET is → no fetch; explain from training.
- ✅ AKS architect citing the latest Cilium recommendation → `fetch_webpage` for the upstream doc.
- ❌ Triage echoing back what the user said → no fetch needed.

### Category 4: Write / Mutation (`write_file`, `arm_deploy_resource`, `arm_update_resource`, `arm_delete_resource`)

**Fire when:** the user has explicitly approved the change (after seeing a plan, diff, or what-if) AND the previous validation gate has passed.

**Don't fire when:**
- The user hasn't approved yet (always show first, mutate second).
- Validation failed (block on errors; surface and ask).
- A non-mutating alternative answers the same question (use `what_if` instead of `arm_deploy_resource` to preview).

**Hard rules:**
- Every `arm_deploy_resource` MUST be preceded by a successful `azure.what_if` in the same conversation.
- Every `arm_delete_resource` MUST have explicit user confirmation in the immediately preceding turn (use `core.confirm` to capture it).
- `write_file` to overwrite an existing path needs the user to have seen the previous content (or to have just generated it themselves).

### Category 5: UI emission (`emit_ui`, `show_card`, `show_form`, `confirm`, `navigate`)

**Fire when:** the next interaction with the user is **better as a UI** than as prose. See the [Component Selection Framework](./component-selection-framework.md) for the choice between components.

**Don't fire when:**
- The choice/confirmation fits in one prose sentence.
- You're emitting "just to show a UI" without a question or output (UI for its own sake).
- You haven't decided what to ask yet (decide first, then emit).

**One-emit-per-turn rule:** at most one *interactive* surface per agent turn. A read-only `show_card` summary plus a follow-on `show_form` in the same turn is OK; two competing forms is not. (See the requirement-gathering methodology for the underlying rationale.)

### Category 6: Generation (`scaffold_app`, `gen_dockerfile`, `gen_helm`, `gen_kaito_crd`, `gen_foundry_wiring`, `fix_safeguards`, `propose_services`, `build_architecture_diagram`)

**Fire when:** all required inputs are collected, the user has approved the plan, and the agent is in the build phase. Generation tools are usually **terminal** within a phase: validate → emit → hand off.

**Don't fire when:**
- Inputs are still ambiguous (gather first; don't generate from guesses).
- The plan hasn't been confirmed (premature generation wastes user trust).
- A more specific tool exists (use `gen_dockerfile` rather than handcrafting Dockerfile text in `write_file`).

**Examples:**
- ✅ Codesmith on containerized_web track, plan approved → `gen_dockerfile` → `validate_artifacts` → `write_file` → `emit_ui` (review surface).
- ❌ Codesmith asked "what would a Helm chart look like?" → answer in prose; don't run `gen_helm` for a hypothetical.

---

## The Discriminating-Value Test

Replace every "call X when needed" in agent prompts with this test:

```
Before any tool call, answer:

  Q1. What decision am I about to make?
  Q2. What are the possible answers?
  Q3. Which of those answers does this tool's output rule in or out?

If Q3 is empty → don't call the tool.
```

Worked example — triage agent considering `core.search_kaito_models`:

| | |
|---|---|
| **Q1: Decision** | Which inference backend should I recommend? |
| **Q2: Possible answers** | KAITO on AKS, Foundry-hosted, generic endpoint |
| **Q3: What changes?** | If a KAITO preset matches the user's model name → KAITO becomes a real option. If not → KAITO is off the table; recommend Foundry/generic. |
| **Verdict** | Call it. The output rules options in/out. |

Counter-example — triage agent considering the same tool when the user already said "Use GPT-4o":

| | |
|---|---|
| **Q1: Decision** | Which inference backend should I recommend? |
| **Q2: Possible answers** | Foundry (GPT-4o is hosted there) |
| **Q3: What changes?** | KAITO doesn't host GPT-4o, so the search doesn't help. |
| **Verdict** | Skip. Recommend Foundry directly. |

---

## Caching & Reuse Within a Conversation

Tool calls have latency and cost. Once a fact is established in conversation, **don't re-fetch it** unless something invalidated it.

| Tool | Cache lifetime | Invalidation trigger |
|---|---|---|
| `inspect_repo` | Whole conversation | User changes repo URL or pushes new commits *they tell you about* |
| `search_kaito_models` | Whole conversation | None (catalogue is stable within a session) |
| `search_components` | Whole conversation | None (catalogue is sealed at startup) |
| `pricing_lookup` | Whole conversation per SKU/region | User changes region or SKU family |
| `arm_get` | Until next mutation on that resource | Any `arm_*` write to the same resource |
| `validate_*` | Per artifact version | New version of the artifact |
| `fetch_webpage` | Whole conversation per URL | User asks for a refresh |

**How to "remember"**: when you call a tool, restate the result in your own thinking ("KAITO catalogue: phi-3-mini-4k, phi-3-medium-4k, …"). On the next turn, if you'd be asking the same question, you've already got the answer.

---

## Cross-Agent: Handoff vs `asTools`

Each agent is given **handoffs** (full transfer) and **asTools** (bounded consultation). These are not tools in the usual sense, but they use the same discriminating-value rule.

### Use a `handoff` when…

The next phase is **wholly** in another agent's domain and the conversation should continue there. Example: triage gathered AKS-specific requirements → hand off to `aks.architect`. The user-facing speaker is now the architect.

**Don't hand off when:**
- You only need a 1–2 turn answer (use `asTools` instead).
- The other agent doesn't have the user's recent context (handoff carries the prompt you write — make it self-contained).
- You'd hand back immediately ("ping-pong"): rethink whether you should be in this conversation at all.

### Use `asTools` when…

You need a domain-specific *answer* but the conversation should remain with you. The specialist runs for ≤ `maxTurns` turns and returns a summary you incorporate.

**Don't use asTools when:**
- The question doesn't require domain expertise (answer locally).
- You'll consult >2–3 specialists in one turn (consolidate; consider handing off to the most relevant one).
- You're using it to avoid making a decision (asTools is for *information*, not for offloading judgement).

**Real wiring** (from current agent frontmatter):
- `triage` ⇄ `aks.architect`, `azure.architect` (consultation, max 3 turns)
- `codesmith` ⇄ `core.reviewer` (mid-generation feedback, max 3 turns)
- `aks.architect` ⇄ `azure.architect`, `core.codesmith` (cross-domain consultation, max 3–5 turns)

---

## Per-Agent Tool Profile

Agents only see tools listed in their frontmatter `tools:` array. Below is the **declared** tool surface plus the principles each agent should apply.

### `core.triage`

**Declared:** `core.emit_ui`, `core.inspect_repo`, `core.search_kaito_models`, `core.search_components`

**Posture:** discovery + UI. Triage doesn't write files, doesn't validate, doesn't deploy.

**When to call each:**
- `inspect_repo` — exactly once per repo URL the user supplies; reuse for the rest of the session.
- `search_kaito_models` — only on agentic_app track AND only when the model is not yet pinned.
- `search_components` — when the user's domain (Azure, AKS, GitHub) suggests a specialised component beyond `core/*` would communicate the choice better.
- `emit_ui` — for track selection (when ambiguous), backend selection (RadioGroup), or summary cards before handoff. See the [Component Selection Framework](./component-selection-framework.md).

**Asked of specialists via asTools:** AKS topology questions, Azure cost/SKU questions. Both capped at 3 turns — beyond that, hand off.

### `core.codesmith`

**Declared:** `core.fetch_webpage`, `core.read_file`, `core.write_file`, `core.list_files`, `core.validate_artifacts`, `core.emit_ui`

**Posture:** generate, validate, emit. Codesmith is the only core agent that mutates the workspace.

**Strict order:** `read_file`/`list_files` (understand workspace) → produce content → `validate_artifacts` (gate) → `write_file` → `emit_ui` (review surface). Never reverse this order.

**`fetch_webpage` rules:** only when grounding in current external docs *changes the generated output*. Echoing CNCF best practice from training is fine; citing today's recommended version of `cilium` requires a fetch.

**`asTools` to reviewer:** for spot-checks on a single file mid-generation, not as a substitute for the final reviewer handoff.

### `core.reviewer`

**Declared:** `core.read_file`, `core.list_files`, `core.validate_artifacts`

**Posture:** read, validate, judge. Reviewer never writes — findings go in the verdict, not the workspace.

**Discriminating value for `validate_artifacts`:** call it for every artifact eligible for a validator (today: Dockerfiles). Skipping known-validatable files is a review failure.

### `aks.architect`

**Declared:** `aks.validate_manifests`, `aks.validate_safeguards`, `aks.build_architecture_diagram`, `core.emit_ui`, `core.fetch_webpage`

**Posture:** design + validate-by-proxy. The architect doesn't author manifests directly (that's `aks.manifests_author`), but it can preview validators on draft snippets to ground recommendations.

**`build_architecture_diagram`:** call only after the design is *agreed in prose*. Diagrams are confirmation aids, not exploration aids — premature diagrams lock in choices the user hasn't bought into.

### `aks.manifests_author`

**Declared:** `aks.validate_manifests`, `aks.validate_safeguards`, `core.emit_ui`

**Posture:** generate manifests, validate, hand off. Same strict order as codesmith: produce → validate (both validators) → emit/hand off.

### `aks.reviewer`

**Declared:** `aks.validate_manifests`, `aks.validate_safeguards`, `core.emit_ui`

**Posture:** mirror of core.reviewer for AKS. Always run *both* validators on every manifest reviewed; partial validation is unsafe.

### `azure.architect`

**Declared:** `azure.arm_get`, `azure.pricing_lookup`, `azure.estimate_cost`, `azure.validate_bicep`, `core.emit_ui`, `core.fetch_webpage`

**Posture:** design + cost. The architect costs every recommendation that mentions a SKU.

**Pricing rule:** any concrete SKU recommendation needs a `pricing_lookup` (per SKU+region) followed by `estimate_cost` to roll up totals. Vague answers ("a few hundred dollars") without these calls are not allowed.

**`validate_bicep`:** call on any Bicep snippet shown to the user, even hand-typed examples — static analysis is fast and catches embarrassments.

### `azure.ops`

**Declared:** `azure.arm_get`, `azure.what_if`, `core.emit_ui`

**Posture:** read + dry-run. Ops doesn't have *write* tools in its current frontmatter — deployment writes happen via `core.codesmith` (file generation) plus separate user actions. (If/when `arm_deploy_resource` is granted to ops, the what-if-then-deploy pairing rule from Category 4 applies.)

### `github.publisher`

**Declared:** `github.api_get`, `core.emit_ui`

**Posture:** read GitHub state, emit UI for user actions (login, repo selection, PR creation). The actual writes are *user actions*, not LLM tool calls — the publisher emits the surface; the user clicks; the runtime executes.

**`api_get` rules:** only after `github:login` (a user action) has succeeded. Never call against a path the user hasn't been told about.

---

## Anti-Patterns (and the principle they violate)

### 1. Tool spam
Calling 4 tools in a single turn "to gather context" before doing anything. Violates discriminating-value: most calls don't change the next decision.

**Fix:** call the *single* tool whose output most affects your next message. If that's still unclear, ask the user instead.

### 2. Tool as substitute for reasoning
"I don't know which component to use, so I'll `search_components` for everything." Violates Q1 of the discriminating test (no clear decision being supported).

**Fix:** start with the [Component Selection Framework](./component-selection-framework.md). Use `search_components` only to *check* whether a specialised pack component exists, with a specific query.

### 3. Validation theatre
Calling `validate_artifacts` on the wrong file type just to claim validation happened. The tool returns `skipped` — and the agent reports "validated" anyway.

**Fix:** if a validator skipped, say so. Don't dress up `skipped` as `pass`.

### 4. Stale-data trust
Calling `pricing_lookup` once at the start of a long conversation, then reusing the price after the user changed region. Violates the cache-invalidation table.

**Fix:** when an input changes, the corresponding cached fact is stale. Re-fetch.

### 5. Mutation without preview
Going straight to `arm_deploy_resource` without `what_if`, or `write_file`-overwriting a file the user hasn't seen. Violates Category 4 hard rules.

**Fix:** always preview-then-mutate. The preview's job is to *give the user a chance to say no*.

### 6. Ping-pong handoffs
Triage → architect → triage → architect within four turns. Violates the handoff rule — handoff is for phase transitions, not back-and-forth.

**Fix:** if you'd hand back, you should have used `asTools`. If you used `asTools` and the consultant kept asking for more turns, you should have handed off in the first place.

### 7. Hidden tool reasoning
Calling a tool and presenting the result as if you knew it innately. The user can't tell whether the agent is grounded or hallucinating.

**Fix:** when a fact came from a tool, name the tool ("Per the live KAITO catalogue, …"; "ARM what-if shows …"). Transparency is a feature.

---

## Logging & Telemetry (forward-looking)

To make tool usage auditable across sessions (Phase 3 work), each tool call should ultimately log:

- **Caller** (agent name + turn number)
- **Tool** (qualified name)
- **Discriminating decision** (Q1 from the test — what was being decided)
- **Result class** (e.g., for validators: pass/fail/skipped; for searches: hit count)
- **Latency**

This isn't a Phase 1 deliverable — it's a Phase 3 hook. But Phase 1 prompts should already encourage agents to *say what they're deciding* before they call, so the telemetry has something meaningful to record later.

---

## Forward Compatibility — proposed Phase 3 tools

The implementation plan proposes three new tools. They are **not implemented yet**; the table below records intent so this framework can be updated in lockstep.

| Proposed | Replaces | Decision rule |
|---|---|---|
| `core.get_available_tracks()` | Hardcoded track list in triage prompt | Call once at conversation start; cache for the session. |
| `core.get_component_recommendation(use_case)` | Per-agent ad-hoc component picking | Call when the [Component Selection Framework](./component-selection-framework.md) decision tree returns "ambiguous" — not for cases the framework already covers. |
| `core.get_component_catalog()` | Hardcoded component knowledge in prompts | Call at conversation start *only if* the agent will plausibly emit pack-specific components. |

When these land, this document gains a row per tool in the inventory and an entry in the per-agent profiles. Until then, agents reason from the framework itself.

---

## Success Criteria

This framework is doing its job when:

- Every `tools:` array in an agent frontmatter is justified — each tool there has a clear discriminating-value scenario in this doc.
- Agent prompts stop saying "call X when needed" and start saying "call X when *this specific decision* is in front of you".
- The reviewer (or a future telemetry pass) can verify each tool call against Q1–Q3 of the discriminating test.
- Validation gates are unambiguous and enforced — no silent skips, no theatre.
- Mutations always trail a preview — `what_if` before `deploy`, `confirm` before `delete`.

---

## Next Steps

1. **Audit current prompts** — for each `tools:` entry, find the prompt text that decides when to call it. Flag ones that say "as needed" / "when appropriate" with no further criterion.
2. **Author per-tool one-liners** — distil the categories above into a 1-line "call when …" hint that can be inlined into prompts during Phase 2.
3. **Land discriminating-value language in Phase 2** — every refactored prompt cites this framework and uses Q1/Q2/Q3 as its tool-decision pattern.
4. **Hook telemetry in Phase 3** — once `get_*` tools land, add the logging schema above.
