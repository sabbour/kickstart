/**
 * @file basic-components.test.tsx
 * @suite Phase D — basic component smoke tests
 * @vitest-environment jsdom
 *
 * Verifies that every component contribution exported from
 * packages/pack-core/src/components/basic/ satisfies the
 * ReactComponentImplementation contract and renders without throwing.
 *
 * Strategy:
 * - Mock @fluentui/react-components and @fluentui/react-icons with lightweight
 *   div/span stubs so all tests run against a single React 18 instance (the
 *   worktree local copy). The root node_modules carries React 19 (used by the
 *   real Fluent packages), which would cause "Invalid hook call / useContext
 *   null" errors if the real Fluent components were rendered inside jsdom.
 * - Import fluentOverrides (26 contributions) and ChildList (utility helper).
 * - For each entry: check name / schema / render metadata, then smoke render.
 * - Props passed as empty object; components use null-coalescing everywhere.
 *
 * @depends Phase D of #477 (components/basic/ must exist)
 */

// @vitest-environment jsdom

import { vi } from 'vitest';

// ── Fluent UI stubs — must be declared before component imports ───────────────
// vi.mock calls are hoisted by Vite so they intercept every
// `from '@fluentui/...'` in the component source files.

vi.mock('@fluentui/react-components', async () => {
  const { default: React } = await import('react');

  const makeDiv = (name: string) => {
    const C = ({ children, ...rest }: any) =>
      React.createElement('div', { 'data-fluent': name, ...rest }, children);
    C.displayName = `Fluent(${name})`;
    return C;
  };

  const base: Record<string, unknown> = {
    makeStyles: () => () => ({}),
    mergeClasses: (...args: string[]) => args.filter(Boolean).join(' '),
    tokens: new Proxy({} as Record<string, string>, { get: () => '' }),
    useId: () => 'test-id',
  };

  return new Proxy(base, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return makeDiv(prop);
    },
  });
});

vi.mock('@fluentui/react-icons', async () => {
  const { default: React } = await import('react');
  return new Proxy({} as Record<string, unknown>, {
    get: (_t, k: string) => () => React.createElement('span', { 'data-icon': k }),
  });
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

const noBuildChild = (_id: string) => null;

/**
 * Smoke-render a ReactComponentImplementation.
 * Casts render to the full { props, buildChild, context } shape that the
 * underlying FC actually expects (the TypeScript type only exposes
 * { context, buildChild } due to the adapter cast, but the runtime function
 * receives all three).
 */
function smokeRender(comp: ReactComponentImplementation): void {
  const Impl = comp.render as React.FC<{
    props: Record<string, unknown>;
    buildChild: (id: string) => React.ReactNode;
    context: typeof mockContext;
  }>;

  render(
    <Impl
      props={{} as Record<string, unknown>}
      buildChild={noBuildChild}
      context={mockContext}
    />
  );
}

// ── Metadata tests ────────────────────────────────────────────────────────────

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

// ── Smoke render tests ────────────────────────────────────────────────────────

describe('fluentOverrides — smoke renders', () => {
  it.each(fluentOverrides.map(c => [c.name, c] as [string, ReactComponentImplementation]))(
    '%s: renders without throwing',
    (_name, comp) => {
      expect(() => smokeRender(comp)).not.toThrow();
    }
  );
});

// ── ChildList (utility component, not in fluentOverrides) ─────────────────────

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
    const buildChild = (id: string) => <span key={id} data-testid={`child-${id}`}>{id}</span>;
    const { getByTestId } = render(
      <ChildList childList={['a', 'b']} context={mockContext} buildChild={buildChild} />
    );
    expect(getByTestId('child-a')).toBeTruthy();
    expect(getByTestId('child-b')).toBeTruthy();
  });

  it('renders children from an object-id list', () => {
    const buildChild = (id: string) => <span key={id} data-testid={`child-${id}`}>{id}</span>;
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
