/**
 * @file basic-components.test.tsx
 * @suite Phase D — basic component smoke tests
 * @vitest-environment jsdom
 *
 * Verifies every component in packages/pack-core/src/components/basic/:
 *  - Satisfies the ReactComponentImplementation shape (name, schema, render).
 *  - Renders without throwing when given empty props.
 *
 * Fluent UI deps are stubbed so the tests run entirely within the worktree's
 * React 18 instance (the root node_modules carries React 19 which would cause
 * "Invalid hook call" errors if the real Fluent components were rendered).
 *
 * NOTE: vi.mock factories are hoisted to the top of the compiled output, so
 * they cannot reference variables declared in the module body. All stub values
 * must be inlined inside the factory functions.
 *
 * @depends Phase D of #477
 */

// @vitest-environment jsdom

import { vi } from 'vitest';

// ── Fluent UI stubs ───────────────────────────────────────────────────────────

vi.mock('@fluentui/react-components', () => {
  const noop = () => null;
  return {
    makeStyles: () => () => ({}),
    mergeClasses: (...a: unknown[]) => (a.filter(Boolean) as string[]).join(' '),
    tokens: new Proxy({} as Record<string, string>, { get: () => '' }),
    useId: () => 'test-id',
    // Accordion
    Accordion: noop, AccordionItem: noop, AccordionHeader: noop, AccordionPanel: noop,
    // Alert / MessageBar
    MessageBar: noop, MessageBarBody: noop, MessageBarActions: noop,
    // Badge
    Badge: noop,
    // Button
    Button: noop,
    // Card
    Card: noop, Subtitle1: noop,
    // CheckBox
    Checkbox: noop, Field: noop,
    // ChoicePicker
    RadioGroup: noop, Radio: noop, Dropdown: noop, Option: noop,
    // ComboBox
    Combobox: noop,
    // Divider
    Divider: noop,
    // Dialog (Modal)
    Dialog: noop, DialogSurface: noop, DialogBody: noop,
    DialogTitle: noop, DialogContent: noop, DialogActions: noop,
    DialogTrigger: noop,
    // Image
    Image: noop,
    // Link
    Link: noop,
    // Slider
    Slider: noop,
    // Table
    Table: noop, TableHeader: noop, TableHeaderCell: noop,
    TableBody: noop, TableRow: noop, TableCell: noop, TableCellLayout: noop,
    TableSelectionCell: noop,
    // Tabs
    TabList: noop, Tab: noop,
    // Text variants
    Title1: noop, Title2: noop, Title3: noop,
    Subtitle2: noop, Caption1: noop, Body1: noop, Text: noop,
    // TextField
    Input: noop, Textarea: noop,
    // Toggle
    Switch: noop,
    // Misc
    Label: noop, Tooltip: noop,
  };
});

vi.mock('@fluentui/react-icons', () => {
  const noop = () => null;
  return {
    // Used by Text.tsx
    OpenRegular: noop,
    // Used by Alert.tsx
    DismissRegular: noop,
    // Used by fluent-icons.ts (Icon.tsx) — all icons in FLUENT_REACT_ICON_REGISTRY
    DocumentRegular: noop, FolderRegular: noop, CodeRegular: noop, SettingsRegular: noop,
    HomeRegular: noop, PersonRegular: noop, SearchRegular: noop, AddRegular: noop,
    DeleteRegular: noop, EditRegular: noop, SaveRegular: noop, SendRegular: noop,
    StarRegular: noop, CloudRegular: noop, GlobeRegular: noop, LockClosedRegular: noop,
    KeyRegular: noop, TagRegular: noop, ChatRegular: noop, ClockRegular: noop,
    FilterRegular: noop, ArrowLeftRegular: noop, ChevronDownRegular: noop,
    LinkRegular: noop, CheckmarkCircleRegular: noop, WarningRegular: noop,
    InfoRegular: noop, CopyRegular: noop, ArrowUploadRegular: noop,
    ArrowDownloadRegular: noop, ErrorCircleRegular: noop,
  };
});

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
 * FC actually expects. The adapter TypeScript type only exposes
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
