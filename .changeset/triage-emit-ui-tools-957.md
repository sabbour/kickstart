---
'@aks-kickstart/pack-core': patch
---

Fix main chat: enable A2UI output from the triage agent by adding `core.emit_ui` and `core.search_components` to its tool allowlist, and update the system prompt to guide the model toward emitting structured button surfaces for branching choices (#957).
