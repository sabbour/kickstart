/**
 * Unit tests for the SDK-path HTTP 406 non-streaming fallback.
 *
 * _performSdkNonStreamingFetch is extracted from useStreaming so it can be
 * exercised without a React rendering context or requestAnimationFrame.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { A2uiPayloadItem } from '../types';
import { _performSdkNonStreamingFetch } from '../hooks/useStreaming';

describe('_performSdkNonStreamingFetch (SDK 406 fallback)', () => {
  const mockApiFetch = vi.fn();

  beforeEach(() => mockApiFetch.mockReset());

  it('fires onPhase with a known phase and onA2UI with type-checked items only', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessionId: 'sess-abc',
        phase: 'design',
        message: 'Here is the design.',
        model: 'gpt-4o',
        a2ui: [
          { version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: 'c1' } },
          null,            // invalid — must be filtered
          'bad-string',    // invalid — must be filtered
          42,              // invalid — must be filtered
        ],
      }),
    });

    const onPhase = vi.fn();
    const onA2UI = vi.fn();
    const debugMsgs: A2uiPayloadItem[] = [];

    const result = await _performSdkNonStreamingFetch(
      {
        sessionId: 'sess-abc',
        message: 'hello',
        clientMessages: undefined,
        signal: new AbortController().signal,
        debugMode: false,
      },
      { onPhase, onA2UI },
      debugMsgs,
      mockApiFetch as any,
    );

    expect(onPhase).toHaveBeenCalledOnce();
    expect(onPhase).toHaveBeenCalledWith('design');

    expect(onA2UI).toHaveBeenCalledOnce();
    const a2uiItems = onA2UI.mock.calls[0][0] as A2uiPayloadItem[];
    expect(a2uiItems).toHaveLength(1);
    expect(a2uiItems[0]).toMatchObject({ version: 'v0.9' });

    expect(result.text).toBe('Here is the design.');
    expect(result.model).toBe('gpt-4o');
    expect(result.sessionId).toBe('sess-abc');
  });

  it('ignores unrecognised server-emitted phases and does not call onPhase', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ phase: 'evil-unknown-phase', message: '' }),
    });

    const onPhase = vi.fn();

    await _performSdkNonStreamingFetch(
      { sessionId: undefined, message: 'hi', clientMessages: undefined, signal: new AbortController().signal, debugMode: false },
      { onPhase, onA2UI: vi.fn() },
      [],
      mockApiFetch as any,
    );

    expect(onPhase).not.toHaveBeenCalled();
  });

  it('throws when the fallback fetch responds with a non-OK status', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(
      _performSdkNonStreamingFetch(
        { sessionId: undefined, message: 'hi', clientMessages: undefined, signal: new AbortController().signal, debugMode: false },
        { onPhase: vi.fn(), onA2UI: vi.fn() },
        [],
        mockApiFetch as any,
      ),
    ).rejects.toThrow('API error: 500');
  });

  it('does not call onA2UI when a2ui is absent from the response', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ phase: 'generate', message: 'Processing...' }),
    });

    const onA2UI = vi.fn();

    const result = await _performSdkNonStreamingFetch(
      { sessionId: 'x', message: 'go', clientMessages: undefined, signal: new AbortController().signal, debugMode: false },
      { onPhase: vi.fn(), onA2UI },
      [],
      mockApiFetch as any,
    );

    expect(onA2UI).not.toHaveBeenCalled();
    expect(result.text).toBe('Processing...');
  });
});
