/**
 * Phase A — Triage emits DecisionCard + 4-track pick + Foundry/KAITO branch.
 *
 * #1130: validates the user-testable outcome end-to-end:
 *   1. Fresh session → type "I want to build an AI chatbot on AKS"
 *   2. DecisionCard visible with 4 track buttons
 *   3. Click "Agentic AI App" → RadioGroup with Foundry/KAITO
 *   4. Click "KAITO" → Questionnaire surfaces
 *   5. No CodeBlock in chat (D1 compliance)
 *
 * The test mocks the /api/converse endpoint so it doesn't need a live LLM.
 * Each "turn" returns the SSE events the real runner would produce after the
 * triage agent calls core.emit_ui.
 */

import { test, expect } from './helpers';

// ── SSE response builders ────────────────────────────────────────────────────

function sseResponse(events: Array<{ event: string; data: unknown }>): string {
  return events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join('');
}

// Turn 1: DecisionCard + 4 track buttons
const turn1SSE = sseResponse([
  { event: 'start', data: { sessionId: 'phase-a-test' } },
  {
    event: 'a2ui',
    data: {
      version: 'v0.9',
      createSurface: { surfaceId: 'triage-main', catalogId: 'kickstart', sendDataModel: false },
    },
  },
  {
    event: 'a2ui',
    data: {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'triage-main',
        components: [
          { id: 'root', component: 'Column', children: ['decision', 'track-buttons'] },
          {
            id: 'decision',
            component: 'DecisionCard',
            title: 'What would you like to build on AKS?',
            recommendation: 'AKS Automatic handles infrastructure, scaling, and security.',
            rationale: 'All tracks deploy to AKS Automatic.',
            alternatives: ['Static site', 'Containerized web app', 'Agentic AI app', 'Existing repo uplift'],
            badge: 'recommended',
          },
          { id: 'track-buttons', component: 'Row', children: ['btn-static', 'btn-container', 'btn-agentic', 'btn-uplift'] },
          { id: 'btn-static-text', component: 'Text', text: 'Static Site' },
          { id: 'btn-static', component: 'Button', child: 'btn-static-text', action: { event: { name: 'pick_track', payload: { value: 'static_site' } } } },
          { id: 'btn-container-text', component: 'Text', text: 'Containerized Web App' },
          { id: 'btn-container', component: 'Button', child: 'btn-container-text', action: { event: { name: 'pick_track', payload: { value: 'containerized_web' } } } },
          { id: 'btn-agentic-text', component: 'Text', text: 'Agentic AI App' },
          { id: 'btn-agentic', component: 'Button', child: 'btn-agentic-text', action: { event: { name: 'pick_track', payload: { value: 'agentic_app' } } } },
          { id: 'btn-uplift-text', component: 'Text', text: 'Existing Repo Uplift' },
          { id: 'btn-uplift', component: 'Button', child: 'btn-uplift-text', action: { event: { name: 'pick_track', payload: { value: 'repo_uplift' } } } },
        ],
      },
    },
  },
  { event: 'end', data: { sessionId: 'phase-a-test', model: 'gpt-5.4' } },
]);

// Turn 2: RadioGroup with Foundry vs KAITO (after pick_track=agentic_app)
// Each turn must createSurface because prepareChatA2ui scopes surfaceIds per turn.
const turn2SSE = sseResponse([
  { event: 'start', data: { sessionId: 'phase-a-test' } },
  {
    event: 'a2ui',
    data: {
      version: 'v0.9',
      createSurface: { surfaceId: 'triage-inference', catalogId: 'kickstart', sendDataModel: false },
    },
  },
  {
    event: 'a2ui',
    data: {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'triage-inference',
        components: [
          { id: 'root', component: 'Column', children: ['inference-group'] },
          {
            id: 'inference-group',
            component: 'RadioGroup',
            options: [
              { id: 'foundry', label: 'Azure AI Foundry', description: 'Managed model endpoints — no GPU nodes needed.', recommended: true },
              { id: 'kaito', label: 'KAITO on AKS', description: 'Run open-source models on GPU nodes in your cluster.', recommended: false },
            ],
            action: { event: { name: 'select_inference' } },
          },
        ],
      },
    },
  },
  { event: 'end', data: { sessionId: 'phase-a-test', model: 'gpt-5.4' } },
]);

