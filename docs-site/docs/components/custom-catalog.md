---
sidebar_position: 1
---

# Custom Kickstart Catalog

Kickstart extends the A2UI v0.9 basic catalog with **16 custom components** designed for the AKS deployment onboarding experience. These components are registered in `packages/web/src/catalog/kickstart-catalog.ts`.

## Component Categories

| Category | Components |
|----------|-----------|
| **Forms & Input** | RadioGroup, FormGroup |
| **Content** | CodeBlock, ProgressSteps, Markdown |
| **GitHub** | GitHubLoginCard, GitHubRepoPicker, GitHubAction, GitHubCommit |
| **Azure** | AzureLoginCard, AzureResourcePicker, AzureResourceForm |
| **Deployment** | ArchitectureDiagram, FileEditor, CostEstimate, DeploymentProgress |

## Forms & Input

A card-based radio selection where each option is rendered as a clickable card with a title, description, and optional "recommended" badge.

**Use case:** Selecting runtime, cluster tier, or deployment strategy.

```json
{
  "id": "runtime-select",
  "type": "RadioGroup",
  "dataModel": {
    "label": "Select your application runtime",
    "options": [
      {
        "value": "node",
        "title": "Node.js",
        "description": "Express, Fastify, or other Node.js frameworks",
        "recommended": true
      },
      {
        "value": "python",
        "title": "Python",
        "description": "Django, Flask, or FastAPI applications"
      },
      {
        "value": "dotnet",
        "title": ".NET",
        "description": "ASP.NET Core web applications"
      }
    ],
    "selectedValue": "node"
  }
}
```

## FormGroup

A form container with a title, optional step indicator, and child components. Groups related inputs into a visually distinct section.

**Use case:** Gathering deployment configuration (app name, resource group, region).

```json
{
  "id": "deploy-config",
  "type": "FormGroup",
  "dataModel": {
    "title": "Deployment Configuration",
    "step": 2,
    "totalSteps": 4,
    "description": "Configure where your application will be deployed"
  }
}
```

Child components reference the FormGroup via `parentId`:

```json
{
  "id": "app-name-input",
  "type": "Input",
  "parentId": "deploy-config",
  "dataModel": {
    "label": "Application name",
    "placeholder": "my-awesome-app",
    "value": ""
  }
}
```

## CodeBlock

A syntax-highlighted code block with a filename header and copy-to-clipboard button. Supports all common languages.

**Use case:** Displaying generated Dockerfiles, Kubernetes manifests, GitHub Actions workflows.

```json
{
  "id": "dockerfile",
  "type": "CodeBlock",
  "dataModel": {
    "filename": "Dockerfile",
    "language": "dockerfile",
    "code": "FROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --production\nCOPY . .\nRUN npm run build\n\nFROM node:20-alpine\nWORKDIR /app\nCOPY --from=builder /app/dist ./dist\nCOPY --from=builder /app/node_modules ./node_modules\nEXPOSE 3000\nCMD [\"node\", \"dist/server.js\"]"
  }
}
```

## ProgressSteps

A horizontal step indicator that shows the current position in a multi-step process. Each step has a label and a status.

**Use case:** Showing deployment progress (Build → Push → Deploy → Verify).

```json
{
  "id": "deploy-progress",
  "type": "ProgressSteps",
  "dataModel": {
    "steps": [
      { "label": "Build Image", "status": "complete" },
      { "label": "Push to ACR", "status": "complete" },
      { "label": "Deploy to AKS", "status": "active" },
      { "label": "Verify Health", "status": "pending" }
    ]
  }
}
```

### Step Statuses

| Status | Appearance |
|--------|------------|
| `pending` | Gray, not yet started |
| `active` | Blue (primary color), currently in progress with animation |
| `complete` | Green with checkmark |
| `error` | Red with error icon |

---

## GitHub Components

### GitHubLoginCard

OAuth Device Flow sign-in card. Presents a device code and verification URL for the user to authenticate in a browser tab.

### GitHubRepoPicker

Repository picker with search and pagination populated from the GitHub API via `GitHubConnector`. Supports creating new repositories.

### GitHubAction

Displays a GitHub Actions workflow run with status badge (queued / in_progress / success / failure / cancelled) and a direct link to the run.

### GitHubCommit

Shows a single commit with author, message, short SHA, and timestamp.

---

## Azure Components

### AzureLoginCard

MSAL sign-in card that handles Azure Active Directory authentication via the SPA Auth Code + PKCE flow. Shows the signed-in account and allows subscription selection once authenticated.

### AzureResourcePicker

Dropdown populated at render time from the Azure Resource Manager API via `AzureARMConnector`. Supports subscription, resource group, region, and AKS cluster picking.

### AzureResourceForm

Form for configuring new Azure resources, pre-filled with sensible defaults for AKS Automatic deployments (cluster name, region, resource group, tier).

---

## Deployment Components

### ArchitectureDiagram

Renders a Mermaid diagram as an SVG architecture diagram. Used in the Design phase to visualise the proposed topology.

### FileEditor

Interactive code editor for reviewing and editing generated deployment files. Backed by the in-memory virtual file system.

### CostEstimate

Monthly cost breakdown by Azure service with a total. Line items include name, SKU, and monthly cost. Populated from the Azure Retail Prices API via `estimate_cost` tool.

### DeploymentProgress

Multi-step deployment tracker with per-step status (pending / running / success / error / skipped) and an overall status indicator. Used during the Deploy phase to show live state.
