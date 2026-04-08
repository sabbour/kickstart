import { test, expect } from './helpers';

test.describe('Sessions sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#landing-page', { timeout: 10_000 });
  });

  test('sidebar starts hidden', async ({ page }) => {
    const sidebar = page.locator('#sessions-sidebar');
    await expect(sidebar).toHaveClass(/hidden/);
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
