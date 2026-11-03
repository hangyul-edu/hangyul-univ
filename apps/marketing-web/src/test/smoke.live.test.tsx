/**
 * Live smoke test: renders every public route against the running API (http://localhost:8001).
 * Skipped unless HG_LIVE_API is set, e.g. `HG_LIVE_API=http://localhost:8001 npx vitest run smoke`.
 */
import { createApiClient } from '@hangyul/api-client';
import { changeLocale } from '@hangyul/i18n';
import { AppProviders } from '@hangyul/ui';
import { QueryClient } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { routes } from '../routes';

const LIVE = process.env.HG_LIVE_API;

// jsdom's AbortSignal isn't accepted by Node's native Request (used by the data router) — drop it in tests.
if (LIVE) {
  const NativeRequest = globalThis.Request;
  globalThis.Request = class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      const { signal: _signal, ...rest } = init ?? {};
      void _signal;
      super(input, rest);
    }
  } as typeof Request;
}
const PATHS = [
  // V11's six public routes, plus the catalogue's query states and one 404.
  '/', '/universities', '/universities?view=universities&partner=1', '/universities?degree=MASTER&q=Computer',
  '/universities/kyung-hee-university', '/universities/pusan-national-university',
  '/credits', '/privacy', '/terms', '/nope',
];

/** Every path V11 removed must still land somewhere useful rather than 404 (REPORT §75.1). */
const REDIRECTED = [
  '/how-it-works', '/students', '/agencies', '/universities-partners', '/trust',
  '/guides', '/guides/cost-of-studying-in-korea', '/guides/student-visa-d2-d4', '/guides/country/VN',
];

const KO_PATHS = ['/', '/universities/kyung-hee-university', '/credits'];
const CASES = [...PATHS.map((p) => ['en', p] as const), ...REDIRECTED.map((p) => ['en', p] as const), ...KO_PATHS.map((p) => ['ko', p] as const)];

describe.skipIf(!LIVE)('live smoke', () => {
  for (const [locale, path] of CASES) {
    it(`renders ${path} (${locale})`, async () => {
      await changeLocale(locale);
      Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true });
      const api = createApiClient({ baseUrl: LIVE!, client: 'marketing' });
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const router = createMemoryRouter(routes, { initialEntries: [path] });
      const errors: unknown[] = [];
      const orig = console.error;
      console.error = (...a: unknown[]) => { errors.push(a); };
      try {
        const { container } = render(<AppProviders api={api} queryClient={qc}><RouterProvider router={router} /></AppProviders>);
        await waitFor(() => expect(container.querySelector('main h1')).not.toBeNull(), { timeout: 8000 });
        await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull(), { timeout: 8000 });
        await new Promise((r) => setTimeout(r, 300));
        expect(container.querySelectorAll('h1')).toHaveLength(1);
        expect(container.querySelector('.hg-state[role="alert"]')).toBeNull();
        const text = container.textContent ?? '';
        expect(text).not.toMatch(/\b(marketing|common):[a-z]/);
        expect(text).not.toMatch(/\b(hero|seo|detail|legal|trust|catalog|search|guides|article|countryGuide)\.[a-z][a-zA-Z]+/);
        expect(document.title.length).toBeGreaterThan(5);
        expect(errors.filter((e) => !String(e).includes('not wrapped in act'))).toEqual([]);
        if (process.env.HG_SMOKE_DUMP) {
          const heads = [...container.querySelectorAll('main h1, main h2, main h3')].map((h) => `${h.tagName} ${h.textContent}`);
          console.log(`\n=== ${locale} ${path} | ${document.title}\n${heads.join('\n')}`);
        }
      } finally {
        console.error = orig;
      }
    }, 20000);
  }
});
