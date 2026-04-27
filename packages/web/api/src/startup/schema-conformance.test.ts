/**
 * @file schema-conformance.test.ts
 * @suite Universal OpenAI strict-mode schema conformance — every pack
 *
 * Runs the four shared schema-conformance walkers against EVERY tool and
 * EVERY user action discovered through the real registry/startup path
 * (`getRegistry()` from `./packs.ts`). Replaces the per-pack hand-rostered
 * test suites that pre-#1005 only covered pack-core.
 *
 * Why this lives here (web/api/src/startup):
 *   This is the same code-path Azure Functions uses to register packs at
 *   cold start. Loading packs through `getRegistry()` — rather than
 *   importing each pack's `Pack` manifest into the test directly —
 *   guarantees the test set is fed by the same dependency-ordered, sealed
 *   registry the running service exposes to the model. New packs / new
 *   tools are picked up automatically with no test-roster edit.
 *
 * Helpers (`reportSchemaConformance`, `formatReport`, `getToolJsonSchema`,
 * `getUserActionJsonSchema`) live in
 * `@aks-kickstart/harness/runtime/schema-conformance` so they are also
 * usable by per-pack regression tests targeting specific schema shapes.
 */

import { describe, it, expect } from 'vitest';
import {
  reportSchemaConformance,
  reportHasIssues,
  formatReport,
  getToolJsonSchema,
  getUserActionJsonSchema,
} from '@aks-kickstart/harness/runtime/schema-conformance';
import { _resetRegistryState, getRegistry } from './packs.js';

// ─────────────────────────────────────────────────────────────────────────────
// Hermetic credential isolation
// ─────────────────────────────────────────────────────────────────────────────
//
// `getRegistry()` runs `getCredentialConfig()` first, which inspects ambient
// environment variables and may throw (e.g. an invalid `AZURE_OPENAI_ENDPOINT`
// from a developer's `.env`). Schema conformance is independent of the LLM
// provider, so we wipe all relevant credential env vars, swap in a single
// placeholder `OPENAI_API_KEY` to satisfy the validator, build the registry,
// and then restore the original environment. The constructed registry is held
// in module scope because `it.each(...)` needs its arrays at collection time.
const REGISTRY_CREDENTIAL_ENV_PATTERNS = [
  /^OPENAI_API_KEY$/,
  /^AZURE_OPENAI_/,
  /^KICKSTART_.*_MODEL$/,
  /^AZURE_CLIENT_ID$/,
  /^AZURE_TENANT_ID$/,
  /^AZURE_CLIENT_SECRET$/,
];

function isRegistryCredentialEnvVar(name: string): boolean {
  return REGISTRY_CREDENTIAL_ENV_PATTERNS.some((pattern) => pattern.test(name));
}

function buildRegistryWithHermeticCredentialEnv(): ReturnType<typeof getRegistry> {
  const originalEnv = new Map<string, string | undefined>();

  for (const name of Object.keys(process.env)) {
    if (!isRegistryCredentialEnvVar(name)) continue;
    originalEnv.set(name, process.env[name]);
    delete process.env[name];
  }
  if (!originalEnv.has('OPENAI_API_KEY')) {
    originalEnv.set('OPENAI_API_KEY', undefined);
  }

  process.env.OPENAI_API_KEY = 'test-key-for-schema-conformance';

  try {
    _resetRegistryState();
    return getRegistry();
  } finally {
    for (const [name, value] of originalEnv.entries()) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

const registry = buildRegistryWithHermeticCredentialEnv();

const tools = registry.tools.map((tool) => ({ name: tool.name, contrib: tool }));
const userActions = registry.userActions.map((action) => ({
  name: action.name,
  contrib: action,
}));

describe('OpenAI strict-mode schema conformance — every registered tool', () => {
  it('discovers tools dynamically through the registry (no hand-maintained roster)', () => {
    expect(tools.length).toBeGreaterThan(0);
  });

  // Use it.each so every tool surfaces in test output by name and a
  // single failure does not mask others.
  it.each(tools)('$name passes all four strict-mode invariants', ({ name, contrib }) => {
    const schema = getToolJsonSchema(contrib);
    // Non-function tools (e.g. handoff tools) are exempt — they have no
    // JSON-schema parameters object.
    if (schema === null) return;

    const report = reportSchemaConformance(name, schema);
    expect(reportHasIssues(report) ? formatReport(report) : null).toBeNull();
  });
});

describe('OpenAI strict-mode schema conformance — every registered user action', () => {
  it('discovers user actions dynamically through the registry (no hand-maintained roster)', () => {
    expect(userActions.length).toBeGreaterThan(0);
  });

  it.each(userActions)('$name passes all four strict-mode invariants', ({ name, contrib }) => {
    const schema = getUserActionJsonSchema(contrib);
    const report = reportSchemaConformance(name, schema);
    expect(reportHasIssues(report) ? formatReport(report) : null).toBeNull();
  });
});
