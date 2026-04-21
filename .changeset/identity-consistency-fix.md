---
'@aks-kickstart/harness': patch
'@aks-kickstart/pack-core': patch
'@aks-kickstart/pack-azure': patch
'@aks-kickstart/pack-aks-automatic': patch
'@aks-kickstart/pack-github': patch
'@aks-kickstart/mcp-server': patch
'@aks-kickstart/api': patch
'@aks-kickstart/web': patch
---

fix(identity): session-export pattern covers all gh write commands

- Template GIT IDENTITY block now explicitly documents that session-level
  `export GH_TOKEN` at session start covers ALL `gh` write commands
  (review, comment, merge, edit, issue comment).
- Previously, only `push` and `pr create` were documented, causing agents
  to omit the token for other commands, which fell through to the
  authenticated user instead of the bot identity.
- Fixes the inconsistency observed on PRs #986/#989/#990 where reviewer
  agents posted as the user instead of their bot identity.

Ported from sabbour/squad PR #27.
