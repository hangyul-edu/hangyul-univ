/**
 * V27 admissions registry — **the single source of truth for which study levels, language qualifications and GPA
 * scales the quick check and the profile accept** (REPORT §356).
 *
 * `scripts/admissions/sync.mjs` writes `shared/admissions.json` from this file; the server validates and normalises
 * with that file, so a scale the form offers and a scale the API accepts cannot drift apart.
 *
 * A test being listed here means a student can *tell us* they hold it. Whether a university **accepts** it is a
 * separate fact stored per institution, level and track (`admission_language_rules`), read from that university's
 * current official rule. TOEIC, Duolingo, Cambridge and PTE are recordable and count only where a rule names them.
 */

/** Study levels in the order a student reads them. `COMBINED` = 석박사 통합과정. */
export const STUDY_LEVELS = ['LANGUAGE', 'ASSOCIATE', 'BACHELOR', 'TRANSFER', 'MASTER', 'DOCTORATE', 'COMBINED'] as const;
export type StudyLevel = (typeof STUDY_LEVELS)[number];

export type TestFamily = 'KOREAN' | 'ENGLISH';
export type LanguageTestCode =
  | 'TOPIK' | 'TOPIK_IBT' | 'KIIP' | 'KING_SEJONG' | 'UNIV_KLI'
  | 'TOEFL_IBT' | 'IELTS_ACADEMIC' | 'TEPS' | 'NEW_TEPS' | 'TOEIC' | 'DUOLINGO' | 'CAMBRIDGE' | 'PTE';

export interface LanguageTestDef {
  code: LanguageTestCode;
  family: TestFamily;
  /** LEVEL = an ordinal level or stage; SCORE = a numeric score. */
  kind: 'LEVEL' | 'SCORE';
  min: number;
  max: number;
  step: number;
  /** Offered first in the form. The rest sit behind "다른 시험". */
  common: boolean;
}

export const LANGUAGE_TESTS: readonly LanguageTestDef[] = [
  { code: 'TOPIK', family: 'KOREAN', kind: 'LEVEL', min: 1, max: 6, step: 1, common: true },
  { code: 'TOPIK_IBT', family: 'KOREAN', kind: 'LEVEL', min: 1, max: 6, step: 1, common: false },
  // 사회통합프로그램: the stage completed (0 = 기초, 5 = 심화).
  { code: 'KIIP', family: 'KOREAN', kind: 'LEVEL', min: 0, max: 5, step: 1, common: false },
  // 세종학당: the course level completed (세종한국어 1–8).
  { code: 'KING_SEJONG', family: 'KOREAN', kind: 'LEVEL', min: 1, max: 8, step: 1, common: false },
  // A Korean university's own language institute: the level completed (most run 1–6).
  { code: 'UNIV_KLI', family: 'KOREAN', kind: 'LEVEL', min: 1, max: 6, step: 1, common: false },
  { code: 'TOEFL_IBT', family: 'ENGLISH', kind: 'SCORE', min: 0, max: 120, step: 1, common: true },
  { code: 'IELTS_ACADEMIC', family: 'ENGLISH', kind: 'SCORE', min: 0, max: 9, step: 0.5, common: true },
  { code: 'NEW_TEPS', family: 'ENGLISH', kind: 'SCORE', min: 0, max: 600, step: 1, common: false },
  { code: 'TEPS', family: 'ENGLISH', kind: 'SCORE', min: 0, max: 990, step: 1, common: false },
  { code: 'TOEIC', family: 'ENGLISH', kind: 'SCORE', min: 10, max: 990, step: 5, common: false },
  { code: 'DUOLINGO', family: 'ENGLISH', kind: 'SCORE', min: 10, max: 160, step: 5, common: false },
  { code: 'PTE', family: 'ENGLISH', kind: 'SCORE', min: 10, max: 90, step: 1, common: false },
  { code: 'CAMBRIDGE', family: 'ENGLISH', kind: 'SCORE', min: 80, max: 230, step: 1, common: false },
];

/**
 * GPA scales a student can enter their grade on, **as printed on their own transcript**. Hangyul never asks a
 * student to convert first; the server stores the raw value, the scale and a normalised percentage, and says how
 * it normalised (`GPA_METHOD`). `CUSTOM` takes an explicit maximum.
 */
