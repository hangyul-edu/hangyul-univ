import { docLabel, essayLabel } from '@hangyul/i18n';
import type { Tone } from '@hangyul/mobile-ui';
import { lowerKeepAcronyms, taskTitle } from '@hangyul/mobile-ui';
import type { ApplicationStatus, Dashboard, MatchTier } from '@hangyul/types';

type TFunction = (key: string, opts?: Record<string, unknown>) => string;

/**
 * The student-facing journey has six stages; the API tracks nine finer ones plus application statuses.
 * Discover · Prepare · Apply · Admission · Visa · Arrival.
 */
export const JOURNEY = ['discover', 'prepare', 'apply', 'admission', 'visa', 'arrival'] as const;
export type JourneyKey = (typeof JOURNEY)[number];

const SUBMITTED: ApplicationStatus[] = ['SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW', 'OFFERED', 'WAITLISTED'];

export function journeyStage(d: Dashboard): JourneyKey {
  switch (d.journey.stage) {
    case 'EXPLORE': case 'PROFILE': case 'MATCH': return 'discover';
    case 'APPLY': return d.applications.some((a) => SUBMITTED.includes(a.status)) ? 'apply' : 'prepare';
    case 'DECISION': return 'apply';
    case 'ENROLL': return 'admission';
    case 'VISA': return 'visa';
    default: return 'arrival';
  }
}

/** Plain match language (REPORT §18). Never a probability. */
export function matchMeta(tier: MatchTier): { key: string; tone: Tone } {
  switch (tier) {
    case 'STRONG': return { key: 'v3.match.strong', tone: 'success' };
    case 'COMPETITIVE': return { key: 'v3.match.possible', tone: 'info' };
    case 'REACH': return { key: 'v3.match.close', tone: 'warning' };
    default: return { key: 'v3.match.notYet', tone: 'neutral' };
  }
}

/** Human title for the dashboard's next best action. */
export function nextActionTitle(t: TFunction, d: Dashboard, locale = 'en'): string {
  const na = d.next_action;
  // V4: one named item of one application ("Fix your academic transcript for Pusan National University · Media …").
  // The API title is the English wording the web shows; other languages use mobile.json v4.home.item.<item>.
  if (na.code === 'APPLICATION_ITEM') {
    if (locale.startsWith('en')) return na.title;
    // V31 (REPORT §424): the label goes through the same docLabel/essayLabel rule as the web — the API label is the
    // guide's English wording; other languages name the document by its category (found on the emulator in ko).
    const item = { label: String(na.params.label ?? ''), category: na.params.category as string | null, essay_type: na.params.essay_type as string | null };
    const label = item.essay_type ? essayLabel(t, item, locale) : docLabel(t, item, locale);
    return t(`v4.home.item.${String(na.params.item ?? '')}.title`, { ...na.params, label: lowerKeepAcronyms(label), defaultValue: na.title });
  }
  // V5: after the visa the arrival track leads (step key in `title`); a READY application leads with its guided submission.
  if (na.code === 'CONCIERGE') return t(`concierge:step.${na.title}.title`, { defaultValue: na.title });
  if (na.code === 'VISA_STEP') {
    const doc = na.title === 'document' && na.params.doc ? t(`visaroute:doc.${String(na.params.doc)}.name`, { defaultValue: '' }) : '';
    return doc || t(String(na.params.title_key), { ...na.params, defaultValue: '' });
  }
  if (na.code === 'SUBMISSION_HANDOFF' || na.code === 'SUBMISSION_CONFIRM') return t(`success:item.${na.code}.title`, { ...na.params, defaultValue: na.title });
  if (na.code === 'PROFILE_UNLOCK') {
    return t(`student.nextAction.PROFILE_UNLOCK.${String(na.params.section ?? 'other')}`, { ...na.params, defaultValue: na.title });
  }
  if (['COMPLETE_PROFILE', 'REVIEW_MATCHES', 'ARRIVAL_CHECKLIST', 'WAIT', 'FINISH_APPLICATION', 'RESPOND_OFFER', 'COMPARE_OFFERS'].includes(na.code)) {
    return t(`student.nextAction.${na.code}`, { ...na.params, defaultValue: na.title });
  }
  return taskTitle(t, { title: na.title, title_key: na.params.title_key as string | undefined, title_params: na.params.title_params as Record<string, unknown> | undefined });
}

/** Student-facing sentence for an application status (no enum language). */
export const statusSentenceKey = (s: ApplicationStatus) => `v3.appStatus.${s}`;

/** V5 body and button wording for the next-action codes that live in other namespaces (null = use the V3/V4 keys). */
export function v5NextCopy(t: TFunction, na: Dashboard['next_action']): { body: string; cta: string } | null {
  if (na.code === 'CONCIERGE') {
    return { body: t(`concierge:step.${na.title}.text`, { defaultValue: '' }), cta: t(`concierge:step.${na.title}.cta`, { defaultValue: t('v3.home.nextCtaDefault') }) };
  }
  if (na.code === 'VISA_STEP') {
    const why = na.title === 'document' && na.params.doc ? t(`visaroute:doc.${String(na.params.doc)}.why`, { defaultValue: '' }) : '';
    return { body: why, cta: t('v3.home.nextCtaDefault') };
  }
  if (na.code === 'SUBMISSION_HANDOFF' || na.code === 'SUBMISSION_CONFIRM') {
    return { body: t(`success:item.${na.code}.why`, { ...na.params, defaultValue: '' }), cta: t(`success:item.${na.code}.cta`, { defaultValue: t('v3.home.nextCtaDefault') }) };
  }
  return null;
}
