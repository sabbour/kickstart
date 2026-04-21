---
'@aks-kickstart/web': patch
---

Wire Playground Gallery and Components tabs to live /api/packs registry. Gallery tab now lists playgroundScenarios and Components tab lists pack entries fetched from the backend. A module-level memoised `usePackRegistry` hook handles loading, graceful error state, and retry-on-failure caching.
