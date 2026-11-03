/**
 * The API returns web-app paths in next actions, deadlines and notifications.
 * Map them onto native routes; unknown paths fall back to Home.
 */
export function mapWebLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const path = link.split('?')[0];
  const m = (re: RegExp) => path.match(re);
  let r: RegExpMatchArray | null;
  if ((r = m(/^\/applications\/([\w-]+)/))) return `/applications/${r[1]}`;
  if (path.startsWith('/applications')) return '/applications';
  if ((r = m(/^\/documents\/([\w-]+)/))) return `/documents/${r[1]}`;
  if (path.startsWith('/documents')) return '/documents';
  if ((r = m(/^\/messages\/([\w-]+)/))) return `/messages/${r[1]}`;
  if (path.startsWith('/messages')) return '/messages';
  if ((r = m(/^\/universities\/([\w-]+)/))) return `/universities/${r[1]}`;
  if (path.startsWith('/matches')) return '/explore';
  if (path.startsWith('/saved')) return '/saved';
  if (path.startsWith('/visa')) return '/visa';
  if (path.startsWith('/notifications')) return '/notifications';
  if (path.startsWith('/essays') || path.startsWith('/tasks')) return '/tasks';
  if (path.startsWith('/onboarding') || path.startsWith('/profile')) return '/profile';
  // V17: the three screens the native app gained in this pass. `/services/payment/*` deliberately maps to
  // the plan screen rather than to a native payment route — there is no native payment route, by design.
  if (path.startsWith('/services')) return '/services';
  if (path.startsWith('/settings')) return '/settings';
  if (path.startsWith('/more') || path.startsWith('/support')) return '/more';
  if (path.startsWith('/explore') || path.startsWith('/programs')) return '/explore';
  return null;
}
