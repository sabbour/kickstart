<!-- Trimmed 2026-05-02 — entries before 2026-04-25 are in git history -->

### 6. Responses API Usage

**Current state:**  
`useResponses: false` is hardcoded on both providers (`runner.ts` L100, L106). The harness uses Chat Completions. This was a deliberate decision to work around Azure OpenAI's v1 endpoint shape (#932). The `@openai/agents` SDK v0.8.4 supports both.

**Issues:**

- **Missing Responses API benefits:** Stateful conversation threading (`previous_response_id`), built-in `web_search_preview` and `file_search` tools, and the newer model capabilities that are Responses-only (o-series reasoning models with streaming). The harness implements its own conversation threading (`toAgentInputItems`, `recentTurns`) which is good but duplicates what the SDK provides for free.

- **Azure OpenAI Responses API availability:** The stated reason for `useResponses: false` is Azure endpoint shape. As of early 2026, Azure OpenAI supports the Responses API on `2025-03-01-preview` and later. The `buildAzureBaseUrl()` comment should be revisited. It's possible `useResponses: true` now works on Azure.

- **SDK version:** `@openai/agents 0.8.4` is pinned (`harness/package.json` L87). The changelog for 0.8.x should be checked — there have been Responses API stability improvements in recent SDK releases.

- **No streaming backpressure.** The SSE writer is fire-and-forget (`stream.write()` in `sse.ts`). If the client disconnects or the response buffer fills, the write silently drops. The runner propagates a disconnect signal (`signal` → `abortCtrl`) but only for client-initiated aborts, not for back-pressure.

**Recommendations:**
- **Evaluate Responses API on Azure** against `2025-03-01-preview` or later. If it works, create a DP for migrating and removing the hand-rolled history threading. This is the biggest architectural improvement available.
- Track `@openai/agents` upgrade from 0.8.4 — check release notes for Responses API stability fixes.
- Add a comment to both `useResponses: false` lines with a dated rationale and a link to the tracking issue.

---
---
### AC1: Responses API Migration
- **What:** Switch both providers to `useResponses: true`. Evaluate Azure AOAI Responses API on `2025-03-01-preview`.
- **Impact:** If successful, removes `toAgentInputItems` / `recentTurns` hand-rolled threading, enables `previous_response_id` stateful sessions, unlocks `file_search` and `web_search_preview` built-in tools.
- **Risk:** Azure endpoint compatibility must be verified first. Breaking change to the converse handler (no longer needs to thread history manually). The 50-turn window logic, `hydrateColdSession`, and `trust: 'client-hydrated'` markers would need revalidation.
- **DP scope:** Proof-of-concept on dev environment, verify Azure AOAI Responses API endpoints, define migration path.

### Phase 4 — Responses API (independent workstream)

This is orthogonal — do it in parallel or after Phase 1. The Responses API migration simplifies the runner but doesn't change agent routing logic. Concrete steps:

1. Test `useResponses: true` against Azure AOAI `2025-03-01-preview`
2. If it works, remove `toAgentInputItems` and `recentTurns` threading (the SDK manages this)
3. Evaluate `file_search` for semantic skill retrieval (replaces ID-based `core.read_skill`)

**Do NOT mix Phase 1 and Phase 4 in one PR.** Routing changes touch agent prompts; Responses API touches the runner and session model. Separate branches, separate review.

---
---
---
---
---
## Recommendation

**Option A — browser-direct → ARM, source the access token from `/.auth/me`.**

