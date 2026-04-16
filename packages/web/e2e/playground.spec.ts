import type { Page } from '@playwright/test';
import { test, expect } from './helpers';

const PLAYGROUND_URL = '/?playground';

async function openScenario(page: Page, label: string, tab: 'gallery' | 'components' = 'gallery') {
  if (tab === 'components') {
    await page.getByRole('tab', { name: 'Components' }).click();
    await expect(page.getByRole('tab', { name: 'Components' })).toHaveAttribute('aria-selected', 'true');
  }
  const searchBox = page.getByPlaceholder('Filter scenarios...');
  await searchBox.fill(label);
  const card = page.getByRole('button', { name: label }).first();
  await card.waitFor({ timeout: 10_000 });
  await card.click();
  await page.getByRole('dialog').waitFor({ timeout: 5_000 });
}

test.describe('Playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PLAYGROUND_URL);
    await page.waitForSelector('.playground-page', { timeout: 15_000 });
  });

  // ---- Tab Navigation ----

  test.describe('Tab navigation', () => {
    test('all five tabs are visible', async ({ page }) => {
      for (const tab of ['Create', 'Ideas', 'Components', 'Icons', 'Widgets']) {
        await expect(page.getByRole('tab', { name: tab })).toBeVisible();
      }
    });

    test('Ideas tab is active by default', async ({ page }) => {
      await expect(page.getByRole('tab', { name: 'Ideas' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('.playground-gallery')).toBeVisible();
    });

    test('switching to Create tab shows the prompt hero', async ({ page }) => {
      await page.getByRole('tab', { name: 'Create' }).click();
      await expect(page.getByRole('tab', { name: 'Create' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByText('What component would you like to imagine?')).toBeVisible();
    });

    test('switching to Components tab shows the gallery grid', async ({ page }) => {
      await page.getByRole('tab', { name: 'Components' }).click();
      await expect(page.getByRole('tab', { name: 'Components' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('.playground-gallery-scroll')).toBeVisible();
    });

    test('switching to Icons tab shows the icon section tabs', async ({ page }) => {
      await page.getByRole('tab', { name: 'Icons', exact: true }).click();
      await expect(page.getByRole('tab', { name: 'Icons', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { name: 'Azure Services' })).toBeVisible();
    });

    test('switching to Widgets tab shows the widgets area', async ({ page }) => {
      await page.getByRole('tab', { name: 'Widgets' }).click();
      await expect(page.getByRole('tab', { name: 'Widgets' })).toHaveAttribute('aria-selected', 'true');
    });

    test('topbar shows "A2UI Playground" branding', async ({ page }) => {
      await expect(page.getByText('A2UI Playground')).toBeVisible();
    });
  });

  // ---- Gallery Tab ----

  test.describe('Gallery tab', () => {
    test('masonry grid renders with multiple scenario cards', async ({ page }) => {
      const gallery = page.locator('.playground-gallery');
      await expect(gallery).toBeVisible();

      const cards = page.locator('.playground-gallery > div');
      const count = await cards.count();
      expect(count).toBeGreaterThan(5);
    });

    test('cards contain A2UI component content after render', async ({ page }) => {
      // Wait for first card's A2UI surface to render (async via useEffect)
      const firstCard = page.locator('.playground-gallery > div').first();
      await expect(firstCard.locator('.a2ui-component')).toBeVisible({ timeout: 10_000 });
    });

    test('clicking a gallery card opens a preview dialog', async ({ page }) => {
      const firstCard = page.locator('.playground-gallery > div').first();
      await firstCard.waitFor({ timeout: 5000 });
      await firstCard.click();

      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    });

    test('dialog has Preview and JSON tabs', async ({ page }) => {
      await page.locator('.playground-gallery > div').first().click();
      await page.getByRole('dialog').waitFor({ timeout: 5000 });

      await expect(page.getByRole('tab', { name: 'Preview' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'JSON', exact: true })).toBeVisible();
    });

    test('dialog JSON tab shows valid JSON', async ({ page }) => {
      await page.locator('.playground-gallery > div').first().click();
      await page.getByRole('dialog').waitFor({ timeout: 5000 });

      await page.getByRole('tab', { name: 'JSON', exact: true }).click();
      // The JSON code block renders A2UI message JSON — check it contains "version"
      await expect(page.getByRole('dialog').getByText(/version/)).toBeVisible({ timeout: 3000 });
    });

    test('dialog can be closed with the Close button', async ({ page }) => {
      await page.locator('.playground-gallery > div').first().click();
      await page.getByRole('dialog').waitFor({ timeout: 5000 });

      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 3000 });
    });

    test('search filter reduces visible gallery cards', async ({ page }) => {
      const cards = page.locator('.playground-gallery > div');
      const initialCount = await cards.count();
      expect(initialCount).toBeGreaterThan(0);

      await page.getByPlaceholder('Filter scenarios...').fill('zzznothing');

      await expect(async () => {
        expect(await cards.count()).toBeLessThan(initialCount);
      }).toPass({ timeout: 3000 });
    });

    test('clearing search filter restores all gallery cards', async ({ page }) => {
      const cards = page.locator('.playground-gallery > div');
      const initialCount = await cards.count();

      const searchBox = page.getByPlaceholder('Filter scenarios...');
      await searchBox.fill('zzznothing');
      await searchBox.clear();

      await expect(async () => {
        expect(await cards.count()).toBe(initialCount);
      }).toPass({ timeout: 3000 });
    });
  });

  test.describe('Fat component slices', () => {
    test('Azure AuthCard signs in with the playground stub flow', async ({ page }) => {
      await openScenario(page, 'Azure AuthCard', 'components');

      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Sign in to Azure' }).click();

      await expect(dialog.getByText('Connected')).toBeVisible({ timeout: 3_000 });
      await expect(dialog.getByRole('button', { name: 'Disconnect' })).toBeVisible();
    });

    test('GitHub AuthCard signs in with the playground stub flow', async ({ page }) => {
      await openScenario(page, 'GitHub AuthCard', 'components');

      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Sign in to GitHub' }).click();

      await expect(dialog.getByText('Connected')).toBeVisible({ timeout: 3_000 });
      await expect(dialog.getByRole('button', { name: 'Disconnect' })).toBeVisible();
    });

    test('fat slice scenario renders stub Azure and GitHub data', async ({ page }) => {
      await openScenario(page, 'Fat slice: Azure + GitHub', 'components');

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('kickstart-aks')).toBeVisible({ timeout: 5_000 });
      await expect(dialog.getByText('stub-user/my-web-app')).toBeVisible({ timeout: 5_000 });

      await dialog.getByRole('button', { name: 'Sign in to Azure' }).click();
      await expect(dialog.getByText('Kickstart Dev Subscription')).toBeVisible({ timeout: 5_000 });

      await dialog.getByRole('button', { name: 'Sign in with GitHub' }).click();
      await expect(dialog.getByText('Signed in via GitHub')).toBeVisible({ timeout: 5_000 });
    });
  });

  // ---- Components Tab ----

  test.describe('Components tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Components' }).click();
    });

    test('renders group section headers', async ({ page }) => {
      for (const group of ['Layout', 'Content', 'Inputs', 'Custom Controls']) {
        await expect(page.getByText(group, { exact: true }).first()).toBeVisible();
      }
    });

    test('component cards render inside groups', async ({ page }) => {
      const cards = page.locator('.playground-gallery > div');
      await expect(cards.first()).toBeVisible({ timeout: 5000 });
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
    });

    test('clicking a component card opens a dialog', async ({ page }) => {
      const firstCard = page.locator('.playground-gallery > div').first();
      await firstCard.waitFor({ timeout: 5000 });
      await firstCard.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.getByRole('button', { name: 'Close' }).click();
    });

    test('search filter works on component scenarios', async ({ page }) => {
      const cards = page.locator('.playground-gallery > div');
      const initialCount = await cards.count();

      await page.getByPlaceholder('Filter scenarios...').fill('zzznothing');

      await expect(async () => {
        expect(await cards.count()).toBeLessThan(initialCount);
      }).toPass({ timeout: 3000 });
    });
  });

  // ---- Icons Tab ----

  test.describe('Icons tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Icons' }).click();
    });

    test('icon section tabs render (Azure Services, UI Icons, Fluent 2)', async ({ page }) => {
      await expect(page.getByRole('tab', { name: 'Azure Services' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'UI Icons' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Fluent 2' })).toBeVisible();
    });

    test('Azure Services section renders icon images', async ({ page }) => {
      const iconImages = page.locator('.playground-create-scroll img[loading="lazy"]');
      await expect(iconImages.first()).toBeVisible({ timeout: 8000 });
      const count = await iconImages.count();
      expect(count).toBeGreaterThan(10);
    });

    test('icon search filter reduces visible icons', async ({ page }) => {
      const iconImages = page.locator('.playground-create-scroll img[loading="lazy"]');
      await iconImages.first().waitFor({ timeout: 8000 });
      const initialCount = await iconImages.count();

      await page.getByPlaceholder('Filter icons...').fill('kubernetes');

      await expect(async () => {
        const count = await iconImages.count();
        expect(count).toBeLessThan(initialCount);
        expect(count).toBeGreaterThan(0);
      }).toPass({ timeout: 3000 });
    });

    test('searching for a nonexistent icon shows empty state', async ({ page }) => {
      await page.getByPlaceholder('Filter icons...').fill('zzz_no_such_icon_xyz_99');
      await expect(page.getByText(/No icons match/)).toBeVisible({ timeout: 3000 });
    });

    test('switching to UI Icons section renders icons', async ({ page }) => {
      await page.getByRole('tab', { name: 'UI Icons' }).click();
      await expect(page.getByRole('tab', { name: 'UI Icons' })).toHaveAttribute('aria-selected', 'true');
      const iconImages = page.locator('.playground-create-scroll img[loading="lazy"]');
      await expect(iconImages.first()).toBeVisible({ timeout: 8000 });
    });
  });

  // ---- Widgets Tab ----

  test.describe('Widgets tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Widgets' }).click();
    });

    test('shows empty state when no widgets exist', async ({ page }) => {
      await expect(page.getByText('No widgets yet')).toBeVisible();
      await expect(page.getByText('Go to the Create tab to build your first widget.')).toBeVisible();
    });

    test('"Start Blank" on Create tab creates a widget and switches to Widgets tab', async ({ page }) => {
      await page.getByRole('tab', { name: 'Create' }).click();
      await page.getByText('Start Blank').first().click();

      // Should auto-switch to Widgets tab
      await expect(page.getByRole('tab', { name: 'Widgets' })).toHaveAttribute('aria-selected', 'true');
      // Empty state is gone
      await expect(page.getByText('No widgets yet')).toHaveCount(0);
    });

    test('created blank widget is visible with its name', async ({ page }) => {
      await page.getByRole('tab', { name: 'Create' }).click();
      await page.getByText('Start Blank').first().click();

      const panel = page.getByRole('tabpanel');
      await expect(panel.getByText('Untitled widget')).toBeVisible({ timeout: 5000 });
    });

    test('clicking a widget card opens a preview dialog', async ({ page }) => {
      // Create a widget first
      await page.getByRole('tab', { name: 'Create' }).click();
      await page.getByText('Start Blank').first().click();

      // Click the widget card in the main panel (not the sidebar shortcut)
      const panel = page.getByRole('tabpanel');
      await panel.getByText('Untitled widget').first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.getByRole('button', { name: 'Close' }).click();
    });

    test('widget can be deleted', async ({ page }) => {
      await page.getByRole('tab', { name: 'Create' }).click();
      await page.getByText('Start Blank').first().click();

      const panel = page.getByRole('tabpanel');
      await expect(panel.getByText('Untitled widget')).toBeVisible();

      // Click the "Delete widget" button (has aria-label)
      await page.getByRole('button', { name: 'Delete widget' }).click();

      // Widget is removed; empty state returns
      await expect(page.getByText('No widgets yet')).toBeVisible({ timeout: 3000 });
    });

    test('widget can be duplicated', async ({ page }) => {
      await page.getByRole('tab', { name: 'Create' }).click();
      await page.getByText('Start Blank').first().click();

      const panel = page.getByRole('tabpanel');
      await expect(panel.getByText('Untitled widget')).toBeVisible();
      const initialCount = await panel.getByText('Untitled widget').count();

      await page.getByRole('button', { name: 'Duplicate widget' }).click();

      // Should now have more widgets
      await expect(async () => {
        expect(await panel.getByText('Untitled widget').count()).toBeGreaterThan(initialCount);
      }).toPass({ timeout: 3000 });
    });
  });

  // ---- Create Tab ----

  test.describe('Create tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Create' }).click();
    });

    test('renders "What component would you like to imagine?" heading', async ({ page }) => {
      await expect(page.getByText('What component would you like to imagine?')).toBeVisible();
    });

    test('prompt input field renders with correct placeholder', async ({ page }) => {
      await expect(page.getByPlaceholder('Describe your A2UI widget...')).toBeVisible();
    });

    test('Create button is disabled when input is empty', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();
    });

    test('Create button enables when input has text', async ({ page }) => {
      await page.getByPlaceholder('Describe your A2UI widget...').fill('A counter widget');
      await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled();
    });

    test('"Start Blank" link is visible and navigates to Widgets tab', async ({ page }) => {
      await expect(page.getByText('Start Blank').first()).toBeVisible();
      await page.getByText('Start Blank').first().click();
      await expect(page.getByRole('tab', { name: 'Widgets' })).toHaveAttribute('aria-selected', 'true');
    });

    test('"Advanced JSON" toggle shows and hides the JSON editor', async ({ page }) => {
      // JSON editor is not visible initially
      await expect(page.getByPlaceholder('Widget name...')).not.toBeVisible();

      // Expand
      await page.getByText(/Advanced.*paste raw A2UI JSON/).click();
      await expect(page.getByPlaceholder('Widget name...')).toBeVisible();

      // Collapse
      await page.getByText(/Advanced.*paste raw A2UI JSON/).click();
      await expect(page.getByPlaceholder('Widget name...')).not.toBeVisible();
    });

    test('Advanced JSON: Render JSON button is disabled when textarea is empty', async ({ page }) => {
      await page.getByText(/Advanced.*paste raw A2UI JSON/).click();
      await expect(page.getByRole('button', { name: 'Render JSON' })).toBeDisabled();
    });

    test('Advanced JSON: valid JSON renders surfaces', async ({ page }) => {
      await page.getByText(/Advanced.*paste raw A2UI JSON/).click();

      const validJson = JSON.stringify([
        { version: 'v0.9', createSurface: { surfaceId: 'test-surface', catalogId: 'kickstart' } },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'test-surface',
            components: [
              { id: 'root', component: 'Column', children: ['t1'] },
              { id: 't1', component: 'Text', text: 'Hello Playground!', variant: 'body1' },
            ],
          },
        },
      ]);

      await page.getByRole('textbox', { name: 'A2UI JSON input' }).fill(validJson);
      await page.getByRole('button', { name: 'Render JSON' }).click();

      // A2UI surface should be rendered
      await expect(page.locator('.playground-surfaces .a2ui-component')).toBeVisible({ timeout: 5000 });
    });

    test('Advanced JSON: invalid JSON shows an error message', async ({ page }) => {
      await page.getByText(/Advanced.*paste raw A2UI JSON/).click();
      await page.getByRole('textbox', { name: 'A2UI JSON input' }).fill('{ invalid json }');
      await page.getByRole('button', { name: 'Render JSON' }).click();

      // The error is displayed as text — it will include common parse error keywords
      await expect(page.getByText(/token|Unexpected|Invalid|invalid|error/i).first()).toBeVisible({ timeout: 3000 });
    });

    // Skipped: Create tab chat flow requires a live /api/converse backend.
    // Enable once Fry wires the Create tab to use ?mock streaming.
    test.skip('chat flow: send message → user bubble appears', async ({ page }) => {
      await page.getByPlaceholder('Describe your A2UI widget...').fill('A simple counter widget');
      await page.getByRole('button', { name: 'Create' }).click();

      // User message bubble should appear
      await expect(page.getByText('A simple counter widget')).toBeVisible();

      // Typing dots or streaming bubble should appear
      await expect(
        page.locator('[class*="createTypingDots"], [class*="createBubbleStreaming"]'),
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // ---- Accessibility ----

  test.describe('Accessibility', () => {
    // --- ARIA roles on tab panels ---

    test('Ideas tab panel has role="tabpanel" and aria-labelledby="tab-gallery"', async ({ page }) => {
      const panel = page.locator('#panel-gallery');
      await expect(panel).toHaveAttribute('role', 'tabpanel');
      await expect(panel).toHaveAttribute('aria-labelledby', 'tab-gallery');
    });

    test('Components tab panel has correct ARIA attributes', async ({ page }) => {
      await page.getByRole('tab', { name: 'Components' }).click();
      const panel = page.locator('#panel-components');
      await expect(panel).toHaveAttribute('role', 'tabpanel');
      await expect(panel).toHaveAttribute('aria-labelledby', 'tab-components');
    });

    test('Icons tab panel has correct ARIA attributes', async ({ page }) => {
      await page.getByRole('tab', { name: 'Icons', exact: true }).click();
      const panel = page.locator('#panel-icons');
      await expect(panel).toHaveAttribute('role', 'tabpanel');
      await expect(panel).toHaveAttribute('aria-labelledby', 'tab-icons');
    });

    test('Widgets tab panel has correct ARIA attributes', async ({ page }) => {
      await page.getByRole('tab', { name: 'Widgets' }).click();
      const panel = page.locator('#panel-widgets');
      await expect(panel).toHaveAttribute('role', 'tabpanel');
      await expect(panel).toHaveAttribute('aria-labelledby', 'tab-widgets');
    });

    test('Create tab panel has correct ARIA attributes', async ({ page }) => {
      await page.getByRole('tab', { name: 'Create' }).click();
      const panel = page.locator('#panel-create');
      await expect(panel).toHaveAttribute('role', 'tabpanel');
      await expect(panel).toHaveAttribute('aria-labelledby', 'tab-create');
    });

    // --- Tab IDs (aria-controls wiring) ---

    test('Ideas tab has id="tab-gallery" and aria-controls="panel-gallery"', async ({ page }) => {
      const tab = page.getByRole('tab', { name: 'Ideas' });
      await expect(tab).toHaveAttribute('id', 'tab-gallery');
      await expect(tab).toHaveAttribute('aria-controls', 'panel-gallery');
    });

    // --- Gallery card ARIA ---

    test('gallery cards have role="button" and aria-label', async ({ page }) => {
      const firstCard = page.locator('.playground-gallery [role="button"]').first();
      await expect(firstCard).toBeVisible({ timeout: 5000 });
      await expect(firstCard).toHaveAttribute('role', 'button');
      const label = await firstCard.getAttribute('aria-label');
      expect(label).toBeTruthy();
    });

    test('Enter key on focused gallery card opens dialog', async ({ page }) => {
      const firstCard = page.locator('.playground-gallery [role="button"]').first();
      await firstCard.waitFor({ timeout: 5000 });
      await firstCard.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    });

    test('Space key on focused gallery card opens dialog', async ({ page }) => {
      const firstCard = page.locator('.playground-gallery [role="button"]').first();
      await firstCard.waitFor({ timeout: 5000 });
      await firstCard.focus();
      await page.keyboard.press(' ');
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    });

    test('Escape closes open dialog', async ({ page }) => {
      await page.locator('.playground-gallery [role="button"]').first().click();
      await page.getByRole('dialog').waitFor({ timeout: 5000 });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 3000 });
    });

    // --- Arrow key gallery navigation ---

    test('ArrowRight moves focus to next gallery card', async ({ page }) => {
      const cards = page.locator('.playground-gallery [role="button"]');
      await cards.first().waitFor({ timeout: 5000 });
      await cards.first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(cards.nth(1)).toBeFocused();
    });

    test('ArrowLeft moves focus to previous gallery card', async ({ page }) => {
      const cards = page.locator('.playground-gallery [role="button"]');
      await cards.first().waitFor({ timeout: 5000 });
      // Focus second card then go back
      await cards.nth(1).focus();
      await page.keyboard.press('ArrowLeft');
      await expect(cards.first()).toBeFocused();
    });

    test('ArrowDown moves focus to next gallery card', async ({ page }) => {
      const cards = page.locator('.playground-gallery [role="button"]');
      await cards.first().waitFor({ timeout: 5000 });
      await cards.first().focus();
      await page.keyboard.press('ArrowDown');
      await expect(cards.nth(1)).toBeFocused();
    });

    test('ArrowRight does not go past last gallery card', async ({ page }) => {
      const cards = page.locator('.playground-gallery [role="button"]');
      await cards.first().waitFor({ timeout: 5000 });
      const count = await cards.count();
      await cards.last().focus();
      await page.keyboard.press('ArrowRight');
      // Focus stays on last card
      await expect(cards.nth(count - 1)).toBeFocused();
    });

    // --- Keyboard shortcuts ---

    test('Ctrl+K focuses gallery search input', async ({ page }) => {
      // Focus a reliable non-input target — clicking body is flaky in headless CI
      await page.getByRole('tab', { name: 'Ideas' }).focus();
      await page.keyboard.press('Control+k');
      await expect(page.getByPlaceholder('Filter scenarios...')).toBeFocused();
    });

    test('/ key focuses gallery search input', async ({ page }) => {
      await page.getByRole('tab', { name: 'Ideas' }).focus();
      await page.keyboard.press('/');
      await expect(page.getByPlaceholder('Filter scenarios...')).toBeFocused();
    });

    test('Ctrl+K focuses icons search when Icons tab is active', async ({ page }) => {
      await page.getByRole('tab', { name: 'Icons', exact: true }).click();
      await page.locator('body').click();
      await page.keyboard.press('Control+k');
      await expect(page.getByPlaceholder('Filter icons...')).toBeFocused();
    });

    test('/ key focuses icons search when Icons tab is active', async ({ page }) => {
      await page.getByRole('tab', { name: 'Icons', exact: true }).click();
      await page.locator('body').click();
      await page.keyboard.press('/');
      await expect(page.getByPlaceholder('Filter icons...')).toBeFocused();
    });

    // --- Form controls ---

    test('Create tab prompt input has aria-label', async ({ page }) => {
      await page.getByRole('tab', { name: 'Create' }).click();
      // Accessible by name via aria-label
      await expect(page.getByRole('textbox', { name: 'Describe your A2UI widget' })).toBeVisible();
    });

    test('Advanced JSON widget name input has aria-label', async ({ page }) => {
      await page.getByRole('tab', { name: 'Create' }).click();
      await page.getByText(/Advanced.*paste raw A2UI JSON/).click();
      await expect(page.getByRole('textbox', { name: 'Widget name' })).toBeVisible();
    });

    test('Advanced JSON textarea has aria-label', async ({ page }) => {
      await page.getByRole('tab', { name: 'Create' }).click();
      await page.getByText(/Advanced.*paste raw A2UI JSON/).click();
      await expect(page.getByRole('textbox', { name: 'A2UI JSON input' })).toBeVisible();
    });

    // --- Icon card ARIA ---

    test('icon cards have aria-label', async ({ page }) => {
      await page.getByRole('tab', { name: 'Icons', exact: true }).click();
      const firstCard = page.locator('.playground-create-scroll [aria-label*="copy icon"]').first();
      await firstCard.waitFor({ timeout: 8000 });
      const label = await firstCard.getAttribute('aria-label');
      expect(label).toBeTruthy();
      expect(label).toMatch(/copy icon/);
    });

    test('icon cards are keyboard activatable', async ({ page }) => {
      await page.getByRole('tab', { name: 'Icons', exact: true }).click();
      const firstCard = page.locator('.playground-create-scroll [aria-label*="copy icon"]').first();
      await firstCard.waitFor({ timeout: 8000 });
      // Should be focusable
      await firstCard.focus();
      await expect(firstCard).toBeFocused();
    });

    // --- Advanced toggle aria-expanded ---

    test('Advanced JSON toggle has aria-expanded=false initially', async ({ page }) => {
      await page.getByRole('tab', { name: 'Create' }).click();
      const toggle = page.locator('[aria-expanded]').filter({ hasText: /Advanced.*paste raw A2UI JSON/ });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    test('Advanced JSON toggle aria-expanded becomes true when open', async ({ page }) => {
      await page.getByRole('tab', { name: 'Create' }).click();
      const toggle = page.locator('[aria-expanded]').filter({ hasText: /Advanced.*paste raw A2UI JSON/ });
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    // --- Start Blank keyboard support ---

    test('Start Blank is keyboard activatable with Enter', async ({ page }) => {
      await page.getByRole('tab', { name: 'Create' }).click();
      const startBlank = page.locator('[role="button"]').filter({ hasText: 'Start Blank' }).first();
      await expect(startBlank).toBeVisible();
      await startBlank.focus();
      await page.keyboard.press('Enter');
      // Should switch to Widgets tab
      await expect(page.getByRole('tab', { name: 'Widgets' })).toHaveAttribute('aria-selected', 'true');
    });

    // --- Dialog accessibility ---

    test('dialog dismiss button has aria-label', async ({ page }) => {
      await page.locator('.playground-gallery [role="button"]').first().click();
      await page.getByRole('dialog').waitFor({ timeout: 5000 });
      await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
    });
  });
});