export const GPA_SCALES = [4, 4.3, 4.5, 5, 10, 20, 100] as const;
export const GPA_CUSTOM_MAX = { min: 1, max: 1000 } as const;
/**
 * Linear share of the scale's maximum (3.6 / 4.5 → 80 %). Stated to the student next to the result, because a
 * linear share is not how every university converts — some publish their own tables, and those win where known.
 */
export const GPA_METHOD = 'LINEAR_SCALE_PERCENT' as const;

/**
 * The external helper a student can open to understand a conversion. A helper only: Hangyul still accepts the
 * original scale. URL verified 2026-10-29 (REPORT §354); the older applications.wes.org address now redirects to a login page.
 */
export const GPA_HELP_URL = 'https://apps.wes.org/igpa-calculator/';

/** The four honest result groups (REPORT §356). No probability is ever attached to any of them. */
/** Ordered by known disqualifications: none confirmed · none known · one known · far (REPORT §361). */
export const FIT_TIERS = ['MEETS', 'CHALLENGE', 'ONE_STEP', 'UNCLEAR'] as const;
export type FitTier = (typeof FIT_TIERS)[number];

export const MATCH_SORTS = ['recommended', 'scholarship', 'region', 'name'] as const;
export type MatchSort = (typeof MATCH_SORTS)[number];

export function normaliseGpa(value: number, scaleMax: number): number | null {
  if (!(scaleMax > 0) || !(value >= 0) || value > scaleMax) return null;
  return Math.round((value / scaleMax) * 1000) / 10;
}

export function testDef(code: string): LanguageTestDef | undefined {
  return LANGUAGE_TESTS.find((t) => t.code === code);
}

// ---------- the quick fit API (POST /public/fit) ----------

export interface FitLanguage { test: LanguageTestCode; score: number }
export interface FitGpa { raw_value: number; scale_max: number; normalized_percent: number; normalization_method: typeof GPA_METHOD }
export interface FitInput {
  nationality: string;
  level: StudyLevel;
  gpa?: { value: number; scale_max: number } | null;
  languages: FitLanguage[];
  sort?: MatchSort;
  tier?: FitTier;
  region?: string;
  offset?: number;
  limit?: number;
}
export interface FitScholarshipPick {
  name: string; name_en: string | null; category: string | null;
  waiver_min: number | null; waiver_max: number | null; amount_krw: number | null; automatic: boolean;
}
export interface FitItem {
  slug: string; name_ko: string; name_en: string | null; region: string; institution_type: string;
  ieqas: 'EXCELLENT' | 'CERTIFIED' | null; featured: boolean; tier: FitTier;
  reason: { code: 'LANGUAGE_MET' | 'NO_LANGUAGE_REQUIRED' | 'LANGUAGE_UNCHECKABLE' | 'LANGUAGE_NEEDED' | 'LANGUAGE_FAR' | 'LANGUAGE_SEVERAL' | 'RULES_UNVERIFIED' | 'LANGUAGE_PROGRAMME_LISTED';
    params: { track?: string; later?: { test: string; min: string | number }[]; test?: string; need?: string | number; have?: number; options?: { test: string; min: string | number; note?: string }[]; groups?: number; ieqas?: string | null } };
  scholarship: { count: number; best: FitScholarshipPick | null; unlock: (FitScholarshipPick & { needs: { test?: string; min?: number } }) | null } | null;
  tracks: ('KOREAN' | 'ENGLISH')[];
  verified_rules: boolean;
  /** The directory tile's media slice — the same object `resolveUniversityVisual` reads. */
  enrichment: Record<string, unknown> | null;
}
export interface FitResult {
  engine: string; level: StudyLevel; sort: MatchSort; gpa: FitGpa | null; languages: FitLanguage[];
  counts: Record<FitTier, number>; total: number; regions: Record<string, number>; verified_rule_institutions: number;
  sections?: { tier: FitTier; total: number; items: FitItem[] }[];
  items?: FitItem[]; page_total?: number; offset?: number;
  unlock?: { test: LanguageTestCode; min: number; count: number };
}

// ---------- answers carried in the URL: /start → university page → registration (one encoding, every app) ----------

