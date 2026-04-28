# Agent Coordination Decisions

**Status:** Phase 1 Documentation | **Scope:** Decision matrix for handoff vs `asTools` vs `core.emit_ui` (vs answering directly).

---

## Purpose

When an agent receives a turn, it has four ways to move the conversation forward:

1. **Answer directly** in prose (no tool, no handoff).
2. **Emit a UI surface** with `core.emit_ui` (interactive choice / form / display).
3. **Consult a specialist via `asTools`** (bounded, ≤ `maxTurns`, conversation stays here).
4. **Hand off to another agent** (full transfer; the other agent is now the speaker).

Picking the wrong vehicle is the most common coordination failure. Examples we see in current sessions:
- Triage hands off mid-clarification (the architect inherits an unanswered question).
- An architect tries to answer a cross-domain question instead of consulting `azure.architect` via `asTools`.
- An agent emits a 6-field Questionnaire when one prose question would do.
- Two agents bounce a conversation back and forth ("ping-pong") because each thinks the other should have the next turn.

This doc gives one decision matrix for the four-way choice, ten worked scenarios, and the wiring constraints from current agent frontmatter.

---

## The decision matrix

When you have *something to do this turn*, run these four questions in order.

### Q1 — Can I answer from what I already know?

If yes → **answer in prose**. No tool, no UI, no handoff. The user's question doesn't require fresh data, doesn't need a structured choice, and isn't outside your domain.

Examples:
- Triage explaining what AKS Automatic *is* (vs Standard) → prose.
- `aks.architect` explaining why Workload Identity is required → prose.
- Any agent restating the plan so far → prose.

### Q2 — Does the next user interaction need structure?

If the next thing the user has to do is *choose between options*, *fill a form*, or *see a structured summary* — and prose would be worse — then **emit UI** via `core.emit_ui` (or `core.show_card` / `core.show_form` / `core.confirm`).

Use the [Component Selection Framework](./component-selection-framework.md) to pick the component. Use the [Tool Usage Framework](./tool-usage-framework.md) Category 5 rules to confirm `core.emit_ui` is the right tool.

Examples:
- 4 tracks the user must choose between → `TrackPicker`.
- Plan summary the user must approve/revise → `SummaryCard` + action buttons.
- Destructive action requires explicit confirmation → `core.confirm`.

**Don't** emit UI just to look interactive. UI is a vehicle for the *user's next action*, not a substitute for prose explanation.

### Q3 — Do I need a domain answer to keep going?

If the next decision belongs to a *different* specialist's domain — but the **conversation should remain with you** — call the specialist via `asTools`. The specialist runs for ≤ `maxTurns` turns, returns a summary, you incorporate it.

Examples:
- Triage on agentic_app track needs to know cost of a KAITO deployment → `ask_azure_architect`.
- `aks.architect` needs to know whether VNET peering is feasible → `ask_azure_architect`.
- `core.codesmith` wants a sanity check on a specific generated file → `ask` `core.reviewer`.

**Use asTools when** the answer is bounded (1–3 questions), the user shouldn't notice the consultation as a phase change, and you'll be the one delivering the synthesised answer.

### Q4 — Is the rest of this work wholly in another agent's domain?

If yes — and you've done your job in this conversation — **hand off**. Pass a self-contained prompt with the answers gathered so far. The receiving agent becomes the speaker.

Examples:
- Triage gathered all requirements; the next phase is AKS architecture → handoff to `aks.architect`.
- Architect has the plan approved; the next phase is file generation → handoff to `core.codesmith`.
- Files are validated; the next phase is publishing → handoff to `github.publisher`.

**Hand off when** the receiving agent will speak for ≥ 3 turns, has its own toolset that's better-fit, and you have nothing further to add.

---

## Quick reference table

