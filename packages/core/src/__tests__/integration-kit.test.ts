/**
 * B-10 — IntegrationKit abstraction + ServicePack extensions (issue #30)
 *
 * Contract tests for:
 *   • IntegrationKit interface shape (including auth, dependencies, lifecycle)
 *   • IntegrationKitRegistry (register, lookup, auto-wiring of tools + connectors)
 *   • Dependency validation (fail-fast on missing deps)
 *   • Tool/connector collision detection across kits
 *   • Unregister with reverse-dependency check
 *   • Lifecycle hooks (onActivate / onDeactivate)
 *   • registerKit convenience function (delegates to defaultKitRegistry)
 *   • AzureKit built-in kit (correct tools, connectors, prompts, components, auth)
 *   • GitHubKit built-in kit (correct tools, connectors, prompts, components, auth)
 *   • Double-registration idempotency
 */

import { describe, it, expect, vi } from 'vitest';
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

/** Stub tool for collision tests. */
function makeTool(name: string) {
  return {
    name,
    description: `${name} test tool`,
    parameters: { type: 'object' as const, properties: {} },
    execute: async () => ({}),
  };
}

/** Stub connector for collision tests. */
function makeConnector(name: string) {
  return {
    name,
    baseUrl: 'https://example.com',
    authenticate: async () => {},
    request: async () => new Response(),
    isAuthenticated: () => false,
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

  it('registers a kit and makes it retrievable by name', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    const kit = makeKit('test-kit');
    await kitRegistry.register(kit);

    expect(kitRegistry.has('test-kit')).toBe(true);
    expect(kitRegistry.get('test-kit')).toBe(kit);
    expect(kitRegistry.size).toBe(1);
  });

  it('returns undefined for unknown kit', () => {
    const { kitRegistry } = makeIsolatedRegistry();
    expect(kitRegistry.get('unknown')).toBeUndefined();
    expect(kitRegistry.has('unknown')).toBe(false);
  });

  it('overwrites a kit when re-registered with the same name', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    const v1 = makeKit('my-kit', { description: 'v1' });
    const v2 = makeKit('my-kit', { description: 'v2' });
    await kitRegistry.register(v1);
    await kitRegistry.register(v2);

    expect(kitRegistry.size).toBe(1);
    expect(kitRegistry.get('my-kit')!.description).toBe('v2');
  });

  it('auto-registers kit tools into the ToolRegistry', async () => {
    const { kitRegistry, toolRegistry } = makeIsolatedRegistry();
    const tool = makeTool('test_tool');
    await kitRegistry.register(makeKit('with-tool', { tools: [tool] }));

    expect(toolRegistry.get('test_tool')).toBe(tool);
  });

  it('auto-registers kit connectors into the APIConnectorRegistry', async () => {
    const { kitRegistry, connectorRegistry } = makeIsolatedRegistry();
    const connector = makeConnector('test-connector');
    await kitRegistry.register(makeKit('with-connector', { connectors: [connector] }));

    expect(connectorRegistry.get('test-connector')).toBe(connector);
  });

  it('getAll returns all registered kits', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(makeKit('kit-a'));
    await kitRegistry.register(makeKit('kit-b'));

    const names = kitRegistry.getAll().map((k) => k.name);
    expect(names).toContain('kit-a');
    expect(names).toContain('kit-b');
    expect(names).toHaveLength(2);
  });
});

// ── Dependency validation ───────────────────────────────────────────────────

