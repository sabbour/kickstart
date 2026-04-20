# @kickstart/pack-github

## 1.0.1

### Patch Changes

- [#864](https://github.com/sabbour/kickstart/pull/864) [`67d23ab`](https://github.com/sabbour/kickstart/commit/67d23abe0e6333a82cffdf6e4b78989129290a2b) Thanks [@sabbour-squad-backend](https://github.com/apps/sabbour-squad-backend)! - Fix API pack registry startup so bundled agent and skill assets resolve correctly in the built Functions bundle.

- [#869](https://github.com/sabbour/kickstart/pull/869) [`6d8ad8b`](https://github.com/sabbour/kickstart/commit/6d8ad8bbaae3fcf38c8cf8323f935a8a227aa384) Thanks [@sabbour](https://github.com/sabbour)! - Split agent model env vars by capability tier: chat agents use `KICKSTART_CHAT_MODEL`, code-generation agents use `KICKSTART_CODEX_MODEL`. Fix harness fallback to resolve via `AZURE_OPENAI_CHAT_DEPLOYMENT`/`AZURE_OPENAI_DEPLOYMENT` before throwing a user-friendly error without internal env var names.

- Updated dependencies [[`67d23ab`](https://github.com/sabbour/kickstart/commit/67d23abe0e6333a82cffdf6e4b78989129290a2b), [`6d8ad8b`](https://github.com/sabbour/kickstart/commit/6d8ad8bbaae3fcf38c8cf8323f935a8a227aa384)]:
  - @kickstart/harness@1.0.1

## 1.0.0

### Major Changes

- Kickstart v1.0.0 makes the harness plus packs architecture the supported product baseline and retires the remaining v1 compatibility surface.

### Patch Changes

- [#790](https://github.com/sabbour/kickstart/pull/790) [`380a226`](https://github.com/sabbour/kickstart/commit/380a226c694dabe05948dfcf99fe1821e2a974b7) Thanks [@sabbour](https://github.com/sabbour)! - MCP server now registers the core/azure/aks/github packs at boot through a sealed `PackRegistry` singleton that mirrors `packages/web/api/src/startup/packs.ts`, honouring the `KICKSTART_PACKS` env var. Each pack now exports a `./server-manifest` subpath so server-only runtimes (MCP + Azure Functions) can load it without pulling in React.

- [#780](https://github.com/sabbour/kickstart/pull/780) [`1909bfa`](https://github.com/sabbour/kickstart/commit/1909bfab0c533236a83ac21e564ecdcde7d7660a) Thanks [@sabbour](https://github.com/sabbour)! - Add server-safe pack manifests for `pack-azure`, `pack-aks-automatic`, and `pack-github`, and register them in the web API startup alongside `pack-core`.

  - Each domain pack now exports a `server-manifest.ts` that mirrors `pack-core`'s pattern: tools, user-actions, guardrails, and (for github) playground scenarios/stubs are imported directly, while components are listed with placeholder schemas to keep React out of the Functions bundle.
  - `packages/web/api/src/startup/packs.ts` registers packs in dependency order (`core` → `azure` → `aks` → `github`) and gates the non-core packs via the `KICKSTART_PACKS` env var (comma-separated list; default: all four enabled). `core` is always registered.

- Updated dependencies [[`5c1138d`](https://github.com/sabbour/kickstart/commit/5c1138d9c3315cd4968a5776a63e49d3a1b9c89c)]:
  - @kickstart/harness@1.0.0
