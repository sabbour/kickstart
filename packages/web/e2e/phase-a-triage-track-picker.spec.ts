import { test, expect } from './helpers';
import type { Page, Route } from '@playwright/test';

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function triageDecisionTurn(sessionId: string): string {
  return [
    sseEvent('start', { sessionId }),
    sseEvent('chunk', { delta: 'Let\u2019s pick the right AKS track for your idea.' }),
    sseEvent('a2ui', {
      version: 'v0.9',
      createSurface: { surfaceId: 'shared:triage-main', catalogId: 'kickstart' },
    }),
    sseEvent('a2ui', {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'shared:triage-main',
        components: [
          { id: 'root', component: 'Column', children: ['track-picker'] },
          {
            id: 'track-picker',
            component: 'TrackPicker',
            title: 'What would you like to build on AKS?',
            tracks: [
              { id: 'static_site', label: 'Static site', description: 'Deploy a static web app on AKS with Ingress' },
              { id: 'containerized_web', label: 'Containerized web app', description: 'Deploy a containerized web application on AKS Automatic' },
              { id: 'agentic_app', label: 'Agentic AI app', description: 'Build and deploy an AI-powered agent or chatbot on AKS Automatic' },
              { id: 'repo_uplift', label: 'Existing repo uplift', description: 'Containerize and deploy an existing repository to AKS Automatic' },
            ],
          },
        ],
      },
    }),
    sseEvent('end', { sessionId, model: 'test-model' }),
  ].join('');
}

function triageInferenceTurn(sessionId: string): string {
  return [
    sseEvent('start', { sessionId }),
    sseEvent('a2ui', {
      version: 'v0.9',
      createSurface: { surfaceId: 'shared:triage-main', catalogId: 'kickstart' },
    }),
    sseEvent('a2ui', {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'shared:triage-main',
        components: [
          { id: 'root', component: 'Column', children: ['inference'] },
          {
            id: 'inference',
            component: 'RadioGroup',
            options: [
              { id: 'foundry', label: 'Azure AI Foundry agents', description: 'Managed agent tooling and orchestration' },
              { id: 'kaito', label: 'KAITO-hosted OSS model', description: 'More control over the model stack' },
            ],
            action: { event: { name: 'select_inference' } },
          },
        ],
      },
    }),
    sseEvent('end', { sessionId, model: 'test-model' }),
  ].join('');
}

function triageQuestionnaireTurn(sessionId: string): string {
  return [
    sseEvent('start', { sessionId }),
    sseEvent('a2ui', {
      version: 'v0.9',
      createSurface: { surfaceId: 'shared:triage-main', catalogId: 'kickstart' },
    }),
    sseEvent('a2ui', {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'shared:triage-main',
        components: [
          { id: 'root', component: 'Column', children: ['requirements'] },
          {
            id: 'requirements',
            component: 'Questionnaire',
            submitLabel: 'Continue',
            questions: [
              {
                id: 'model-family',
                label: 'Model family',
                type: 'choice',
                choices: [
                  { id: 'llama', label: 'Llama' },
                  { id: 'mistral', label: 'Mistral' },
                ],
                required: true,
              },
              { id: 'gpu-budget', label: 'GPU budget', required: true },
              { id: 'data-source', label: 'Primary data source' },
            ],
            onSubmit: { event: { name: 'submit_requirements' } },
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

test.describe('Phase A triage track picker', () => {
  test('keeps the shared triage surface stable across pick_track and select_inference', async ({ page }) => {
    await setupHealthRoute(page);

    let turn = 0;
    await page.route('**/api/converse', async (route: Route) => {
      turn += 1;

      if (turn === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
          body: triageDecisionTurn('phase-a-triage'),
        });
      }

      if (turn === 2) {
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
          body: triageInferenceTurn('phase-a-triage'),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        body: triageQuestionnaireTurn('phase-a-triage'),
      });
    });

    const healthReady = page.waitForResponse('**/api/health', { timeout: 10_000 });
    await page.goto('/');
    await healthReady;

    await page.getByRole('textbox', { name: /describe your app/i }).fill('I want to build an AI chatbot on AKS');
    await page.getByRole('button', { name: /send/i }).click();

    // TrackPicker renders with title and 4 equal-weight tiles (buttons)
    await expect(page.getByText('What would you like to build on AKS?')).toBeVisible();
    await expect(page.getByTestId('a2ui-TrackPicker')).toBeVisible();
    await expect(page.getByRole('button', { name: /static site/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /containerized web app/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /agentic ai app/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /existing repo uplift/i })).toBeVisible();

    // No DecisionCard or recommendation badge present
    await expect(page.locator('[data-testid="a2ui-DecisionCard"]')).toHaveCount(0);

    const surfaces = page.locator('.a2ui-surface-wrapper');
    await expect(surfaces).toHaveCount(1);
    await expect(surfaces.first()).toHaveAttribute('data-surface-id', 'shared:triage-main');

    await page.getByRole('button', { name: /agentic ai app/i }).click();

    await expect(page.getByRole('radiogroup', { name: /options/i })).toBeVisible();
    await expect(page.getByText(/azure ai foundry agents/i)).toBeVisible();
    await expect(page.getByText(/kaito-hosted oss model/i)).toBeVisible();
    await expect(surfaces).toHaveCount(1);
    await expect(surfaces.first()).toHaveAttribute('data-surface-id', 'shared:triage-main');

    await page.getByRole('radio', { name: /kaito-hosted oss model/i }).click();

    await expect(page.getByText(/model family/i)).toBeVisible();
    await expect(surfaces).toHaveCount(1);
    await expect(surfaces.first()).toHaveAttribute('data-surface-id', 'shared:triage-main');
    await expect(page.locator('[data-surface-id^="assistant-turn-2::"], [data-surface-id^="assistant-turn-3::"]')).toHaveCount(0);
    await expect(page.locator('[data-component="CodeBlock"]')).toHaveCount(0);
  });
});
