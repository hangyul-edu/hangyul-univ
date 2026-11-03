import { useApi } from '@hangyul/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useDashboard() {
  const api = useApi();
  return useQuery({ queryKey: ['dashboard'], queryFn: () => api.me.dashboard() });
}

export function useProfile() {
  const api = useApi();
  return useQuery({ queryKey: ['profile'], queryFn: () => api.me.profile() });
}

export function useCountries() {
  const api = useApi();
  return useQuery({ queryKey: ['countries'], queryFn: () => api.meta.countries(), staleTime: Infinity });
}

export function useTaxonomy() {
  const api = useApi();
  return useQuery({ queryKey: ['taxonomy'], queryFn: () => api.meta.taxonomy(), staleTime: Infinity });
}

export function useSaved() {
  const api = useApi();
  return useQuery({ queryKey: ['saved'], queryFn: () => api.me.saved() });
}

/** Save / unsave a university (optionally remembering the program that caught the student's eye). */
export function useToggleSave() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ universityId, programId, saved }: { universityId: string; programId?: string; saved: boolean }) => {
      if (saved) await api.me.unsave(universityId);
      else await api.me.save(universityId, programId);
      return !saved;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  });
}

export function useConversations(poll = 60_000) {
  const api = useApi();
  return useQuery({ queryKey: ['conversations'], queryFn: () => api.messages.conversations(), refetchInterval: poll });
}

/** The student's own verdicts for every program (one request, cached; used to annotate search results). */
export function useMyMatches() {
  const api = useApi();
  return useQuery({ queryKey: ['matches', { limit: 120 }], queryFn: () => api.me.matches({ limit: 120 }), staleTime: 5 * 60_000 });
}

/** The student's applications (same cache entry as the Applications page). */
export function useMyApplications() {
  const api = useApi();
  return useQuery({ queryKey: ['applications', {}], queryFn: () => api.applications.list({ page_size: 50 }) });
}

/** Journey stages after admission (offer accepted or later): housing and arrival become relevant. */
export const ADMITTED: ReadonlySet<string> = new Set(['ENROLL', 'VISA', 'ARRIVAL', 'STUDENT_LIFE']);

/**
 * The student's plan, cached for the whole session (V17).
 *
 * `/me/services` already returns it alongside the three products, and `AppLayout` needs the answer on every
 * navigation to decide whether the managed service is open. `staleTime` is deliberately long: a plan is
 * bought once and the payment return invalidates this key explicitly, so polling it would be a request per
 * route change for an answer that almost never changes.
 */
export function useMyPlan() {
  const api = useApi();
  return useQuery({ queryKey: ['services'], queryFn: () => api.me.services(), staleTime: 5 * 60_000 });
}
