import type { ApplicationStatus, CohortStudent, RateKpi } from '@hangyul/types';

/** Mirrors the API's MIN_DENOMINATOR: rates with fewer records are withheld instead of shown as noisy percentages. */
export const MIN_N = 5;

export function rateOf(numerator: number, denominator: number, min = MIN_N): RateKpi {
  if (denominator < min) return { value: null, numerator, denominator, insufficient_data: true };
  return { value: Math.round((numerator / denominator) * 10000) / 10000, numerator, denominator, insufficient_data: false };
}

// ------------------------------------------------------------------ Lifecycle funnel

export const LIFECYCLE_STAGES = ['INTERESTED', 'PREPARING', 'APPLIED', 'ADMITTED', 'TUITION_PAID', 'VISA_ISSUED', 'ARRIVED', 'ENROLLED', 'RETAINED', 'GRADUATED'] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export interface FunnelStep {
  stage: string;
  count: number;
  note?: string;
  /** Conversion from the previous stage, or null when it cannot be computed honestly. */
  conversion: number | null;
  /** Why the conversion is withheld. */
  conversionNote?: 'noPrevious' | 'mixedPopulation' | 'aggregate';
}

/**
 * Stage-to-stage conversion. Later lifecycle stages (enrolled/retained/graduated) include earlier cohorts, so a stage can exceed
 * the one before it; in that case we say so instead of printing a >100% "conversion".
 * INTERESTED → PREPARING is not a conversion either (saving a university is not a step toward a specific application).
 */
export function funnelSteps(funnel: { stage: string; count: number; note?: string }[]): FunnelStep[] {
  return funnel.map((s, i) => {
    if (i === 0) return { ...s, conversion: null, conversionNote: undefined };
    const prev = funnel[i - 1];
    if (s.stage === 'PREPARING' || prev.stage === 'PREPARING') return { ...s, conversion: null, conversionNote: 'aggregate' };
    if (!prev.count) return { ...s, conversion: null, conversionNote: 'noPrevious' };
    if (s.count > prev.count) return { ...s, conversion: null, conversionNote: 'mixedPopulation' };
    return { ...s, conversion: s.count / prev.count };
  });
}

/** Where a funnel stage drills down to. */
export function stageLink(stage: string): { kind: 'applicants'; status: ApplicationStatus[] } | { kind: 'cohorts'; tab: string } | null {
  switch (stage) {
    case 'APPLIED':
      return { kind: 'applicants', status: [] };
    case 'ADMITTED':
      return { kind: 'applicants', status: ['OFFERED', 'OFFER_ACCEPTED', 'TUITION_PENDING', 'TUITION_PAID', 'ADMISSION_CERTIFICATE_PENDING', 'ADMISSION_CERTIFICATE_ISSUED', 'VISA_PREPARATION', 'VISA_SUBMITTED', 'VISA_ISSUED', 'ENROLLED'] };
    case 'TUITION_PAID':
      return { kind: 'applicants', status: ['TUITION_PAID', 'ADMISSION_CERTIFICATE_PENDING', 'ADMISSION_CERTIFICATE_ISSUED', 'VISA_PREPARATION', 'VISA_SUBMITTED', 'VISA_ISSUED', 'ENROLLED'] };
    case 'VISA_ISSUED':
      return { kind: 'applicants', status: ['VISA_ISSUED', 'ENROLLED'] };
    case 'ARRIVED':
    case 'ENROLLED':
      return { kind: 'cohorts', tab: 'overview' };
    case 'RETAINED':
      return { kind: 'cohorts', tab: 'retention' };
    case 'GRADUATED':
      return { kind: 'cohorts', tab: 'graduation' };
    default:
      return null;
  }
}

// ------------------------------------------------------------------ Cohorts

export interface CohortSummary {
  cohort: string;
  total: number;
  enrolled: number;
  onLeave: number;
  withdrawn: number;
  transferred: number;
  graduated: number;
  retention: RateKpi;
  graduation: RateKpi;
  atRisk: number;
}

const DAY = 86_400_000;
function toDate(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
}

/** Retained = still enrolled / on leave / graduated among students who reached a second term (same definition as the API). */
export function isRetentionEligible(s: CohortStudent): boolean {
  return s.terms.length >= 2 || s.status === 'GRADUATED';
}
export function isRetained(s: CohortStudent): boolean {
  return ['ENROLLED', 'GRADUATED', 'ON_LEAVE'].includes(s.status);
}
/** Graduation is measured only for students whose expected graduation date has passed. */
export function isGraduationDue(s: CohortStudent, today: Date): boolean {
  return !!s.expected_graduation && toDate(s.expected_graduation).getTime() < today.getTime();
}

export function summarizeCohort(cohort: string, students: CohortStudent[], today = new Date(), min = MIN_N): CohortSummary {
  const count = (st: string) => students.filter((s) => s.status === st).length;
  const reached = students.filter(isRetentionEligible);
  const due = students.filter((s) => isGraduationDue(s, today));
  return {
    cohort,
    total: students.length,
    enrolled: count('ENROLLED'),
    onLeave: count('ON_LEAVE'),
    withdrawn: count('WITHDRAWN'),
    transferred: count('TRANSFERRED'),
    graduated: count('GRADUATED'),
    retention: rateOf(reached.filter(isRetained).length, reached.length, min),
    graduation: rateOf(due.filter((s) => s.status === 'GRADUATED').length, due.length, min),
    atRisk: students.filter((s) => (s.risk?.flags.length ?? 0) > 0).length,
  };
}

