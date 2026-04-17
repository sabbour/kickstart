---
sidebar_position: 5
---

# Contributing

Kickstart is built using the [Squad framework](./../) for AI-guided development. Here's how to contribute.

## Adding New A2UI Components

To add a component to the Kickstart catalog:

1. Define the component type and data model in `packages/core/src/catalog/`
2. Implement the React renderer in `packages/web/src/catalog/components/`
3. Register the component in the catalog registry
4. Update the system prompt to teach the AI when and how to use the new component
5. Add documentation to `docs-site/docs/components/`

## Adding New Conversation Phases

The conversation flow is defined in `packages/core/src/engine/phases.ts`. To add a phase:

1. Create a new phase definition file
2. Add transition rules from adjacent phases
3. Update the system prompt with phase-specific instructions
4. Add any phase-specific A2UI components
5. Test the flow end-to-end

## Extending the System Prompt

The system prompt lives in `packages/core/src/prompts/`. Key guidelines:

- Keep phase instructions focused and concise
- Use structured output format (JSON envelope) consistently
- Hide Kubernetes jargon in early phases (Discover, Design)
- Include A2UI component examples for each phase

## Testing

| Package | Tool | Command |
|---------|------|---------|
| `packages/core` | Vitest | `npm run test` (from root) |
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
