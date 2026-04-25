# @kickstart/pack-core

## 1.0.0

### Major Changes

- Kickstart v1.0.0 makes the harness plus packs architecture the supported product baseline and retires the remaining v1 compatibility surface.

### Patch Changes

- [#790](https://github.com/azure-management-and-platforms/kickstart/pull/790) [`380a226`](https://github.com/azure-management-and-platforms/kickstart/commit/380a226c694dabe05948dfcf99fe1821e2a974b7) Thanks [@sabbour](https://github.com/sabbour)! - MCP server now registers the core/azure/aks/github packs at boot through a sealed `PackRegistry` singleton that mirrors `packages/web/api/src/startup/packs.ts`, honouring the `KICKSTART_PACKS` env var. Each pack now exports a `./server-manifest` subpath so server-only runtimes (MCP + Azure Functions) can load it without pulling in React.

- Updated dependencies [[`5c1138d`](https://github.com/azure-management-and-platforms/kickstart/commit/5c1138d9c3315cd4968a5776a63e49d3a1b9c89c)]:
  - @kickstart/harness@1.0.0
