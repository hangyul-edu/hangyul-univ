// V9 university console: hooks for the new endpoints and the pure helpers behind them (vitest: lib/v9.test.ts).
import { useAuth } from '@hangyul/auth';
import type { ApplicationStatus } from '@hangyul/types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { AnalyticsFilters, ApplicantParams } from './filters';
import { VISIBLE_STATUSES } from './permissions';
import { useUniversity } from './university';

const scopeKey = (scopeId: string | undefined) => scopeId ?? 'own';

export interface V9Rate { value: number | null; numerator: number; denominator: number; insufficient_data?: boolean; insufficient?: boolean }

// ------------------------------------------------------------------ phones: one breakpoint for "summary rows instead of a table"

export const NARROW = '(max-width: 575.98px)';

/** True below 576 px: tables become summary rows with accordion evidence (U4 — no sideways tables on phones). */
export function useNarrow(query = NARROW): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [on, setOn] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(query);
    const fn = () => setOn(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [query]);
  return on;
}

// ------------------------------------------------------------------ U5 analytics by question

export interface QuestionCountry { key: string | null; submitted: number; offered: number; enrolled: number; decided: number; conversion: V9Rate; offer_rate: V9Rate }
export interface QuestionProgram { id: string; key: string; degree: string | null; submitted: number; offered: number; enrolled: number; qualified: number; checked: number; qualified_rate: V9Rate; offer_rate: V9Rate }
export interface Questions { countries: QuestionCountry[]; programs: QuestionProgram[]; min_denominator: number; definitions: Record<string, string>; population: { size: number; label: string; intake: string | null } }

