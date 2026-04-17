/**
 * @file fetch_webpage.test.ts
 * @suite Phase C — core.fetch_webpage tool
 *
 * Tests SSRF guards and happy-path fetch behaviour against the real
 * implementation in packages/pack-core/src/tools/fetch_webpage.ts.
 *
 * Global `fetch` is mocked via vi.stubGlobal. Tool is invoked via
 * FunctionTool.invoke(runCtx, jsonInput).
 *
 * NOTE: The @openai/agents SDK wraps execution errors in a string result
 * ("An error occurred while running the tool...") rather than rejecting.
 * Error-case tests check the returned string for the expected error keyword.
 *
 * @depends Phase C of #477 (fetch_webpage.ts must exist)
 * @depends #475 SSRF policy (HTTPS-only, private-IP block)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RunContext } from '@openai/agents';
import { fetchWebpageTool } from '../../tools/fetch_webpage.js';
import { makeSessionCtx } from './_session-stub.js';

vi.mock('node:dns/promises', () => ({
  resolve4: vi.fn().mockResolvedValue(['93.184.216.34']),
  resolve6: vi.fn().mockResolvedValue([]),
}));

import * as dnsPromises from 'node:dns/promises';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: async () => body,
  } as unknown as Response;
}

const invoke = (url: string) =>
  fetchWebpageTool.tool.invoke(new RunContext(makeSessionCtx()), JSON.stringify({ url }));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('core.fetch_webpage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // Default: DNS resolves to non-private IPs so happy-path tests pass without network.
    vi.mocked(dnsPromises.resolve4).mockResolvedValue(['93.184.216.34'] as never);
    vi.mocked(dnsPromises.resolve6).mockResolvedValue([] as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('valid HTTPS URL returns string content', () => {
    it('returns the response body as a string', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        makeResponse('<html><body>Hello world</body></html>'),
      );

      const result = await invoke('https://example.com');

      expect(String(result)).toContain('Hello world');
    });

    it('calls fetch exactly once', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse('content'));
      await invoke('https://example.com/page');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  // ── SSRF guard — non-HTTPS scheme ────────────────────────────────────────

  describe('SSRF guard — HTTP scheme → rejects with error', () => {
    it('http:// URL returns an error result string', async () => {
      const result = String(await invoke('http://example.com'));
      expect(result).toMatch(/An error occurred|HTTPS|https/i);
    });

    it('does not call fetch when scheme is http://', async () => {
      await invoke('http://example.com');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  // ── SSRF guard — private IP ranges ────────────────────────────────────────

  describe('SSRF guard — private IP ranges → reject', () => {
    const privateURLs = [
      'https://127.0.0.1',
      'https://127.1.2.3',
      'https://10.0.0.1',
      'https://10.255.255.255',
      'https://172.16.0.1',
      'https://172.31.255.255',
      'https://192.168.0.1',
      'https://192.168.100.200',
      'https://localhost',
      'https://0.0.0.0',
    ];

    it.each(privateURLs)(
      'returns an error result for private/loopback address: %s',
      async (url) => {
        const result = String(await invoke(url));
        expect(result).toMatch(/An error occurred|private|loopback|block/i);
      },
    );

    it('does not call fetch for private-IP URLs', async () => {
      await invoke('https://192.168.1.1');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  // ── SSRF guard — DNS rebinding ────────────────────────────────────────────

  describe('SSRF guard — DNS rebinding → reject', () => {
    it('blocks URL that resolves to private IP via A record (DNS rebinding)', async () => {
      vi.mocked(dnsPromises.resolve4).mockResolvedValue(['192.168.1.1'] as never);
      vi.mocked(dnsPromises.resolve6).mockResolvedValue([] as never);
      const result = String(await invoke('https://evil-public-domain.com/page'));
      expect(result).toMatch(/An error occurred|private IP|SSRF/i);
    });

    it('blocks URL that resolves to loopback via AAAA record (DNS rebinding)', async () => {
      vi.mocked(dnsPromises.resolve4).mockResolvedValue([] as never);
      vi.mocked(dnsPromises.resolve6).mockResolvedValue(['::1'] as never);
      const result = String(await invoke('https://evil-public-domain.com/page'));
      expect(result).toMatch(/An error occurred|private IP|SSRF/i);
    });

    it('does not call fetch when DNS rebinding is detected', async () => {
      vi.mocked(dnsPromises.resolve4).mockResolvedValue(['10.0.0.1'] as never);
      vi.mocked(dnsPromises.resolve6).mockResolvedValue([] as never);
      await invoke('https://evil-public-domain.com/page');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  // ── Invalid URL format ────────────────────────────────────────────────────

  describe('invalid URL format → Zod error', () => {
    it('returns an error result for a plain string that is not a URL', async () => {
      const result = String(await invoke('not-a-url'));
      // Zod url() validation fails → SDK error string
      expect(result).toMatch(/An error occurred|invalid/i);
    });
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe('ToolContribution shape', () => {
    it('SDK tool name is core_fetch_webpage (dots normalized to underscores)', () => {
      expect(fetchWebpageTool.tool.name).toBe('core_fetch_webpage');
    });

    it('ToolContribution logical name is core.fetch_webpage', () => {
      expect(fetchWebpageTool.name).toBe('core.fetch_webpage');
    });
  });
});
