# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** Imagine — AI-guided onboarding experience for deploying apps to AKS
- **Stack:** HTML/CSS/JS (Portal Prototyper framework), TypeScript, Azure/AKS
- **Created:** 2026-04-08

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **2025-07-22 — Initial @kickstart/core test suite:** Created 35 tests across 3 files (machine.test.ts, phases.test.ts, catalog.test.ts) using vitest. Key finding: early-phase prompt templates contain K8s terms only in RULES negation context, so K8s exposure tests must check the conversational body separately from the rules section. Also: tsconfig.json must exclude `src/__tests__` and `vitest.config.ts` to avoid build errors, and vitest config must exclude `dist/` to avoid running stale compiled tests.
