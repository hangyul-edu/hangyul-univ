export const qk = {
  analytics: ['agency', 'analytics', 30] as const,
  students: (q: string, slaOnly: boolean) => ['agency', 'students', q, slaOnly] as const,
  student: (id: string) => ['agency', 'student', id] as const,
  tasks: (scope: 'mine' | 'team') => ['tasks', scope] as const,
  overdue: ['tasks', 'overdue'] as const,
  reviewQueue: ['documents', 'review-queue'] as const,
  document: (id: string) => ['documents', id] as const,
  deadlines: ['agency', 'deadlines'] as const,
};

/** Map API web links onto native routes. */
export function mapWebLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const doc = link.match(/[?&]doc=([\w-]+)/);
  if (doc) return `/reviews/${doc[1]}`;
  const student = link.match(/^\/students\/([\w-]+)/);
  if (student) return `/students/${student[1]}`;
  const conv = link.match(/^\/messages\/([\w-]+)/);
  if (conv) return `/messages/${conv[1]}`;
  if (link.startsWith('/messages') || link.startsWith('/inbox')) return '/messages';
  if (link.startsWith('/tasks')) return '/tasks';
  if (link.startsWith('/documents') || link.startsWith('/reviews')) return '/reviews';
  return null;
}
