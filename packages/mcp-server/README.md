# @sabbour/kickstart-mcp

MCP server for [AKS Kickstart](https://github.com/azure-management-and-platforms/kickstart) — exposes Kickstart's conversation tools over the [Model Context Protocol](https://modelcontextprotocol.io) so any MCP-capable client can drive the Kickstart harness.

## Usage

```bash
npx @sabbour/kickstart-mcp
```

The server speaks MCP over stdio. Each tool call drives one Kickstart harness turn — session management, skill injection, and guardrails all flow through the harness runtime automatically.

## Configuration

Set environment variables before starting the server:

| Variable | Required | Description |
|---|---|---|
| `AZURE_OPENAI_ENDPOINT` | ✅ | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_API_KEY` | ✅ | Azure OpenAI API key |
| `AZURE_STORAGE_CONNECTION_STRING` | ✅ | Azure Storage for session persistence |

## License

MIT