describe('dependency validation', () => {
  it('allows registration when all dependencies are present', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(makeKit('base-kit'));
    await kitRegistry.register(makeKit('dependent-kit', { dependencies: ['base-kit'] }));

    expect(kitRegistry.has('dependent-kit')).toBe(true);
  });

  it('throws when dependencies are missing', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    const kit = makeKit('needs-base', { dependencies: ['missing-kit'] });

    await expect(kitRegistry.register(kit)).rejects.toThrow(
      /depends on unregistered kit\(s\): missing-kit/,
    );
    expect(kitRegistry.has('needs-base')).toBe(false);
  });

  it('throws listing all missing dependencies', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    const kit = makeKit('needs-many', { dependencies: ['dep-a', 'dep-b'] });

    await expect(kitRegistry.register(kit)).rejects.toThrow(/dep-a, dep-b/);
  });

  it('allows registration with empty dependencies array', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(makeKit('no-deps', { dependencies: [] }));

    expect(kitRegistry.has('no-deps')).toBe(true);
  });
});

// ── Collision detection ─────────────────────────────────────────────────────

describe('collision detection', () => {
  it('throws when a tool name collides with another kit', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    const tool = makeTool('shared_tool');
    await kitRegistry.register(makeKit('kit-a', { tools: [tool] }));

    const dupeKit = makeKit('kit-b', { tools: [makeTool('shared_tool')] });
    await expect(kitRegistry.register(dupeKit)).rejects.toThrow(
      /tool "shared_tool" \(owned by kit "kit-a"\)/,
    );
  });

  it('throws when a connector name collides with another kit', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    const conn = makeConnector('shared-conn');
    await kitRegistry.register(makeKit('kit-a', { connectors: [conn] }));

    const dupeKit = makeKit('kit-b', { connectors: [makeConnector('shared-conn')] });
    await expect(kitRegistry.register(dupeKit)).rejects.toThrow(
      /connector "shared-conn" \(owned by kit "kit-a"\)/,
    );
  });

  it('allows re-registration of the same kit without collision error', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    const tool = makeTool('my_tool');
    const kit = makeKit('kit-a', { tools: [tool] });
    await kitRegistry.register(kit);
    await kitRegistry.register(kit); // re-register same kit

    expect(kitRegistry.size).toBe(1);
  });

  it('tracks tool ownership correctly', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(makeKit('owner-kit', { tools: [makeTool('owned_tool')] }));

    expect(kitRegistry.getToolOwner('owned_tool')).toBe('owner-kit');
    expect(kitRegistry.getToolOwner('unknown_tool')).toBeUndefined();
  });

  it('tracks connector ownership correctly', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(makeKit('owner-kit', { connectors: [makeConnector('owned-conn')] }));

    expect(kitRegistry.getConnectorOwner('owned-conn')).toBe('owner-kit');
    expect(kitRegistry.getConnectorOwner('unknown-conn')).toBeUndefined();
  });
});

// ── Unregister ──────────────────────────────────────────────────────────────

describe('unregister', () => {
  it('removes a kit from the registry', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(makeKit('removable'));
    await kitRegistry.unregister('removable');

    expect(kitRegistry.has('removable')).toBe(false);
    expect(kitRegistry.size).toBe(0);
  });

  it('throws when unregistering an unknown kit', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    await expect(kitRegistry.unregister('ghost')).rejects.toThrow(/not registered/);
  });

  it('blocks unregister when other kits depend on it', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(makeKit('base'));
    await kitRegistry.register(makeKit('dependent', { dependencies: ['base'] }));

    await expect(kitRegistry.unregister('base')).rejects.toThrow(
      /depended on by: dependent/,
    );
  });

  it('allows unregister after dependents are removed', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(makeKit('base'));
    await kitRegistry.register(makeKit('dependent', { dependencies: ['base'] }));
    await kitRegistry.unregister('dependent');
    await kitRegistry.unregister('base');

    expect(kitRegistry.size).toBe(0);
  });

  it('clears tool/connector ownership on unregister', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(makeKit('kit-x', {
      tools: [makeTool('x_tool')],
      connectors: [makeConnector('x-conn')],
    }));
    await kitRegistry.unregister('kit-x');

    expect(kitRegistry.getToolOwner('x_tool')).toBeUndefined();
    expect(kitRegistry.getConnectorOwner('x-conn')).toBeUndefined();
  });
});

