/**
 * Layer 3 of #1062 (closes #1060): createSurface duplicate guard.
 *
 * When a createSurface targets a surfaceId that already exists on the canvas,
 * the client must drop that message (no-op) so the surface is not re-mounted.
 * Subsequent updateComponents messages for the same surface still flow
 * through unchanged. Prevents the "duplicate header" problem seen in #1060.
 *
 * These tests exercise `_filterMessagesForProcessor` — the pure helper
 * extracted from `useA2UI.processMessages` — so the guard is covered without
 * booting React or the A2UI registry.
 */

import { describe, expect, it, vi } from 'vitest';
import { _filterMessagesForProcessor } from '../hooks/useA2UI';

function noopValidate(raw: Array<Record<string, unknown>>) {
  return raw;
}

describe('_filterMessagesForProcessor — createSurface guard (#1060)', () => {
  it('passes createSurface through when the surface does not yet exist', () => {
    const existing = new Set<string>();
    const { safeMessages, surfaceIds } = _filterMessagesForProcessor(
      [
        { version: 'v0.9', createSurface: { surfaceId: 's-new', catalogId: 'foreign' } } as any,
      ],
      (id) => existing.has(id),
      noopValidate,
      'kickstart',
    );
    expect(surfaceIds).toEqual(['s-new']);
    expect(safeMessages).toHaveLength(1);
    // catalogId is rewritten to the kickstart catalog.
    expect(((safeMessages[0] as any).createSurface as any).catalogId).toBe('kickstart');
  });

  it('drops createSurface when the surface already exists, but still reports the id', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const existing = new Set(['dup-1']);
    const { safeMessages, surfaceIds } = _filterMessagesForProcessor(
      [
        { version: 'v0.9', createSurface: { surfaceId: 'dup-1', catalogId: 'kickstart' } } as any,
      ],
      (id) => existing.has(id),
      noopValidate,
      'kickstart',
    );
    // The create is dropped — no message reaches the processor.
    expect(safeMessages).toHaveLength(0);
    // But callers still receive the surfaceId so they can list rendered surfaces.
    expect(surfaceIds).toEqual(['dup-1']);
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('already exists'),
    );
    debugSpy.mockRestore();
  });

  it('keeps updateComponents for an already-existing surface when the duplicate create is dropped', () => {
    const existing = new Set(['dup-1']);
    const { safeMessages, surfaceIds } = _filterMessagesForProcessor(
      [
        { version: 'v0.9', createSurface: { surfaceId: 'dup-1', catalogId: 'kickstart' } } as any,
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'dup-1',
            components: [{ id: 'root', component: 'Text', text: 'hi' }],
          },
        } as any,
      ],
      (id) => existing.has(id),
      noopValidate,
      'kickstart',
    );
    expect(surfaceIds).toEqual(['dup-1', 'dup-1']);
    // Only the updateComponents message survives — that's the "treat subsequent
    // creates as updates-or-no-op" contract from the DP.
    expect(safeMessages).toHaveLength(1);
    expect((safeMessages[0] as any).updateComponents).toBeDefined();
  });

  it('leaves deleteSurface and updateDataModel messages untouched', () => {
    const { safeMessages } = _filterMessagesForProcessor(
      [
        { version: 'v0.9', deleteSurface: { surfaceId: 'x' } } as any,
        { version: 'v0.9', updateDataModel: { surfaceId: 'x', dataModel: {} } } as any,
      ],
      () => false,
      noopValidate,
      'kickstart',
    );
    expect(safeMessages).toHaveLength(2);
  });

  it('reports updateComponents surface ids even without a createSurface message', () => {
    const { safeMessages, surfaceIds } = _filterMessagesForProcessor(
      [
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'shared:triage-main',
            components: [{ id: 'branch', component: 'Text', text: 'Choose one' }],
          },
        } as any,
      ],
      () => true,
      noopValidate,
      'kickstart',
    );

    expect(surfaceIds).toEqual(['shared:triage-main']);
    expect(safeMessages).toHaveLength(1);
    expect((safeMessages[0] as any).updateComponents.surfaceId).toBe('shared:triage-main');
  });
});

describe('_filterMessagesForProcessor — shared: surface registry (Phase E)', () => {
  it('createSurface(shared:triage-main) establishes ownership in the registry', () => {
    const sharedRegistry = new Map<string, { ownerTurn: number; createdByAgent: string }>();
    _filterMessagesForProcessor(
      [{ version: 'v0.9', createSurface: { surfaceId: 'shared:triage-main', catalogId: 'kickstart' } } as any],
      () => false,
      noopValidate,
      'kickstart',
      sharedRegistry,
      0,
    );
    expect(sharedRegistry.has('shared:triage-main')).toBe(true);
    expect(sharedRegistry.get('shared:triage-main')).toMatchObject({ ownerTurn: 0 });
  });

  it('updateComponents to a known shared surface routes through', () => {
    const sharedRegistry = new Map([
      ['shared:triage-main', { ownerTurn: 0, createdByAgent: 'unknown' }],
    ]);
    const { safeMessages } = _filterMessagesForProcessor(
      [
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'shared:triage-main',
            components: [{ type: 'Text', text: 'updated' }],
          },
        } as any,
      ],
      () => true,
      noopValidate,
      'kickstart',
      sharedRegistry,
      1,
    );
    expect(safeMessages).toHaveLength(1);
  });

  it('updateComponents to an UNKNOWN shared surface is REJECTED', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sharedRegistry = new Map<string, { ownerTurn: number; createdByAgent: string }>();
    const { safeMessages } = _filterMessagesForProcessor(
      [
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'shared:ghost',
            components: [{ type: 'Text', text: 'injected' }],
          },
        } as any,
      ],
      () => false,
      noopValidate,
      'kickstart',
      sharedRegistry,
      0,
    );
    expect(safeMessages).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no registered owner'));
    warnSpy.mockRestore();
  });

  it('registry rebuilds correctly from message replay (createSurface re-registers ownership)', () => {
    const sharedRegistry = new Map<string, { ownerTurn: number; createdByAgent: string }>();
    // Simulate message replay: createSurface arrives again (e.g. after reset)
    _filterMessagesForProcessor(
      [{ version: 'v0.9', createSurface: { surfaceId: 'shared:replay-surface', catalogId: 'kickstart' } } as any],
      () => false,
      noopValidate,
      'kickstart',
      sharedRegistry,
      2,
    );
    expect(sharedRegistry.has('shared:replay-surface')).toBe(true);
    expect(sharedRegistry.get('shared:replay-surface')?.ownerTurn).toBe(2);
  });

  it('no sharedRegistry provided means guard is inactive (backward-compat)', () => {
    // Without a registry, unknown shared: targets still pass through.
    const { safeMessages } = _filterMessagesForProcessor(
      [
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'shared:unknown',
            components: [],
          },
        } as any,
      ],
      () => false,
      noopValidate,
      'kickstart',
      // no sharedRegistry argument
    );
    expect(safeMessages).toHaveLength(1);
  });
});
