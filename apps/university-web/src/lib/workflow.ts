/**
 * V22 university workflow — the ONE place the admissions process is defined (REPORT §250 V1, brief §57–§58).
 *
 * The home screen is a strip of stages over the applicant table. Each stage is a filter on `GET /applications`;
 * the strip's count is the `total` of that filter, and selecting the stage runs exactly the same filter on the
 * table — so the number on the strip and the number of rows can never disagree.
 *
 * Grouping of the canonical statuses (every status a university can see appears in exactly one stage, or in
 * the quiet "closed" trailing count):
 *
 *   received      SUBMITTED, administrative check done      — arrived and confirmed, review not yet opened
 *   documents_check SUBMITTED, administrative check pending — the office still has to confirm the documents
 *   in_review     UNIVERSITY_REVIEW + INTERVIEW
 *   documents     ADDITIONAL_DOCUMENTS                       — waiting on the applicant
 *   decision      WAITLISTED                                 — decision pending on our side
 *   admitted      OFFERED + OFFER_ACCEPTED
 *   enrolment     TUITION_* + ADMISSION_CERTIFICATE_* + VISA_*
 *   enrolled      ENROLLED
 *   (closed)      REJECTED + WITHDRAWN                       — a count, not a stage
 *
 * `received` and `documents_check` split the one SUBMITTED status by the server's `admin_check` filter
 * (`/applications?admin_check=done|pending`), so the two are disjoint and both reproduce on the table.
 */
import type { Application, ApplicationStatus, Program } from '@hangyul/types';

import type { ApplicantParams } from './filters';

export const STAGE_KEYS = ['received', 'documents_check', 'in_review', 'documents', 'decision', 'admitted', 'enrolment', 'enrolled'] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export interface StageDef {
  key: StageKey;
  status: ApplicationStatus[];
  admin_check?: 'done' | 'pending';
  /** The university must act here (the tangerine "needs us" mark). */
  needsUs: boolean;
}

export const STAGES: readonly StageDef[] = [
  { key: 'received', status: ['SUBMITTED'], admin_check: 'done', needsUs: true },
  { key: 'documents_check', status: ['SUBMITTED'], admin_check: 'pending', needsUs: true },
  { key: 'in_review', status: ['UNIVERSITY_REVIEW', 'INTERVIEW'], needsUs: true },
  { key: 'documents', status: ['ADDITIONAL_DOCUMENTS'], needsUs: false },
  { key: 'decision', status: ['WAITLISTED'], needsUs: true },
  { key: 'admitted', status: ['OFFERED', 'OFFER_ACCEPTED'], needsUs: false },
  { key: 'enrolment', status: ['TUITION_PENDING', 'TUITION_PAID', 'ADMISSION_CERTIFICATE_PENDING', 'ADMISSION_CERTIFICATE_ISSUED', 'VISA_PREPARATION', 'VISA_SUBMITTED', 'VISA_ISSUED'], needsUs: false },
  { key: 'enrolled', status: ['ENROLLED'], needsUs: false },
];

export const CLOSED_STATUSES: ApplicationStatus[] = ['REJECTED', 'WITHDRAWN'];

export const isStageKey = (v: string | null | undefined): v is StageKey => !!v && (STAGE_KEYS as readonly string[]).includes(v);

export const stageDef = (key: StageKey): StageDef => STAGES.find((s) => s.key === key)!;

/** The list filter a stage stands for — what the strip counts and what the table shows when it is selected. */
export function stageFilter(key: StageKey | null | undefined): Pick<ApplicantParams, 'status'> & { admin_check?: 'done' | 'pending' } {
  if (!key) return { status: [] };
  const s = stageDef(key);
  return s.admin_check ? { status: s.status, admin_check: s.admin_check } : { status: s.status };
}

/**
 * Applies the selected stage to the URL params: the stage's statuses (and administrative-check filter) replace
 * whatever `status=` the URL carried, so a stage is always the whole truth about the status filter.
 */
