/** V9 S3 — sponsor (family) view: types and the scope list. Server: app/api/v1/sponsor.py. */
import type { FundsToShow, MoneyPlan } from './money';

export const SPONSOR_SCOPES = ['money', 'family_documents', 'dates', 'progress', 'arrival'] as const;
export type SponsorScope = (typeof SPONSOR_SCOPES)[number];

export interface SponsorLink {
  id: string; label: string | null; scopes: SponsorScope[]; locale: string | null; state: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  created_at: string; expires_at: string; revoked_at: string | null; last_viewed_at: string | null; view_count: number;
  token?: string; path?: string;
}

export interface SponsorPayload {
  student: { first_name: string | null };
  scopes: SponsorScope[];
  locale: string | null;
  expires_at: string;
  as_of: string;
  money?: MoneyPlan & { funds_to_show: FundsToShow };
  family_documents?: { status: string; visa_type: string | null; items: { key: string; category: string | null; who: string; applies: string; ready: boolean; status: string; validity_days: number | null }[] };
  dates?: { kind: 'APPLICATION_DEADLINE' | 'TUITION_DUE' | 'SEMESTER_START' | 'VISA_APPOINTMENT' | 'ARRIVAL'; date: string; university: string | null }[];
  progress?: { applications: { university: string; program: string | null; status: string }[]; visa: { status: string; visa_type: string } | null };
  arrival?: { arrival_at: string | null; arrived: boolean; pickup: string | null; housing: string | null; residence_card_due: string | null };
}

/** The full sponsor URL for a token (the student app's own origin). */
export function sponsorUrl(path: string, origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  return `${origin}${path}`;
}

/** Days until a link expires (0 when today); negative once expired. */
export function daysLeft(expiresAt: string, now = Date.now()): number {
  return Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000);
}
