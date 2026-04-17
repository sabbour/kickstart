/**
 * @file basic-components.test.tsx
 * @suite Phase D — basic component smoke tests
 * @vitest-environment jsdom
 *
 * Verifies every component in packages/pack-core/src/components/basic/:
 *  - Satisfies the ReactComponentImplementation shape (name, schema, render).
 *  - Renders without throwing when given empty props.
 *
 * Fluent UI deps are stubbed with noop React components so the tests run
 * entirely within the worktree's React 18 instance (the root node_modules
 * carries React 19 which would cause "Invalid hook call" errors otherwise).
 *
 * @depends Phase D of #477
 */

// @vitest-environment jsdom

import { vi } from 'vitest';

// ── Fluent UI stubs (hoisted before all imports by Vite) ─────────────────────

// Returns null (valid empty React render) for all unknown component keys.
const noopComp = () => null;
const fluentStubs = {
  makeStyles: () => () => ({}),
  mergeClasses: (...a: unknown[]) => (a.filter(Boolean) as string[]).join(' '),
  tokens: new Proxy({} as Record<string, string>, { get: () => '' }),
  useId: () => 'test-id',
  // Accordion
  Accordion: noopComp, AccordionItem: noopComp, AccordionHeader: noopComp, AccordionPanel: noopComp,
  // Alert / MessageBar
  MessageBar: noopComp, MessageBarBody: noopComp, MessageBarActions: noopComp,
  // Badge
  Badge: noopComp,
  // Button
  Button: noopComp,
  // Card
  Card: noopComp, Subtitle1: noopComp,
  // CheckBox
  Checkbox: noopComp, Field: noopComp,
  // ChoicePicker / RadioGroup
  RadioGroup: noopComp, Radio: noopComp, Dropdown: noopComp, Option: noopComp,
  // ComboBox
  Combobox: noopComp,
  // DateTimeInput
  DatePicker: noopComp,
  // Divider
  Divider: noopComp,
  // Icon
  Icon: noopComp,
  // Image
  Image: noopComp,
  // Link
  Link: noopComp,
  // List / Row / Column
  // Modal / Dialog
  Dialog: noopComp, DialogSurface: noopComp, DialogBody: noopComp,
  DialogTitle: noopComp, DialogContent: noopComp, DialogActions: noopComp,
  DialogTrigger: noopComp,
  // MultiSelect
  Listbox: noopComp,
  // Slider
  Slider: noopComp,
  // Table
  Table: noopComp, TableHeader: noopComp, TableHeaderCell: noopComp,
  TableBody: noopComp, TableRow: noopComp, TableCell: noopComp, TableCellLayout: noopComp,
  TableSelectionCell: noopComp,
  // Tabs
  TabList: noopComp, Tab: noopComp, TabPanel: noopComp,
  // Text variants
  Title1: noopComp, Title2: noopComp, Title3: noopComp,
  Subtitle2: noopComp, Caption1: noopComp, Body1: noopComp, Text: noopComp,
  // TextField
  Input: noopComp, Textarea: noopComp,
  // Toggle
  Switch: noopComp,
  // Video
  // General
  Tooltip: noopComp, Spinner: noopComp, Skeleton: noopComp, Label: noopComp,
};

vi.mock('@fluentui/react-components', () => fluentStubs);

vi.mock('@fluentui/react-icons', () => ({
  // Each icon is a noop component; list the ones used in basic components
  OpenRegular: noopComp,
  DismissRegular: noopComp,
  // Wildcard: any unknown icon will be undefined at runtime (components guard with ?.)
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter.js';
import { fluentOverrides } from '../../components/basic/index.js';
import { ChildList } from '../../components/basic/ChildList.js';

afterEach(cleanup);

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockContext = {
  componentModel: { id: 'test-id', properties: {} },
  dataContext: {
    path: '/',
    resolveAction: (_action: unknown) => ({ event: {} }),
  },
  dispatchAction: (_action: unknown) => {},
};

const noBuildChild = (_id: string): React.ReactNode => null;

/**
 * Smoke-render a ReactComponentImplementation.
 * Casts render to the full { props, buildChild, context } shape the underlying
 * FC actually expects. The adapter's TypeScript type only exposes
 * { context, buildChild }, but the runtime function receives all three.
 */
function smokeRender(comp: ReactComponentImplementation): void {
  const Impl = comp.render as React.FC<{
    props: Record<string, unknown>;
    buildChild: (id: string) => React.ReactNode;
    context: typeof mockContext;
  }>;
  render(<Impl props={{}} buildChild={noBuildChild} context={mockContext} />);
}

// ── Metadata tests ─────────────────────────────────────────────────────────────

describe('fluentOverrides — metadata', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(fluentOverrides)).toBe(true);
    expect(fluentOverrides.length).toBeGreaterThan(0);
  });

  it.each(fluentOverrides.map(c => [c.name, c] as [string, ReactComponentImplementation]))(
    '%s: has non-empty name, a schema, and a render function',
    (_name, comp) => {
      expect(typeof comp.name).toBe('string');
      expect(comp.name.length).toBeGreaterThan(0);
      expect(comp.schema).toBeDefined();
      expect(typeof comp.render).toBe('function');
    }
  );

  it('has no duplicate names', () => {
    const names = fluentOverrides.map(c => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ── Smoke render tests ─────────────────────────────────────────────────────────

describe('fluentOverrides — smoke renders', () => {
  it.each(fluentOverrides.map(c => [c.name, c] as [string, ReactComponentImplementation]))(
    '%s: renders without throwing',
    (_name, comp) => {
      expect(() => smokeRender(comp)).not.toThrow();
    }
  );
});

// ── ChildList (utility component) ─────────────────────────────────────────────

describe('ChildList', () => {
  it('is a React function component', () => {
    expect(typeof ChildList).toBe('function');
  });

  it('renders nothing for an empty array', () => {
    const { container } = render(
      <ChildList childList={[]} context={mockContext} buildChild={noBuildChild} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders children from a string-id list', () => {
    const buildChild = (id: string): React.ReactNode =>
      <span key={id} data-testid={`child-${id}`}>{id}</span>;
    const { getByTestId } = render(
      <ChildList childList={['a', 'b']} context={mockContext} buildChild={buildChild} />
    );
    expect(getByTestId('child-a')).toBeTruthy();
    expect(getByTestId('child-b')).toBeTruthy();
  });

  it('renders children from an object-id list', () => {
    const buildChild = (id: string): React.ReactNode =>
      <span key={id} data-testid={`child-${id}`}>{id}</span>;
    const { getByTestId } = render(
      <ChildList
        childList={[{ id: 'x' }, { id: 'y', basePath: '/base' }]}
        context={mockContext}
        buildChild={buildChild}
      />
    );
    expect(getByTestId('child-x')).toBeTruthy();
    expect(getByTestId('child-y')).toBeTruthy();
  });

  it('renders nothing for a non-array childList', () => {
    const { container } = render(
      <ChildList childList={null} context={mockContext} buildChild={noBuildChild} />
    );
    expect(container.innerHTML).toBe('');
  });
});
