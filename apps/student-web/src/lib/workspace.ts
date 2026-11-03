import { docLabel } from '@hangyul/i18n';
import type { ApplicationDetail, ChecklistItem, EssaySummary } from '@hangyul/types';

import type { TFn } from './i18n';

/**
 * V4 application workspace model. Every requirement becomes exactly ONE item, in exactly ONE lane, in its true state.
 * An essay and the document requirement of the same kind (personal statement, study plan…) are one item.
 * The lanes are the application's checklist — nothing else on the page repeats them.
 */
export type Lane = 'you' | 'team' | 'university';
export type ItemState = 'todo' | 'active' | 'late' | 'waiting' | 'done';
export interface WsItem {
  key: string;
  lane: Lane;
  state: ItemState;
  title: string;
  detail?: string;
  href?: string;
  action?: string;
  due?: string | null;
  /** Lower = more urgent. Only 'todo' items in the 'you' lane compete for the hero. */
  priority: number;
  requestId?: string;
}

const ESSAY_FOR: Record<string, EssaySummary['essay_type']> = { PERSONAL_STATEMENT: 'PERSONAL_STATEMENT', STUDY_PLAN: 'STUDY_PLAN', CV: 'CV', RECOMMENDATION: 'RECOMMENDATION' };
const STUDENT_ESSAY = new Set(['DRAFT', 'CHANGES_REQUESTED', 'STUDENT_REVISION']);
const TEAM_ESSAY = new Set(['SUBMITTED', 'AI_PRECHECK', 'AGENCY_REVIEW', 'FINAL_REVIEW']);
const REVIEW = new Set(['SUBMITTED', 'UNIVERSITY_REVIEW', 'INTERVIEW', 'ADDITIONAL_DOCUMENTS']);
const PREP = new Set(['DRAFT', 'PROFILE_REVIEW', 'DOCUMENT_PREPARATION', 'READY']);

/** "Family relationship certificate" → "family relationship certificate" (keeps acronyms like "TOPIK"). */
export function lc(label: string): string {
  const first = label.split(' ', 1)[0];
  // Keep acronyms and mixed-case words ("TOPIK", "GKS", "E2E", "iPhone"): only a plain capitalised word is lowered.
  if (first.length < 2 || /[A-Z0-9]/.test(first.slice(1))) return label;
  return label[0].toLowerCase() + label.slice(1);
}

/**
 * The checklist's explanation in the reader's language, from `action_code` + `action_params` (the API's `action` is the
 * English fallback). A reviewer's correction note is quoted as written.
 */
export function checklistDetail(t: TFn, c: Pick<ChecklistItem, 'action_code' | 'action'> & { action_params?: Record<string, unknown> | null }, fmt: (d: string) => string): string | undefined {
  const p = c.action_params ?? null;
  if (!c.action_code) return undefined;
  if (!p) return c.action ?? (t(`checklist.action.${c.action_code}`, { defaultValue: '' }) || undefined); // older API: English fallback
  switch (c.action_code) {
    case 'FIX': return p.reason ? t('dossier:reason.NEEDS_FIX', { reason: `\u2068${p.reason}\u2069` }) : t('checklist.action.FIX');
    case 'TOO_OLD': return p.days && p.issued ? t('dossier:reason.TOO_OLD', { university: p.university, days: p.days, issued: fmt(String(p.issued)) }) : t('checklist.action.TOO_OLD');
    case 'RENEW': case 'LEGALIZE': case 'IN_REVIEW': case 'UPLOAD': return t(`checklist.action.${c.action_code}`);
    default: return c.action ?? undefined;
  }
}

/**
 * V27 (REPORT §357): what the document needs before the university takes it — decided on the server from the issuing
 * country and the date. One sentence, the specific route named (apostille vs consular), translation/notarization after.
 */
export function treatmentLine(t: TFn, c: Pick<ChecklistItem, 'treatment' | 'condition' | 'applies' | 'required'>): string | undefined {
  const tr = c.treatment;
  const parts: string[] = [];
  if (!c.required && c.applies === null && c.condition) parts.push(t('v27.doc.ifApplies', { condition: c.condition }));
  if (tr && !tr.legalization_done && ['APOSTILLE', 'CONSULAR', 'CHINA_CHSI'].includes(tr.legalization)) parts.push(t(`v27.doc.legal.${tr.legalization}`));
  if (tr?.translation && tr?.notarization) parts.push(t('v27.doc.translationNotarized'));
  else if (tr?.translation) parts.push(t('v27.doc.translation'));
  else if (tr?.notarization) parts.push(t('v27.doc.notarization'));
  return parts.length ? parts.join(' ') : undefined;
}

export interface WsContext { counselor: string | null; formatDate: (d: string) => string }

