/**
 * MSW (Mock Service Worker) server fixture for ARM tests.
 *
 * Registers handlers against **absolute** ARM URLs (`https://management.azure.com/...`)
 * — the Wave-1 rewiring required by issue #318. The legacy `/api/arm-proxy/...`
 * relative-path matchers are gone; new ARM tests must use absolute URLs.
 *
 * Usage in a test file:
 *
 * ```ts
 * import { armMswServer, armUrl } from '../../__tests__/setup/arm-msw-server';
 * import { http, HttpResponse } from 'msw';
 *
 * beforeAll(() => armMswServer.listen({ onUnhandledRequest: 'error' }));
 * afterEach(() => armMswServer.resetHandlers());
 * afterAll(() => armMswServer.close());
 *
 * armMswServer.use(
 *   http.get(armUrl('/subscriptions'), () => HttpResponse.json({ value: [] })),
 * );
 * ```
 *
 * The fixture also ships a default `/api/azure/token` handler so tests don't
 * have to depend on the API endpoint shipped in #317.
 */

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const ARM_BASE_URL = 'https://management.azure.com';
export const TOKEN_ENDPOINT = '/api/azure/token';

/** Build an absolute ARM URL for an MSW handler. */
export function armUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${ARM_BASE_URL}${normalized}`;
}

/** Default token endpoint handler — overridable per test via `server.use(...)`. */
export const defaultTokenHandler = http.get(TOKEN_ENDPOINT, () =>
  HttpResponse.json({ token: 'msw-default-token', expiresAt: new Date(Date.now() + 3600_000).toISOString() }),
);

export const armMswServer = setupServer(defaultTokenHandler);