export function useQuestions(filters: AnalyticsFilters = {}) {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  return useQuery({
    queryKey: ['university', 'questions', scopeKey(scopeId), filters],
    queryFn: () => api.get<Questions>('/university/analytics/questions', { ...filters, university_id: scopeId }),
    enabled: !needsPick,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/**
 * V15 (REPORT §120, brief Part 18): Analytics is organised around **questions**, not chart families.
 *
 *   recruitment  which countries produce enrolled students? which programmes attract demand?
 *   quality      which channels send complete applications? where are extra-document requests concentrated?
 *   agencies     which agency delivers complete, timely, well-prepared applications?
 *   outcomes     what happens between an offer and someone actually graduating?
 *
 * Two changes from V9's four. The `overview` tab is gone: it held the funnel and a status breakdown, and
 * the funnel is now section 2 of the Overview page itself — the same chart twice, one click apart. Agency
 * quality moved out of `quality` into its own question, because "are the applications we receive workable?"
 * and "which partner sends the workable ones?" are different questions with different decisions behind
 * them, and sharing a tab made the second one look like a subsection of the first.
 */
export const ANALYTICS_TABS = ['recruitment', 'quality', 'agencies', 'outcomes'] as const;
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number];
export function analyticsTab(v: string | null | undefined): AnalyticsTab {
  // `?tab=overview` still resolves — V9 bookmarks and the "see the funnel" links from elsewhere keep
  // working, landing on the question that now holds it.
  if (v === 'overview') return 'recruitment';
  return (ANALYTICS_TABS as readonly string[]).includes(v ?? '') ? (v as AnalyticsTab) : 'recruitment';
}

// ------------------------------------------------------------------ U7 partnership value

export interface ValueMetric { key: string; kind: 'rate' | 'median'; value: number | null; numerator: number | null; denominator: number; insufficient: boolean; cohort: string; definition: string; numerator_label: string | null; denominator_label: string | null }
export interface VisaRow { agency_id: string | null; agency: string | null; issued: number; refused: number; pending: number; decided: number; refusal_rate: V9Rate; issued_rate: V9Rate }
export interface PartnershipValue {
  intake: string | null; population: { size: number; label: string; intake: string | null }; metrics: ValueMetric[]; min_denominator: number;
  visa: { cohort: string; rows: VisaRow[]; total: VisaRow; definition: string; min_denominator: number };
}

export function usePartnershipValue(intake?: string) {
  const { api } = useAuth();
  const { scopeId, needsPick, perms } = useUniversity();
  return useQuery({
    queryKey: ['university', 'partnership-value', scopeKey(scopeId), intake ?? 'all'],
    queryFn: () => api.get<PartnershipValue>('/university/partnership-value', { intake, university_id: scopeId }),
    enabled: !needsPick && perms.canViewPartnership,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** The partnership value rows in the order a dean reads them: process quality first, then the after-admission chain. */
export const VALUE_GROUPS: { key: string; metrics: string[] }[] = [
  { key: 'quality', metrics: ['complete_on_first_review', 'additional_document_request_rate', 'median_review_days'] },
  { key: 'admission', metrics: ['offer_rate', 'acceptance_rate', 'tuition_paid_rate'] },
  { key: 'after', metrics: ['visa_conversion', 'arrival_rate', 'enrollment_rate', 'retention', 'graduation'] },
];

// ------------------------------------------------------------------ U6 requirement impact

export interface Impact {
  applies: boolean; dimensions: string[]; definition: string;
  population?: { total: number; saved: number; active_applications: number; strong_or_competitive: number };
  estimate?: { would_stop: number; would_start: number | null } | null;
  insufficient?: { profiles: number; of: number; missing: Record<string, number> } | null;
}

export type ImpactView =
  | { kind: 'none' }
  | { kind: 'empty' }
  | { kind: 'estimate'; stop: number; start: number | null; total: number }
  | { kind: 'insufficient'; profiles: number; of: number; fields: string[] };

/** One reading of an impact payload — what the diff shows (never a number when any counted profile lacks the data). */
export function impactView(i: Impact | null | undefined): ImpactView {
  if (!i || !i.applies) return { kind: 'none' };
  if (i.insufficient) return { kind: 'insufficient', profiles: i.insufficient.profiles, of: i.insufficient.of, fields: Object.keys(i.insufficient.missing) };
  if (!i.population?.total) return { kind: 'empty' };
  return { kind: 'estimate', stop: i.estimate?.would_stop ?? 0, start: i.estimate?.would_start ?? null, total: i.population.total };
}

// ------------------------------------------------------------------ U3 select all matching

export type FilterAction = 'assign-reviewer' | 'document-request' | 'admin-check' | 'export';
export interface FilterPreview { action: FilterAction; total: number; eligible: number; skipped: Record<string, number>; first: { id: string; student: string | null; program: string | null; status: ApplicationStatus; will_skip: boolean }[]; cap: number }

/** The applicant list's own filters, as the filter-based bulk endpoints expect them (same as GET /applications). */
export function listFilters(p: Partial<ApplicantParams>, isHangyul = false) {
  const status = p.status?.length ? p.status : isHangyul ? VISIBLE_STATUSES : undefined;
  const out: Record<string, unknown> = {
    status, q: p.q || undefined, program_id: p.program_id, nationality: p.nationality, agency_id: p.agency_id, intake: p.intake, degree: p.degree,
    reviewer: p.reviewer, admin_check: p.admin_check, reached: p.reached, flagged: p.flagged, requests: p.requests, eligibility: p.eligibility, sort: p.sort ?? 'submitted',
  };
  Object.keys(out).forEach((k) => (out[k] === undefined || out[k] === null || out[k] === '') && delete out[k]);
  return out;
}

/** "Select all N matching" is offered only when the whole page is selected and more rows match than the page shows. */
export function canSelectAllMatching(selected: number, pageRows: number, total: number | undefined): boolean {
  return !!total && pageRows > 0 && selected >= pageRows && total > pageRows;
}

// ------------------------------------------------------------------ U8 team

export interface TeamMember { user_id: string; full_name: string; role: string; title: string | null; is_active?: boolean; open_assignments?: number }
export interface Assigned { id: string; student: string | null; program: string | null; status: ApplicationStatus; reviewer_id: string | null }

export function useOrphaned() {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  return useQuery({
    queryKey: ['university', 'orphaned', scopeKey(scopeId)],
    queryFn: () => api.get<Assigned[]>('/university/orphaned-assignments', { university_id: scopeId }),
    enabled: !needsPick,
    staleTime: 30_000,
  });
}

/** Who can take over open applicants: every active member except the person leaving (V22: every member is an admin). */
export function handoverTargets(team: TeamMember[], leaving: string): TeamMember[] {
  return team.filter((m) => m.user_id !== leaving && m.is_active !== false);
}

// ------------------------------------------------------------------ agency identity on the applicant

export interface AgencyIdentity { id: string; name: string; legal_name: string | null; country_code: string | null; registration_status: string; responsible_counselor: string | null; sub_agent?: string | null }

export function useApplicationAgency(appId: string, enabled = true) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ['university', 'app-agency', appId],
    queryFn: () => api.get<{ agency: AgencyIdentity | null }>(`/university/applications/${appId}/agency`),
    enabled: !!appId && enabled,
    staleTime: 5 * 60_000,
  });
}
