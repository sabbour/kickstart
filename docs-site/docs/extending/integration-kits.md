---
sidebar_position: 4
---

# Integration Kits

An IntegrationKit is the canonical unit for extending Kickstart with a new integration surface. It bundles tools, API connectors, system-prompt augmentations, UI component registrations, and lifecycle hooks into a single composable package. When you register a kit, everything gets wired up automatically — tools go into the ToolRegistry, connectors into the APIConnectorRegistry, and prompts into the skill resolver.

This guide covers the kit interface, the registry, built-in kits, and how to create your own.

## How Kits Work

### The IntegrationKit Interface

Every kit implements the `IntegrationKit` interface defined in `packages/core/src/kits/types.ts`:

```typescript
export interface IntegrationKit {
  name: string;
  description: string;
  tools: Tool<any>[];
  connectors: APIConnector[];
  prompts?: string[];
  phasePrompts?: Partial<Record<Phase, string[]>>;
  skills?: Skill[];
  components?: ComponentRegistration[];
  auth?: KitAuthRequirement[];
  dependencies?: string[];
  onActivate?: () => Promise<void>;
  onDeactivate?: () => Promise<void>;
}
```

| Property | Type | Description |
|---|---|---|
| `name` | `string` | Unique kit identifier (e.g. `"azure"`, `"github"`) |
| `description` | `string` | Human-readable summary of what the kit provides |
| `tools` | `Tool<any>[]` | LLM-callable functions — auto-registered into `ToolRegistry` |
| `connectors` | `APIConnector[]` | Authenticated API clients — auto-registered into `APIConnectorRegistry` |
| `prompts` | `string[]?` | Flat system-prompt augmentations injected for all phases (or filtered by keyword heuristics) |
| `phasePrompts` | `Partial<Record<Phase, string[]>>?` | Per-phase prompt augmentations — takes priority over flat `prompts` for a given phase |
| `skills` | `Skill[]?` | Typed domain knowledge injected per-phase with keyword activation and priority ordering |
| `components` | `ComponentRegistration[]?` | A2UI component type registrations (frontend binding is in `packages/web`) |
| `auth` | `KitAuthRequirement[]?` | Declarative auth requirements — the web layer uses these to wire providers |
| `dependencies` | `string[]?` | Names of kits that must be registered before this one |
| `onActivate` | `() => Promise<void>?` | Lifecycle hook called after registration and dependency validation |
| `onDeactivate` | `() => Promise<void>?` | Lifecycle hook called before the kit is removed from the registry |

### Supporting Types

#### ComponentRegistration

```typescript
interface ComponentRegistration {
  type: string;           // A2UI component type identifier, e.g. 'azureLoginCard'
  description: string;    // Human-readable description
  promptMeta?: {
    category: ComponentCategory;  // Grouping for the prompt catalog
    example: string;              // JSON example shown to the LLM
    notes?: string;               // Optional notes after the example
  };
}
```

#### KitAuthRequirement

```typescript
interface KitAuthRequirement {
  provider: string;    // Auth provider identifier, e.g. 'azure-msal', 'github-oauth'
  scopes: string[];    // OAuth scopes or permission strings
  optional?: boolean;  // If true, the kit can function (degraded) without this auth
}
```

### The Kit Registry

`packages/core/src/kits/registry.ts` exports an `IntegrationKitRegistry` class and a `defaultKitRegistry` singleton:

```typescript
import { registerKit, defaultKitRegistry } from "@kickstart/core";

// Register at app startup (dependencies first)
await registerKit(githubKit);
await registerKit(azureKit);

// Query registered kits
defaultKitRegistry.get("azure");
defaultKitRegistry.getAll();
defaultKitRegistry.names();
defaultKitRegistry.has("github");
```

#### What happens when you register a kit

1. **Auth validation** — verifies `provider` is non-empty and `scopes` is a non-empty string array
2. **Dependency validation** — all declared deps must be registered first
3. **Cycle detection** — DFS walk detects circular dependency chains (e.g. A → B → A)
4. **Collision detection** — tool and connector names must be unique across kits
5. **Tool auto-wiring** — all `tools` are registered into the `ToolRegistry`
6. **Connector auto-wiring** — all `connectors` are registered into the `APIConnectorRegistry`
7. **Lifecycle hook** — `onActivate()` is called if provided
8. **Transactional rollback** — if `onActivate()` throws, all changes are rolled back (tools unregistered, connectors removed, kit deleted)

