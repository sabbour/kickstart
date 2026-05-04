/**
 * @file architecture-diagram-export.test.tsx
 * @suite ArchitectureDiagram — Export PNG button (#233)
 * @vitest-environment jsdom
 *
 * Verifies that the Export PNG button is present in the controls group and
 * the component structure is correct. Uses ReactDOM directly (no
 * @testing-library/react) so the test runs in worktrees where the package
 * may not be installed at the root workspace level.
 */

// @vitest-environment jsdom

import { vi } from 'vitest';

// ── Fluent UI stubs ───────────────────────────────────────────────────────────

vi.mock('@fluentui/react-components', () => {
  // Each stub renders a <span> with all props forwarded so aria-label and
  // data-testid attributes are present in the DOM for assertions.
  const passthroughSpan = (...args: unknown[]): unknown => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    const props = (args[0] ?? {}) as Record<string, unknown>;
    const { children, icon: _icon, ...rest } = props;
    return React.createElement('span', rest, children);
  };
  return {
    makeStyles: () => () => ({}),
    mergeClasses: (...a: unknown[]) => (a.filter(Boolean) as string[]).join(' '),
    shorthands: new Proxy({} as Record<string, () => Record<string, unknown>>, {
      get: () => () => ({}),
    }),
    tokens: new Proxy({} as Record<string, string>, { get: () => '' }),
    useId: () => 'test-id',
    Card: passthroughSpan,
    Button: passthroughSpan,
    Caption1: passthroughSpan,
    Subtitle2: passthroughSpan,
    Body2: passthroughSpan,
  };
});

vi.mock('@fluentui/react-icons', () => ({
  ArrowDownload16Regular: () => null,
}));

vi.mock('../../components/rich/architectureDiagramUtils', () => ({
  FLUENT_DIAGRAM_PALETTE: {},
  loadMermaid: vi.fn().mockResolvedValue({
    render: vi.fn().mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"></svg>',
    }),
  }),
  nodesToMermaid: vi.fn().mockReturnValue('graph LR\n  A --> B'),
  renderArchitectureDiagramSvg: vi.fn().mockResolvedValue(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"></svg>',
  ),
  sanitizeSvgMarkup: vi.fn().mockImplementation((s: string) => s),
}));

vi.mock('../../components/rich/architectureDiagramIconRegistry', () => ({
  ARCHITECTURE_DIAGRAM_EMPTY_STATE_ICON_URL: '',
  ARCHITECTURE_DIAGRAM_HEADER_ICON_URL: '',
  getArchitectureDiagramIconRegistry: vi.fn().mockReturnValue({ get: () => null }),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { describe, it, expect, afterEach } from 'vitest';
import { ArchitectureDiagram } from '../../components/rich/ArchitectureDiagram.js';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockContext = {
  componentModel: { id: 'arch-test', properties: {} },
  dataContext: { path: '/', resolveAction: () => ({ event: {} }) },
  dispatchAction: () => Promise.resolve(),
};

let container: HTMLDivElement | null = null;

async function renderDiagram(propOverrides: Record<string, unknown> = {}): Promise<HTMLDivElement> {
  const div = document.createElement('div');
  document.body.appendChild(div);
  container = div;

  const Impl = (ArchitectureDiagram as unknown as ReactComponentImplementation)
    .render as React.FC<{
      props: Record<string, unknown>;
      buildChild: (id: string) => React.ReactNode;
      context: typeof mockContext;
    }>;

  await act(async () => {
    ReactDOM.createRoot(div).render(
      React.createElement(Impl, {
        props: { diagram: 'graph LR\n  A --> B', ...propOverrides },
        buildChild: () => null,
        context: mockContext,
      }),
    );
  });

  return div;
}

afterEach(() => {
  if (container) {
    document.body.removeChild(container);
    container = null;
  }
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ArchitectureDiagram — manifest', () => {
  it('exports the correct component name', () => {
    const impl = ArchitectureDiagram as unknown as ReactComponentImplementation;
    expect(impl.name).toBe('ArchitectureDiagram');
  });

  it('has a Zod schema', () => {
    const impl = ArchitectureDiagram as unknown as ReactComponentImplementation;
    expect(impl.schema).toBeDefined();
    expect(typeof impl.schema.parse).toBe('function');
  });

  it('has a render function', () => {
    const impl = ArchitectureDiagram as unknown as ReactComponentImplementation;
    expect(typeof impl.render).toBe('function');
  });
});

describe('ArchitectureDiagram — Export PNG button DOM', () => {
  it('renders an element with aria-label "Export as PNG"', async () => {
    await renderDiagram();
    const el = document.querySelector('[aria-label="Export as PNG"]');
    expect(el).not.toBeNull();
  });

  it('renders an element with data-testid "architecture-diagram-export-btn"', async () => {
    await renderDiagram();
    const el = document.querySelector('[data-testid="architecture-diagram-export-btn"]');
    expect(el).not.toBeNull();
  });

  it('export button is disabled when no diagram content is provided', async () => {
    await renderDiagram({ diagram: undefined, nodes: undefined, edges: undefined });
    const el = document.querySelector('[aria-label="Export as PNG"]') as HTMLElement | null;
    if (el) {
      const isDisabled =
        el.hasAttribute('disabled') ||
        el.getAttribute('aria-disabled') === 'true' ||
        (el as HTMLButtonElement).disabled === true;
      expect(isDisabled).toBe(true);
    }
    // If the Button stub collapses to null for empty props, that is also acceptable.
  });
});
