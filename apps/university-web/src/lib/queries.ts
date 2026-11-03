import { useAuth } from '@hangyul/auth';
import type { Application, Page } from '@hangyul/types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { AnalyticsFilters, ApplicantParams } from './filters';
import { VISIBLE_STATUSES } from './permissions';
import { useUniversity } from './university';

type Query = Record<string, string | number | boolean | undefined | null | string[]>;

/** Every university query includes the scope so a Hangyul user switching universities never sees cached data from another tenant. */
const scopeKey = (scopeId: string | undefined) => scopeId ?? 'own';

export function useAnalytics(filters: AnalyticsFilters = {}) {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  return useQuery({
    queryKey: ['university', 'analytics', scopeKey(scopeId), filters],
    queryFn: () => api.university.analytics({ ...filters, university_id: scopeId }),
    enabled: !needsPick,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function usePrograms() {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  return useQuery({
    queryKey: ['university', 'programs', scopeKey(scopeId)],
    queryFn: () => api.university.programs(scopeId),
    enabled: !needsPick,
    staleTime: 5 * 60_000,
  });
}

export function usePartnership() {
  const { api } = useAuth();
  const { scopeId, needsPick, perms } = useUniversity();
  return useQuery({
    queryKey: ['university', 'partnership', scopeKey(scopeId)],
    queryFn: () => api.university.partnership(scopeId),
    enabled: !needsPick && perms.canViewPartnership,
    staleTime: 60_000,
  });
}

export function useCohorts() {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  return useQuery({
    queryKey: ['university', 'cohorts', scopeKey(scopeId)],
    queryFn: () => api.university.cohorts(scopeId),
    enabled: !needsPick,
    staleTime: 5 * 60_000,
  });
}

export function useTeam() {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  return useQuery({
    queryKey: ['university', 'team', scopeKey(scopeId)],
    queryFn: () => api.university.team(scopeId),
    enabled: !needsPick,
    staleTime: 5 * 60_000,
  });
}

/** Maps list params to the API query. Hangyul staff pass the chosen university explicitly. */
export function useApplicantQuery(p: Partial<ApplicantParams>): Query {
  const { isHangyul, scopeId } = useUniversity();
  return useMemo(() => ({
    university_id: scopeId,
    // Hangyul staff aren't tenant-scoped by the API, so keep them to what the university itself can see.
    status: p.status?.length ? p.status : isHangyul ? VISIBLE_STATUSES : undefined,
    program_id: p.program_id,
    nationality: p.nationality,
    agency_id: p.agency_id,
    intake: p.intake,
    degree: p.degree,
    reviewer: p.reviewer,
    admin_check: p.admin_check,
    reached: p.reached,
    flagged: p.flagged,
    requests: p.requests,
    eligibility: p.eligibility,
    submitted_within_days: p.submitted_within,
    updated_within_days: p.updated_within,
    submitted_month: p.submitted_month,
    q: p.q,
    sort: p.sort ?? 'submitted',
    page: p.page ?? 1,
    page_size: p.page_size ?? 20,
  }), [p.status, p.program_id, p.nationality, p.agency_id, p.intake, p.degree, p.reviewer, p.admin_check, p.reached, p.flagged, p.requests, p.eligibility, p.submitted_within, p.updated_within, p.submitted_month, p.q, p.sort, p.page, p.page_size, isHangyul, scopeId]);
}

export function useApplications(p: Partial<ApplicantParams>, opts: { enabled?: boolean } = {}) {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  const query = useApplicantQuery(p);
  return useQuery({
    queryKey: ['applications', scopeKey(scopeId), query],
    queryFn: (): Promise<Page<Application>> => api.applications.list(query as never),
    enabled: !needsPick && (opts.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

/** Counts for a status set without fetching rows (page_size 1). */
export function useApplicationCount(p: Partial<ApplicantParams>) {
  const q = useApplications({ ...p, page: 1, page_size: 1 });
  return { ...q, count: q.data?.total };
}

/** Partner agencies that sent applications to this university (id → name). */
export function useAgencyDirectory() {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  const q = useQuery({
    queryKey: ['university', 'agencies', scopeKey(scopeId)],
    queryFn: () => api.university.agencies(scopeId),
    enabled: !needsPick,
    staleTime: 10 * 60_000,
  });
  const directory = useMemo(() => (q.data ?? []).map((a) => ({ id: a.id, name: a.name as string | null, applications: a.applications })), [q.data]);
  return { directory, isLoading: q.isLoading, nameOf: (id: string | null | undefined) => directory.find((d) => d.id === id)?.name ?? null };
}

/** Precise admissions funnel (submitted → enrolled) for this university, with the same filters as analytics. */
export function useAdmissionsFunnel(filters: AnalyticsFilters = {}) {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  return useQuery({
    queryKey: ['university', 'admissions-funnel', scopeKey(scopeId), filters],
    queryFn: () => api.university.admissionsFunnel({ ...filters, university_id: scopeId }),
    enabled: !needsPick,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** Unified metrics (V3): one definition per rate — pipeline population + separate enrolled cohorts. */
export function useMetrics(filters: AnalyticsFilters = {}) {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  return useQuery({
    queryKey: ['university', 'metrics', scopeKey(scopeId), filters],
    queryFn: () => api.university.metrics({ ...filters, university_id: scopeId }),
    enabled: !needsPick,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** Counts behind "Needs your decision" (one request; same filters as the page). */
export function useAttention(filters: AnalyticsFilters = {}) {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  const f = { nationality: filters.nationality, program_id: filters.program_id, agency_id: filters.agency_id };
  return useQuery({
    queryKey: ['university', 'attention', scopeKey(scopeId), f],
    queryFn: () => api.university.attention({ ...f, university_id: scopeId }),
    enabled: !needsPick,
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

export function useOutcomes(by: 'cohort' | 'nationality' | 'program' | 'agency') {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  return useQuery({
    queryKey: ['university', 'outcomes', scopeKey(scopeId), by],
    queryFn: () => api.university.outcomes(by, scopeId),
    enabled: !needsPick,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export function useProposals(status: 'PENDING' | 'PUBLISHED' | 'DISCARDED' = 'PENDING') {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  return useQuery({
    queryKey: ['university', 'proposals', scopeKey(scopeId), status],
    queryFn: () => api.university.proposals(status, scopeId),
    enabled: !needsPick,
    staleTime: 30_000,
  });
}

export function useExportHistory() {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  return useQuery({
    queryKey: ['university', 'exports', scopeKey(scopeId)],
    queryFn: () => api.university.exports(scopeId),
    enabled: !needsPick,
    staleTime: 10_000,
  });
}

// ------------------------------------------------------------------ V6

/** Approved statement text attached to a submitted application (reader view). Every read is audited by the API. */
export interface Statement { id: string; essay_type: string; title: string; prompt: string | null; word_limit: number | null; body: string; words: number; version: number; approved_at: string | null }

export function useStatements(applicationId: string, enabled = true) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ['university', 'statements', applicationId],
    queryFn: () => api.get<Statement[]>(`/university/applications/${applicationId}/statements`),
    enabled: !!applicationId && enabled,
    staleTime: 5 * 60_000,
  });
}

/** Measured preparation: verified shared documents and how fast document requests are answered (n<5 withheld). */
export interface Preparation {
  documents_verified: { value: number | null; numerator: number; denominator: number; definition: string };
  requests: { total: number; answered: number; open: number; cancelled: number; median_days_to_answer: number | null; answered_n: number; insufficient: boolean; definition: string };
  min_denominator: number;
}

export function usePreparation() {
  const { api } = useAuth();
  const { scopeId, needsPick } = useUniversity();
  return useQuery({
    queryKey: ['university', 'preparation', scopeKey(scopeId)],
    queryFn: () => api.get<Preparation>('/university/preparation', { university_id: scopeId }),
    enabled: !needsPick,
    staleTime: 5 * 60_000,
  });
}

// ------------------------------------------------------------------ V8

export function useGlossary() {
  const { api } = useAuth();
  const { needsPick } = useUniversity();
  return useQuery({ queryKey: ['university', 'glossary'], queryFn: () => api.university.glossary(), enabled: !needsPick, staleTime: 60 * 60_000 });
}

export function useExportPresets() {
  const { api } = useAuth();
  const { scopeId, needsPick, perms } = useUniversity();
  return useQuery({
    queryKey: ['university', 'export-presets', scopeKey(scopeId)],
    queryFn: () => api.university.exportPresets(scopeId),
    enabled: !needsPick && perms.canExport,
    staleTime: 10_000,
  });
}

export function useRuleHistory(programId: string | undefined) {
  const { api } = useAuth();
  return useQuery({ queryKey: ['university', 'rule-history', programId], queryFn: () => api.university.ruleHistory(programId!), enabled: !!programId, staleTime: 30_000 });
}
