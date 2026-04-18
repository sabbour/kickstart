---
"@kickstart/mcp-server": patch
"@kickstart/pack-core": patch
"@kickstart/pack-azure": patch
"@kickstart/pack-aks-automatic": patch
"@kickstart/pack-github": patch
---

MCP server now registers the core/azure/aks/github packs at boot through a sealed `PackRegistry` singleton that mirrors `packages/web/api/src/startup/packs.ts`, honouring the `KICKSTART_PACKS` env var. Each pack now exports a `./server-manifest` subpath so server-only runtimes (MCP + Azure Functions) can load it without pulling in React.
