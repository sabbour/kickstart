# Integration Kits Reference

Integration Kits are the composable extension system for Kickstart. Each kit bundles tools, API connectors, system-prompt augmentations, skills, and UI component registrations into a single registerable unit — everything the conversation engine needs to integrate with an external platform.

> **Related docs:** [Architecture](./architecture.md) · [Prompt Architecture](./prompt-architecture.md) · [A2UI Catalog](./a2ui-catalog.md) · [API Reference](./api-reference.md)

---

## What is an IntegrationKit?

An `IntegrationKit` is a TypeScript object that satisfies the `IntegrationKit` interface (`packages/core/src/kits/types.ts`). It acts as the canonical unit for extending Kickstart with a new integration target (e.g. Azure, GitHub).

When a kit is registered, the registry automatically:

1. Validates auth requirements (provider/scopes schema)
2. Validates dependencies (all declared deps must already be registered)
3. Detects circular dependencies via DFS
4. Detects tool/connector name collisions across kits
5. Registers all kit tools into the `ToolRegistry`
6. Registers all kit connectors into the `APIConnectorRegistry`
7. Calls the `onActivate()` lifecycle hook (if provided)
8. On `onActivate` failure, **rolls back all changes** (transactional)

### Trust Model

Kits are **trusted first-party code**. No sandboxing is applied — lifecycle hooks and tool execute functions run with full process privileges. If third-party kits are needed in the future, implement capability restrictions and sandboxing first.

---

## Kit API Surface

The `IntegrationKit` interface (`packages/core/src/kits/types.ts`):

```typescript
interface IntegrationKit {
  // ── Identity ────────────────────────────────────────────────────────
  name: string;            // Unique ID, e.g. 'azure', 'github'
  description: string;     // Human-readable summary

  // ── Core contributions ──────────────────────────────────────────────
  tools: Tool<any>[];      // LLM-callable functions (auto-registered)
  connectors: APIConnector[]; // Authenticated API clients (auto-registered)

  // ── Prompt augmentations ────────────────────────────────────────────
  prompts?: string[];      // Flat system-prompt augmentations (all phases)
  phasePrompts?: Partial<Record<Phase, string[]>>; // Per-phase overrides
  skills?: Skill[];        // Typed domain knowledge (phase + keyword filtered)

  // ── UI surface ──────────────────────────────────────────────────────
  components?: ComponentRegistration[]; // A2UI component type registrations

  // ── ServicePack extensions ──────────────────────────────────────────
  auth?: KitAuthRequirement[];    // Declarative auth requirements
  dependencies?: string[];         // Kit names that must register first
  onActivate?: () => Promise<void>;  // Post-registration lifecycle hook
  onDeactivate?: () => Promise<void>; // Pre-removal lifecycle hook
}
```

### Field Details

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique kit identifier. Used as the key in the kit registry. |
| `description` | Yes | Human-readable summary of what the kit provides. |
| `tools` | Yes | Array of LLM-callable `Tool` objects. Auto-registered into `ToolRegistry`. |
| `connectors` | Yes | Array of `APIConnector` instances. Auto-registered into `APIConnectorRegistry`. |
| `prompts` | No | Flat prompt strings injected for all phases (filtered by keyword heuristics when `phasePrompts` is not set). |
| `phasePrompts` | No | Per-phase prompt arrays. When present for a given phase, these take priority over `prompts`. |
| `skills` | No | Typed `Skill` objects with keyword-based activation, priority ordering, and per-phase filtering. Resolved alongside (not replacing) prompt arrays. |
| `components` | No | A2UI component registrations. Core records type identifiers and descriptions; the web package binds actual React components. |
| `auth` | No | Declarative auth requirements. The web layer reads these to configure auth providers. |
| `dependencies` | No | Names of kits that must be registered before this one. |
| `onActivate` | No | Async hook called after registration + dependency validation. Failure triggers rollback. |
| `onDeactivate` | No | Async hook called before removal. Failure keeps the kit registered. |

### ComponentRegistration

```typescript
interface ComponentRegistration {
  type: string;          // A2UI component type, e.g. 'azureLoginCard'
  description: string;   // Human-readable description
  promptMeta?: {
    category: ComponentCategory;  // Category for the prompt catalog
    example: string;              // JSON example shown to the LLM
    notes?: string;               // Optional notes after the example
  };
}
```

### KitAuthRequirement

