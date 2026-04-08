# Kickstart MCP Server

The Kickstart MCP server exposes the conversation engine as [Model Context Protocol](https://modelcontextprotocol.io/) tools. AI coding assistants (VS Code Copilot, Claude Code, etc.) can call these tools to guide users through deploying applications to AKS.

> **Related docs:** [A2UI Catalog](./a2ui-catalog.md) for component schemas · [Prompt Architecture](./prompt-architecture.md) for system prompt details

**Package:** `@kickstart/mcp-server`
**Source:** [`packages/mcp-server/src/index.ts`](../packages/mcp-server/src/index.ts)
**Transport:** stdio (via `StdioServerTransport`)
**Binary:** `kickstart-mcp` (defined in `package.json` `bin`)

---

## Tools

### `kickstart` — Start a Conversation

Start a new Kickstart conversation session. Returns an A2UI conversation phase indicator and welcome text.

**Source:** [`packages/mcp-server/src/tools/kickstart.ts`](../packages/mcp-server/src/tools/kickstart.ts)

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `string` | No | Optional initial message from the user |

#### Returns

- **Text:** Welcome message with session ID, phase info, and safeguard count
- **A2UI Resource:** `ConversationPhase` component showing all 6 phases with Discover as active

#### Behavior

1. Generates a UUID session ID
2. Initializes the conversation state machine in the **Discover** phase
3. Composes a dynamic system prompt via `buildSystemPrompt()`
4. Stores engine state in-memory for future `converse` calls
5. Returns the system prompt as a system message in the session

#### Example Response

```
👋 Welcome to **Kickstart**! I'll help you ship your application to a scalable app platform on Azure.

**Session:** `a1b2c3d4-...`
**Phase:** Discover — tell me about your app
**Safeguards:** 13 deployment best practices will be validated automatically

Let's start by learning about your app. Tell me:
- What are you building?
- What language or framework does it use?
```

---

### `converse` — Multi-turn Conversation

Continue a multi-turn Kickstart conversation. Processes the user message through the phase machine and returns the updated system prompt with A2UI phase indicator.

**Source:** [`packages/mcp-server/src/tools/converse.ts`](../packages/mcp-server/src/tools/converse.ts)

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | Yes | Active session ID from a `kickstart` call |
| `message` | `string` | Yes | User message to process |

#### Returns

- **Text:** Updated session info, recomposed system prompt, message count
- **A2UI Resource:** Updated `ConversationPhase` with phase statuses

#### Behavior

1. Looks up the session — returns error if not found
2. Records the user message in conversation history
3. Runs the message through the FSM via `transition(engineState, { type: "USER_INPUT", input })`
4. Recomposes the system prompt for the (possibly new) current phase
5. Returns the system prompt for the LLM to use in generating a response

#### Error

If the session is not found:
```
❌ Session `<sessionId>` not found. Start a new conversation with the `kickstart` tool.
```

---

### `generate-manifests` — Generate K8s Manifests

Generate Kubernetes manifests and GitHub Actions workflows from the accumulated conversation state. After generation, validates against all 13 deployment safeguards.

**Source:** [`packages/mcp-server/src/tools/generate-manifests.ts`](../packages/mcp-server/src/tools/generate-manifests.ts)

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | Yes | Active session ID |

#### Prerequisites

The session must have:
- `appDefinition.name` and `appDefinition.runtime` (from Discover/Design phases)
- `azureContext.subscriptionId`, `.resourceGroup`, and `.region`

#### Returns

- **Text:** Summary of generated artifacts
- **A2UI Resources:**
  - `Column` of `CodeBlock` components (one per generated file)
  - `Card` with safeguard validation results (✅/❌/⚠️ per rule)
- **Text:** Safeguard pass/fail summary with improvement suggestions

#### Validation

Each generated YAML file is checked against the 13 deployment safeguards (DS001–DS013) using regex/string matching:

```typescript
// Example checks from validateManifests()
case "resource-limits-required":
  return { passed: yamlContent.includes("resources:") && yamlContent.includes("limits:") };
case "health-probes-required":
  return { passed: yamlContent.includes("livenessProbe:") && yamlContent.includes("readinessProbe:") };
case "no-latest-image-tag":
  return { passed: !/:latest\b/.test(yamlContent) };
```

See [Prompt Architecture — Deployment Safeguards](./prompt-architecture.md#deployment-safeguards-ds001ds013) for the full safeguard list.

---

### `check-status` — Deployment Status

Check the deployment status for an active session.

**Source:** [`packages/mcp-server/src/tools/check-status.ts`](../packages/mcp-server/src/tools/check-status.ts)

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | Yes | Active session ID |

#### Returns

- **Text:** Deployment status message
- **A2UI Resource:** `DeploymentProgress` component with step indicators

> **Note:** This is currently a Phase 1 stub. It returns a placeholder progress component with all steps in "pending" status. Future versions will poll Azure Resource Manager for actual deployment state.

---

### `action` — Handle UI Actions

Handle a user action from the A2UI interface — button clicks, form submissions, resource selections.

**Source:** [`packages/mcp-server/src/tools/action.ts`](../packages/mcp-server/src/tools/action.ts)

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | Yes | Active session ID |
| `actionType` | `"advance" \| "skip" \| "select" \| "submit"` | Yes | Type of user action |
| `payload` | `Record<string, unknown>` | No | Action-specific data |

#### Action Types

| Action | FSM Event | Effect |
|--------|-----------|--------|
| `advance` | `ADVANCE` | Move to the next phase |
| `skip` | `SKIP` | Skip the current phase |
| `select` | — | Store selection data in `appDefinition` (no phase change) |
| `submit` | `ADVANCE` | Store form data in `appDefinition` and advance |

#### Returns

- **Text:** Updated phase status or completion message
- **A2UI Resource:** Updated `ConversationPhase` component

---

## A2UI Catalog Negotiation

The MCP server supports 3-tier A2UI capability degradation based on the client's capabilities declared during the MCP `initialize` handshake.

**Source:** [`packages/mcp-server/src/a2ui.ts`](../packages/mcp-server/src/a2ui.ts)

### Capability Tiers

| Tier | Condition | Behavior |
|------|-----------|----------|
| `kickstart` | Client catalogs include `https://kickstart.aks.azure.com/catalog/v1/kickstart-catalog.json` | Full custom components (ConversationPhase, CodeBlock, etc.) |
| `basic` | Client advertises any catalog but not Kickstart's | Custom components degraded to `Card` + `Text` with JSON dump |
| `none` | No catalogs advertised | A2UI resources omitted entirely; text-only responses |

```typescript
export function resolveA2UICapability(clientCatalogs: readonly string[] | undefined): A2UICapability {
  if (!clientCatalogs || clientCatalogs.length === 0) return "none";
  if (clientCatalogs.includes(KICKSTART_CATALOG_ID)) return "kickstart";
  if (clientCatalogs.length > 0) return "basic";
  return "none";
}
```

### Degradation

For `basic` clients, custom components are wrapped in a Card with the component JSON as a code Text:

```typescript
export function degradeToBasic(root: Component, title?: string): Component {
  const text: TextComponent = {
    type: "Text",
    id: `${root.id ?? "degraded"}-text`,
    content: JSON.stringify(root, null, 2),
    variant: "code",
  };
  return {
    type: "Card",
    id: `${root.id ?? "degraded"}-card`,
    title: title ?? root.type,
    children: [text],
  };
}
```

For `none` clients, `createA2UIResource()` returns `null` and all tool handlers conditionally skip adding the resource to their response.

---

## Session Management

Sessions are stored in an in-memory `Map<string, SessionState>` with TTL-based cleanup.

| Setting | Value |
|---------|-------|
| Session TTL | 1 hour |
| Cleanup sweep | Every 10 minutes |
| Cleanup behavior | Deletes session AND engine state (`deleteEngineState`) |

```typescript
const cleanupInterval = setInterval(cleanStaleSessions, 10 * 60 * 1000);
cleanupInterval.unref(); // Don't keep process alive for cleanup
```

> **No persistence:** Sessions are lost when the MCP server process restarts. This is a Phase 1 design decision.

---

## Configuration

### VS Code (GitHub Copilot)

Add to your VS Code `settings.json` or workspace `.vscode/mcp.json`:

```json
{
  "mcp": {
    "servers": {
      "kickstart": {
        "command": "node",
        "args": ["path/to/packages/mcp-server/dist/index.js"],
        "env": {}
      }
    }
  }
}
```

### Claude Code

Add to your Claude Code MCP settings (`~/.claude/mcp.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "kickstart": {
      "command": "node",
      "args": ["path/to/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### From npm (after publish)

```json
{
  "mcpServers": {
    "kickstart": {
      "command": "npx",
      "args": ["@kickstart/mcp-server"]
    }
  }
}
```

### Build & Run Locally

```bash
# From repo root
npm ci
npm run build -w @kickstart/core
npm run build -w @kickstart/mcp-server

# Run directly
node packages/mcp-server/dist/index.js

# Or via npm
npm start -w @kickstart/mcp-server
```

The server communicates over stdio — it reads JSON-RPC messages from stdin and writes responses to stdout. It's designed to be launched by an MCP-compatible client, not run standalone.
