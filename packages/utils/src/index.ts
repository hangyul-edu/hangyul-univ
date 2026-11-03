import { REGION_NAMES } from './intl-fallback/regions';
import type { ApplicationStatus, DocumentStatus, EssayStatus, MatchTier, PipelineStage, TaskPriority, VisaStatus } from '@hangyul/types';

import { INTL_FALLBACK, type IntlFallback } from './intl-fallback';
export { loadIntlFallback, INTL_FALLBACK_LOCALES } from './intl-fallback';

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'brand' | 'teal';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * The bare currency symbol a locale-independent reading of this currency uses — `$`, `€`, `₩`, `¥`.
 *
 * Needed because `currencyDisplay: 'narrowSymbol'` is a *request*: when CLDR has no narrow symbol for a
 * currency in a locale it silently falls back to the wide one, which for USD in Arabic is still `US$`.
 * Asking `en` for the narrow symbol gives the canonical glyph, and that is what gets substituted back.
 */
const symbolCache = new Map<string, string>();
function bareSymbol(currency: string): string {
  const hit = symbolCache.get(currency);
  if (hit !== undefined) return hit;
  let symbol = currency;
  try {
    const part = new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0).find((x) => x.type === 'currency');
    if (part) symbol = part.value;
  } catch { /* an unknown currency keeps its code, which is the honest fallback */ }
  symbolCache.set(currency, symbol);
  return symbol;
}

/**
 * Locale-aware formatting. Pass the active i18n language; falls back gracefully.
 *
 * `gap` inserts a thin space between the currency symbol and the number (V15). It exists for one specific,
 * verified reason: **₩ has two horizontal crossbars**, and set tight against a digit at display size they
 * run into the numerals and the price reads as struck through — which is precisely the sales-page device
 * the pricing section is forbidden to use. Intl emits "₩249,000" with nothing between them, so the space
 * has to be put back. Use it wherever a price is set large; at body size the glyphs do not collide.
 *
 * `symbolOnly` is **presentation for a headline price** (V20, brief §2). `Intl`'s default
 * `currencyDisplay: 'symbol'` is not the symbol: CLDR's "symbol" for USD outside the United States is
 * `US$` in Korean, Chinese, Thai and Indonesian, `US$` after the number in Vietnamese, and the bare code
 * `USD` in Malay. Korean is this product's default locale, so the default reading of the pricing card was
 * `US$179`. A headline price set beside a plan name does not need to be told which dollar it is — the
 * dollar sign is the price — so this asks for the narrow symbol and, where the locale still answers with
 * letters, substitutes the canonical glyph. Use it **only** where the number is the headline. A receipt,
 * a payment-history row, a checkout total and any table that can hold two currencies at once keep the
 * default, because there the code is the information.
 *
 * Nothing here touches what is *stored* or *charged*: the plan, the order, the API contract and the
 * payment provider all remain explicitly USD (REPORT §152, §161, §214.3).
 */
