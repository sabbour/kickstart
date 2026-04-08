import { test, expect, navigateTo, ensureCopilotOpen } from './helpers';

test.describe('Create AKS App Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/create');
  });

  test('wizard renders with correct steps', async ({ page }) => {
    const wizard = page.locator('.wizard');
    await expect(wizard).toBeVisible();

    const indicators = wizard.locator('.wizard-step-indicator');
    await expect(indicators).toHaveCount(4);

    const labels = await indicators.locator('.wizard-step-label').allTextContents();
    expect(labels).toEqual(['App Details', 'Architecture', 'Configuration', 'Review + Create']);
  });

  test('step navigation works with Next and Back', async ({ page }) => {
    const wizard = page.locator('.wizard');

    // First step — Back should be disabled
    await expect(wizard.locator('#wizard-back')).toBeDisabled();
    await expect(wizard.locator('#wizard-next')).toBeVisible();

    // Go to step 2
    await wizard.locator('#wizard-next').click();
    const step2 = wizard.locator('.wizard-step-indicator').nth(1);
    await expect(step2).toHaveClass(/active/);

    // Back should now be enabled
    await expect(wizard.locator('#wizard-back')).toBeEnabled();

    // Go back
    await wizard.locator('#wizard-back').click();
    const step1 = wizard.locator('.wizard-step-indicator').nth(0);
    await expect(step1).toHaveClass(/active/);
  });

  test('form fields are present on first step', async ({ page }) => {
    await expect(page.locator('input[name="appName"]')).toBeVisible();
    await expect(page.locator('input[name="repoUrl"]')).toBeVisible();
    await expect(page.locator('select[name="language"]')).toBeVisible();
  });

  test('last step shows Create button instead of Next', async ({ page }) => {
    const wizard = page.locator('.wizard');

    // Navigate to last step
    await wizard.locator('#wizard-next').click();
    await wizard.locator('#wizard-next').click();
    await wizard.locator('#wizard-next').click();

    // On the last step, should have Create button instead of Next
    await expect(wizard.locator('#wizard-create')).toBeVisible();
    await expect(wizard.locator('#wizard-next')).not.toBeVisible();
  });

  test('copilot panel auto-opens on /create route', async ({ page }) => {
    const panel = page.locator('#copilot-panel');
    await expect(panel).not.toHaveClass(/hidden/);
  });
});
