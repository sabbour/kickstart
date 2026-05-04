# @sabbour/kickstart-mcp

MCP server for [AKS Kickstart](https://github.com/azure-management-and-platforms/kickstart) — exposes Kickstart's conversation tools and A2UI responses over the [Model Context Protocol](https://modelcontextprotocol.io) so GitHub Copilot Chat, VS Code agents, and any MCP-capable client can drive the Kickstart harness.

## Quick start — VS Code

Click to install in one step:

- **VS Code** — [Install Kickstart MCP](vscode:mcp/install?%7B%22name%22%3A%22kickstart%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40sabbour%2Fkickstart-mcp%22%5D%7D)
- **VS Code Insiders** — [Install Kickstart MCP](vscode-insiders:mcp/install?%7B%22name%22%3A%22kickstart%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40sabbour%2Fkickstart-mcp%22%5D%7D)

Or add manually to `.vscode/mcp.json`:

```json
{
  "servers": {
    "kickstart": {
      "command": "npx",
      "args": ["-y", "@sabbour/kickstart-mcp"]
    }
  }
}
```

Then open Copilot Chat in **Agent mode** and start chatting. Kickstart tools will appear in the Tools panel (⚙).

## CLI usage

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

## Documentation

Full getting-started guide: [Using Kickstart as an MCP Server in VS Code](https://miniature-chainsaw-7p7mn8g.pages.github.io/docs/getting-started/mcp-vscode)

## License

MIT

