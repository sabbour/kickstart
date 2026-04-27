---
"@aks-kickstart/harness": minor
---

feat: RunConfig type, default handoff input filter, and on_handoff observability callbacks

- #105: Introduce `RunConfig` type to centralise per-run options (replaces loose object literals at every `sdkRunner.run()` call site)
- #104: Default `handoffInputFilter` strips A2UI tool outputs and compresses prior turns to keep handoff context lean
- #108: `onHandoff` callback fires before each handoff for observability; default implementation logs `[handoff] {from} → {to} at turn {turn}`; `HandoffCallback` type exported for user customisation
