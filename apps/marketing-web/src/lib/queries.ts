import { ApiError } from '@hangyul/api-client';
import { useApi } from '@hangyul/auth';
import type { Country, DirectoryRegions, InstAdmissions, InstitutionCard, InstitutionDetail, Page } from '@hangyul/types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { publicData } from './publicData';

type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

const HOUR = 60 * 60 * 1000;

/** Public, unauthenticated catalog queries used across the marketing site. */
export function useCountries() {
  const api = useApi();
  return useQuery({
    queryKey: ['meta', 'countries'],
    queryFn: () => api.meta.countries(),
    staleTime: 12 * HOUR,
    // Korea itself is the destination, so it's not offered as a country of origin.
    select: (list: Country[]) => list.filter((c) => c.code !== 'KR').sort((a, b) => (a.priority_rank ?? 999) - (b.priority_rank ?? 999)),
  });
}

export function useTaxonomy() {
  const api = useApi();
  return useQuery({ queryKey: ['meta', 'taxonomy'], queryFn: () => api.meta.taxonomy(), staleTime: 12 * HOUR });
}

export function usePrograms(query: Query, enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: ['public', 'programs', query], queryFn: () => api.catalog.programs(query), placeholderData: keepPreviousData, staleTime: 5 * 60_000, enabled });
}

export function useUniversities(query: Query, enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: ['public', 'universities', query], queryFn: () => api.catalog.universities(query), placeholderData: keepPreviousData, staleTime: 5 * 60_000, enabled });
}

export function useUniversity(slug: string | undefined) {
  const api = useApi();
  return useQuery({ queryKey: ['public', 'university', slug], queryFn: () => api.catalog.university(slug!), enabled: !!slug, staleTime: 5 * 60_000 });
}

export function useContentList(locale: string, type?: string, country?: string) {
  const api = useApi();
  return useQuery({ queryKey: ['content', locale, type ?? null, country ?? null], queryFn: () => api.catalog.content(locale, type, country), staleTime: HOUR });
}

export function useArticle(slug: string | undefined, locale: string) {
  const api = useApi();
  return useQuery({ queryKey: ['article', slug, locale], queryFn: () => api.catalog.article(slug!, locale), enabled: !!slug, staleTime: HOUR });
}

export function useSources() {
  const api = useApi();
  return useQuery({ queryKey: ['sources'], queryFn: () => api.catalog.sources({ page_size: 200 }), staleTime: HOUR });
}

export function useLegalization(country: string | null | undefined, category = 'TRANSCRIPT') {
  const api = useApi();
  return useQuery({
    queryKey: ['legalization', country, category],
    queryFn: () => api.catalog.legalizationPath(country!, category),
    enabled: !!country,
    staleTime: HOUR,
  });
}

// ---------------------------------------------------------------- V12: the Korean institution directory
// The directory, the region counts, each detail page and its admissions record are read LIVE from the database
// through the public API (`/api/v1/directory/*`, same origin — Vercel and the Vite dev server proxy `/api`), with
// the build's DB snapshot (`./publicData`) as the fallback when the API cannot be reached (owner decision
// 2026-11-19: one authoritative DB catalogue). The two answer the same calls with the same response shapes,
// because the snapshot is exported from these very endpoints (scripts/public-data/export.py). See `liveFirst`.

/** How long one live call may take before the snapshot answers instead. The tunnel stalls rather than refuses. */
const LIVE_TIMEOUT_MS = 6_000;
/** After the API proved unreachable, go straight to the snapshot for this long instead of waiting on every call. */
const LIVE_COOLDOWN_MS = 60_000;
let liveDownUntil = 0;

/**
 * The live database first; the snapshot only when the **service** is unreachable.
 *
 * An answer the API gave on purpose is authoritative — a JSON 404 means "no such university" and is not papered
 * over with a stale snapshot row. A network failure, a timeout, a gateway error or an HTML page where the API
 * should be (an offline tunnel) falls back. If the snapshot cannot be loaded either, the live error stands, and
 * the page shows its temporary "couldn't load" state — never "0 institutions".
 */
export async function liveFirst<T>(live: () => Promise<T>, snapshot: () => Promise<T>): Promise<T> {
  if (Date.now() < liveDownUntil) return snapshot();
  try {
    return await live();
  } catch (e) {
    if (!(e instanceof ApiError) || !(e.unreachable || e.status === 0 || e.status === 408 || e.status >= 500)) throw e;
    liveDownUntil = Date.now() + LIVE_COOLDOWN_MS;
    try {
      return await snapshot();
    } catch {
      throw e;
    }
  }
}

/** Testing hook: forget that the API was down. */
export function resetLiveState() { liveDownUntil = 0; }

/** A genuine not-found is final; anything else may be retried once. */
const retry = (n: number, e: unknown) => !(e instanceof ApiError && e.status === 404) && n < 1;

function useLive() {
  const api = useApi();
  return <T,>(path: string, query?: Query, signal?: AbortSignal) => api.request<T>(path, { query, signal, timeoutMs: LIVE_TIMEOUT_MS });
}

export function useDirectoryRegions() {
  const live = useLive();
  return useQuery({
    queryKey: ['directory', 'regions'],
    queryFn: ({ signal }) => liveFirst(() => live<DirectoryRegions>('/directory/regions', undefined, signal), () => publicData.regions()),
    staleTime: HOUR,
    retry,
  });
}

/** One page of the directory (`page_size` ≤ 200) — never the whole catalogue. */
export function useInstitutions(query: Query) {
  const live = useLive();
  return useQuery({
    queryKey: ['directory', 'institutions', query],
    queryFn: ({ signal }) => liveFirst(() => live<Page<InstitutionCard>>('/directory/institutions', query, signal), () => publicData.institutions(query)),
    placeholderData: keepPreviousData,
    staleTime: HOUR,
    retry,
  });
}

export function useInstitution(slug: string | undefined) {
  const live = useLive();
  return useQuery({
    queryKey: ['directory', 'institution', slug],
    queryFn: ({ signal }) => liveFirst(() => live<InstitutionDetail>(`/directory/institutions/${encodeURIComponent(slug!)}`, undefined, signal), () => publicData.institution(slug!)),
    enabled: !!slug,
    staleTime: HOUR,
    retry,
  });
}

/** The verified scholarships and language rules of one institution (no visitor answers: `summary` is null). */
export function useInstitutionAdmissions(slug: string | undefined) {
  const live = useLive();
  return useQuery({
    queryKey: ['directory', 'admissions', slug],
    queryFn: ({ signal }) => liveFirst(() => live<InstAdmissions>(`/directory/institutions/${encodeURIComponent(slug!)}/admissions`, undefined, signal), () => publicData.admissions(slug!)),
    enabled: !!slug,
    staleTime: HOUR,
    retry,
  });
}
