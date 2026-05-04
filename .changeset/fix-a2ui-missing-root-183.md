---
'@aks-kickstart/pack-core': patch
---

fix(a2ui): correct id/component fields in confirm, scaffold_app, and generation-progress scenario

- confirm.ts: root component id changed from 'confirm-root' to 'root'
- scaffold_app.ts: emitProgress used `type: 'core/GenerationProgress'` with no id; fixed to `id: 'root'`, `component: 'GenerationProgress'`
- generation-progress.scenario.ts: same type/no-id bug fixed to match wire format
