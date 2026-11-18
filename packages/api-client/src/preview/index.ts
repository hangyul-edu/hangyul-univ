/**
 * **Design Preview transport** — the owner-review mode's only data source.
 *
 * Design Preview lets the owner walk the signed-in and paid screens without an account or a payment. It is
 * NOT a sign-in: no credential is accepted, no session is issued, and nothing here ever reaches the network.
 * `createApiClient` takes a `fetchImpl`; in Design Preview that function is `previewFetch`, which answers every
 * request from the deterministic synthetic bundles in this folder. The isolation is structural: the real
 * `fetch` is simply not in the client, so a preview screen cannot read a real record, mutate the database,
 * start a payment, send a message or upload a file — there is no code path that could.
 *
 *   reads    answered from the bundle (exact key → same path without query → any capture of that path);
 *            an unknown path answers 404, which the pages' own empty/error states render.
 *   writes   never performed. They answer `503 DESIGN_PREVIEW` so the UI shows one calm line.
 *   auth     `/auth/refresh` returns the bundle's synthetic persona (placeholder token, no refresh token);
 *            `/auth/login` is refused — a real credential typed in preview goes nowhere.
 *
 * The whole feature is behind ONE build flag (`VITE_ENABLE_DESIGN_PREVIEW`, read in `@hangyul/ui`
 * `design-preview.tsx`). With the flag off this module is unreachable and Vite drops it and the bundles.
 */
export type PreviewApp = 'student' | 'agency' | 'university';
/** `paid` shows the entitled product; `unpaid` shows the same synthetic student before buying a plan. */
export type PreviewVariant = 'paid' | 'unpaid';

interface Entry { status: number; body: unknown }
export interface PreviewBundle { generated_at: string; session: unknown; routes: Record<string, Entry> }

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Lookup key for a request; query order is normalised so `?a=1&b=2` and `?b=2&a=1` are one entry. */
export function previewKey(method: string, url: string): string {
  const u = new URL(url, 'http://preview.invalid');
  const params = [...u.searchParams.entries()].filter(([, v]) => v !== '' && v !== 'undefined').sort();
  const qs = params.length ? `?${params.map(([k, v]) => `${k}=${v}`).join('&')}` : '';
  return `${method.toUpperCase()} ${u.pathname}${qs}`;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function loosest(bundle: PreviewBundle): Map<string, Entry> {
  const index = new Map<string, Entry>();
  const shortest = new Map<string, number>();
  for (const [key, entry] of Object.entries(bundle.routes)) {
    const sp = key.indexOf(' ');
    const rest = key.slice(sp + 1);
    const q = rest.indexOf('?');
    const k = `${key.slice(0, sp)} ${q < 0 ? rest : rest.slice(0, q)}`;
    const len = q < 0 ? 0 : rest.length - q;
    if (!shortest.has(k) || len < (shortest.get(k) as number)) { shortest.set(k, len); index.set(k, entry); }
  }
  return index;
}

/**
 * The unpaid variant: the same synthetic student before buying a plan — the paywall, plan cards and gate notices.
 * Derived from the paid bundle so the two can never drift apart.
 */
function unpaidBody(key: string, body: unknown): unknown {
  if (key === 'GET /api/v1/me/plan') return null;
  if (key === 'GET /api/v1/me/orders' || key === 'GET /api/v1/me/add-ons') return [];
  if (key === 'GET /api/v1/me/services' && body && typeof body === 'object') return { ...body, owned: [], plan: null, history: [], now: [] };
  return body;
}

export function previewFetch(bundle: PreviewBundle, variant: PreviewVariant = 'paid'): typeof fetch {
  const loose = loosest(bundle);
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET') ?? 'GET').toUpperCase();
    const path = new URL(url, 'http://preview.invalid').pathname;

    if (path.endsWith('/auth/refresh') || path.endsWith('/auth/me')) return json(200, bundle.session);
    if (path.endsWith('/auth/logout')) return json(200, {});
    if (WRITE.has(method)) {
      ((globalThis as { __hgPreviewWrites?: string[] }).__hgPreviewWrites ??= []).push(`${method} ${path}`);
      return json(503, { detail: 'Design Preview — this is sample data. Changes, payments and messages are switched off.', code: 'DESIGN_PREVIEW' });
    }
    const key = previewKey(method, url);
    const hit = bundle.routes[key] ?? bundle.routes[`${method} ${path}`] ?? loose.get(`${method} ${path}`);
    if (hit) return json(hit.status, variant === 'unpaid' ? unpaidBody(`${method} ${path}`, hit.body) : hit.body);
    // Recorded for `scripts/qa/launch-final/preview.mjs`, which fails on any screen that asks for data the bundle lacks.
    ((globalThis as { __hgPreviewMisses?: string[] }).__hgPreviewMisses ??= []).push(key);
    return json(404, { detail: 'Not part of the design preview.', code: 'DESIGN_PREVIEW_MISS' });
  };
}

/**
 * Each bundle is its own chunk, loaded only when Design Preview is entered. `<app>.json` holds the base
 * synthetic responses; `<app>.extra.json` holds the hand-authored synthetic responses for endpoints added
 * after the base was generated. Extra wins on a key clash.
 */
export async function loadPreviewBundle(app: PreviewApp): Promise<PreviewBundle> {
  const [base, extra] = app === 'student'
    ? await Promise.all([import('./student.json'), import('./student.extra.json')])
    : app === 'agency'
      ? await Promise.all([import('./agency.json'), import('./agency.extra.json')])
      : await Promise.all([import('./university.json'), import('./university.extra.json')]);
  const b = base.default as unknown as PreviewBundle;
  return { ...b, routes: { ...b.routes, ...(extra.default as unknown as { routes: Record<string, Entry> }).routes } };
}
