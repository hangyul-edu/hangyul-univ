import { i18next } from '@hangyul/i18n';
import type { ApplicationStrategy, PortfolioGroup, StrategyItem } from '@hangyul/types';
import { formatDate, formatMoney } from '@hangyul/utils';

import type { TFn } from './i18n';

/**
 * V5 admission strategy — pure presentation rules (server: services/strategy.py).
 * No score, no percentage, no probability: only named items with an owner and an action.
 */

/** Items the application workspace lanes already show (documents, essays, requests, final check, hand-off). */
export const LANE_CODES = new Set([
  'DOC_FIX', 'DOC_MISSING', 'DOC_UPLOAD_APPROVED', 'DOC_LEGALIZE', 'DOC_RENEW', 'DOC_TOO_OLD', 'DOC_IN_REVIEW', 'DOC_REVIEW_LATE',
  'ESSAY_WRITE', 'ESSAY_REVISE', 'ESSAY_REVIEW', 'REQUEST_OPEN', 'FINAL_CHECK', 'SUBMISSION_CONFIRM',
]);

const MONEY = new Set(['low', 'high', 'budget']);
const DATES = new Set(['deadline', 'date', 'when', 'due']);

/** Params ready for interpolation in the reader's locale (money, dates, document names). */
export function itemParams(t: TFn, locale: string, p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p ?? {})) {
    if (MONEY.has(k) && typeof v === 'number') out[k] = formatMoney(v, 'KRW', locale);
    else if (DATES.has(k) && typeof v === 'string') out[k] = formatDate(v, locale, { month: 'short', day: 'numeric' });
    else out[k] = v;
  }
  if (typeof p?.category === 'string') {
    const name = t(`common:docCategory.${p.category}`, { defaultValue: String(p.label ?? p.category) });
    out.label = name;
    out.labelLower = lower(name);
  } else if (typeof p?.label === 'string') {
    out.labelLower = lower(p.label);
  }
  if (typeof p?.essay_type === 'string') {
    const name = t(`common:essayType.${p.essay_type}`, { defaultValue: String(p.label ?? '') });
    out.label = name;
    out.labelLower = lower(name);
  }
  return out;
}

function lower(s: string): string {
  // V28: German capitalises every noun ("Reisepass"); lowering it is a spelling error, not a style.
  if ((i18next.language ?? '').startsWith('de')) return s;
  const first = s.split(' ', 1)[0];
  if (first.length < 2 || /[A-Z0-9]/.test(first.slice(1))) return s;
  return s[0].toLowerCase() + s.slice(1);
}

/** Translated title / why, falling back to the API's English text. */
export function itemCode(it: Pick<StrategyItem, 'code' | 'params'>): string {
  return it.code === 'DOC_LEGALIZE' && it.params?.path === 'APOSTILLE' ? 'DOC_LEGALIZE_APOSTILLE' : it.code;
}

export function itemTitle(t: TFn, locale: string, it: Pick<StrategyItem, 'code' | 'title' | 'params'>, audience: 'student' | 'agency' = 'student'): string {
  const p = itemParams(t, locale, it.params);
  const code = itemCode(it);
  const key = audience === 'agency' ? `success:agencyItem.${code}` : `success:item.${code}.title`;
  const s = t(key, { ...p, defaultValue: '' });
  if (s && !s.includes('{{')) return s;
  const fallback = t(`success:item.${code}.title`, { ...p, defaultValue: '' });
  return fallback && !fallback.includes('{{') ? fallback : it.title;
}

/** Codes whose `why` is someone's own words (a university note or request, a reviewer's correction): shown as written. */
export const QUOTED_WHY = new Set(['UNIVERSITY_NOTE', 'DOC_FIX', 'REQUEST_OPEN']);

export function itemWhy(t: TFn, locale: string, it: Pick<StrategyItem, 'code' | 'why' | 'params'>): string | null {
  // University notes and correction reasons are quoted exactly as written.
  const p = (it.params ?? {}) as Record<string, unknown>;
  if (it.code === 'DOC_TOO_OLD') {
    return p.days && typeof p.issued === 'string'
      ? t('dossier:reason.TOO_OLD', { university: p.university, days: p.days, issued: formatDate(p.issued, locale), defaultValue: it.why ?? '' })
      : it.why;
  }
  // A reviewer's note is quoted; without one, the generic sentence in the reader's language (the API's is English).
  if (it.code === 'DOC_FIX' && !locale.startsWith('en')) return typeof p.reviewer_note === 'string' && p.reviewer_note ? p.reviewer_note : t('student:checklist.action.FIX');
  if (QUOTED_WHY.has(it.code)) return it.why;
  const s = t(`success:item.${itemCode(it)}.why`, { ...itemParams(t, locale, it.params), defaultValue: '' });
  return s && !s.includes('{{') ? s : it.why;
}

/** "Ready" / "N things to improve" / "Blocked by X" — one line per application. Null = say nothing. */
export type LineKind = 'ready' | 'improve' | 'blocked';
export function strategyLine(s: Pick<ApplicationStrategy, 'scope' | 'state' | 'counts' | 'items'>): { kind: LineKind; count: number; first: StrategyItem | null } | null {
  if (s.scope === 'closed') return null;
  const count = s.counts.blocker + s.counts.improve;
  if (s.scope === 'review' && count === 0) return null;
  if (s.state === 'BLOCKED') return { kind: 'blocked', count, first: s.items.find((i) => i.severity === 'blocker') ?? null };
  if (s.state === 'IMPROVABLE') return { kind: 'improve', count, first: s.items.find((i) => i.severity === 'improve') ?? null };
  return { kind: 'ready', count: 0, first: null };
}

/** The strategy block under the lanes: what the checklist does NOT already say, plus how many items it does. */
export function splitForWorkspace(s: Pick<ApplicationStrategy, 'items'>): { extra: StrategyItem[]; info: StrategyItem[]; inLanes: number } {
  const counted = s.items.filter((i) => i.severity !== 'info');
  return {
    extra: counted.filter((i) => !LANE_CODES.has(i.code)),
    info: s.items.filter((i) => i.severity === 'info' && !LANE_CODES.has(i.code)),
    inLanes: counted.filter((i) => LANE_CODES.has(i.code)).length,
  };
}

export const GROUP_ORDER: PortfolioGroup[] = ['strong', 'possible', 'not_yet'];
export const GROUP_TONE = { strong: 'success', possible: 'info', not_yet: 'warning', sent: 'neutral' } as const;
