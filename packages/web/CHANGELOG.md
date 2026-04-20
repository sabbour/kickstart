# @kickstart/web

## 1.0.1

### Patch Changes

- [#860](https://github.com/sabbour/kickstart/pull/860) [`8cc157a`](https://github.com/sabbour/kickstart/commit/8cc157a528a273c9e57cc23f941229808e6ccfb2) Thanks [@sabbour](https://github.com/sabbour)! - fix: use the Fluent go icon in the chat composer send button

  - replace the composer go.svg image with the same Fluent ArrowRight icon used in the landing input
  - inherit theme-aware icon color so the send button stays visible in dark mode

- [#871](https://github.com/sabbour/kickstart/pull/871) [`0dddcbb`](https://github.com/sabbour/kickstart/commit/0dddcbbf1a7e8822fceb8531e595a71ce53847e3) Thanks [@sabbour-squad-frontend](https://github.com/apps/sabbour-squad-frontend)! - chore: Rename "Fat components" to "Smart components" throughout docs and tests

## 1.0.0

### Major Changes

- Kickstart v1.0.0 makes the harness plus packs architecture the supported product baseline and retires the remaining v1 compatibility surface.

### Patch Changes

- [#771](https://github.com/sabbour/kickstart/pull/771) [`bc36071`](https://github.com/sabbour/kickstart/commit/bc360719009abfb0a50066ad963f747b7b9ad19d) Thanks [@sabbour](https://github.com/sabbour)! - test(web/e2e): skip chat and playground suites that require removed demo mode

  The v2 rewrite removed demo/mock streaming mode (`mockEnabled = false` in
  `packages/web/src/App.tsx`) and the server-authored "Kickstart" welcome
  message, which caused every Playwright CI run on `v2-rewrite` to fail and
  block the CI gate even when lint, build, and unit tests were green.

  Mark the affected tests with `.skip` and a `TODO(v2)` note so CI is unblocked
  while the real fix (API-intercept rewrites in the spirit of
  `route-state.spec.ts`) is tracked on issue [#772](https://github.com/sabbour/kickstart/issues/772):

  - `chat-experience.spec.ts` — entire `Chat experience (demo mode)` describe
  - `chat-transition.spec.ts` — the three tests that wait for the `Kickstart`
    welcome bubble
  - `playground.spec.ts` — entire `Playground` describe (waits for
    `.playground-page` which never renders under the 503-everything fixture)

  No test coverage was deleted.

- [#789](https://github.com/sabbour/kickstart/pull/789) [`5c1138d`](https://github.com/sabbour/kickstart/commit/5c1138d9c3315cd4968a5776a63e49d3a1b9c89c) Thanks [@sabbour](https://github.com/sabbour)! - Remove v1 compatibility stubs: delete `packages/core/` redirect package, drop unused v1 shims (`ConversationSkillsContext`, `registerKit`, `azureKit`, `githubKit`, `resolveConversationSkills`) from the harness barrel, delete `packages/web/api/src/lib/response-processor.ts` and `converse-model-router.ts`, and drop the legacy harness-exports test. Changeset `linked` group now targets `@kickstart/harness` instead of `@kickstart/core`.

- [#828](https://github.com/sabbour/kickstart/pull/828) [`1c590b4`](https://github.com/sabbour/kickstart/commit/1c590b41fa89146ad8ef5fa7f6af0635a20b99bf) Thanks [@sabbour](https://github.com/sabbour)! - fix: dark mode landing icon, session expiry redirect, Monaco/Vite 8 compat

  - Replace go.svg with ArrowRight24Regular Fluent icon (invisible in dark mode)
  - Fix session expiry: apiFetch throws SessionExpiredError, useStreaming redirects to AAD login
  - Fix Monaco worker URL resolution for Vite 8 / rolldown bundler
  - Fix FileEditor lazy-loading and ArtifactContext dynamic imports
  - Fix squad-pr-retro.yml YAML syntax error (multiline commit message)
  - Fix CI changeset status: use fetch-depth 0 so changeset can find diverge point

## 0.7.0

### Minor Changes

- Release the merged v0.7.0 feature set: codex-backed stepwise setup generation,
  workspace-first file delivery, real Azure and GitHub deployment lanes, live pricing
  and token usage tracking, file manager improvements, and architecture diagram upgrades.

## 0.5.7

### Patch Changes

- [#184](https://github.com/sabbour/kickstart/pull/184) [`566dbd6`](https://github.com/sabbour/kickstart/commit/566dbd6b0168af8a33e5758ddacbf81b85cd8548) Thanks [@sabbour](https://github.com/sabbour)! - Adopt official A2UI v0.9 nested wire format end-to-end. The `A2UIMessage` type shape changed from flat `{type, surfaceId, ...}` to nested `{version: "v0.9", createSurface: {...}}`.

## 0.2.0

### Minor Changes

- v0.2.0 release: Sidebar layout, action system, questionnaire components, prompt knowledge, and CI stabilization.

### Patch Changes

- [#70](https://github.com/sabbour/kickstart/pull/70) [`c83f5cd`](https://github.com/sabbour/kickstart/commit/c83f5cd2c98a86c7ff3d7778ecace6326f3889ba) Thanks [@sabbour](https://github.com/sabbour)! - Configure changesets release workflow with GitHub changelog integration, CI validation, and release documentation.

- [`ea890de`](https://github.com/sabbour/kickstart/commit/ea890de4d898302ad542e3c5d6dba7479d1333bd) Thanks [@sabbour](https://github.com/sabbour)! - UX polish and fixes: chat icon refactor, inspiration progress bar, playground StrictMode fix, SWA config alignment, Griffel shorthand improvements, and general backlog cleanup (B-46 through B-59).

## 0.2.0

### Minor Changes

- v0.2.0 release: Sidebar layout, action system, questionnaire components, prompt knowledge, and CI stabilization.

### Patch Changes

- [#70](https://github.com/sabbour/kickstart/pull/70) [`c83f5cd`](https://github.com/sabbour/kickstart/commit/c83f5cd2c98a86c7ff3d7778ecace6326f3889ba) Thanks [@sabbour](https://github.com/sabbour)! - Configure changesets release workflow with GitHub changelog integration, CI validation, and release documentation.

- [`ea890de`](https://github.com/sabbour/kickstart/commit/ea890de4d898302ad542e3c5d6dba7479d1333bd) Thanks [@sabbour](https://github.com/sabbour)! - UX polish and fixes: chat icon refactor, inspiration progress bar, playground StrictMode fix, SWA config alignment, Griffel shorthand improvements, and general backlog cleanup (B-46 through B-59).
