import { useLocale } from '@hangyul/i18n';
import { daysUntil, formatDate, formatDateTime, formatMoney, formatNumber, formatPercent, formatRelative } from '@hangyul/utils';
import { useMemo } from 'react';

const hasRelativeTime = typeof Intl !== 'undefined' && typeof (Intl as { RelativeTimeFormat?: unknown }).RelativeTimeFormat === 'function';

/**
 * Deadlines are Korean calendar dates (V4). A date-only value ("2026-10-20") is shown as that calendar day everywhere;
 * a date-time with an offset ("2026-10-20T23:59:00+09:00") is shown as its day in Seoul — never shifted by the phone's time
 * zone (a student in Auckland must not see "Oct 21" for a deadline that closes on Oct 20 in Korea).
 */
export function formatKstDate(iso: string | null | undefined, locale: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  if (!iso) return '—';
  if (iso.length === 10) return formatDate(iso, locale, opts);
  try {
    return formatDate(iso, locale, { ...opts, timeZone: 'Asia/Seoul' });
  } catch {
    return formatDate(iso.slice(0, 10), locale, opts); // engines without time-zone data: the calendar part of the ISO string
  }
}

/** Day number + short month of a KST deadline, for calendar-style rows. */
export function kstDayMonth(iso: string, locale: string): { day: string; month: string } {
  return { day: formatKstDate(iso, locale, { day: 'numeric' }), month: formatKstDate(iso, locale, { month: 'short' }) };
}

/** Locale-bound formatters (Intl) for the active UI language. */
export function useFormat() {
  const { t, locale } = useLocale();
  return useMemo(() => ({
    locale,
    date: (iso: string | null | undefined) => formatDate(iso, locale),
    dateShort: (iso: string | null | undefined) => formatDate(iso, locale, { month: 'short', day: 'numeric' }),
    /** A deadline (KST calendar date) — use for every due/closing date. */
    deadline: (iso: string | null | undefined) => formatKstDate(iso, locale),
    deadlineShort: (iso: string | null | undefined) => formatKstDate(iso, locale, { month: 'short', day: 'numeric' }),
    dateTime: (iso: string | null | undefined) => formatDateTime(iso, locale),
    // Hermes may ship without Intl.RelativeTimeFormat — fall back to an absolute date instead of crashing.
    relative: (iso: string | null | undefined) =>
      hasRelativeTime ? formatRelative(iso, locale) : formatDate(iso, locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    number: (n: number | null | undefined) => formatNumber(n, locale),
    percent: (ratio: number | null | undefined, digits = 0) => formatPercent(ratio, locale, digits),
    money: (n: number | null | undefined, currency = 'KRW', compact = false) => formatMoney(n, currency, locale, { compact }),
    /** "3 days left" / "Today" / "Overdue by 2 days" */
    due: (iso: string | null | undefined) => {
      const d = daysUntil(iso);
      if (d === null) return '—';
      if (d < 0) return t('common:time.overdueBy', { count: -d });
      if (d === 0) return t('common:time.today');
      if (d === 1) return t('common:time.tomorrow');
      return t('common:time.daysLeft', { count: d });
    },
    daysUntil,
  }), [locale, t]);
}

type TFn = (k: string, o?: Record<string, unknown>) => string;

/** Lower-case a label for use mid-sentence but keep acronyms ("TOPIK certificate", never "topik certificate"). */
export function lowerKeepAcronyms(label: string): string {
  return label.split(' ').map((w) => (/[A-Z].*[A-Z]|\d/.test(w) ? w : w.toLowerCase())).join(' ');
}

/**
 * Title of a task/deadline in the reader's language. Same contract as `localizedTitle` from @hangyul/i18n, but document
 * and essay types keep their acronyms ("Review TOPIK certificate" — V4 fix for the agency app).
 */
export function taskTitle(t: TFn, item: { title: string; title_key?: string | null; title_params?: Record<string, unknown> | null }): string {
  if (!item.title_key) return item.title;
  const p: Record<string, unknown> = { ...(item.title_params ?? {}) };
  if (typeof p.category === 'string') p.category = lowerKeepAcronyms(t(`common:docCategory.${p.category}`));
  if (typeof p.essayType === 'string') p.essayType = lowerKeepAcronyms(t(`common:essayType.${p.essayType}`));
  // Keys may name their namespace ("student:v4.visaStep.financial_proof"); a namespace the app doesn't load falls back to the API title.
  const out = t(item.title_key.includes(':') ? item.title_key : `common:${item.title_key}`, { ...p, defaultValue: '' });
  return out && !out.includes('{{') ? out : item.title;
}
