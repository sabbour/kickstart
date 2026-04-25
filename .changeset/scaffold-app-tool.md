---
"@aks-kickstart/pack-core": minor
---

feat(pack-core): add core.scaffold_app — deterministic skill dispatch orchestrator

Implements issue #47: the `core.scaffold_app` tool for Generation Phase C.

- Hardcoded skill allowlist (gen-dockerfile, gen-helm, gen-kaito-crd, gen-foundry-wiring, gen-gha-workflow) — never user-controlled
- Write-path validation: relative paths only, no null bytes, no `../` traversal, no collision between skills
- Branch isolation: KAITO track runs gen-kaito-crd and skips gen-foundry-wiring; Foundry track does the reverse
- GenerationProgress UI component ticked after each of the 5 skill steps via `session.recordA2UIEmission`
- Injectable `SkillDispatcher` interface for deterministic unit testing
- Full test suite: 22 tests covering dispatch order, path traversal rejection, collision detection, branch isolation, and UI ticking
