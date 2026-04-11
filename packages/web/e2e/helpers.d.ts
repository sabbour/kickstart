import { type Page } from '@playwright/test';
/**
 * Shared test fixture that mocks MSAL and forces demo mode
 * so the app renders without authentication or a real API backend.
 */
export declare const test: import("@playwright/test").TestType<import("@playwright/test").PlaywrightTestArgs & import("@playwright/test").PlaywrightTestOptions & {
    mockAuth: void;
}, import("@playwright/test").PlaywrightWorkerArgs & import("@playwright/test").PlaywrightWorkerOptions>;
export { expect } from '@playwright/test';
/** Type a message in the chat textarea and press Enter. */
export declare function sendChatMessage(page: Page, text: string): Promise<void>;
/** Wait for an assistant response bubble containing the given text. */
export declare function waitForAssistantMessage(page: Page, partialText: string, timeoutMs?: number): Promise<void>;
/** Transition from landing to chat by clicking a track card. */
export declare function enterChatViaTrack(page: Page, track: 'web-app' | 'agentic-app'): Promise<void>;
//# sourceMappingURL=helpers.d.ts.map