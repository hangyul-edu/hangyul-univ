import type { AuthorIdentity, PublicUser } from '@hangyul/types';

import type { TFn } from './i18n';

/**
 * V22 team identity (REPORT §246 A3/A4).
 *
 * A student is served by the Hangyul team, never by a named individual. The API already collapses every staff
 * author into `{ id: 'team', kind: 'team' }` for a student viewer, with an English `full_name`; the UI shows the
 * localised team name instead of that English string, and treats a missing or staff author the same way, so no
 * screen can leak a staff name even if a serialiser lags behind.
 */
export type Identity = (Partial<AuthorIdentity> & Partial<PublicUser>) | null | undefined;

export function isTeam(who: Identity): boolean {
  return !who || who.kind === 'team' || who.kind === 'staff' || who.id === 'team';
}

/** The display name for an author: the student's own name stays, anything else is the Hangyul team. */
export function displayName(t: TFn, who: Identity): string {
  return isTeam(who) || !who?.full_name ? t('messages.team') : who.full_name;
}
