import { test as base, type Page } from '@playwright/test';

/**
 * Shared test fixture that mocks MSAL and forces demo mode
 * so the app renders without authentication or a real API backend.
 */
export const test = base.extend<{ mockAuth: void }>({
  mockAuth: [async ({ page }, use) => {
    // Intercept MSAL CDN — return a lightweight mock so the
    // real MSAL library never loads (avoids Entra redirects).
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

    // Force demo mode — no backend in E2E tests
    await page.route('**/api/**', route =>
      route.fulfill({ status: 503, contentType: 'text/plain', body: 'No backend' }),
    );

    // Intercept Fluent UI CDN — not needed for functional tests
    await page.route('**/unpkg.com/@fluentui/**', route =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* noop */' }),
    );

    await use();
  }, { auto: true }],
});

export { expect } from '@playwright/test';

/** Type a message in the chat textarea and press Enter. */
export async function sendChatMessage(page: Page, text: string) {
  const textarea = page.locator('.chat-textarea');
  await textarea.fill(text);
  await textarea.press('Enter');
}

/** Wait for an assistant response bubble containing the given text. */
export async function waitForAssistantMessage(page: Page, partialText: string, timeoutMs = 8000) {
  await page.locator('.chat-bubble.assistant', { hasText: partialText }).first().waitFor({ timeout: timeoutMs });
}

/** Transition from landing to chat by clicking a track card. */
export async function enterChatViaTrack(page: Page, track: 'web-app' | 'agentic-app') {
  await page.locator(`.track-card-link[data-track="${track}"]`).click();
  await page.waitForSelector('#landing-page', { state: 'detached', timeout: 5000 });
  await page.waitForSelector('#chat-ui', { state: 'visible', timeout: 5000 });
}
