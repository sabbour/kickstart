---
"@kickstart/harness": patch
"@kickstart/mcp-server": patch
"@kickstart/web": patch
---

Remove v1 compatibility stubs: delete `packages/core/` redirect package, drop unused v1 shims (`ConversationSkillsContext`, `registerKit`, `azureKit`, `githubKit`, `resolveConversationSkills`) from the harness barrel, delete `packages/web/api/src/lib/response-processor.ts` and `converse-model-router.ts`, and drop the legacy harness-exports test. Changeset `linked` group now targets `@kickstart/harness` instead of `@kickstart/core`.
