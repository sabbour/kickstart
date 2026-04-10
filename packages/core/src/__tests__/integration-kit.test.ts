/**
 * B-10 — IntegrationKit abstraction
 *
 * Contract tests for:
 *   • IntegrationKit interface shape
 *   • IntegrationKitRegistry (register, lookup, auto-wiring of tools + connectors)
 *   • registerKit convenience function (delegates to defaultKitRegistry)
 *   • AzureKit built-in kit (correct tools, connectors, prompts, components)
 *   • GitHubKit built-in kit (correct tools, connectors, prompts, components)
 *   • Double-registration idempotency
 */

import { describe, it, expect } from 'vitest';
import { IntegrationKitRegistry, registerKit, defaultKitRegistry } from '../kits/registry.js';
import { azureKit } from '../kits/azure-kit.js';
import { githubKit } from '../kits/github-kit.js';
import type { IntegrationKit } from '../kits/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { APIConnectorRegistry } from '../connectors/registry.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeIsolatedRegistry(): {
  kitRegistry: IntegrationKitRegistry;
  toolRegistry: ToolRegistry;
  connectorRegistry: APIConnectorRegistry;
} {
  const toolRegistry = new ToolRegistry();
  const connectorRegistry = new APIConnectorRegistry();
  const kitRegistry = new IntegrationKitRegistry(toolRegistry, connectorRegistry);
  return { kitRegistry, toolRegistry, connectorRegistry };
}

/** Minimal stub kit for generic registry tests. */
function makeKit(name: string, overrides: Partial<IntegrationKit> = {}): IntegrationKit {
  return {
    name,
    description: `${name} test kit`,
    tools: [],
    connectors: [],
    ...overrides,
  };
}

// ── IntegrationKitRegistry ───────────────────────────────────────────────────

describe('IntegrationKitRegistry', () => {
  it('starts empty', () => {
    const { kitRegistry } = makeIsolatedRegistry();
    expect(kitRegistry.size).toBe(0);
    expect(kitRegistry.getAll()).toEqual([]);
    expect(kitRegistry.names()).toEqual([]);
  });

  it('registers a kit and makes it retrievable by name', () => {
    const { kitRegistry } = makeIsolatedRegistry();
    const kit = makeKit('test-kit');
    kitRegistry.register(kit);

    expect(kitRegistry.has('test-kit')).toBe(true);
    expect(kitRegistry.get('test-kit')).toBe(kit);
    expect(kitRegistry.size).toBe(1);
  });

  it('returns undefined for unknown kit', () => {
    const { kitRegistry } = makeIsolatedRegistry();
    expect(kitRegistry.get('unknown')).toBeUndefined();
    expect(kitRegistry.has('unknown')).toBe(false);
  });

  it('overwrites a kit when re-registered with the same name', () => {
    const { kitRegistry } = makeIsolatedRegistry();
    const v1 = makeKit('my-kit', { description: 'v1' });
    const v2 = makeKit('my-kit', { description: 'v2' });
    kitRegistry.register(v1);
    kitRegistry.register(v2);

    expect(kitRegistry.size).toBe(1);
    expect(kitRegistry.get('my-kit')!.description).toBe('v2');
  });

  it('auto-registers kit tools into the ToolRegistry', () => {
    const { kitRegistry, toolRegistry } = makeIsolatedRegistry();
    const tool = {
      name: 'test_tool',
      description: 'A test tool',
      parameters: { type: 'object' as const, properties: {} },
      execute: async () => ({}),
    };
    kitRegistry.register(makeKit('with-tool', { tools: [tool] }));

    expect(toolRegistry.get('test_tool')).toBe(tool);
  });

  it('auto-registers kit connectors into the APIConnectorRegistry', () => {
    const { kitRegistry, connectorRegistry } = makeIsolatedRegistry();
    const connector = {
      name: 'test-connector',
      baseUrl: 'https://example.com',
      authenticate: async () => {},
      request: async () => new Response(),
      isAuthenticated: () => false,
    };
    kitRegistry.register(makeKit('with-connector', { connectors: [connector] }));

    expect(connectorRegistry.get('test-connector')).toBe(connector);
  });

  it('getAll returns all registered kits', () => {
    const { kitRegistry } = makeIsolatedRegistry();
    kitRegistry.register(makeKit('kit-a'));
    kitRegistry.register(makeKit('kit-b'));

    const names = kitRegistry.getAll().map((k) => k.name);
    expect(names).toContain('kit-a');
    expect(names).toContain('kit-b');
    expect(names).toHaveLength(2);
  });
});

// ── registerKit convenience function ────────────────────────────────────────

