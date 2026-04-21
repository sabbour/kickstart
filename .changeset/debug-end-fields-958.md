---
'@aks-kickstart/harness': patch
'@aks-kickstart/web': patch
---

Debug panel: include `agentName`, `skillsExecuted`, and `toolsExecuted` in the SSE `end` event (#958). The runner now tracks tool call names/status and matched skill IDs per turn and surfaces them so the frontend debug panel can display which agent, skills, and tools were active.