#### Unregistration

```typescript
await defaultKitRegistry.unregister("my-kit");
```

Unregistration blocks if other kits declare this kit as a dependency. `onDeactivate()` is called before removal — if it throws, the kit stays registered.

### Prompt Resolution

Kits contribute to the system prompt at three levels (highest priority first):

1. **`skills`** — typed `Skill` objects filtered by phase and activated by keyword matching in conversation history. Skills have explicit `priority` ordering.
2. **`phasePrompts[phase]`** — explicit per-phase augmentations. When present for a given phase, these take priority over the flat `prompts` array.
3. **`prompts`** — flat augmentations filtered by keyword heuristics in the skill resolver for backward compatibility.

The skill resolver (`packages/core/src/engine/skill-resolver.ts`) runs a middleware chain: phaseFilter → keywordActivation → priorityOrder. See [Conversation Phases](./conversation-phases.md) for details on how skills are resolved per phase.

### Trust Model

Kits are **trusted first-party code**. No sandboxing is applied — lifecycle hooks (`onActivate`, `onDeactivate`) and tool `execute` functions run with full process privileges. If third-party kits are needed in the future, implement capability restrictions and sandboxing before allowing untrusted code to register as a kit.

---

## Built-in Kits

### GitHub Kit

**File:** `packages/core/src/kits/github-kit.ts`

| | Details |
|---|---|
| **Tools** | `github_repo_info`, `github_repo_tree`, `github_repo_file_read` |
| **Connectors** | `GitHubConnector` (OAuth Device Flow + PAT auth) |
| **Components** | `AuthCard` (GitHub sign-in), `githubRepoPicker` (repo search and selection) |
| **Auth** | `github-oauth` with scopes `repo`, `read:user` |
| **Phase prompts** | Discover (repo analysis protocol), Design (CI/CD extension), Generate (deploy.yml with OIDC), Handoff (push + secrets setup), Deploy (Actions monitoring) |

### Azure Kit

**File:** `packages/core/src/kits/azure-kit.ts`

| | Details |
|---|---|
| **Tools** | `azure_resource_list`, `azure_resource_get`, `estimate_cost` |
| **Connectors** | `AzureARMConnector` (Azure Resource Manager), `PricingConnector` (no auth) |
| **Components** | `AuthCard` (Azure MSAL), `azureResourcePicker`, `azureResourceForm`, `azureAction` |
| **Auth** | `azure-msal` with scope `https://management.azure.com/.default` |
| **Skills** | `iac-bicep-modules` (Bicep conventions), `iac-secure-decorators` (@secure() usage), and more |

---

## How to Create an Integration Kit

### Step 1 — Plan your kit surface

Decide what your kit provides:

- **Tools** — what LLM-callable functions does your integration need? (see [LLM Tools](./llm-tools.md))
- **Connectors** — does it call an external API that needs authentication?
- **Prompts** — should the AI behave differently during certain phases when your kit is active?
- **Components** — does it register A2UI component types for the frontend?

### Step 2 — Implement the tools

Create tool files in `packages/core/src/tools/` following the `Tool<TArgs>` interface. See [LLM Tools](./llm-tools.md) for the complete walkthrough.

```typescript
// packages/core/src/tools/my-service-query.ts
import type { Tool, ToolContext } from "./types.js";

interface MyServiceQueryArgs {
  query: string;
}

export const myServiceQuery: Tool<MyServiceQueryArgs> = {
  name: "my_service_query",
  description: "Query the My Service API for relevant resources.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
    },
    required: ["query"],
  },
  async execute(args, context) {
    // Implementation
    return { results: [] };
  },
};
```

### Step 3 — Implement the connector (if needed)

Create a connector implementing the `APIConnector` interface from `packages/core/src/connectors/types.ts`:

