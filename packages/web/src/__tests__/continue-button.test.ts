import { describe, it, expect } from 'vitest';
import { getBestGuessIndex } from '../catalog/fluent-components/ChoicePicker';

describe('getBestGuessIndex', () => {
  const options = [
    { label: 'Node.js', value: 'nodejs' },
    { label: 'Python', value: 'python' },
    { label: '.NET', value: 'dotnet' },
  ];

  it('returns 0 when no message text is provided', () => {
    expect(getBestGuessIndex(options, '')).toBe(0);
  });

  it('returns 0 (first option) when message text does not mention any option', () => {
    expect(getBestGuessIndex(options, 'Pick any runtime you like.')).toBe(0);
  });

  it('matches an option mentioned in the message text', () => {
    expect(getBestGuessIndex(options, 'I recommend Python for this project.')).toBe(1);
  });

  it('matches case-insensitively', () => {
    expect(getBestGuessIndex(options, 'We suggest using NODE.JS here.')).toBe(0);
  });

  it('returns the first matching option when multiple are mentioned', () => {
    expect(getBestGuessIndex(options, 'Both Python and .NET work well.')).toBe(1);
  });

  it('returns -1 when options array is empty', () => {
    expect(getBestGuessIndex([], 'anything')).toBe(-1);
  });

  it('handles non-string label values gracefully', () => {
    const opts = [{ label: { path: 'foo' } as unknown, value: 'a' }] as Array<{ label: unknown; value: string }>;
    expect(getBestGuessIndex(opts, 'some text')).toBe(0);
  });
});
