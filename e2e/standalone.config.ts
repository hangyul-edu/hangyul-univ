/**
 * Playwright config for the specs that need no API or database — `auth-entry-flash.spec.ts` (API mocked with
 * `page.route`) and `student-scroll.spec.ts` (Design Preview fixtures). The main config starts the whole development
 * stack; these only need a served student build:
 *
 *   (cd apps/student-web && npx vite build --outDir /tmp/sw && npx vite preview --outDir /tmp/sw --port 4711)
 *   HG_E2E_STUDENT=http://localhost:4711 npx playwright test -c e2e/standalone.config.ts auth-entry-flash
 *
 *   (cd apps/student-web && VITE_ENABLE_DESIGN_PREVIEW=1 npx vite build --outDir /tmp/swp && npx vite preview --outDir /tmp/swp --port 4712)
 *   HG_E2E_STUDENT_PREVIEW=http://localhost:4712 npx playwright test -c e2e/standalone.config.ts student-scroll
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /(auth-entry-flash|student-scroll)\.spec\.ts/,
  timeout: 240_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, locale: 'en-US' },
});