```typescript
import type { APIConnector, HttpMethod, APIConnectorRequestOptions } from "./types.js";

export class MyServiceConnector implements APIConnector {
  readonly name = "my-service";
  readonly baseUrl = "https://api.myservice.com/v1";

  async authenticate(): Promise<void> {
    // Acquire or refresh tokens
  }

  isAuthenticated(): boolean {
    return false;
  }

  async request(
    method: HttpMethod,
    path: string,
    body?: unknown,
    options?: APIConnectorRequestOptions,
  ): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { ...options?.headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });
  }
}
```

### Step 4 — Define the kit

Create your kit file in `packages/core/src/kits/`:

```typescript
// packages/core/src/kits/my-service-kit.ts
import type { IntegrationKit } from "./types.js";
import { Phase } from "../engine/types.js";
import { myServiceQuery } from "../tools/my-service-query.js";
import { MyServiceConnector } from "../connectors/MyServiceConnector.js";

export const myServiceKit: IntegrationKit = {
  name: "my-service",
  description: "My Service integration — query resources and manage deployments.",

  tools: [myServiceQuery],
  connectors: [new MyServiceConnector()],

  phasePrompts: {
    [Phase.Discover]: [
      "When the user mentions My Service, call my_service_query to discover " +
      "their existing resources before making recommendations.",
    ],
  },

  components: [
    {
      type: "myServicePicker",
      description: "Resource picker for My Service resources.",
    },
  ],

  auth: [
    {
      provider: "my-service-oauth",
      scopes: ["read", "write"],
      optional: false,
    },
  ],

  // If this kit depends on the GitHub kit being registered first:
  // dependencies: ["github"],

  async onActivate() {
    // Runs after registration — initialize caches, warm connections, etc.
  },

  async onDeactivate() {
    // Runs before removal — clean up resources
  },
};
```

### Step 5 — Register at app startup

Import and register your kit where the app bootstraps. Register dependencies first:

```typescript
import { registerKit } from "@kickstart/core";
import { myServiceKit } from "@kickstart/core/kits/my-service-kit";

// After existing kits are registered
await registerKit(myServiceKit);
```

### Step 6 — Write tests

Add test cases to `packages/core/src/__tests__/integration-kit.test.ts` (or create a new test file):

```typescript
import { IntegrationKitRegistry } from "../kits/registry.js";
import { ToolRegistry } from "../tools/registry.js";
import { APIConnectorRegistry } from "../connectors/registry.js";
import { myServiceKit } from "../kits/my-service-kit.js";

describe("myServiceKit", () => {
  it("registers without errors", async () => {
    const toolReg = new ToolRegistry();
    const connReg = new APIConnectorRegistry();
    const kitReg = new IntegrationKitRegistry(toolReg, connReg);

    await kitReg.register(myServiceKit);

    expect(kitReg.has("my-service")).toBe(true);
    expect(toolReg.get("my_service_query")).toBeDefined();
    expect(connReg.get("my-service")).toBeDefined();
  });

  it("rejects self-dependency", async () => {
    const badKit = { ...myServiceKit, dependencies: ["my-service"] };
    const kitReg = new IntegrationKitRegistry();
    await expect(kitReg.register(badKit)).rejects.toThrow("dependency on itself");
  });
});
```

### Step 7 — Build and verify

```bash
npm run build -w @kickstart/core
npm run test -w @kickstart/core
```

---

## Key Files

| File | Purpose |
|---|---|
| `packages/core/src/kits/types.ts` | `IntegrationKit`, `ComponentRegistration`, `KitAuthRequirement` interfaces |
| `packages/core/src/kits/registry.ts` | `IntegrationKitRegistry` class, `defaultKitRegistry` singleton, `registerKit()` |
| `packages/core/src/kits/github-kit.ts` | GitHub integration kit (tools, connectors, phase prompts) |
| `packages/core/src/kits/azure-kit.ts` | Azure integration kit (tools, connectors, skills, components) |
| `packages/core/src/connectors/types.ts` | `APIConnector` interface and auth strategy types |
| `packages/core/src/tools/types.ts` | `Tool<TArgs>` interface (see [LLM Tools](./llm-tools.md)) |
| `packages/core/src/engine/skill-resolver.ts` | Prompt resolution middleware chain |
| `packages/core/src/__tests__/integration-kit.test.ts` | Kit registration, dependency, and lifecycle tests |
