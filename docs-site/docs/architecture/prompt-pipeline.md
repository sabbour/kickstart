---
sidebar_position: 2
---

# Prompt Pipeline

Every conversation turn dynamically assembles agent instructions before calling the LLM via the `@openai/agents` SDK. This page describes how the harness builds per-turn context.

> **Source files:**
> - `packages/harness/src/runtime/skill-resolver.ts` — per-turn skill resolution
> - `packages/harness/src/runtime/runner.ts` — turn orchestration
> - `packages/web/api/src/functions/converse.ts` — HTTP handler

## Assembly Order

```
POST /api/converse arrives
    │
    ├─ 1. Session lookup or creation
    ├─ 2. Guardrail input check (core/token-budget, etc.)
    │
    ├─ 3. Runner selects active Agent
    │      session.activeAgent ?? "core.triage"
    │
    ├─ 4. Dynamic instructions assembled per turn
    │      = agent.body (base .agent.md text)
    │      + resolvedSkills(agent.name, recentTurns)  ← skill resolver
    │      + catalog snapshot (component type list)
    │
    ├─ 5. Agent streams via SDK — text chunks + tool calls
    │      core.emit_ui → a2ui SSE events
    │      core.write_file, azure.arm_get, etc.
    │
    ├─ 6. UserAction encountered?
    │      → pause, emit user_action_required SSE
    │      → browser acts (MSAL popup, GitHub OAuth, etc.)
    │      → POST /api/converse/resume with typed result
    │      → Runner resumes
    │
    ├─ 7. Guardrail output check
    │
    └─ 8. AgentOutput { message, intent } → SSE done
```

## Skill Resolution

`resolveSkills(agentName, context)` in `packages/harness/src/runtime/skill-resolver.ts`:

1. **Match `appliesTo`** — glob each skill's `appliesTo` field against the current agent name.
2. **Keyword scoring** — score matched skills against the recent conversation turns.
3. **Priority ordering** — sort by `priority` (higher first), apply token budget cap (2000 tokens default).
4. **Inject** — append skill text to the agent's dynamic instructions.

Skills are authored as `SKILL.md` files inside packs. They are pure text — no code, no execution.

## Agent Instructions Structure

```
{agent.body}                     ← base .agent.md text (persona + rules)

## Active Skills
{skill1 text}
---
{skill2 text}

## Component Catalog
{registered component list with schemas}
```

## Triage Interaction Model

The `core.triage` agent follows a **one-question-at-a-time** policy for gathering requirements. This replaces the previous form-dump pattern where all clarification questions were presented in a single multi-field `Questionnaire` component.

### Policy (as encoded in `triage.agent.md`)

| Rule | Detail |
|------|--------|
| One question per turn | Never emit more than one question in a single response |
| Route immediately when clear | If the user's message makes intent unambiguous, route without any questions |
| Re-evaluate after each answer | After receiving an answer, decide whether routing is now possible before asking another question |
| Hard cap | Maximum 3 questions before forced routing, regardless of remaining ambiguity |

### Ordering heuristic

The agent is instructed to ask the **most discriminating question first** — the single piece of information that most reduces routing ambiguity. Examples:

- **`repo_uplift` track:** After `core.inspect_repo` returns its questionnaire array, only the first (highest-value) question is asked. The next is asked only if routing is still ambiguous after the first answer.
- **`kaito` inference:** If the model family is already specified in the user's request, the agent skips the model question entirely and proceeds to routing or asks the next most-important gap.

### Why this matters

User research shows that 3–5 questions presented at once overwhelm users and increase abandonment. The one-Q model keeps each turn focused and allows the agent to route as early as possible — often after 0 or 1 questions.



Guardrails contributed by packs run at three stages:

| Stage | When |
|-------|------|
| `input` | Before the agent receives the user message |
| `tool` | Before each tool call result is returned to the agent |
| `output` | After `AgentOutput` is produced |

Built-in guardrails: `core/token-budget`, `core/content-safety`. Pack guardrails: `azure/no-hardcoded-creds`, `aks/no-privileged-containers`, etc.