```typescript
interface KitAuthRequirement {
  provider: string;    // e.g. 'azure-msal', 'github-oauth'
  scopes: string[];    // OAuth scopes or permissions required
  optional?: boolean;  // If true, kit works (degraded) without this auth
}
```

---

## Kit Registry

The `IntegrationKitRegistry` class (`packages/core/src/kits/registry.ts`) manages the full lifecycle of kits.

### Singleton

```typescript
import { defaultKitRegistry, registerKit } from '@kickstart/core';

// Register at app startup
await registerKit(azureKit);
await registerKit(githubKit);
```

`defaultKitRegistry` is backed by the default `ToolRegistry` and `APIConnectorRegistry` singletons. The `registerKit()` convenience function delegates to `defaultKitRegistry.register()`.

### Registry API

| Method | Description |
|--------|-------------|
| `register(kit)` | Register a kit — validates, wires tools/connectors, calls `onActivate`. Transactional on failure. |
| `unregister(name)` | Remove a kit. Blocks if other kits depend on it. Calls `onDeactivate` first. |
| `get(name)` | Look up a kit by name. Returns `undefined` if not found. |
| `getAll()` | Returns all registered kits. |
| `names()` | Returns all registered kit names. |
| `has(name)` | Returns `true` if a kit is registered. |
| `size` | Number of registered kits. |
| `getDependents(name)` | Returns kit names that depend on the given kit. |
| `getToolOwner(toolName)` | Returns the kit that owns a tool. |
| `getConnectorOwner(name)` | Returns the kit that owns a connector. |
| `getComponentCatalogEntries()` | Collects A2UI component catalog entries from all kits with `promptMeta`. |

### Registration Lifecycle

```
register(kit)
  ├─ validateAuth(kit)              — schema check on auth requirements
  ├─ self-dependency check          — kit.dependencies cannot include kit.name
  ├─ dependency validation          — all deps must be registered
  ├─ cycle detection (DFS)          — no circular dependency chains
  ├─ collision detection            — no tool/connector name clashes across kits
  ├─ clean up previous (if re-reg)  — remove old tools/connectors
  ├─ register kit + tools + connectors
  └─ onActivate()                   — if it throws, full rollback
```

### Unregistration Lifecycle

```
unregister(name)
  ├─ reverse-dependency check       — blocks if other kits depend on this one
  ├─ onDeactivate()                 — if it throws, kit stays registered
  └─ remove tools + connectors + kit
```

---

## How Kits Feed the LLM

Kits inject domain knowledge into the system prompt through the **Skill Resolver** (`packages/core/src/engine/skill-resolver.ts`).

### Three-Layer Resolution

The resolver uses a priority chain to determine which prompts to inject for a given phase:

1. **Skills** (highest priority) — Typed `Skill` objects filtered by phase and activated by keyword matching against conversation history. Sorted by `priority` (higher first).
2. **Phase Prompts** — Explicit per-phase prompt arrays from `kit.phasePrompts[phase]`. When present for a phase, these replace flat prompts for that kit.
3. **Flat Prompts** (backward compat) — Strings from `kit.prompts[]` classified to phases by keyword heuristics.

### `resolveSkills()` Function

```typescript
import { resolveSkills } from '@kickstart/core';

const result = resolveSkills(Phase.Design, defaultKitRegistry.getAll());
// result.prompts  — ordered list of prompt strings for the system prompt
// result.availableTools — tool names available in this phase
```

The middleware chain:
1. **Phase Filter** — keeps only skills whose `phases` array includes the current phase
2. **Keyword Activation** — scans conversation history for skill keywords, activates matches
3. **Priority Order** — sorts so higher-priority skills appear first in the prompt

### Async Variant

```typescript
const result = await resolveSkillsAsync(Phase.Design, kits, conversationHistory);
```

Runs the full middleware chain including custom middleware registered via `registerSkillMiddleware()`.

### Formatting for System Prompt

```typescript
import { formatSkillsSection } from '@kickstart/core';

const section = formatSkillsSection(result);
// Returns: "## Available Capabilities\n\n{skill content}"
```

---

## Azure Kit

**Source:** `packages/core/src/kits/azure-kit.ts`

The Azure kit provides ARM resource discovery, cost estimation, AKS deployment guidance, and IaC best-practice knowledge.

### Tools

