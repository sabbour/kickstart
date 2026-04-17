/**
 * Route state E2E tests — server-authored phase consumption.
 *
 * These tests exercise the less-rigid chat behaviors by intercepting /api/converse
 * and returning crafted SSE responses with explicit server-emitted phases.
 * They verify that:
 * 1. Skip-ahead: the phase indicator jumps forward to the server-emitted phase
 * 2. Revisit: the phase indicator goes backward when the server revisits an earlier phase
 *
 * Unlike other E2E tests, these do NOT use ?mock mode — they exercise the real
 * useStreaming.ts SSE parser path with mocked API responses.
 */

import { test, expect } from './helpers';

// ---------------------------------------------------------------------------
// SSE response builders
// ---------------------------------------------------------------------------

function sseResponse(message: string, phase: string, phaseLabel: string, sessionId: string): string {
  return [
    'event: message',
    `data: ${JSON.stringify({ content: message })}`,
    '',
    'event: done',
    `data: ${JSON.stringify({ sessionId, phase, phaseLabel, model: 'test' })}`,
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Register routes that let the real streaming path succeed:
 * - /api/health → 200 (makes isApiAvailable=true so messages are sent)
 * - /api/converse → caller-supplied fulfillment
 *
 * These registrations take precedence over the auto-fixture's *\/api\/** → 503
 * because Playwright matches routes in LIFO order.
 */
async function setupHealthRoute(page: Parameters<typeof test>[1]['page']) {
  await page.route('**/api/health', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Route state — server-authored phase consumption', () => {
  test('skip-ahead: phase indicator jumps to server-emitted phase', async ({ page }) => {
    // Health check must return 200 so isApiAvailable becomes true
    await setupHealthRoute(page);

    // Single converse response: server emits phase "deploy" directly (skip-ahead)
    await page.route('**/api/converse', route =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        body: sseResponse(
          'Your requirements are clear — skipping ahead to deployment!',
          'deploy',
          'Deploy',
          'route-test-skip',
        ),
      }),
    );

    // Register the health-response waiter BEFORE goto to avoid the race where
    // the response fires before the listener is attached.
    const healthReady = page.waitForResponse('**/api/health', { timeout: 10_000 });
    await page.goto('/');
    await page.waitForSelector('#landing-page', { timeout: 10_000 });
    await healthReady;

    // Enter chat via track card (auto-sends the track prompt)
    await page.locator('.track-card-link[data-track="web-app"]').click();
    await page.waitForSelector('#landing-page', { state: 'detached', timeout: 5_000 });

    // Phase indicator must update to "Deploy" — the server-emitted phase
    await expect(
      page.getByRole('status', { name: /Current phase: Deploy/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('revisit: phase indicator steps back to server-emitted earlier phase', async ({ page }) => {
    await setupHealthRoute(page);

    // Turn 1 → review; Turn 2 → design (revisit)
    let callCount = 0;
    await page.route('**/api/converse', route => {
      callCount++;
      const body = callCount === 1
        ? sseResponse('Your app is ready for review.', 'review', 'Review', 'route-test-revisit')
        : sseResponse(
            "Let's revisit the design to adjust the database selection.",
            'design',
            'Design',
            'route-test-revisit',
          );
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        body,
      });
    });

    const healthReady = page.waitForResponse('**/api/health', { timeout: 10_000 });
    await page.goto('/');
    await page.waitForSelector('#landing-page', { timeout: 10_000 });
    await healthReady;
    await page.locator('.track-card-link[data-track="web-app"]').click();
    await page.waitForSelector('#landing-page', { state: 'detached', timeout: 5_000 });

    // First turn should land on "Review"
    await expect(
      page.getByRole('status', { name: /Current phase: Review/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Second turn: user asks to change a decision → server revisits "Design"
    const textarea = page.locator('.chat-textarea');
    await textarea.fill('Actually, I want to change the database selection');
    await textarea.press('Enter');

    // Phase indicator must step back to "Design"
    await expect(
      page.getByRole('status', { name: /Current phase: Design/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated converse request redirects to SWA login', async ({ page }) => {
    // Health must succeed so the app bootstraps and becomes interactive.
    await setupHealthRoute(page);

    // Route /api/converse to return 401 — no SSE mock, just an auth rejection.
    // This simulates what the SWA auth gate returns for unauthenticated requests.
    await page.route('**/api/converse', route =>
      route.fulfill({ status: 401, body: '' }),
    );

    const healthReady = page.waitForResponse('**/api/health', { timeout: 10_000 });
    await page.goto('/');
    await page.waitForSelector('#landing-page', { timeout: 10_000 });
    await healthReady;

    // Enter chat — auto-sends the track prompt; /api/converse returns 401.
    // useStreaming catches SessionExpiredError and sets window.location.href
    // to /.auth/login/aad?post_login_redirect_uri=/ which triggers navigation.
    await page.locator('.track-card-link[data-track="web-app"]').click();

    await page.waitForURL(url => url.includes('/.auth/login/'), { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Real-network auth gate — no page.route() intercept (C5)
// ---------------------------------------------------------------------------

test.describe('Real API auth — unauthenticated requests', () => {
  /**
   * Uses Playwright's APIRequestContext (`request` fixture), which is a bare
   * HTTP client completely independent of the browser page and its route
   * intercepts. No `page.route()` mock covers this call — it hits the actual
   * server at baseURL (/api/converse).
   *
   * In a real SWA deployment the SWA auth gate returns 401 for requests with
   * no auth cookie. Against the static dev server used in CI the endpoint does
   * not exist and returns 404. Either way the endpoint must NOT return HTTP 200
   * to an unauthenticated converse request, which is the security invariant
   * this test asserts.
   */
  test('unauthenticated direct request to /api/converse is not accepted (no 200)', async ({ request }) => {
    const response = await request.post('/api/converse', {
      data: { sessionId: 'auth-test', message: 'hello' },
      headers: { 'Content-Type': 'application/json' },
      // No auth cookies — SWA returns 401; static dev server returns 404
    });

    // Must never be HTTP 200. In real SWA: 401. In CI static serve: 404.
    expect(response.status()).not.toBe(200);
  });
});
