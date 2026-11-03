import { defineConfig } from 'vitest/config';

/** V22 — native sign-up logic and API-integration tests (brief §26). Pure modules run in Node; nothing here renders React Native. */
export default defineConfig({
  // V32: the *.integration.test.ts suite needs a running API and creates an account, so it runs only when one is given
  // (HG_QA_API) — `qa:v32` runs it on the isolated e2e stack (scripts/qa/e2e-run.mjs --vitest apps/student-mobile).
  test: { environment: 'node', include: ['src/**/*.test.ts'], exclude: process.env.HG_QA_API ? [] : ['**/*.integration.test.ts', '**/node_modules/**'], testTimeout: 30_000, hookTimeout: 30_000 },
  resolve: { alias: { '@hangyul/mobile-ui': new URL('./src/signup/__mocks__/mobile-ui.ts', import.meta.url).pathname } },
});
