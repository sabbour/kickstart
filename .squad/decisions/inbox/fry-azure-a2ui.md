# Decision: Azure A2UI Fat Component Patterns

**Author:** Fry (Frontend Dev)
**Date:** 2026-07-27
**Status:** Implemented
**PR:** #104
**Issue:** #31

## Context

Azure stub components needed to become self-managing ("fat") with real data fetching, auth flows, and security guardrails.

## Decisions

1. **Token metadata via React state** — Auth timestamps and subscription lists are tracked in `useState` after `authenticate()` resolves. Raw tokens are never exposed in UI. This keeps the connector API clean and follows the pattern already used by GitHubLoginCard.

2. **Operation allowlisting on AzureAction** — AzureAction validates ARM paths against a hardcoded Set of ~14 known resource types. Arbitrary ARM paths are blocked. This addresses Zapp's security finding about LLM-supplied write paths.

3. **Destructive operation confirmation** — DELETE operations require the user to type the resource name to confirm. Non-destructive operations (PUT/POST/PATCH) use a single-click confirm with action preview.

4. **Cascading picker with auto-select** — AzureResourcePicker cascades subscription → resource group → resource. Single-item results are auto-selected to reduce UX friction. Pre-filled props (`subscriptionId`, `resourceGroup`) skip the corresponding dropdown.

5. **Dynamic form fields by resource type** — AzureResourceForm generates type-specific fields (e.g., Kubernetes version for AKS, access tier for Storage) using string matching on the resource type name. Full ARM schema introspection deferred pending RBAC evaluation.

## Impact

- All 4 Azure A2UI components are now fat and production-ready
- New core types (AzureSubscription, AzureLocation) and methods (listSubscriptions, listResourceGroups, listLocations) available for other consumers
- azure-kit component registrations updated with full prop documentation
