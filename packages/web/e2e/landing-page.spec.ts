import { test, expect } from './helpers';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#landing-page', { timeout: 10_000 });
  });

  test('page loads with landing page visible and chat hidden', async ({ page }) => {
    await expect(page.locator('#landing-page')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/on-landing/);
    // Chat UI is mounted but hidden via display:none
    await expect(page.locator('#chat-ui')).toBeHidden();
  });

  test('carousel renders with slides and dots', async ({ page }) => {
    const viewport = page.locator('#carousel-viewport');
    await expect(viewport).toBeVisible();

    const slides = page.locator('.carousel-slide');
    const count = await slides.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // First slide starts as active
    await expect(slides.first()).toHaveClass(/active/);

    // Dots match number of slides
    const dots = page.locator('.carousel-dot');
    expect(await dots.count()).toBe(count);
    await expect(dots.first()).toHaveClass(/active/);
  });

  test('track cards render with correct data-track attributes', async ({ page }) => {
    const webTrack = page.locator('.track-card-link[data-track="web-app"]');
    const agentTrack = page.locator('.track-card-link[data-track="agentic-app"]');

    await expect(webTrack).toBeVisible();
    await expect(agentTrack).toBeVisible();
    await expect(webTrack).toHaveText(/Get started/);
    await expect(agentTrack).toHaveText(/Get started/);
  });

  test('framework pills render for each framework', async ({ page }) => {
    const expectedFrameworks = [
      'Next.js', 'Python FastAPI', 'Express.js', 'Go',
      'Spring Boot', 'Django', 'Rust', 'LangChain Agent', 'RAG App',
    ];

    for (const fw of expectedFrameworks) {
      await expect(page.locator(`.framework-pill[data-framework="${fw}"]`)).toBeVisible();
    }
  });

  test('IDE links section is visible', async ({ page }) => {
    const ideSection = page.locator('.landing-ide');
    await expect(ideSection).toBeVisible();

    const ideCards = page.locator('.ide-card');
    expect(await ideCards.count()).toBeGreaterThanOrEqual(2);

    // VS Code and VS Code Insiders
    await expect(page.locator('.ide-card-name', { hasText: 'VS Code' }).first()).toBeVisible();
    await expect(page.locator('.ide-card-name', { hasText: 'VS Code Insiders' })).toBeVisible();
  });
});