export function formatMoney(amount: number | null | undefined, currency = 'KRW', locale = 'en', opts: { compact?: boolean; minor?: boolean; gap?: boolean; symbolOnly?: boolean } = {}): string {
  if (amount === null || amount === undefined) return '—';
  const zeroDecimal = ['KRW', 'JPY', 'VND'].includes(currency);
  const value = opts.minor && !zeroDecimal ? amount / 100 : amount;
  // V17: a whole amount shows no cents. Hangyul's plans are $179 / $349 / $599 and "$179.00" on a pricing
  // card reads as a system printing a database column rather than as a price somebody chose. A non-whole
  // amount still gets both decimals, because dropping them there would misstate it.
  const whole = Number.isInteger(value);
  try {
    const fmt = new Intl.NumberFormat(locale, {
      style: 'currency', currency, notation: opts.compact ? 'compact' : 'standard',
      currencyDisplay: opts.symbolOnly ? 'narrowSymbol' : 'symbol',
      minimumFractionDigits: opts.compact ? undefined : zeroDecimal || whole ? 0 : 2,
      maximumFractionDigits: opts.compact ? 1 : zeroDecimal || whole ? 0 : 2,
    });
    if (opts.symbolOnly) {
      const parts = fmt.formatToParts(value);
      // Only rewrite a currency part that still carries letters: `US$`, `USD`, `$US`. A locale whose
      // narrow symbol is already a glyph is left exactly as CLDR set it, placement and spacing included.
      const needs = parts.some((x) => x.type === 'currency' && /\p{L}/u.test(x.value));
      const symbol = needs ? bareSymbol(currency) : '';
      const text = (needs ? parts.map((x) => (x.type === 'currency' ? { ...x, value: symbol } : x)) : parts)
        .map((x) => x.value).join('');
      // Arabic's pattern leaves a space where `US$` used to be two glyphs wide; collapse it so the price
      // is one typographic unit, which is the whole point of the mode.
      return needs ? text.replace(/(\p{Sc})\u00A0?\s(?=\p{N})/gu, '$1').replace(/(\p{N})\s(?=\p{Sc})/gu, '$1\u00A0') : text;
    }
    // The gap exists for ₩'s two crossbars (see the note above). `$`, `€` and `£` do not collide with
    // digits, so applying it to them would insert a space nobody asked for into "$349".
    if (!opts.gap || !fmt.formatToParts(value).some((x) => x.type === 'currency' && /[₩¥]/.test(x.value))) return fmt.format(value);
    // Built from parts rather than by string surgery, so a locale that puts the symbol *after* the number
    // (or uses a different symbol entirely) gets the space on the correct side without a special case.
    return fmt.formatToParts(value)
      .map((part, i, all) => {
        const next = all[i + 1];
        const joinsNumber = part.type === 'currency' && next && next.type !== 'literal';
        const followsNumber = part.type === 'currency' && i > 0 && all[i - 1].type !== 'literal';
        return joinsNumber ? `${part.value}\u2009` : followsNumber ? `\u2009${part.value}` : part.value;
      })
      .join('');
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export function formatNumber(n: number | null | undefined, locale = 'en', opts?: Intl.NumberFormatOptions): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat(locale, opts).format(n);
}

/**
 * A customer-facing figure, rounded **down** to a scale a reader can hold in their head (V13, brief Part 24).
 *
 * Marketing is communication; operations is accounting. A visitor reading "218곳" is being shown the precision
 * of our database, which is not a claim they can use and not a claim they asked for — while "200+" says the one
 * thing the sentence is for: Korea has a lot of universities. Search results, application records, status and
 * analytics keep the exact number, because there exactness is the point.
 *
 * Always rounds down, never up, so the "+" is always true: 218 → 200, 1,480 → 1,000, 94 → 90, 7 → 7.
 * Returns `null` below the smallest honest scale, so a caller can hold the sentence back rather than print a
 * rounded figure that is really an exact one.
 */
/**
 * Which part of the day it is, for a greeting (V13).
 *
 * Both consoles computed this themselves with different thresholds, so at 00:22 the student app said
 * "Good evening, Lan" while the agency console said "Good morning, Linh" — the same minute, two products,
 * two answers. The boundaries are a judgement rather than a fact, which is exactly why they belong in one
 * place: somebody still awake at one in the morning is at the end of their evening, not the start of their
 * morning, and whichever way that is decided it should be decided once.
 *
 * Local time on purpose: this is about the reader's own day, not the server's.
 */
export function dayPart(d: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = d.getHours();
  // 00:00–04:59 is still the previous evening to the person reading it.
  if (h < 5) return 'evening';
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

export function marketingScale(n: number | null | undefined): number | null {
  if (n === null || n === undefined || !Number.isFinite(n) || n < 10) return null;
  const magnitude = 10 ** Math.floor(Math.log10(n));
  // One significant figure at or above 100 (218 → 200); to the nearest ten below it (94 → 90).
  const step = magnitude >= 100 ? magnitude : 10;
  return Math.floor(n / step) * step;
}

export function formatPercent(ratio: number | null | undefined, locale = 'en', digits = 0): string {
  if (ratio === null || ratio === undefined) return '—';
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(ratio);
}

export function formatDate(iso: string | null | undefined, locale = 'en', opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const fb = intlFallback(locale, 'DateTimeFormat');
  if (fb) return fallbackDate(d, fb, opts);
  return new Intl.DateTimeFormat(locale, opts).format(d);
}

/**
 * Chromium ships reduced ICU data: Burmese (and a few other languages) silently fall back to English month, weekday,
 * relative-time and country names. When the runtime cannot format the locale and we have CLDR data for it, use that.
 */
const fallbackCache = new Map<string, boolean>();
/** Fallback data only when the runtime's Intl really lacks the locale. Chromium ships reduced ICU and may *claim*
 *  support while returning English ("Vietnam", "October") or placeholders ("M10"), so the output is probed once. */
function intlFallback(locale: string, kind: 'DateTimeFormat' | 'RelativeTimeFormat' | 'DisplayNames'): IntlFallback | null {
  const fb = INTL_FALLBACK[locale.split('-')[0]];
  if (!fb) return null;
  const key = `${locale}|${kind}`;
  const cached = fallbackCache.get(key);
  if (cached !== undefined) return cached ? fb : null;
  let use: boolean;
  try {
    const supported = (Intl[kind] as unknown as { supportedLocalesOf: (l: string[]) => string[] }).supportedLocalesOf([locale]).length > 0;
    if (!supported) use = true;
    else if (kind === 'DisplayNames') use = new Intl.DisplayNames([locale], { type: 'region' }).of('VN') === 'Vietnam' && fb.regions.VN !== 'Vietnam';
    else if (kind === 'DateTimeFormat') { const m = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 15))); use = (m === 'October' || /^M\d/.test(m)) && fb.monthsLong[9] !== m; }
    else use = new Intl.RelativeTimeFormat(locale).format(-5, 'day') === '5 days ago';
  } catch {
    use = true;
  }
  fallbackCache.set(key, use);
  return use ? fb : null;
}

