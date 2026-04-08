import { test, expect, navigateTo, sendCopilotMessage, waitForAssistantMessage, ensureCopilotOpen } from './helpers';

test.describe('Copilot Panel', () => {
  test('panel toggles open and closed via command bar', async ({ page }) => {
    await navigateTo(page, '/');
    const panel = page.locator('#copilot-panel');

    // Close it if open
    if (!(await panel.evaluate(el => el.classList.contains('hidden')))) {
      await page.locator('[data-action="toggle-copilot"]').click();
      await expect(panel).toHaveClass(/hidden/);
    }

    // Open it
    await page.locator('[data-action="toggle-copilot"]').click();
    await expect(panel).not.toHaveClass(/hidden/);

    // Close again
    await page.locator('[data-action="toggle-copilot"]').click();
    await expect(panel).toHaveClass(/hidden/);
  });

  test('panel shows phase indicators', async ({ page }) => {
    await navigateTo(page, '/');
    await ensureCopilotOpen(page);

    const phases = page.locator('.copilot-phase-step');
    await expect(phases).toHaveCount(6);

    const labels = await phases.allTextContents();
    expect(labels.map(l => l.trim())).toEqual([
      'Discover', 'Design', 'Generate', 'Review', 'Handoff', 'Deploy',
    ]);
  });

  test('welcome message appears on load', async ({ page }) => {
    await navigateTo(page, '/');
    await ensureCopilotOpen(page);

    await waitForAssistantMessage(page, "I'm Kickstart");
  });

  test('user can type and send a message', async ({ page }) => {
    await navigateTo(page, '/');
    await ensureCopilotOpen(page);
    await waitForAssistantMessage(page, "I'm Kickstart");

    await sendCopilotMessage(page, 'Hello Kickstart');

    // User bubble should appear
    await expect(page.locator('.chat-bubble.user', { hasText: 'Hello Kickstart' })).toBeVisible();
  });

  test('assistant response appears after sending', async ({ page }) => {
    await navigateTo(page, '/');
    await ensureCopilotOpen(page);
    await waitForAssistantMessage(page, "I'm Kickstart");

    await sendCopilotMessage(page, 'I want to build a web app');

    // Wait for the scripted response (~800ms delay)
    await waitForAssistantMessage(page, 'language or framework', 5000);
  });

  test('chat input is cleared after sending', async ({ page }) => {
    await navigateTo(page, '/');
    await ensureCopilotOpen(page);
    await waitForAssistantMessage(page, "I'm Kickstart");

    const textarea = page.locator('.copilot-textarea');
    await textarea.fill('test message');
    await textarea.press('Enter');

    await expect(textarea).toHaveValue('');
  });

  test('typing indicator shows briefly before response', async ({ page }) => {
    await navigateTo(page, '/');
    await ensureCopilotOpen(page);
    await waitForAssistantMessage(page, "I'm Kickstart");

    await sendCopilotMessage(page, 'Building a Node.js API');

    // Typing indicator should appear (within the 800ms delay)
    await expect(page.locator('.typing-indicator')).toBeVisible({ timeout: 2000 });
  });

  test('multiple messages create scrollable chat history', async ({ page }) => {
    await navigateTo(page, '/');
    await ensureCopilotOpen(page);
    await waitForAssistantMessage(page, "I'm Kickstart");

    // Send first message
    await sendCopilotMessage(page, 'A Node.js app');
    await waitForAssistantMessage(page, 'language or framework', 5000);

    // Send second message
    await sendCopilotMessage(page, 'Node.js with Express');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);

    // Multiple chat bubbles exist
    const bubbles = page.locator('.chat-bubble');
    const count = await bubbles.count();
    expect(count).toBeGreaterThanOrEqual(4); // welcome + user + response + user + response
  });

  test('phase indicator updates when conversation advances', async ({ page }) => {
    await navigateTo(page, '/');
    await ensureCopilotOpen(page);
    await waitForAssistantMessage(page, "I'm Kickstart");

    // Initially Discover is active
    const discoverDot = page.locator('.copilot-phase-dot').first();
    await expect(discoverDot).toHaveClass(/active/);

    // Send two messages to advance through Discover
    await sendCopilotMessage(page, 'A Node.js API');
    await waitForAssistantMessage(page, 'language or framework', 5000);

    await sendCopilotMessage(page, 'Express with PostgreSQL');
    await waitForAssistantMessage(page, "Here's what I understand", 5000);

    // Phase should have advanced — Discover should now be completed
    await expect(discoverDot).toHaveClass(/completed/);
  });
});
