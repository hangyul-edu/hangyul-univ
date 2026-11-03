import { useApi } from '@hangyul/auth';
import { useQuery } from '@tanstack/react-query';

/** Shared query keys so screens and tab badges reuse the same cache. */
export const qk = {
  dashboard: ['me', 'dashboard'] as const,
  saved: ['me', 'saved'] as const,
  matches: ['me', 'matches'] as const,
  applications: ['applications'] as const,
  application: (id: string) => ['applications', id] as const,
  documents: ['documents'] as const,
  document: (id: string) => ['documents', id] as const,
  conversations: ['conversations'] as const,
  thread: (id: string) => ['conversations', id] as const,
  tasks: ['tasks', 'student'] as const,
  notifications: ['notifications'] as const,
  visa: ['visa'] as const,
  programs: (q: string, degree: string[]) => ['programs', q, degree] as const,
  university: (slug: string) => ['universities', slug] as const,
  assignment: ['me', 'assignment'] as const,
};

export function useDashboard() {
  const api = useApi();
  return useQuery({ queryKey: qk.dashboard, queryFn: () => api.me.dashboard() });
}

export function useSaved() {
  const api = useApi();
  return useQuery({ queryKey: qk.saved, queryFn: () => api.me.saved() });
}
