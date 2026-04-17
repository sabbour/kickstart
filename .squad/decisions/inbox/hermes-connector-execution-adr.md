### 2026-04-17: Connector execution model — client vs proxy

**By:** Hermes (via research), Leela (architecture review)
**What:** AzureARMConnector always proxies through /api/arm-proxy (CORS constraint). GitHubConnector splits: reads direct, writes proxied for token security. Exception: createPullRequest() calls api.github.com directly — flagged as technical debt.
**Why:** ARM management API does not allow browser CORS; GitHub reads are public/CORS-enabled; GitHub writes need token isolation. createPullRequest() direct call is a known inconsistency to be addressed.
**Impact:** Any new connector methods that write data MUST use the server proxy pattern.
