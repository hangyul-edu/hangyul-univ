import { APPLICATION_STATUSES, DEGREE_LEVELS, type ApplicationStatus, type DegreeLevel } from '@hangyul/types';

import { isStageKey, type StageKey } from './workflow';

/** Dashboard / analytics filters. They live in the URL so views are shareable and survive reloads. */
export interface AnalyticsFilters {
  intake?: string;
  nationality?: string;
  degree?: DegreeLevel;
  program_id?: string;
  agency_id?: string;
}
export const FILTER_KEYS = ['intake', 'nationality', 'degree', 'program_id', 'agency_id'] as const;

const INTAKE_RE = /^\d{4}-(SPRING|SUMMER|FALL|WINTER)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COUNTRY_RE = /^[A-Z]{2}$/;
const ID_RE = /^[0-9a-f-]{8,64}$/i;

export function isIntakeLabel(v: string | null | undefined): v is string {
  return !!v && INTAKE_RE.test(v);
}

/** Parse filters, dropping anything malformed so a hand-edited URL never breaks the API call. */
export function parseFilters(sp: URLSearchParams): AnalyticsFilters {
  const out: AnalyticsFilters = {};
  const intake = sp.get('intake')?.toUpperCase();
  if (isIntakeLabel(intake)) out.intake = intake;
  const nat = sp.get('nationality')?.toUpperCase();
  if (nat && COUNTRY_RE.test(nat)) out.nationality = nat;
  const degree = sp.get('degree')?.toUpperCase() as DegreeLevel | undefined;
  if (degree && DEGREE_LEVELS.includes(degree)) out.degree = degree;
  const program = sp.get('program_id');
  if (program && ID_RE.test(program)) out.program_id = program;
  const agency = sp.get('agency_id');
  if (agency && ID_RE.test(agency)) out.agency_id = agency;
  return out;
}

/** Returns a new URLSearchParams with the filters applied; unrelated params (e.g. tab) are preserved. */
export function writeFilters(sp: URLSearchParams, f: AnalyticsFilters): URLSearchParams {
  const next = new URLSearchParams(sp);
  FILTER_KEYS.forEach((k) => {
    const v = f[k];
    if (v) next.set(k, v);
    else next.delete(k);
  });
  return next;
}

export function countActive(f: AnalyticsFilters): number {
  return FILTER_KEYS.filter((k) => !!f[k]).length;
}

// ------------------------------------------------------------------ Applicants list

export type ApplicantSort = 'decision' | 'submitted' | 'readiness' | 'deadline' | 'updated';
/** Funnel steps the list can filter by ("reached this step or further") — the exact records behind a funnel bar. */
export const REACHED_STEPS = ['SUBMITTED', 'REVIEWED', 'OFFERED', 'ACCEPTED', 'TUITION_PAID', 'VISA_ISSUED', 'ARRIVED', 'ENROLLED'] as const;
export type ReachedStep = (typeof REACHED_STEPS)[number];
export interface ApplicantParams {
  /** V22: the selected workflow stage (lib/workflow.ts). When set it defines `status` (and the administrative-check filter). */
  stage?: StageKey;
  status: ApplicationStatus[];
  program_id?: string;
  nationality?: string;
  agency_id?: string;
  /** V8: intake key (YYYY-TERM) or one intake id, and degree level — the same filters as Analytics. */
  intake?: string;
  degree?: DegreeLevel;
  /** V8: university reviewer (user id, 'me' or 'none'), administrative check, funnel step reached. */
  reviewer?: string;
  admin_check?: 'done' | 'pending';
  reached?: ReachedStep;
  flagged?: boolean;
  /** V4 triage: applications with a document request still open, or with every request answered ("returned"). */
  requests?: 'open' | 'returned';
  /** V9: applicant vs. published minimums (the drill-down behind "qualified demand"). */
  eligibility?: 'MEETS' | 'BELOW' | 'TO_CHECK';
  /** V25 (REPORT §315 U1): submitted / moved within the last N days — the home headline's "what changed". */
  submitted_within?: number;
  updated_within?: number;
  /** V25: applications submitted in one calendar month (YYYY-MM), from the Insights trend. */
  submitted_month?: string;
  q?: string;
  sort: ApplicantSort;
  page: number;
  page_size: number;
}

// V26 (REPORT §336 U2): the default puts the applicants who need a decision first (the headline's first figure).
const SORTS: ApplicantSort[] = ['decision', 'submitted', 'readiness', 'deadline', 'updated'];

