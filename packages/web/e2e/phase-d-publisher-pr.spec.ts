import { test, expect } from './helpers';
import type { Route } from '@playwright/test';

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * SSE turn: AuthCard gate — user is not signed in to GitHub.
 */
function authGateTurn(sessionId: string): string {
  return [
    sseEvent('start', { sessionId }),
    sseEvent('chunk', { delta: 'You need to sign in to GitHub first.' }),
    sseEvent('a2ui', {
      version: 'v0.9',
      createSurface: { surfaceId: 'shared:publisher-pr', catalogId: 'kickstart' },
    }),
    sseEvent('a2ui', {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'shared:publisher-pr',
        components: [
          {
            id: 'root',
            component: 'AuthCard',
            provider: 'github',
            title: 'GitHub',
            description: 'Sign in to create a pull request.',
          },
        ],
      },
    }),
    sseEvent('end', { sessionId, model: 'test-model' }),
  ].join('');
}

/**
 * SSE turn: PR-creation flow card with file list and idle status.
 */
function prCreationTurn(sessionId: string, options: { withCreateSurface?: boolean } = {}): string {
  const events: string[] = [
    sseEvent('start', { sessionId }),
    sseEvent('chunk', { delta: 'Ready to create your pull request.' }),
  ];
  if (options.withCreateSurface) {
    // `shared:` surfaces require an explicit `createSurface` to register
    // ownership before `updateComponents` will land (see useA2UI.ts).
    events.push(
      sseEvent('a2ui', {
        version: 'v0.9',
        createSurface: { surfaceId: 'shared:publisher-pr', catalogId: 'kickstart' },
      }),
    );
  }
  events.push(
    sseEvent('a2ui', {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'shared:publisher-pr',
        components: [
          {
            id: 'root',
            component: 'github/CreatePRFlow',
            status: 'idle',
            owner: 'octocat',
            repo: 'kickstart-sample',
            targetBranch: 'main',
            files: ['infra/main.bicep', '.github/workflows/deploy.yml'],
            prTitle: 'feat: kickstart infra and deploy workflow',
            isActive: true,
          },
        ],
      },
    }),
    sseEvent('end', { sessionId, model: 'test-model' }),
  );
  return events.join('');
}

/**
 * SSE turn: SummaryCard result with PR link.
 */
function prResultTurn(sessionId: string): string {
  return [
    sseEvent('start', { sessionId }),
    sseEvent('chunk', { delta: 'Pull request created successfully!' }),
    sseEvent('a2ui', {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'shared:publisher-pr',
        components: [
          {
            id: 'root',
            component: 'SummaryCard',
            title: 'Pull request created',
            items: [
              { label: 'Repository', value: 'octocat/kickstart-sample' },
              { label: 'Branch', value: 'kickstart/initial' },
              {
                label: 'Pull request',
                value: 'PR #42',
                badge: 'success',
                link: 'https://github.com/octocat/kickstart-sample/pull/42',
              },
            ],
          },
        ],
      },
    }),
    sseEvent('end', { sessionId, model: 'test-model' }),
  ].join('');
}

async function setupHealthRoute(page: import('@playwright/test').Page) {
  await page.route('**/api/health', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    }),
  );
}

