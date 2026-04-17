import { tool } from '@openai/agents';
import { z } from 'zod';
import * as dnsPromises from 'node:dns/promises';
import type { ToolContribution } from '@kickstart/harness';
import type { SessionCtx } from '@kickstart/harness';

// ── SSRF guard ────────────────────────────────────────────────────────────────

const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^localhost$/i,
  /^0\.0\.0\.0/,
  /^169\.254\./, // link-local
];

// Covers DNS rebinding: even a public hostname is rejected if it resolves to a private IP.
const PRIVATE_IP_RE =
  /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|0\.0\.0\.0$|169\.254\.)/;

function isPrivateOrLoopback(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

async function resolveAndCheckHostname(hostname: string): Promise<void> {
  const v4 = await dnsPromises.resolve4(hostname).catch(() => [] as string[]);
  const v6 = await dnsPromises.resolve6(hostname).catch(() => [] as string[]);
  for (const addr of [...v4, ...v6]) {
    if (PRIVATE_IP_RE.test(addr)) {
      throw new Error(`URL resolves to private IP address (${addr}) — SSRF blocked`);
    }
  }
}

function assertSafeUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`fetch_webpage only allows HTTPS URLs (got ${parsed.protocol})`);
  }

  if (isPrivateOrLoopback(parsed.hostname)) {
    throw new Error(`fetch_webpage blocks requests to private/loopback addresses: ${parsed.hostname}`);
  }

  return parsed;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const FetchWebpageInputSchema = z.object({
  url: z.string().url().describe('The HTTPS URL to fetch. Private IP ranges and non-HTTPS URLs are rejected.'),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const fetchWebpageTool: ToolContribution = {
  name: 'core.fetch_webpage',
  tool: tool({
    name: 'core.fetch_webpage',
    description:
      'Fetches an HTTPS URL and returns the page body as plain text (markdown where possible). ' +
      'Blocks non-HTTPS URLs and private IP ranges (SSRF guard). ' +
      'Use this to retrieve current Azure documentation, CNCF best-practice articles, or architecture reference material.',
    parameters: FetchWebpageInputSchema,
    execute: async (input, runCtx) => {
      const _session = runCtx?.context as SessionCtx | undefined;

      const safeUrl = assertSafeUrl(input.url);

      await resolveAndCheckHostname(safeUrl.hostname);

      const response = await fetch(safeUrl.toString(), {
        headers: {
          'Accept': 'text/html,text/markdown,text/plain,*/*',
          'User-Agent': 'Kickstart/2 (https://github.com/sabbour/kickstart)',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`fetch_webpage: HTTP ${response.status} ${response.statusText} for ${safeUrl.hostname}`);
      }

      const body = await response.text();

      // Trim to a reasonable length so the response fits in a model context window.
      const MAX_CHARS = 32_000;
      if (body.length > MAX_CHARS) {
        return body.slice(0, MAX_CHARS) + '\n\n[…content truncated at 32 000 chars…]';
      }

      return body;
    },
  }),
};
