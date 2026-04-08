import { test, expect, waitForAssistantMessage } from './helpers';

test.describe('Landing to chat transition', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#landing-page', { timeout: 10_000 });
  });

  test('clicking a track card transitions to chat and auto-sends prompt', async ({ page }) => {
    await page.locator('.track-card-link[data-track="web-app"]').click();

    // Landing page should be removed from DOM
    await page.waitForSelector('#landing-page', { state: 'detached', timeout: 5000 });

    // Chat is now visible
    await expect(page.locator('#chat-ui')).toBeVisible();

    // Body no longer has landing class
    await expect(page.locator('body')).not.toHaveClass(/on-landing/);

    // User message auto-sent for web-app track
    const userBubble = page.locator('.chat-bubble.user');
    await expect(userBubble.first()).toContainText('web app or API');

    // Welcome message from assistant
    await waitForAssistantMessage(page, 'Kickstart');
  });

  test('clicking an agentic track card sends AI agent prompt', async ({ page }) => {
    await page.locator('.track-card-link[data-track="agentic-app"]').click();
    await page.waitForSelector('#landing-page', { state: 'detached', timeout: 5000 });

    const userBubble = page.locator('.chat-bubble.user');
    await expect(userBubble.first()).toContainText('AI agent');
  });

  test('clicking a framework pill transitions to chat and auto-sends framework prompt', async ({ page }) => {
    await page.locator('.framework-pill[data-framework="Go"]').click();
    await page.waitForSelector('#landing-page', { state: 'detached', timeout: 5000 });

    await expect(page.locator('#chat-ui')).toBeVisible();

    // User message includes the framework
    const userBubble = page.locator('.chat-bubble.user');
    await expect(userBubble.first()).toContainText('Go');

    // Welcome message mentions the framework
    await waitForAssistantMessage(page, 'Go');
  });

  test('clicking a carousel slide transitions to chat and auto-sends the prompt', async ({ page }) => {
    const firstSlide = page.locator('.carousel-slide').first();
    await firstSlide.click();
    await page.waitForSelector('#landing-page', { state: 'detached', timeout: 5000 });

    await expect(page.locator('#chat-ui')).toBeVisible();

    // A user message bubble appears (the carousel idea prompt)
    const userBubbles = page.locator('.chat-bubble.user');
    expect(await userBubbles.count()).toBeGreaterThanOrEqual(1);
  });

  test('after transition, landing page is removed from DOM', async ({ page }) => {
    await page.locator('.track-card-link[data-track="web-app"]').click();
    await page.waitForSelector('#landing-page', { state: 'detached', timeout: 5000 });

    // Verify it's truly gone from the DOM
    expect(await page.locator('#landing-page').count()).toBe(0);
  });

  test('welcome message appears from assistant after transition', async ({ page }) => {
    await page.locator('.framework-pill[data-framework="Next.js"]').click();
    await page.waitForSelector('#landing-page', { state: 'detached', timeout: 5000 });

    // Assistant welcome + framework-specific greeting
    const assistantBubbles = page.locator('.chat-bubble.assistant');
    await expect(assistantBubbles.first()).toBeVisible();
    await expect(assistantBubbles.first()).toContainText('Next.js');
  });
});
