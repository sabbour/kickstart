# @kickstart/harness

## 1.0.0

### Major Changes

- Kickstart v1.0.0 makes the harness plus packs architecture the supported product baseline and retires the remaining v1 compatibility surface.

### Patch Changes

- [#789](https://github.com/azure-management-and-platforms/kickstart/pull/789) [`5c1138d`](https://github.com/azure-management-and-platforms/kickstart/commit/5c1138d9c3315cd4968a5776a63e49d3a1b9c89c) Thanks [@sabbour](https://github.com/sabbour)! - Remove v1 compatibility stubs: delete `packages/core/` redirect package, drop unused v1 shims (`ConversationSkillsContext`, `registerKit`, `azureKit`, `githubKit`, `resolveConversationSkills`) from the harness barrel, delete `packages/web/api/src/lib/response-processor.ts` and `converse-model-router.ts`, and drop the legacy harness-exports test. Changeset `linked` group now targets `@kickstart/harness` instead of `@kickstart/core`.
