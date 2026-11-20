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
 *   computed one POST is a read, not a write: `POST /compare` only computes a side-by-side table. It is answered
 *            in-process from the bundle's own match list (`previewCompare`) — nothing is stored or sent.
 *   auth     `/auth/refresh` returns the bundle's synthetic persona (placeholder token, no refresh token); the
 *            Operations bundle also holds a synthetic Hangyul HQ persona (`hq_session`, variant `hq`) so the HQ
 *            pages (overview, readiness, accounts, sources, assignment override) can be reviewed too;
 *            `/auth/login` is refused — a real credential typed in preview goes nowhere.
 *
 * The whole feature is behind ONE build flag (`VITE_ENABLE_DESIGN_PREVIEW`, read in `@hangyul/ui`
 * `design-preview.tsx`). With the flag off this module is unreachable and Vite drops it and the bundles.
 */
import { localizeFixtureJson, type FixtureTranslate } from './fixture-text';

export type { FixtureTranslate } from './fixture-text';
export type PreviewApp = 'student' | 'agency' | 'university';
/**
 * `paid` shows the entitled product; `unpaid` shows the same synthetic student before buying a plan; `hq` (Operations
 * only) signs the synthetic reviewer in as Hangyul HQ staff, which adds the HQ section.
 */
export type PreviewVariant = 'paid' | 'unpaid' | 'hq';

interface Entry { status: number; body: unknown }
export interface PreviewBundle { generated_at: string; session: unknown; hq_session?: unknown; routes: Record<string, Entry> }

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Lookup key for a request; query order is normalised so `?a=1&b=2` and `?b=2&a=1` are one entry. */
export function previewKey(method: string, url: string): string {
  const u = new URL(url, 'http://preview.invalid');
  const params = [...u.searchParams.entries()].filter(([, v]) => v !== '' && v !== 'undefined').sort();
  const qs = params.length ? `?${params.map(([k, v]) => `${k}=${v}`).join('&')}` : '';
  return `${method.toUpperCase()} ${u.pathname}${qs}`;
}

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

type Rec = Record<string, unknown>;
const bodyOf = (bundle: PreviewBundle, key: string): unknown => bundle.routes[key]?.status === 200 ? bundle.routes[key].body : null;

/**
 * `POST /compare` from the bundle (read-only: the server only computes this table). Each row is built from the synthetic
 * student's own match for that programme — the same programme, match, intake and first-year range the match list shows —
 * plus the university's synthetic detail (documents, dormitories) where the bundle has one.
 */
export function previewCompare(bundle: PreviewBundle, programIds: string[]): Rec[] | null {
  const matches = ((bodyOf(bundle, 'GET /api/v1/me/matches') as { items?: Rec[] } | null)?.items ?? []);
  const scholarships = (bodyOf(bundle, 'GET /api/v1/me/scholarships') as Rec[] | null) ?? [];
  const details = Object.keys(bundle.routes).filter((k) => /^GET \/api\/v1\/universities\/[^/?]+$/.test(k))
    .map((k) => bodyOf(bundle, k) as Rec | null).filter((d): d is Rec => !!d && Array.isArray(d.required_documents));
  // A university without a synthetic detail uses the shortest synthetic list (the documents every programme asks for).
  const base = details.map((d) => d.required_documents as Rec[]).sort((a, b) => a.length - b.length)[0] ?? [];
  const rows: Rec[] = [];
  for (const id of programIds) {
    const m = matches.find((x) => x.program_id === id);
    if (!m) return null;
    const program = m.program as Rec;
    const uni = (program.university ?? {}) as Rec;
    const detail = details.find((d) => d.id === program.university_id);
    const docs = (detail?.required_documents as Rec[] | undefined) ?? base;
    const reasons = (m.reasons as Rec[] | undefined) ?? [];
    const { program: _p, intake, first_year_range_krw, estimated_annual_cost_krw, ...match } = m;
    rows.push({
      program, match: { ...match, estimated_annual_cost_krw }, next_intake: intake ?? null,
      estimated_annual_cost_krw: estimated_annual_cost_krw ?? null, first_year_range_krw,
      scholarships: scholarships.filter((s) => s.university_id === program.university_id),
      dormitory: detail ? ((detail.dormitories as unknown[]) ?? []).length > 0 : reasons.some((r) => r.code === 'DORM_AVAILABLE'),
      document_count: docs.filter((d) => d.required !== false).length,
      legalization_documents: docs.filter((d) => d.legalization_required).length,
      partner: !!uni.is_partner,
    });
  }
  return rows;
}

async function bodyJson(init: RequestInit | undefined): Promise<Rec> {
  try { return typeof init?.body === 'string' ? JSON.parse(init.body) as Rec : {}; } catch { return {}; }
}

/** Header lookup over every `HeadersInit` shape. */
function header(init: RequestInit | undefined, name: string): string | null {
  const h = init?.headers;
  if (!h) return null;
  if (typeof Headers !== 'undefined' && h instanceof Headers) return h.get(name);
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1] ?? null;
  const rec = h as Record<string, string>;
  const k = Object.keys(rec).find((x) => x.toLowerCase() === name.toLowerCase());
  return k ? rec[k] : null;
}

/**
 * `translate` (optional) localizes the bundle's few staff-written sentences into the request's Accept-Language
 * (see `fixture-text.ts`), so a Korean preview never shows an English reviewer note.
 */
export function previewFetch(bundle: PreviewBundle, variant: PreviewVariant = 'paid', translate?: FixtureTranslate): typeof fetch {
  const loose = loosest(bundle);
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const lng = header(init, 'Accept-Language');
    const json = (status: number, body: unknown) =>
      new Response(localizeFixtureJson(JSON.stringify(body), lng, translate), { status, headers: { 'Content-Type': 'application/json' } });
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET') ?? 'GET').toUpperCase();
    const path = new URL(url, 'http://preview.invalid').pathname;

    if (path.endsWith('/auth/refresh') || path.endsWith('/auth/me')) return json(200, variant === 'hq' && bundle.hq_session ? bundle.hq_session : bundle.session);
    if (method === 'POST' && path.endsWith('/api/v1/compare')) {
      const rows = previewCompare(bundle, ((await bodyJson(init)).program_ids as string[] | undefined) ?? []);
      if (rows) return json(200, rows);
    }
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
  const x = extra.default as unknown as { hq_session?: unknown; routes: Record<string, Entry> };
  return { ...b, hq_session: x.hq_session ?? b.hq_session, routes: { ...b.routes, ...x.routes } };
}
