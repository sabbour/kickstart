# Research Report: gim-home/m Pattern Analysis

**Date**: 2026-05-03
**Analyst**: Leela (temporary research squad)
**Issue**: #409
**Source repo**: `gim-home/m` (Clawpilot) — private Microsoft EMU repository

---

## 1. What gim-home/m Does

Clawpilot is an AI-powered desktop assistant built as an **Electron 40 + React 19 + TypeScript** application wrapping the GitHub Copilot SDK. Users describe tasks in natural language and the agent acts on their behalf: browsing the web via Playwright MCP, managing files via MCP Filesystem, querying Microsoft 365 data (Outlook, Teams, Calendar, OneDrive) via the WorkIQ MCP server, and running shell commands with a tiered permission system.

Architecturally, it is a **two-process Electron app**: the main process (Node.js, `electron/`) hosts the Copilot SDK client, all IPC handlers, session persistence, MCP configuration, and permission dialogs. The renderer process (`src/`) is pure React, communicating exclusively through a typed `contextBridge` preload layer — no direct Node.js access from the renderer. Shared type contracts live in `common/`, shared between both processes at compile time. The repo ships ~103 unit tests across 13 files (Vitest + Testing Library), plus Playwright E2E tests and a separate integration suite.

Beyond a simple chat interface, Clawpilot adds enterprise-grade features: a **heartbeat system** for scheduled background AI checks with native OS notifications, an **automation engine** with cron-style and condition-based triggers, persistent **memory management** with encrypted storage, cross-platform tenant policy controls (Windows Registry, macOS managed prefs, Linux `/etc/`), a **skill marketplace** backed by Azure Table Storage, and an evolving **backend-abstraction layer** to support a cloud gateway mode (Project Lobster / OpenClaw).

---

## 2. Novel Patterns Not in Kickstart

### 2.1 Typed IPC Contract as Single Source of Truth
**File**: `common/ipc-contract.ts`

Clawpilot defines every IPC channel signature, domain type, and namespace API interface in one file (`IpcInvokeMap`, `IpcEventMap`, and per-namespace interfaces like `IHeartbeatApi`, `ISessionApi`). Both the main process handler registrations and the preload bridge use this file as their type reference. Kickstart has no analogous cross-boundary type contract — agent messages and tool results are typed ad hoc in individual pack files.

### 2.2 Backend Abstraction with Enforced Linting Boundaries
**Files**: `electron/backend/types.ts`, `electron/sessions.ts`, `docs/architecture/14-backend-abstraction.md`

Clawpilot enforces a hard architectural boundary via `oxlint no-restricted-imports`: `sessions.ts` must never import directly from `gateway-*.ts` or `copilot-*.ts` backend files. All session orchestration goes through the `IBackendProvider` / `ISessionBackend` interface. Per-backend code lives in `electron/backend/<name>-*.ts`. Kickstart's pack system has loose coupling but no enforced abstraction boundary for the LLM provider layer.

### 2.3 Structured Child Logger with Runtime Context
**File**: `common/logger.ts`

Clawpilot's logger supports `log.child("sublabel")` (produces `[Parent:sublabel]` tags) and `log.with({ sessionId })` (attaches context to every subsequent call). Log sinks are pluggable at runtime — the E2E harness swaps in a capturing sink. Kickstart uses `console.log` / basic logging with no structured context propagation.

### 2.4 Heartbeat / Periodic Background AI Sessions
**Files**: `electron/heartbeat.ts`, `docs/architecture/10-heartbeat.md`

A background timer creates a dedicated Copilot session, sends a user-configured prompt, parses structured `HEARTBEAT_URGENT|source|summary|url` lines from the AI's response, and fires native OS notifications for urgent findings. The system respects a configurable work-hours schedule and prevents device sleep during checks. Kickstart has no equivalent proactive-monitoring pattern.

### 2.5 Automation Engine with Condition Monitoring
**Files**: `electron/automations/`, `electron/automations/condition-monitor.ts`, `electron/automations/types.ts`

