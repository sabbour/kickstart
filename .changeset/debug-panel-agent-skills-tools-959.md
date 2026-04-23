---
'@aks-kickstart/web': patch
---

Debug panel: surface `agentName`, `skillsExecuted`, and `toolsExecuted` from the SSE `end` event (#959). The main-chat Debug panel now includes three new sections — **Agent** (single label), **Skills** (list of skill IDs), and **Tools** (list of tool names with ok/error status dots) — fed from the fields added in #958. All fields are optional; when absent, each section renders a dimmed `—`.
