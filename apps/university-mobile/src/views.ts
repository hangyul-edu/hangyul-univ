import type { ApplicationStatus } from '@hangyul/types';

/** Admissions views shared by the Needs review and Applicants tabs. */
export const VIEWS = ['review', 'documents', 'interview', 'offer', 'admitted', 'enrolment', 'flagged', 'all'] as const;
/** V26 (REPORT §337): the web headline's four figures, as views the phone can open (same API filters, so count = rows). */
export const HEAD_VIEWS = ['decide', 'requests', 'fresh', 'moved'] as const;
export type HeadView = (typeof HEAD_VIEWS)[number];
export type ViewKey = (typeof VIEWS)[number] | HeadView;
/** Mirrors apps/university-web/src/lib/workflow.ts AWAITING_DECISION. */
export const AWAITING_DECISION: ApplicationStatus[] = ['SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW', 'WAITLISTED'];
/** The extra list filters a view adds (the web console's headline uses the same ones). */
export function viewQuery(view: ViewKey): Record<string, unknown> {
  switch (view) {
    case 'decide': return { status: AWAITING_DECISION };
    case 'requests': return { requests: 'open' };
    case 'fresh': return { submitted_within_days: 7 };
    case 'moved': return { updated_within_days: 7 };
    default: return { status: VIEW_STATUSES[view] ?? undefined, flagged: view === 'flagged' || undefined };
  }
}
export const VIEW_STATUSES: Record<(typeof VIEWS)[number], ApplicationStatus[] | null> = {
  review: ['SUBMITTED', 'UNIVERSITY_REVIEW'],
  documents: ['ADDITIONAL_DOCUMENTS'],
  interview: ['INTERVIEW'],
  offer: ['OFFERED', 'WAITLISTED'],
  admitted: ['OFFER_ACCEPTED', 'TUITION_PENDING', 'TUITION_PAID', 'ADMISSION_CERTIFICATE_PENDING', 'ADMISSION_CERTIFICATE_ISSUED'],
  enrolment: ['VISA_PREPARATION', 'VISA_SUBMITTED', 'VISA_ISSUED'],
  flagged: null,
  all: null,
};

/** Decisions that end the application for the applicant — always offered last and drawn apart from the rest. */
export const NEGATIVE_DECISIONS: ApplicationStatus[] = ['REJECTED', 'WITHDRAWN'];
const PRIMARY_ORDER: ApplicationStatus[] = ['OFFERED', 'TUITION_PENDING', 'TUITION_PAID', 'ADMISSION_CERTIFICATE_ISSUED', 'ENROLLED', 'UNIVERSITY_REVIEW'];
/**
 * The one primary action for a state, in the web console's order (apps/university-web ApplicationDetail `decisionPlan`):
 * a new submission starts the review; otherwise the step that moves the application forward. It only ever picks from
 * the transitions the API allows, and falls back to the first non-negative one.
 */
export function primaryDecision(status: ApplicationStatus, allowed: ApplicationStatus[]): ApplicationStatus | undefined {
  if (status === 'SUBMITTED' && allowed.includes('UNIVERSITY_REVIEW')) return 'UNIVERSITY_REVIEW';
  return PRIMARY_ORDER.find((s) => allowed.includes(s)) ?? allowed.find((s) => !NEGATIVE_DECISIONS.includes(s));
}
