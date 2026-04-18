/**
 * Harness smoke tests (Step 1 seam)
 *
 * Verifies that the @kickstart/harness stub:
 *   1. exports compile and the module loads without throwing
 *   2. Phase enum matches the canonical brief order (Discover → … → Deploy)
 *   3. PHASE_DEFINITIONS flows correctly per the brief
 *   4. SETUP_GENERATION_STEP_ORDER is a non-empty, well-typed constant
 *   5. DEPLOYMENT_SAFEGUARDS contains the mandatory DS011–DS013 rules
 *   6. Runtime function stubs return the expected stub shapes
 *   7. PricingConnector class instantiates and exposes the required API surface
 *
 * All tests here are 🟢 expected-to-pass on the Step 1 branch and should
 * remain green through subsequent steps as stubs are replaced by real impls.
 */

import { describe, it, expect } from 'vitest';
import * as harness from '@kickstart/harness';
import {
  Phase,
  PHASE_DEFINITIONS,
  SETUP_GENERATION_STEP_ORDER,
  DEPLOYMENT_SAFEGUARDS,
  PricingConnector,
  InMemoryArtifactStore,
  APIConnectorRegistry,
  AzureARMConnector,
  GitHubConnector,
  advancePhase,
  getPhaseDefinition,
  getPhaseOrder,
  buildSystemPrompt,
  resolveSkills,
  processResponse,
  shouldAutoContinue,
  isPhase,
  defaultKitRegistry,
  defaultRegistry,
  AUTO_CONTINUE_MAX_CONSECUTIVE,
  KNOWN_COMPONENT_TYPES,
} from '@kickstart/harness';

// ── 1. Module loads ──────────────────────────────────────────────────────────

describe('harness module', () => {
  it('loads without throwing', () => {
    expect(harness).toBeDefined();
  });

  it('exports are all defined (no undefined named exports)', () => {
    const exports = Object.entries(harness);
    expect(exports.length).toBeGreaterThan(0);
    for (const [name, value] of exports) {
      expect(value, `export "${name}" should not be undefined`).not.toBeUndefined();
    }
  });
});

// ── 2. Phase enum ────────────────────────────────────────────────────────────

describe('Phase enum', () => {
  it('contains exactly the canonical brief phases', () => {
    const phases = Object.values(Phase);
    expect(phases).toEqual(['discover', 'design', 'generate', 'review', 'handoff', 'deploy']);
  });

  it('does not contain the legacy "assess" phase', () => {
    expect(Object.values(Phase)).not.toContain('assess');
  });

  it('contains the Handoff phase', () => {
    expect(Phase.Handoff).toBe('handoff');
  });
});

// ── 3. Phase definitions and flow ───────────────────────────────────────────

describe('PHASE_DEFINITIONS', () => {
  it('has one definition per Phase value', () => {
    const phaseCount = Object.keys(Phase).length;
    expect(PHASE_DEFINITIONS).toHaveLength(phaseCount);
  });

  it('Discover advances to Design', () => {
    const result = advancePhase(Phase.Discover);
    expect(result).toBe(Phase.Design);
  });

  it('Design advances to Generate', () => {
    expect(advancePhase(Phase.Design)).toBe(Phase.Generate);
  });

  it('Generate advances to Review', () => {
    expect(advancePhase(Phase.Generate)).toBe(Phase.Review);
  });

  it('Review advances to Handoff', () => {
    expect(advancePhase(Phase.Review)).toBe(Phase.Handoff);
  });

  it('Handoff advances to Deploy', () => {
    expect(advancePhase(Phase.Handoff)).toBe(Phase.Deploy);
  });

  it('Deploy does not advance (terminal phase)', () => {
    expect(advancePhase(Phase.Deploy)).toBe(Phase.Deploy);
  });

  it('getPhaseDefinition returns a valid definition for all phases', () => {
    for (const phase of Object.values(Phase)) {
      const def = getPhaseDefinition(phase);
      expect(def).toBeDefined();
      expect(def.label.length).toBeGreaterThan(0);
    }
  });

  it('getPhaseOrder returns all phases in order', () => {
    const order = getPhaseOrder();
    expect(order[0]).toBe(Phase.Discover);
    expect(order[order.length - 1]).toBe(Phase.Deploy);
  });
});

// ── 4. Setup generation step order ──────────────────────────────────────────

