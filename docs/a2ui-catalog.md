# A2UI Catalog Reference

A2UI (Agent-to-UI) is a protocol for AI agents to return structured UI components alongside text responses. Kickstart uses A2UI to render rich interactive elements — phase indicators, code blocks, architecture diagrams, cost estimates — in compatible clients.

> **Related docs:** [MCP Server](./mcp-server.md) for catalog negotiation · [API Reference](./api-reference.md) for the web endpoint

---

## Overview

### What is A2UI?

A2UI lets MCP tools return structured JSON that clients can render as interactive UI instead of plain text. Each response is an **A2UI document** containing a component tree:

```typescript
interface A2UIDocument {
  version: "0.9";
  root: Component;  // Root component of the tree
}
```

### How Kickstart Uses A2UI

- **MCP Server:** Returns A2UI components as MCP embedded resources with MIME type `application/json+a2ui`
- **Web API:** Returns A2UI components in the `a2ui` field of the response JSON
- **Catalog negotiation:** The MCP server detects client capabilities and degrades gracefully (see [MCP Server — Catalog Negotiation](./mcp-server.md#a2ui-catalog-negotiation))

### MIME Type

```
application/json+a2ui
```

All A2UI payloads in MCP embedded resources use this MIME type.

### Catalog URI

```
https://kickstart.aks.azure.com/catalog/v1/kickstart-catalog.json
```

**Source:** [`packages/core/src/catalog/kickstart-catalog.json`](../packages/core/src/catalog/kickstart-catalog.json)

---

## Component Reference

The Kickstart catalog defines **17 components** organized in three categories:

| Category | Components | Count |
|----------|------------|-------|
| Standard | Text, Button, TextField, Row, Column, Card | 6 |
| Kickstart Custom | ConversationPhase, CodeBlock, ResourcePicker, DeploymentProgress, ArchitectureDiagram, CostEstimate, HandoffCard | 7 |
| GitHub | RepoPicker, WorkflowStatus, CodespaceLink, AppOverview | 4 |

All components extend `BaseComponent`:

```json
{
  "type": "object",
  "properties": {
    "type": { "type": "string" },
    "id": { "type": "string" }
  },
  "required": ["type"]
}
```

---

### Standard Components

These are basic building blocks available in any A2UI catalog.

#### Text

Display text content with optional formatting variant.

```json
{
  "type": "Text",
  "id": "welcome-msg",
  "content": "Welcome to Kickstart!",
  "variant": "heading"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"Text"` | Yes | Component type |
| `content` | `string` | Yes | Text content (supports markdown) |
| `variant` | `"body" \| "heading" \| "caption" \| "code"` | No | Visual style |

---

#### Button

Interactive button that triggers an action.

```json
{
  "type": "Button",
  "id": "deploy-btn",
  "label": "Deploy Now",
  "action": "deploy",
  "variant": "primary"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"Button"` | Yes | Component type |
| `label` | `string` | Yes | Button text |
| `action` | `string` | Yes | Action identifier sent back to the server |
| `variant` | `"primary" \| "secondary" \| "danger"` | No | Visual style |
| `disabled` | `boolean` | No | Whether the button is disabled (default: `false`) |

---

#### TextField

Text input field for user data entry.

```json
{
  "type": "TextField",
  "id": "app-name",
  "label": "Application Name",
  "placeholder": "my-awesome-app",
  "required": true
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"TextField"` | Yes | Component type |
| `label` | `string` | Yes | Input label |
| `placeholder` | `string` | No | Placeholder text |
| `value` | `string` | No | Pre-filled value |
| `required` | `boolean` | No | Whether the field is required (default: `false`) |

---

#### Row

Horizontal layout container for child components.

```json
{
  "type": "Row",
  "id": "button-row",
  "children": [
    { "type": "Button", "id": "btn-yes", "label": "Yes", "action": "confirm" },
    { "type": "Button", "id": "btn-no", "label": "No", "action": "cancel", "variant": "secondary" }
  ],
  "gap": "8px"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"Row"` | Yes | Component type |
| `children` | `Component[]` | Yes | Child components rendered horizontally |
| `gap` | `string` | No | CSS gap value between children |

---

#### Column

Vertical layout container for child components.

```json
{
  "type": "Column",
  "id": "form-fields",
  "children": [
    { "type": "TextField", "id": "name", "label": "Name" },
    { "type": "TextField", "id": "port", "label": "Port" }
  ],
  "gap": "16px"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"Column"` | Yes | Component type |
| `children` | `Component[]` | Yes | Child components rendered vertically |
| `gap` | `string` | No | CSS gap value between children |

---

#### Card

Container with an optional title, used for grouping related content.

```json
{
  "type": "Card",
  "id": "summary-card",
  "title": "Application Summary",
  "children": [
    { "type": "Text", "id": "desc", "content": "Node.js Express API" }
  ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"Card"` | Yes | Component type |
| `title` | `string` | No | Card header text |
| `children` | `Component[]` | Yes | Child components inside the card |

---

### Kickstart Custom Components

Domain-specific components for guided AKS onboarding. These require the Kickstart catalog to render natively — clients with only `basic_catalog` support see a fallback Card with JSON.

#### ConversationPhase

Displays the 6-phase conversation progress indicator. Updated on every tool call.

```json
{
  "type": "ConversationPhase",
  "id": "phase-indicator",
  "phases": [
    { "id": "discover", "label": "Discover", "status": "complete" },
    { "id": "design", "label": "Design", "status": "active" },
    { "id": "generate", "label": "Generate", "status": "pending" },
    { "id": "review", "label": "Review", "status": "pending" },
    { "id": "handoff", "label": "Handoff", "status": "pending" },
    { "id": "deploy", "label": "Deploy", "status": "pending" }
  ],
  "currentPhase": "design"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"ConversationPhase"` | Yes | Component type |
| `phases` | `PhaseItem[]` | Yes | Array of phase objects |
| `currentPhase` | `string` | Yes | ID of the currently active phase |

**PhaseItem:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Phase identifier |
| `label` | `string` | Yes | Human-readable phase name |
| `status` | `"pending" \| "active" \| "complete" \| "skipped"` | Yes | Phase status |

---

#### CodeBlock

Displays generated code with syntax highlighting, filename, and copy/download actions.

```json
{
  "type": "CodeBlock",
  "id": "code-deployment-yaml",
  "code": "apiVersion: apps/v1\nkind: Deployment\n...",
  "language": "yaml",
  "filename": "k8s/deployment.yaml",
  "action": "copy"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"CodeBlock"` | Yes | Component type |
| `code` | `string` | Yes | Source code content |
| `language` | `string` | Yes | Language for syntax highlighting |
| `filename` | `string` | No | Display filename |
| `action` | `"copy" \| "download"` | No | User action on the code block |

---

#### ResourcePicker

Dropdown/selector for Azure resources (subscription, resource group, region, cluster).

```json
{
  "type": "ResourcePicker",
  "id": "region-picker",
  "resourceType": "region",
  "label": "Select a region",
  "options": [
    { "label": "East US", "value": "eastus" },
    { "label": "West Europe", "value": "westeurope" }
  ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"ResourcePicker"` | Yes | Component type |
| `resourceType` | `"subscription" \| "resourceGroup" \| "region" \| "cluster"` | Yes | Type of Azure resource |
| `label` | `string` | Yes | Picker label |
| `value` | `string` | No | Currently selected value |
| `options` | `{ label: string, value: string }[]` | No | Available options |

---

#### DeploymentProgress

Multi-step deployment progress tracker with per-step status.

```json
{
  "type": "DeploymentProgress",
  "id": "deployment-status",
  "steps": [
    { "id": "acr-build", "label": "Build container image", "status": "success" },
    { "id": "aks-deploy", "label": "Deploy to AKS cluster", "status": "running" },
    { "id": "ingress-setup", "label": "Configure ingress", "status": "pending" },
    { "id": "dns-config", "label": "Set up DNS", "status": "pending" }
  ],
  "overallStatus": "running"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"DeploymentProgress"` | Yes | Component type |
| `steps` | `DeploymentStep[]` | Yes | Array of deployment steps |
| `overallStatus` | `"pending" \| "running" \| "success" \| "error"` | Yes | Aggregate status |

**DeploymentStep:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Step identifier |
| `label` | `string` | Yes | Human-readable step name |
| `status` | `"pending" \| "running" \| "success" \| "error" \| "skipped"` | Yes | Step status |
| `detail` | `string` | No | Additional detail text |

---

#### ArchitectureDiagram

Renders an architecture diagram using Mermaid syntax.

```json
{
  "type": "ArchitectureDiagram",
  "id": "app-architecture",
  "mermaid": "graph LR\n  App[My App] --> DB[(PostgreSQL)]\n  App --> Cache[(Redis)]\n  LB[Public URL] --> App"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"ArchitectureDiagram"` | Yes | Component type |
| `mermaid` | `string` | Yes | Mermaid diagram source code |

---

#### CostEstimate

Displays a cost breakdown by service with monthly totals.

```json
{
  "type": "CostEstimate",
  "id": "cost-breakdown",
  "items": [
    { "name": "App Platform", "sku": "Standard", "monthlyCost": 73.00 },
    { "name": "PostgreSQL", "sku": "Burstable B1ms", "monthlyCost": 25.00 },
    { "name": "Container Registry", "sku": "Basic", "monthlyCost": 5.00 }
  ],
  "total": 103.00,
  "currency": "USD"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"CostEstimate"` | Yes | Component type |
| `items` | `CostItem[]` | Yes | Line items |
| `total` | `number` | Yes | Monthly total cost |
| `currency` | `string` | Yes | Currency code (default: `"USD"`) |

**CostItem:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Service name |
| `sku` | `string` | Yes | SKU/tier |
| `monthlyCost` | `number` | Yes | Monthly cost |
| `currency` | `string` | No | Currency code (default: `"USD"`) |

---

#### HandoffCard

Call-to-action card for the Handoff phase — links to Codespaces or vscode.dev.

```json
{
  "type": "HandoffCard",
  "id": "handoff-cta",
  "title": "Your code is ready!",
  "description": "Open in GitHub Codespaces to start building",
  "url": "https://codespaces.new/owner/repo",
  "provider": "codespaces",
  "repoUrl": "https://github.com/owner/repo"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"HandoffCard"` | Yes | Component type |
| `title` | `string` | Yes | Card title |
| `description` | `string` | Yes | Card description |
| `url` | `string` (URI) | Yes | Deep link to IDE |
| `provider` | `"codespaces" \| "vscode-dev"` | Yes | IDE provider |
| `repoUrl` | `string` (URI) | Yes | GitHub repository URL |

---

### GitHub Components

Components for GitHub integration — repo selection, workflow monitoring, IDE links.

#### RepoPicker

Select an existing GitHub repo or create a new one.

```json
{
  "type": "RepoPicker",
  "id": "repo-selector",
  "label": "Choose a repository",
  "allowCreate": true,
  "options": [
    { "label": "my-app", "value": "owner/my-app" },
    { "label": "my-api", "value": "owner/my-api" }
  ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"RepoPicker"` | Yes | Component type |
| `label` | `string` | Yes | Picker label |
| `value` | `string` | No | Selected repo (full name: `owner/repo`) |
| `options` | `{ label: string, value: string }[]` | No | Available repositories |
| `allowCreate` | `boolean` | No | Allow creating a new repo (default: `true`) |

---

#### WorkflowStatus

Displays GitHub Actions workflow run statuses.

```json
{
  "type": "WorkflowStatus",
  "id": "ci-status",
  "runs": [
    { "name": "Build & Deploy", "status": "success", "url": "https://github.com/owner/repo/actions/runs/123" },
    { "name": "Integration Tests", "status": "in_progress" }
  ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"WorkflowStatus"` | Yes | Component type |
| `runs` | `WorkflowRun[]` | Yes | Array of workflow runs |

**WorkflowRun:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Workflow name |
| `status` | `"queued" \| "in_progress" \| "success" \| "failure" \| "cancelled"` | Yes | Run status |
| `url` | `string` (URI) | No | Link to the GitHub Actions run |
| `conclusion` | `string` | No | Final conclusion |

---

#### CodespaceLink

Deep link to open a repository in GitHub Codespaces or vscode.dev.

```json
{
  "type": "CodespaceLink",
  "id": "open-codespace",
  "repo": "owner/my-app",
  "branch": "main",
  "provider": "codespaces",
  "url": "https://codespaces.new/owner/my-app?ref=main",
  "label": "Open in Codespaces"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"CodespaceLink"` | Yes | Component type |
| `repo` | `string` | Yes | Repository full name (`owner/repo`) |
| `branch` | `string` | No | Branch to open |
| `provider` | `"codespaces" \| "vscode-dev"` | Yes | IDE provider |
| `url` | `string` (URI) | Yes | Direct URL to the IDE |
| `label` | `string` | No | Link text |

---

#### AppOverview

At-a-glance summary of the user's application. Avoids K8s jargon — frames everything in app terms.

```json
{
  "type": "AppOverview",
  "id": "app-summary",
  "appName": "My Express API",
  "runtime": "node",
  "services": [
    { "name": "PostgreSQL", "type": "database" },
    { "name": "Redis", "type": "cache" }
  ],
  "status": "generating"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"AppOverview"` | Yes | Component type |
| `appName` | `string` | Yes | Application name |
| `runtime` | `string` | Yes | Runtime/language |
| `services` | `ServiceItem[]` | Yes | Connected services |
| `publicUrl` | `string` (URI) | No | Live URL if deployed |
| `status` | `"planning" \| "generating" \| "ready" \| "deploying" \| "deployed"` | Yes | Current status |

**ServiceItem:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Service display name |
| `type` | `"database" \| "cache" \| "storage" \| "messaging" \| "ai"` | Yes | Service category |

---

## Catalog Negotiation Flow

```
Client                          MCP Server
  │                                 │
  │  initialize (catalogs: [...])   │
  │ ───────────────────────────────>│
  │                                 │  resolveA2UICapability()
  │                                 │  → "kickstart" | "basic" | "none"
  │  initialized                    │
  │ <───────────────────────────────│
  │                                 │
  │  tool/call (kickstart)          │
  │ ───────────────────────────────>│
  │                                 │  createA2UIResource(component, uri, capability)
  │  result (text + resource?)      │  → full | degraded | null
  │ <───────────────────────────────│
```

See [MCP Server — A2UI Catalog Negotiation](./mcp-server.md#a2ui-catalog-negotiation) for implementation details.

---

## Adding a New Custom Component

To add a new component to the Kickstart catalog:

### 1. Define the JSON Schema

Add the component to `packages/core/src/catalog/kickstart-catalog.json` under `$defs`:

```json
"MyComponent": {
  "allOf": [
    { "$ref": "#/$defs/BaseComponent" },
    {
      "properties": {
        "type": { "const": "MyComponent" },
        "myProp": { "type": "string" }
      },
      "required": ["type", "myProp"]
    }
  ]
}
```

### 2. Add to the Component union

In the same file, add a reference in the `Component` `oneOf` array:

```json
"Component": {
  "oneOf": [
    // ... existing components
    { "$ref": "#/$defs/MyComponent" }
  ]
}
```

### 3. Add TypeScript type

Export a TypeScript interface matching the schema in `@kickstart/core` types:

```typescript
export interface MyComponentType {
  type: "MyComponent";
  id?: string;
  myProp: string;
}
```

### 4. Use in tool handlers

Import and use the component in MCP tool handlers:

```typescript
import { createA2UIResource } from "../a2ui.js";

const component: MyComponentType = {
  type: "MyComponent",
  id: "my-instance",
  myProp: "value",
};

const resource = createA2UIResource(component, "a2ui://kickstart/my-component", capability);
if (resource) content.push(resource);
```

The `degradeToBasic()` function in `a2ui.ts` automatically handles fallback for clients that don't support the Kickstart catalog — it wraps any unknown component in a `Card` + `Text` with the JSON serialized as code.
