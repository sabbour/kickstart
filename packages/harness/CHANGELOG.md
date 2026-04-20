# @kickstart/harness

## 1.0.1

### Patch Changes

- [#864](https://github.com/sabbour/kickstart/pull/864) [`67d23ab`](https://github.com/sabbour/kickstart/commit/67d23abe0e6333a82cffdf6e4b78989129290a2b) Thanks [@sabbour-squad-backend](https://github.com/apps/sabbour-squad-backend)! - Fix API pack registry startup so bundled agent and skill assets resolve correctly in the built Functions bundle.

- [#869](https://github.com/sabbour/kickstart/pull/869) [`6d8ad8b`](https://github.com/sabbour/kickstart/commit/6d8ad8bbaae3fcf38c8cf8323f935a8a227aa384) Thanks [@sabbour](https://github.com/sabbour)! - Split agent model env vars by capability tier: chat agents use `KICKSTART_CHAT_MODEL`, code-generation agents use `KICKSTART_CODEX_MODEL`. Fix harness fallback to resolve via `AZURE_OPENAI_CHAT_DEPLOYMENT`/`AZURE_OPENAI_DEPLOYMENT` before throwing a user-friendly error without internal env var names.

## 1.0.0

### Major Changes

- Kickstart v1.0.0 makes the harness plus packs architecture the supported product baseline and retires the remaining v1 compatibility surface.

### Patch Changes

- [#789](https://github.com/sabbour/kickstart/pull/789) [`5c1138d`](https://github.com/sabbour/kickstart/commit/5c1138d9c3315cd4968a5776a63e49d3a1b9c89c) Thanks [@sabbour](https://github.com/sabbour)! - Remove v1 compatibility stubs: delete `packages/core/` redirect package, drop unused v1 shims (`ConversationSkillsContext`, `registerKit`, `azureKit`, `githubKit`, `resolveConversationSkills`) from the harness barrel, delete `packages/web/api/src/lib/response-processor.ts` and `converse-model-router.ts`, and drop the legacy harness-exports test. Changeset `linked` group now targets `@kickstart/harness` instead of `@kickstart/core`.
