---
sidebar_position: 4
---

# Skill Injection

Per-turn skill delivery is how packs deliver domain knowledge to agents without
bloating every turn with all possible context.

> **Source:** `packages/pack-core/src/tools/read_skill.ts`, `packages/harness/src/runtime/runner.ts`

## How It Works (v5 — pull-based, #1070)

The main LLM is the router. Every turn, the runner:

1. Lists every skill whose `appliesTo` glob matches the active agent in the
   system prompt under the heading
   `## Available Skills (call core.read_skill(id) to load the full body)`.
   Each entry is a one-line `- **id**: description` bullet.
2. Registers `core.read_skill(id)` on the agent as a harness-provided
   universal tool (not in any pack's `toolAllowlist` — policy exception).
3. When the model calls `core.read_skill({ id })`, the harness:
   - Re-checks `matchesSkill(agent, skill)` (fail-closed allowlist).
   - Enforces a per-turn byte cap (default 50 KiB; `KICKSTART_SKILL_READ_MAX_BYTES_PER_TURN`).
   - Returns `{ ok: true, id, body, tokenCount }` on success, or a structured
     `{ ok: false, error, message }` on failure (never throws).
   - Records the id in `session.skillsPulled` for D12 telemetry.

The model chooses which skills matter based on full conversation context.
Repeated reads of the same id within a turn return the cached body without
re-charging the byte budget.

> **Security note for pack authors:** SKILL.md bodies are LLM-visible whenever
> the model reads them via `core.read_skill`. Do **not** embed secrets, API
> keys, or customer data in skill content.

## Skill Authoring

Skills live in `SKILL.md` files inside pack `skills/` directories:

```markdown
---
name: AKS Node Pool Sizing
appliesTo: "aks.*"
keywords:
  - node pool
  - vm size
  - cluster scaling
priority: 80
---

When recommending node pool sizes for AKS Automatic, prefer ...
```

| Frontmatter field | Required | Description |
|---|---|---|
| `name` | ✅ | Human-readable skill name |
| `appliesTo` | ✅ | Agent name glob — which agents receive this skill |
| `keywords` | ✅ | Currently unused by the pull model (reserved; #1070 v5) |
| `priority` | optional | Currently unused by the pull model (reserved; #1070 v5) |

## Where Skills Live

| Pack | Skills directory |
|------|-----------------|
| `pack-core` | `packages/pack-core/src/skills/` |
| `pack-azure` | `packages/pack-azure/src/skills/` |
| `pack-aks-automatic` | `packages/pack-aks-automatic/src/skills/` |
| `pack-github` | `packages/pack-github/src/skills/` |

Skills are loaded at pack registration time by the `SKILL.md` loader in `packages/harness/src/runtime/loader-skill.ts`.


