---
"kickstart": minor
---

feat(harness): remove HARNESS_SESSION_HISTORY_ENABLED flag — history threading and cold hydration are now unconditional (executes #1062 v3 rollout). Anon-hydration interlock (HARNESS_ALLOW_ANON_HYDRATION) is retained as an independent security control. Closes #1098.
