import { defineConfig } from 'vitest/config';

/** V22 — native sign-up logic and API-integration tests (brief §26). Pure modules run in Node; nothing here renders React Native. */
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 30_000 },
  resolve: { alias: { '@hangyul/mobile-ui': new URL('./src/signup/__mocks__/mobile-ui.ts', import.meta.url).pathname } },
});
