/**
 * **Server-free review mode** (V17, REPORT §153).
 *
 * A stakeholder must be able to open a link and walk marketing, student, agency and university with
 * FastAPI, Postgres and Redis all switched off. This is the whole of how that works.
 *
 * ---------------------------------------------------------------------------------------------------------
 * **One seam, not a flag per component.** `createApiClient` already accepts a `fetchImpl`, and every app
 * constructs the client exactly once in `bootWebApp`. So review mode is a different `fetch` — one that
 * answers from a bundle captured at build time — and **not a single component, page, query or hook knows it
 * exists**. The brief rules out scattering `if (reviewMode)` through the tree and it is right to: a product
 * with two behaviours per screen has twice the screens and half the testing.
 *
 * **The fixtures are real responses.** `scripts/review/export-fixtures.mjs` signs in as each seeded persona
 * against a live dev stack and records what the API actually returned. Hand-written mocks drift from the
 * server within a week and then the review build starts lying about shapes; captured ones cannot, because
 * regenerating them is a single command against the same seed.
 *
 * **It cannot ship by accident.** `VITE_REVIEW_MODE` is a build-time literal. In a production build it is
 * unset, `REVIEW` folds to `false`, this module's only caller is dead code, and Vite drops both it and the
 * fixture JSON it imports — the same build-time boundary V16 §138.6b arrived at for the test-login chunk,
 * reused deliberately rather than reinvented.
 *
 * **It does not fake a payment.** Writes are not served from fixtures: a POST that would charge somebody
 * answers `503 REVIEW_MODE`, the student app renders that as one restrained line at the pay button, and
 * every other surface looks like the product because it *is* the product (brief §43).
 */

/** One captured response: the status and body the live API returned for this method+path+query. */
export interface ReviewEntry { status: number; body: unknown }
export interface ReviewBundle {
  generated_at: string;
  /** Keyed `"<METHOD> <path><?query>"`, exactly as `key()` builds it. */
  routes: Record<string, ReviewEntry>;
  /**
   * The persona's **token response**, if the bundle has one. Not a trimmed session object: `auth.restore()`
   * POSTs `/auth/refresh` and hands the result straight to `setSession`, which needs `access_token` as well
   * as the user. A session-shaped value here boots the preview to a sign-in screen.
   */
  session?: unknown;
}

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** The lookup key for a request. Query order is normalised so `?a=1&b=2` and `?b=2&a=1` are one entry. */
export function reviewKey(method: string, url: string): string {
  const u = new URL(url, 'http://review.local');
  const params = [...u.searchParams.entries()].filter(([, v]) => v !== '' && v !== 'undefined').sort();
  const qs = params.length ? `?${params.map(([k, v]) => `${k}=${v}`).join('&')}` : '';
  return `${method.toUpperCase()} ${u.pathname}${qs}`;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * A `fetch` that answers from the bundle.
 *
 * Resolution, in order:
 *   1. a **write** → `503 REVIEW_MODE`. Nothing in a shared preview may claim a transaction happened.
 *   2. an exact `METHOD path?query` hit;
 *   3. the same path with its query dropped;
 *   4. **any** capture of the same path, whatever query it carries — a filtered or differently-paginated
 *      list falls back to a page of the same endpoint's real data, which is right for review: the reviewer
 *      sees a populated screen rather than an empty state produced by a query nobody captured. This step
 *      is the one that matters in practice, because a list page asks for `?page=1&page_size=24&sort=…` and
 *      the capture holds `?page=1&page_size=24` — step 3 cannot bridge that, and without step 4 three of
 *      the preview's sixteen links rendered a 404 page;
 *   5. `404` with an explanatory body, which the apps' existing error states already render.
 *
 * Auth is answered locally: `/auth/session` returns the captured persona so the app boots signed in, and
 * `/auth/logout` succeeds so the control still works.
 */
/**
 * The shortest capture of this exact path, under any query.
 *
 * Shortest rather than first: among `?page=1&page_size=24` and `?page=1&page_size=24&region=Seoul`, the
 * one without the filter is the one a reviewer should see when they asked for neither. The index is built
 * once per bundle, because this runs on every request that misses.
 */
const looseIndex = new WeakMap<ReviewBundle, Map<string, ReviewEntry>>();
function looseMatch(bundle: ReviewBundle, method: string, path: string): ReviewEntry | undefined {
  let index = looseIndex.get(bundle);
  if (!index) {
    index = new Map();
    const shortest = new Map<string, number>();
    for (const [key, entry] of Object.entries(bundle.routes)) {
      const sp = key.indexOf(' ');
      if (sp < 0) continue;
      const m = key.slice(0, sp);
      const rest = key.slice(sp + 1);
      const q = rest.indexOf('?');
      const k = `${m} ${q < 0 ? rest : rest.slice(0, q)}`;
      const len = q < 0 ? 0 : rest.length - q;
      if (!shortest.has(k) || len < (shortest.get(k) as number)) { shortest.set(k, len); index.set(k, entry); }
    }
    looseIndex.set(bundle, index);
  }
  return index.get(`${method.toUpperCase()} ${path}`);
}

export function reviewFetch(bundle: ReviewBundle): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET') ?? 'GET').toUpperCase();
    const path = new URL(url, 'http://review.local').pathname;

    // `/auth/me` is the path `AuthProvider` boots with; `/auth/session` and `/auth/refresh` are kept so a
    // future rename does not silently log the preview out.
    if (path.endsWith('/auth/me') || path.endsWith('/auth/session') || path.endsWith('/auth/refresh')) {
      return bundle.session ? json(200, bundle.session) : json(401, { detail: 'No session in this preview.' });
    }
    if (path.endsWith('/auth/logout')) return json(200, {});

    if (WRITE.has(method)) {
      // The one place the preview admits what it is — and the only place (brief §43).
      return json(503, {
        detail: {
          code: 'REVIEW_MODE',
          message: 'This is a shared preview. Payments and changes are switched off.',
        },
      });
    }

    const exact = bundle.routes[reviewKey(method, url)];
    if (exact) return json(exact.status, exact.body);
    const bare = bundle.routes[reviewKey(method, path)];
    if (bare) return json(bare.status, bare.body);
    const loose = looseMatch(bundle, method, path);
    if (loose) return json(loose.status, loose.body);
    return json(404, { detail: { code: 'REVIEW_MISS', path, message: 'Not captured in this preview.' } });
  };
}
