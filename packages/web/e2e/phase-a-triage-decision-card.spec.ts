import { test, expect } from './helpers';
import type { Page, Route } from '@playwright/test';

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function triageDecisionTurn(sessionId: string): string {
  return [
    sseEvent('start', { sessionId }),
    sseEvent('chunk', { delta: 'Let’s pick the right AKS track for your idea.' }),
    sseEvent('a2ui', {
      version: 'v0.9',
      createSurface: { surfaceId: 'shared:triage-main', catalogId: 'kickstart' },
    }),
    sseEvent('a2ui', {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'shared:triage-main',
        components: [
          { id: 'root', component: 'Column', children: ['decision', 'track-buttons'], gap: '12px' },
          {
            id: 'decision',
            component: 'DecisionCard',
            title: 'What would you like to build on AKS?',
            recommendation: 'AKS Automatic handles infrastructure, scaling, and security so you can focus on your app.',
            alternatives: ['Static site', 'Containerized web app', 'Agentic AI app', 'Existing repo uplift'],
            badge: 'recommended',
          },
          {
            id: 'track-buttons',
            component: 'Row',
            children: ['btn-static', 'btn-container', 'btn-agentic', 'btn-uplift'],
            gap: '8px',
            wrap: true,
          },
          {
            id: 'btn-static',
            component: 'Button',
            child: 'btn-static-text',
            action: { event: { name: 'pick_track', context: { value: 'static_site', label: 'Static site' } } },
          },
          { id: 'btn-static-text', component: 'Text', text: 'Static site' },
          {
            id: 'btn-container',
            component: 'Button',
            child: 'btn-container-text',
            action: { event: { name: 'pick_track', context: { value: 'containerized_web', label: 'Containerized web app' } } },
          },
          { id: 'btn-container-text', component: 'Text', text: 'Containerized web app' },
          {
            id: 'btn-agentic',
            component: 'Button',
            child: 'btn-agentic-text',
            action: { event: { name: 'pick_track', context: { value: 'agentic_app', label: 'Agentic AI app' } } },
          },
          { id: 'btn-agentic-text', component: 'Text', text: 'Agentic AI app' },
          {
            id: 'btn-uplift',
            component: 'Button',
            child: 'btn-uplift-text',
            action: { event: { name: 'pick_track', context: { value: 'repo_uplift', label: 'Existing repo uplift' } } },
          },
          { id: 'btn-uplift-text', component: 'Text', text: 'Existing repo uplift' },
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

test.describe('Phase A triage decision card', () => {
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

    await expect(page.getByText('What would you like to build on AKS?')).toBeVisible();
    await expect(page.getByRole('button', { name: /static site/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /containerized web app/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /agentic ai app/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /existing repo uplift/i })).toBeVisible();

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