| Situation | Vehicle |
|---|---|
| You know the answer; user just asked a question | **Prose** |
| User must pick from 3+ options | **UI** (`emit_ui` → `RadioGroup`/`TrackPicker`) |
| User must fill 3+ related fields | **UI** (`emit_ui` → `Questionnaire`) |
| User must approve/revise a plan | **UI** (`emit_ui` → `SummaryCard` + buttons) |
| User must confirm a destructive action | **UI** (`core.confirm`) |
| You need a 1-turn cost / topology / availability answer | **`asTools`** |
| You need a quick sanity check on output you produced | **`asTools`** to reviewer |
| Requirements gathered; next phase is someone else's domain | **Handoff** |
| Plan approved; next phase is generation | **Handoff** to codesmith |
| Files generated; next phase is review | **Handoff** to reviewer |
| Files reviewed and approved; next phase is publishing | **Handoff** to github.publisher |

---

## The wiring (current state)

This is the actual graph from agent frontmatter as of `main`. Anything not on this graph cannot happen — `asTools` and `handoffs` are explicit declarations.

### Handoffs

```
core.triage ─┬─→ aks.architect            "AKS architecture"
             ├─→ azure.architect          "Azure infrastructure"
             ├─→ core.codesmith           "Generate files"
             ├─→ core.reviewer            "Review artifacts"
             └─→ github.publisher         "Publish to GitHub"

aks.architect ─┬─→ aks.manifests_author   "Author manifests"
               ├─→ aks.reviewer           "Send for review"
               └─→ core.codesmith         "Generate files"

aks.manifests_author ─┬─→ aks.architect   "Back to architecture"
                      └─→ aks.reviewer    "Send for review"

aks.reviewer ─┬─→ aks.architect           "Back to architect"
              └─→ aks.manifests_author    "Back to manifest author"

azure.architect ─┬─→ azure.ops            "Deploy resources"
                 └─→ core.codesmith       "Generate files"

azure.ops ─→ azure.architect              "Back to architect"

core.codesmith        (no outgoing handoffs)
core.reviewer         (no outgoing handoffs)
github.publisher      (no outgoing handoffs)
```