| Tool | Description |
|------|-------------|
| `azure_resource_list` | Discover existing resources in a subscription before recommending new ones |
| `azure_resource_get` | Inspect a specific resource's ARM configuration |
| `estimate_cost` | Budget estimation using the Azure Retail Pricing API |

### Connectors

| Connector | Auth | Description |
|-----------|------|-------------|
| `AzureARMConnector` | MSAL (azure-msal) | Azure Resource Manager REST API client |
| `PricingConnector` | None | Azure Retail Pricing API (public, no auth required) |

### Auth Requirements

```typescript
{
  provider: 'azure-msal',
  scopes: ['https://management.azure.com/.default'],
  optional: false
}
```

### A2UI Components

| Component | Description |
|-----------|-------------|
| `AuthCard` (provider: "azure") | MSAL sign-in card with automatic subscription discovery |
| `azureResourcePicker` | Cascading subscription → resource group → resource selector |
| `azureResourceForm` | Dynamic ARM-driven form for resource creation |
| `azureAction` | Write-with-confirm pattern for ARM operations (destructive ops require typing resource name) |

### Skills (IaC Best Practices)

The Azure kit includes five IaC skills activated by keyword matching:

| Skill ID | Name | Phases | Priority | Keywords |
|----------|------|--------|----------|----------|
| `iac-bicep-modules` | Bicep Module Conventions | Generate | 5 | bicep, module, infrastructure, iac, template, arm |
| `iac-secure-decorators` | @secure() Decorator Usage | Generate, Review | 10 | secure, secret, password, key, connection, credential |
| `iac-diagnostic-settings` | Diagnostic Settings | Generate, Review | 3 | diagnostic, logging, monitoring, log analytics, metrics, observability |
| `iac-resource-tagging` | Resource Tagging Strategy | Generate | 2 | tag, tagging, label, metadata, environment, cost tracking |
| `iac-least-privilege-rbac` | Least-Privilege RBAC | Generate, Review | 10 | rbac, role, permission, identity, access, authorization, privilege |

### Phase Prompts

The Azure kit provides explicit per-phase prompts:

| Phase | Focus |
|-------|-------|
| **Discover** | Call `azure_resource_list` early to discover existing AKS clusters and ACR registries |
| **Design** | Prefer AKS Automatic, recommend managed services, include KAITO for AI/ML, provide pricing reference |
| **Generate** | AKS Automatic manifests (Gateway API, Workload Identity, ACR integration, HPA, PDB), KAITO/RAGEngine CRDs, detailed AKS knowledge |
| **Review** | Final cost breakdown via `estimate_cost`, deployment safeguard validation |
| **Handoff** | OIDC setup reminder, GitHub Actions deployment workflow verification |
| **Deploy** | Resource confirmation via `azure_resource_list/get`, DeploymentProgress tracking |

### Flat Prompts (All Phases)

General Azure knowledge injected across all phases when `phasePrompts` is not explicit:

- **AKS Automatic** — always prefer `aksAutomatic` over manual cluster configuration
- **Resource Discovery** — use `azure_resource_list` before recommending new resources
- **Cost Transparency** — use `estimate_cost` before proposing deployment plans
- **Deployment Safeguards** — hide K8s complexity behind AKS Automatic
- **KAITO** — AI/ML workload guidance (GPU provisioning, model inference, preset models)
- **RAGEngine** — RAG pipeline guidance (document ingestion, vector store, query-time retrieval)
- **Fine-tuning** — LoRA/QLoRA fine-tuning on AKS GPU nodes
- **ARM PUT Templates** — Validated ARM body templates for AKS, App Service, ACR, Container Apps, Storage, Key Vault, and Role Assignments

### Azure APIs Unlocked

Through the Azure kit's tools and connectors, the LLM can:

- **ARM (Resource Manager)** — list/get any Azure resource by subscription/resource group
- **Container Apps** — deploy apps via ARM PUT with managed environment references
- **AKS** — create/configure AKS Automatic clusters (Gateway API, Workload Identity, NAP)
- **Pricing** — estimate monthly costs by querying the Azure Retail Pricing API
- **Service Connector patterns** — Managed Identity + RBAC role assignment instead of connection strings

---

## GitHub Kit

**Source:** `packages/core/src/kits/github-kit.ts`

The GitHub kit provides repository inspection, CI detection, and source-to-AKS deployment wiring.

### Tools