// Turn 3: Questionnaire (after select_inference=kaito)
const turn3SSE = sseResponse([
  { event: 'start', data: { sessionId: 'phase-a-test' } },
  {
    event: 'a2ui',
    data: {
      version: 'v0.9',
      createSurface: { surfaceId: 'triage-kaito', catalogId: 'kickstart', sendDataModel: false },
    },
  },
  {
    event: 'a2ui',
    data: {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'triage-kaito',
        components: [
          { id: 'root', component: 'Column', children: ['kaito-form'] },
          {
            id: 'kaito-form',
            component: 'Questionnaire',
            questions: [
              { id: 'q-model', label: 'Which model?', type: 'choice', choices: [{ id: 'llama', label: 'Llama-3.1-70B' }, { id: 'mistral', label: 'Mistral-Large' }, { id: 'phi', label: 'Phi-4' }] },
              { id: 'q-gpu', label: 'GPU budget', type: 'choice', choices: [{ id: '1xa100', label: '1x A100' }, { id: '2xa100', label: '2x A100' }, { id: '4xa100', label: '4x A100' }] },
              { id: 'q-use', label: 'Describe what the agent does', type: 'text', required: true },
            ],
            submitLabel: 'Continue',
            onSubmit: { event: { name: 'kaito_answers' } },
          },
        ],
      },
    },
  },
  { event: 'end', data: { sessionId: 'phase-a-test', model: 'gpt-5.4' } },
]);

test.describe('Phase A: Triage DecisionCard flow (#1130)', () => {
  test('full 3-turn flow: DecisionCard → RadioGroup → Questionnaire, no CodeBlock', async ({ page }) => {
    let turnCount = 0;
    const turns = [turn1SSE, turn2SSE, turn3SSE];

    // Health check must return 200 so the app sends converse requests
    await page.route('**/api/health', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      }),
    );

    await page.route('**/api/converse', async (route) => {
      const sse = turns[turnCount] ?? turn1SSE;
      turnCount++;
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse,
      });
    });

    await page.goto('/');
    await page.waitForSelector('#landing-page', { timeout: 10_000 });

    // ── Turn 1: type a message and verify DecisionCard appears ───────────
    const input = page.getByRole('textbox', { name: 'Describe your app' });
    await input.fill('I want to build an AI chatbot on AKS');
    await input.press('Enter');

    // Wait for the DecisionCard title
    await expect(page.getByText('What would you like to build on AKS?')).toBeVisible({ timeout: 10_000 });

    // Verify 4 track buttons are visible
    await expect(page.getByRole('button', { name: /Static Site/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Containerized Web App/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Agentic AI App/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Existing Repo Uplift/i })).toBeVisible();

    // D1 compliance: no CodeBlock in chat
    await expect(page.locator('[data-component="CodeBlock"]')).toHaveCount(0);

    // ── Turn 2: click "Agentic AI App" → RadioGroup ──────────────────────
    await page.getByRole('button', { name: /Agentic AI App/i }).click();

    // RadioGroup should appear with Foundry and KAITO options
    await expect(page.getByText('Azure AI Foundry')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('KAITO on AKS')).toBeVisible();

    // ── Turn 3: click KAITO → Questionnaire ──────────────────────────────
    await page.getByText('KAITO on AKS').click();

    // Questionnaire should appear with model, GPU, and use case fields
    await expect(page.getByText('Which model?')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('GPU budget')).toBeVisible();
    await expect(page.getByText('Describe what the agent does')).toBeVisible();

    // D1 compliance: still no CodeBlock
    await expect(page.locator('[data-component="CodeBlock"]')).toHaveCount(0);
  });
});
