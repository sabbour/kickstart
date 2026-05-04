---
"@sabbour/kickstart-mcp": patch
"@aks-kickstart/harness": patch
---

remove(mcp): remove VS Code sampling integration

- Remove MCP sampling provider (VS Code sampling doesn't support A2UI rendering)
- Remove VS Code getting-started docs and sidebar entry
- Surface runner errors in converse tool response instead of returning silent (no output)
- resolveOutputText now handles plain string finalOutput
- Triage: register pick_compound_order A2UI event handler