export function parseApplicantParams(sp: URLSearchParams): ApplicantParams {
  const status = sp.getAll('status').flatMap((s) => s.split(',')).map((s) => s.trim().toUpperCase())
    .filter((s): s is ApplicationStatus => (APPLICATION_STATUSES as string[]).includes(s));
  const f = parseFilters(sp);
  const flaggedRaw = sp.get('flagged');
  const sort = sp.get('sort') as ApplicantSort | null;
  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1);
  const size = Number.parseInt(sp.get('page_size') ?? '20', 10);
  const q = sp.get('q')?.trim();
  const requests = sp.get('requests');
  const intakeRaw = sp.get('intake')?.trim();
  const reviewer = sp.get('reviewer');
  const adminCheck = sp.get('admin_check');
  const reached = sp.get('reached')?.toUpperCase() as ReachedStep | undefined;
  const elig = sp.get('eligibility')?.toUpperCase();
  const stage = sp.get('stage');
  const within = (k: string) => { const n = Number.parseInt(sp.get(k) ?? '', 10); return n >= 1 && n <= 366 ? n : undefined; };
  return {
    stage: isStageKey(stage) ? stage : undefined,
    status: [...new Set(status)],
    program_id: f.program_id,
    nationality: f.nationality,
    agency_id: f.agency_id,
    intake: f.intake ?? (intakeRaw && UUID_RE.test(intakeRaw) ? intakeRaw : undefined),
    degree: f.degree,
    reviewer: reviewer && (reviewer === 'me' || reviewer === 'none' || UUID_RE.test(reviewer)) ? reviewer : undefined,
    admin_check: adminCheck === 'done' || adminCheck === 'pending' ? adminCheck : undefined,
    reached: reached && (REACHED_STEPS as readonly string[]).includes(reached) ? reached : undefined,
    flagged: flaggedRaw === 'true' ? true : flaggedRaw === 'false' ? false : undefined,
    requests: requests === 'open' || requests === 'returned' ? requests : undefined,
    eligibility: elig === 'MEETS' || elig === 'BELOW' || elig === 'TO_CHECK' ? elig : undefined,
    submitted_within: within('submitted_within'),
    updated_within: within('updated_within'),
    submitted_month: /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.get('submitted_month') ?? '') ? sp.get('submitted_month')! : undefined,
    q: q ? q.slice(0, 120) : undefined,
    sort: sort && SORTS.includes(sort) ? sort : 'decision',
    page,
    page_size: [10, 20, 50, 100].includes(size) ? size : 20,
  };
}

export function writeApplicantParams(p: Partial<ApplicantParams>): URLSearchParams {
  const sp = new URLSearchParams();
  if (p.stage) sp.set('stage', p.stage);
  (p.status ?? []).forEach((s) => sp.append('status', s));
  if (p.program_id) sp.set('program_id', p.program_id);
  if (p.nationality) sp.set('nationality', p.nationality);
  if (p.agency_id) sp.set('agency_id', p.agency_id);
  if (p.intake) sp.set('intake', p.intake);
  if (p.degree) sp.set('degree', p.degree);
  if (p.reviewer) sp.set('reviewer', p.reviewer);
  if (p.admin_check) sp.set('admin_check', p.admin_check);
  if (p.reached) sp.set('reached', p.reached);
  if (p.flagged !== undefined) sp.set('flagged', String(p.flagged));
  if (p.requests) sp.set('requests', p.requests);
  if (p.eligibility) sp.set('eligibility', p.eligibility);
  if (p.submitted_within) sp.set('submitted_within', String(p.submitted_within));
  if (p.updated_within) sp.set('updated_within', String(p.updated_within));
  if (p.submitted_month) sp.set('submitted_month', p.submitted_month);
  if (p.q) sp.set('q', p.q);
  if (p.sort && p.sort !== 'decision') sp.set('sort', p.sort);
  if (p.page && p.page > 1) sp.set('page', String(p.page));
  if (p.page_size && p.page_size !== 20) sp.set('page_size', String(p.page_size));
  return sp;
}

/** Link to the applicant table with the given filters — used by every drill-down. (`/applicants` and `/` are the same screen in V22.) */
export function applicantsLink(p: Partial<ApplicantParams>): string {
  const s = writeApplicantParams(p).toString();
  return s ? `/applicants?${s}` : '/applicants';
}

/** Secondary filters shown as removable chips on Applicants (status is the view tabs). */
export const CHIP_KEYS = ['intake', 'degree', 'program_id', 'nationality', 'agency_id', 'reached', 'reviewer', 'admin_check', 'flagged', 'requests', 'eligibility', 'submitted_within', 'updated_within', 'submitted_month'] as const;
export type ChipKey = (typeof CHIP_KEYS)[number];
export function activeChips(p: ApplicantParams): ChipKey[] {
  return CHIP_KEYS.filter((k) => p[k] !== undefined && p[k] !== '');
}
