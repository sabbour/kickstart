import { test, expect } from './helpers';
import type { Page, Route } from '@playwright/test';

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * SSE turn that emits a GenerationProgress surface via shared:generation-progress,
 * sends write_file tool_done events (files land in editor), and finishes with a
 * SummaryCard + publish button. Zero CodeBlock bubbles.
 */
function codesmithGenerationTurn(sessionId: string): string {
  const steps = [
    { id: 'dockerfile', label: 'Generate Dockerfile', status: 'complete' },
    { id: 'helm', label: 'Generate Helm chart', status: 'complete' },
    { id: 'kaito-crd', label: 'Generate KAITO Workspace CRD', status: 'complete' },
    { id: 'gha-workflow', label: 'Generate GitHub Actions workflow', status: 'complete' },
  ];

  return [
    sseEvent('start', { sessionId }),
    // GenerationProgress surface — uses shared: namespace for cross-chunk updates
    sseEvent('a2ui', {
      version: 'v0.9',
      createSurface: { surfaceId: 'shared:generation-progress', catalogId: 'kickstart' },
    }),
    // Initial progress — steps pending
    sseEvent('a2ui', {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'shared:generation-progress',
        components: [
          {
            id: 'root',
            component: 'GenerationProgress',
            title: 'Project Setup',
            overallStatus: 'running',
            steps: steps.map((s) => ({ ...s, status: 'pending' })),
          },
        ],
      },
    }),
    // Simulate tool_done for write_file calls — files land in editor pane
    sseEvent('tool_start', { toolName: 'core.write_file' }),
    sseEvent('tool_done', {
      toolName: 'core.write_file',
      path: 'Dockerfile',
      content: 'FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["node", "server.js"]',
    }),
    sseEvent('tool_start', { toolName: 'core.write_file' }),
    sseEvent('tool_done', {
      toolName: 'core.write_file',
      path: 'charts/app/Chart.yaml',
      content: 'apiVersion: v2\nname: my-app\nversion: 0.1.0',
    }),
    sseEvent('tool_start', { toolName: 'core.write_file' }),
    sseEvent('tool_done', {
      toolName: 'core.write_file',
      path: 'kaito-workspace.yaml',
      content: 'apiVersion: kaito.sh/v1alpha1\nkind: Workspace\nmetadata:\n  name: llama-3',
    }),
    sseEvent('tool_start', { toolName: 'core.write_file' }),
    sseEvent('tool_done', {
      toolName: 'core.write_file',
      path: '.github/workflows/deploy.yaml',
      content: 'name: Deploy\non:\n  push:\n    branches: [main]',
    }),
    // Final progress — all steps complete
    sseEvent('a2ui', {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'shared:generation-progress',
        components: [
          {
            id: 'root',
            component: 'GenerationProgress',
            title: 'Project Setup',
            overallStatus: 'complete',
            statusMessage: 'Generated 4 files across Dockerfile, Helm, KAITO CRD, GHA.',
            steps,
          },
        ],
      },
    }),
    // SummaryCard with publish action
    sseEvent('a2ui', {
      version: 'v0.9',
      createSurface: { surfaceId: 'shared:generation-summary', catalogId: 'kickstart' },
    }),
    sseEvent('a2ui', {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'shared:generation-summary',
        components: [
          { id: 'root', component: 'Column', children: ['summary', 'publish-btn'] },
          {
            id: 'summary',
            component: 'SummaryCard',
            title: 'Generation complete',
            items: [
              { label: 'Files generated', value: '4' },
              { label: 'Includes', value: 'Dockerfile, Helm, KAITO CRD, GHA' },
            ],
          },
          { id: 'publish-text', component: 'Text', text: 'Publish to GitHub' },
          {
            id: 'publish-btn',
            component: 'Button',
            appearance: 'primary',
            child: 'publish-text',
            action: { event: { name: 'publish', context: { action: 'publish' } } },
          },
        ],
      },
    }),
    sseEvent('chunk', { delta: 'Generated 4 files. Review them in the editor, then publish.' }),
    sseEvent('end', { sessionId, model: 'test-model' }),
  ].join('');
}

async function setupHealthRoute(page: Page) {
  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    }),
  );
}

test.describe('Phase C codesmith generation progress', () => {
  test('renders GenerationProgress, files land in editor, SummaryCard with publish, zero CodeBlocks', async ({
    page,
  }) => {
    await setupHealthRoute(page);

    await page.route('**/api/converse', async (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        body: codesmithGenerationTurn('phase-c-codesmith'),
      }),
    );

    const healthReady = page.waitForResponse('**/api/health', { timeout: 10_000 });
    await page.goto('/');
    await healthReady;

    await page.getByRole('textbox', { name: /describe your app/i }).fill('Build an AI app on AKS');
    await page.getByRole('button', { name: /send/i }).click();

    // GenerationProgress visible with test ID
    const progressCard = page.getByTestId('a2ui-GenerationProgress');
    await expect(progressCard).toBeVisible({ timeout: 10_000 });

    // All 4 steps rendered with data-step attributes
    const steps = progressCard.locator('[data-step]');
    await expect(steps).toHaveCount(4);

    // Steps have the expected IDs
    await expect(steps.nth(0)).toHaveAttribute('data-step', 'dockerfile');
    await expect(steps.nth(1)).toHaveAttribute('data-step', 'helm');
    await expect(steps.nth(2)).toHaveAttribute('data-step', 'kaito-crd');
    await expect(steps.nth(3)).toHaveAttribute('data-step', 'gha-workflow');

    // GenerationProgress shared surface stays singular
    const progressSurface = page.locator('[data-surface-id="shared:generation-progress"]');
    await expect(progressSurface).toHaveCount(1);

    // SummaryCard visible with publish button
    const summaryCard = page.getByTestId('a2ui-SummaryCard');
    await expect(summaryCard).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /publish/i })).toBeVisible();

    // Zero CodeBlock bubbles in the chat transcript
    await expect(page.locator('[data-component="CodeBlock"]')).toHaveCount(0);
  });

  test('write_file tool events route files to the file manager sidebar', async ({ page }) => {
    await setupHealthRoute(page);

    await page.route('**/api/converse', async (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        body: codesmithGenerationTurn('phase-c-files'),
      }),
    );

    const healthReady = page.waitForResponse('**/api/health', { timeout: 10_000 });
    await page.goto('/');
    await healthReady;

    await page.getByRole('textbox', { name: /describe your app/i }).fill('Build an AI app');
    await page.getByRole('button', { name: /send/i }).click();

    // Wait for the generation to complete
    await expect(page.getByTestId('a2ui-GenerationProgress')).toBeVisible({ timeout: 10_000 });

    // File manager sidebar should be visible (auto-opens when files appear)
    const fileManager = page.getByTestId('file-manager-sidebar');
    await expect(fileManager).toBeVisible({ timeout: 10_000 });
  });
});
