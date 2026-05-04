---
'@aks-kickstart/web': patch
---

Chat container now exposes an explicit streaming-state signal: `data-streaming="active|idle"` and `aria-busy` on `#chat-ui`. Assistive tech can announce when the agent is responding, and end-to-end tests can deterministically wait for the SSE stream (and its replayed `createSurface` / `updateComponents` events) to finish before asserting on rendered resources — replacing arbitrary timeouts with a state-based gate.
