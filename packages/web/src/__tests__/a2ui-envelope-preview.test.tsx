// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { z } from 'zod';
import { A2UIEnvelopePreview } from '../components/A2UI/A2UIEnvelopePreview';
import { DebugProvider } from '../contexts/DebugContext';
import { clientRegistry } from '../contexts/A2UIRegistryContext';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeAll(() => {
  // Silence React 19 act warnings in Vitest's jsdom environment.
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  if (clientRegistry.isSealed) return;
  clientRegistry.register({
    name: 'Column',
    schema: z.object({ children: z.array(z.string()).optional() }),
    render: ({ context, buildChild }: { context: any; buildChild: (id: string) => React.ReactNode }) => (
      <div data-testid="column">
        {Array.isArray(context.componentModel.properties.children)
          ? context.componentModel.properties.children.map((childId: string) => buildChild(childId))
          : null}
      </div>
    ),
  } as any);
  clientRegistry.register({
    name: 'Text',
    schema: z.object({ text: z.string() }),
    render: ({ context }: { context: any }) => <span>{String(context.componentModel.properties.text ?? '')}</span>,
  } as any);
  clientRegistry.seal();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
  localStorage.clear();
});

describe('A2UIEnvelopePreview', () => {
  it('renders the root component content in StrictMode instead of getting stuck on root fallback', async () => {
    localStorage.setItem('kickstart-debug', 'true');

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <React.StrictMode>
          <DebugProvider>
            <A2UIEnvelopePreview
              surfaceId="preview-strict-mode"
              components={[
                { id: 'root', component: 'Column', children: ['message'] },
                { id: 'message', component: 'Text', text: 'Preview ready' },
              ]}
              loading={<div>Loading preview…</div>}
            />
          </DebugProvider>
        </React.StrictMode>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container!.textContent).toContain('Preview ready');
    expect(container!.textContent).not.toContain('Missing component: root');
    expect(container!.textContent).not.toContain('[Loading root...]');
  });
});
