---
sidebar_position: 2
---

# A2UI v0.9 Integration

Kickstart uses [A2UI (Agent-to-User Interface)](https://github.com/nicholasgasior/a2ui) v0.9 — a protocol for rendering structured AI output as interactive UI components. Instead of the AI returning plain text, it returns A2UI instructions that the frontend renders as cards, forms, code blocks, and more.

## How It Works

The A2UI renderer is vendored directly into the project at:

```
packages/web/src/vendor/a2ui/
```

The integration follows this flow:

1. The LLM returns a JSON envelope containing an `a2ui` array
2. `MessageProcessor` iterates over the A2UI messages
3. Each message creates or updates a **surface** — a container for components
4. Surfaces are rendered using **catalog components** — React components mapped by type

## Component Model

A2UI uses a **flat adjacency list** model, not nested component trees. Each component has:

- `id` — unique identifier within the surface
- `type` — component type from the catalog (e.g., `Text`, `Card`, `Button`)
- `dataModel` — component-specific data (text content, options, status, etc.)
- `parentId` — optional reference to a parent component for layout

This flat model allows the AI to update individual components without resending the entire tree.

## Basic Catalog (18 components)

The vendored A2UI renderer includes these standard components:

| Component | Purpose |
|-----------|---------|
| `Text` | Rich text content (markdown supported) |
| `Button` | Clickable action button |
| `Card` | Bordered container with title and content |
| `Tabs` | Tabbed content container |
| `TabPanel` | Content panel within Tabs |
| `List` | Ordered or unordered list |
| `ListItem` | Item within a List |
| `Table` | Data table with headers |
| `Image` | Image display |
| `Link` | Hyperlink |
| `Divider` | Visual separator |
| `Badge` | Small label/tag |
| `Icon` | Icon display |
| `Chip` | Compact interactive element |
| `Input` | Text input field |
| `Select` | Dropdown selection |
| `Checkbox` | Boolean toggle |
| `Switch` | On/off toggle |

## A2UI Message Types

### `createSurface`

Creates a new surface (UI container) with a specific catalog:

```json
{
  "version": "v0.9",
  "createSurface": {
    "surfaceId": "architecture-view",
    "catalogId": "kickstart"
  }
}
```

### `updateComponents`

Adds or updates components within a surface:

```json
{
  "version": "v0.9",
  "updateComponents": {
    "surfaceId": "architecture-view",
    "components": [
      {
        "id": "title",
        "type": "Text",
        "dataModel": {
          "text": "## Proposed Architecture"
        }
      },
      {
        "id": "services-card",
        "type": "Card",
        "dataModel": {
          "title": "Azure Services",
          "variant": "outlined"
        }
      }
    ]
  }
}
```

### `updateDataModel`

Updates just the data of an existing component (without replacing it):

```json
{
  "version": "v0.9",
  "updateDataModel": {
    "surfaceId": "architecture-view",
    "componentId": "deploy-progress",
    "dataModel": {
      "currentStep": 3,
      "status": "active"
    }
  }
}
```

## Smart Components

Starting in v0.3.0, Kickstart includes **smart components** — self-managing implementations of common workflows with built-in authentication, validation, and security controls. Contributed by the `pack-azure` and `pack-github` packs.

### Azure Smart Components

| Component | Purpose | Auth | Security |
|-----------|---------|------|----------|
| **AzureLoginCard** | Device code auth flow for Azure MSAL | MSAL | Token in memory; logout clears session |
| **AzureResourcePicker** | Browse subscriptions and list resources | AzureARMConnector | Rate-limit handling; stub fallback |
| **AzureResourceForm** | Collect deployment parameters and estimate cost | AzureARMConnector | Input validation; cost preview before submit |

### GitHub Smart Components

| Component | Purpose | Auth | Security |
|-----------|---------|------|----------|
| **GitHubLoginCard** | Device code auth flow for GitHub OAuth | GitHub OAuth | Token in memory; no localStorage |
| **GitHubRepoPicker** | Search and select from user's repositories | GitHubConnector | Debounced search; pagination; rate-limit warnings |
| **GitHubAction** | Execute allowlisted GitHub API operations | GitHubConnector | Operation allowlisting; typed confirmation for DELETE |
| **GitHubCommit** | Create pull request with artifact selection | GitHubConnector | Branch validation; protected-branch guards; diff preview |

**Key security features:**
- **In-memory token storage** — No localStorage; tokens cleared on logout
- **Operation allowlisting** — Write operations must be explicitly approved
- **Typed confirmation** — DELETE and merge operations require developer confirmation
- **Protected-branch blocking** — Cannot push to `main`/`master`/`production`

See [Extending the A2UI Component System](../components/extending-a2ui.md) for how to build your own smart component.

## Custom Kickstart Catalog

Kickstart extends the basic catalog with 4 custom components tailored for the deployment onboarding experience. See [Custom Kickstart Catalog](../components/custom-catalog.md) for details.
