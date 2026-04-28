# Requirement-Gathering Methodology

**Status:** Phase 1 Documentation | **Scope:** Every agent that asks the user *anything* (currently triage, architects, ops, publisher; future specialists).

---

## Purpose

The current state: **only `core.triage` has an explicit requirement-gathering policy.** Every other agent in the system gathers requirements ad-hoc, with no shared rules. That's the inconsistency the audit flagged.

This document promotes triage's existing policy to a system-wide methodology and adds the cross-agent rules (handoff context, defaults, escalation) that triage alone can't enforce.

What it is *not*: a script of which questions to ask. The actual questions live in agent prompts; this document defines **how many**, **in what order**, **in what shape**, and **when not to ask at all**.

---

## The Five Rules

These are the load-bearing rules. Everything else in this doc is illustration or per-agent specialisation.

### Rule 1 — One question per turn

Never bundle multiple prose questions into one response. A `Questionnaire` component is one *artefact*, not multiple questions — emit it as a single surface, then wait. Two prose questions ("What region? Also what SKU?") in one turn is a violation.

### Rule 2 — Hard cap of three questions per agent per phase

After three questions in the current agent's phase, **forced action**: route, hand off, or generate using best-fit defaults. The cap counts prose-questions, A2UI-form-submissions, and confirm dialogs equally. The cap **resets on handoff** — the next agent starts at zero. (Cross-agent ping-pong reuses budget; see Rule 5.)

### Rule 3 — Discriminating value first

If you must ask, ask the question whose answer would change *which agent next handles this* or *what architecture/platform you'd recommend* — before any question that only changes parameters or names. Cosmetic questions are forbidden until the structural ones are answered.

### Rule 4 — Don't ask what you can infer or default

If the user's words, the repo content, or a sensible default already answer the question, don't ask. State the assumption transparently ("Defaulting to AKS Automatic — say 'standard' to override") and continue.

### Rule 5 — Zero questions is a target, not a fallback

If the user's first message is sufficient to route, route. Don't ask "just to confirm". Confirmation friction is real; mistakes are correctable.

---

## Why these rules (the discriminating-value model)

A clarification has a cost: user time, user attention, and abandonment risk. It has a benefit: information that changes what the agent does next. The rules above are the operational form of *only ask when benefit > cost*:

- Rule 1 keeps each ask atomic so the user can answer in flow.
- Rule 2 puts a ceiling on cumulative cost.
- Rule 3 maximises benefit-per-question by ordering on impact.
- Rule 4 avoids questions whose benefit is zero (you already knew the answer).
- Rule 5 normalises the zero case as the goal, not a happy accident.

This is the same lens the [Tool Usage Framework](./tool-usage-framework.md) applies to tool calls. Calling tools and asking questions are both ways of reducing uncertainty — the discriminating-value test is the unified rule.

---

## Question shape: prose vs A2UI

When you've decided to ask, choose the right vehicle.

| Use **prose** | Use a **UI surface** |
|---|---|
| Free-form answer (URL, name, a paragraph of intent) | 3+ discrete options |
| 1–2 obvious options inline ("AKS or AKS Automatic?") | Structured input that benefits from typed fields |
| Follow-up clarifying a previous prose answer | Multi-select or grouped choices |
| You're mid-conversation and want to maintain flow | A first impression / branching point (TrackPicker) |

Specific cross-references:
- For *which component* to emit, see the [Component Selection Framework](./component-selection-framework.md).
- For *whether `core.emit_ui` should fire at all*, see the **Category 5: UI emission** rules in the [Tool Usage Framework](./tool-usage-framework.md).

The current triage prompt enforces an important sub-rule under `repo_uplift`: **do not bundle the inspect_repo questionnaire array into a single multi-field form** — ask the most important one in prose, re-evaluate, then maybe ask the next. That's Rule 1 + Rule 3 in practice; it generalises: a Questionnaire is for inputs the user must answer *together*, not for whatever questions the agent has on its mental list.

---

## Switching mid-conversation

You can switch between prose and UI freely; what matters is each switch has a reason.

- **Prose → UI** when the option set grows past two ("Let me show you the available tracks." → emit `TrackPicker`).
- **UI → Prose** when a UI selection prompted a follow-up that doesn't fit a form ("You picked `kaito`. What model family are you targeting?" — prose, even though `core.search_kaito_models` will be called next to ground the answer).
- **Surface re-use over surface proliferation.** When you re-ask on the same logical surface (e.g., `shared:triage-main`), update components on the existing surface; don't `createSurface` a new one each turn.

