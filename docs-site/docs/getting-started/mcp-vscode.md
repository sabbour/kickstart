---
sidebar_position: 3
---

# Kickstart as an MCP Server in VS Code

Kickstart ships a **Model Context Protocol (MCP) server** — `@sabbour/kickstart-mcp` — that lets any MCP-capable IDE use it as a tool provider. This page shows how to install it in **VS Code** and **VS Code Insiders** so GitHub Copilot Chat can call Kickstart tools directly.

## Prerequisites

- VS Code ≥ 1.99 (MCP support is built-in; no extension required)
- Or VS Code Insiders (any recent build)
- Node.js ≥ 18 and `npm`/`npx` on your PATH
- GitHub Copilot subscription with Copilot Chat enabled

## One-click install

Click the button for your editor to install Kickstart automatically:

| Editor | Install |
|--------|---------|
| VS Code | [Install in VS Code](vscode:mcp/install?%7B%22name%22%3A%22kickstart%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40sabbour%2Fkickstart-mcp%22%5D%7D) |
| VS Code Insiders | [Install in VS Code Insiders](vscode-insiders:mcp/install?%7B%22name%22%3A%22kickstart%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40sabbour%2Fkickstart-mcp%22%5D%7D) |

VS Code will prompt you to confirm the server name and command, then write the configuration automatically.

## Manual configuration

If you prefer to configure it yourself, add the following to your **user** settings (applies to all workspaces) or to a **workspace** `.vscode/mcp.json` file.

### User settings (`settings.json`)

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`), run **Preferences: Open User Settings (JSON)**, and add:

```json
{
  "mcp": {
    "servers": {
      "kickstart": {
        "command": "npx",
        "args": ["-y", "@sabbour/kickstart-mcp"]
      }
    }
  }
}
```

### Workspace file (`.vscode/mcp.json`)

For a project-scoped setup, create `.vscode/mcp.json` at your repo root:

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

Commit this file to share the MCP server configuration with your team.

## Using Kickstart with Copilot Chat

1. Open the **Copilot Chat** panel (`Ctrl+Alt+I` / `Cmd+Alt+I`).
2. Switch to **Agent mode** using the mode selector at the top of the chat input.
3. Click the **Tools** icon (⚙) to see which MCP tools are active — Kickstart tools appear under the `kickstart` server.
4. Type your prompt. Copilot will call Kickstart tools as needed and stream the response.

:::tip
You can also `@kickstart` directly in a chat message to force Copilot to route the request through the Kickstart MCP server.
:::

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `kickstart` server not listed in Tools panel | Reload the VS Code window (`Ctrl+Shift+P` → **Developer: Reload Window**) |
| `npx: command not found` error | Ensure Node.js is on your `PATH`; restart VS Code after installing Node |
| `@sabbour/kickstart-mcp: not found` on npm | The package may not yet be published; install from source (see [Local Development Setup](./local-setup)) |
| Tools listed but calls return errors | Check the **Output → MCP: kickstart** channel for server logs |

## What's available

The Kickstart MCP server exposes the same tools available in the web UI. For a full tool reference see [Packs & Skills](../guides/packs-and-skills).
