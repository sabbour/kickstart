import { test as base, type Page } from '@playwright/test';

/**
 * Shared test fixture that mocks MSAL before every page load
 * so the app renders without attempting Entra ID authentication.
 */
export const test = base.extend<{ mockAuth: void }>({
  mockAuth: [async ({ page }, use) => {
    // Intercept MSAL CDN request — return a lightweight mock so the
    // real MSAL library never loads (avoids network dependency + Entra redirects).
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

    // Intercept API calls — no backend in E2E tests, force demo mode
    await page.route('**/api/converse', route =>
      route.fulfill({ status: 503, contentType: 'text/plain', body: 'No backend' }),
    );

    // Also intercept Fluent UI CDN — not needed for functional tests
    await page.route('**/unpkg.com/@fluentui/**', route =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* noop */' }),
    );

    await use();
  }, { auto: true }],
});

export { expect } from '@playwright/test';

/** Navigate to a hash route and wait for the content area to finish loading. */
export async function navigateTo(page: Page, route: string) {
  await page.goto(`/#${route}`);
  await page.waitForSelector('#content-area[aria-busy="false"]', { timeout: 10_000 });
}

/** Type a message in the copilot textarea and press Enter. */
export async function sendCopilotMessage(page: Page, text: string) {
  const textarea = page.locator('.copilot-textarea');
  await textarea.fill(text);
  await textarea.press('Enter');
}

/** Wait for the assistant response bubble that contains the given text. */
export async function waitForAssistantMessage(page: Page, partialText: string, timeoutMs = 5000) {
  await page.locator('.chat-bubble.assistant', { hasText: partialText }).first().waitFor({ timeout: timeoutMs });
}

/** Ensure the copilot panel is visible. */
export async function ensureCopilotOpen(page: Page) {
  const panel = page.locator('#copilot-panel');
  if (await panel.evaluate(el => el.classList.contains('hidden'))) {
    await page.locator('#topbar-copilot-toggle').click();
    await page.waitForTimeout(300);
  }
}
