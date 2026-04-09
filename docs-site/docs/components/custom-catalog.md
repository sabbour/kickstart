---
sidebar_position: 1
---

# Custom Kickstart Catalog

Kickstart extends the A2UI v0.9 basic catalog with 4 custom components designed for the deployment onboarding experience. These components are registered in the Kickstart catalog and can be used by the AI in any surface.

## RadioGroup

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
