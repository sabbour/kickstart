---
"@aks-kickstart/pack-core": patch
---

Config files (tracks, inference-backends, component-catalog) now include provenance markers on every entry, so you can trace whether each config value was extracted from an existing prompt, derived from facts, or proposed for future work.

Note: This PR implements provenance markers (part 1 of #211). Splitting derived/proposed items into sibling config files is tracked separately.
