/**
 * Public university discovery data, served as static files (P0 hotfix, 2026-11-03).
 *
 * The anonymous marketing site must not depend on the FastAPI process. The directory, the detail pages, the region
 * counts, the scholarship and language-rule records and the Quick Fit country list are exported from the API's own
 * public endpoints over the canonical seeded database by `scripts/public-data/export.py` into
 * `public/data/public/…`, and this module answers the same calls with the same response shapes the API returns.
 * Local development and production read the same files, so they cannot drift.
 *
 * Errors are explicit and distinct:
 *  - a file that cannot be loaded (network, CDN, missing export) → `ApiError(503, 'DATA_UNAVAILABLE')`, which the UI
 *    renders as a temporary "couldn't load" state with Retry — never as "0 institutions" and never as not-found;
 *  - a slug that is not in the loaded index, or a filter value the API itself rejects → `ApiError(404)`, exactly as
 *    the API answers. 404 means "no such university", not "something failed".
 *
 * The filtering below mirrors `server/app/api/v1/directory.py::institutions` (region / regions / institution_type /
 * name search, page, order). Ordering without a search term is the API's own order, exported as is; with a term it
 * is the API's rank (exact name, then prefix, then the rest), then institution kind, then name.
 */
import { ApiError } from '@hangyul/api-client';
import type { Country, DirectoryRegions, InstAdmissions, InstitutionCard, InstitutionDetail, Page } from '@hangyul/types';

const BASE = `${import.meta.env.BASE_URL}data/public`;
const INSTITUTION_TYPES = ['UNIVERSITY', 'JUNIOR_COLLEGE', 'GRADUATE_UNIVERSITY'] as const;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;
interface Index { items: InstitutionCard[]; order_en: number[] }

const unavailable = () => new ApiError(503, 'DATA_UNAVAILABLE');
const notFound = () => new ApiError(404, 'Not found');

async function load<T>(path: string, { missingIsNotFound = false } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}`, { credentials: 'omit' });
  } catch {
    throw unavailable();
  }
  if (res.status === 404 && missingIsNotFound) throw notFound();
  if (!res.ok) throw unavailable();
  try {
    return (await res.json()) as T;
  } catch {
    // An HTML fallback page or a truncated body is a delivery failure, not data.
    throw unavailable();
  }
}

/** Shared, retried on failure: a rejected load is forgotten so Retry really refetches. */
function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    p ??= fn().catch((e) => { p = null; throw e; });
    return p;
  };
}

const loadIndex = once(() => load<Index>('institutions.json'));
const loadRegions = once(() => load<DirectoryRegions>('regions.json'));

const str = (v: Query[string]) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: Query[string], dflt: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : dflt;
};
const typeRank = (t: string) => {
  const i = (INSTITUTION_TYPES as readonly string[]).indexOf(t);
  return i < 0 ? INSTITUTION_TYPES.length : i;
};
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const publicData = {
  regions: (): Promise<DirectoryRegions> => loadRegions(),

  async institutions(query: Query): Promise<Page<InstitutionCard>> {
    const [index, regions] = await Promise.all([loadIndex(), loadRegions()]);
    const known = new Set(regions.regions.map((r) => r.key));
    const order = query.order === 'en' ? 'en' : 'ko';
    const page = Math.max(1, num(query.page, 1));
    const pageSize = Math.min(200, Math.max(1, num(query.page_size, 20)));

    let rows = order === 'en' ? index.order_en.map((n) => index.items[n]) : [...index.items];
    const region = str(query.region);
    const group = str(query.regions);
    if (region) {
      if (!known.has(region)) throw notFound();
      rows = rows.filter((r) => r.region === region);
    } else if (group) {
      const wanted = new Set(group.split(',').map((x) => x.trim()).filter((x) => known.has(x)));
      if (!wanted.size) throw notFound();
      rows = rows.filter((r) => wanted.has(r.region));
    }
    const kind = str(query.institution_type);
    if (kind) {
      if (!(INSTITUTION_TYPES as readonly string[]).includes(kind)) throw notFound();
      rows = rows.filter((r) => r.institution_type === kind);
    }
    const term = str(query.q)?.toLowerCase();
    if (term) {
      const ko = (r: InstitutionCard) => r.name_ko.toLowerCase();
      const en = (r: InstitutionCard) => (r.name_en ?? '').toLowerCase();
      rows = rows.filter((r) => ko(r).includes(term) || en(r).includes(term));
      const rank = (r: InstitutionCard) => (ko(r) === term || en(r) === term ? 0 : ko(r).startsWith(term) || en(r).startsWith(term) ? 1 : 2);
      const name = (r: InstitutionCard) => (order === 'en' ? r.name_en ?? r.name_ko : r.name_ko);
      rows = rows
        .map((r) => ({ r, k: [rank(r), typeRank(r.institution_type)] as const, n: name(r) }))
        .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || cmp(a.n, b.n))
        .map((x) => x.r);
    }
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, page_size: pageSize };
  },

  async institution(slug: string): Promise<InstitutionDetail> {
    if (!SLUG.test(slug)) throw notFound();
    const index = await loadIndex();
    if (!index.items.some((r) => r.slug === slug)) throw notFound();
    return load<InstitutionDetail>(`institutions/${slug}.json`);
  },

  /** The verified scholarships and language rules. `summary` (the visitor-specific scholarship pick) needs the fit
   *  engine and is null here; the page shows the strongest scheme without it, exactly as it does with no answers. */
  async admissions(slug: string, _fit?: Query): Promise<InstAdmissions> {
    if (!SLUG.test(slug)) throw notFound();
    return load<InstAdmissions>(`admissions/${slug}.json`, { missingIsNotFound: true });
  },

  /** The Quick Fit country list (`/meta/countries?priority_only=true`). */
  countries: (): Promise<Country[]> => load<Country[]>('countries.json'),
};
