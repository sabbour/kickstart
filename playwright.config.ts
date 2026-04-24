import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './packages/web/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? '50%' : undefined,
  reporter: 'html',
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:4281',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'golden',
      testDir: './packages/web/e2e/golden',
      use: {
        ...devices['Desktop Chrome'],
        // Disable trace/video in golden tests to prevent credential leakage
        trace: process.env.GOLDEN_LIVE_MODE === 'true' ? 'off' : 'on-first-retry',
        video: 'off',
      },
    },
  ],

  webServer: {
    command: 'npx serve packages/web/dist -l 4281 --no-clipboard',
    port: 4281,
    reuseExistingServer: !process.env.CI,
  },
});
