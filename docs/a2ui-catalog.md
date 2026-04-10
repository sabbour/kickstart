# A2UI Catalog Reference

A2UI (Agent-to-UI) v0.9 is the component protocol Kickstart uses to render rich interactive UI alongside AI responses. The LLM returns structured A2UI JSON; the web surface renders it using React 19 with Fluent 2 styling.

> **Related docs:** [MCP Server](./mcp-server.md) for catalog negotiation · [API Reference](./api-reference.md) for the web endpoint

---

## Overview

### What is A2UI?

A2UI lets AI agents return structured JSON that clients render as interactive UI instead of plain text. Each response is an **A2UI document** containing a component tree.

### Kickstart Catalog

The Kickstart catalog (`packages/web/src/catalog/kickstart-catalog.ts`) is built on the vendor A2UI v0.9 basic catalog plus **16 custom Kickstart components**. The basic catalog provides standard layout and input primitives (Text, Button, Row, Column, Card, TextField, Image, Icon, Tabs, Modal, etc.) with Fluent 2 styled overrides.

### MIME Type

```
application/json+a2ui
```

All A2UI payloads in MCP embedded resources use this MIME type.

---

## Custom Kickstart Components

The 16 Kickstart-specific components are defined in `packages/web/src/catalog/components/` and registered via `kickstartCatalog`.

### RadioGroup

Single-select option group rendered as radio buttons or a visual tile picker.

```json
{
  "type": "RadioGroup",
  "id": "runtime-picker",
  "label": "Select runtime",
  "options": [
    { "label": "Node.js", "value": "node" },
    { "label": "Python", "value": "python" },
    { "label": "Go", "value": "go" }
  ],
  "value": "node"
}
```

---

### FormGroup

Container that groups labelled form fields with validation support.

```json
{
  "type": "FormGroup",
  "id": "app-config",
  "label": "Application settings",
  "children": [
    { "type": "TextField", "id": "app-name", "label": "App name" },
    { "type": "TextField", "id": "port", "label": "Container port" }
  ]
}
```

---

### CodeBlock

Displays generated code with syntax highlighting, optional filename, and copy/download actions.

