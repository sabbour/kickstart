# IntegrationKit (ServicePack) Architecture

> **Issue:** [#30 — feat: Create ServicePack abstraction](https://github.com/sabbour/kickstart/issues/30)
> **Status:** Design — ready for implementation
> **Author:** Leela (Lead)
> **Date:** 2025-07-27

## 1. Overview

An **IntegrationKit** (originally called "ServicePack" in the backlog) is a composable plugin that bundles everything needed to integrate an external service into Kickstart:

| What it bundles | Example (Azure Kit) |
|-----------------|---------------------|
| API Connectors | `AzureARMConnector`, `PricingConnector` |
| LLM Tools | `azure_resource_list`, `azure_resource_get`, `estimate_cost` |
| System Prompts | AKS Automatic guidance, KAITO/RAGEngine knowledge |
| UI Components | `azureLoginCard`, `azureResourcePicker` |

The naming decision (see `decisions.md`) chose **IntegrationKit** over "ServicePack" because "Integration" signals what it does and "Kit" conveys a ready-to-plug-in bundle.

### Design Principles

1. **Single registration call** — `registerKit(azureKit)` wires tools, connectors, prompts, and component metadata in one shot.
2. **Core is surface-agnostic** — `packages/core` holds the kit definition and registry. UI component *bindings* live in `packages/web`.
3. **Kits are declarative** — A kit is a plain object (`IntegrationKit`), not a class with lifecycle hooks. Activation logic lives in the registry.
4. **Connectors are independent** — The `APIConnector` pattern (B-11, PR #96) handles auth/CORS/retry separately. Kits reference connectors; they don't own auth.

---

## 2. Current State (What Exists)

The core IntegrationKit system is already implemented in `packages/core/src/kits/`:

```
packages/core/src/kits/
  types.ts          — IntegrationKit interface, ComponentRegistration
  registry.ts       — IntegrationKitRegistry, registerKit(), defaultKitRegistry
  azure-kit.ts      — Azure kit (3 tools, 2 connectors, per-phase prompts, 2 components)
  github-kit.ts     — GitHub kit (1 tool, 1 connector, per-phase prompts, 2 components)
  index.ts          — Public API barrel
```

**What's working:**
- ✅ `IntegrationKit` interface (tools, connectors, prompts, phasePrompts, components)
- ✅ `IntegrationKitRegistry` with auto-wiring (tools → `ToolRegistry`, connectors → `APIConnectorRegistry`)
- ✅ `azureKit` and `githubKit` as concrete examples
- ✅ `resolveSkills()` middleware injects kit prompts into system prompt per phase
- ✅ `APIConnector` pattern with `BaseConnector`, auth strategies, CORS proxy, retry

**What's missing (the gaps this design addresses):**
- ❌ **Lifecycle management** — No install/configure/activate/deactivate phases
- ❌ **Kit dependencies** — No way to declare that one kit depends on another
- ❌ **UI component catalog integration** — Components are descriptors only; `kickstart-catalog.ts` is a flat hardcoded list
- ❌ **Kit-level auth configuration** — Kits bundle connectors but don't declare their auth requirements
- ❌ **Dynamic activation** — Can't enable/disable kits at runtime
- ❌ **Validation** — No checks for duplicate tool/connector names across kits

---

## 3. IntegrationKit Interface (Extended)

### 3.1 Core Type (packages/core)

```typescript
// packages/core/src/kits/types.ts

import type { Tool } from '../tools/types.js';
import type { APIConnector, AuthStrategy } from '../connectors/types.js';
import type { Phase } from '../engine/types.js';

/**
 * Descriptor for a UI component contributed by a kit.
 * Core records the type and description; the web layer binds the
 * actual React component via createReactComponent().
 */
export interface ComponentRegistration {
  /** A2UI component type identifier, e.g. 'azureLoginCard' */
  type: string;
  /** Human-readable description of what this component renders */
  description: string;
}

/**
 * Auth requirements this kit needs to function.
 * The host app reads these to know which auth providers to wire up.
 */
export interface KitAuthRequirement {
  /** Which connector name requires auth (e.g. 'azure-arm') */
  connectorName: string;
  /** What auth strategy the connector expects */
  strategy: AuthStrategy;
  /** Human-readable label for UI (e.g. "Sign in to Azure") */
  label: string;
  /** Whether the kit can function without this auth (degraded mode) */
  optional?: boolean;
}

/**
 * An IntegrationKit bundles everything needed to add a service
 * integration to Kickstart.
 */
export interface IntegrationKit {
  /** Unique kit identifier, e.g. 'azure', 'github' */
  readonly name: string;
  /** Human-readable summary */
  readonly description: string;

  // ── Capabilities ────────────────────────────────────────────────
  /** Tools this kit contributes to the LLM tool registry */
  readonly tools: Tool<any>[];
  /** Authenticated API connectors this kit contributes */
  readonly connectors: APIConnector[];
  /** A2UI component registrations (frontend renders, core records) */
  readonly components?: ComponentRegistration[];

  // ── Prompts ─────────────────────────────────────────────────────
  /** Flat system-prompt augmentations (all phases, keyword-filtered) */
  readonly prompts?: string[];
  /** Explicit per-phase system-prompt augmentations (priority over flat) */
  readonly phasePrompts?: Partial<Record<Phase, string[]>>;

  // ── NEW: Auth requirements ──────────────────────────────────────
  /** Auth requirements for this kit's connectors */
  readonly auth?: KitAuthRequirement[];

  // ── NEW: Dependencies ───────────────────────────────────────────
  /** Names of other kits this kit depends on */
  readonly dependencies?: string[];

  // ── NEW: Lifecycle hooks (optional) ─────────────────────────────
  /**
   * Called after the kit's tools and connectors are registered.
   * Use for one-time setup (e.g., warm a cache, validate config).
   */
  readonly onActivate?: (context: KitActivationContext) => Promise<void>;
  /**
   * Called when the kit is unregistered (if dynamic kits are supported).
   * Use for cleanup (e.g., revoke tokens, close connections).
   */
  readonly onDeactivate?: () => Promise<void>;
}

/**
 * Context passed to a kit's onActivate hook.
 * Provides access to registries so the kit can do post-registration setup.
 */
export interface KitActivationContext {
  /** Look up another kit (e.g., to read its connector) */
  getKit(name: string): IntegrationKit | undefined;
  /** Look up a connector by name */
  getConnector(name: string): APIConnector | undefined;
}
```

### 3.2 Changes from Current Interface

| Field | Status | Notes |
|-------|--------|-------|
| `name`, `description` | Unchanged | |
| `tools`, `connectors` | Unchanged | |
| `prompts`, `phasePrompts` | Unchanged | |
| `components` | Unchanged | |
| `auth` | **New** | Declares what auth each connector needs |
| `dependencies` | **New** | Kit-to-kit dependency declaration |
| `onActivate` | **New** | Post-registration lifecycle hook |
| `onDeactivate` | **New** | Cleanup lifecycle hook |

All new fields are **optional** — existing `azureKit` and `githubKit` continue to work unchanged.

---

## 4. Registration & Lifecycle

### 4.1 Enhanced IntegrationKitRegistry

```typescript
// packages/core/src/kits/registry.ts (enhanced)

export class IntegrationKitRegistry {
  private readonly kits = new Map<string, IntegrationKit>();
  private readonly activatedKits = new Set<string>();
  private readonly toolRegistry: ToolRegistry;
  private readonly connectorRegistry: APIConnectorRegistry;

  /**
   * Register a kit:
   * 1. Validate dependencies are already registered
   * 2. Check for tool/connector name collisions
   * 3. Register tools into ToolRegistry
   * 4. Register connectors into APIConnectorRegistry
   * 5. Call onActivate() if provided
   */
  async register(kit: IntegrationKit): Promise<void> {
    // Step 1: Dependency check
    this.validateDependencies(kit);

    // Step 2: Collision detection
    this.validateNoCollisions(kit);

    // Step 3-4: Wire tools and connectors
    this.kits.set(kit.name, kit);
    this.toolRegistry.registerAll(kit.tools);
    for (const connector of kit.connectors) {
      this.connectorRegistry.register(connector);
    }

    // Step 5: Lifecycle hook
    if (kit.onActivate) {
      await kit.onActivate({
        getKit: (name) => this.kits.get(name),
        getConnector: (name) => this.connectorRegistry.get(name),
      });
    }
    this.activatedKits.add(kit.name);
  }

  /**
   * Unregister a kit (for dynamic kit management):
   * 1. Check no other kit depends on this one
   * 2. Call onDeactivate() if provided
   * 3. Remove tools and connectors
   */
  async unregister(name: string): Promise<void> { /* ... */ }

  /** Throws if any declared dependency is not yet registered. */
  private validateDependencies(kit: IntegrationKit): void {
    for (const dep of kit.dependencies ?? []) {
      if (!this.kits.has(dep)) {
        throw new Error(
          `Kit "${kit.name}" depends on "${dep}" which is not registered. ` +
          `Register "${dep}" first.`
        );
      }
    }
  }

  /** Warns on tool/connector name collisions across kits. */
  private validateNoCollisions(kit: IntegrationKit): void {
    for (const tool of kit.tools) {
      const existing = this.toolRegistry.get(tool.name);
      if (existing) {
        logger.warn(
          `Kit "${kit.name}" registers tool "${tool.name}" which ` +
          `is already registered. It will be overwritten.`
        );
      }
    }
    // Same for connectors...
  }
}
```

### 4.2 Lifecycle Flow

```
┌─────────────────────────────────────────────────────┐
│                   App Bootstrap                       │
│                                                       │
│  1. Create registries (ToolRegistry, ConnectorRegistry│
│     IntegrationKitRegistry)                           │
│                                                       │
│  2. Register kits in dependency order:                │
│       registerKit(githubKit)   // no dependencies     │
│       registerKit(azureKit)    // no dependencies     │
│       registerKit(myCustomKit) // depends: ['azure']  │
│                                                       │
│  3. For each kit:                                     │
│     ┌──────────────────────┐                          │
│     │ validateDependencies │──→ Error if missing dep  │
│     └──────────┬───────────┘                          │
│     ┌──────────▼───────────┐                          │
│     │ validateNoCollisions │──→ Warn on duplicates    │
│     └──────────┬───────────┘                          │
│     ┌──────────▼───────────┐                          │
│     │ Register tools       │──→ ToolRegistry          │
│     │ Register connectors  │──→ ConnectorRegistry     │
│     │ Record metadata      │──→ IntegrationKitRegistry│
│     └──────────┬───────────┘                          │
│     ┌──────────▼───────────┐                          │
│     │ onActivate()         │──→ Optional setup hook   │
│     └──────────────────────┘                          │
│                                                       │
│  4. Wire auth providers into connectors               │
│     (web layer injects MSAL/OAuth after kit           │
│      registration — connectors are auth-agnostic)     │
│                                                       │
│  5. App is ready — kits' tools, connectors, and       │
│     prompts are live                                  │
└─────────────────────────────────────────────────────┘
```

### 4.3 Registration Order

Kits MUST be registered in dependency order. The registry enforces this:
- If Kit B depends on Kit A, Kit A must be registered first.
- The registry does NOT do topological sorting — that's the caller's responsibility. This keeps the registry simple and predictable.
- Circular dependencies are caught at registration time (A depends on B, B depends on A → B fails because A isn't registered when B tries).

---

## 5. UI Component Catalog Integration

### 5.1 The Problem

Today, `kickstart-catalog.ts` is a hardcoded flat list:

```typescript
// packages/web/src/catalog/kickstart-catalog.ts (current)
const kickstartComponents = [
  ...basicCatalog.components,
  ...fluentOverrides,
  RadioGroup, FormGroup, CodeBlock,   // core Kickstart
  GitHubLoginCard, GitHubRepoPicker,  // GitHub kit
  AzureLoginCard, AzureResourcePicker, AzureResourceForm,  // Azure kit
  // ... etc
];
export const kickstartCatalog = new Catalog('kickstart', kickstartComponents, ...);
```

Adding a new kit means manually editing this file. Not composable.

### 5.2 Kit-Driven Component Registration

Each kit in `packages/web` exports its React component bindings. The catalog is assembled dynamically from registered kits.

```typescript
// packages/web/src/kits/azure/components.ts
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';
import { AzureLoginCard } from '../../catalog/components/AzureLoginCard';
import { AzureResourcePicker } from '../../catalog/components/AzureResourcePicker';
import { AzureResourceForm } from '../../catalog/components/AzureResourceForm';

export const azureComponents: ReactComponentImplementation[] = [
  AzureLoginCard,
  AzureResourcePicker,
  AzureResourceForm,
];
```

```typescript
// packages/web/src/catalog/kickstart-catalog.ts (proposed)
import { Catalog } from '../vendor/a2ui/web_core/index';
import { basicCatalog } from '../vendor/a2ui/react/index';
import { fluentOverrides } from './fluent-components';
import { coreComponents } from './core-components';  // RadioGroup, FormGroup, etc.
import { defaultKitRegistry } from '@kickstart/core';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';

// Component registry: maps kit name → React component bindings
const kitComponentBindings = new Map<string, ReactComponentImplementation[]>();

/**
 * Register React component bindings for a kit.
 * Called by the web layer after the core kit is registered.
 */
export function registerKitComponents(
  kitName: string,
  components: ReactComponentImplementation[],
): void {
  kitComponentBindings.set(kitName, components);
}

/**
 * Build the final A2UI Catalog from core + all registered kit components.
 */
export function buildCatalog(): Catalog<ReactComponentImplementation> {
  const allComponents: ReactComponentImplementation[] = [
    ...Array.from(basicCatalog.components.values()),
    ...fluentOverrides,
    ...coreComponents,
  ];

  // Append components from each registered kit
  for (const kit of defaultKitRegistry.getAll()) {
    const bindings = kitComponentBindings.get(kit.name);
    if (bindings) {
      allComponents.push(...bindings);
    }
  }

  return new Catalog('kickstart', allComponents,
    Array.from(basicCatalog.functions.values()));
}
```

### 5.3 Web-Layer Kit Bootstrap

```typescript
// packages/web/src/kits/bootstrap.ts
import { registerKit } from '@kickstart/core';
import { azureKit } from '@kickstart/core/kits/azure-kit';
import { githubKit } from '@kickstart/core/kits/github-kit';
import { registerKitComponents, buildCatalog } from '../catalog/kickstart-catalog';
import { azureComponents } from './azure/components';
import { githubComponents } from './github/components';

export async function bootstrapKits() {
  // 1. Register core kits (wires tools + connectors)
  await registerKit(githubKit);
  await registerKit(azureKit);

  // 2. Register web-layer component bindings
  registerKitComponents('azure', azureComponents);
  registerKitComponents('github', githubComponents);

  // 3. Build the unified A2UI catalog
  return buildCatalog();
}
```

---

## 6. Auth Requirement Declaration

### 6.1 How it Works

Kits declare what auth they need. The host app reads these requirements to:
- Show login cards at the right time
- Wire auth providers into connectors
- Know which kits work without auth (degraded/stub mode)

```typescript
// In azureKit definition:
export const azureKit: IntegrationKit = {
  name: 'azure',
  // ... tools, connectors, prompts ...

  auth: [
    {
      connectorName: 'azure-arm',
      strategy: {
        kind: 'oauth2',
        scopes: ['https://management.azure.com/.default'],
        tenantId: 'common',
      },
      label: 'Sign in to Azure',
      optional: false,
    },
    {
      connectorName: 'pricing',
      strategy: { kind: 'none' },
      label: 'Azure Pricing (no auth needed)',
      optional: true,  // pricing works without auth
    },
  ],
};
```

### 6.2 Host App Wiring

```typescript
// packages/web/src/auth/kit-auth-wiring.ts
import { defaultKitRegistry, defaultConnectorRegistry } from '@kickstart/core';
import type { KitAuthRequirement } from '@kickstart/core/kits/types';

/**
 * Read all kit auth requirements and wire providers.
 * Called after kit registration, before the app renders.
 */
export function wireKitAuth(msalProvider: OAuth2AuthProvider): void {
  for (const kit of defaultKitRegistry.getAll()) {
    for (const req of kit.auth ?? []) {
      if (req.strategy.kind === 'none') continue;

      const connector = defaultConnectorRegistry.getConfigurable(req.connectorName);
      if (!connector) continue;

      if (req.strategy.kind === 'oauth2') {
        connector.setAuthProvider(msalProvider);
      }
      // Handle other strategy kinds as needed
    }
  }
}
```

---

## 7. Kit Dependencies

### 7.1 Declaring Dependencies

```typescript
// Example: A hypothetical "azure-ai" kit that depends on the base azure kit
export const azureAIKit: IntegrationKit = {
  name: 'azure-ai',
  description: 'AI/ML workloads on AKS — KAITO, RAGEngine, fine-tuning',
  dependencies: ['azure'],  // requires azure kit for ARM connector

  tools: [kaitoDeployTool, ragEngineTool],
  connectors: [],  // reuses azure-arm connector from the azure kit

  onActivate: async (ctx) => {
    // Verify the azure-arm connector is available
    const arm = ctx.getConnector('azure-arm');
    if (!arm) {
      throw new Error('azure-ai kit requires azure-arm connector');
    }
  },

  // ... prompts, components
};
```

### 7.2 Dependency Rules

1. **Dependencies must be registered first.** The registry throws if a dependency is missing.
2. **No circular dependencies.** Enforced by registration order.
3. **Shared connectors.** A dependent kit can reuse connectors from its dependencies without re-declaring them. Use `ctx.getConnector()` in `onActivate`.
4. **Unregister is reverse-order.** If Kit B depends on Kit A, unregistering Kit A fails if Kit B is still active.

---

## 8. Example Kits

### 8.1 Azure Kit (existing, with proposed extensions)

```typescript
export const azureKit: IntegrationKit = {
  name: 'azure',
  description: 'Azure integration — ARM, cost estimation, AKS deployment',

  tools: [azureResourceList, azureResourceGet, estimateCost],

  connectors: [new AzureARMConnector(), new PricingConnector()],

  auth: [
    {
      connectorName: 'azure-arm',
      strategy: { kind: 'oauth2', scopes: ['https://management.azure.com/.default'] },
      label: 'Sign in to Azure',
    },
    {
      connectorName: 'pricing',
      strategy: { kind: 'none' },
      label: 'Azure Pricing',
      optional: true,
    },
  ],

  prompts: [/* ... AKS Automatic, KAITO, RAGEngine knowledge ... */],
  phasePrompts: {/* ... per-phase guidance ... */},

  components: [
    { type: 'azureLoginCard', description: 'MSAL sign-in card' },
    { type: 'azureResourcePicker', description: 'ARM resource selector' },
    { type: 'azureResourceForm', description: 'Resource configuration form' },
  ],
};
```

**Web-layer bindings:**
```
packages/web/src/kits/azure/
  components.ts          — React component exports [AzureLoginCard, ...]
```

### 8.2 GitHub Kit (existing, with proposed extensions)

```typescript
export const githubKit: IntegrationKit = {
  name: 'github',
  description: 'GitHub integration — repo inspection, CI, source-to-AKS wiring',

  tools: [githubRepoInfo],

  connectors: [new GitHubConnector()],

  auth: [
    {
      connectorName: 'github',
      strategy: { kind: 'oauth2', scopes: ['repo', 'read:user'] },
      label: 'Sign in to GitHub',
    },
  ],

  prompts: [/* ... repository-first, CI/CD, OIDC knowledge ... */],
  phasePrompts: {/* ... per-phase guidance ... */},

  components: [
    { type: 'githubLoginCard', description: 'OAuth Device Flow sign-in' },
    { type: 'githubRepoPicker', description: 'Repository picker with search' },
    { type: 'githubAction', description: 'GitHub Actions workflow card' },
    { type: 'githubCommit', description: 'Commit creation with diff preview' },
  ],
};
```

**Web-layer bindings:**
```
packages/web/src/kits/github/
  components.ts          — React component exports [GitHubLoginCard, ...]
```

---

## 9. Connection to ServiceConnector Pattern (PR #96)

The `APIConnector` pattern (connectors package) and `IntegrationKit` are complementary layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    IntegrationKit                            │
│  (bundles tools + connectors + prompts + components)        │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Tools   │  │Connectors│  │ Prompts  │  │ Components │  │
│  │          │  │          │  │          │  │            │  │
│  │ execute()│  │ request()│  │ strings  │  │ type+desc  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
└───────┼──────────────┼─────────────┼──────────────┼─────────┘
        │              │             │              │
        ▼              ▼             ▼              ▼
  ToolRegistry   ConnectorRegistry  SkillResolver   A2UI Catalog
  (LLM calls)   (auth + HTTP)      (system prompt)  (React render)
```

**Key relationships:**
- **Tools use connectors.** `azure_resource_list` calls `connectorRegistry.get('azure-arm').request(...)`.
- **Components use connectors.** `AzureResourcePicker` uses `useConnector('azure-arm')` React hook to fetch data at render time.
- **Connectors are auth-agnostic.** They define *what* auth they need (`AuthStrategy`), but the *how* (MSAL, PAT, Device Flow) is injected by the web layer via `setAuthProvider()`.
- **Kits declare auth requirements.** The new `auth` field tells the host app which connectors need what auth, so it can wire providers without inspecting connector internals.

---

## 10. File Structure (Proposed)

```
packages/core/src/kits/
  types.ts              — IntegrationKit, KitAuthRequirement, KitActivationContext
  registry.ts           — IntegrationKitRegistry (enhanced with lifecycle + deps)
  azure-kit.ts          — Azure kit definition
  github-kit.ts         — GitHub kit definition
  index.ts              — Public API

packages/web/src/kits/
  bootstrap.ts          — Kit registration + component wiring
  azure/
    components.ts       — Azure React component bindings
  github/
    components.ts       — GitHub React component bindings

packages/web/src/catalog/
  kickstart-catalog.ts  — Dynamic catalog builder (replaces hardcoded list)
  core-components.ts    — Non-kit components (RadioGroup, FormGroup, etc.)
```

---

## 11. Implementation Breakdown

| Task | Package | Effort | Implementer | Notes |
|------|---------|--------|-------------|-------|
| Add `auth`, `dependencies`, lifecycle hooks to `IntegrationKit` type | core | 0.5d | Bender | Backward-compatible additions |
| Add dependency validation + collision detection to `IntegrationKitRegistry` | core | 0.5d | Bender | `register()` becomes async |
| Add `unregister()` with reverse-dependency check | core | 0.5d | Bender | For dynamic kit management |
| Extract `core-components.ts` from `kickstart-catalog.ts` | web | 0.25d | Fry | Separate core vs kit components |
| Create `registerKitComponents()` + `buildCatalog()` | web | 0.5d | Fry | Dynamic catalog assembly |
| Create `packages/web/src/kits/` structure | web | 0.5d | Fry | Per-kit component binding modules |
| Create `bootstrap.ts` for kit initialization | web | 0.25d | Fry | Wire everything at startup |
| Add `auth` field to `azureKit` and `githubKit` | core | 0.25d | Bender | Declare auth requirements |
| Create `wireKitAuth()` utility | web | 0.5d | Bender | Read auth reqs → wire providers |
| Unit tests for enhanced registry (deps, collisions, lifecycle) | core | 1d | Hermes | Cover all error paths |
| Integration test: register 2 kits, build catalog, verify tools | web | 0.5d | Hermes | End-to-end kit bootstrap |

**Total estimate: ~5 days** across Bender (core), Fry (web), Hermes (tests).

---

## 12. Migration Path

The design is **fully backward-compatible**:

1. **Phase 1 (this PR):** Add new optional fields to `IntegrationKit`. Existing kits work unchanged.
2. **Phase 2:** Enhance `IntegrationKitRegistry` with async `register()`, dependency validation, and collision detection. The synchronous `registerKit()` convenience function becomes async.
3. **Phase 3:** Refactor `kickstart-catalog.ts` to use dynamic `buildCatalog()`. Move kit components into `packages/web/src/kits/`.
4. **Phase 4:** Add `auth` declarations to existing kits and create `wireKitAuth()` utility.

Each phase can be merged independently.

---

## 13. Open Questions

1. **Should kits support feature flags?** E.g., enable KAITO prompts only when the user has GPU-capable subscriptions. *Deferred — can be added via `onActivate` logic.*
2. **Should the MCP server surface know about kits?** Currently MCP tools are registered separately. *Deferred to B-31 (custom packs docs).*
3. **Should `register()` return a disposable for cleanup?** Useful for testing. *Nice-to-have — `unregister()` covers the core use case.*
