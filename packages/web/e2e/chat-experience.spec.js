import { test, expect, sendChatMessage, waitForAssistantMessage, enterChatViaTrack } from './helpers';
test.describe('Chat experience (demo mode)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?mock');
        await page.waitForSelector('#landing-page', { timeout: 10_000 });
        await enterChatViaTrack(page, 'web-app');
        // Wait for welcome message before each test
        await waitForAssistantMessage(page, 'Kickstart');
    });
    test('user can type and send a message', async ({ page }) => {
        await sendChatMessage(page, 'I want to build a task tracker');
        // User message appears in chat
        const userBubbles = page.locator('.chat-bubble.user');
        await expect(userBubbles.last()).toContainText('task tracker');
    });
    test('assistant responds with content in demo mode', async ({ page }) => {
        await sendChatMessage(page, 'I want to build a task tracker');
        // Wait for demo engine to respond (800ms + rendering)
        const assistantBubbles = page.locator('.chat-bubble.assistant');
        const initialCount = await assistantBubbles.count();
        // The demo engine should produce a new assistant bubble
        await expect(async () => {
            expect(await assistantBubbles.count()).toBeGreaterThan(initialCount);
        }).toPass({ timeout: 8000 });
    });
    test('multiple turns of conversation work', async ({ page }) => {
        // First turn
        await sendChatMessage(page, 'I want to build a todo app');
        await expect(async () => {
            const count = await page.locator('.chat-bubble.assistant').count();
            // Welcome + response = at least 2 assistant bubbles
            expect(count).toBeGreaterThanOrEqual(2);
        }).toPass({ timeout: 8000 });
        // Second turn
        await sendChatMessage(page, 'It should use React and Node.js');
        await expect(async () => {
            const count = await page.locator('.chat-bubble.assistant').count();
            expect(count).toBeGreaterThanOrEqual(3);
        }).toPass({ timeout: 8000 });
        // Verify both user messages are in the chat
        const userBubbles = page.locator('.chat-bubble.user');
        // Auto-sent prompt + 2 manual messages = at least 3
        expect(await userBubbles.count()).toBeGreaterThanOrEqual(3);
    });
    test('assistant messages render with A2UI text content', async ({ page }) => {
        // The welcome message contains text from the A2UI engine
        const firstAssistant = page.locator('.chat-bubble.assistant').first();
        await expect(firstAssistant).toContainText('Kickstart');
        // Send a message to get a demo response with A2UI content
        await sendChatMessage(page, 'A todo list app');
        await expect(async () => {
            const count = await page.locator('.chat-bubble.assistant').count();
            expect(count).toBeGreaterThanOrEqual(2);
        }).toPass({ timeout: 8000 });
        // The demo response should show architecture details
        const lastAssistant = page.locator('.chat-bubble.assistant').last();
        await expect(lastAssistant).toContainText('architecture');
    });
});
//# sourceMappingURL=chat-experience.spec.js.map