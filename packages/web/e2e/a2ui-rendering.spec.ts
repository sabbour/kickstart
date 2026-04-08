import { test, expect, navigateTo, sendCopilotMessage, waitForAssistantMessage, ensureCopilotOpen } from './helpers';

test.describe('A2UI Component Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/');
    await ensureCopilotOpen(page);
    await waitForAssistantMessage(page, "I'm Kickstart");
  });

  test('Text component renders content', async ({ page }) => {
    // The welcome message is a Text component
    const welcome = page.locator('.chat-bubble.assistant').first();
    await expect(welcome).toContainText("I'm Kickstart");
  });

  test('AppOverview component shows app name and status', async ({ page }) => {
    // Advance through Discover to get AppOverview
    await sendCopilotMessage(page, 'My Node.js API');
    await waitForAssistantMessage(page, 'language or framework', 5000);
    await sendCopilotMessage(page, 'Node.js with Express');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);

    const overview = page.locator('.chat-bubble.assistant .card', { hasText: 'draft' });
    await expect(overview).toBeVisible({ timeout: 3000 });
    // Should display some app name and status
    await expect(overview).toContainText(/draft/i);
  });

  test('ArchitectureDiagram shows component cards', async ({ page }) => {
    // Advance through Discover → Design
    await sendCopilotMessage(page, 'My app');
    await waitForAssistantMessage(page, 'language or framework', 5000);
    await sendCopilotMessage(page, 'Node.js');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'architecture', 5000);

    const diagram = page.locator('.chat-bubble.assistant .card', { hasText: 'Architecture' });
    await expect(diagram).toBeVisible({ timeout: 3000 });
    // Should show component names
    await expect(diagram).toContainText('Web App');
    await expect(diagram).toContainText('CI/CD');
  });

  test('CodeBlock component shows code', async ({ page }) => {
    // Advance through Discover → Design → Generate
    await sendCopilotMessage(page, 'My app');
    await waitForAssistantMessage(page, 'language or framework', 5000);
    await sendCopilotMessage(page, 'Node.js');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'architecture', 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'generated', 5000);

    const codeBlock = page.locator('.code-block').first();
    await expect(codeBlock).toBeVisible({ timeout: 3000 });
    await expect(codeBlock.locator('pre code')).not.toBeEmpty();
    // The Dockerfile code should contain FROM
    await expect(codeBlock.locator('pre code')).toContainText('FROM');
  });

  test('CostEstimate shows line items and total', async ({ page }) => {
    // Advance through Discover → Design → Generate → Review
    await sendCopilotMessage(page, 'My app');
    await waitForAssistantMessage(page, 'language or framework', 5000);
    await sendCopilotMessage(page, 'Node.js');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'architecture', 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'generated', 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'cost estimate', 5000);

    const cost = page.locator('.chat-bubble.assistant .card', { hasText: 'Estimated Monthly Cost' });
    await expect(cost).toBeVisible({ timeout: 3000 });
    await expect(cost).toContainText('App Platform');
    await expect(cost).toContainText('99.17');
  });

  test('DeploymentProgress shows step indicators', async ({ page }) => {
    // Advance all the way to Deploy
    await sendCopilotMessage(page, 'My app');
    await waitForAssistantMessage(page, 'language or framework', 5000);
    await sendCopilotMessage(page, 'Node.js');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'architecture', 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'generated', 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'cost estimate', 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'Codespaces', 5000);
    await sendCopilotMessage(page, 'Deploy');
    await waitForAssistantMessage(page, 'Deploying', 5000);

    const progress = page.locator('.chat-bubble.assistant .card', { hasText: 'Deployment Progress' });
    await expect(progress).toBeVisible({ timeout: 3000 });
    await expect(progress).toContainText('Build container image');
    await expect(progress).toContainText('Health check');
  });

  test('CodespaceLink shows action buttons', async ({ page }) => {
    // Advance through to Handoff
    await sendCopilotMessage(page, 'My app');
    await waitForAssistantMessage(page, 'language or framework', 5000);
    await sendCopilotMessage(page, 'Node.js');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'architecture', 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'generated', 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'cost estimate', 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'Codespaces', 5000);

    const link = page.locator('.chat-bubble.assistant .card', { hasText: 'Codespaces' });
    await expect(link).toBeVisible({ timeout: 3000 });
    // Should have action links/buttons
    await expect(link).toContainText(/Codespaces|vscode\.dev/);
  });

  test('WorkflowStatus shows run entries with status', async ({ page }) => {
    // Advance all the way to Deploy
    await sendCopilotMessage(page, 'My app');
    await waitForAssistantMessage(page, 'language or framework', 5000);
    await sendCopilotMessage(page, 'Node.js');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'architecture', 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'generated', 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'cost estimate', 5000);
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'Codespaces', 5000);
    await sendCopilotMessage(page, 'Deploy');
    await waitForAssistantMessage(page, 'Deploying', 5000);

    const workflow = page.locator('.chat-bubble.assistant .card-title', { hasText: 'GitHub Actions' });
    await expect(workflow).toBeVisible({ timeout: 3000 });
    // Find the parent card and verify contents
    const workflowCard = page.locator('.chat-bubble.assistant .card').filter({ has: page.locator('.card-title', { hasText: 'GitHub Actions' }) });
    await expect(workflowCard).toContainText('CI Tests');
  });
});