// ── Lifecycle hooks ─────────────────────────────────────────────────────────

describe('lifecycle hooks', () => {
  it('calls onActivate after registration', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    const onActivate = vi.fn().mockResolvedValue(undefined);
    await kitRegistry.register(makeKit('activatable', { onActivate }));

    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('calls onDeactivate before unregistration', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    const onDeactivate = vi.fn().mockResolvedValue(undefined);
    await kitRegistry.register(makeKit('deactivatable', { onDeactivate }));
    await kitRegistry.unregister('deactivatable');

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('does not call onActivate when registration fails (missing deps)', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    const onActivate = vi.fn().mockResolvedValue(undefined);
    const kit = makeKit('bad-deps', { dependencies: ['nonexistent'], onActivate });

    await expect(kitRegistry.register(kit)).rejects.toThrow();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('does not call onActivate when registration fails (collision)', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    const onActivate = vi.fn().mockResolvedValue(undefined);
    await kitRegistry.register(makeKit('first', { tools: [makeTool('clash_tool')] }));

    const kit = makeKit('second', { tools: [makeTool('clash_tool')], onActivate });
    await expect(kitRegistry.register(kit)).rejects.toThrow();
    expect(onActivate).not.toHaveBeenCalled();
  });
});

// ── getDependents ───────────────────────────────────────────────────────────

describe('getDependents', () => {
  it('returns kits that depend on a given kit', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(makeKit('core-kit'));
    await kitRegistry.register(makeKit('ext-a', { dependencies: ['core-kit'] }));
    await kitRegistry.register(makeKit('ext-b', { dependencies: ['core-kit'] }));

    const dependents = kitRegistry.getDependents('core-kit');
    expect(dependents).toContain('ext-a');
    expect(dependents).toContain('ext-b');
    expect(dependents).toHaveLength(2);
  });

  it('returns empty array for kits with no dependents', async () => {
    const { kitRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(makeKit('standalone'));
    expect(kitRegistry.getDependents('standalone')).toEqual([]);
  });
});

// ── registerKit convenience function ────────────────────────────────────────

describe('registerKit', () => {
  it('delegates to the defaultKitRegistry', async () => {
    const kit = makeKit('convenience-test-kit');
    await expect(registerKit(kit)).resolves.toBeUndefined();
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

  it('declares azure-msal auth requirement', () => {
    expect(azureKit.auth).toBeDefined();
    expect(azureKit.auth!.length).toBeGreaterThan(0);
    const msalAuth = azureKit.auth!.find((a) => a.provider === 'azure-msal');
    expect(msalAuth).toBeDefined();
    expect(msalAuth!.scopes).toContain('https://management.azure.com/.default');
  });

  it('auto-wires into isolated registries on register()', async () => {
    const { kitRegistry, toolRegistry, connectorRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(azureKit);

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

  it('declares github-oauth auth requirement', () => {
    expect(githubKit.auth).toBeDefined();
    expect(githubKit.auth!.length).toBeGreaterThan(0);
    const githubOAuth = githubKit.auth!.find((a) => a.provider === 'github-oauth');
    expect(githubOAuth).toBeDefined();
    expect(githubOAuth!.scopes).toContain('repo');
  });

  it('auto-wires into isolated registries on register()', async () => {
    const { kitRegistry, toolRegistry, connectorRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(githubKit);

    expect(toolRegistry.get('github_repo_info')).toBeDefined();
    expect(connectorRegistry.get('github')).toBeDefined();
  });
});

// ── Multi-kit registration ───────────────────────────────────────────────────

describe('multi-kit registration', () => {
  it('registers azure + github kits without conflicts', async () => {
    const { kitRegistry, toolRegistry, connectorRegistry } = makeIsolatedRegistry();
    await kitRegistry.register(azureKit);
    await kitRegistry.register(githubKit);

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
