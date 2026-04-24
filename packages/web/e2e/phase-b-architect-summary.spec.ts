import { test, expect } from './helpers';
import type { Page, Route } from '@playwright/test';

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * SSE turn that emits a SummaryCard with an embedded ArchitectureDiagram
 * and two action buttons (approve_plan / revise_plan).
 */
function architectSummaryTurn(sessionId: string): string {
  return [
    sseEvent('start', { sessionId }),
    sseEvent('chunk', { delta: 'Here is your AKS plan — review and approve.' }),
    sseEvent('a2ui', {
      version: 'v0.9',
      createSurface: { surfaceId: 'shared:architect-plan', catalogId: 'kickstart' },
    }),
    sseEvent('a2ui', {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'shared:architect-plan',
        components: [
          { id: 'root', component: 'Column', children: ['plan-card', 'action-row'] },
          {
            id: 'plan-card',
            component: 'SummaryCard',
            title: 'Your AKS plan',
            items: [
              { label: 'Platform', value: 'AKS Automatic', badge: 'success' },
              { label: 'AI Runtime', value: 'KAITO (Llama-3.1-70B)' },
              { label: 'Networking', value: 'Ingress Controller + TLS' },
              { label: 'Storage', value: 'Azure Files (Premium)' },
              { label: 'Estimated cost', value: '~$420/mo', badge: 'info' },
            ],
            children: ['arch-diagram'],
          },
          {
            id: 'arch-diagram',
            component: 'ArchitectureDiagram',
            title: 'Solution Architecture',
            description: 'AKS Automatic with KAITO',
            nodes: [
              { id: 'aks', label: 'AKS Automatic', type: 'aks' },
              { id: 'kaito', label: 'KAITO Model Pod', type: 'ai' },
              { id: 'ingress', label: 'Ingress Controller', type: 'networking' },
              { id: 'storage', label: 'Azure Files', type: 'storage' },
            ],
            edges: [
              { from: 'ingress', to: 'aks', label: 'HTTPS' },
              { from: 'aks', to: 'kaito', label: 'inference' },
              { from: 'kaito', to: 'storage', label: 'model weights' },
            ],
          },
          { id: 'action-row', component: 'Row', children: ['approve-btn', 'revise-btn'] },
          { id: 'approve-text', component: 'Text', text: 'Looks right — generate' },
          {
            id: 'approve-btn',
            component: 'Button',
            child: 'approve-text',
            action: { event: { name: 'approve_plan', context: { action: 'approve_plan' } } },
          },
          { id: 'revise-text', component: 'Text', text: 'Revise' },
          {
            id: 'revise-btn',
            component: 'Button',
            child: 'revise-text',
            action: { event: { name: 'revise_plan', context: { action: 'revise_plan' } } },
          },
        ],
      },
    }),
    sseEvent('end', { sessionId, model: 'test-model' }),
  ].join('');
}

/**
 * SSE turn emitted after revise_plan — updated SummaryCard with modified
 * storage on the same shared surface.
 */