`BrowserAzureARMConnector` will:
1. Read the SWA-injected ARM access token from `/.auth/me` (already populated via the `loginParameters` fix in PR #195).
2. Call `https://management.azure.com/...` directly with `Authorization: Bearer <token>`.
3. Continue to inject default `api-version=2024-03-01` for callers that omit it.

`/api/arm-proxy` becomes `410 Gone` (mirroring the `github-proxy` tombstone). `arm-proxy` is removed from `proxy-allowlist.ts` `ALLOWED_HOSTS`. No new MSAL.js dependency in v1; defer MSAL fallback until evidence demands it (e.g. CA step-up).

### 6. Harness `z.preprocess` callsites are in scope for acknowledgment

`packages/harness/src/types/a2ui.ts` has 5 `z.preprocess` callsites. Harness already depends on `zod@^4.1.12`. These must be explicitly scoped in or out of PR #247. Bender is deciding scope now as part of parallel implementation.

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

# Decision: SWA API Backend Architecture

**Author:** Bender (Backend Dev)
**Date:** 2025-07-25
**Status:** Implemented

## Consequences

- API keys must be set in SWA app settings (not in source)
- Sessions are lost on function cold starts (acceptable for Phase 1)
- CI workflow now requires Node.js setup + multi-step build (core → api → SWA deploy)

# Decision: API Client Architecture — Graceful Fallback to Demo Mode

**Author:** Fry (Frontend Dev)
**Date:** 2025-07-25
**Status:** Implemented

## Consequences
- When the API is deployed, the frontend will automatically switch to API mode on next page load.
- If the API goes down mid-session, individual requests will show error bubbles (not a full crash).

# Decision: Playwright E2E Test Infrastructure for Web UI

**Author:** Hermes (Tester)  
**Date:** 2026-04-08  
**Status:** Accepted



### 2026-07-26: Decision — A2UI Message Protocol for Dynamic Surfaces
**Author:** Bender  
**Status:** Accepted (enforced by fix for #54)

When creating A2UI surfaces dynamically (e.g. from LLM responses), always use the **two-message pattern**:
1. `{ version: 'v0.9', createSurface: { surfaceId, catalogId } }` — creates an empty surface
2. `{ version: 'v0.9', updateComponents: { surfaceId, components: [...] } }` — adds components

Never put a `body` field on `createSurface` — it is silently ignored. One component in the `updateComponents` array **must** have `id: "root"` — this is the renderer's entry point. Components use the flat format: `{ id, component, ...props, children: ["child-id-refs"] }`. Never nest component objects inline.

**Implications:**
- Any new code that creates A2UI surfaces must follow this pattern.
- LLM system prompts that generate A2UI must teach the flat format with `id: "root"`.
- The `normalizePlaygroundComponents()` function in Playground.tsx can be reused as a safety net for LLM output normalization.

---

### 2026-07-27: Decision — Content Safety Guardrails for LLM-Generated Content
**Author:** Bender  
**Status:** Implemented

Public-facing LLM endpoints (inspirations, converse) could generate or respond to inappropriate content. Two layers of defense:

1. **System prompt hardening** — All 4 inspiration generation prompts include a safety clause forbidding weapons, violence, illegal activities, adult content, gambling, and harmful/offensive ideas.
2. **User input pre-flight check** — New `content-safety.ts` module performs lightweight LLM classification (`safe`/`unsafe`) on user messages before they reach the main converse flow. Uses `maxTokens: 10`, `temperature: 0` for speed/cost. Gracefully skips if OpenAI is unavailable or the check fails.

**Implications:**
- All agents/team members adding new LLM prompts should include the safety clause.
- The content safety check uses the chat deployment (not inspire), keeping it on the faster model path.
- This is a first layer — not a comprehensive content moderator. Future work may add Azure Content Safety service integration.

---

### 2026-07-27: Decision — Dedicated /api/playground Endpoint for A2UI Playground
**Author:** Bender  
**Status:** Accepted

Playground Create tab was calling `/api/converse`, which uses the full Kickstart onboarding engine (phases, kit skills, phase indicators). Wrong context — the playground needs free-form A2UI component generation, not an AKS deployment guide.
## Merged from Inbox

### 2026-07-26: Decision — Widget Inspiration Prompts — Dev/Deploy/Ops Focus
**Author:** Bender  
**Status:** Implemented

Widget inspiration system (Ideas tab in Playground) was generating generic "chat-based AI assistant UX" component ideas. Too vague for one-shot component generation and not aligned with Kickstart's focus on Kubernetes/AKS deployment operations.
Frontend `Playground.tsx` updated to call `/api/playground` with direct fetch instead of the SSE-based `useStreaming` hook.

### 2026-07-18: Decision — ArchitectureDiagram Fluent 2 Theme & Auto-sizing
**Author:** Fry  
**Status:** Implemented

ArchitectureDiagram used Mermaid's `neutral` theme with fixed 400px viewport, producing tiny diagrams that didn't match Fluent 2 visuals.

**Choices:**
1. **Mermaid `base` theme with Fluent 2 `themeVariables`** — hardcoded hex values (not runtime tokens) since Mermaid config is static.
2. **SVG post-processing** — icon injection via keyword matching on node labels, rounded corners, thin strokes, flat styling.
3. **Auto-sizing viewport** — 300–800px range based on SVG natural dimensions.
4. **Fit-and-center** — diagram scales to fit container width and centers on render; reset button re-fits instead of going to 1:1.

**Rationale:**
- `theme: 'base'` gives full color control; `neutral` ignores `themeVariables`.
- Post-processing is necessary because Mermaid has no native icon support.
- Auto-sizing prevents "tiny diagram in a big box" problem and avoids scroll for small diagrams.

---

### 2026-07-18: Decision — SteppedCarousel Component Pattern
**Author:** Fry  
**Status:** Implemented

Needed wizard-style alternative to FormGroup for multi-step flows where showing all steps at once is overwhelming.

**Implementation:** Created `SteppedCarousel` as a custom A2UI component using the same `createReactComponent` pattern.
- **Client-side state only:** Step navigation is purely `useState` — no server round-trip needed for step changes.
- **Child-based content:** Each step references a `child` ComponentId, same delegation pattern as FormGroup. Step content is composable from any A2UI components.
- **No animation:** Simple content swap keeps it lightweight and avoids CSS transition complexity.

**Impact:** New component available in kickstart catalog. No breaking changes to existing components.

---
