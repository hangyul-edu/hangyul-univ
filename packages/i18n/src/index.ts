import { koreanParticles } from './particles';
import i18next, { type i18n as I18n } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import meta from '../locales/_meta.json';
import studentStatus from '../locales/_student_status.json';
import { loaders } from './resources';

/**
 * Locale architecture
 * - Structured JSON per locale and namespace: locales/<locale>/<namespace>.json
 * - English is the source; missing keys fall back to English (never to a raw key in production UI).
 * - `status` is the translation QA state (V8 taxonomy, docs/I18N.md):
 *     SOURCE_APPROVED    — the source language (English), written and approved by the product team;
 *     HUMAN_REVIEWED     — a named human reviewer checked it; only real human evidence (docs/qa/v8/l10n/) permits this;
 *     SYNTHETIC_REVIEWED — machine-drafted, then reviewed by AI personas against a written rubric (record in docs/qa/v8/l10n/);
 *                          useful, but NOT a human review and never presented as one;
 *     MACHINE_DRAFT      — machine-drafted, unreviewed.
 * - The 32 locales of the existing Hangyul web product are all included, plus Nepali, Burmese and others needed
 *   for the 55 priority recruitment markets.
 */
export interface LocaleDef { code: string; name: string; english: string; dir: 'ltr' | 'rtl'; status: LocaleStatus; }
export type LocaleStatus = 'SOURCE_APPROVED' | 'HUMAN_REVIEWED' | 'SYNTHETIC_REVIEWED' | 'MACHINE_DRAFT';