describe('SETUP_GENERATION_STEP_ORDER', () => {
  it('is non-empty', () => {
    expect(SETUP_GENERATION_STEP_ORDER.length).toBeGreaterThan(0);
  });

  it('contains all expected step IDs', () => {
    const expected = ['app-scaffolding', 'dockerfile', 'deployment-config', 'ci-cd', 'service-connections'];
    for (const id of expected) {
      expect(SETUP_GENERATION_STEP_ORDER).toContain(id);
    }
  });
});

// ── 5. Deployment safeguards ─────────────────────────────────────────────────

describe('DEPLOYMENT_SAFEGUARDS', () => {
  it('is non-empty', () => {
    expect(DEPLOYMENT_SAFEGUARDS.length).toBeGreaterThan(0);
  });

  it('contains the production-tier safeguards DS011, DS012, DS013', () => {
    const ids = DEPLOYMENT_SAFEGUARDS.map((s) => s.id);
    expect(ids).toContain('DS011');
    expect(ids).toContain('DS012');
    expect(ids).toContain('DS013');
  });

  it('each safeguard has required fields', () => {
    for (const sg of DEPLOYMENT_SAFEGUARDS) {
      expect(sg.id, `safeguard ${sg.id} missing id`).toBeTruthy();
      expect(sg.rule, `safeguard ${sg.id} missing rule`).toBeTruthy();
      expect(sg.description, `safeguard ${sg.id} missing description`).toBeTruthy();
      expect(['error', 'warning']).toContain(sg.severity);
    }
  });
});

// ── 6. Runtime function stubs ────────────────────────────────────────────────

describe('runtime function stubs', () => {
  it('buildSystemPrompt returns a non-empty string', () => {
    const result = buildSystemPrompt({});
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('resolveSkills returns an array', () => {
    expect(Array.isArray(resolveSkills([], { agentName: 'agent', userMessage: '', budgetTokens: 9999 }))).toBe(true);
  });

  it('processResponse returns an object', () => {
    expect(typeof processResponse('some text')).toBe('object');
  });

  it('shouldAutoContinue returns a boolean', () => {
    expect(typeof shouldAutoContinue('advance')).toBe('boolean');
  });

  it('isPhase correctly identifies valid phases', () => {
    expect(isPhase('discover')).toBe(true);
    expect(isPhase('handoff')).toBe(true);
    expect(isPhase('assess')).toBe(false);
    expect(isPhase('not-a-phase')).toBe(false);
  });

  it('AUTO_CONTINUE_MAX_CONSECUTIVE is a positive number', () => {
    expect(typeof AUTO_CONTINUE_MAX_CONSECUTIVE).toBe('number');
    expect(AUTO_CONTINUE_MAX_CONSECUTIVE).toBeGreaterThan(0);
  });

  it('KNOWN_COMPONENT_TYPES is an array', () => {
    expect(Array.isArray(KNOWN_COMPONENT_TYPES)).toBe(true);
  });

  it('defaultKitRegistry.getAll returns an array', () => {
    expect(Array.isArray(defaultKitRegistry.getAll())).toBe(true);
  });

  it('defaultRegistry.toOpenAIFormat returns an array', () => {
    expect(Array.isArray(defaultRegistry.toOpenAIFormat())).toBe(true);
  });
});

// ── 7. Class stubs ───────────────────────────────────────────────────────────

describe('class stubs', () => {
  it('InMemoryArtifactStore instantiates', () => {
    expect(() => new InMemoryArtifactStore()).not.toThrow();
  });

  it('APIConnectorRegistry instantiates and has register/get', () => {
    const reg = new APIConnectorRegistry();
    expect(typeof reg.register).toBe('function');
    expect(typeof reg.get).toBe('function');
    expect(reg.get('anything')).toBeUndefined();
  });

  it('AzureARMConnector instantiates and has name', () => {
    const conn = new AzureARMConnector();
    expect(conn.name).toBe('azure-arm');
  });

  it('GitHubConnector instantiates and has name', () => {
    const conn = new GitHubConnector();
    expect(conn.name).toBe('github');
  });

  it('PricingConnector instantiates with no options', () => {
    expect(() => new PricingConnector()).not.toThrow();
  });

  it('PricingConnector exposes fetchRetailPrices method', () => {
    const conn = new PricingConnector();
    expect(typeof conn.fetchRetailPrices).toBe('function');
  });

  it('PricingConnector exposes lookupVmPrice method', () => {
    const conn = new PricingConnector();
    expect(typeof conn.lookupVmPrice).toBe('function');
  });
});
