import { test, expect, enterChatViaTrack } from './helpers';
test.describe('Sessions sidebar', () => {
    test('sidebar starts hidden on landing page', async ({ page }) => {
        await page.goto('/?mock');
        await page.waitForSelector('#landing-page', { timeout: 10_000 });
        // SessionsSidebar is not mounted on landing — it only renders in chat mode
        const sidebar = page.locator('#sessions-sidebar');
        await expect(sidebar).toHaveCount(0);
    });
    test.describe('after entering chat', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/?mock');
            await page.waitForSelector('#landing-page', { timeout: 10_000 });
            await enterChatViaTrack(page, 'web-app');
        });
        test('toggle button opens the sidebar', async ({ page }) => {
            const toggleBtn = page.locator('#topbar-sessions-toggle');
            const sidebar = page.locator('#sessions-sidebar');
            await toggleBtn.click();
            await expect(sidebar).not.toHaveClass(/hidden/);
            await expect(sidebar).toBeVisible();
        });
        test('close button closes the sidebar', async ({ page }) => {
            const toggleBtn = page.locator('#topbar-sessions-toggle');
            const sidebar = page.locator('#sessions-sidebar');
            const closeBtn = page.locator('#sessions-close-btn');
            // Open first
            await toggleBtn.click();
            await expect(sidebar).not.toHaveClass(/hidden/);
            // Close
            await closeBtn.click();
            await expect(sidebar).toHaveClass(/hidden/);
        });
        test('toggle button can open and close the sidebar repeatedly', async ({ page }) => {
            const toggleBtn = page.locator('#topbar-sessions-toggle');
            const sidebar = page.locator('#sessions-sidebar');
            // Open
            await toggleBtn.click();
            await expect(sidebar).not.toHaveClass(/hidden/);
            // Close via toggle
            await toggleBtn.click();
            await expect(sidebar).toHaveClass(/hidden/);
            // Open again
            await toggleBtn.click();
            await expect(sidebar).not.toHaveClass(/hidden/);
        });
    });
});
//# sourceMappingURL=sessions-sidebar.spec.js.map