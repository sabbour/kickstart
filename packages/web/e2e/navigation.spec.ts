import { test, expect, navigateTo } from './helpers';

test.describe('Navigation & Layout', () => {
  test('page loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Kickstart/);
  });

  test('left nav renders expected items', async ({ page }) => {
    await navigateTo(page, '/');
    const nav = page.locator('#nav-pane');
    await expect(nav.locator('.nav-item', { hasText: 'Overview' })).toBeVisible();
    await expect(nav.locator('.nav-item', { hasText: 'Create AKS App' })).toBeVisible();
    await expect(nav.locator('.nav-item', { hasText: 'Deployments' })).toBeVisible();
    await expect(nav.locator('.nav-item', { hasText: 'Settings' })).toBeVisible();
  });

  test('clicking nav items changes the route', async ({ page }) => {
    await navigateTo(page, '/');

    await page.locator('.nav-item', { hasText: 'Settings' }).click();
    await page.waitForSelector('#content-area[aria-busy="false"]');
    expect(page.url()).toContain('#/settings');
    await expect(page.locator('#content-area')).toContainText('Settings');

    await page.locator('.nav-item', { hasText: 'Deployments' }).click();
    await page.waitForSelector('#content-area[aria-busy="false"]');
    expect(page.url()).toContain('#/deployments');
    await expect(page.locator('#content-area')).toContainText('Deployments');
  });

  test('overview page shows hero section', async ({ page }) => {
    await navigateTo(page, '/');
    await expect(page.locator('#content-area h1')).toContainText('Deploy to AKS, guided by AI');
  });

  test('overview page shows feature cards', async ({ page }) => {
    await navigateTo(page, '/');
    await expect(page.locator('.card .card-title', { hasText: 'Discover' })).toBeVisible();
    await expect(page.locator('.card .card-title', { hasText: 'Design' })).toBeVisible();
    await expect(page.locator('.card .card-title', { hasText: 'Generate' })).toBeVisible();
    await expect(page.locator('.card .card-title', { hasText: 'Deploy' })).toBeVisible();
  });

  test('"Get Started" button navigates to /create', async ({ page }) => {
    await navigateTo(page, '/');
    await page.locator('#cta-get-started').click();
    await page.waitForSelector('#content-area[aria-busy="false"]');
    expect(page.url()).toContain('#/create');
    await expect(page.locator('.wizard')).toBeVisible();
  });

  test('breadcrumbs update on navigation', async ({ page }) => {
    await navigateTo(page, '/');
    const breadcrumbBar = page.locator('#breadcrumb-bar');
    // Home shows "Home" or "Kickstart"
    await expect(breadcrumbBar).toContainText('Kickstart');

    await navigateTo(page, '/settings');
    await expect(breadcrumbBar).toContainText('Settings');

    await navigateTo(page, '/create');
    await expect(breadcrumbBar).toContainText('Create AKS App');
  });

  test('404 page shows for invalid route', async ({ page }) => {
    await navigateTo(page, '/nonexistent-route');
    await expect(page.locator('#content-area')).toContainText('Page not found');
  });

  test('command bar renders with expected buttons', async ({ page }) => {
    await navigateTo(page, '/');
    const bar = page.locator('.command-bar');
    await expect(bar.locator('[data-action="new-deployment"]')).toContainText('New deployment');
    await expect(bar.locator('[data-action="refresh"]')).toContainText('Refresh');
    await expect(bar.locator('[data-action="toggle-copilot"]')).toContainText('Copilot');
  });
});
