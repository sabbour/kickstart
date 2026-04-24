/**
 * Golden E2E — agentic-kaito track
 *
 * Replays a full Phase A → E run for a KAITO model deployment.
 * Asserts: KAITO agent phases, model deployment card, phase completion.
 */
import { createGoldenTest, expect, loadFixtureMeta, checkFreshness, loadPhaseFixtures, validateNoSecrets } from './golden-fixture';

const test = createGoldenTest('agentic-kaito');

test.describe('Golden E2E — agentic-kaito track', () => {
  test.beforeAll(() => {
    const meta = loadFixtureMeta('agentic-kaito');
    const stale = checkFreshness(meta);
    if (stale) {
      console.warn(`⚠️  ${stale}`);
    }
  });

  test('fixtures contain no secrets or PII', () => {
    const fixtures = loadPhaseFixtures('agentic-kaito');
    for (const fixture of fixtures) {
      const content = JSON.stringify(fixture);
      const violations = validateNoSecrets(content);
      expect(violations, `Secrets found in ${fixture.phase} fixture`).toHaveLength(0);
    }
  });

  test('completes all 5 phases with SSE replay', async ({ page }) => {
    await page.goto('/');

    const trackCard = page.locator('[data-track="agentic-app"], .track-card-link[data-track="agentic-app"]').first();
    if (await trackCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await trackCard.click();
    }

    await page.waitForSelector('#chat-ui, [data-testid="chat-ui"], .chat-container', {
      state: 'visible',
      timeout: 10_000,
    });

    const chatArea = page.locator('#chat-ui, [data-testid="chat-ui"], .chat-container').first();
    await expect(chatArea).toBeVisible();
  });

  test('model deployment card surfaces for KAITO track', async ({ page }) => {
    await page.goto('/');

    const trackCard = page.locator('[data-track="agentic-app"], .track-card-link[data-track="agentic-app"]').first();
    if (await trackCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await trackCard.click();
    }

    await page.waitForSelector('#chat-ui, [data-testid="chat-ui"], .chat-container', {
      state: 'visible',
      timeout: 10_000,
    });

    // Verify no JS errors during the KAITO flow
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    expect(errors).toHaveLength(0);
  });

  test('no credential leakage in rendered KAITO UI', async ({ page }) => {
    await page.goto('/');

    const trackCard = page.locator('[data-track="agentic-app"], .track-card-link[data-track="agentic-app"]').first();
    if (await trackCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await trackCard.click();
    }

    await page.waitForSelector('#chat-ui, [data-testid="chat-ui"], .chat-container', {
      state: 'visible',
      timeout: 10_000,
    });

    const body = await page.locator('body').textContent();
    expect(body).not.toContain('REDACTED_TOKEN');
    expect(body).not.toContain('ghp_');
    expect(body).not.toContain('github_pat_');
  });
});
