---
sidebar_position: 4
---

# Skill Injection

Per-turn skill injection is how packs deliver domain knowledge to agents without bloating every turn with all possible context.

> **Source:** `packages/harness/src/runtime/skill-resolver.ts`

## How It Works

Every turn, `resolveSkills(agentName, context)` runs against all registered skills from all enabled packs:

1. **`appliesTo` glob match** — each `SKILL.md` declares which agents it applies to via the `appliesTo` frontmatter field (e.g., `"azure.*"`, `"core.triage"`).
2. **Keyword scoring** — matched skills are scored against the recent conversation turns. Skills whose keywords appear in recent messages rank higher.
3. **Priority ordering** — ties broken by the `priority` field in skill frontmatter (higher = first).
4. **Token budget** — the resolver caps total injected skill text at 2000 tokens by default. Lower-priority skills are dropped when the budget is exhausted.

Selected skills are appended to the agent's dynamic instructions for that turn only. They are not stored in the session and not part of the conversation history.

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
| `keywords` | ✅ | Terms that boost this skill's score against conversation turns |
| `priority` | optional | Ordering within budget (default: 50) |

> **Using GitHub Copilot CLI?** The Copilot skill **[add-agent-skill](https://github.com/sabbour/kickstart/blob/main/.copilot/skills/add-agent-skill/)** scaffolds new `SKILL.md` files with frontmatter and guides you through authoring the skill content and registering it with an agent.

## Where Skills Live

| Pack | Skills directory |
|------|-----------------|
| `pack-core` | `packages/pack-core/src/skills/` |
| `pack-azure` | `packages/pack-azure/src/skills/` |
| `pack-aks-automatic` | `packages/pack-aks-automatic/src/skills/` |
| `pack-github` | `packages/pack-github/src/skills/` |

Skills are loaded at pack registration time by the `SKILL.md` loader in `packages/harness/src/runtime/loader-skill.ts`.


