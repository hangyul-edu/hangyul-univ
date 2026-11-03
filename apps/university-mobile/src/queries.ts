import { useApi, useAuth } from '@hangyul/auth';
import { useQuery } from '@tanstack/react-query';

export const qk = {
  overview: ['university', 'overview'] as const,
  applicants: (status: string | null, flagged: boolean) => ['applications', { status, flagged }] as const,
  applicant: (id: string) => ['applications', id] as const,
  cohorts: ['university', 'cohorts'] as const,
};

export function useOverview() {
  const api = useApi();
  return useQuery({ queryKey: qk.overview, queryFn: () => api.university.overview() });
}

/** V22: every university member is UNIVERSITY_ADMIN and may change status or flags (server: UNIVERSITY_WRITE_ROLES). Legacy note: analysts were read-only. */
export function useCanDecide() {
  const { hasRole } = useAuth();
  return hasRole('UNIVERSITY_ADMIN', 'HANGYUL_SUPER_ADMIN', 'HANGYUL_OPERATIONS');
}
