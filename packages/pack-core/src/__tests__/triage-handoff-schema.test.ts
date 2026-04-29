import { describe, it, expect } from 'vitest';
import {
  AKS_AUTOMATIC_V1_1_1,
  TriageMode,
  TriageHandoffBriefingSchema,
  parseTriageHandoffBriefing,
} from '../triage/handoff-schema.js';

const baseSignals = [{ kind: 'opener-keyword' as const, detail: 'orders-api' }];

describe('TriageHandoffBriefing schema (#198 Z1/Z2/R5)', () => {
  it('parses a valid migration-readiness briefing with v1.1.1 constraint pin', () => {
    const b = parseTriageHandoffBriefing({
      version: 'triage-handoff/v1',
      mode: TriageMode.MigrationReadiness,
      constraintSpec: AKS_AUTOMATIC_V1_1_1,
      skillIdsLoaded: ['azure-kubernetes-automatic-readiness'],
      sourceSignals: baseSignals,
      targetAgent: 'aks.reviewer',
      migrationReadiness: { sourceShape: 'raw-manifests', helmBridgeRequired: false },
    });
    expect(b.constraintSpec?.safeguardSpecVersion).toBe('v1.1.1');
    expect(b.constraintSpec?.aksVersion).toBe('2026-03-15');
  });

  it('Z1 tripwire: rejects migration-readiness briefing missing constraintSpec', () => {
    expect(() =>
      parseTriageHandoffBriefing({
        version: 'triage-handoff/v1',
        mode: TriageMode.MigrationReadiness,
        skillIdsLoaded: ['azure-kubernetes-automatic-readiness'],
        sourceSignals: baseSignals,
        targetAgent: 'aks.reviewer',
        migrationReadiness: { sourceShape: 'raw-manifests', helmBridgeRequired: false },
      }),
    ).toThrow(/constraintSpec is REQUIRED/);
  });

  it('Z1 tripwire: rejects handover briefing missing constraintSpec', () => {
    expect(() =>
      parseTriageHandoffBriefing({
        version: 'triage-handoff/v1',
        mode: TriageMode.Handover,
        sourceSignals: baseSignals,
        targetAgent: 'aks.reviewer',
        handover: { audience: 'SRE Sarah' },
      }),
    ).toThrow(/constraintSpec is REQUIRED/);
  });

  it('R5 format pin: rejects non-canonical safeguardSpecVersion shape', () => {
    expect(() =>
      TriageHandoffBriefingSchema.parse({
        version: 'triage-handoff/v1',
        mode: TriageMode.MigrationReadiness,
        constraintSpec: { safeguardSpecVersion: '1.1.1', aksVersion: '2026-03-15' },
        skillIdsLoaded: ['azure-kubernetes-automatic-readiness'],
        sourceSignals: baseSignals,
        targetAgent: 'aks.reviewer',
        migrationReadiness: { sourceShape: 'helm', helmBridgeRequired: true },
      }),
    ).toThrow(/safeguardSpecVersion/);
  });

  it('R5 format pin: rejects non-canonical aksVersion shape', () => {
    expect(() =>
      TriageHandoffBriefingSchema.parse({
        version: 'triage-handoff/v1',
        mode: TriageMode.MigrationReadiness,
        constraintSpec: { safeguardSpecVersion: 'v1.1.1', aksVersion: '2026-03' },
        skillIdsLoaded: ['azure-kubernetes-automatic-readiness'],
        sourceSignals: baseSignals,
        targetAgent: 'aks.reviewer',
        migrationReadiness: { sourceShape: 'helm', helmBridgeRequired: true },
      }),
    ).toThrow(/aksVersion/);
  });

  it('D8 enforcement: migration-readiness must declare the readiness skill', () => {
    expect(() =>
      parseTriageHandoffBriefing({
        version: 'triage-handoff/v1',
        mode: TriageMode.MigrationReadiness,
        constraintSpec: AKS_AUTOMATIC_V1_1_1,
        skillIdsLoaded: [],
        sourceSignals: baseSignals,
        targetAgent: 'aks.reviewer',
        migrationReadiness: { sourceShape: 'raw-manifests', helmBridgeRequired: false },
      }),
    ).toThrow(/azure-kubernetes-automatic-readiness/);
  });

  it('rejects briefing whose mode-specific block does not match `mode`', () => {
    expect(() =>
      parseTriageHandoffBriefing({
        version: 'triage-handoff/v1',
        mode: TriageMode.Bulk,
        sourceSignals: baseSignals,
        targetAgent: 'aks.architect',
        // Wrong block — bulk requires `bulk`, not `greenfield`.
        greenfield: { track: 'containerized_web' },
      }),
    ).toThrow(/Exactly one mode-specific context block/);
  });

  it('Z3 normalization: rejects raw user-mode text', () => {
    expect(() =>
      TriageHandoffBriefingSchema.parse({
        version: 'triage-handoff/v1',
        mode: 'I want to migrate',
        sourceSignals: baseSignals,
        targetAgent: 'aks.architect',
        greenfield: {},
      }),
    ).toThrow();
  });

  it('targetAgent allowlist rejects unknown destinations', () => {
    expect(() =>
      TriageHandoffBriefingSchema.parse({
        version: 'triage-handoff/v1',
        mode: TriageMode.Greenfield,
        sourceSignals: baseSignals,
        targetAgent: 'attacker.exfil',
        greenfield: {},
      }),
    ).toThrow();
  });

  it('parses a valid greenfield briefing without constraintSpec', () => {
    const b = parseTriageHandoffBriefing({
      version: 'triage-handoff/v1',
      mode: TriageMode.Greenfield,
      sourceSignals: baseSignals,
      targetAgent: 'aks.architect',
      greenfield: { track: 'agentic_app' },
    });
    expect(b.mode).toBe('greenfield');
    expect(b.constraintSpec).toBeUndefined();
  });

  it('exports the AKS_AUTOMATIC_V1_1_1 constant with canonical fields', () => {
    expect(AKS_AUTOMATIC_V1_1_1).toEqual({
      safeguardSpecVersion: 'v1.1.1',
      aksVersion: '2026-03-15',
    });
  });
});
