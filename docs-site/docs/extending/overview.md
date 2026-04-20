---
sidebar_position: 1
---

# Extending Kickstart

Kickstart v2 is built on the **harness + packs** model. All domain knowledge lives in packs; the harness is domain-agnostic. Extension means authoring a new pack or contributing to an existing one.

## Extension Points

| What you want to add | Primitive | Where it lives |
|---|---|---|
| A new AI persona | **Agent** (`.agent.md`) | `packages/pack-*/src/agents/` |
| Domain knowledge for agents | **Skill** (`SKILL.md`) | `packages/pack-*/src/skills/` |
| A server-side function the LLM can call | **Tool** | `packages/pack-*/src/tools/` |
| A browser interaction (auth, consent, etc.) | **UserAction** | `packages/pack-*/src/user-actions/` |
| A new A2UI component type | **Component** | `packages/pack-*/src/components/` |
| A cross-cutting check | **Guardrail** | `packages/pack-*/src/guardrails/` |
| A new HTTP endpoint | **Azure Function** | `packages/web/api/src/functions/` |
| IDE tool exposure | **MCP tool** | `packages/mcp-server/src/` |

## Architecture Overview

```
packages/
├── harness/              ← Runtime: pack registry, Runner, SSE, session
│   └── src/runtime/      ← Skill resolver, guardrail engine, catalog
├── pack-core/            ← Base agents, skills, tools, components
├── pack-azure/           ← Azure domain
├── pack-aks-automatic/   ← AKS Automatic domain
├── pack-github/          ← GitHub domain
├── web/api/              ← Azure Functions HTTP layer
└── mcp-server/           ← MCP adapter
```

## Where to Start

- **New LLM capability (no browser interaction)?** → Author a **Tool** in the relevant pack. One file, register in the pack's index, done.
- **Browser popup / credential flow?** → Author a **UserAction**. The harness handles pause/resume automatically.
- **New AI persona?** → Author an `.agent.md` file. Declare its allowed tools and handoff targets in frontmatter.
- **Domain knowledge injection?** → Author a `SKILL.md` file with an `appliesTo` glob targeting the relevant agents.
- **New integration domain** (e.g., a new cloud provider)? → Create a new pack that contributes agents + skills + tools + user actions together. Use the Copilot skill **[create-new-pack](https://github.com/sabbour/kickstart/blob/main/.copilot/skills/create-new-pack/)** to scaffold the pack structure and wiring.
- **New HTTP surface?** → [API Endpoints](./api-endpoints.md) covers the Azure Functions v4 pattern with SSE streaming.
- **IDE integration?** → [MCP Tools](./mcp-tools.md) covers MCP tool authoring for VS Code Copilot and Claude Code.

If you add `.agent.md` or `SKILL.md` files, the build copies them into pack-scoped `pack-assets/{pack}/{agents|skills}/` folders that the emitted server manifest resolves at runtime. All packs now load those bundled assets from `dist/functions/pack-assets/...`, including `pack-github` even though its source markdown lives at the package root. See the [v2 implementation brief](../architecture/v2-implementation-brief.md#bundled-markdown-asset-layout).

## Design Principles

**Packs are the unit of extensibility.** A pack is a sealed bundle registered at startup. The harness is domain-agnostic — it does not know about Azure, AKS, GitHub, or any product domain.

**First-party only.** No plugin sandbox or dynamic loading — all packs are compiled into the monorepo. Everything registered is trusted code.

**Tools have no side effects on their own.** Agents call tools; tools return typed results. Browser interactions go through UserActions, which pause the runner and wait for a browser POST.

**Skills are pure text.** No code, no execution. If you need execution, write a tool.
