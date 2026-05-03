# @sabbour/kickstart-mcp

## 1.0.0

### Major Changes

- Kickstart v1.0.0 makes the harness plus packs architecture the supported product baseline and retires the remaining v1 compatibility surface.

### Patch Changes

- [#790](https://github.com/azure-management-and-platforms/kickstart/pull/790) [`380a226`](https://github.com/azure-management-and-platforms/kickstart/commit/380a226c694dabe05948dfcf99fe1821e2a974b7) Thanks [@sabbour](https://github.com/sabbour)! - MCP server now registers the core/azure/aks/github packs at boot through a sealed `PackRegistry` singleton that mirrors `packages/web/api/src/startup/packs.ts`, honouring the `KICKSTART_PACKS` env var. Each pack now exports a `./server-manifest` subpath so server-only runtimes (MCP + Azure Functions) can load it without pulling in React.

- [#789](https://github.com/azure-management-and-platforms/kickstart/pull/789) [`5c1138d`](https://github.com/azure-management-and-platforms/kickstart/commit/5c1138d9c3315cd4968a5776a63e49d3a1b9c89c) Thanks [@sabbour](https://github.com/sabbour)! - Remove v1 compatibility stubs: delete `packages/core/` redirect package, drop unused v1 shims (`ConversationSkillsContext`, `registerKit`, `azureKit`, `githubKit`, `resolveConversationSkills`) from the harness barrel, delete `packages/web/api/src/lib/response-processor.ts` and `converse-model-router.ts`, and drop the legacy harness-exports test. Changeset `linked` group now targets `@kickstart/harness` instead of `@kickstart/core`.

- Updated dependencies [[`380a226`](https://github.com/azure-management-and-platforms/kickstart/commit/380a226c694dabe05948dfcf99fe1821e2a974b7), [`1909bfa`](https://github.com/azure-management-and-platforms/kickstart/commit/1909bfab0c533236a83ac21e564ecdcde7d7660a), [`5c1138d`](https://github.com/azure-management-and-platforms/kickstart/commit/5c1138d9c3315cd4968a5776a63e49d3a1b9c89c)]:
  - @kickstart/pack-core@1.0.0
  - @kickstart/pack-azure@1.0.0
  - @kickstart/pack-aks-automatic@1.0.0
  - @kickstart/pack-github@1.0.0
  - @kickstart/harness@1.0.0

## 0.7.0

### Minor Changes

- Release the merged v0.7.0 feature set: codex-backed stepwise setup generation,
  workspace-first file delivery, real Azure and GitHub deployment lanes, live pricing
  and token usage tracking, file manager improvements, and architecture diagram upgrades.

### Patch Changes

- Updated dependencies []:
  - @kickstart/core@0.7.0

## 0.5.7

### Patch Changes

- [#184](https://github.com/azure-management-and-platforms/kickstart/pull/184) [`566dbd6`](https://github.com/azure-management-and-platforms/kickstart/commit/566dbd6b0168af8a33e5758ddacbf81b85cd8548) Thanks [@sabbour](https://github.com/sabbour)! - Adopt official A2UI v0.9 nested wire format end-to-end. The `A2UIMessage` type shape changed from flat `{type, surfaceId, ...}` to nested `{version: "v0.9", createSurface: {...}}`.

- Updated dependencies [[`566dbd6`](https://github.com/azure-management-and-platforms/kickstart/commit/566dbd6b0168af8a33e5758ddacbf81b85cd8548)]:
  - @kickstart/core@0.5.7

## 0.2.0

### Minor Changes

- v0.2.0 release: Sidebar layout, action system, questionnaire components, prompt knowledge, and CI stabilization.

### Patch Changes

- [#70](https://github.com/azure-management-and-platforms/kickstart/pull/70) [`c83f5cd`](https://github.com/azure-management-and-platforms/kickstart/commit/c83f5cd2c98a86c7ff3d7778ecace6326f3889ba) Thanks [@sabbour](https://github.com/sabbour)! - Configure changesets release workflow with GitHub changelog integration, CI validation, and release documentation.

- [`ea890de`](https://github.com/azure-management-and-platforms/kickstart/commit/ea890de4d898302ad542e3c5d6dba7479d1333bd) Thanks [@sabbour](https://github.com/sabbour)! - UX polish and fixes: chat icon refactor, inspiration progress bar, playground StrictMode fix, SWA config alignment, Griffel shorthand improvements, and general backlog cleanup (B-46 through B-59).

- Updated dependencies [[`c83f5cd`](https://github.com/azure-management-and-platforms/kickstart/commit/c83f5cd2c98a86c7ff3d7778ecace6326f3889ba), [`ea890de`](https://github.com/azure-management-and-platforms/kickstart/commit/ea890de4d898302ad542e3c5d6dba7479d1333bd)]:
  - @kickstart/core@0.2.0

## 0.2.0

### Minor Changes

- v0.2.0 release: Sidebar layout, action system, questionnaire components, prompt knowledge, and CI stabilization.

### Patch Changes

- [#70](https://github.com/azure-management-and-platforms/kickstart/pull/70) [`c83f5cd`](https://github.com/azure-management-and-platforms/kickstart/commit/c83f5cd2c98a86c7ff3d7778ecace6326f3889ba) Thanks [@sabbour](https://github.com/sabbour)! - Configure changesets release workflow with GitHub changelog integration, CI validation, and release documentation.

- [`ea890de`](https://github.com/azure-management-and-platforms/kickstart/commit/ea890de4d898302ad542e3c5d6dba7479d1333bd) Thanks [@sabbour](https://github.com/sabbour)! - UX polish and fixes: chat icon refactor, inspiration progress bar, playground StrictMode fix, SWA config alignment, Griffel shorthand improvements, and general backlog cleanup (B-46 through B-59).

- Updated dependencies [[`c83f5cd`](https://github.com/azure-management-and-platforms/kickstart/commit/c83f5cd2c98a86c7ff3d7778ecace6326f3889ba), [`ea890de`](https://github.com/azure-management-and-platforms/kickstart/commit/ea890de4d898302ad542e3c5d6dba7479d1333bd)]:
  - @kickstart/core@0.2.0
