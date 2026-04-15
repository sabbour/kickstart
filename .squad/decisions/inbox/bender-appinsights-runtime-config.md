# Decision: Serve browser App Insights config from the managed API at runtime

**Date:** 2026-04-15T17:05:00Z  
**Author:** Bender (Backend Dev)  
**Status:** Implemented

## Context

Kickstart deploys through Azure Static Web Apps with a managed Azure Functions API. We needed one Application Insights resource for both the browser and API so frontend AJAX calls and backend request handling could be correlated end-to-end.

## Decision

1. Provision a workspace-backed Application Insights instance in `infra/main.bicep`.
2. Push its `APPLICATIONINSIGHTS_CONNECTION_STRING` into SWA app settings so the managed Functions API gets it automatically.
3. Expose a tiny anonymous `/api/client-config` endpoint that returns only the public telemetry payload the browser needs.
4. Initialize the browser SDK from that runtime endpoint instead of baking telemetry config into Vite env vars.

## Why

SWA app settings flow to the managed Functions environment, but they are not directly readable by the static frontend at runtime. Vite env vars would require wiring deployment outputs back into the build pipeline and would couple frontend telemetry to CI-time config rather than live deployed config.

The Application Insights connection string is not a secret, so returning it from a narrow anonymous API endpoint is acceptable and keeps the frontend/backend pointed at the same telemetry resource without duplicating configuration paths.

## Consequences

- Infra owns the single source of truth for Application Insights creation.
- The managed API gets telemetry through normal SWA app settings.
- The browser fetches telemetry config from the deployed environment, so re-pointing observability only requires infra/app-settings changes, not a frontend rebuild.