export function buildWorkspace(a: ApplicationDetail, t: TFn, ctx: WsContext): WsItem[] {
  const items: WsItem[] = [];
  const uni = a.university.name_en;
  const prep = PREP.has(a.status);
  const deadline = prep ? a.intake.application_deadline : null;
  const who = ctx.counselor ?? t('v4.ws.yourCounselor');
  const label = (c: ChecklistItem) => lc(docLabel(t, c));
  const essays = a.essays ?? [];
  const usedEssays = new Set<string>();

  // University requests: the student sends exactly what the university asked for.
  (a.document_requests ?? []).forEach((r) => {
    if (r.status === 'OPEN') {
      items.push({ key: `req-${r.id}`, lane: 'you', state: 'todo', priority: 0, requestId: r.id, title: t('v4.ws.you.request', { label: lc(docLabel(t, r)), university: uni }),
        detail: r.note ?? undefined, due: r.due_date ?? null, action: t('ws3.request.upload') });
    } else if (r.status === 'FULFILLED') {
      items.push({ key: `reqf-${r.id}`, lane: 'university', state: 'done', priority: 90, title: t('ws3.uni.received', { label: docLabel(t, r) }) });
    }
  });

  const verified: string[] = [];
  // V27: an item the guide asks for only in some cases (portfolio for arts, a CN-only certificate…) is not a to-do for
  // everyone. It stays in the full checklist with its condition; the lanes carry only what this student must do.
  const conditional = a.checklist.filter((c) => !c.required && c.action_code !== 'UNIVERSITY_REQUEST' && !c.document_id);
  if (conditional.length) {
    items.push({ key: 'conditional', lane: 'you', state: 'waiting', priority: 95, href: '#checklist',
      title: t('v27.ws.conditional', { count: conditional.length }), detail: conditional.slice(0, 3).map((c) => docLabel(t, c)).join(', ') });
  }
  a.checklist.filter((c) => c.action_code !== 'UNIVERSITY_REQUEST' && !conditional.includes(c)).forEach((c) => {
    const essay = ESSAY_FOR[c.category] ? essays.find((e) => e.essay_type === ESSAY_FOR[c.category]) : undefined;
    if (essay) usedEssays.add(essay.id);
    const name = label(c);
    if (c.ready) { verified.push(docLabel(t, c)); return; }
    // Essay-backed requirement: the essay's state is the truth until the essay is approved.
    if (essay && essay.status !== 'APPROVED' && (c.action_code === 'UPLOAD' || !c.action_code)) {
      if (STUDENT_ESSAY.has(essay.status)) {
        const changes = essay.status !== 'DRAFT';
        items.push({ key: c.requirement_id, lane: 'you', state: 'todo', priority: changes ? 2 : 5, href: `/essays/${essay.id}`,
          title: t(changes ? 'v4.ws.you.reviseEssay' : 'v4.ws.you.writeEssay', { essay: name }),
          detail: changes ? t('v4.ws.why.changes', { name: who }) : t('v4.ws.why.essay', { name: who }),
          action: t('v4.ws.action.openEssay', { essay: name }), due: essay.due_date ?? deadline });
      } else if (TEAM_ESSAY.has(essay.status)) {
        items.push({ key: c.requirement_id, lane: 'team', state: 'active', priority: 50, title: t('v4.ws.team.readingEssay', { name: who, essay: name }),
          detail: t('v4.ws.team.readingEssayDetail'), href: `/essays/${essay.id}` });
      }
      return;
    }
    if (c.action_code === 'IN_REVIEW') {
      const late = !!c.review_overdue;
      items.push({ key: c.requirement_id, lane: 'team', state: late ? 'late' : 'active', priority: 50, title: t('v4.ws.team.checking', { label: name }),
        detail: late ? t('v4.review.late') : c.review_since ? t('v4.review.onTime', { date: ctx.formatDate(c.review_since) }) : t('v4.review.usual') });
      return;
    }
    const code = c.action_code ?? 'UPLOAD';
    const approvedEssay = essay && essay.status === 'APPROVED';
    const p = code === 'FIX' ? 1 : code === 'LEGALIZE' || code === 'RENEW' || code === 'TOO_OLD' ? 3 : 4;
    const href = code === 'UPLOAD' || !c.document_id ? `/documents?upload=${c.category}` : `/documents?doc=${c.document_id}`;
    items.push({ key: c.requirement_id, lane: 'you', state: 'todo', priority: p, href, due: deadline,
      title: approvedEssay && code === 'UPLOAD' ? t('v4.ws.you.uploadApproved', { essay: name }) : t(`v4.ws.you.doc.${code}`, { label: name, defaultValue: t('v4.ws.you.doc.UPLOAD', { label: name }) }),
      detail: [code === 'UPLOAD' ? t('v4.ws.why.needed', { university: uni }) : checklistDetail(t, c, ctx.formatDate), treatmentLine(t, c)]
        .filter(Boolean).join(' ') || undefined,
      action: t(`v4.ws.action.${code}`, { defaultValue: t('v4.ws.action.UPLOAD') }) });
  });
  // Essays with no matching document requirement still need to be written and approved.
  essays.filter((e) => !usedEssays.has(e.id)).forEach((e) => {
    const essay = lc(t(`common:essayType.${e.essay_type}`));
    if (STUDENT_ESSAY.has(e.status)) {
      const changes = e.status !== 'DRAFT';
      items.push({ key: e.id, lane: 'you', state: 'todo', priority: changes ? 2 : 5, href: `/essays/${e.id}`, due: e.due_date ?? deadline,
        title: t(changes ? 'v4.ws.you.reviseEssay' : 'v4.ws.you.writeEssay', { essay }),
        detail: changes ? t('v4.ws.why.changes', { name: who }) : t('v4.ws.why.essay', { name: who }), action: t('v4.ws.action.openEssay', { essay }) });
    } else if (TEAM_ESSAY.has(e.status)) {
      items.push({ key: e.id, lane: 'team', state: 'active', priority: 50, href: `/essays/${e.id}`, title: t('v4.ws.team.readingEssay', { name: who, essay }), detail: t('v4.ws.team.readingEssayDetail') });
    } else if (e.status === 'APPROVED') {
      items.push({ key: e.id, lane: 'team', state: 'done', priority: 80, href: `/essays/${e.id}`, title: t('v4.ws.team.approvedEssay', { essay }) });
    }
  });
  if (verified.length) {
    items.push({ key: 'verified', lane: 'team', state: 'done', priority: 90, title: t('v4.ws.team.verified', { count: verified.length }), detail: verified.join(' · ') });
  }

  // Stage items.
  if (prep) {
    // V5: once READY, the submission hand-off (hero) says who submits and how — the lane doesn't repeat a "sends it" promise.
    if (a.status !== 'READY') items.push({ key: 'final', lane: 'team', state: 'waiting', priority: 60, title: t('v4.ws.team.final', { university: uni }),
      detail: t('v4.ws.team.finalDetail') });
    items.push({ key: 'uwait', lane: 'university', state: 'waiting', priority: 70, title: t('v4.ws.uni.waiting'), detail: t('v4.ws.uni.waitingDetail') });
  }
  if (REVIEW.has(a.status)) {
    items.push({ key: 'rev', lane: 'university', state: 'active', priority: 60,
      title: a.submitted_at ? t('ws3.uni.reviewingSince', { date: ctx.formatDate(a.submitted_at) }) : t('ws3.uni.reviewing'), detail: t('v4.ws.uni.reviewDetail') });
    items.push({ key: 'monitor', lane: 'team', state: 'active', priority: 60, title: t('ws3.team.monitoring') });
  }
  if (a.status === 'INTERVIEW') items.push({ key: 'int', lane: 'university', state: 'active', priority: 55, title: a.interview_at ? t('ws3.uni.interviewAt', { when: ctx.formatDate(a.interview_at) }) : t('ws3.uni.interview') });
  if (['OFFERED', 'WAITLISTED', 'REJECTED'].includes(a.status)) items.push({ key: 'dec', lane: 'university', state: 'done', priority: 80, title: t(`ws3.uni.decision.${a.status}`) });
  if (a.status === 'OFFERED') items.push({ key: 'offer', lane: 'you', state: 'todo', priority: 0, title: t('ws3.you.offer'), due: a.tuition_due });
  if (a.status === 'OFFER_ACCEPTED' || a.status === 'TUITION_PENDING') {
    items.push({ key: 'tuition', lane: 'you', state: 'todo', priority: 0, title: t('v4.ws.you.tuition', { university: uni }), due: a.tuition_due });
    items.push({ key: 'tu', lane: 'university', state: 'waiting', priority: 70, title: t('ws3.uni.tuitionWaiting') });
  }
  if (a.status === 'TUITION_PAID' || a.status === 'ADMISSION_CERTIFICATE_PENDING') items.push({ key: 'cert', lane: 'university', state: 'active', priority: 60, title: t('ws3.uni.preparingLetter') });
  if (a.status === 'ADMISSION_CERTIFICATE_ISSUED' || a.status.startsWith('VISA_') || a.status === 'ENROLLED') {
    items.push({ key: 'letter', lane: 'university', state: 'done', priority: 80, title: t('ws3.uni.letterIssued') });
    if (a.status !== 'ENROLLED') items.push({ key: 'visa', lane: 'you', state: a.status === 'VISA_ISSUED' ? 'done' : 'todo', priority: 1, title: t('ws3.you.visa'), href: '/visa', action: t('v4.ws.action.visa') });
  }
  const rank: Record<ItemState, number> = { late: 0, todo: 0, active: 1, waiting: 2, done: 3 };
  return items.sort((x, y) => rank[x.state] - rank[y.state] || x.priority - y.priority);
}

/** The single next thing the student should do (or null when nothing needs them). */
export function heroItem(items: WsItem[]): WsItem | null {
  return items.find((i) => i.lane === 'you' && i.state === 'todo') ?? null;
}
