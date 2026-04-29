/**
 * Golden E2E test fixture — deterministic SSE replay with hermetic network.
 *
 * Provides:
 * - Default-deny outbound network (all non-localhost requests abort)
 * - SSE fixture replay for /api/converse
 * - Mock MSAL auth
 * - Fixture loading by track name
 */
import { test as base, type Page, type Route } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FixtureMeta {
  recorded_at: string;
  model_version: string;
  prompt_hash: string;
  tool_schema_hash: string;
  track: string;
}

export interface SSEEvent {
  event?: string;
  data: string;
}

export interface PhaseFixture {
  phase: string;
  request_summary: string;
  sse_events: SSEEvent[];
}

export type TrackName = 'web-app' | 'agentic-foundry' | 'agentic-kaito' | 'existing-repo-uplift';

/* ------------------------------------------------------------------ */
/*  Fixture helpers                                                    */
/* ------------------------------------------------------------------ */

const FIXTURES_ROOT = path.join(__dirname, 'fixtures', 'golden');
const ALLOWED_ORIGINS = ['localhost', '127.0.0.1', '0.0.0.0'];

function fixtureDir(track: TrackName): string {
  return path.join(FIXTURES_ROOT, track);
}

export function loadFixtureMeta(track: TrackName): FixtureMeta {
  const metaPath = path.join(fixtureDir(track), '_meta.json');
  return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
}

export function loadPhaseFixtures(track: TrackName): PhaseFixture[] {
  const dir = fixtureDir(track);
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('phase-') && f.endsWith('.json'))
    .sort();
  return files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}

/**
 * Convert SSE events into a text/event-stream body string.
 */
function sseBody(events: SSEEvent[]): string {
  return events.map(e => {
    let chunk = '';
    if (e.event) chunk += `event: ${e.event}\n`;
    chunk += `data: ${e.data}\n\n`;
    return chunk;
  }).join('');
}

/**
 * Check fixture freshness. Returns null if fresh, error string if stale.
 */
export function checkFreshness(meta: FixtureMeta, maxAgeDays = 30): string | null {
  const recorded = new Date(meta.recorded_at);
  const now = new Date();
  const ageDays = (now.getTime() - recorded.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > maxAgeDays) {
    return `Fixture for track "${meta.track}" is ${Math.floor(ageDays)} days old (max ${maxAgeDays}). Re-record with: npm run golden:record -- --track=${meta.track}`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Scrub validation — ensure no secrets in fixture content            */
/* ------------------------------------------------------------------ */

const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9_]{36,}/,
  /ghs_[A-Za-z0-9_]{36,}/,
  /github_pat_[A-Za-z0-9_]{22,}/,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\sKEY-----/,
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, // UUIDs that should be scrubbed
];

export function validateNoSecrets(content: string): string[] {
  const violations: string[] = [];
  for (const pattern of SECRET_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      // Allow the known scrubbed placeholder UUIDs
      if (match[0] === '00000000-0000-0000-0000-000000000000') continue;
      if (match[0] === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') continue;
      violations.push(`Potential secret found matching pattern: ${pattern.source}`);
    }
  }
  return violations;
}

/* ------------------------------------------------------------------ */
/*  Playwright fixture                                                 */
/* ------------------------------------------------------------------ */

type GoldenFixtures = {
  goldenTrack: TrackName;
  goldenSetup: void;
};

/**
 * Create a golden test fixture for a specific track.
 * Sets up hermetic network, SSE replay, and mock auth.
 */
export function createGoldenTest(track: TrackName) {
  return base.extend<GoldenFixtures>({
    goldenTrack: [track, { option: true }],

    goldenSetup: [async ({ page }, use) => {
      const fixtures = loadPhaseFixtures(track);
      let fixtureIndex = 0;

      // ── 1. Default-deny outbound network (hermetic mode) ──────────
      // This MUST be registered first — Playwright routes match LIFO,
      // so specific intercepts registered later take priority.
      await page.route('**/*', async (route: Route) => {
        const url = new URL(route.request().url());
        const isAllowed = ALLOWED_ORIGINS.some(o => url.hostname === o || url.hostname.endsWith(`.${o}`));
        if (isAllowed) {
          await route.fallthrough();
        } else {
          const msg = `[HERMETIC] Blocked outbound request to: ${url.href}`;
          console.error(msg);
          await route.abort('blockedbyclient');
        }
      });

      // ── 2. Mock MSAL auth ─────────────────────────────────────────
      await page.route('**/msal-browser*', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: `
            window.msal = {
              PublicClientApplication: class {
                async handleRedirectPromise() { return null; }
                getAllAccounts() { return []; }
                async loginPopup() { return { account: { name: 'Test User', username: 'test@example.com' } }; }
                async logoutPopup() {}
                async acquireTokenSilent() { return { accessToken: 'mock-token' }; }
                async acquireTokenPopup() { return { accessToken: 'mock-token' }; }
              },
            };
          `,
        }),
      );

      // ── 3. Block auth redirects ────────────────────────────────────
      await page.route('**/.auth/**', route => route.abort());

      // ── 4. SSE fixture replay for /api/converse ────────────────────
      await page.route('**/api/converse**', async (route: Route) => {
        if (fixtureIndex >= fixtures.length) {
          await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: 'event: done\ndata: {"status":"complete"}\n\n',
          });
          return;
        }

        const fixture = fixtures[fixtureIndex++];
        const body = sseBody(fixture.sse_events);

        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          headers: {
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Golden-Phase': fixture.phase,
          },
          body,
        });
      });

      // ── 5. Catch-all for other API routes ──────────────────────────
      await page.route('**/api/**', async (route: Route) => {
        const url = route.request().url();
        // Allow converse (handled above via LIFO)
        if (url.includes('/api/converse')) {
          await route.fallthrough();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ mock: true }),
        });
      });

      await use();
    }, { auto: true }],
  });
}

export { expect } from '@playwright/test';
