/**
 * @file show_card.test.ts
 * @suite core.show_card — unit tests
 *
 * Tests A2UI v0.9 message validation and session recording for the
 * informational card tool.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RunContext } from '@openai/agents';
import { A2UI_VERSION } from '@aks-kickstart/harness';
import { showCardTool } from '../../tools/show_card.js';
import { makeSessionCtx } from './_session-stub.js';

describe('core.show_card', () => {
  let session: ReturnType<typeof makeSessionCtx>;

  const invoke = (message: unknown) =>
    showCardTool.tool.invoke(new RunContext(session), JSON.stringify({ message }));

  beforeEach(() => {
    session = makeSessionCtx();
    session.liveSurfaceIds.add('card-surface');
    session.liveSurfaceIds.add('main');
  });

  it('createSurface succeeds and records the surface', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'createSurface',
        createSurface: { surfaceId: 'new-card', catalogId: 'kickstart', sendDataModel: null },
      }),
    );
    expect(result).toContain('createSurface');
    expect(session.liveSurfaceIds.has('new-card')).toBe(true);
  });

  it('updateComponents with Text + Column succeeds', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Column', children: ['title'] },
            { id: 'title', component: 'Text', text: 'Hello' },
          ],
        },
      }),
    );
    expect(result).toContain('updateComponents');
  });

  it('updateComponents with Alert succeeds', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents',
        updateComponents: {
          surfaceId: 'card-surface',
          components: [{ id: 'alert', component: 'Alert', message: 'Deployment complete', action: null }],
        },
      }),
    );
    expect(result).toContain('updateComponents');
  });

  it('updateComponents with Table succeeds', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents',
        updateComponents: {
          surfaceId: 'card-surface',
          components: [
            { id: 'tbl', component: 'Table', columns: ['Name', 'Status'], rows: [['node-1', 'Ready']] },
          ],
        },
      }),
    );
    expect(result).toContain('updateComponents');
  });

  it('updateComponents on unknown surface rejects', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents',
        updateComponents: {
          surfaceId: 'does-not-exist',
          components: [{ id: 't', component: 'Text', text: 'hi' }],
        },
      }),
    );
    expect(result.toLowerCase()).toContain('error');
  });

  it('createSurface on existing surface rejects', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'createSurface',
        createSurface: { surfaceId: 'main', catalogId: 'kickstart', sendDataModel: null },
      }),
    );
    expect(result.toLowerCase()).toContain('error');
  });
});
