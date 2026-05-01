// @vitest-environment jsdom
/**
 * Tests for the migrated `BrowserAzureARMConnector` (issue #320 — Wave 2
 * cutover of #237 / DP #194).
 *
 * Drives the connector directly (it is exported from
 * `contexts/APIConnectorContext.tsx`) and asserts that:
 *
 *   - all ARM traffic goes through the canonical `lib/arm/armFetch` wrapper —
 *     absolute `https://management.azure.com` URLs, never `/api/arm-proxy`;
 *   - the legacy `APIConnector.request()` Response shape is preserved,
 *     including the `{ error, code }` envelope on failures so existing UI
 *     error paths keep working unchanged after the shim removal;
 *   - 401 from ARM triggers exactly one token refresh + one retry, after
 *     which the connector reports `isAuthenticated() === false` and emits
 *     the legacy `azure_access_token_missing` envelope;
 *   - list endpoints (`listSubscriptions`, `listResourceGroups`, ...) hit
 *     ARM directly with the api-version embedded in the supplied path
 *     (no double-injection by `armFetch`'s default).
 *
 * Test infra: MSW handlers register against absolute ARM URLs via the
 * shared `arm-msw-server` fixture (Wave-1 rewiring requirement).
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { armMswServer, armUrl, TOKEN_ENDPOINT } from './setup/arm-msw-server';
import { __resetArmTokenForTests } from '../lib/arm/armFetch';
import { BrowserAzureARMConnector } from '../contexts/APIConnectorContext';

beforeAll(() => armMswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  armMswServer.resetHandlers();
  __resetArmTokenForTests();
});
afterAll(() => armMswServer.close());

describe('BrowserAzureARMConnector (issue #320 cutover) — request()', () => {
  it('issues calls to https://management.azure.com (absolute, never /api/arm-proxy)', async () => {
    let observedUrl: string | undefined;
    let observedAuth: string | null = null;

    armMswServer.use(
      http.get(armUrl('/subscriptions/sub-1/resourcegroups/rg-1'), ({ request }) => {
        observedUrl = request.url;
        observedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ id: 'rg-1', name: 'rg-1' });
      }),
    );

    const connector = new BrowserAzureARMConnector();
    const response = await connector.request(
      'GET',
      '/subscriptions/sub-1/resourcegroups/rg-1?api-version=2021-04-01',
    );

    expect(response.status).toBe(200);
    expect(observedUrl).toMatch(
      /^https:\/\/management\.azure\.com\/subscriptions\/sub-1\/resourcegroups\/rg-1/,
    );
    expect(observedUrl).not.toContain('/api/arm-proxy');
    expect(observedAuth).toBe('Bearer msw-default-token');
    expect(connector.isAuthenticated()).toBe(true);
  });

  it('returns the legacy `{ error, code }` Response envelope on ARM errors', async () => {
    armMswServer.use(
      http.get(armUrl('/subscriptions/sub-1/resourcegroups/missing'), () =>
        HttpResponse.json(
          { error: { code: 'ResourceGroupNotFound', message: 'Not found.' } },
          { status: 404 },
        ),
      ),
    );

    const connector = new BrowserAzureARMConnector();
    const response = await connector.request(
      'GET',
      '/subscriptions/sub-1/resourcegroups/missing?api-version=2021-04-01',
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error?: string; code?: string };
    expect(body.code).toBe('ResourceGroupNotFound');
    expect(body.error).toBe('Not found.');
  });

  it('marks itself unauthenticated and returns the legacy auth-error envelope on 2× 401', async () => {
    let armCalls = 0;
    armMswServer.use(
      http.get(armUrl('/subscriptions/sub-1/resourcegroups/x'), () => {
        armCalls += 1;
        return HttpResponse.json(
          { error: { code: 'InvalidAuthenticationToken', message: 'Bad token.' } },
          { status: 401 },
        );
      }),
    );

    const connector = new BrowserAzureARMConnector();
    const response = await connector.request(
      'GET',
      '/subscriptions/sub-1/resourcegroups/x?api-version=2021-04-01',
    );

    // armFetch's contract: at-most-one 401-refresh-retry, so we must see
    // exactly two ARM calls before the connector gives up.
    expect(armCalls).toBe(2);
    expect(response.status).toBe(401);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe('azure_access_token_missing');
    expect(connector.isAuthenticated()).toBe(false);
  });

  it('surfaces network failures as a 502 with the `arm_network_error` code', async () => {
    armMswServer.use(
      http.get(armUrl('/subscriptions/sub-1/resources'), () => HttpResponse.error()),
    );

    const connector = new BrowserAzureARMConnector();
    const response = await connector.request(
      'GET',
      '/subscriptions/sub-1/resources?api-version=2021-04-01',
    );

    expect(response.status).toBe(502);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe('arm_network_error');
  });

  it('serializes JSON bodies on POST (Content-Type set automatically)', async () => {
    let observedBody: unknown;
    let observedContentType: string | null = null;
    armMswServer.use(
      http.post(armUrl('/subscriptions/sub-1/providers/x/resources'), async ({ request }) => {
        observedContentType = request.headers.get('Content-Type');
        observedBody = await request.json();
        return HttpResponse.json({ provisioningState: 'Succeeded' }, { status: 201 });
      }),
    );

    const connector = new BrowserAzureARMConnector();
    const response = await connector.request(
      'POST',
      '/subscriptions/sub-1/providers/x/resources?api-version=2021-04-01',
      { name: 'demo' },
    );

    expect(response.status).toBe(201);
    expect(observedContentType).toBe('application/json');
    expect(observedBody).toEqual({ name: 'demo' });
  });
});

describe('BrowserAzureARMConnector (issue #320 cutover) — list endpoints', () => {
  it('listSubscriptions hits ARM directly and unwraps `{ value: [...] }`', async () => {
    let observedUrl: string | undefined;
    armMswServer.use(
      http.get(armUrl('/subscriptions'), ({ request }) => {
        observedUrl = request.url;
        return HttpResponse.json({
          value: [
            {
              subscriptionId: 'sub-1',
              displayName: 'Demo',
              state: 'Enabled',
              tenantId: 't-1',
            },
          ],
        });
      }),
    );

    const connector = new BrowserAzureARMConnector();
    const subs = await connector.listSubscriptions();

    expect(observedUrl).toMatch(/^https:\/\/management\.azure\.com\/subscriptions\?/);
    // No api-version was double-injected — the path supplied its own.
    expect((observedUrl ?? '').match(/api-version=/g) ?? []).toHaveLength(1);
    expect(subs).toHaveLength(1);
    expect(subs[0].subscriptionId).toBe('sub-1');
  });

  it('listResourceGroups stamps the subscriptionId on every group', async () => {
    armMswServer.use(
      http.get(armUrl('/subscriptions/sub-1/resourcegroups'), () =>
        HttpResponse.json({
          value: [
            { id: '/subscriptions/sub-1/resourceGroups/rg-1', name: 'rg-1', location: 'eastus' },
          ],
        }),
      ),
    );

    const connector = new BrowserAzureARMConnector();
    const groups = await connector.listResourceGroups('sub-1');

    expect(groups).toHaveLength(1);
    expect(groups[0].subscriptionId).toBe('sub-1');
  });

  it('list endpoints surface ARM errors as Error (legacy contract preserved)', async () => {
    armMswServer.use(
      http.get(armUrl('/subscriptions'), () =>
        HttpResponse.json(
          { error: { code: 'BadGateway', message: 'Upstream blew up.' } },
          { status: 502 },
        ),
      ),
    );

    const connector = new BrowserAzureARMConnector();
    await expect(connector.listSubscriptions()).rejects.toThrow(/Upstream blew up\./);
  });
});

describe('BrowserAzureARMConnector (issue #320 cutover) — token endpoint', () => {
  it('uses the canonical /api/azure/token endpoint (never the legacy proxy)', async () => {
    let tokenHits = 0;
    armMswServer.use(
      http.get(TOKEN_ENDPOINT, () => {
        tokenHits += 1;
        return HttpResponse.json({ token: 'fresh-tok' });
      }),
      http.get(armUrl('/subscriptions'), () => HttpResponse.json({ value: [] })),
    );

    const connector = new BrowserAzureARMConnector();
    await connector.listSubscriptions();
    expect(tokenHits).toBeGreaterThanOrEqual(1);
  });
});