export function cohortSummaries(students: CohortStudent[], today = new Date(), min = MIN_N): CohortSummary[] {
  const groups = new Map<string, CohortStudent[]>();
  students.forEach((s) => groups.set(s.cohort, [...(groups.get(s.cohort) ?? []), s]));
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([c, list]) => summarizeCohort(c, list, today, min));
}

/** Enrolled students whose visa expires within `days` (or has already expired). Sorted soonest first. */
export function visaExpiring(students: CohortStudent[], days = 60, today = new Date()): (CohortStudent & { daysLeft: number })[] {
  return students
    .filter((s) => s.status === 'ENROLLED' && s.visa_expires_on)
    .map((s) => ({ ...s, daysLeft: Math.ceil((toDate(s.visa_expires_on as string).getTime() - today.getTime()) / DAY) }))
    .filter((s) => s.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export const RISK_FLAGS = ['LOW_ATTENDANCE', 'ACADEMIC_STANDING', 'VISA_EXPIRING', 'NOT_REGISTERED'] as const;

export function riskWorklist(students: CohortStudent[]): CohortStudent[] {
  const weight = (s: CohortStudent) => s.risk?.flags.length ?? 0;
  return students.filter((s) => weight(s) > 0).sort((a, b) => weight(b) - weight(a) || a.student.localeCompare(b.student));
}

export function riskCounts(students: CohortStudent[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(RISK_FLAGS.map((f) => [f, 0]));
  students.forEach((s) => s.risk?.flags.forEach((f) => { out[f] = (out[f] ?? 0) + 1; }));
  return out;
}

/** Term labels sort chronologically ("2024-SPRING" < "2024-FALL" < "2025-SPRING"). */
const TERM_ORDER: Record<string, number> = { SPRING: 1, SUMMER: 2, FALL: 3, WINTER: 4 };
export function compareTerm(a: string, b: string): number {
  const [ya, ta] = a.split('-');
  const [yb, tb] = b.split('-');
  return Number(ya) - Number(yb) || (TERM_ORDER[ta] ?? 0) - (TERM_ORDER[tb] ?? 0);
}

export interface TermPoint { term: string; gpa: number | null; attendance: number | null; n: number; feed: number; selfReported: number }

/** Average GPA % and attendance % per term across integrated records. Terms with fewer than `min` records are withheld. */
export function termTrend(students: CohortStudent[], min = MIN_N): TermPoint[] {
  const acc = new Map<string, { gpa: number[]; att: number[]; feed: number; self: number; n: number }>();
  students.forEach((s) => s.terms.forEach((t) => {
    const a = acc.get(t.term) ?? { gpa: [], att: [], feed: 0, self: 0, n: 0 };
    a.n += 1;
    if (t.gpa_percent !== null) a.gpa.push(t.gpa_percent);
    if (t.attendance_percent !== null) a.att.push(t.attendance_percent);
    if (t.data_source === 'UNIVERSITY_FEED') a.feed += 1;
    else a.self += 1;
    acc.set(t.term, a);
  }));
  const avg = (xs: number[]) => (xs.length >= min ? Math.round((xs.reduce((x, y) => x + y, 0) / xs.length) * 10) / 10 : null);
  return [...acc.entries()].sort(([a], [b]) => compareTerm(a, b)).map(([term, a]) => ({
    term, gpa: avg(a.gpa), attendance: avg(a.att), n: a.n, feed: a.feed, selfReported: a.self,
  }));
}

export function latestTerm(s: CohortStudent) {
  return [...s.terms].sort((a, b) => compareTerm(a.term, b.term)).at(-1) ?? null;
}

// ------------------------------------------------------------------ Offers / yield

export function yieldSummary(statuses: ApplicationStatus[]) {
  const c = (xs: ApplicationStatus[]) => statuses.filter((s) => xs.includes(s)).length;
  const offered = statuses.length;
  const accepted = c(['OFFER_ACCEPTED', 'TUITION_PENDING', 'TUITION_PAID', 'ADMISSION_CERTIFICATE_PENDING', 'ADMISSION_CERTIFICATE_ISSUED']);
  const paid = c(['TUITION_PAID', 'ADMISSION_CERTIFICATE_PENDING', 'ADMISSION_CERTIFICATE_ISSUED']);
  const awaiting = c(['OFFERED']);
  return { offered, awaiting, accepted, paid, acceptRate: rateOf(accepted, offered), paidRate: rateOf(paid, offered) };
}

/** Partnership incentive progress: next tier and how many more enrolments reach it. */
export function incentiveProgress(tiers: { min_enrolled: number; bonus_krw: number }[], enrolled: number) {
  const sorted = [...tiers].sort((a, b) => a.min_enrolled - b.min_enrolled);
  const reached = sorted.filter((t) => enrolled >= t.min_enrolled);
  const next = sorted.find((t) => enrolled < t.min_enrolled) ?? null;
  return { sorted, reached, next, toNext: next ? next.min_enrolled - enrolled : 0, max: sorted.at(-1)?.min_enrolled ?? 0 };
}
