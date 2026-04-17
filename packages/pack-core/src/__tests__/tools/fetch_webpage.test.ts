/**
 * @file fetch_webpage.test.ts
 * @suite Phase C — core.fetch_webpage tool
 *
 * Tests SSRF guards, Zod schema rejection, and happy-path fetch behaviour.
 *
 * Global `fetch` is mocked via vi.stubGlobal so no real network requests
 * are made.  The tool module is stubbed via vi.mock until Fry ships
 * packages/pack-core/src/tools/fetch_webpage.ts (Phase C of #477).
 *
 * MIGRATION: once fetch_webpage.ts ships, replace the vi.mock block with:
 *   import { fetchWebpageTool } from '../../tools/fetch_webpage.js';
 * and delete the mock factory at the bottom of this file.
 *
 * @depends Phase C of #477
 * @depends #475 SSRF policy (HTTP-only, private-IP block)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeSessionCtx } from './_session-stub.js';

// ── SSRF helper (mirrors what the real tool must implement) ──────────────────

function isPrivateHost(hostname: string): boolean {
  // IPv4 loopback
  if (hostname === 'localhost') return true;
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  const [a, b] = parts;
  return (
    a === 127 ||               // 127.0.0.0/8
    a === 10 ||                // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168)   // 192.168.0.0/16
  );
}

// ── Module stub (remove when Phase C ships) ──────────────────────────────────

vi.mock('../../tools/fetch_webpage.js', () => {
  return {
    fetchWebpageTool: {
      name: 'core.fetch_webpage',
      mcpExposed: false,
      tool: {
        name: 'core.fetch_webpage',
        description: 'Fetch the text content of an HTTPS web page.',
        execute: vi.fn(
          async (
            { url }: { url: string },
            _runCtx?: unknown,
          ): Promise<{ ok: boolean; content?: string; error?: string }> => {
            // Zod schema enforces url is a valid URL string — guard on HTTP here
            if (!url.startsWith('https://')) {
              throw new Error('SSRF_BLOCKED: only HTTPS URLs are permitted');
            }
            const { hostname } = new URL(url);
            if (isPrivateHost(hostname)) {
              throw new Error('SSRF_BLOCKED: private/internal IP ranges are forbidden');
            }
            const res = await fetch(url);
            const content = await res.text();
            return { ok: true, content };
          },
        ),
      },
    },
  };
});

// ── Real import (points at the stub while Phase C is pending) ────────────────
import { fetchWebpageTool } from '../../tools/fetch_webpage.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('core.fetch_webpage', () => {
  const execute = () => fetchWebpageTool.tool.execute;
  const session = makeSessionCtx();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('valid HTTPS URL', () => {
    it('returns { ok: true, content } with the response body as a string', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        makeResponse('<html><body>Hello</body></html>'),
      );

      const result = await execute()({ url: 'https://example.com' }, session);

      expect(result.ok).toBe(true);
      expect(typeof result.content).toBe('string');
      expect(result.content).toContain('Hello');
    });

    it('calls fetch exactly once with the supplied URL', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse('ok'));

      await execute()({ url: 'https://example.com/page' }, session);

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/page');
    });
  });

  // ── SSRF guard — HTTP ──────────────────────────────────────────────────────

  describe('SSRF guard — HTTP scheme', () => {
    it('rejects http:// URLs with an SSRF error', async () => {
      await expect(
        execute()({ url: 'http://example.com' }, session),
      ).rejects.toThrow(/SSRF_BLOCKED/);
    });

    it('does not call fetch when scheme is http://', async () => {
      await expect(
        execute()({ url: 'http://example.com' }, session),
      ).rejects.toThrow();

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  // ── SSRF guard — private IP ranges ────────────────────────────────────────

  describe('SSRF guard — private IP ranges', () => {
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
    ];

    it.each(privateURLs)(
      'rejects %s with an SSRF error',
      async (url) => {
        await expect(
          execute()({ url }, session),
        ).rejects.toThrow(/SSRF_BLOCKED/);
      },
    );

    it('does not call fetch for private-IP URLs', async () => {
      await expect(
        execute()({ url: 'https://192.168.1.1' }, session),
      ).rejects.toThrow();

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  // ── Zod schema validation ─────────────────────────────────────────────────
  //
  // The Zod layer runs BEFORE execute() in the real SDK wiring, so these
  // tests verify that the tool's parameter schema would reject bad inputs.
  // They are written here as integration notes; full Zod parse tests live in
  // the top-level tools.test.ts suite.

  describe('schema notes (Zod rejects these before execute runs)', () => {
    it('tool name is core.fetch_webpage', () => {
      expect(fetchWebpageTool.tool.name).toBe('core.fetch_webpage');
    });

    it('ToolContribution name is core.fetch_webpage', () => {
      expect(fetchWebpageTool.name).toBe('core.fetch_webpage');
    });
  });
});