export const LOCALES: LocaleDef[] = [
  { code: 'en', name: 'English', english: 'English', dir: 'ltr', status: 'SOURCE_APPROVED' },
  { code: 'ko', name: '한국어', english: 'Korean', dir: 'ltr', status: 'SYNTHETIC_REVIEWED' },
  { code: 'vi', name: 'Tiếng Việt', english: 'Vietnamese', dir: 'ltr', status: 'SYNTHETIC_REVIEWED' },
  { code: 'zh-Hans', name: '简体中文', english: 'Chinese (Simplified)', dir: 'ltr', status: 'SYNTHETIC_REVIEWED' },
  { code: 'zh-Hant', name: '繁體中文', english: 'Chinese (Traditional)', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'uz', name: 'Oʻzbekcha', english: 'Uzbek', dir: 'ltr', status: 'SYNTHETIC_REVIEWED' },
  { code: 'mn', name: 'Монгол', english: 'Mongolian', dir: 'ltr', status: 'SYNTHETIC_REVIEWED' },
  { code: 'ne', name: 'नेपाली', english: 'Nepali', dir: 'ltr', status: 'SYNTHETIC_REVIEWED' },
  { code: 'my', name: 'မြန်မာ', english: 'Burmese', dir: 'ltr', status: 'SYNTHETIC_REVIEWED' },
  { code: 'ja', name: '日本語', english: 'Japanese', dir: 'ltr', status: 'SYNTHETIC_REVIEWED' },
  { code: 'id', name: 'Bahasa Indonesia', english: 'Indonesian', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'th', name: 'ไทย', english: 'Thai', dir: 'ltr', status: 'SYNTHETIC_REVIEWED' },
  { code: 'ru', name: 'Русский', english: 'Russian', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'kk', name: 'Қазақша', english: 'Kazakh', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'ky', name: 'Кыргызча', english: 'Kyrgyz', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'tg', name: 'Тоҷикӣ', english: 'Tajik', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'bn', name: 'বাংলা', english: 'Bengali', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'ur', name: 'اردو', english: 'Urdu', dir: 'rtl', status: 'MACHINE_DRAFT' },
  { code: 'si', name: 'සිංහල', english: 'Sinhala', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'ta', name: 'தமிழ்', english: 'Tamil', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'te', name: 'తెలుగు', english: 'Telugu', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'fil', name: 'Filipino', english: 'Filipino', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'ms', name: 'Bahasa Melayu', english: 'Malay', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'km', name: 'ខ្មែរ', english: 'Khmer', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'lo', name: 'ລາວ', english: 'Lao', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'ar', name: 'العربية', english: 'Arabic', dir: 'rtl', status: 'MACHINE_DRAFT' },
  { code: 'fa', name: 'فارسی', english: 'Persian', dir: 'rtl', status: 'MACHINE_DRAFT' },
  { code: 'tr', name: 'Türkçe', english: 'Turkish', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'az', name: 'Azərbaycanca', english: 'Azerbaijani', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'uk', name: 'Українська', english: 'Ukrainian', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'pl', name: 'Polski', english: 'Polish', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'ro', name: 'Română', english: 'Romanian', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'cs', name: 'Čeština', english: 'Czech', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'hu', name: 'Magyar', english: 'Hungarian', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'el', name: 'Ελληνικά', english: 'Greek', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'fr', name: 'Français', english: 'French', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'es', name: 'Español', english: 'Spanish', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'pt', name: 'Português', english: 'Portuguese', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'de', name: 'Deutsch', english: 'German', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'it', name: 'Italiano', english: 'Italian', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'nl', name: 'Nederlands', english: 'Dutch', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'sv', name: 'Svenska', english: 'Swedish', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'am', name: 'አማርኛ', english: 'Amharic', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'sw', name: 'Kiswahili', english: 'Swahili', dir: 'ltr', status: 'MACHINE_DRAFT' },
  // V8 additions (machine drafts; common namespace first, other namespaces fall back to English and say so).
  { code: 'he', name: 'עברית', english: 'Hebrew', dir: 'rtl', status: 'MACHINE_DRAFT' },
  { code: 'ps', name: 'پښتو', english: 'Pashto', dir: 'rtl', status: 'MACHINE_DRAFT' },
  { code: 'hy', name: 'Հայերեն', english: 'Armenian', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'mr', name: 'मराठी', english: 'Marathi', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'ha', name: 'Hausa', english: 'Hausa', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'yo', name: 'Yorùbá', english: 'Yoruba', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'ig', name: 'Igbo', english: 'Igbo', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'so', name: 'Soomaali', english: 'Somali', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'tk', name: 'Türkmençe', english: 'Turkmen', dir: 'ltr', status: 'MACHINE_DRAFT' },
  { code: 'ka', name: 'ქართული', english: 'Georgian', dir: 'ltr', status: 'MACHINE_DRAFT' },
  // V14: Serbia is one of the markets in `apps/flags` (RS.svg) and had no locale at all — `apps/flags/index.ts`
  // quietly left the asset unexported rather than add one. See docs/qa/v14/LOCALE_MATRIX.md.
  { code: 'sr', name: 'Српски', english: 'Serbian', dir: 'ltr', status: 'MACHINE_DRAFT' },
];

// V5: one namespace per product pillar (success = admission strategy + submission, dossier = documents, writing = essay
// review, visaroute = visa concierge, concierge = arrival/services) so parallel work never edits the same file.
export const NAMESPACES = ['common', 'marketing', 'student', 'agency', 'university', 'mobile', 'success', 'dossier', 'writing', 'visaroute', 'concierge'] as const;
export type Namespace = (typeof NAMESPACES)[number];
export const STORAGE_KEY = 'hg.locale';

const codes = new Set(LOCALES.map((l) => l.code));

/** Map any BCP-47 tag (e.g. "zh-CN", "vi-VN", "pt-BR") to a supported locale. */
export function resolveLocale(tag: string | null | undefined): string {
  if (!tag) return 'en';
  if (codes.has(tag)) return tag;
  const lower = tag.toLowerCase();
  if (lower.startsWith('zh')) return /tw|hk|mo|hant/.test(lower) ? 'zh-Hant' : 'zh-Hans';
  if (lower === 'tl' || lower.startsWith('tl-')) return 'fil';
  const base = lower.split('-')[0];
  return codes.has(base) ? base : 'en';
}