function fallbackDate(d: Date, fb: IntlFallback, opts: Intl.DateTimeFormatOptions): string {
  const o: Intl.DateTimeFormatOptions = { ...opts };
  if (o.dateStyle) { Object.assign(o, { year: 'numeric', month: o.dateStyle === 'short' ? 'numeric' : o.dateStyle === 'medium' ? 'short' : 'long', day: 'numeric' }, o.dateStyle === 'full' ? { weekday: 'long' } : {}); delete o.dateStyle; }
  if (o.timeStyle) { Object.assign(o, { hour: '2-digit', minute: '2-digit' }); delete o.timeStyle; }
  // en-GB: day-month-year order and a 24-hour clock, so no English AM/PM is left over.
  const parts = new Intl.DateTimeFormat('en-GB', { ...o, hour12: false }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const month = o.month === 'short' ? fb.monthsShort[d.getMonth()] : o.month === 'long' || o.month === 'narrow' ? fb.monthsLong[d.getMonth()] : get('month');
  const weekday = o.weekday ? (o.weekday === 'long' ? fb.weekdaysLong : fb.weekdaysShort)[d.getDay()] : undefined;
  const time = o.hour !== undefined ? [get('hour'), get('minute')].filter(Boolean).join(':') : '';
  if (o.month && !['numeric', '2-digit'].includes(o.month)) {
    const date = (fb.ymd ? [get('year'), month, get('day')] : [get('day'), month, get('year')]).filter(Boolean).join(' ');
    return [weekday, date, time].filter(Boolean).join(' ');
  }
  return parts.map((p) => (p.type === 'weekday' ? weekday : p.type === 'dayPeriod' ? '' : p.value)).join('').trim();
}

export function formatDateTime(iso: string | null | undefined, locale = 'en'): string {
  return formatDate(iso, locale, { dateStyle: 'medium', timeStyle: 'short' });
}

export function daysUntil(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const d = iso.length === 10 ? new Date(`${iso}T23:59:59`) : new Date(iso);
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

export function formatRelative(iso: string | null | undefined, locale = 'en', now = new Date()): string {
  if (!iso) return '—';
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000;
  const fb = intlFallback(locale, 'RelativeTimeFormat');
  const rtf = fb
    ? { format: (n: number, u: string) => n === 0 && fb.rel.now ? fb.rel.now : fb.rel.day?.[String(n)] && u === 'day' ? fb.rel.day[String(n)] : (fb.rel.tpl?.[`${n < 0 ? 'past' : 'future'}.${u}`] ?? (n < 0 ? fb.rel.past : fb.rel.future).replace('{u}', fb.rel.units[u] ?? u)).replace('{n}', String(Math.abs(n))) }
    : new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}

export function countryName(code: string | null | undefined, locale = 'en'): string {
  if (!code) return '—';
  const c = code.toUpperCase();
  const fb = intlFallback(locale, 'DisplayNames');
  if (fb?.regions[c]) return fb.regions[c];
  try {
    const n = new Intl.DisplayNames([locale], { type: 'region' }).of(c);
    if (n && n !== c) return n;
  } catch {
    /* engine without Intl.DisplayNames (Hermes) — fall through to the static tables */
  }
  // V22: never show an ISO code — Korean for Korean readers, otherwise the English name (Hermes has no DisplayNames).
  return REGION_NAMES[locale.split('-')[0]]?.[c] ?? REGION_NAMES.en[c] ?? code;
}

export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function humanize(v: string | null | undefined): string {
  if (!v) return '';
  return v.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

// ---- status → tone maps (shared so every app colors states identically) ----
export const applicationTone: Record<ApplicationStatus, Tone> = {
  DRAFT: 'neutral', PROFILE_REVIEW: 'neutral', DOCUMENT_PREPARATION: 'warning', READY: 'teal', SUBMITTED: 'info', UNIVERSITY_REVIEW: 'info',
  ADDITIONAL_DOCUMENTS: 'warning', INTERVIEW: 'info', OFFERED: 'success', WAITLISTED: 'warning', REJECTED: 'danger', OFFER_ACCEPTED: 'success',
  TUITION_PENDING: 'warning', TUITION_PAID: 'success', ADMISSION_CERTIFICATE_PENDING: 'info', ADMISSION_CERTIFICATE_ISSUED: 'success',
  VISA_PREPARATION: 'brand', VISA_SUBMITTED: 'info', VISA_ISSUED: 'success', ENROLLED: 'success', WITHDRAWN: 'neutral',
};
export const documentTone: Record<DocumentStatus, Tone> = {
  MISSING: 'neutral', UPLOADED: 'info', PROCESSING: 'info', NEEDS_REVIEW: 'info', NEEDS_CORRECTION: 'danger', VERIFIED: 'success', EXPIRED: 'warning',
};
export const essayTone: Record<EssayStatus, Tone> = {
  DRAFT: 'neutral', SUBMITTED: 'info', AI_PRECHECK: 'info', AGENCY_REVIEW: 'info', CHANGES_REQUESTED: 'warning', STUDENT_REVISION: 'warning',
  FINAL_REVIEW: 'teal', APPROVED: 'success',
};
export const visaTone: Record<VisaStatus, Tone> = {
  NOT_STARTED: 'neutral', ELIGIBILITY_CHECK: 'neutral', WAITING_FOR_ADMISSION: 'neutral', DOCUMENT_PREPARATION: 'warning', READY_TO_APPLY: 'teal',
  SUBMITTED: 'info', ADDITIONAL_DOCUMENTS: 'warning', APPROVED: 'success', ISSUED: 'success', REJECTED: 'danger',
};
export const tierTone: Record<MatchTier, Tone> = { STRONG: 'success', COMPETITIVE: 'info', REACH: 'warning', NOT_ELIGIBLE: 'neutral' };
export const priorityTone: Record<TaskPriority, Tone> = { URGENT: 'danger', HIGH: 'warning', MEDIUM: 'info', LOW: 'neutral' };
export const pipelineTone = (s: PipelineStage): Tone =>
  s === 'REJECTED' || s === 'WITHDRAWN' ? 'danger' : ['OFFERED', 'VISA_ISSUED', 'ENROLLED', 'ARRIVED', 'ACTIVE_STUDENT', 'GRADUATED'].includes(s) ? 'success'
    : ['NEW_LEAD', 'PROFILE_INCOMPLETE', 'QUALIFIED'].includes(s) ? 'neutral' : 'info';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

/**
 * V9 "waiting on" (docs/STATE_MAP.md, server/app/services/waiting.py): who must act for a case or an application to move.
 *   counselor  a named agency person owns the next action
 *   agency     the agency team owns it, nobody assigned
 *   hangyul    Hangyul operations owns it (no agency, payment issue)
 *   student · university · external (embassy, official rail, provider) · none
 * Legacy values stay accepted: `us` (agency console V4–V8 = counselor or agency team). `agency` keeps its old meaning
 * "the team working the case" when no assignment detail is known (status-only call), so old readers are unchanged.
 */
export type WaitingParty = 'counselor' | 'agency' | 'hangyul' | 'student' | 'university' | 'external' | 'none';
export type WaitingOn = WaitingParty;
export const WAITING_PARTIES: readonly WaitingParty[] = ['counselor', 'agency', 'hangyul', 'student', 'university', 'external', 'none'];
/** Legacy filter values → the parties they mean today. */
export const WAITING_ALIASES: Record<string, readonly WaitingParty[]> = { us: ['counselor', 'agency'] };
/** Staff-side parties (the team owns the next action). */
export const STAFF_PARTIES: readonly WaitingParty[] = ['counselor', 'agency', 'hangyul'];

/** Map any value (new, legacy `us`, null) onto the seven parties; unknown → null. */
export function normalizeWaiting(v: string | null | undefined): WaitingParty | null {
  if (!v) return null;
  if (v === 'us') return 'agency';
  return (WAITING_PARTIES as readonly string[]).includes(v) ? (v as WaitingParty) : null;
}

/** Does `party` match a filter value (a party or a legacy alias)? */
export function waitingMatches(filter: string, party: WaitingParty | null | undefined): boolean {
  if (!party) return filter === 'none';
  return (WAITING_ALIASES[filter] ?? [filter]).includes(party);
}

export interface WaitingContext {
  /** The case has an agency (active assignment). false → staff work belongs to Hangyul. */
  hasAgency?: boolean;
  /** A named counselor owns the case. */
  counselorAssigned?: boolean;
  /** Submission record: handed off to the student (guided method). */
  handedOff?: boolean;
  /** Submission record: reported submitted without a reference or receipt. */
  unconfirmed?: boolean;
}

/** Who has to act for an application to move. Without `ctx` it is status-only (staff side = 'agency', as before V9). */
export function applicationWaitingOn(status: ApplicationStatus, ctx?: WaitingContext): WaitingParty {
  const staff: WaitingParty = !ctx ? 'agency' : ctx.hasAgency === false ? 'hangyul' : ctx.counselorAssigned ? 'counselor' : 'agency';
  switch (status) {
    case 'READY':
      if (ctx?.unconfirmed) return 'external';
      if (ctx?.handedOff) return 'student';
      return staff;
    case 'PROFILE_REVIEW': return staff;
    case 'DRAFT': case 'DOCUMENT_PREPARATION': case 'ADDITIONAL_DOCUMENTS': case 'OFFERED': case 'TUITION_PENDING':
    case 'ADMISSION_CERTIFICATE_ISSUED': case 'VISA_PREPARATION': case 'VISA_ISSUED': return 'student';
    case 'SUBMITTED': case 'UNIVERSITY_REVIEW': return ctx?.unconfirmed ? 'external' : 'university';
    case 'INTERVIEW': case 'WAITLISTED': case 'OFFER_ACCEPTED': case 'TUITION_PAID':
    case 'ADMISSION_CERTIFICATE_PENDING': return 'university';
    case 'VISA_SUBMITTED': return 'external';
    default: return 'none';
  }
}
export * from './eligibility';

/**
 * The right Korean particle for a word (V17).
 *
 * Korean postpositions come in pairs and which one is correct depends on whether the preceding syllable
 * ends in a consonant (받침): 지원 관리**는** but 서류 검토**는**, 비자**가** but 기숙사**가**. Interpolating a
 * noun into a sentence and writing `은(는)` is the thing that makes a Korean interface read as machine
 * output — it is the Korean equivalent of "1 item(s)".
 *
 * Hangul syllables are contiguous from U+AC00, eleven medials and twenty-eight finals each, so the final
 * consonant is `(code − 0xAC00) % 28` and a zero means there is none. Rhetorically the only hard case is
 * 으로 / 로, where ㄹ (final 8) behaves like no final at all — "서울로", not "서울으로".
 *
 * A word ending in anything that is not Hangul — a Latin acronym, a digit — gets the form used after a
 * consonant, which is what Korean style guides prescribe for the common cases and is never jarring.
 */
export function koParticle(word: string, pair: '은는' | '이가' | '을를' | '와과' | '으로로'): string {
  const last = (word ?? '').trim().slice(-1);
  const code = last.charCodeAt(0);
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  const final = isHangul ? (code - 0xac00) % 28 : -1;
  const hasFinal = isHangul ? final !== 0 : true;
  switch (pair) {
    case '은는': return hasFinal ? '은' : '는';
    case '이가': return hasFinal ? '이' : '가';
    case '을를': return hasFinal ? '을' : '를';
    case '와과': return hasFinal ? '과' : '와';
    // ㄹ (final index 8) takes 로, like a word with no final at all.
    case '으로로': return hasFinal && final !== 8 ? '으로' : '로';
  }
}

/**
 * V20 — the canonical public university content model, media registry and visual resolver (brief §54).
 * One shape and one set of rules for every surface that draws a Korean university.
 */
export * from './university';

/** V22 — country calling codes for the international-first phone input. */
export * from './phone';
export * from './workflow27';
