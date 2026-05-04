# @sabbour/kickstart-mcp

MCP server for [AKS Kickstart](https://github.com/azure-management-and-platforms/kickstart) — exposes conversation tools and A2UI responses over the Model Context Protocol so Copilot Chat extensions and VS Code agents can drive the Kickstart harness.

## Installation

```bash
npm install @sabbour/kickstart-mcp
```

## Usage

```bash
npx @sabbour/kickstart-mcp
```

The server exposes MCP tools that wrap the Kickstart harness `Runner`. Each tool call drives one harness turn — session management, skill injection, and guardrails all flow through the harness runtime.

## Configuration

Set the following environment variables:

| Variable | Description |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Storage for session persistence |

## License

MIT
