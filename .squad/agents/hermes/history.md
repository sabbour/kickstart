# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** Imagine — AI-guided onboarding experience for deploying apps to AKS
- **Stack:** HTML/CSS/JS (Portal Prototyper framework), TypeScript, Azure/AKS
- **Created:** 2026-04-08

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **2025-07-22 — Initial @kickstart/core test suite:** Created 35 tests across 3 files (machine.test.ts, phases.test.ts, catalog.test.ts) using vitest. Key finding: early-phase prompt templates contain K8s terms only in RULES negation context, so K8s exposure tests must check the conversational body separately from the rules section. Also: tsconfig.json must exclude `src/__tests__` and `vitest.config.ts` to avoid build errors, and vitest config must exclude `dist/` to avoid running stale compiled tests.

- **2025-07-22 — @kickstart/mcp-server test suite:** Created 53 tests across 4 files (a2ui.test.ts, kickstart.test.ts, generate-manifests.test.ts, action.test.ts). Key patterns: (1) Tool handlers are pure functions accepting a `Map<string, SessionState>` — easy to unit test without MCP SDK mocking. (2) A2UI capability tier ("kickstart"/"basic"/"none") controls resource inclusion; always test all three tiers. (3) `generate-manifests` requires complete AppDefinition (name + runtime) AND AzureContext (subscriptionId + resourceGroup + region) — test each missing field individually. (4) Action handler reconstructs engine state from session — `select` stores data without advancing, `submit` stores + advances. (5) Same tsconfig exclude pattern as core: `src/__tests__` and `vitest.config.ts`.
