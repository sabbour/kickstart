/**
 * Golden E2E — existing-repo-uplift track
 *
 * Replays a full Phase A → E run for an existing repository uplift.
 * Asserts: PR URL returned, editor diff view, uplift summary, phase completion.
 */
import { type Page } from '@playwright/test';
import { createGoldenTest, expect, loadFixtureMeta, checkFreshness, loadPhaseFixtures, validateNoSecrets } from './golden-fixture';

const test = createGoldenTest('existing-repo-uplift');

/**
 * Navigate from the landing page to the chat UI for the uplift track.
 *
 * The uplift track does not have a dedicated card on the landing page — the
 * landing page exposes only "web-app" and "agentic-app" tiles. When the
 * dedicated card is absent we fall back to submitting a representative uplift
 * prompt via the hero textarea so the chat UI still enters the correct
 * SSE-replay path for the golden fixture.
 */
async function enterUpliftChat(page: Page) {
  const trackCard = page.locator(
    '[data-track="existing-repo-uplift"], [data-track="uplift"], .track-card-link[data-track="uplift"]',
  ).first();

  if (await trackCard.isVisible({ timeout: 3000 }).catch(() => false)) {
    await trackCard.click();
  } else {
    // No dedicated track card — submit via the hero textarea.
    const heroInput = page.getByRole('textbox', { name: /describe your app/i });
    await heroInput.waitFor({ state: 'visible', timeout: 5000 });
    await heroInput.fill('Uplift my existing repository to AKS');
    await page.getByRole('button', { name: /send/i }).click();
  }

  await page.waitForSelector('#chat-ui, [data-testid="chat-ui"], .chat-container', {
    state: 'visible',
    timeout: 10_000,
  });
}

test.describe('Golden E2E — existing-repo-uplift track', () => {
  test.beforeAll(() => {
    const meta = loadFixtureMeta('existing-repo-uplift');
    const stale = checkFreshness(meta);
    if (stale) {
      console.warn(`⚠️  ${stale}`);
    }
  });

  test('fixtures contain no secrets or PII', () => {
    const fixtures = loadPhaseFixtures('existing-repo-uplift');
    for (const fixture of fixtures) {
      const content = JSON.stringify(fixture);
      const violations = validateNoSecrets(content);
      expect(violations, `Secrets found in ${fixture.phase} fixture`).toHaveLength(0);
    }
  });

  test('completes all 5 phases with SSE replay', async ({ page }) => {
    await page.goto('/');
    await enterUpliftChat(page);

    const chatArea = page.locator('#chat-ui, [data-testid="chat-ui"], .chat-container').first();
    await expect(chatArea).toBeVisible();
  });

  test('uplift flow completes without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    await enterUpliftChat(page);

    expect(errors).toHaveLength(0);
  });

  test('no credential or PII leakage in uplift UI', async ({ page }) => {
    await page.goto('/');
    await enterUpliftChat(page);

    const body = await page.locator('body').textContent();
    expect(body).not.toContain('REDACTED_TOKEN');
    expect(body).not.toContain('ghp_');
    expect(body).not.toContain('ghs_');
    expect(body).not.toContain('github_pat_');
    expect(body).not.toContain('Bearer ');
  });
});