describe('registerKit', () => {
  it('delegates to the defaultKitRegistry', () => {
    // defaultKitRegistry is already populated by the built-in kit bootstrap
    // (main.tsx calls registerKit in production, but tests don't run main.tsx).
    // We just verify the function accepts a kit without throwing.
    const kit = makeKit('convenience-test-kit');
    expect(() => registerKit(kit)).not.toThrow();
    expect(defaultKitRegistry.has('convenience-test-kit')).toBe(true);
  });
});

// ── AzureKit ─────────────────────────────────────────────────────────────────

describe('azureKit', () => {
  it('has the correct name', () => {
    expect(azureKit.name).toBe('azure');
  });

  it('has a non-empty description', () => {
    expect(azureKit.description.length).toBeGreaterThan(0);
  });

  it('provides the expected tools', () => {
    const toolNames = azureKit.tools.map((t) => t.name);
    expect(toolNames).toContain('azure_resource_list');
    expect(toolNames).toContain('azure_resource_get');
    expect(toolNames).toContain('estimate_cost');
  });

  it('provides AzureARMConnector and PricingConnector', () => {
    const connectorNames = azureKit.connectors.map((c) => c.name);
    expect(connectorNames).toContain('azure-arm');
    expect(connectorNames).toContain('pricing');
  });

  it('provides at least one system-prompt augmentation', () => {
    expect(azureKit.prompts).toBeDefined();
    expect(azureKit.prompts!.length).toBeGreaterThan(0);
    for (const p of azureKit.prompts!) {
      expect(typeof p).toBe('string');
      expect(p.length).toBeGreaterThan(0);
    }
  });

  it('registers component types for azureLoginCard and azureResourcePicker', () => {
    expect(azureKit.components).toBeDefined();
    const types = azureKit.components!.map((c) => c.type);
    expect(types).toContain('azureLoginCard');
    expect(types).toContain('azureResourcePicker');
  });

  it('auto-wires into isolated registries on register()', () => {
    const { kitRegistry, toolRegistry, connectorRegistry } = makeIsolatedRegistry();
    kitRegistry.register(azureKit);

    expect(toolRegistry.get('azure_resource_list')).toBeDefined();
    expect(toolRegistry.get('azure_resource_get')).toBeDefined();
    expect(toolRegistry.get('estimate_cost')).toBeDefined();
    expect(connectorRegistry.get('azure-arm')).toBeDefined();
    expect(connectorRegistry.get('pricing')).toBeDefined();
  });
});

// ── GitHubKit ────────────────────────────────────────────────────────────────

describe('githubKit', () => {
  it('has the correct name', () => {
    expect(githubKit.name).toBe('github');
  });

  it('has a non-empty description', () => {
    expect(githubKit.description.length).toBeGreaterThan(0);
  });

  it('provides the github_repo_info tool', () => {
    const toolNames = githubKit.tools.map((t) => t.name);
    expect(toolNames).toContain('github_repo_info');
  });

  it('provides GitHubConnector', () => {
    const connectorNames = githubKit.connectors.map((c) => c.name);
    expect(connectorNames).toContain('github');
  });

  it('provides at least one system-prompt augmentation', () => {
    expect(githubKit.prompts).toBeDefined();
    expect(githubKit.prompts!.length).toBeGreaterThan(0);
    for (const p of githubKit.prompts!) {
      expect(typeof p).toBe('string');
      expect(p.length).toBeGreaterThan(0);
    }
  });

  it('registers component types for githubLoginCard and githubRepoPicker', () => {
    expect(githubKit.components).toBeDefined();
    const types = githubKit.components!.map((c) => c.type);
    expect(types).toContain('githubLoginCard');
    expect(types).toContain('githubRepoPicker');
  });

  it('auto-wires into isolated registries on register()', () => {
    const { kitRegistry, toolRegistry, connectorRegistry } = makeIsolatedRegistry();
    kitRegistry.register(githubKit);

    expect(toolRegistry.get('github_repo_info')).toBeDefined();
    expect(connectorRegistry.get('github')).toBeDefined();
  });
});

// ── Multi-kit registration ───────────────────────────────────────────────────

describe('multi-kit registration', () => {
  it('registers azure + github kits without conflicts', () => {
    const { kitRegistry, toolRegistry, connectorRegistry } = makeIsolatedRegistry();
    kitRegistry.register(azureKit);
    kitRegistry.register(githubKit);

    expect(kitRegistry.size).toBe(2);

    // All tools available
    expect(toolRegistry.get('azure_resource_list')).toBeDefined();
    expect(toolRegistry.get('estimate_cost')).toBeDefined();
    expect(toolRegistry.get('github_repo_info')).toBeDefined();

    // All connectors available
    expect(connectorRegistry.get('azure-arm')).toBeDefined();
    expect(connectorRegistry.get('pricing')).toBeDefined();
    expect(connectorRegistry.get('github')).toBeDefined();
  });
});
