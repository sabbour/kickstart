---
"@aks-kickstart/harness": patch
"@aks-kickstart/pack-core": patch
---

fix(triage): hide handoff briefing from user-visible SSE stream (#415)

The triage agent no longer leaks its internal HANDOFF_BRIEFING_V1 JSON to the chat UI. The briefing is now wrapped in an HTML comment that the runner strips from SSE output while preserving it in conversation history for downstream agents.