function revisedSummaryTurn(sessionId: string): string {
  return [
    sseEvent('start', { sessionId }),
    sseEvent('chunk', { delta: 'Updated storage to Blob. Review the revised plan.' }),
    sseEvent('a2ui', {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'shared:architect-plan',
        components: [
          { id: 'root', component: 'Column', children: ['plan-card', 'action-row'] },
          {
            id: 'plan-card',
            component: 'SummaryCard',
            title: 'Your AKS plan',
            items: [
              { label: 'Platform', value: 'AKS Automatic', badge: 'success' },
              { label: 'AI Runtime', value: 'KAITO (Llama-3.1-70B)' },
              { label: 'Networking', value: 'Ingress Controller + TLS' },
              { label: 'Storage', value: 'Azure Blob Storage', badge: 'warning' },
              { label: 'Estimated cost', value: '~$380/mo', badge: 'info' },
            ],
            children: ['arch-diagram'],
          },
          {
            id: 'arch-diagram',
            component: 'ArchitectureDiagram',
            title: 'Solution Architecture',
            description: 'AKS Automatic with KAITO — revised',
            nodes: [
              { id: 'aks', label: 'AKS Automatic', type: 'aks' },
              { id: 'kaito', label: 'KAITO Model Pod', type: 'ai' },
              { id: 'ingress', label: 'Ingress Controller', type: 'networking' },
              { id: 'blob', label: 'Azure Blob Storage', type: 'storage' },
            ],
            edges: [
              { from: 'ingress', to: 'aks', label: 'HTTPS' },
              { from: 'aks', to: 'kaito', label: 'inference' },
              { from: 'kaito', to: 'blob', label: 'model weights' },
            ],
          },
          { id: 'action-row', component: 'Row', children: ['approve-btn', 'revise-btn'] },
          { id: 'approve-text', component: 'Text', text: 'Looks right — generate' },
          {
            id: 'approve-btn',
            component: 'Button',
            child: 'approve-text',
            action: { event: { name: 'approve_plan', context: { action: 'approve_plan' } } },
          },
          { id: 'revise-text', component: 'Text', text: 'Revise' },
          {
            id: 'revise-btn',
            component: 'Button',
            child: 'revise-text',
            action: { event: { name: 'revise_plan', context: { action: 'revise_plan' } } },
          },
        ],
      },
    }),
    sseEvent('end', { sessionId, model: 'test-model' }),
  ].join('');
}

async function setupHealthRoute(page: Page) {
  await page.route('**/api/health', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    }),
  );
}

test.describe('Phase B architect summary card', () => {
  test('renders SummaryCard with ArchitectureDiagram and approve/revise buttons', async ({ page }) => {
    await setupHealthRoute(page);

    let turn = 0;
    await page.route('**/api/converse', async (route: Route) => {
      turn += 1;
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        body: architectSummaryTurn('phase-b-architect'),
      });
    });

    const healthReady = page.waitForResponse('**/api/health', { timeout: 10_000 });
    await page.goto('/');
    await healthReady;

    await page.getByRole('textbox', { name: /describe your app/i }).fill('Build an AI chatbot on AKS with KAITO');
    await page.getByRole('button', { name: /send/i }).click();

    // SummaryCard visible with title
    await expect(page.getByText('Your AKS plan')).toBeVisible();

    // ArchitectureDiagram visible (rendered within the surface)
    const surface = page.locator('[data-surface-id="shared:architect-plan"]');
    await expect(surface).toBeVisible();

    // Action buttons visible
    await expect(page.getByRole('button', { name: /looks right/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /revise/i })).toBeVisible();

    // Only one surface for the plan
    const surfaces = page.locator('.a2ui-surface-wrapper[data-surface-id="shared:architect-plan"]');
    await expect(surfaces).toHaveCount(1);
  });

  test('revise_plan updates the plan in-place on the same surface', async ({ page }) => {
    await setupHealthRoute(page);

    let turn = 0;
    await page.route('**/api/converse', async (route: Route) => {
      turn += 1;
      if (turn === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
          body: architectSummaryTurn('phase-b-revise'),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        body: revisedSummaryTurn('phase-b-revise'),
      });
    });

    const healthReady = page.waitForResponse('**/api/health', { timeout: 10_000 });
    await page.goto('/');
    await healthReady;

    await page.getByRole('textbox', { name: /describe your app/i }).fill('Build an AI chatbot on AKS');
    await page.getByRole('button', { name: /send/i }).click();

    // Initial plan shows Azure Files
    await expect(page.getByText('Azure Files (Premium)')).toBeVisible();

    // Click revise
    await page.getByRole('button', { name: /revise/i }).click();

    // After revision — plan updates in-place with Blob
    await expect(page.getByText('Azure Blob Storage')).toBeVisible({ timeout: 10_000 });

    // Still only one plan surface
    const surfaces = page.locator('.a2ui-surface-wrapper[data-surface-id="shared:architect-plan"]');
    await expect(surfaces).toHaveCount(1);
  });
});
