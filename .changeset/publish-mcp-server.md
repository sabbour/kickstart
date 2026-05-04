---
"@sabbour/kickstart-mcp": minor
---

feat(mcp): publish MCP server as @sabbour/kickstart-mcp on npmjs

- Renamed package from `@aks-kickstart/mcp-server` to `@sabbour/kickstart-mcp`
- Added esbuild bundler that produces a single self-contained `dist/index.js`
- All workspace deps (`@aks-kickstart/*`) bundled inline; only `@modelcontextprotocol/sdk` remains as a runtime dependency
- Browser-only packages (`@fluentui/*`, `mermaid`, `monaco-editor`) stubbed out
- Pack agent and skill markdown assets copied to `dist/pack-assets/` at build time
- VS Code and VS Code Insiders MCP install buttons on Landing page updated
- GitHub Actions workflow (`publish-mcp.yml`) publishes automatically on merge to main
- Requires `NPM_TOKEN` secret in GitHub repo settings with publish access to `@sabbour` scope
