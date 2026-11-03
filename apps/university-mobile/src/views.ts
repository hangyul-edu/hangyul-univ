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