**Observations:**
- `core.codesmith`, `core.reviewer`, and `github.publisher` are **terminal** — they don't hand off further. The conversation ends with them or returns to the human via the harness's auto-reviewer hook.
- The AKS pack has an internal **architect ⇄ manifests_author ⇄ reviewer** cycle, intentionally — design / author / review are distinct phases that may iterate.
- The Azure pack has an **architect ⇄ ops** cycle for "design → deploy → review post-deploy".
- Triage is the only **router** — it has 5 outgoing handoffs and no incoming ones (other than the user's first message).

### `asTools` (consultations)

```
core.triage    ⇄ aks.architect   (max 3 turns) — "AKS topology, networking, workload placement, node pools"
core.triage    ⇄ azure.architect (max 3 turns) — "Azure resource design, cost estimation, infrastructure"

core.codesmith ⇄ core.reviewer   (max 3 turns) — "Inspect a specific file or code snippet mid-generation"

aks.architect  ⇄ azure.architect (max 3 turns) — "Cross-domain (VNET peering, DNS, Private Link)"
aks.architect  ⇄ core.codesmith  (max 5 turns) — "Generate infrastructure code mid-diagnosis"
```

**Observations:**
- `asTools` is **directional**: triage can consult the architects, but the architects cannot consult triage back (no wiring for it). This is intentional — triage is a router, not a domain.
- `aks.architect` can consult `azure.architect` (cross-cloud-domain), but the inverse isn't wired. If `azure.architect` needs AKS-specific input, it currently has to *handoff* (which is heavier than necessary). **Phase 2 should consider adding `azure.architect ⇄ aks.architect` asTools wiring.**
- `core.codesmith ⇄ aks.architect` (max 5) is the longest budget — generation often requires multiple infrastructure decisions in flight.

### `core.emit_ui`

Available on every agent (every agent declares it in `tools:`). The wiring isn't a graph — it's a tool with the rules in [Tool Usage Framework Category 5](./tool-usage-framework.md#category-5-ui-emission-emit_ui-show_card-show_form-confirm-navigate).

---

## Worked scenarios

These are the ten scenarios most likely to surface a coordination decision. Each is structured as: **situation → wrong vehicle (and why) → right vehicle (and why)**.

### Scenario 1 — Vague initial request

> User to triage: "Help me with cloud stuff."

- **Wrong:** Hand off to `azure.architect` immediately. The architect inherits a totally unscoped task and has to start from scratch.
- **Wrong:** Answer in prose ("What kind of cloud stuff?"). Three tracks become five tracks become a wall of prose.
- **Right:** Emit `TrackPicker` (UI). Q2 fires — user must pick between 4 options.

### Scenario 2 — Triage needs cost for an inferred design

> Triage on agentic_app, needs to tell the user "Foundry will cost ~$X/mo" before they pick a backend.

- **Wrong:** Hand off to `azure.architect` to get the cost. The user then has to re-explain everything to the architect, who'll likely hand back.
- **Wrong:** Triage guesses a cost from training. Numbers will be stale.
- **Right:** `asTools` `ask_azure_architect("monthly cost of Foundry GPT-4o, p50 traffic, eastus2")`. Q3 fires — bounded answer, conversation stays with triage.

### Scenario 3 — Architect about to commit to a design

> `aks.architect` has drafted the cluster topology and wants the user to approve before handing off to `aks.manifests_author`.

- **Wrong:** Hand off straight to `aks.manifests_author`. The user hasn't agreed, so the manifests may bake in choices the user would have rejected.
- **Wrong:** Ask in prose ("Does this look right?"). The architect's prompt explicitly mandates a `SummaryCard` + `ArchitectureDiagram` for visual approval.
- **Right:** `core.emit_ui` with `SummaryCard` containing the diagram and approve/revise buttons. Q2 fires.

### Scenario 4 — Codesmith uncertain about a generated file

> `core.codesmith` produced a Dockerfile but isn't sure about a multi-stage choice.

- **Wrong:** Emit the file and hope the reviewer catches it. Wastes a downstream phase.
- **Wrong:** Hand off to `core.reviewer` mid-generation. Reviewer gets an incomplete artifact.
- **Right:** `asTools` `ask_reviewer("review this snippet for multi-stage best practice")`. Q3 fires — reviewer responds, codesmith continues.

### Scenario 5 — Plan approved, files needed

> `azure.architect` has the plan approved by the user. Next step: produce the Bicep + supporting files.

- **Wrong:** Architect generates the files itself. Codesmith exists for this; architect's tool list doesn't include `write_file`.
- **Wrong:** `asTools` to codesmith. The work is too big (whole file set) to fit `maxTurns: 5`.
- **Right:** Handoff to `core.codesmith` with the approved plan in the handoff prompt. Q4 fires.

### Scenario 6 — User wants to deploy

> `azure.architect` plan is reviewed. User says "let's deploy".

- **Wrong:** Architect deploys directly (it doesn't have `arm_deploy_resource` in its tools — would error).
- **Wrong:** `asTools` to `azure.ops`. The deploy is the whole next phase, not a side question.
- **Right:** Handoff to `azure.ops`. Q4 fires.

### Scenario 7 — Ops about to delete a resource

> `azure.ops` has run `what_if`, sees a deletion, needs explicit user OK.

- **Wrong:** Run `arm_delete_resource` and assume the user is fine because they said "deploy".
- **Wrong:** Ask in prose ("Are you sure?"). Easy to miss; not a structured signal.
- **Right:** `core.confirm` (UI). Q2 fires — confirmation is a structured action, not prose. (Per [Tool Usage Framework Category 4](./tool-usage-framework.md#category-4-write--mutation-write_file-arm_deploy_resource-arm_update_resource-arm_delete_resource): every `arm_delete_resource` MUST have an explicit `core.confirm` in the immediately preceding turn.)

### Scenario 8 — Cross-domain question during AKS architecture

> `aks.architect` needs to know if a Private Link to Azure OpenAI is supported in the user's region.

- **Wrong:** Architect guesses from training. Knowledge is regional and changes.
- **Wrong:** Hand off to `azure.architect`. The conversation is mid-AKS-design; bouncing breaks flow.
- **Right:** `asTools` `ask_azure_architect("private link to Azure OpenAI in westeurope?")`. Q3 fires — wiring exists for exactly this.

### Scenario 9 — Reviewer finds a blocker

> `aks.reviewer` runs `validate_safeguards` and finds a violation that requires manifest changes.

- **Wrong:** Emit the verdict and end. The user is stuck deciding what to do.
- **Wrong:** Reviewer fixes the manifest. Reviewer doesn't have authoring tools (no `write_file`, no `gen_*`).
- **Right:** Handoff to `aks.manifests_author` with the verdict in the handoff prompt. Q4 fires; the existing wiring supports this exact transition.

### Scenario 10 — User changes their mind mid-flow

> Mid-conversation, with `aks.architect` active, the user says "actually, let's use Azure Container Apps instead of AKS".

- **Wrong:** `aks.architect` tries to talk the user out of it. Not its job.
- **Wrong:** `asTools` to `azure.architect`. The whole phase is changing, not a single question.
- **Right:** Handoff *back to triage* — except triage isn't an inbound handoff target in the current wiring. So: handoff to `azure.architect` directly, with a handoff prompt that explains the reversal and includes whatever requirements were gathered. (This is a wiring gap worth fixing in Phase 2 or 3: any agent should be able to hand back to triage when the track itself flips.)

---

## Anti-patterns

### AP1 — Handoff mid-clarification

Handing off while a question is still open. The receiving agent inherits an unanswered question and either re-asks (wastes user time, anti-pattern A6 in the requirement-gathering doc) or guesses.

**Fix:** finish the clarification before handing off. If you can't, use `asTools` to ask the specialist for a *recommendation* you can present — the user still answers you, then you hand off cleanly.

### AP2 — `asTools` for a phase-sized job

Calling `asTools` on what should be a handoff. The consultant runs out of `maxTurns`, you keep retrying, the user notices the bouncing.

**Fix:** if a consultation needs >3 turns, hand off. If `maxTurns: 5` is also tight, the work is genuinely a phase — not a question.

### AP3 — Handoff for what should be `asTools`

Handing off when you only need a 1-turn answer. The user notices the speaker change and the receiving agent's preamble.

**Fix:** if the answer is bounded and you'll incorporate it, use `asTools`. The user shouldn't see a phase change for a sub-question.

### AP4 — Prose for what should be UI

Listing 5+ choices in prose, or asking the user to "describe their deployment config" instead of emitting a `Questionnaire`.

**Fix:** see the [Component Selection Framework](./component-selection-framework.md) decision tree.

### AP5 — UI for what should be prose

Emitting a `ButtonGroup` with [Yes / No] for a casual yes/no question. The component overhead exceeds the question's weight.

**Fix:** prose. Save UI for choices the user would otherwise mistype or miss.

### AP6 — Direct answer when consultation was warranted

Triage answering an Azure pricing question from memory. Numbers go stale; the user trusts the answer because it sounded confident.

**Fix:** `asTools` to the specialist, or refuse to answer ("I'd want to check live pricing — let me consult azure.architect").

### AP7 — Consultation when direct answer was fine

`asTools` to `azure.architect` to ask "what is a VNET?". Wastes a turn; the consultant has nothing to add over prose.

**Fix:** if you can answer correctly without fresh data or domain expertise, just answer.

### AP8 — Ping-pong handoffs

A → B → A → B within four turns. Both agents think the other has the next move. Conversation stalls.

**Fix:** name the loop in the next handoff prompt ("Returning because X needs Y; please make a call and don't bounce back"). If structurally one of them doesn't have what's needed, that's a wiring or prompt bug — file it; don't loop.

### AP9 — Silent handoffs

Handing off without a self-contained handoff prompt. The receiving agent has no idea what the user said three turns ago.

**Fix:** the handoff `prompt:` field is the *briefing*. Include: what the user wants, what's been decided, what's still open.

### AP10 — Re-entrant `asTools`

Using `asTools` to call an agent that's currently calling you back via `asTools`. Race; usually returns stale state.

**Fix:** the wiring is directional for a reason. If two agents both need to consult each other in one turn, restructure the work — usually one of them should be doing it and consulting once.

---

## Wiring gaps to consider for Phase 2/3

These are limitations in the current handoff/asTools graph that the audit surfaced. They aren't Phase 1 deliverables; they're recommendations for the consensus checkpoint.

| Gap | Impact | Suggested fix |
|---|---|---|
| `azure.architect` cannot consult `aks.architect` via `asTools` | Cross-cloud-domain questions in Azure conversations require a heavyweight handoff | Add `asTools` wiring (max 3 turns) symmetric to the existing `aks.architect → azure.architect` |
| No handoff back to `core.triage` | If the user changes track mid-conversation, the current agent has no clean way to re-route | Add `triage` as a handoff target on every architect; or introduce a "track change" event in the harness |
| `core.codesmith` has no handoff to `core.reviewer` | Codesmith's only review path is `asTools` (max 3 turns); a full review pass requires the harness's auto-reviewer hook | Add explicit `codesmith → reviewer` handoff for cases where the user wants formal sign-off |
| `github.publisher` has no `asTools` for cost or design questions | If the user asks "before publishing, what does this cost monthly?", publisher has to answer or refuse | Add `asTools` to `azure.architect` (max 3) |
| `aks.reviewer` cannot escalate to `core.reviewer` for cross-pack policy checks | AKS-specific reviewer has narrower scope than core reviewer | Either consolidate reviewers (Phase 3 architecture work) or add the wiring |

---

## Audit checklist (for Phase 2 reviewers)

When reviewing a refactored agent prompt, verify:

- [ ] Every place the prompt says "consult X", check whether X is wired as `asTools` for this agent. If not, the prompt is unimplementable.
- [ ] Every place the prompt says "hand off to Y", check whether Y is in the agent's `handoffs:` array. Same constraint.
- [ ] Every `core.emit_ui` invocation has a clear *next user action* in mind (Q2 of the matrix, not Q1 or Q3).
- [ ] No mid-clarification handoffs (AP1).
- [ ] No prose-where-UI-is-clearer (AP4) — cross-checked against [Component Selection Framework](./component-selection-framework.md).
- [ ] No `asTools` calls budgeted for whole-phase work (AP2).
- [ ] Handoff prompts are self-contained briefings (AP9) — no "you'll figure it out" handoffs.

---

## Success criteria

This decision matrix is doing its job when:

- The four-way choice (prose / UI / asTools / handoff) is consistent across agents for the same situation.
- Agent prompts cite the matrix instead of restating it locally with subtle drift.
- The wiring graph in this doc matches the wiring in agent frontmatter (kept in sync as part of any agent-prompt change).
- Reviewers (and Phase 3 telemetry) can detect AP1–AP10 mechanically, not by judgement.
- Wiring gaps surfaced by reviewers feed into the table above and become explicit Phase 2/3 work, not silent workarounds.

---

## Cross-references

- [Component Selection Framework](./component-selection-framework.md) — *which* component to emit when Q2 fires.
- [Tool Usage Framework](./tool-usage-framework.md) — Category 5 rules for when `core.emit_ui` is the right tool at all; Category 4 hard rules for mutation safety.
- [Requirement-Gathering Methodology](./requirement-gathering-methodology.md) — anti-patterns A6 (re-asking after handoff) and C3 (ping-pong) align with AP1, AP8, AP9 here.
