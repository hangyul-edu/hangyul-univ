import type { Dashboard, JourneyStage } from '@hangyul/types';
import { applicationWaitingOn } from '@hangyul/utils';

/**
 * V22 student journey (REPORT §248 S1).
 *
 * The API tells the journey in nine stages; the student recognises six: 01 탐색 · 02 준비 · 03 지원 · 04 합격 ·
 * 05 비자 · 06 입국. This is the one place that mapping lives — the home strip, its summaries and any test read
 * it from here, never from a second copy.
 */
export type Phase = 'discover' | 'prepare' | 'apply' | 'admission' | 'visa' | 'arrival';
export const PHASES: Phase[] = ['discover', 'prepare', 'apply', 'admission', 'visa', 'arrival'];

export type PhaseState = 'done' | 'current' | 'todo';

/** API stage → student phase. EXPLORE/PROFILE/MATCH are all "discover"; ARRIVAL and STUDENT_LIFE are both "arrival". */
export function phaseOfStage(stage: JourneyStage | string): Phase {
  switch (stage) {
    case 'EXPLORE': case 'PROFILE': case 'MATCH': return 'discover';
    case 'APPLY': return 'prepare';
    case 'DECISION': return 'apply';
    case 'ENROLL': return 'admission';
    case 'VISA': return 'visa';
    default: return 'arrival';
  }
}

/** The six phases with their state relative to the current one — exactly one is `current`. */
export function journeyPhases(stage: JourneyStage | string): { key: Phase; state: PhaseState }[] {
  const idx = PHASES.indexOf(phaseOfStage(stage));
  return PHASES.map((key, i) => ({ key, state: i < idx ? 'done' : i === idx ? 'current' : 'todo' }));
}

/** Recommendations belong to stage 01 only, and only while nothing has been applied for (REPORT §248 S2). */
export function showsRecommendations(d: Pick<Dashboard, 'journey' | 'applications'>): boolean {
  return phaseOfStage(d.journey.stage) === 'discover' && d.applications.length === 0;
}

/** Statuses where the next move is the student's (respond, upload, pay, prepare) rather than the team's or the university's. */
export const STUDENT_STATUSES: ReadonlySet<string> = new Set([
  'DRAFT', 'DOCUMENT_PREPARATION', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW', 'OFFERED', 'TUITION_PENDING', 'VISA_PREPARATION',
]);

/** Statuses where the Hangyul team is actively working the application — what the home's "doing now" block lists. */
export const TEAM_STATUSES: Record<string, 'review' | 'submit' | 'follow' | 'letter' | 'visa'> = {
  PROFILE_REVIEW: 'review', READY: 'submit',
  SUBMITTED: 'follow', UNIVERSITY_REVIEW: 'follow', ADDITIONAL_DOCUMENTS: 'follow', INTERVIEW: 'follow', WAITLISTED: 'follow',
  TUITION_PAID: 'letter', ADMISSION_CERTIFICATE_PENDING: 'letter', VISA_SUBMITTED: 'visa',
};

/** An application needs the student when its status is theirs, or when a document or improvement for it is open. */
export function needsStudent(d: Pick<Dashboard, 'missing_documents' | 'improve'>, a: { id: string; status: string; university: { name_en: string } }): boolean {
  if (STUDENT_STATUSES.has(a.status)) return true;
  if (d.missing_documents.some((m) => (m.application_id ? m.application_id === a.id : m.university === a.university.name_en))) return true;
  return (d.improve ?? []).some((i) => i.application_id === a.id);
}

/**
 * The waiting state: the API found nothing that is the student's to do (`next_action.code === 'WAIT'`,
 * `server/app/api/v1/student.py`). It is the one signal the home uses — never inferred from counts.
 */
export function isWaiting(d: Pick<Dashboard, 'next_action'>): boolean {
  return d.next_action.code === 'WAIT';
}

/** Applications whose next move is the university's (the shared waiting-on model, `applicationWaitingOn`). */
export function withUniversity<A extends { status: string }>(d: { applications: A[] }): A[] {
  return d.applications.filter((a) => applicationWaitingOn(a.status as Parameters<typeof applicationWaitingOn>[0]) === 'university');
}

/** Applications a university is actually reviewing — the only ones the home may describe as "being reviewed". */
export function underReview<A extends { status: string }>(d: { applications: A[] }): A[] {
  return d.applications.filter((a) => a.status === 'UNIVERSITY_REVIEW');
}
