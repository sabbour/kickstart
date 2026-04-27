/**
 * @file show_form.test.ts
 * @suite core.show_form — unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RunContext } from '@openai/agents';
import { A2UI_VERSION } from '@aks-kickstart/harness';
import { showFormTool } from '../../tools/show_form.js';
import { makeSessionCtx } from './_session-stub.js';

describe('core.show_form', () => {
  let session: ReturnType<typeof makeSessionCtx>;

  const invoke = (message: unknown) =>
    showFormTool.tool.invoke(new RunContext(session), JSON.stringify({ message }));

  beforeEach(() => {
    session = makeSessionCtx();
    session.liveSurfaceIds.add('form-surface');
    session.liveSurfaceIds.add('main');
  });

  it('createSurface succeeds', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'createSurface',
        createSurface: { surfaceId: 'new-form', catalogId: 'kickstart', sendDataModel: null },
      }),
    );
    expect(result).toContain('createSurface');
    expect(session.liveSurfaceIds.has('new-form')).toBe(true);
  });

  it('updateComponents with TextField + Button succeeds', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents',
        updateComponents: {
          surfaceId: 'form-surface',
          components: [
            { id: 'root', component: 'Column', children: ['name', 'submit'] },
            { id: 'name', component: 'TextField', label: 'Cluster name' },
            {
              id: 'submit',
              component: 'Button',
              child: 'submit-lbl',
              action: { event: { name: 'submit', payload: null } },
            },
            { id: 'submit-lbl', component: 'Text', text: 'Create' },
          ],
        },
      }),
    );
    expect(result).toContain('updateComponents');
  });

  it('updateComponents with CheckBox + ChoicePicker succeeds', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents',
        updateComponents: {
          surfaceId: 'form-surface',
          components: [
            { id: 'cb', component: 'CheckBox', label: 'Enable monitoring', value: false },
            {
              id: 'picker',
              component: 'ChoicePicker',
              options: [
                { label: 'East US', value: 'eastus' },
                { label: 'West US', value: 'westus' },
              ],
              value: ['eastus'],
            },
          ],
        },
      }),
    );
    expect(result).toContain('updateComponents');
  });

  it('updateComponents with Toggle succeeds', async () => {
    const result = String(
      await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents',
        updateComponents: {
          surfaceId: 'form-surface',
          components: [{ id: 'tog', component: 'Toggle', label: 'Auto-upgrade', checked: false, action: null }],
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
          surfaceId: 'ghost',
          components: [{ id: 'f', component: 'TextField', label: 'x' }],
        },
      }),
    );
    expect(result.toLowerCase()).toContain('error');
  });
});
