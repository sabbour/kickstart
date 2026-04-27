/**
 * @file navigate.test.ts
 * @suite core.navigate — unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RunContext } from '@openai/agents';
import { A2UI_VERSION } from '@aks-kickstart/harness';
import { navigateTool } from '../../tools/navigate.js';
import { makeSessionCtx } from './_session-stub.js';

describe('core.navigate', () => {
  let session: ReturnType<typeof makeSessionCtx>;

  const invoke = (message: unknown) =>
    navigateTool.tool.invoke(new RunContext(session), JSON.stringify({ message }));

  beforeEach(() => {
    session = makeSessionCtx();
    session.liveSurfaceIds.add('main');
    session.liveSurfaceIds.add('status');
  });

  it('updateDataModel succeeds on live surface', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'updateDataModel',
        updateDataModel: { surfaceId: 'main', path: '/status', value: 'ready' },
      }),
    );
    expect(result).toContain('updateDataModel');
  });

  it('updateDataModel with null value succeeds', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'updateDataModel',
        updateDataModel: { surfaceId: 'status', path: null, value: null },
      }),
    );
    expect(result).toContain('updateDataModel');
  });

  it('deleteSurface removes the surface', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'deleteSurface',
        deleteSurface: { surfaceId: 'main' },
      }),
    );
    expect(result).toContain('deleteSurface');
    expect(session.liveSurfaceIds.has('main')).toBe(false);
  });

  it('updateDataModel on unknown surface rejects', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'updateDataModel',
        updateDataModel: { surfaceId: 'ghost', path: '/x', value: 1 },
      }),
    );
    expect(result.toLowerCase()).toContain('error');
  });

  it('deleteSurface on unknown surface rejects', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'deleteSurface',
        deleteSurface: { surfaceId: 'ghost' },
      }),
    );
    expect(result.toLowerCase()).toContain('error');
  });
});
