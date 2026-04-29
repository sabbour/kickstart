/**
 * Zod v4 migration equivalence tests for packages/web.
 *
 * Verifies that the migrated schemas preserve the null-rejection behaviour
 * enforced by the v3 `z.preprocess` callsites, per Zapp's DR conditions.
 *
 * Test matrix (per callsite group):
 *   null / undefined / empty-string / NaN-coerce / Infinity / valid
 */

import { describe, expect, it } from 'vitest';
import {
  AddApi,
  SubtractApi,
  MultiplyApi,
  DivideApi,
  GreaterThanApi,
  LessThanApi,
  ContainsApi,
  StartsWithApi,
  EndsWithApi,
  RegexApi,
  EmailApi,
  LengthApi,
  NumericApi,
  FormatNumberApi,
  FormatCurrencyApi,
  PluralizeApi,
  OpenUrlApi,
} from '../vendor/a2ui/web_core/basic_catalog/functions/basic_functions_api.js';

// ---------------------------------------------------------------------------
// Group 1 — numeric null-coerce callsites (AddApi.a/b as representative)
// Zapp condition: rejects null, undefined, empty-string, NaN; accepts numbers.
// ---------------------------------------------------------------------------

describe('numeric null-coerce fields (Zod v4 migration)', () => {
  const schema = AddApi.schema;

  it('rejects null', () => {
    expect(() => schema.parse({ a: null, b: 1 })).toThrow();
    expect(() => schema.parse({ a: 1, b: null })).toThrow();
  });

  it('rejects undefined', () => {
    expect(() => schema.parse({ a: undefined, b: 1 })).toThrow();
    expect(() => schema.parse({ a: 1, b: undefined })).toThrow();
  });

  it('rejects empty string for numeric', () => {
    expect(() => schema.parse({ a: '', b: 1 })).toThrow();
    expect(() => schema.parse({ a: 1, b: '' })).toThrow();
  });

  it('rejects NaN coerce', () => {
    expect(() => schema.parse({ a: 'not-a-number', b: 1 })).toThrow();
    expect(() => schema.parse({ a: 1, b: 'not-a-number' })).toThrow();
  });

  it('accepts valid numbers', () => {
    expect(schema.parse({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
    expect(schema.parse({ a: -3.5, b: 0 })).toEqual({ a: -3.5, b: 0 });
  });

  it('coerces numeric strings', () => {
    expect(schema.parse({ a: '42', b: '7' })).toEqual({ a: 42, b: 7 });
  });

  it('rejects Infinity', () => {
    const result = schema.safeParse({ a: Infinity, b: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects -Infinity', () => {
    const result = schema.safeParse({ a: -Infinity, b: 1 });
    expect(result.success).toBe(false);
  });
});

// Spot-check remaining arithmetic schemas share the same pattern
describe('arithmetic schema null-rejection spot-check', () => {
  const cases = [
    { label: 'SubtractApi', schema: SubtractApi.schema },
    { label: 'MultiplyApi', schema: MultiplyApi.schema },
    { label: 'DivideApi', schema: DivideApi.schema },
    { label: 'GreaterThanApi', schema: GreaterThanApi.schema },
    { label: 'LessThanApi', schema: LessThanApi.schema },
  ] as const;

  for (const { label, schema } of cases) {
    it(`${label} rejects null`, () => expect(() => schema.parse({ a: null, b: 1 })).toThrow());
    it(`${label} rejects undefined`, () =>
      expect(() => schema.parse({ a: undefined, b: 1 })).toThrow());
    it(`${label} rejects empty string for numeric`, () =>
      expect(() => schema.parse({ a: '', b: 1 })).toThrow());
    it(`${label} rejects NaN coerce`, () =>
      expect(() => schema.parse({ a: 'NaN', b: 1 })).toThrow());
    it(`${label} accepts valid`, () =>
      expect(schema.parse({ a: 3, b: 4 })).toEqual({ a: 3, b: 4 }));
  }
});

// ---------------------------------------------------------------------------
// Group 2 — string-coerce callsites
// Zapp condition: rejects undefined; accepts null (returns "null"); coerces others.
// ---------------------------------------------------------------------------

describe('string-coerce fields (Zod v4 migration)', () => {
  it('ContainsApi rejects undefined string', () =>
    expect(() => ContainsApi.schema.parse({ string: undefined, substring: 'x' })).toThrow());

  it('ContainsApi accepts null as "null" string', () => {
    const r = ContainsApi.schema.parse({ string: null, substring: 'n' });
    expect(r.string).toBe('null');
  });

  it('ContainsApi coerces number to string', () => {
    const r = ContainsApi.schema.parse({ string: 42, substring: '4' });
    expect(r.string).toBe('42');
  });

  it('StartsWithApi rejects undefined', () =>
    expect(() => StartsWithApi.schema.parse({ string: undefined, prefix: 'x' })).toThrow());

  it('EndsWithApi rejects undefined', () =>
    expect(() => EndsWithApi.schema.parse({ string: undefined, suffix: 'x' })).toThrow());

  it('RegexApi rejects undefined', () =>
    expect(() => RegexApi.schema.parse({ value: undefined, pattern: '.*' })).toThrow());

  it('EmailApi rejects undefined', () =>
    expect(() => EmailApi.schema.parse({ value: undefined })).toThrow());

  it('OpenUrlApi rejects undefined', () =>
    expect(() => OpenUrlApi.schema.parse({ url: undefined })).toThrow());

  it('OpenUrlApi accepts string', () =>
    expect(OpenUrlApi.schema.parse({ url: 'https://example.com' })).toEqual({
      url: 'https://example.com',
    }));
});

// ---------------------------------------------------------------------------
// Group 3 — optional numeric fields (LengthApi, NumericApi, FormatNumberApi)
// ---------------------------------------------------------------------------

describe('optional numeric fields (Zod v4 migration)', () => {
  it('LengthApi min/max: undefined passes through', () => {
    const r = LengthApi.schema.parse({ value: 'hello', min: 1 });
    expect(r.max).toBeUndefined();
  });

  it('LengthApi min/max: null is rejected', () => {
    expect(() => LengthApi.schema.parse({ value: 'hello', min: null })).toThrow();
  });

  it('LengthApi min/max: empty string is rejected', () => {
    expect(() => LengthApi.schema.parse({ value: 'hello', min: '' })).toThrow();
  });

  it('LengthApi min/max: NaN string is rejected', () => {
    expect(() => LengthApi.schema.parse({ value: 'hello', min: 'bad' })).toThrow();
  });

  it('NumericApi value: rejects null', () =>
    expect(() => NumericApi.schema.parse({ value: null, min: 0 })).toThrow());

  it('NumericApi value: rejects undefined', () =>
    expect(() => NumericApi.schema.parse({ value: undefined, min: 0 })).toThrow());

  it('NumericApi value: rejects empty string', () =>
    expect(() => NumericApi.schema.parse({ value: '', min: 0 })).toThrow());

  it('NumericApi value: rejects NaN coerce', () =>
    expect(() => NumericApi.schema.parse({ value: 'abc', min: 0 })).toThrow());

  it('FormatNumberApi value: rejects null', () =>
    expect(() => FormatNumberApi.schema.parse({ value: null })).toThrow());

  it('FormatNumberApi decimals: undefined passes through', () => {
    const r = FormatNumberApi.schema.parse({ value: 3.14 });
    expect(r.decimals).toBeUndefined();
  });

  it('PluralizeApi value: rejects null', () =>
    expect(() => PluralizeApi.schema.parse({ value: null, other: 'items' })).toThrow());

  it('FormatCurrencyApi value: rejects null', () =>
    expect(() =>
      FormatCurrencyApi.schema.parse({ value: null, currency: 'USD' }),
    ).toThrow());
});

// ---------------------------------------------------------------------------
// Group 4 — per-callsite null-rejection for optionalNumericField callsites
// Zapp condition: explicit per-callsite assertions even though optionalNumericField
// is functionally safe — each site must be independently verified.
// ---------------------------------------------------------------------------

describe('optionalNumericField per-callsite null-rejection (Zod v4 migration)', () => {
  it('rejects null at LengthApi.max', () => {
    expect(() => LengthApi.schema.parse({ value: 'hello', min: 1, max: null })).toThrow();
  });

  it('rejects null at NumericApi.min', () => {
    expect(() => NumericApi.schema.parse({ value: 5, min: null, max: 10 })).toThrow();
  });

  it('rejects null at NumericApi.max', () => {
    expect(() => NumericApi.schema.parse({ value: 5, min: 0, max: null })).toThrow();
  });

  it('rejects null at FormatNumberApi.decimals', () => {
    expect(() => FormatNumberApi.schema.parse({ value: 3.14, decimals: null })).toThrow();
  });

  it('rejects null at FormatCurrencyApi.decimals', () => {
    expect(() =>
      FormatCurrencyApi.schema.parse({ value: 9.99, currency: 'USD', decimals: null }),
    ).toThrow();
  });
});