export function localeDef(code: string): LocaleDef {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

/**
 * How trustworthy the text in a locale is for one namespace. Surfaced to users so machine-drafted or partly
 * English pages are never presented as reviewed translations. Coverage comes from `npm run i18n:check`.
 */
export interface TranslationQuality { status: LocaleDef['status']; coverage: number; complete: boolean }
export function translationQuality(code: string, ns: Namespace, surface?: 'student'): TranslationQuality {
  const def = localeDef(code);
  if (def.status === 'SOURCE_APPROVED') return { status: 'SOURCE_APPROVED', coverage: 100, complete: true };
  // V9: in the student app, completeness means the student-journey manifest (what a student can actually reach),
  // not raw namespace coverage — those namespaces also hold staff-only subtrees a student never renders.
  if (surface === 'student') {
    const s = studentRecords[def.code];
    if (s) return { status: def.status, coverage: Math.round(s.manifest_pct), complete: isStudentAppLocale(def.code) };
  }
  const cov = (meta as { coverage: Record<string, Record<string, number>> }).coverage[def.code]?.[ns] ?? 0;
  return { status: def.status, coverage: cov, complete: cov >= 100 };
}

/**
 * V9 student-app gate (docs/qa/v9/l10n/PIPELINE.md). A locale is offered as a STUDENT APP language only when
 *   (1) every key of the student-journey manifest (locales/_student_manifest.json) is translated (manifest_pct = 100), and
 *   (2) a passing leak check (scripts/qa/leak-check-v9.mjs, 0 unexplained English text nodes) is recorded.
 * English is always offered. The record is locales/_student_status.json, written by scripts/i18n/v9-coverage.mjs.
 * The public (marketing) website keeps every locale. This gate never changes `status` (no locale is HUMAN_REVIEWED).
 */
export interface StudentLocaleStatus {
  manifest_pct: number;
  /** Native student app (apps/student-mobile): manifest keys incl. the `mobile` namespace. */
  native_pct?: number;
  leak_check: null | { date: string; leaks: number; widths?: number[] };
  synthetic_review: null | { date: string; min_score: number };
}
const studentRecords = ((studentStatus as { locales?: Record<string, StudentLocaleStatus> }).locales ?? {}) as Record<string, StudentLocaleStatus>;
export function studentLocaleStatus(code: string): StudentLocaleStatus | null {
  return studentRecords[code] ?? null;
}
export function isStudentAppLocale(code: string, surface: 'web' | 'native' = 'web'): boolean {
  if (code === 'en') return true;
  const s = studentRecords[code];
  if (!s || !s.leak_check || s.leak_check.leaks !== 0) return false;
  return surface === 'native' ? s.manifest_pct >= 100 && (s.native_pct ?? 0) >= 100 : s.manifest_pct >= 100;
}
/** Locales offered in the student app's language picker (derived; see isStudentAppLocale). */
export const studentApp: { locales: LocaleDef[] } = {
  get locales() { return LOCALES.filter((l) => isStudentAppLocale(l.code)); },
};

/**
 * Dev-only, opt-in translation-key recorder (V9 student manifest, scripts/i18n/v9-manifest.mjs --runtime).
 * Active only when the app calls it in development AND `localStorage['hg.recordKeys'] === '1'`; records every key
 * resolved through i18next as `ns:key` into `window.__hgKeys` (and `ns:key` of keys that were not found into
 * `window.__hgMissingKeys`). It never changes the translated value.
 */
export function installKeyRecorder(instance: I18n = i18next) {
  const g = globalThis as unknown as { localStorage?: Storage; __hgKeys?: Record<string, number>; __hgMissingKeys?: Record<string, number> };
  let on = false;
  try { on = g.localStorage?.getItem('hg.recordKeys') === '1'; } catch { /* storage blocked */ }
  if (!on || g.__hgKeys) return;
  const seen: Record<string, number> = {};
  const missing: Record<string, number> = {};
  g.__hgKeys = seen;
  g.__hgMissingKeys = missing;
  instance.use({
    type: 'postProcessor',
    name: 'hgRecordKeys',
    process(value: unknown, key: string | string[], options: { ns?: string | string[]; i18nResolved?: { usedNS?: string; exactUsedKey?: string; usedKey?: string } }) {
      const r = options?.i18nResolved;
      if (r?.usedNS && (r.exactUsedKey || r.usedKey)) {
        const k = `${r.usedNS}:${r.exactUsedKey ?? r.usedKey}`;
        seen[k] = (seen[k] ?? 0) + 1;
      } else {
        const k = `${Array.isArray(options?.ns) ? options.ns[0] : options?.ns ?? '?'}:${Array.isArray(key) ? key[0] : key}`;
        missing[k] = (missing[k] ?? 0) + 1;
      }
      return value;
    },
  } as never);
  const pp = instance.options.postProcess;
  const list = (Array.isArray(pp) ? pp : pp ? [pp] : []) as string[];
  if (!list.includes('hgRecordKeys')) instance.options.postProcess = [...list, 'hgRecordKeys'];
  instance.options.postProcessPassResolved = true;
}

export function isRTL(code: string): boolean {
  return localeDef(code).dir === 'rtl';
}

/** Extra per-locale work done together with the translations (e.g. CLDR fallback data from @hangyul/utils), so a
 *  locale's first render already has everything it formats with. Registered by the app bootstraps. */
const preloaders: ((locale: string) => Promise<void>)[] = [];
export function registerLocalePreloader(fn: (locale: string) => Promise<void>) { preloaders.push(fn); }

export async function loadNamespaces(instance: I18n, locale: string, namespaces: readonly string[]) {
  await Promise.all([
    ...preloaders.map((fn) => fn(locale).catch(() => undefined)),
    // Every locale in the chain, not just English: i18next cannot fall back to a bundle that was never loaded,
    // and a silent failure here looks exactly like "that locale has no translation".
    ...namespaces.flatMap((ns) =>
      localeChain(locale).map(async (loc) => {
        if (instance.hasResourceBundle(loc, ns)) return;
        const loader = loaders[loc]?.[ns];
        if (!loader) return;
        const mod = await loader();
        instance.addResourceBundle(loc, ns, (mod as { default?: object }).default ?? mod, true, true);
      }),
    ),
  ]);
}

/**
 * Locales that should fall back through a **second language** before English (V13, brief Part 17).
 *
 * A fallback only ever applies to a key the reader's own locale does not have, so a namespace that is 100%
 * translated is untouched by this. What it changes is the partially-translated surface — in practice the
 * marketing site, whose copy exists only in the owner's two canonical locales plus English (REPORT §92.3).
 *
 * Measured by `scripts/qa/v13-country-probe.mjs`: all fourteen priority source markets see the public
 * homepage in English. Three of them — Uzbekistan, Kazakhstan, Kyrgyzstan — are markets where Russian is
 * widely read, and where the Russian that would be served is not a machine translation but **the owner's own
 * writing**: Koreanasha's audience is Russian-speaking, so its 301 Russian strings are company copy, gated by
 * `scripts/qa/v11-copy-fidelity.mjs` exactly like the Korean.
 *
 * So for these three markets the choice is between the owner's own words and an AI translation of them. It
 * costs no translation work and it is one line to reverse if the owner decides otherwise — which is a product
 * decision about an audience, not an engineering one, and it is recorded as such in REPORT §103.
 */
export const FALLBACK_CHAIN: Record<string, string[]> = {
  uz: ['ru', 'en'],
  kk: ['ru', 'en'],
  ky: ['ru', 'en'],
  tg: ['ru', 'en'],
};

/** Every locale whose bundles must be present for `code` to render: itself, then its chain, then English. */
export function localeChain(code: string): string[] {
  return [...new Set([code, ...(FALLBACK_CHAIN[code] ?? []), 'en'])];
}

export async function initI18n(opts: { namespaces: readonly Namespace[]; locale?: string; onLocaleChange?: (code: string) => void }): Promise<I18n> {
  const locale = resolveLocale(opts.locale);
  await i18next.use(initReactI18next).use(koreanParticles).init({
    lng: locale,
    // V26: Korean particles follow the word they attach to (`particles.ts`); a no-op for every other language.
    postProcess: ['hgKoParticles'],
    fallbackLng: { ...FALLBACK_CHAIN, default: ['en'] },
    ns: [...opts.namespaces],
    defaultNS: opts.namespaces[0],
    fallbackNS: 'common',
    interpolation: { escapeValue: false },
    returnNull: false,
    resources: {},
    react: { useSuspense: false },
  });
  await loadNamespaces(i18next, locale, opts.namespaces);
  i18next.on('languageChanged', async (lng) => {
    await loadNamespaces(i18next, lng, opts.namespaces);
    opts.onLocaleChange?.(lng);
  });
  return i18next;
}

export async function changeLocale(code: string) {
  const resolved = resolveLocale(code);
  await loadNamespaces(i18next, resolved, (i18next.options.ns as string[]) ?? ['common']);
  await i18next.changeLanguage(resolved);
}

/** Hook exposing t + locale-bound Intl formatters. */
export function useLocale(ns?: Namespace | Namespace[]) {
  const { t, i18n } = useTranslation(ns);
  const locale = i18n.language || 'en';
  return { t, i18n, locale, dir: localeDef(locale).dir, def: localeDef(locale) };
}

export { i18next, useTranslation };
export { resolveKoreanParticles } from './particles';
export { Trans } from 'react-i18next';

type TFn = (key: string, opts?: Record<string, unknown>) => string;
/**
 * Renders a server-generated title (tasks, next actions, deadlines) in the reader's language.
 * Uses `title_key` + `title_params` when present; enum params (document category, essay type) are translated too.
 * Falls back to the English `title` from the API.
 */
export function localizedTitle(t: TFn, item: { title: string; title_key?: string | null; title_params?: Record<string, unknown> | null }): string {
  if (!item.title_key) return item.title;
  const p: Record<string, unknown> = { ...(item.title_params ?? {}) };
  if (typeof p.category === 'string') p.category = t(`common:docCategory.${p.category}`).toLowerCase();
  if (typeof p.essayType === 'string') p.essayType = t(`common:essayType.${p.essayType}`).toLowerCase();
  // V5 service cases: "{{type}}: {{student}}" — the case type is an enum, shown in the reader's language.
  if (item.title_key.startsWith('task.concierge') && typeof p.type === 'string') p.type = t(`concierge:type.${p.type}`);
  const out = t(`common:${item.title_key}`, { ...p, defaultValue: '' });
  return out && !out.includes('{{') ? out : item.title;
}

/**
 * A document requirement's name in the reader's language. Requirement and request labels come from the catalogue or a
 * university in English ("Academic transcript"); outside English the translated document category is shown instead
 * (the university's exact note is shown separately as a quote). English keeps the catalogue label.
 */
export function docLabel(t: TFn, item: { label?: string | null; category?: string | null; name_ko?: string | null }, locale?: string): string {
  const lng = locale ?? i18next.language ?? 'en';
  // V27: a requirement read from an official Korean guide keeps the guide's own wording for Korean readers.
  if (lng.startsWith('ko') && item.name_ko) return item.name_ko;
  const cat = item.category && item.category !== 'OTHER' ? t(`common:docCategory.${item.category}`, { defaultValue: '' }) : '';
  if (!cat) return item.label ?? '';
  return lng.startsWith('en') && item.label ? item.label : cat;
}

/** Essay type in the reader's language; English keeps the given label (e.g. an essay title) when there is one. */
export function essayLabel(t: TFn, item: { label?: string | null; essay_type?: string | null }, locale?: string): string {
  const lng = locale ?? i18next.language ?? 'en';
  const name = item.essay_type ? t(`common:essayType.${item.essay_type}`, { defaultValue: '' }) : '';
  if (!name) return item.label ?? '';
  return lng.startsWith('en') && item.label ? item.label : name;
}

/** The canonical target markets behind the flag set, and the URL-locale helpers (brief Parts 39 and 44). */
export * from './markets';
export * from './url';

/**
 * V28 (UX_AUDIT ST-1/AG-3/UN-2): an entity's name in the reader's language — the Korean name on a Korean screen, the
 * English (official romanised) name elsewhere, each falling back to the other. One rule for every app.
 */
export function localName(o?: { name_en?: string | null; name_ko?: string | null } | null): string {
  if (!o) return '';
  const ko = (i18next.language ?? '').startsWith('ko');
  return (ko ? o.name_ko || o.name_en : o.name_en || o.name_ko) ?? '';
}
export * from './console-locales';
