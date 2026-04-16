# Decision: Fix Azure Auth A2UI Action Handler and Playground ARM 401 Loop

**Author:** Bender (Backend Dev)  
**Date:** 2026-04-16  
**Related issues:** #333 (stabilize-file-surfaces)

## Context

Two browser console bugs were found in the Playground / Auth flow:

1. `[A2UI] action (no handler): continue:azure-auth-complete` — fired whenever the Azure auth
   flow completed inside a Playground Gallery or Widget card.  Every `useA2UI()` call in
   `Playground.tsx` lacked an `actionHandler`, so `continue:` actions were silently swallowed
   and the wizard got stuck.

2. Repeated ARM proxy 401 errors (`/api/arm/subscriptions?api-version=…`) in playground/mock
   mode.  `AzureResourceForm` guards its fetch with `connector.isAuthenticated()`, but for
   `auth: { kind: 'none' }` connectors `isAuthenticated()` always returns `true`, so the form
   hit the real ARM proxy even when running offline.

## Decisions

- **Playground A2UI handlers**: Add a no-op `ActionHandler` to every `useA2UI()` call in
  `Playground.tsx` that previously passed no handler.  The handler is intentionally empty — the
  Playground has no real wizard state to advance.  This silences the console warning and
  unblocks the auth card UI transition.

- **`SKIP_LIVE_ARM_CALLS` guard**: Evaluate `isMockMode() || isPlaygroundMode()` once at
  module load time in `AzureResourceForm.tsx` (same pattern as `ALLOW_FALLBACK_DATA` in
  `AzureResourcePicker.tsx`) and bail out of the live ARM subscription fetch when the flag is
  set.  This is correct because the Playground uses stub subscription IDs that the real ARM
  proxy rejects.

- **`isAuthenticated()` contract is unchanged**: `BaseConnector.isAuthenticated()` returning
  `true` for `auth: { kind: 'none' }` is correct behaviour for SWA cookie-based auth — the
  connector does not manage tokens.  The fix belongs in the caller (`AzureResourceForm`), not
  in the connector.

## Stepwise Setup Streaming (unblocking existing App.tsx diff)

The branch `squad/333-stabilize-file-surfaces` already had 344 lines of uncommitted changes in
`App.tsx` wiring stepwise file-generation streaming.  Those changes referenced several missing
exports.  The following were implemented to unblock the build:

- `SetupGenerationEvent` discriminated union and `ChatMessage.setupEvents` field added to
  `types.ts`.
- `StepwiseSetupState` / `SetupStep` types and six exported functions
  (`createStepwiseSetupState`, `applyStepwiseSetupEvent`, `buildStepwiseSetupMessages`,
  `getSetupEventKey`, `getStepwiseSetupSurfaceId`, `redactSetupEvent`) added to
  `utils/chat-a2ui.ts`.
- `VirtualFS` workspace snapshot methods (`saveWorkspaceSnapshot`, `loadWorkspaceSnapshot`,
  `deleteWorkspaceSnapshot`, `clearWorkspaceSnapshots`) and new `workspace-snapshots`
  IndexedDB object store added to `services/virtual-fs.ts` (IDB version bumped 2 → 3).
