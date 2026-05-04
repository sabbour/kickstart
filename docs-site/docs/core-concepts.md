---
sidebar_position: 2
---

# Core Concepts

Ten minutes to understand Kickstart. Read this before diving into the code.

## The conversation is the deployment pipeline

Kickstart replaces a CI/CD configuration wizard with a conversation. You describe your application in plain language; the AI translates that into a concrete architecture, generates deployment artifacts, and walks you through execution — step by step.

There is no YAML to hand-author. The conversation *is* the pipeline.

## Phases

Every Kickstart session moves through a fixed sequence of phases:

| Phase | What happens |
|-------|-------------|
| **Discover** | The agent collects your app's language, framework, port, and dependencies |
| **Design** | It proposes an AKS Automatic architecture suited to your inputs |
| **Generate** | Dockerfile, Kubernetes manifests, and a GitHub Actions workflow are created |
| **Review** | You inspect and edit every artifact before anything is deployed |
| **Handoff** | The deployment pipeline is prepared and secrets are staged |
| **Deploy** | The agent executes the deployment against your cluster |

Each phase has a defined entry condition and a typed handoff message that triggers the next phase. No phase is skipped silently.

## Packs

A **pack** is the main extension point. Each pack bundles:

- **Skills** — LLM-callable tools scoped to a domain (e.g., AKS cluster introspection)
- **Components** — React UI elements the agent can render inline in the conversation
- **Prompts** — System prompt fragments injected for the pack's phase

The core repository ships one pack (`pack-aks-automatic`). You can add your own by following the [Pack Authoring Guide](/docs/pack-authoring).

## The harness

The **harness** is the runtime layer that loads packs, manages the conversation state machine, and orchestrates calls to the LLM. It is deliberately thin — it does not contain business logic. All domain knowledge lives in packs.

See [Harness Runtime](/docs/architecture/harness-runtime) for the implementation details.

## A2UI

The AI returns structured output (not just text) using the **A2UI v0.9** protocol. The frontend renders this output as interactive cards, progress indicators, code blocks, and forms — directly inside the chat thread.

This is what makes Kickstart feel like a product rather than a chatbot. See [A2UI Integration](/docs/architecture/a2ui-integration).

## Skills vs tools

| Term | Meaning |
|------|---------|
| **Tool** | A function the LLM can call, defined in a pack |
| **Skill** | A higher-level capability built from one or more tools |
| **MCP tool** | A tool exposed over the Model Context Protocol (external process boundary) |

Most packs define tools. Skills are composites. MCP tools are used when the capability lives in a separate process (e.g., a local CLI or a cloud service).

## Next steps

- **New here?** → [Local Setup](/docs/getting-started/local-setup)
- **Want to extend Kickstart?** → [Pack Authoring Guide](/docs/pack-authoring)
- **Curious about the internals?** → [Architecture Overview](/docs/architecture/overview)
