import { test, expect } from './helpers';
test.describe('Landing page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#landing-page', { timeout: 10_000 });
    });
    test('page loads with landing page visible', async ({ page }) => {
        await expect(page.locator('#landing-page')).toBeVisible();
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
});
//# sourceMappingURL=landing-page.spec.js.map