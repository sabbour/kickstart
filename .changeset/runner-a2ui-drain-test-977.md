---
"@aks-kickstart/harness": patch
---

test(harness): add runner a2ui drain-forward regression tests for #977

Confirms the backend SSE emit path is correct: Session.recordA2UIEmission,
drainA2UIEmissions, and the runner's per-event drain loop all behave as
expected. Root cause of #977 was a missing `case 'a2ui':` in the frontend
useStreaming.ts switch (fixed by Fry in PR #977). These tests guard the
backend contract so regressions surface server-side.
