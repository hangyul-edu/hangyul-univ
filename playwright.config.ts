import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the running development stack (`npm run dev`).
 * One worker: the reference machine has ~5 GB RAM.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // E2E users are named e2e-…@example.com and purged afterwards (set HG_E2E_KEEP=1 to keep them for debugging).
  globalTeardown: './e2e/global-teardown.ts',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'en-US' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /responsive\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8001/healthz',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