export function withStage(p: ApplicantParams): ApplicantParams {
  if (!p.stage) return p;
  const f = stageFilter(p.stage);
  return { ...p, status: f.status, admin_check: f.admin_check ?? p.admin_check };
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** The stage an explicit status filter (an old `?status=` link, an analytics drill-down) is equivalent to, if any. */
export function stageFor(status: readonly ApplicationStatus[], adminCheck?: 'done' | 'pending'): StageKey | null {
  if (!status.length) return null;
  return STAGES.find((s) => sameSet(s.status, status) && (s.admin_check ?? undefined) === adminCheck)?.key ?? null;
}

/** The stage one application is in (for the detail page's "where is this applicant" line). */
export function stageOf(a: Pick<Application, 'status'> & { admin_check?: unknown }): StageKey | 'closed' | null {
  if (CLOSED_STATUSES.includes(a.status)) return 'closed';
  const candidates = STAGES.filter((s) => s.status.includes(a.status));
  if (candidates.length === 1) return candidates[0].key;
  if (!candidates.length) return null;
  return candidates.find((s) => (s.admin_check === 'done') === !!a.admin_check)?.key ?? null;
}

/** Statuses where the university has not decided yet — the only time eligibility flags are useful in the list. */
export const AWAITING_DECISION: ApplicationStatus[] = ['SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW', 'WAITLISTED'];
export const awaitingDecision = (s: ApplicationStatus) => AWAITING_DECISION.includes(s);

type T = (key: string, opts?: Record<string, unknown>) => string;

/** "3 requested", "1 returned", "8/8 verified" — what the university can rely on, never a readiness percentage. */
export function documentsText(a: Pick<Application, 'status' | 'open_document_requests' | 'returned_document_requests' | 'documents'>, t: T): string {
  if (a.open_document_requests) return t('university:applicants.requested', { count: a.open_document_requests });
  if (a.status === 'ADDITIONAL_DOCUMENTS' && a.returned_document_requests) return t('university:v4.docs.returned', { count: a.returned_document_requests });
  if (!a.documents || !a.documents.required) return '—';
  return t('university:v4.docs.verified', { verified: a.documents.verified, required: a.documents.required });
}

// ------------------------------------------------------------------ intake dates (toolbar meta)

export interface DateItem { key: string; date: string; kind: 'application_deadline' | 'document_deadline' | 'decision_date' | 'tuition_deadline' | 'semester_start'; intake: string; programs: number; names: string[]; ids: string[] }

/** Upcoming intake dates across programs, grouped so one deadline shared by ten programs is one row. */
export function upcomingDates(programs: Program[], today = new Date(), horizonDays = 150, limit = 6): DateItem[] {
  const kinds: DateItem['kind'][] = ['application_deadline', 'document_deadline', 'decision_date', 'tuition_deadline', 'semester_start'];
  const start = new Date(today.toISOString().slice(0, 10)).getTime();
  const end = start + horizonDays * 86_400_000;
  const map = new Map<string, DateItem>();
  programs.forEach((p) => (p.intakes ?? []).forEach((i) => kinds.forEach((k) => {
    const d = i[k];
    if (!d) return;
    const ts = new Date(d).getTime();
    if (ts < start || ts > end) return;
    const intake = `${i.year}-${i.term}`;
    const key = `${d}|${k}|${intake}`;
    const cur = map.get(key);
    if (cur) { cur.programs += 1; if (p.name_en) cur.names.push(p.name_en); if (p.id) cur.ids.push(p.id); }
    else map.set(key, { key, date: d, kind: k, intake, programs: 1, names: p.name_en ? [p.name_en] : [], ids: p.id ? [p.id] : [] });
  })));
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

/** The nearest intake date — one sentence of toolbar meta, not a widget (brief Part 27). */
export function nextDeadline(programs: Program[]): DateItem | null {
  return upcomingDates(programs, new Date(), 150, 1)[0] ?? null;
}
