import { useApi } from '@hangyul/auth';
import type { Country } from '@hangyul/types';
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
// The registry changes once a year, so these are cached hard. `useDirectoryRegions` feeds the map's labels and
// counts and is wanted on first paint; the list is paged and keeps the previous page while the next arrives, so
// selecting a region never blanks the column next to the map.

// P0 (2026-11-03): the directory hooks read the static public export (./publicData), not the API: anonymous
// discovery must work without the FastAPI process.
export function useDirectoryRegions() {
  return useQuery({ queryKey: ['directory', 'regions'], queryFn: () => publicData.regions(), staleTime: 12 * HOUR });
}

export function useInstitutions(query: Query) {
  return useQuery({
    queryKey: ['directory', 'institutions', query],
    queryFn: () => publicData.institutions(query),
    placeholderData: keepPreviousData,
    staleTime: 12 * HOUR,
  });
}

export function useInstitution(slug: string | undefined) {
  return useQuery({ queryKey: ['directory', 'institution', slug], queryFn: () => publicData.institution(slug!), enabled: !!slug, staleTime: 12 * HOUR });
}