Multi-step automations with `single | interval | multi` schedule types (plus natural-language parsing) and condition-based triggers (polls a prompt every N minutes; fires when the AI's response meets the condition). Automations can carry their own `PermissionsConfig`, pin to a specific session, and import bundled skill+config bundles from GitHub. Kickstart has no scheduled-task or condition-polling pattern.

### 2.6 Prompt-Injection-Resistant Skill Sanitization
**File**: `common/skill-sanitization.ts`

User-authored skills are scanned for model-specific delimiter tokens (`<|im_start|>`, `[INST]`, `<|begin_of_text|>`, etc.) before storage. Findings are warnings (not blocks — author intent is preserved) with ~60-char excerpts for display. Kickstart's agent `.md` files are written by the team, not end-users, so this gap is latent but will matter if Kickstart ever accepts user-authored extensions.

### 2.7 Tenant Admin Policy (Cross-Platform MDM/Registry)
**File**: `electron/tenant-policy.ts`

Reads an IT-admin-managed `TenantPolicy` JSON from Windows Registry (`HKLM\SOFTWARE\Policies\Clawpilot`), macOS managed preferences (`com.microsoft.clawpilot`), or a Linux system directory (`/etc/clawpilot/policy.json`). Policy fields disable individual MCP servers, force-prompt specific permission kinds, block model IDs, restrict to workspace, etc. Refreshed every 15 minutes. Kickstart has no admin-override channel.

### 2.8 Full Permission Audit Log
**File**: `electron/audit-log.ts`

Every tool-permission decision (auto-approve, interactive, timeout, denied) is appended as a structured JSON line to an append-only audit log file. Entries include session ID, GitHub login, M365 UPN, tool name, MCP server name, shell command text, decision source, and SDK result. Kickstart has no audit trail for agent actions.

### 2.9 Repo-Local Review Skills
**Files**: `skills/m-code-review/SKILL.md`, `skills/m-pr-ops/`, `skills/derive-rules/`, `skills/codebase-health/`

All code-review automation is expressed as SKILL.md files checked into the repo itself, with a `pnpm install:skills` command that symlinks them into both Claude Code (`.claude/skills/`) and GitHub Copilot (`.github/skills/`). This creates a single-source-of-truth for review conventions. Kickstart's `.squad/` directory has analogous per-member charters but no checked-in skill files that link to the standard toolchain.

### 2.10 Condition-Check Sessions (Hidden from UI)
**File**: `electron/session-search.ts` → `isConditionCheckSession()`

Automation condition monitors create internal sessions that are explicitly excluded from search results, session lists, and session counts. This guards UX from internal bookkeeping pollution. Kickstart shows all sessions indiscriminately.

---

## 3. Direct Adoption Candidates

### 3.1 Structured Logger (`common/logger.ts`)
Kickstart is TypeScript + Vitest throughout. Clawpilot's logger pattern (singleton sink array, `child()`, `with()`, pluggable sinks for test capture) could be lifted almost verbatim into a `packages/pack-core/src/logger.ts`. The only adaptation needed is swapping the Electron console sink for a Node.js / Azure Functions compatible one.

**Value**: Enables consistent `[Component:sub] [sessionId]` log lines across packs, dramatically easier debugging of multi-turn conversations.

### 3.2 Skill Sanitization for Prompt Injection (`common/skill-sanitization.ts`)
If Kickstart ever accepts externally-authored agent `.md` files (e.g., customer-uploaded AKS deployment playbooks), this pattern is directly adoptable. The regex set and warning envelope are self-contained with zero dependencies.

**Value**: Defensive depth against prompt injection via user-controlled content.

### 3.3 `SendAndCollectResult` Discriminated Union (`electron/sessions.ts`)
The `{ kind: "ok" | "timeout" | "no-response"; text: string }` return type replaces magic sentinel strings in async AI responses. Kickstart's agent invocations currently use bare strings or ad-hoc error objects.

**Value**: Forces every call site to handle timeout and empty-response cases explicitly; eliminates sentinel string leakage into UI.

---

## 4. Adaptation Candidates

### 4.1 Heartbeat / Scheduled AI Checks
Clawpilot's heartbeat runs as an Electron background process with native OS notifications. In Kickstart (Azure Static Web Apps + MCP server), the equivalent would be:
- A **timer-triggered Azure Function** that creates a Copilot/LLM session, sends the check prompt, parses structured results, and pushes notifications via a to-be-determined channel (email, Teams webhook, or a push-to-UI SSE stream).
- The `HeartbeatSettings` schema and `shouldTriggerSchedule()` work-hours logic (`electron/automations/triggering.ts`) are directly reusable.

**Effort**: M — needs Azure Functions scaffolding + notification channel design.

### 4.2 Automation Engine
Clawpilot's automations are Node.js timers + Electron IPC. In Kickstart, the trigger/schedule engine (`schedule.ts`, `triggering.ts`) is pure TypeScript with no Electron imports and could be reused directly. The executor would need to be adapted from IPC-based session invocation to Kickstart's `runAgent()` / pack invocation pattern.

**Effort**: L — schedule + triggering logic is portable; execution wiring needs design.

### 4.3 IPC Contract Pattern → Kickstart's MCP Tool Contract
Kickstart uses MCP tool schemas defined in individual `server-manifest.ts` files. Adopting Clawpilot's single-file contract pattern would mean consolidating all tool input/output types into a `common/mcp-contract.ts` per pack. This tightens the server ↔ UI ↔ agent type chain.

**Effort**: S–M — additive change, no breaking refactor required.

### 4.4 Tenant Policy / Admin Controls
Clawpilot reads policy from OS-native stores. For Kickstart (cloud-hosted), the equivalent is reading from Azure App Configuration or an AKS ConfigMap injected at deploy time. The `TenantPolicy` interface and sanitize/validate logic are reusable; the platform-read code needs replacement.

**Effort**: M — backend storage swap is straightforward; the policy schema is the durable value.

---

## 5. Skip Items

### 5.1 Electron Desktop Runtime
Kickstart is a web app (Azure Static Web Apps) + MCP server. The entire `electron/` layer (window management, preload bridge, cross-platform binary resolution, `sidecar/` node-runner, NSIS/DMG build) is irrelevant.

### 5.2 M365 MSAL / WAM Deep-Link Auth
Clawpilot's `electron/auth/msal-provider.ts` uses a custom `ms-clawpilot://` URI scheme registered with the OS and a Windows WAM broker. Kickstart authenticates via GitHub OAuth through Azure Static Web Apps auth. Patterns conflict and are platform-specific.

### 5.3 Playwright MCP Browser Automation
Kickstart is an AKS guidance tool, not a browser-automation product. The Playwright MCP server wiring and browser-capability permission tiers are out of scope.

### 5.4 1JS Telemetry (Hugin / 1DS / Aria)
Clawpilot uses `@1js/px-telemetry` + `@1js/hugin-schema` against the Microsoft 1DS Aria pipeline. This is a private Microsoft first-party dependency tied to the internal feed (`office.pkgs.visualstudio.com`). If Kickstart needs telemetry, Application Insights would be the right choice — not this stack.

### 5.5 Skill Marketplace (Azure Table Storage Backend)
Clawpilot's `electron/marketplace.ts` uses Azure Table Storage + a voting/approval workflow. Kickstart's extension model is pack-based (npm packages), so a crowd-sourced marketplace is architecturally misaligned.

---

## 6. Summary Recommendation

**1. Adopt the structured logger pattern (§3.1) — highest ROI, lowest effort.**
A `createLogger(tag)` with `child()` and `with()` in `pack-core` would immediately improve debuggability of multi-turn AKS deployment sessions. Two-day implementation, zero architectural risk.

**2. Consolidate MCP tool contracts into single-file schemas per pack (§4.3).**
Clawpilot's `ipc-contract.ts` discipline prevents type drift between server and client. A `common/mcp-contract.ts` per pack would tighten the server ↔ A2UI ↔ agent chain and is a clean, incremental improvement. Target for a dedicated issue.

**3. Prototype the heartbeat/scheduled-check pattern as an Azure Function (§4.1).**
Proactive AKS health monitoring (e.g., "check for nodes in NotReady state every 30 minutes during business hours, push a summary card to the chat") is a direct value-add for Kickstart's AKS audience. Clawpilot's scheduling and work-hours logic can be lifted; the execution layer needs Azure Functions scaffolding. Worth a spike issue.

---

*File citations are to `gim-home/m` at HEAD as of 2026-05-03. All patterns above were verified by reading source files directly.*
