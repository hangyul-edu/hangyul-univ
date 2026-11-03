import type { Application, ApplicationStatus } from '@hangyul/types';

/** Statuses where the university has not decided yet. */
export const AWAITING: ApplicationStatus[] = ['SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW', 'WAITLISTED'];

export type DecisionNeed =
  | { kind: 'decided' }
  | { kind: 'waiting_applicant'; count: number }
  | { kind: 'returned'; count: number }
  | { kind: 'below'; items: string[] }
  | { kind: 'check'; items: string[] }
  | { kind: 'unverified'; count: number }
  | { kind: 'interview' }
  | { kind: 'ready' };

/**
 * "What does a decision on this application need?" — one answer per row of the applicant list, in the order an officer
 * would act on it: the applicant owes documents → documents came back → a published minimum is not met → something must
 * be checked by hand → required documents are not verified yet → interview → nothing: ready to decide.
 * Informational only; the decision stays human.
 */
export function decisionNeed(a: Pick<Application, 'status' | 'eligibility' | 'documents' | 'open_document_requests' | 'returned_document_requests'>): DecisionNeed {
  if (!AWAITING.includes(a.status)) return { kind: 'decided' };
  if (a.open_document_requests) return { kind: 'waiting_applicant', count: a.open_document_requests };
  if (a.status === 'ADDITIONAL_DOCUMENTS' && a.returned_document_requests) return { kind: 'returned', count: a.returned_document_requests };
  const e = a.eligibility;
  if (e?.status === 'BELOW' && e.below.length) return { kind: 'below', items: e.below };
  if (e?.status === 'TO_CHECK' && e.unknown.length) return { kind: 'check', items: e.unknown };
  const d = a.documents;
  if (d && d.required > d.verified) return { kind: 'unverified', count: d.required - d.verified };
  if (a.status === 'INTERVIEW') return { kind: 'interview' };
  return { kind: 'ready' };
}

export const NEED_TONE: Record<DecisionNeed['kind'], 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  decided: 'neutral', waiting_applicant: 'neutral', returned: 'info', below: 'danger', check: 'warning', unverified: 'warning', interview: 'info', ready: 'success',
};

/** Bulk result summary: how many succeeded, and the failures grouped by reason. */
export function summarizeBulk(results: { id: string; ok: boolean; result?: string; error?: string }[]) {
  const ok = results.filter((r) => r.ok);
  const changed = ok.filter((r) => r.result !== 'unchanged').length;
  const failures: Record<string, string[]> = {};
  results.filter((r) => !r.ok).forEach((r) => { (failures[r.error ?? 'error'] ??= []).push(r.id); });
  return { succeeded: ok.length, changed, unchanged: ok.length - changed, failed: results.length - ok.length, failures };
}
