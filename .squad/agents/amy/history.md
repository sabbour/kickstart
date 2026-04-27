# Amy — History

## Project Context
**Project:** Kickstart — AI-powered project scaffolding tool
**Stack:** TypeScript, Node.js, React, Docusaurus
**User:** Ahmed Sabbour
**Joined:** 2026-04-24

## Learnings

### 2026-04-27 — Docs Scope Audit (docs:not-applicable overuse)

**Task:** Ahmed flagged that `docs:not-applicable` had been applied too broadly across 10 open PRs. Conducted a full audit and corrected 9 of them.

**Decisions Made:**
- `docs:not-applicable` was incorrectly applied to PRs introducing new public interfaces, new APIs, new environment variables, new SSE event types, architecture changes, user-facing behavior changes, and developer tooling changes.
- Only PR #144 (triage prompt slim — pure internal token-count optimization, no new interfaces or behaviors) correctly carried `docs:not-applicable`.

**Documentation Written:**
- `docs-site/docs/extending/session-store.md` — ISessionStore interface, InMemorySessionStore, createSessionStore factory, custom adapter guide (PR #139)
- `docs-site/docs/extending/agent-as-tool.md` — asTool() API reference and specialist consultation patterns (PR #142)
- `docs-site/docs/extending/guardrails.md` — guardrail rules, SSE events, KICKSTART_GUARDRAILS_DISABLED kill-switch, custom guardrail authoring (PR #145)
- `docs-site/docs/extending/runner-chain.md` — runChain/runWithGate/ChainDepthExceeded API reference and migration guide (PR #147)
- `docs-site/docs/architecture/decisions/ADR-0003-sdk-native-parallel-guardrails.md` — ADR for SDK-native parallel guardrail pipeline decision and tradeoffs (PR #149)
- `docs-site/docs/getting-started/environment-variables.md` — KICKSTART_USE_RESPONSES flag (PR #154) and KICKSTART_GUARDRAILS_DISABLED (PR #145)
- `docs-site/docs/getting-started/local-setup.md` — Authentication States section for graceful auth UX (PR #122)
- `docs-site/docs/guides/conversation-limits.md` — MaxTurns recovery card and token budget trimming guide (PR #134)
- `docs-site/docs/contributing.md` — Strict Zod schema requirements for tool/schema files (PR #137)
- `.squad/skills/pr-workflow/SKILL.md` — Expanded docs scope definition and mandatory Amy sign-off for `docs:not-applicable`

**Process Change:**
- Updated the PR workflow skill so implementing agents (Bender/Fry/Hermes/@copilot) can no longer self-apply `docs:not-applicable`. Only Amy can apply it after explicit review.
- Created `squad/amy-docs-scope-audit` branch with the SKILL.md change.
- Written directive summary to `.squad/decisions/inbox/amy-docs-scope-audit.md`.

**Bot Identity:** `squad-docs[bot]` (app slug: `squad-docs`, app ID 3492820)
- Initial post-flight runs used wrong expected-login `sabbour-squad-docs[bot]` (should be `squad-docs[bot]`) — caught by post-flight check on PR #139, revoked, re-applied correctly.
- All 9 × comments + 9 × labels verified OK with correct expected-login.
