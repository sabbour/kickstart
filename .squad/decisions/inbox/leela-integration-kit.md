# Decision: IntegrationKit Abstraction (B-10)

**Author:** Leela (Lead)
**Date:** 2025-07-26
**Status:** Implemented
**Commit:** c7b99ac

## Context

B-10 called for an `IntegrationKit` abstraction (renamed from ServicePack) that bundles tools + connectors + prompts + component registrations into a composable, registerable unit. Dependencies B-11 (APIConnector) and B-13 (ToolRegistry) were available.

## Decision

Created `packages/core/src/kits/` with:

- **`IntegrationKit` interface** — `{ name, description, tools: Tool<any>[], connectors: APIConnector[], prompts?: string[], components?: ComponentRegistration[] }`. The `tools` field uses `Tool<any>[]` (not `Tool[]`) to accommodate specific-args typed tools.
- **`IntegrationKitRegistry`** — mirrors ToolRegistry/APIConnectorRegistry. Constructor accepts optional custom registries for test isolation. `register(kit)` auto-wires tools + connectors.
- **`registerKit(kit)`** — convenience function delegating to `defaultKitRegistry`.
- **`AzureKit`** — azure_resource_list, azure_resource_get, estimate_cost + AzureARMConnector, PricingConnector + 4 Azure-specific prompts + azureLoginCard/azureResourcePicker component registrations.
- **`GitHubKit`** — github_repo_info + GitHubConnector + 3 GitHub-specific prompts + githubLoginCard/githubRepoPicker component registrations.

## Startup Wiring

`packages/web/src/main.tsx` calls `registerKit(azureKit)` and `registerKit(githubKit)` before ReactDOM render. Kits register into `defaultRegistry` (tools, used by engine + MCP) and `defaultConnectorRegistry` (connectors, shared with Azure Functions).

## Test Coverage

23 contract tests in `integration-kit.test.ts`. All 309 tests green.

## What's NOT included

- Actual React component implementations for azureLoginCard/azureResourcePicker/githubLoginCard/githubRepoPicker — those are `ComponentRegistration` descriptors only. Fry wires the React components in the web package when building those components.
- Kit-level connector injection into `APIConnectorContext` React registry — the context still manages its own connector instances. The kit's connectors go into `defaultConnectorRegistry` for engine/server use. Cross-wiring deferred to when auth connectors are built (B-14).
