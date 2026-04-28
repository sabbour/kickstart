---
"@aks-kickstart/pack-aks-automatic": minor
"@aks-kickstart/pack-core": minor
"@aks-kickstart/harness": minor
---

Extend Agent.asTool() consultation framework to additional agent pairs (#118)

Adds `asTools:` frontmatter wiring (harness infrastructure from #132) and extends
bounded consultation to three new agent pairs:
- `aks.architect` → `azure.architect` (cross-domain VNET/DNS/Private Link consultation)
- `aks.architect` → `core.codesmith` (generate infra code mid-diagnosis)
- `core.codesmith` → `core.reviewer` (immediate code review after generation)

Includes the "asTool vs handoff" decision guide in the agent authoring docs.
