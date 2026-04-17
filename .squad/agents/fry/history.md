# Fry — Frontend Dev

## About Me
Frontend engineer owning web surface and A2UI catalog components. Expertise in React, Fluent UI v9, CSS/Griffel, and streaming UX patterns.

## Key Files
- `packages/web/src/` — React app, Fluent components, catalog, streaming hooks
- `packages/web/src/catalog/fluent-components/` — Fluent UI overrides and custom components
- `packages/web/src/pages/` — Landing, Chat, Playground, Create pages
- `packages/web/css/` — Design tokens, theme system, layout classes

## Patterns
- **Fat A2UI components:** `createReactComponent` factory, `useAPIConnector` hook, `context.dispatchAction`
- **Streaming UI:** `useProgressiveQueue` hook, 150ms stagger reveal, progressive bubble state + ref tracking
- **Theme system:** `ThemeContext` three-state mode, `resolvedTheme`, `useSyncExternalStore` for matchMedia
- **ArchitectureDiagram:** diagram-first contract; `%%icon:name%%` expansion post-render via strict allowlist
- **Playwright:** register `waitForResponse` before `page.goto()`; use `request.post()` for auth E2E tests

## Recent Work (Active Sprint: v2 harness + packs)

Merged chain: **#474✅ → #475✅ → #476✅ → #478✅ → #477(PR #548)✅ → #479(PR #550)✅**

Next up: **#480** (Step 6 Skill Resolver — implementing now), then domain packs **#482 → #483 → #484 → #485 → #486 → #487**

## Learnings (archived detail → history-archive.md)

- Phase allowlist delegates to `normalizeConversationPhase()` from `chat-a2ui.ts`, not a separate set.
- `buildSystemPrompt()` context vars pushed as `## Section` blocks explicitly; `interpolate()` only substitutes `{{placeholder}}` tokens.
- K8s icons: SVGs in `packages/web/public/assets/icons/k8s/`, register via `registerDiagramIcons()`, update `ALLOWED_ICON_KEYS`.
- `ArchitectureDiagram` diagram-first: raw Mermaid in `diagram`, sanitize before render, expand `%%icon:%%` after.

## DP Review History (compact — full table in archive)

| Issue | DP Summary | Status |
|-------|-----------|--------|
| #477 pack-core | Phases A→H; 40 components; emit_ui via Zod | APPROVED; PR #548 ✅ |
| #478 Playground | 4-phase; registry gallery; usePlaygroundDispatch | APPROVED; PR #547 ✅ |
| #479 Runner+SSE | 9 SSE events; writeSSE; useStreaming rewrite | APPROVED; PR #550 ✅ |
| #480 Skill resolver | 4-stage pipeline; estimateTokens; Skill[] | APPROVED |
| #482 pack-azure | 6 phases; azureKit; arm_get regex+denylist | FULLY APPROVED |
| #483 pack-aks-automatic | 3 agents; safeguards.json; workload identity | FULLY APPROVED |
| #484 pack-github | 1 agent; GITHUB_PATH_ALLOWLIST; 6 user actions | FULLY APPROVED |
| #485 web client A2UI | registry Map; FIFO cancellation; UserActionPanel | FULLY APPROVED |
| #486 Guardrails Engine | evaluate()+GuardrailResult; 3 stages; core-first | FULLY APPROVED |
| #487 MCP rewrite | buildMcpServer; mcpExposed default-false; requiresSession | FULLY APPROVED |

*Wave 40: inbox files fry-483-dp-revision, fry-484-dp-revision, fry-487-dp-revision still absent — filing pending*
