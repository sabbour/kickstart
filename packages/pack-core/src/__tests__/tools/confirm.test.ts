/**
 * @file confirm.test.ts
 * @suite core.confirm — unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RunContext } from '@openai/agents';
import { confirmTool } from '../../tools/confirm.js';
import { makeSessionCtx } from './_session-stub.js';

describe('core.confirm', () => {
  let session: ReturnType<typeof makeSessionCtx>;

  const invoke = (input: unknown) =>
    confirmTool.tool.invoke(new RunContext(session), JSON.stringify(input));

  beforeEach(() => {
    session = makeSessionCtx();
    session.liveSurfaceIds.add('dialog-surface');
  });

  it('renders confirm dialog with title and message', async () => {
    const result = String(
      await invoke({
        surfaceId: 'dialog-surface',
        title: 'Delete cluster?',
        message: 'This action cannot be undone.',
        confirmLabel: null,
        cancelLabel: null,
      }),
    );
    expect(result).toContain('updateComponents');
    expect(session.a2uiEmissions).toHaveLength(1);
  });

  it('uses default button labels when null', async () => {
    const result = String(
      await invoke({
        surfaceId: 'dialog-surface',
        title: null,
        message: 'Are you sure?',
        confirmLabel: null,
        cancelLabel: null,
      }),
    );
    expect(result).toContain('updateComponents');
    // The emission should contain the default label text
    const emitted = JSON.stringify(session.a2uiEmissions[0]);
    expect(emitted).toContain('Confirm');
    expect(emitted).toContain('Cancel');
  });

  it('uses custom button labels when provided', async () => {
    const result = String(
      await invoke({
        surfaceId: 'dialog-surface',
        title: null,
        message: 'Proceed with deploy?',
        confirmLabel: 'Deploy',
        cancelLabel: 'Go back',
      }),
    );
    expect(result).toContain('updateComponents');
    const emitted = JSON.stringify(session.a2uiEmissions[0]);
    expect(emitted).toContain('Deploy');
    expect(emitted).toContain('Go back');
  });

  it('emits confirm event with confirmed:true', async () => {
    await invoke({
      surfaceId: 'dialog-surface',
      title: null,
      message: 'Confirm?',
      confirmLabel: null,
      cancelLabel: null,
    });
    const emitted = JSON.stringify(session.a2uiEmissions[0]);
    expect(emitted).toContain('"name":"confirm"');
    expect(emitted).toContain('"confirmed":true');
  });

  it('emits cancel event with confirmed:false', async () => {
    await invoke({
      surfaceId: 'dialog-surface',
      title: null,
      message: 'Confirm?',
      confirmLabel: null,
      cancelLabel: null,
    });
    const emitted = JSON.stringify(session.a2uiEmissions[0]);
    expect(emitted).toContain('"name":"cancel"');
    expect(emitted).toContain('"confirmed":false');
  });

  it('rejects when surface does not exist', async () => {
    const result = String(
      await invoke({
        surfaceId: 'no-such-surface',
        title: null,
        message: 'Confirm?',
        confirmLabel: null,
        cancelLabel: null,
      }),
    );
    expect(result.toLowerCase()).toContain('error');
  });
});
