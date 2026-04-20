# @kickstart/api

## 1.0.1

### Patch Changes

- [#864](https://github.com/sabbour/kickstart/pull/864) [`67d23ab`](https://github.com/sabbour/kickstart/commit/67d23abe0e6333a82cffdf6e4b78989129290a2b) Thanks [@sabbour-squad-backend](https://github.com/apps/sabbour-squad-backend)! - Fix API pack registry startup so bundled agent and skill assets resolve correctly in the built Functions bundle.

## 1.0.0

### Major Changes

- Kickstart v1.0.0 makes the harness plus packs architecture the supported product baseline and retires the remaining v1 compatibility surface.

### Patch Changes

- [#780](https://github.com/sabbour/kickstart/pull/780) [`1909bfa`](https://github.com/sabbour/kickstart/commit/1909bfab0c533236a83ac21e564ecdcde7d7660a) Thanks [@sabbour](https://github.com/sabbour)! - Add server-safe pack manifests for `pack-azure`, `pack-aks-automatic`, and `pack-github`, and register them in the web API startup alongside `pack-core`.

  - Each domain pack now exports a `server-manifest.ts` that mirrors `pack-core`'s pattern: tools, user-actions, guardrails, and (for github) playground scenarios/stubs are imported directly, while components are listed with placeholder schemas to keep React out of the Functions bundle.
  - `packages/web/api/src/startup/packs.ts` registers packs in dependency order (`core` → `azure` → `aks` → `github`) and gates the non-core packs via the `KICKSTART_PACKS` env var (comma-separated list; default: all four enabled). `core` is always registered.
