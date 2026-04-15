---
name: "mcp-app-schema-isolation"
description: "Keep MCP app server types aligned with the HTML renderer when the shared A2UI catalog diverges"
domain: "mcp,a2ui,typing"
confidence: "high"
source: "observed"
---

## Context

Use this when an MCP server emits A2UI-like payloads to a custom HTML app surface instead of a shared renderer. The common failure mode is importing shared catalog types that no longer match the app's runtime schema.

## Patterns

- Treat the HTML renderer contract as the source of truth for the MCP app surface.
- If the app consumes nested `{ type, children[] }` payloads, keep matching TypeScript interfaces local to the MCP server package.
- Do not import a shared flat catalog (`component`, child IDs) unless the renderer and protocol extraction have been migrated too.
- Validate the full path after type changes: build the MCP server, read the app resource, then drive the `app-message` loop with a real stdio client.

## Examples

- `packages/mcp-server/src/a2ui.ts` should define the local MCP app component interfaces used by tool handlers.
- `packages/mcp-server/src/app/kickstart-app.html` renders components by `schema.type` and walks nested `children`, so shared catalog types from `packages/core` are incompatible without a renderer rewrite.
- `packages/mcp-server/src/app/protocol.ts` returns `doc.root` directly to the app, reinforcing that the emitted JSON must match the HTML renderer's expectations.

## Anti-Patterns

- Importing shared catalog interfaces just because the names look similar.
- “Fixing” type errors by casting incompatible shapes to `any` while leaving the renderer contract unchanged.
- Declaring capability-degradation behavior without verifying the real app-message/resource loop against a running MCP server.
