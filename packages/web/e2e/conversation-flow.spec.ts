import { test, expect, navigateTo, sendCopilotMessage, waitForAssistantMessage, ensureCopilotOpen } from './helpers';

test.describe('Conversation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/');
    await ensureCopilotOpen(page);
    await waitForAssistantMessage(page, "I'm Kickstart");
  });

  test('Discover phase → send app description → get response', async ({ page }) => {
    // Turn 1: send description
    await sendCopilotMessage(page, 'A Node.js API with PostgreSQL');
    await waitForAssistantMessage(page, 'language or framework', 5000);

    // Turn 2: send runtime → get AppOverview → advance to Design
    await sendCopilotMessage(page, 'Express with Node.js');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);

    // AppOverview component should be rendered (card with status badge)
    await expect(page.locator('.chat-bubble.assistant', { hasText: 'draft' })).toBeVisible({ timeout: 3000 });
  });

  test('Design phase shows ArchitectureDiagram', async ({ page }) => {
    // Advance through Discover (2 turns)
    await sendCopilotMessage(page, 'My cool API');
    await waitForAssistantMessage(page, 'language or framework', 5000);
    await sendCopilotMessage(page, 'Node.js');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);

    // Now in Design — send anything to trigger design response
    await sendCopilotMessage(page, 'Looks good');
    await waitForAssistantMessage(page, 'architecture', 5000);

    await expect(page.locator('.chat-bubble.assistant .card', { hasText: 'Architecture' })).toBeVisible({ timeout: 3000 });
  });

  test('Generate phase shows CodeBlock components', async ({ page }) => {
    // Discover
    await sendCopilotMessage(page, 'My app');
    await waitForAssistantMessage(page, 'language or framework', 5000);
    await sendCopilotMessage(page, 'Node.js');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);

    // Design
    await sendCopilotMessage(page, 'Looks good');
    await waitForAssistantMessage(page, 'architecture', 5000);

    // Generate
    await sendCopilotMessage(page, 'Generate the files');
    await waitForAssistantMessage(page, 'generated', 5000);

    await expect(page.locator('.code-block').first()).toBeVisible({ timeout: 3000 });
  });

  test('Review phase shows CostEstimate component', async ({ page }) => {
    // Discover
    await sendCopilotMessage(page, 'My app');
    await waitForAssistantMessage(page, 'language or framework', 5000);
    await sendCopilotMessage(page, 'Node.js');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);

    // Design
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'architecture', 5000);

    // Generate
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'generated', 5000);

    // Review
    await sendCopilotMessage(page, 'Review');
    await waitForAssistantMessage(page, 'cost estimate', 5000);

    await expect(page.locator('.chat-bubble.assistant .card', { hasText: 'Estimated Monthly Cost' })).toBeVisible({ timeout: 3000 });
  });

  test('Handoff phase shows CodespaceLink component', async ({ page }) => {
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

    // Handoff
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'Codespaces', 5000);

    await expect(page.locator('.chat-bubble.assistant', { hasText: 'Open in Codespaces' })).toBeVisible({ timeout: 3000 });
  });

  test('Deploy phase shows DeploymentProgress component', async ({ page }) => {
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

    // Deploy
    await sendCopilotMessage(page, 'Deploy now');
    await waitForAssistantMessage(page, 'Deploying', 5000);

    await expect(page.locator('.chat-bubble.assistant .card', { hasText: 'Deployment Progress' })).toBeVisible({ timeout: 3000 });
  });

  test('phase indicator correctly marks completed phases', async ({ page }) => {
    // Advance through Discover
    await sendCopilotMessage(page, 'My app');
    await waitForAssistantMessage(page, 'language or framework', 5000);
    await sendCopilotMessage(page, 'Node.js');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);

    // Advance through Design
    await sendCopilotMessage(page, 'OK');
    await waitForAssistantMessage(page, 'architecture', 5000);

    // Now in Generate — Discover and Design should be completed
    const dots = page.locator('.copilot-phase-dot');
    await expect(dots.nth(0)).toHaveClass(/completed/); // Discover
    await expect(dots.nth(1)).toHaveClass(/completed/); // Design
    await expect(dots.nth(2)).toHaveClass(/active/);    // Generate
  });
});