| Tool | Description |
|------|-------------|
| `github_repo_info` | Detect runtime, language, CI setup, topics from a GitHub repo |
| `github_repo_tree` | Recursive file tree with key-file detection (Dockerfile, manifests, CI workflows) |
| `github_repo_file_read` | Read individual files for manifest/dependency inspection |

### Connectors

| Connector | Auth | Description |
|-----------|------|-------------|
| `GitHubConnector` | GitHub OAuth (Device Flow + PAT) | GitHub REST API client |

### Auth Requirements

```typescript
{
  provider: 'github-oauth',
  scopes: ['repo', 'read:user'],
  optional: false
}
```

### A2UI Components

| Component | Description |
|-----------|-------------|
| `AuthCard` (provider: "github") | OAuth Device Flow sign-in card |
| `githubRepoPicker` | Repository picker with search and client-side filtering |

### Phase Prompts

| Phase | Focus |
|-------|-------|
| **Discover** | Full repo analysis protocol: metadata → file tree → read key manifests → synthesize app profile |
| **Design** | Check for existing GitHub Actions workflows, extend rather than replace, trunk-based strategy |
| **Generate** | Generate `.github/workflows/deploy.yml` with OIDC, ACR push, AKS rolling update |
| **Handoff** | Guide push to GitHub, verify OIDC federation setup, offer Codespaces link |
| **Deploy** | GitHub Actions handles deployment, manual trigger via `workflow_dispatch` |

### Flat Prompts (All Phases)

- **Repository-first approach** — always call `github_repo_info` when a user provides a repo URL
- **CI/CD wiring** — include GitHub Actions workflow with OIDC Workload Identity Federation
- **Branch strategy** — trunk-based: default branch → production, PRs → preview environments
- **OIDC pipeline setup** — 5-step federation setup: Entra app, federated credential, RBAC roles, GitHub secrets, workflow config

---

## Creating a Custom Kit

```typescript
import type { IntegrationKit } from '@kickstart/core';
import { Phase } from '@kickstart/core';

export const myKit: IntegrationKit = {
  name: 'my-platform',
  description: 'Integrates with My Platform for deployment',

  tools: [myTool],
  connectors: [new MyConnector()],

  prompts: [
    'General knowledge available in all phases...',
  ],

  phasePrompts: {
    [Phase.Discover]: ['Discovery-specific instructions...'],
    [Phase.Generate]: ['Code generation rules...'],
  },

  skills: [{
    id: 'my-skill',
    name: 'My Domain Knowledge',
    phases: [Phase.Design, Phase.Generate],
    keywords: ['my-platform', 'deploy'],
    priority: 5,
    content: '## My Platform Best Practices\n\n...',
  }],

  components: [{
    type: 'myComponent',
    description: 'Renders my custom UI element',
  }],

  auth: [{
    provider: 'my-oauth',
    scopes: ['read', 'write'],
    optional: false,
  }],

  // Dependencies — register these kits first
  dependencies: ['azure'],

  // Lifecycle hooks
  onActivate: async () => { /* post-registration setup */ },
  onDeactivate: async () => { /* pre-removal cleanup */ },
};
```

Register at app startup:

```typescript
import { registerKit } from '@kickstart/core';
import { azureKit } from '@kickstart/core/kits/azure-kit';
import { myKit } from './my-kit';

await registerKit(azureKit);  // dependency first
await registerKit(myKit);
```

---

## Configuration

### Azure Kit Environment

The Azure kit requires MSAL authentication configured in the web layer. The `AzureARMConnector` uses token-based auth acquired via MSAL with scope `https://management.azure.com/.default`. The `PricingConnector` requires no auth (public API).

The Azure OpenAI model used by the conversation engine is configured separately through the server's environment variables (see [Deployment](./deployment.md)).

### GitHub Kit Environment

The GitHub kit uses OAuth Device Flow for browser-based authentication. The `GitHubConnector` acquires tokens via the device code flow or accepts a pre-configured PAT. Required OAuth scopes: `repo`, `read:user`.

---

## Kit Dependency Graph

```
azureKit (standalone)
  ├─ tools: azure_resource_list, azure_resource_get, estimate_cost
  ├─ connectors: AzureARMConnector, PricingConnector
  └─ skills: 5 IaC best-practice skills

githubKit (standalone)
  ├─ tools: github_repo_info, github_repo_tree, github_repo_file_read
  └─ connectors: GitHubConnector
```

Both built-in kits are standalone (no cross-dependencies). Custom kits can declare dependencies on either or both.
