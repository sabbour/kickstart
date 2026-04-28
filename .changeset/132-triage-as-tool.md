---
"@aks-kickstart/pack-core": minor
"@aks-kickstart/harness": minor
---

Wire triage.asTool() for aks.architect ↔ azure.architect mid-task consultation (#132)

Adds `asTools:` frontmatter support to agent markdown files so any agent
can declare specialist agents it may consult as bounded tools mid-task
(without a full conversation handoff). Wires `core.triage` with
`aks.architect` and `azure.architect` as the first consumers.