export interface FitAnswers {
  nationality: string;
  level: StudyLevel | '';
  /** As typed, so "3.60" survives the round trip. */
  gpa: string;
  /** The scale's maximum as a string; '' = not chosen. */
  gpaScale: string;
  languages: FitLanguage[];
  /** The student said they hold no language result yet. */
  noLanguage: boolean;
}

export const EMPTY_FIT_ANSWERS: FitAnswers = { nationality: '', level: '', gpa: '', gpaScale: '', languages: [], noLanguage: false };

export function readFitAnswers(sp: URLSearchParams): FitAnswers {
  const level = sp.get('level') ?? sp.get('degree') ?? '';
  const langs: FitLanguage[] = [];
  for (const part of (sp.get('langs') ?? '').split(',')) {
    const [code, raw] = part.split(':');
    const def = testDef(code ?? '');
    const score = Number(raw);
    if (def && raw !== undefined && Number.isFinite(score) && score >= def.min && score <= def.max && !langs.some((l) => l.test === def.code)) {
      langs.push({ test: def.code, score });
    }
  }
  const gpaScale = sp.get('gpa_scale') ?? '';
  return {
    nationality: (sp.get('nationality') ?? '').toUpperCase().slice(0, 2),
    level: (STUDY_LEVELS as readonly string[]).includes(level) ? (level as StudyLevel) : '',
    gpa: sp.get('gpa') ?? '',
    gpaScale: Number(gpaScale) > 0 ? gpaScale : '',
    languages: langs,
    noLanguage: sp.get('langs') === 'none',
  };
}

export function fitParams(a: FitAnswers): URLSearchParams {
  const sp = new URLSearchParams();
  if (a.nationality) sp.set('nationality', a.nationality);
  if (a.level) sp.set('level', a.level);
  if (a.gpa && a.gpaScale) { sp.set('gpa', a.gpa); sp.set('gpa_scale', a.gpaScale); }
  if (a.languages.length) sp.set('langs', a.languages.map((l) => `${l.test}:${l.score}`).join(','));
  else if (a.noLanguage) sp.set('langs', 'none');
  return sp;
}

/** The GPA as the API wants it, or null when it is missing or does not fit its own scale. */
export function fitGpa(a: FitAnswers): { value: number; scale_max: number } | null {
  const value = Number(a.gpa);
  const scale = Number(a.gpaScale);
  if (!a.gpa.trim() || !Number.isFinite(value) || !(scale > 0) || normaliseGpa(value, scale) === null) return null;
  return { value, scale_max: scale };
}

/** Complete enough to run: nationality, a level, a GPA (except the language route) and a language answer. */
export function fitComplete(a: FitAnswers): boolean {
  if (!a.nationality || !a.level) return false;
  if (a.level !== 'LANGUAGE' && !fitGpa(a)) return false;
  return a.noLanguage || a.languages.length > 0;
}

// ---------- the institution's verified scholarships and language rules (GET /directory/institutions/:slug/admissions) ----------

export interface InstScholarship {
  id: string; name: string; name_en: string | null; name_native?: string | null; name_official_en?: string | null; name_display_ko?: string | null; category: string | null; stage: string | null; degree_levels: string[];
  international_only: boolean | null; topik_min: number | null; english_min: Record<string, number> | null; english_text: string | null;
  gpa_requirement: string | null; gpa_min_percent: number | null; waiver_min: number | null; waiver_max: number | null; amount_krw: number | null;
  automatic: boolean; dormitory_support: boolean | null; living_allowance: string | null; duration: string | null; renewal: string | null;
  application_period: string | null; department_restriction: string | null; nationality_restriction: string | null;
  source_url: string | null; source_name: string | null; verified_at: string | null;
}
export interface InstRule { track: string; group: string; test: string; min: string | null; stage: string; note: string | null; source_url: string | null; verified_at: string | null }
export interface InstScholarshipPick { name: string; name_en: string | null; name_display_ko?: string | null; name_official_en?: string | null; waiver_max: number | null; amount_krw: number | null; automatic: boolean }
export interface InstAdmissions {
  verified: boolean; scholarships: InstScholarship[]; language_rules: Partial<Record<StudyLevel, InstRule[]>>;
  summary: { count: number; best: InstScholarshipPick | null; unlock: (InstScholarshipPick & { needs: { test?: string; min?: number } }) | null } | null;
}