```json
{
  "type": "CodeBlock",
  "id": "deployment-yaml",
  "code": "apiVersion: apps/v1\nkind: Deployment\n...",
  "language": "yaml",
  "filename": "k8s/deployment.yaml"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Source code content |
| `language` | `string` | Yes | Language for syntax highlighting |
| `filename` | `string` | No | Display filename |

---

### ProgressSteps

Step-by-step progress indicator for multi-step workflows.

```json
{
  "type": "ProgressSteps",
  "id": "onboarding-steps",
  "steps": [
    { "id": "discover", "label": "Discover", "status": "complete" },
    { "id": "design", "label": "Design", "status": "active" },
    { "id": "generate", "label": "Generate", "status": "pending" }
  ],
  "currentStep": "design"
}
```

---

### Markdown

Renders a markdown string as formatted HTML. Used for long-form LLM output blocks that need headings, lists, or code fences.

```json
{
  "type": "Markdown",
  "id": "summary-text",
  "content": "## Architecture Summary\n\nYour app will be deployed on **AKS Automatic**..."
}
```

---

### GitHubLoginCard

OAuth Device Flow sign-in card for GitHub. Presents the device code and polling state until the user completes authentication in a browser.

```json
{
  "type": "GitHubLoginCard",
  "id": "gh-login",
  "deviceCode": "ABCD-EFGH",
  "verificationUrl": "https://github.com/login/device",
  "expiresAt": "2025-01-01T12:30:00Z"
}
```

---

### GitHubRepoPicker

Repository picker with search, pagination, and optional new-repo creation. Populated from the GitHub API via `GitHubConnector`.

```json
{
  "type": "GitHubRepoPicker",
  "id": "repo-selector",
  "label": "Choose a repository",
  "allowCreate": true,
  "options": [
    { "label": "my-app", "value": "owner/my-app" },
    { "label": "my-api", "value": "owner/my-api" }
  ]
}
```

---

### GitHubAction

Displays a GitHub Actions workflow run with status badge and link.

```json
{
  "type": "GitHubAction",
  "id": "ci-run",
  "workflowName": "Build & Deploy",
  "status": "success",
  "runUrl": "https://github.com/owner/repo/actions/runs/123",
  "branch": "main",
  "commitSha": "abc1234"
}
```

| Property | Type | Description |
|----------|------|-------------|
| `status` | `"queued" \| "in_progress" \| "success" \| "failure" \| "cancelled"` | Run status |

---

### GitHubCommit

Displays a single GitHub commit with author, message, and short SHA.

```json
{
  "type": "GitHubCommit",
  "id": "latest-commit",
  "sha": "abc1234",
  "message": "feat: add AKS deployment manifests",
  "author": "Ahmed Sabbour",
  "timestamp": "2025-01-01T12:00:00Z",
  "url": "https://github.com/owner/repo/commit/abc1234"
}
```

---

### AzureLoginCard

MSAL sign-in card with subscription auto-selection. Renders a sign-in button and, once authenticated, shows the signed-in account and available subscriptions.

```json
{
  "type": "AzureLoginCard",
  "id": "azure-login",
  "prompt": "Sign in to discover your Azure resources"
}
```

---

### AzureResourcePicker

Dropdown populated at render time from the Azure Resource Manager API via `AzureARMConnector`. Supports subscription, resource group, region, and cluster picking.

```json
{
  "type": "AzureResourcePicker",
  "id": "cluster-picker",
  "resourceType": "cluster",
  "label": "Select an AKS cluster",
  "subscriptionId": "4498459e-...",
  "value": "my-cluster"
}
```

| Property | Type | Description |
|----------|------|-------------|
| `resourceType` | `"subscription" \| "resourceGroup" \| "region" \| "cluster"` | Type of Azure resource |

---

### AzureResourceForm

Form for configuring new Azure resources — pre-filled with sensible defaults for AKS Automatic deployments.

```json
{
  "type": "AzureResourceForm",
  "id": "new-cluster-form",
  "resourceType": "cluster",
  "fields": [
    { "id": "name", "label": "Cluster name", "value": "my-aks-cluster" },
    { "id": "region", "label": "Region", "value": "eastus" }
  ]
}
```

---

### ArchitectureDiagram

Renders an architecture diagram from Mermaid syntax. Used in the Design phase to visualise the proposed deployment topology.

```json
{
  "type": "ArchitectureDiagram",
  "id": "app-architecture",
  "mermaid": "graph LR\n  App[My App] --> DB[(PostgreSQL)]\n  App --> Cache[(Redis)]\n  LB[Public URL] --> App"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `mermaid` | `string` | Yes | Mermaid diagram source |

---

### FileEditor

Interactive code editor for reviewing and editing generated files. Backed by the virtual file system (`services/virtual-fs`).

```json
{
  "type": "FileEditor",
  "id": "manifest-editor",
  "filename": "k8s/deployment.yaml",
  "language": "yaml",
  "content": "apiVersion: apps/v1\n...",
  "readOnly": false
}
```

| Property | Type | Description |
|----------|------|-------------|
| `readOnly` | `boolean` | Prevent edits (default: `false`) |

---

### CostEstimate

Displays a monthly cost breakdown by Azure service with a total.

```json
{
  "type": "CostEstimate",
  "id": "cost-breakdown",
  "items": [
    { "name": "AKS Automatic", "sku": "Standard", "monthlyCost": 73.00 },
    { "name": "PostgreSQL", "sku": "Burstable B1ms", "monthlyCost": 25.00 },
    { "name": "Container Registry", "sku": "Basic", "monthlyCost": 5.00 }
  ],
  "total": 103.00,
  "currency": "USD"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `items` | `CostItem[]` | Yes | Line items (name, sku, monthlyCost) |
| `total` | `number` | Yes | Monthly total |
| `currency` | `string` | Yes | Currency code (default: `"USD"`) |

---

### DeploymentProgress

Multi-step deployment progress tracker with per-step status. Used during the Deploy phase to show live deployment state.

```json
{
  "type": "DeploymentProgress",
  "id": "deployment-status",
  "steps": [
    { "id": "acr-build", "label": "Build container image", "status": "success" },
    { "id": "aks-deploy", "label": "Deploy to AKS cluster", "status": "running" },
    { "id": "ingress-setup", "label": "Configure ingress", "status": "pending" }
  ],
  "overallStatus": "running"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `steps` | `DeploymentStep[]` | Yes | Array of steps |
| `overallStatus` | `"pending" \| "running" \| "success" \| "error"` | Yes | Aggregate status |

**DeploymentStep:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Step identifier |
| `label` | `string` | Yes | Human-readable name |
| `status` | `"pending" \| "running" \| "success" \| "error" \| "skipped"` | Yes | Step status |
| `detail` | `string` | No | Additional detail text |

---

## Fat A2UI Components

Starting in v0.3.0, Kickstart includes **fat components** — opinionated, self-managing implementations of common workflows with built-in authentication, validation, and security controls. These are registered as part of the `azure` and `github` IntegrationKits.

### Azure Fat Components

| Component | Purpose | Auth | Security |
|-----------|---------|------|----------|
| **AzureLoginCard** | Device code auth flow for Azure MSAL | MSAL | Token in memory; logout clears session |
| **AzureResourcePicker** | Browse subscriptions and list resources | AzureARMConnector | Rate-limit handling; stub fallback |
| **AzureResourceForm** | Collect deployment parameters and estimate cost | AzureARMConnector | Input validation; cost preview before submit |

### GitHub Fat Components

| Component | Purpose | Auth | Security |
|-----------|---------|------|----------|
| **GitHubLoginCard** | Device code auth flow for GitHub OAuth | GitHub OAuth | Token in memory; no localStorage |
| **GitHubRepoPicker** | Search and select from user's repositories | GitHubConnector | Debounced search; pagination; rate-limit warnings |
| **GitHubAction** | Execute allowlisted GitHub API operations | GitHubConnector | Operation allowlisting; typed confirmation for DELETE |
| **GitHubCommit** | Create pull request with artifact selection | GitHubConnector | Branch validation; protected-branch guards; diff preview |

**Key Security Features:**
- **In-memory token storage** — No localStorage; tokens cleared on logout
- **Operation allowlisting** — Write operations must be explicitly approved
- **Typed confirmation** — DELETE and merge operations require developer confirmation
- **Protected-branch blocking** — Cannot push to main/master/production

---

## Vendor A2UI Basic Catalog (Fluent-Styled)

The vendor A2UI v0.9 basic catalog provides standard primitives. Kickstart overrides all of these with Fluent 2 styled implementations in `packages/web/src/catalog/fluent-components/`:

Text, Image, Icon, Video, AudioPlayer, Row, Column, List, Card, Tabs, Modal, Divider, Button, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput

---

## Adding a New Custom Component

### 1. Create the component file

Add `packages/web/src/catalog/components/MyComponent.tsx`:

```tsx
import { createReactComponent } from '../vendor/a2ui/react/adapter';
import { MyComponentApi } from './MyComponent.api';

export const MyComponent = createReactComponent(MyComponentApi, ({ props }) => (
  <div>{props.myProp}</div>
));
```

### 2. Register in the catalog

Add the import and entry to `packages/web/src/catalog/kickstart-catalog.ts`:

```typescript
import { MyComponent } from './components/MyComponent';

const kickstartComponents = [
  // ...existing components
  MyComponent,
];
```

### 3. Register in the IntegrationKit (optional)

If the component is contributed by a kit, add to the kit's `components` array:

```typescript
export const myKit: IntegrationKit = {
  // ...
  components: [{ type: 'MyComponent', description: 'Does X' }],
};
```

### 4. Use in tool handlers

The component type string is sent in A2UI JSON from the LLM or tool handler response. The catalog runtime looks up the registered React component by `type` and renders it.
