---
sidebar_position: 5
---

# Contributing

Kickstart is built using the [Squad framework](./../) for AI-guided development. Here's how to contribute.

## Adding New A2UI Components

To add a component to the Kickstart catalog:

1. Define the component type and data model in the appropriate pack's `src/components/`
2. Implement the React renderer (basic or rich) in the pack
3. Register the component contribution in the pack's index
4. Add documentation to `docs-site/docs/components/`

## Adding New Conversation Phases

See [Conversation Phases](./extending/conversation-phases.md) for the full walkthrough.

In brief:
1. Add a new phase to the `Phase` enum in `packages/harness/src/types/`
2. Add a `PhaseDefinition` entry with `nextPhase` chaining
3. Add phase-specific skills to relevant packs
4. Test the flow end-to-end

## Extending Agent Instructions

Agent instructions live in `.agent.md` files inside each pack's `src/agents/` directory. Skills are `SKILL.md` files in `src/skills/`. Key guidelines:

- Keep agent base instructions concise — skills add the domain detail
- Use `appliesTo` globs to scope skills to the right agents
- Hide Kubernetes jargon in early phases (Discover, Design)

## Testing

| Package | Tool | Command |
|---------|------|---------|
| `packages/harness` | Vitest | `npm run test` (from root) |
| `packages/pack-*` | Vitest | `npm run test` (from root) |
| `packages/web` | Vite build | `cd packages/web && npm run build` |

Run all tests from the repo root:

```bash
npm run test
```

## Branch Naming

Follow the Squad convention:

```
squad/{issue-number}-{kebab-case-slug}
```

Examples:
- `squad/42-add-helm-component`
- `squad/15-fix-sse-streaming`

## Pull Requests

1. Create a branch following the naming convention
2. Make your changes
3. Ensure tests pass: `npm run test`
4. Ensure the build succeeds: `cd packages/web && npm run build`
5. Open a PR against `main`