---

## Inferred defaults

Defaults are how Rule 4 is enforced in practice. The table below lists current and proposed defaults across agents. Any default in **bold** is enforced by an existing prompt; the rest are *recommended* (for adoption in Phase 2).

| Question | Default | Override trigger | Source |
|---|---|---|---|
| Inference backend (agentic_app) | **`foundry`** | User mentions self-host, OSS weights, or BYO endpoint | triage prompt — `pick_track` handler |
| Cluster type (AKS) | AKS Automatic | User mentions Standard or "I want my own node pools" | recommended |
| Resource group naming | `<app-name>-rg` | User specifies | recommended |
| Container registry | New ACR `<app-name>cr` | User mentions an existing registry | recommended |
| Region | User's home subscription region; fallback `eastus2` | User mentions a region | recommended |
| K8s namespace | `default` for single-app, `<app-name>` for multi-app | User specifies | recommended |
| Bicep vs ARM | Bicep | User mentions ARM JSON specifically | recommended |
| GitHub branch | `main` | User specifies | recommended |
| Inference model (KAITO) | None — must call `core.search_kaito_models` | n/a (always live-look-up) | triage prompt — `select_inference` `kaito` |

**Surface defaults transparently.** When the agent uses a default, mention it in one sentence. Hidden defaults erode trust the first time they bite.

---

## Question priority order

When Rule 3 says "discriminating value first", this is the ordering. Questions higher on the list rule out more downstream questions, so they're cheaper to *answer* (one answer cascades) and cheaper to *not-ask* (their absence blocks more).

| Rank | Question class | Why it's high | Asked by |
|---|---|---|---|
| 1 | **Track** (which app type) | Determines which specialist handles the rest | triage |
| 2 | **Repo presence** (existing code or scratch) | Determines `inspect_repo` vs scaffold | triage |
| 3 | **Inference backend** (agentic only) | Determines AKS vs Foundry vs generic deployment shape | triage |
| 4 | **Cloud target** (subscription / region) | Required for any provisioning | architects |
| 5 | **Acceptance criteria** ("done" definition) | Sets plan scope | any |
| 6 | **Constraints** (budget, compliance, deadline) | Affects design tradeoffs | architects |
| 7 | **Cosmetic** (names, casing) | Default-friendly; rarely worth asking | none, ideally |

Stop asking once you have enough to route or design. **You do not need answers from every level** — most conversations get to "enough" in 1–2 questions.

---

## Worked examples

### Example 1 — Crystal-clear request (0 questions)

> User: "Deploy this React static site (`https://github.com/me/site`) to Azure Static Web Apps in `eastus2`."

Agent (triage): immediately route to `azure.architect` with full context. **No question.** No "just to confirm". The user gave you levels 1, 2, 4 and an implicit 6 (the SWA SKU choice signals their cost tolerance).

### Example 2 — One discriminating question (1 question)

> User: "I want to build a chatbot for my team."

Triage analysis:
- Level 1 (track): `agentic_app` (clear from "chatbot")
- Level 3 (inference backend): missing — and this is the next decision
- Levels 4–6: defaultable

Triage emits the inference backend `RadioGroup` with `value: "foundry"` pre-selected. One UI ask, one user click, then route.

### Example 3 — Vague request (2–3 questions, one via UI)

> User: "Help me deploy something to Azure."

Triage:
1. Emit `TrackPicker` (level 1). User picks "Containerized Web App".
2. Prose: "Existing repo or starting fresh?" (level 2). User pastes a repo URL.
3. `inspect_repo`, then route to `azure.architect`.

Two questions, hard cap not even threatened.

### Example 4 — Hard cap hit (3 questions, then forced action)

> User: "I need help with cloud stuff."

Triage:
1. `TrackPicker` → user: "An app, I think."
2. Prose: "Web app, API, agent, or something else?" → user: "I dunno."
3. Prose: "Existing code or starting fresh?" → user: "Fresh I think."

**Cap hit.** Route to triage's best guess (`containerized_web` on Azure default region) with a one-line note: "Routing as containerized web on Azure default region — say more if that's wrong." The receiving specialist starts at zero questions.

### Example 5 — Default surfaced (0 questions, transparent)

> User: "Set up an AKS cluster for an internal tool."

