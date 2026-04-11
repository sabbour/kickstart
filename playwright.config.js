"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
exports.default = (0, test_1.defineConfig)({
    testDir: './packages/web/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    timeout: 30_000,
    use: {
        baseURL: 'http://localhost:4281',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...test_1.devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npx serve packages/web/dist -l 4281 --no-clipboard',
        port: 4281,
        reuseExistingServer: !process.env.CI,
    },
});
//# sourceMappingURL=playwright.config.js.map