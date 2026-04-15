---
name: server-model-routing
description: Server-side allowlist routing for multi-model backend conversation flows
last_updated: 2026-04-15T15:20:19+00:00
---

# Server Model Routing

Use this pattern when a backend conversation endpoint needs different LLM deployments for different phases or task classes without exposing model choice to the client.

## Rules

1. Use an existing server-owned phase/task signal as the primary routing input.
2. Keep the router as an allowlist: route only explicitly approved phases to the specialist model.
3. Treat client-rehydrated phase metadata as untrusted for routing. UX restoration is fine; model escalation is not.
4. Fail closed: unknown or invalid phase values fall back to the default chat model.
5. Apply the same routed deployment everywhere in the request lifecycle:
   - initial non-streaming completion
   - tool-call rounds
   - streaming probe/final flow
   - continuation retries
6. Reuse existing deployment helpers and env config instead of adding a new policy surface.

## Kickstart reference

- Router helper: `packages/web/api/src/lib/converse-model-router.ts`
- Trusted phase flag: `packages/web/api/src/lib/session-store.ts`
- Endpoint wiring: `packages/web/api/src/functions/converse.ts`
- Tests: `packages/web/api/src/functions/converse.test.ts`
