# Decision: Playground Tab Grouping + Real Connectors in Playground

**Date:** 2026-04-16  
**Author:** Fry (Frontend Dev)

---

## 1. GitHub Components and Azure Components belong in the Components tab

**Decision:** `'GitHub Components'` and `'Azure Components'` are moved from `GALLERY_GROUPS` to `COMPONENT_GROUPS` in `packages/web/src/pages/Playground.tsx`.

**Rationale:** The **Ideas** tab is for mashups and demo scenarios (multi-phase flows, file operations, cost estimates, etc.). The **Components** tab is for built-in and catalog-supplied UI components. GitHub and Azure components are catalog components — they belong alongside Layout, Content, Inputs, and Custom Controls, not alongside scenario demos.

---

## 2. Playground uses real connectors — stub mode removed

**Decision:** The playground-mode connector guard (`shouldUsePlaygroundStubRegistry()`) is removed from `APIConnectorContext.tsx`. `AzureARMConnector` and `GitHubConnector` are now always registered unconditionally. `shouldUsePlaygroundAuthStub()` in `playground-auth-stub.ts` always returns `false`.

**Rationale:** Playground should use real authentication and real API calls, not stubs. The offline mode banners in components (`AzureLoginCard`, `GitHubAction`, `AzureAction`, `AzureResourceForm`, `GitHubLoginCard`, `AuthCard`) are kept as-is — they are valid fallbacks for genuine misconfiguration scenarios where a connector is absent. With real connectors always registered, these conditions will naturally be false in a correctly configured environment.