test.describe('Phase D publisher PR-creation card', () => {
  test('renders AuthCard gate then transitions to CreatePRFlow', async ({ page }) => {
    await setupHealthRoute(page);

    let turn = 0;
    await page.route('**/api/converse', async (route: Route) => {
      turn += 1;
      if (turn === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
          body: authGateTurn('phase-d-auth'),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        body: prCreationTurn('phase-d-auth'),
      });
    });

    const healthReady = page.waitForResponse('**/api/health', { timeout: 10_000 });
    await page.goto('/');
    await healthReady;

    // Send initial message
    await page.getByRole('textbox', { name: /describe your app/i }).fill('Deploy my app to AKS');
    await page.getByRole('button', { name: /send/i }).click();

    // AuthCard should appear with GitHub sign-in
    const surface = page.locator('[data-surface-id="shared:publisher-pr"]');
    await expect(surface).toBeVisible();
    await expect(page.getByText('Sign in to create a pull request.')).toBeVisible();

    // Only one publisher surface
    const surfaces = page.locator('.a2ui-surface-wrapper[data-surface-id="shared:publisher-pr"]');
    await expect(surfaces).toHaveCount(1);
  });

  test('renders SummaryCard with PR link after successful creation', async ({ page }) => {
    await setupHealthRoute(page);

    let turn = 0;
    await page.route('**/api/converse', async (route: Route) => {
      turn += 1;
      if (turn === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
          body: prCreationTurn('phase-d-pr', { withCreateSurface: true }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        body: prResultTurn('phase-d-pr'),
      });
    });

    const healthReady = page.waitForResponse('**/api/health', { timeout: 10_000 });
    await page.goto('/');
    await healthReady;

    await page.getByRole('textbox', { name: /describe your app/i }).fill('Create a PR for my AKS app');
    await page.getByRole('button', { name: /send/i }).click();

    // CreatePRFlow should show idle state with file list
    await expect(page.getByText('Create Pull Request')).toBeVisible();
    await expect(page.getByText('infra/main.bicep')).toBeVisible();

    // Simulate second turn (user clicks create PR → result)
    await page.getByRole('textbox', { name: /type a message/i }).fill('Create the PR now');
    await page.getByRole('button', { name: /send/i }).click();

    // SummaryCard with PR link should appear
    await expect(page.getByTestId('a2ui-SummaryCard').getByText('Pull request created')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('PR #42')).toBeVisible();

    // Verify link href
    const prLink = page.getByRole('link', { name: /PR #42/i });
    await expect(prLink).toHaveAttribute('href', 'https://github.com/octocat/kickstart-sample/pull/42');

    // Still only one shared surface
    const surfaces = page.locator('.a2ui-surface-wrapper[data-surface-id="shared:publisher-pr"]');
    await expect(surfaces).toHaveCount(1);
  });

  test('three-stage flow: auth → PR card → result summary', async ({ page }) => {
    await setupHealthRoute(page);

    let turn = 0;
    await page.route('**/api/converse', async (route: Route) => {
      turn += 1;
      switch (turn) {
        case 1:
          return route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
            body: authGateTurn('phase-d-full'),
          });
        case 2:
          return route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
            body: prCreationTurn('phase-d-full'),
          });
        default:
          return route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
            body: prResultTurn('phase-d-full'),
          });
      }
    });

    const healthReady = page.waitForResponse('**/api/health', { timeout: 10_000 });
    await page.goto('/');
    await healthReady;

    // Turn 1: AuthCard
    await page.getByRole('textbox', { name: /describe your app/i }).fill('Publish to GitHub');
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page.getByText('Sign in to create a pull request.')).toBeVisible();

    // Turn 2: CreatePRFlow
    await page.getByRole('textbox', { name: /type a message/i }).fill('I signed in');
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page.getByText('feat: kickstart infra and deploy workflow')).toBeVisible({ timeout: 10_000 });

    // Turn 3: SummaryCard result
    await page.getByRole('textbox', { name: /type a message/i }).fill('Create it');
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page.getByTestId('a2ui-SummaryCard').getByText('Pull request created')).toBeVisible({ timeout: 10_000 });

    // Verify link with external icon behavior
    const prLink = page.getByRole('link', { name: /PR #42/i });
    await expect(prLink).toHaveAttribute('href', /github\.com\/.+\/pull\/\d+/);
    await expect(prLink).toHaveAttribute('target', '_blank');

    // Only one publisher surface throughout
    const surfaces = page.locator('.a2ui-surface-wrapper[data-surface-id="shared:publisher-pr"]');
    await expect(surfaces).toHaveCount(1);
  });
});