`aks.architect`:
- Defaults to AKS Automatic, single user node pool, Gateway API ingress.
- Emits the plan summary surface (per the architect's existing prompt) with the defaults visible in the `SummaryCard`.
- One sentence: "I've defaulted to AKS Automatic with one user node pool. Click 'Revise' if you need a Standard cluster or different topology."

Zero questions, no friction, full transparency.

---

## Cross-agent rules

The cap *resets* on handoff (Rule 2), but a few cross-agent constraints stop that from being abused.

### C1. Handoff context carries answered questions

The `prompt:` field on a handoff (in agent frontmatter) must include the answers already given by the user — *not* re-ask them in the receiving agent. If triage asked "which inference backend?" and got `foundry`, the handoff prompt to the architect must say so. The receiving agent treats those answers as authoritative and never re-asks.

### C2. No question in the handoff prompt itself

The handoff prompt is for *briefing*, not *querying*. If the receiving agent needs more info, it asks once it's in the conversation — counted against its own cap, not the previous agent's.

### C3. Ping-pong is a smell

If A → B → A → B happens within four turns, the workflow is broken. The fix is structural: either A should have used `asTools` to consult B without handing off, or A's job was incomplete and B should not have been called yet. Reviewers (and Phase 3 telemetry) should flag this.

### C4. `asTools` consultations don't count against the user's cap

When agent A calls `ask_<specialist>` via `asTools`, the specialist's questions to A are agent-to-agent, not agent-to-user. They don't burn user-question budget. They do count against `maxTurns` on the asTool wiring (typically 3–5).

---

## Per-agent application

The **triage** rules apply universally; per-agent notes capture where each specialist's phase has its own constraints.

### `core.triage`
- Phase: track selection, backend selection, repo inspection, initial routing.
- Cap: 3 (already enforced in prompt).
- Priority: levels 1 → 2 → 3 from the priority table.
- UI defaults: `TrackPicker` for level 1 ambiguity, `RadioGroup` for level 3, prose for level 2.
- Forbidden: multi-field Questionnaire on `repo_uplift` (per existing prompt — ask single question from `inspect_repo.questionnaire` array).

### `core.codesmith`
- Phase: file generation. Already has clear inputs from the plan.
- Cap: 1, and only for scope narrowing ("which files first?").
- Priority: acceptance criteria > naming convention.
- Defaults: derive from inspected repo (file naming, frameworks, license).
- Forbidden: re-asking architectural questions answered upstream.

### `core.reviewer`
- Phase: validation.
- Cap: 0–1. Reviewer asks only when surfacing a finding the user must adjudicate ("block on this warning, or ship?").
- Priority: blocking issues only.
- Forbidden: open-ended "anything else?" questions.

### `azure.architect`
- Phase: Azure resource design + cost estimation.
- Cap: 3, owned by the architect (separate budget from triage).
- Priority: subscription/region (level 4) → SLA/availability tier (level 5) → cost ceiling (level 6).
- Defaults: home-subscription primary region; Bicep over ARM; managed services over self-hosted equivalents; `validate_bicep` on every snippet shown to the user.
- Forbidden: asking the user to *paste* secret values; ask for secret *names* and reference them via Key Vault.

### `aks.architect`
- Phase: cluster design + workload placement.
- Cap: 3, owned by the architect.
- Priority: cluster type (Automatic vs Standard) → workload identity model → ingress topology.
- Defaults: AKS Automatic, single user node pool, Gateway API + `HTTPRoute`, Azure Workload Identity for any Azure-resource access.
- Forbidden: asking the user to choose between `secretKeyRef` and Workload Identity (per existing prompt: never recommend `secretKeyRef` for Azure credentials — Workload Identity is mandatory).

### `aks.manifests_author`
- Phase: YAML generation. Inputs come fully from the architect's plan.
- Cap: 0 in steady state. If something is genuinely missing, hand back to the architect rather than asking the user directly.

### `aks.reviewer`
- Phase: safeguard + policy review.
- Cap: 0–1. Like core.reviewer, only ask when the user must adjudicate a non-blocker.
- Forbidden: skipping `validate_safeguards` because of a perceived urgency.

### `azure.ops`
- Phase: deployment.
- Cap: 1 — only the explicit deploy confirmation (post `what_if`).
- Priority: review the diff, then ask "Apply?".
- Forbidden: deploying without showing the `what_if` first; deleting anything without an explicit `core.confirm` in the immediately preceding turn.

### `github.publisher`
- Phase: PR creation.
- Cap: 1, structural — target repo (org/repo) and branch (default `main`).
- Priority: target repo > branch.
- Defaults: `main` for branch, current org from `github:login`, new repo only if `github:pick_repo` returns nothing.
- Note: most "questions" here are user actions (`github:pick_org`, `github:pick_repo`), not LLM prompts — they don't count against the cap because they're click-not-type.

---

## Anti-patterns

### A1. The interview
Asking 5+ questions in a row before doing anything ("region?", "SKU?", "redundancy?", "compliance?", "budget?"). Violates Rules 1, 2, 3.

**Fix:** ask the single highest-value question. Default the rest, surface the defaults, let the user override.

### A2. Confirmation theatre
"Got it — you want a static site, correct?" after the user said "deploy this static site". Violates Rule 5.

**Fix:** trust the user input. If they meant something else they'll correct you.

### A3. Asking what's already in front of you
Asking "do you have a Dockerfile?" when `inspect_repo` already returned `dockerfile: true`. Violates Rule 4.

**Fix:** read tool outputs before asking. Cite the tool when you use the answer ("I see your repo has a Dockerfile, so…").

### A4. Bundled questions
"What region, what SKU, and what storage type?" Violates Rule 1.

**Fix:** ask the highest-priority one. The others get defaults.

### A5. Cosmetic-first asking
Asking "what should we name the resource group?" before establishing the workload type. Violates Rule 3.

**Fix:** name with a convention. Move on.

### A6. Re-asking after handoff
The architect re-asks "which inference backend?" after triage already routed with `foundry` selected. Violates C1.

**Fix:** the receiving agent reads the handoff prompt as authoritative input. If triage didn't put it there, that's a triage bug to file — but don't burn the user's time fixing it in the architect by asking again.

### A7. Stale defaults
Continuing to use `eastus2` after the user said "I'm in westeurope". Violates Rule 4 (a stated answer beats a default).

**Fix:** any user-stated value supersedes the corresponding default for the rest of the conversation.

### A8. The hidden default
Defaulting to AKS Automatic without saying so, then surprising the user when they wanted Standard. Violates the transparency clause of Rule 4.

**Fix:** every default-in-use gets one sentence acknowledging it.

### A9. Prose where UI is clearer
Listing 6 tracks in prose. Violates the prose-vs-UI guidance.

**Fix:** emit `TrackPicker`. (And see the [Component Selection Framework](./component-selection-framework.md).)

### A10. Cap evasion via UI
Treating a 6-field Questionnaire as "one question" because it's one form. Violates the spirit of Rule 1, especially when the fields aren't tightly coupled.

**Fix:** Questionnaire is for fields the user must answer *together* (e.g., region + SKU + zone redundancy on the same resource). Sequential prose is for fields the user can answer one at a time as their thinking evolves.

---

## Audit hooks (for Phase 2 reviewers, Phase 3 telemetry)

When reviewing a refactored agent prompt, ask:

- [ ] Does it cite this methodology, or restate the rules locally?
- [ ] Does its question priority match the priority table for its phase?
- [ ] Are defaults explicit and listed somewhere the agent can reference?
- [ ] Is the "Forbidden" list for that agent encoded as anti-patterns?
- [ ] If it asks more than 0 questions, does each question pass the discriminating-value test?

When designing telemetry (Phase 3):

- Per agent, log: question count per turn, total per phase, whether the cap was hit, whether the cap-hit forced-action led to a successful conversation.
- Per handoff, log: whether the receiving agent re-asked anything that was in the handoff prompt (anti-pattern A6).
- Per conversation, log: ping-pong count (A→B→A within N turns) — anti-pattern C3.

These hooks aren't Phase 1 deliverables, but Phase 1 prompts should be written so the data is recoverable when telemetry lands.

---

## Success criteria

This methodology is doing its job when:

- Median user-facing questions per agent per phase is ≤ 1.
- The cap (3) is rarely hit (>80% of conversations finish their phase in <3 questions).
- Same scenario produces the same questions across agents (consistency, not coincidence).
- Defaults are stated transparently and used silently when the user hasn't overridden them.
- Receiving agents never re-ask what triage already routed with.
- Refactored agent prompts (Phase 2) cite this document instead of restating the rules.

---

## Next steps

1. **Audit the existing prompts** — count current questions per phase, identify violations of A1–A10 above. (Triage already conforms; specialists likely don't.)
2. **Author the per-agent default lists** — turn the recommended defaults in the table above into agent-specific frontmatter or skill content for Phase 2.
3. **Draft Phase 2 prompt language** — replace per-agent question scripts with a single reference to this methodology + a list of agent-specific defaults and forbidden questions.
4. **Hook telemetry in Phase 3** — implement the audit-hook logs above so the success criteria are measurable, not assumed.
