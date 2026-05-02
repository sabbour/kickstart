import { test as base, type Page } from '@playwright/test';

/**
 * Shared test fixture that mocks MSAL and forces demo mode
 * so the app renders without authentication or a real API backend.
 */
export const test = base.extend<{ mockAuth: void }>({
  mockAuth: [async ({ page }, use) => {
    // Suppress the onboarding tour so it never blocks clicks during tests.
    // Must run via addInitScript so localStorage is set before the app mounts.
    await page.addInitScript(() => {
      localStorage.setItem('kickstart-onboarding-complete', 'true');
    });

    // Install the SSE streaming-cycle observer (#310/#340).
    //
    // We track every active→idle transition of `#chat-ui[data-streaming]` in a
    // monotonic counter on `window`. `waitForStreamingIdle` then waits for the
    // counter to advance past the last value it accepted, which is the only
    // race-free way to detect "this turn completed":
    //   - A bare `idle` poll matches a lingering idle from the previous turn.
    //   - Anchoring on `active` first races on fast demo streams where the
    //     entire active→idle cycle completes between `click()` and the helper
    //     being called (Playwright never observes `active`).
    // The counter cleanly handles both: regardless of how fast the cycle is,
    // each completed turn increments it exactly once.
    await page.addInitScript(() => {
      const w = window as unknown as {
        __sseCompletedTurns?: number;
        __sseAcceptedTurns?: number;
        __sseObserverInstalled?: boolean;
      };
      w.__sseCompletedTurns = 0;
      w.__sseAcceptedTurns = 0;
      w.__sseObserverInstalled = false;

      const installObserver = (el: Element) => {
        if (w.__sseObserverInstalled) return;
        w.__sseObserverInstalled = true;
        const obs = new MutationObserver((mutations) => {
          for (const m of mutations) {
            const oldVal = m.oldValue;
            const cur = (m.target as Element).getAttribute('data-streaming');
            if (oldVal === 'active' && cur === 'idle') {
              w.__sseCompletedTurns = (w.__sseCompletedTurns ?? 0) + 1;
            }
          }
        });
        obs.observe(el, {
          attributes: true,
          attributeFilter: ['data-streaming'],
          attributeOldValue: true,
        });
      };

      const tryInstall = () => {
        const el = document.getElementById('chat-ui');
        if (el) {
          installObserver(el);
          return true;
        }
        return false;
      };

      const setup = () => {
        if (tryInstall()) return;
        // #chat-ui mounts after navigation from the landing page. Poll cheaply
        // (vs subtree-observing documentElement, which fires for every mount
        // event during initial render and is wasteful) until it appears.
        const interval = window.setInterval(() => {
          if (tryInstall()) window.clearInterval(interval);
        }, 50);
      };
      // The init script runs before the document body is parsed, so we must
      // defer observer setup until DOMContentLoaded — otherwise the
      // documentElement we observed gets replaced when the response HTML
      // loads, and our observer is attached to a detached node.
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup, { once: true });
      } else {
        setup();
      }
    });

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

    // Block auth redirects — prevents navigating away from the app when the
    // playground auth stub is not active (e.g. in non-playground test routes).
    await page.route('**/.auth/**', route => route.abort());

    await use();
  }, { auto: true }],
});

export { expect } from '@playwright/test';

/**
 * Wait for the chat container to report that an SSE streaming turn completed.
 *
 * The `#chat-ui` element exposes `data-streaming="active" | "idle"` (mirrored
 * from `useStreaming.isStreaming` and toggled to `idle` in the SSE reader's
 * `finally` after `end` or abort — see PR #340 / issue #310). Tests must gate
 * on stream completion after every Send/revise turn instead of using arbitrary
 * timeouts so resource-visibility assertions only run once createSurface +
 * updateComponents + end have all flushed.
 *
 * IMPORTANT — why we count turns instead of polling the attribute directly
 * (Hermes review on PR #340):
 *
 *   - A bare `data-streaming="idle"` poll races: after `button.click()`
 *     returns, React has not yet committed `setIsStreaming(true)`, so the
 *     container still reports the *previous* turn's `idle` (or the initial
 *     mount idle). The first poll matches and the helper returns before the
 *     new SSE turn even begins.
 *   - Anchoring on `active` first (then `idle`) fixes the chained-revise
 *     race but introduces its own race on fast demo streams: the entire
 *     active→idle cycle can complete between `click()` and Playwright's
 *     first poll, so `active` is never observed and the helper times out.
 *
 * The fixture (`mockAuth`) installs a MutationObserver that increments
 * `window.__sseCompletedTurns` on every active→idle transition. This helper
 * waits for the counter to advance past the last value it accepted, then
 * marks the new value as accepted. That is race-free regardless of stream
 * speed: a turn completes ⇒ counter increments ⇒ helper returns; the helper
 * never matches a lingering idle because the counter only advances on
 * a fresh active→idle edge.
 *
 * Do not "simplify" this back to a single bare-idle (or even bare
 * active→idle) `toHaveAttribute` assertion — see Hermes' review on PR #340.
 */
export async function waitForStreamingIdle(page: Page, timeoutMs = 15_000) {
  await page.waitForFunction(
    () => {
      const w = window as unknown as {
        __sseCompletedTurns?: number;
        __sseAcceptedTurns?: number;
      };
      const el = document.getElementById('chat-ui');
      const cur = el?.getAttribute('data-streaming');
      const completed = w.__sseCompletedTurns ?? 0;
      const accepted = w.__sseAcceptedTurns ?? 0;
      return cur === 'idle' && completed > accepted;
    },
    undefined,
    { timeout: timeoutMs },
  );
  await page.evaluate(() => {
    const w = window as unknown as {
      __sseCompletedTurns?: number;
      __sseAcceptedTurns?: number;
    };
    w.__sseAcceptedTurns = w.__sseCompletedTurns ?? 0;
  });
}

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
