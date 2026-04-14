import { describe, it, expect } from 'vitest';
import { parseHash } from '../hooks/useNavigation';

describe('parseHash', () => {
  it('returns landing for empty string', () => {
    expect(parseHash('')).toEqual({ view: 'landing' });
  });

  it('returns landing for bare hash', () => {
    expect(parseHash('#')).toEqual({ view: 'landing' });
  });

  it('returns landing for unrecognised hash', () => {
    expect(parseHash('#random')).toEqual({ view: 'landing' });
  });

  it('parses session hash', () => {
    expect(parseHash('#session/abc-123')).toEqual({
      view: 'session',
      sessionId: 'abc-123',
    });
  });

  it('parses session hash with complex id', () => {
    expect(parseHash('#session/session-1713100000000-a1b2c3')).toEqual({
      view: 'session',
      sessionId: 'session-1713100000000-a1b2c3',
    });
  });

  it('returns landing for partial session path', () => {
    expect(parseHash('#session/')).toEqual({ view: 'landing' });
  });

  it('returns landing for session without slash', () => {
    expect(parseHash('#session')).toEqual({ view: 'landing' });
  });
});
