---
"@aks-kickstart/web": minor
---

ARM reads now run direct from the browser; old proxy retiring next release (#320)

`BrowserAzureARMConnector` and every other browser-side caller have been migrated to the canonical `armFetch` wrapper from Wave 1, so subscription/location/resource-group/resource lookups (and any `azure-arm` connector `request()` call) now go straight to `https://management.azure.com` using a SWA-issued AAD token instead of round-tripping through the `/api/arm-proxy` Azure Function. You should see one fewer hop and one fewer 401-retry latency spike on the Azure pickers in the catalog UI. The proxy itself stays deployed for a one-week zero-traffic observation window before it is retired in the next release (Wave 3 / #321).
