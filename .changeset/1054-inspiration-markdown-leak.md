---
"@aks-kickstart/api": patch
---

Widget inspiration textarea no longer shows raw markdown syntax. The system prompt now explicitly requests plain prose and a `stripMarkdown` safety net removes any residual formatting the LLM slips in.
