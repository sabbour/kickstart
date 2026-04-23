/**
 * Regression tests for #984 — A2UI v0.9 spec alignment (clean break, PR #989).
 *
 * Coverage:
 *
 * 1. A spec-compliant v0.9 envelope (Column → Row → Buttons with Text children
 *    + action.event.name) survives validation and preserves every hierarchy
 *    field. This is the shape the LLM MUST emit.
 *
 * 2. Lone Row / Column / List (no children) do NOT become `_ErrorComponent` —
 *    the renderer tolerates empty containers mid-stream.
 *
 * 3. Legacy dialect envelopes (`label` / `onClick` on a Button, etc.) are
 *    REJECTED: the component is replaced with `_ErrorComponent` and a
 *    `[A2UIRegistry]` console.error names the offending property. There is
 *    no translation layer — producers must fix the envelope.
 *
 * Spec: https://a2ui.org/specification/v0.9-a2ui/
 */

import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import {
  ClientComponentRegistry,
  validateAndSanitizeComponents,
} from '../contexts/A2UIRegistryContext';
import { fluentOverrides } from '../catalog/fluent-components';

let registry: ClientComponentRegistry;

beforeAll(() => {
  registry = new ClientComponentRegistry();
  for (const impl of fluentOverrides) registry.register(impl);
  registry.seal();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Lone containers — Bug 1 lock-in
// ---------------------------------------------------------------------------

describe('#984 — lone containers do NOT become _ErrorComponent', () => {
  it.each(['Row', 'Column', 'List'])('%s emitted alone resolves to itself', (name) => {
    const result = validateAndSanitizeComponents(
      [{ id: 'root', component: name }],
      registry,
    );
    expect(result[0].component).toBe(name);
  });
});

// ---------------------------------------------------------------------------
// Spec-compliant v0.9 envelope — Bug 2 lock-in (the "fixed" shape)
// ---------------------------------------------------------------------------

describe('#984 — fully spec-compliant v0.9 envelope survives validation', () => {
  const SPEC_PAYLOAD = [
    { id: 'root', component: 'Column', children: ['title', 'row1'] },
    { id: 'title', component: 'Text', text: 'What do you want to do?' },
    { id: 'row1', component: 'Row', children: ['btn-plan', 'btn-review', 'btn-build'] },
    { id: 'btn-plan',   component: 'Button', child: 'txt-plan',
      action: { event: { name: 'plan' } } },
    { id: 'txt-plan',   component: 'Text', text: 'Plan the app' },
    { id: 'btn-review', component: 'Button', child: 'txt-review',
      action: { event: { name: 'review' } } },
    { id: 'txt-review', component: 'Text', text: 'Review an existing design' },
    { id: 'btn-build',  component: 'Button', child: 'txt-build',
      action: { event: { name: 'build' } } },
    { id: 'txt-build',  component: 'Text', text: 'Generate implementation files' },
  ];

  it('no entry becomes _ErrorComponent', () => {
    const result = validateAndSanitizeComponents(SPEC_PAYLOAD, registry);
    const errors = result.filter((c) => c.component === '_ErrorComponent');
    expect(errors).toEqual([]);
  });

  it('children / child / text / action survive the pipeline', () => {
    const result = validateAndSanitizeComponents(SPEC_PAYLOAD, registry);
    expect((result[0] as Record<string, unknown>).children).toEqual(['title', 'row1']);
    expect((result[1] as Record<string, unknown>).text).toBe('What do you want to do?');
    expect((result[2] as Record<string, unknown>).children).toEqual(['btn-plan', 'btn-review', 'btn-build']);
    expect((result[3] as Record<string, unknown>).child).toBe('txt-plan');
    const btnAction = (result[3] as Record<string, unknown>).action as { event: { name: string } } | undefined;
    expect(btnAction?.event.name).toBe('plan');
  });
});

// ---------------------------------------------------------------------------
// Clean break — legacy dialect is rejected, not translated
// ---------------------------------------------------------------------------

describe('#984 — legacy dialect is rejected (no back-compat shim)', () => {
  it('Button with `label` + `onClick` becomes _ErrorComponent and logs the non-spec keys', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = validateAndSanitizeComponents(
      [{ id: 'btn1', component: 'Button', label: 'Plan the app', onClick: 'plan' }],
      registry,
    );
    expect(result).toHaveLength(1);
    expect(result[0].component).toBe('_ErrorComponent');
    expect(err).toHaveBeenCalled();
    const msg = err.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(msg).toContain('btn1');
    expect(msg).toContain('Button');
    // The offending key must appear in the error message so producers can fix it.
    expect(msg).toMatch(/label|onClick/);
  });
});
