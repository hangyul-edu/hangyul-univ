/**
 * V27 shared workflow vocabulary (REPORT §361): one rule for the agency web, the agency app and the student app.
 *
 * `requirementIssue` — the ONE thing to say about a checklist document right now (brief §20). The server decides the
 * treatment (`readiness.treatment`); this only picks which fact leads.
 * `macroStage` — seven readable stages over the existing application statuses (brief §24). No new state; the detailed
 * status still lives underneath, and STATE_MAP.md stays the contract.
 */
import type { ApplicationStatus, ChecklistItem, FitItem } from '@hangyul/types';

export type RequirementIssue =
  | 'UPLOAD' | 'FIX' | 'IN_REVIEW' | 'APOSTILLE' | 'CONSULAR' | 'CHINA_CHSI' | 'LEGALIZATION_REVIEW'
  | 'TRANSLATION' | 'NOTARIZATION' | 'ORIGINAL_CHECKED' | 'DONE';
export type IssueParty = 'student' | 'agency' | 'none';

export function requirementIssue(c: Pick<ChecklistItem, 'status' | 'document_id' | 'treatment' | 'ready'>): { issue: RequirementIssue; party: IssueParty } {
  const tr = c.treatment;
  if (!c.document_id || c.status === 'MISSING' || c.status === 'EXPIRED') return { issue: 'UPLOAD', party: 'student' };
  if (c.status === 'NEEDS_CORRECTION') return { issue: 'FIX', party: 'student' };
  if (tr && !tr.legalization_done) {
    if (tr.legalization === 'APOSTILLE') return { issue: 'APOSTILLE', party: 'student' };
    if (tr.legalization === 'CONSULAR') return { issue: 'CONSULAR', party: 'student' };
    if (tr.legalization === 'CHINA_CHSI') return { issue: 'CHINA_CHSI', party: 'student' };
    if (tr.legalization === 'STAFF_REVIEW') return { issue: 'LEGALIZATION_REVIEW', party: 'agency' };
  }
  if (c.status === 'UPLOADED' || c.status === 'NEEDS_REVIEW' || c.status === 'PROCESSING') return { issue: 'IN_REVIEW', party: 'agency' };
  if (tr?.translation && !c.ready) return { issue: 'TRANSLATION', party: 'student' };
  if (tr?.notarization && !c.ready) return { issue: 'NOTARIZATION', party: 'student' };
  if (c.ready) return { issue: tr && (tr.legalization === 'APOSTILLE' || tr.legalization === 'CONSULAR') ? 'DONE' : 'ORIGINAL_CHECKED', party: 'none' };
  return { issue: 'IN_REVIEW', party: 'agency' };
}

export const MACRO_STAGES = ['CONSULT', 'DOCUMENTS', 'APPLY', 'REVIEW', 'ADMIT', 'VISA', 'ARRIVAL'] as const;
export type MacroStage = (typeof MACRO_STAGES)[number];

const MACRO_OF: Partial<Record<ApplicationStatus, MacroStage>> = {
  DRAFT: 'CONSULT', PROFILE_REVIEW: 'CONSULT',
  DOCUMENT_PREPARATION: 'DOCUMENTS', READY: 'DOCUMENTS',
  SUBMITTED: 'APPLY',
  UNIVERSITY_REVIEW: 'REVIEW', ADDITIONAL_DOCUMENTS: 'REVIEW', INTERVIEW: 'REVIEW', WAITLISTED: 'REVIEW',
  OFFERED: 'ADMIT', OFFER_ACCEPTED: 'ADMIT', TUITION_PENDING: 'ADMIT', TUITION_PAID: 'ADMIT',
  ADMISSION_CERTIFICATE_PENDING: 'ADMIT', ADMISSION_CERTIFICATE_ISSUED: 'ADMIT',
  VISA_PREPARATION: 'VISA', VISA_SUBMITTED: 'VISA', VISA_ISSUED: 'VISA',
  ENROLLED: 'ARRIVAL',
};

export function macroStage(status: ApplicationStatus | string): MacroStage | null {
  return MACRO_OF[status as ApplicationStatus] ?? null;
}

/** The student's case stage: the furthest stage among applications still in play; CONSULT when none is. */
export function caseStage(statuses: (ApplicationStatus | string)[]): { stage: MacroStage; index: number } {
  let best = 0;
  for (const s of statuses) {
    const m = macroStage(s);
    if (m) best = Math.max(best, MACRO_STAGES.indexOf(m));
  }
  return { stage: MACRO_STAGES[best], index: best };
}

/** V27 quick fit: one line saying why a result is in its group — from the API's reason code, never server prose. */
type TFn = (k: string, o?: Record<string, unknown>) => string;

export function fitReasonText(item: Pick<FitItem, 'reason'>, t: TFn): string {
  const p = item.reason.params;
  const test = (code?: string) => (code ? t(`fit.test.${code}`, { defaultValue: code }) : '');
  const track = p.track && p.track !== 'ANY' ? t(`fit.track.${p.track}`) : '';
  switch (item.reason.code) {
    case 'LANGUAGE_MET':
      return p.test ? t('fit.reason.met', { test: test(p.test), need: p.need, context: track ? 'track' : undefined, track }) : t('fit.reason.metPlain');
    case 'LANGUAGE_NEEDED': {
      const opts = (p.options ?? []).slice(0, 2).map((o) => `${test(o.test)} ${o.min}`).join(t('fit.or'));
      return t('fit.reason.needed', { options: opts, context: track ? 'track' : undefined, track });
    }
    case 'NO_LANGUAGE_REQUIRED': {
      const later = (p.later ?? []).slice(0, 2).map((o) => `${test(o.test)} ${o.min}`).join(t('fit.or'));
      return later ? t('fit.reason.noneRequiredLater', { tests: later }) : t('fit.reason.noneRequired');
    }
    case 'LANGUAGE_FAR': {
      const opts = (p.options ?? []).slice(0, 2).map((o) => `${test(o.test)} ${o.min}`).join(t('fit.or'));
      return t('fit.reason.far', { options: opts });
    }
    case 'LANGUAGE_UNCHECKABLE':
      return t('fit.reason.uncheckable');
    case 'LANGUAGE_SEVERAL':
      return t('fit.reason.several', { count: p.groups ?? 2 });
    case 'LANGUAGE_PROGRAMME_LISTED':
      return t('fit.reason.languageListed');
    default:
      return p.ieqas ? t('fit.reason.unverifiedIeqas') : t('fit.reason.unverified');
  }
}

/**
 * V28 (UX_AUDIT MK-4): a scholarship's name for the reader. Korean screens show the institution's own Korean name (or the
 * Korean description stored when none is published); every other locale shows the official English name. Never a
 * translation of a name; a missing field falls back to the next-best published one.
 */
export function scholarshipName(
  s: { name: string; name_en?: string | null; name_display_ko?: string | null; name_official_en?: string | null },
  locale: string,
): string {
  if (locale.startsWith('ko')) return s.name_display_ko || s.name;
  return s.name_official_en || s.name_en || s.name;
}
