/**
 * Playground → Workspace tab layout regression test (#997).
 *
 * Regression guard for the "black void below file content" bug.
 * Ensures the Workspace blade's FileViewer pane fills the viewport
 * height (modulo a small chrome/topbar reserve) so the page body's
 * dark background cannot leak through below the editor.
 *
 * NOTE: Uses the same `describe.skip` pattern as `playground.spec.ts`
 * because the auto-fixture in `helpers.ts` 503s all `/api/**` calls,
 * which currently blocks the Playground page from reaching a rendered
 * state in E2E (tracked in #772). The assertions below are the durable
 * geometry contract for this fix and will run once #772 is unblocked.
 */

import { test, expect } from './helpers';

const PLAYGROUND_URL = '/?playground';

// Named constants — no magic numbers (per Nibbler's DP review, #997).
// Max vertical slack (px) permitted between the editor's bottom edge and
// the viewport bottom. Anything larger means the Workspace flex chain
// is not filling the viewport (i.e. the black-void regression).
const MAX_EDITOR_BOTTOM_SLACK_PX = 8;
// Minimum code-wrapper height expected on a default desktop viewport —
// guards against the editor pane collapsing to content-min-size.
const MIN_CODE_WRAPPER_HEIGHT_PX = 300;

test.describe.skip('Playground › Workspace layout (#997)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PLAYGROUND_URL);
    await page.waitForSelector('.playground-page', { timeout: 15_000 });
    await page.getByRole('tab', { name: 'Workspace' }).click();
    await page.locator('[data-testid="file-viewer"]').waitFor({ timeout: 10_000 });
  });

  test('editor pane fills viewport — no black void below file content', async ({ page }) => {
    const viewport = page.viewportSize()!;

    const viewer = page.locator('[data-testid="file-viewer"]');
    const viewerBox = await viewer.boundingBox();
    expect(viewerBox, 'FileViewer should have a bounding box').not.toBeNull();

    const viewerBottom = viewerBox!.y + viewerBox!.height;
    const slackBelowViewer = viewport.height - viewerBottom;

    // Explicit geometry assertion (#997, per Nibbler's DP review):
    // the editor pane must extend to within MAX_EDITOR_BOTTOM_SLACK_PX of
    // the viewport bottom — otherwise dark page-body background shows
    // through as a "black void".
    expect(slackBelowViewer).toBeLessThanOrEqual(MAX_EDITOR_BOTTOM_SLACK_PX);

    // Code wrapper must have a meaningful height (not collapsed to content).
    const codeWrapper = page.locator('[data-testid="code-wrapper"]');
    const codeBox = await codeWrapper.boundingBox();
    expect(codeBox, 'code-wrapper should have a bounding box').not.toBeNull();
    expect(codeBox!.height).toBeGreaterThanOrEqual(MIN_CODE_WRAPPER_HEIGHT_PX);
  });

  test('layout holds with file tree collapsed', async ({ page }) => {
    const viewport = page.viewportSize()!;

    // Dismiss the sidebar so the viewer is the only body child.
    await page.getByRole('button', { name: /hide|dismiss files|close sidebar/i }).first().click().catch(() => {
      // Fallback: some builds expose an X in the sidebar header
    });

    const viewer = page.locator('[data-testid="file-viewer"]');
    const viewerBox = await viewer.boundingBox();
    expect(viewerBox).not.toBeNull();
    const slackBelowViewer = viewport.height - (viewerBox!.y + viewerBox!.height);
    expect(slackBelowViewer).toBeLessThanOrEqual(MAX_EDITOR_BOTTOM_SLACK_PX);
  });
});
