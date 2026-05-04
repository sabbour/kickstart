---
"@aks-kickstart/web": minor
---

Add typed Azure ARM read endpoints for subscriptions, locations, resource groups, and resources.

Four new server-side endpoints replace direct browser ARM calls for listing Azure resources:

- `GET /api/azure/subscriptions`
- `GET /api/azure/subscriptions/{subId}/locations`
- `GET /api/azure/subscriptions/{subId}/resource-groups`
- `GET /api/azure/subscriptions/{subId}/resources`

Each endpoint authenticates via the SWA-injected AAD token (`x-ms-token-aad-access-token`), calls ARM server-side, and returns a typed `{ value: [] }` JSON response. The `BrowserAzureARMConnector` now routes all list calls through these typed endpoints instead of the retired `/api/arm-proxy` route.
