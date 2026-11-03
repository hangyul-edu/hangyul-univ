/** V5 visa concierge — pure presentation logic for the student visa page (tested in visaroute.test.ts). */
import type { VisaDisplayStatus, VisaDocStatus, VisaPost, VisaRouteDoc, VisaRoutePlan } from '@hangyul/types';

export type RailPhase = 'admission' | 'admissionDocs' | 'visaDocs' | 'apply' | 'decision';
export const RAIL: RailPhase[] = ['admission', 'admissionDocs', 'visaDocs', 'apply', 'decision'];

/** Where the student is on "Admission ✓ → Admission documents ✓ → Visa documents → Visa application → Decision". */
export function railPhase(plan: Pick<VisaRoutePlan, 'inputs' | 'case' | 'display_status'>): RailPhase {
  if (!plan.inputs.admitted) {
    const s = plan.inputs.application_status;
    return s && /^(OFFERED|OFFER_ACCEPTED|TUITION_PENDING|TUITION_PAID|ADMISSION_CERTIFICATE_PENDING)$/.test(s) ? 'admissionDocs' : 'admission';
  }
  const d: VisaDisplayStatus = plan.case?.display_status ?? plan.display_status;
  if (d === 'PREPARING') return 'visaDocs';
  if (d === 'READY' || d === 'SUBMITTED' || d === 'EMBASSY_REQUEST') return 'apply';
  return 'decision';
}

/** ISSUED means the whole rail is done (the arrival plan takes over). */
export function railAllDone(plan: Pick<VisaRoutePlan, 'case'>): boolean {
  return plan.case?.status === 'ISSUED';
}

const STUDENT_ACTION: VisaDocStatus[] = ['NEEDS_FIX', 'EXPIRED', 'NEEDS_LEGALIZATION', 'NEEDS_TRANSLATION', 'NEW_FOR_VISA', 'MISSING', 'FORM'];
const WAITING: VisaDocStatus[] = ['WAITING_UNIVERSITY', 'IN_REVIEW', 'GET_LATER'];
const READYISH: VisaDocStatus[] = ['READY', 'NEAR_EXPIRY', 'AT_REGISTRATION'];

export interface DocGroups { needsYou: VisaRouteDoc[]; waiting: VisaRouteDoc[]; ready: VisaRouteDoc[]; maybe: VisaRouteDoc[]; notNeeded: VisaRouteDoc[] }

/** Requirement-centric groups: what needs the student, what waits on someone else, what is ready (reused), what may apply. */
export function groupDocs(docs: VisaRouteDoc[]): DocGroups {
  const g: DocGroups = { needsYou: [], waiting: [], ready: [], maybe: [], notNeeded: [] };
  for (const d of docs) {
    if (d.applies === 'no' || d.status === 'NOT_NEEDED') g.notNeeded.push(d);
    else if (d.applies === 'maybe') g.maybe.push(d);
    else if (READYISH.includes(d.status)) g.ready.push(d);
    else if (WAITING.includes(d.status)) g.waiting.push(d);
    else if (STUDENT_ACTION.includes(d.status)) g.needsYou.push(d);
    else g.needsYou.push(d);
  }
  return g;
}

/** What the student can do on a document row. */
export type DocAction = 'upload' | 'uploadNew' | 'markReceived' | 'form' | null;
export function docAction(d: VisaRouteDoc): DocAction {
  if (d.status === 'FORM') return 'form';
  if (d.status === 'WAITING_UNIVERSITY' && !d.category) return 'markReceived';
  if (d.status === 'WAITING_UNIVERSITY') return 'upload';
  if (d.status === 'MISSING') return 'upload';
  if (d.status === 'NEW_FOR_VISA' || d.status === 'EXPIRED' || d.status === 'NEEDS_FIX' || d.status === 'NEEDS_LEGALIZATION' || d.status === 'NEEDS_TRANSLATION') {
    return d.document ? 'uploadNew' : 'upload';
  }
  return null;
}

/** i18n key + params for a post ("Korean Embassy in {{city}}"); the city itself is translated by key. */
export function postKey(post: Pick<VisaPost, 'kind' | 'key' | 'city'>): { key: string; cityKey: string; city: string } {
  return { key: `post.${post.kind}`, cityKey: `city.${post.key}`, city: post.city };
}

/** The document shown in "What needs you now" — the plan's next document, else the first that needs the student. */
export function nowDoc(plan: Pick<VisaRoutePlan, 'next' | 'documents'>): VisaRouteDoc | null {
  if (plan.next?.key !== 'document') return null;
  const key = plan.next.params.doc as string | undefined;
  return plan.documents.find((d) => d.key === key) ?? null;
}

/** "Hangyul never declares": the form is complete only when every section was confirmed by the student. */
export function formProgress(plan: Pick<VisaRoutePlan, 'form'>): { done: number; total: number } {
  const s = plan.form?.sections ?? [];
  return { done: s.filter((x) => x.confirmed_at).length, total: s.length };
}

/** Before submission the student records appointment/hand-off/submission; after it, requests / decision / issued visa. */
export type TrackStage = 'before' | 'submitted' | 'request' | 'approved' | 'refused' | 'issued' | 'none';
export function trackStage(plan: Pick<VisaRoutePlan, 'case'>): TrackStage {
  const s = plan.case?.status;
  if (!s) return 'none';
  if (s === 'ISSUED') return 'issued';
  if (s === 'APPROVED') return 'approved';
  if (s === 'REJECTED') return 'refused';
  if (s === 'ADDITIONAL_DOCUMENTS') return 'request';
  if (s === 'SUBMITTED') return 'submitted';
  return 'before';
}

/** Currency amounts stated by the embassy, as they are written (never converted or rounded). */
export function amountsLine(amounts: string[] | undefined): string {
  return (amounts ?? []).filter((a, i, all) => all.indexOf(a) === i).join(' · ');
}
