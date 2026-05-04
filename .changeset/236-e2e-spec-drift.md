---
"@aks-kickstart/web": patch
---

fix(e2e): resolve route.fallthrough API mismatch and spec-vs-app drift in phases B/C/D (#236)

- Family 1 (route.fallthrough): fixed in #314 — golden fixture now uses route.fallback()
- Family 2 (Azure Blob Storage strict-mode collision): fixed in #368 — scoped locator to SummaryCard container
- Family 3 (existing-repo-uplift spec drift): landing page has no dedicated uplift track card; extract enterUpliftChat() helper that falls back to hero textarea submission when the card is absent, unblocking the 3 async golden tests that were timing out waiting for #chat-ui
