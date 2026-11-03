import type { ApiClient } from '@hangyul/api-client';
import { planFromParam } from '@hangyul/types';
import { readFitAnswers, type DegreeLevel, type FitAnswers, type QuickEligibilityInput, type QuickLanguageKind } from '@hangyul/types';

/** The three quick-eligibility answers, carried between /start, the marketing site and /register through URL params. */
export interface QuickAnswers { nationality: string; degree: DegreeLevel | ''; kind: QuickLanguageKind | ''; level: string }

/** The qualification each degree normally requires (mirrors services/matching.py DEFAULT_PRIOR). */
export const PRIOR_FOR: Partial<Record<DegreeLevel, 'HIGH_SCHOOL' | 'ASSOCIATE' | 'BACHELOR' | 'MASTER'>> = {
  BACHELOR: 'HIGH_SCHOOL', TRANSFER: 'ASSOCIATE', MASTER: 'BACHELOR', DOCTORATE: 'MASTER',
};
export type PriorAnswer = 'GRADUATED' | 'EXPECTED' | 'NO' | '';

export const QUICK_DEGREES: DegreeLevel[] = ['LANGUAGE', 'BACHELOR', 'TRANSFER', 'MASTER', 'DOCTORATE'];
export const QUICK_KINDS: QuickLanguageKind[] = ['TOPIK', 'IELTS', 'TOEFL_IBT', 'NONE', 'PREPARING'];
export const LEVELS: Record<string, string[]> = {
  TOPIK: ['1', '2', '3', '4', '5', '6'],
  IELTS: ['4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8'],
  TOEFL_IBT: ['60', '70', '80', '90', '100', '110'],
};

export function readQuick(sp: URLSearchParams): QuickAnswers {
  // V27: the quick fit writes `level` (and `gpa`, `gpa_scale`, `langs`); the V17 `degree` param is still read.
  const deg = sp.get('level') ?? sp.get('degree');
  return {
    nationality: (sp.get('nationality') ?? '').toUpperCase().slice(0, 2),
    degree: ([...QUICK_DEGREES, 'ASSOCIATE', 'COMBINED'].includes(deg as DegreeLevel) ? deg : '') as DegreeLevel | '',
    kind: (QUICK_KINDS.includes(sp.get('lang_kind') as QuickLanguageKind) ? sp.get('lang_kind') : '') as QuickLanguageKind | '',
    level: sp.get('lang_level') ?? '',
  };
}

/** The V27 answers carried in the URL (GPA on its own scale, every language result). */
export function readFit(sp: URLSearchParams): FitAnswers {
  return readFitAnswers(sp);
}

export function quickParams(a: QuickAnswers): string {
  const sp = new URLSearchParams();
  if (a.nationality) sp.set('nationality', a.nationality);
  if (a.degree) sp.set('degree', a.degree);
  if (a.kind) sp.set('lang_kind', a.kind);
  if (a.level && LEVELS[a.kind]) sp.set('lang_level', a.level);
  return sp.toString();
}

export function quickComplete(a: QuickAnswers): boolean {
  return !!a.nationality && !!a.degree && !!a.kind && (!LEVELS[a.kind] || !!a.level);
}

export function quickInput(a: QuickAnswers): QuickEligibilityInput {
  return { nationality: a.nationality, degree: a.degree as DegreeLevel, language: { kind: a.kind as QuickLanguageKind, level: LEVELS[a.kind] && a.level ? Number(a.level) : undefined } };
}

/** After sign-up, carry the quick answers into the profile so the first matches are already personal. */
/** The profile's test codes: the registry's IELTS_ACADEMIC is the profile's IELTS. */
const PROFILE_TEST: Record<string, string> = { IELTS_ACADEMIC: 'IELTS' };

export async function applyQuickToProfile(api: ApiClient, a: QuickAnswers, prior: PriorAnswer = '', fit?: FitAnswers): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (a.nationality) patch.nationality = a.nationality;
  if (a.degree) patch.target_degree = a.degree;
  if (Object.keys(patch).length) await api.me.updateProfile(patch);
  if (fit?.languages.length) {
    // V27: every result the student entered, not only the first (REPORT §356).
    for (const l of fit.languages) await api.me.addLanguage({ test: (PROFILE_TEST[l.test] ?? l.test) as never, score: l.score });
  } else if (LEVELS[a.kind] && a.level) await api.me.addLanguage({ test: a.kind, score: Number(a.level) });
  // A self-declared qualification (no school name or grades yet) lets the engine confirm the same programs the quick
  // check assumed; the student adds details later in the profile.
  const level = a.degree ? PRIOR_FOR[a.degree] : undefined;
  if (level && (prior === 'GRADUATED' || prior === 'EXPECTED') && a.nationality) {
    const gpa = fit && Number(fit.gpa) >= 0 && Number(fit.gpaScale) > 0 ? { gpa_value: Number(fit.gpa), gpa_scale_max: Number(fit.gpaScale) } : {};
    await api.me.addEducation({ level, institution: '', country: a.nationality, graduation_status: prior, ...gpa });
  }
}

/**
 * V15 — the plan a visitor chose on the public pricing section, carried through this app's auth boundary.
 *
 * The homepage CTA opens `/start?plan=all_in_one`. Three hops later the student has an account and has to
 * land on the service page **with that plan still chosen**, or the handoff silently loses the one decision
 * they had already made. So the value rides in the URL the whole way — quick-check answers carry it into
 * registration, and `next` points at the service page that reads it.
 *
 * Validated against the shared manifest rather than passed through, so a hand-edited `?plan=` cannot put an
 * arbitrary string into a link or a selected state.
 */
export function readPlanParam(search: string | URLSearchParams): string | null {
  const sp = typeof search === 'string' ? new URLSearchParams(search) : search;
  return planFromParam(sp.get('plan'))?.slug ?? null;
}

/** `quickParams` plus `plan`, for the links out of `/start`. */
export function startParams(a: QuickAnswers, plan: string | null): string {
  const sp = new URLSearchParams(quickParams(a));
  if (plan) {
    sp.set('plan', plan);
    // Where registration should land. Without this a visitor who chose All-in-One on the homepage ends up
    // on the explore screen and has to find the plan again.
    sp.set('next', `/services?plan=${encodeURIComponent(plan)}`);
  }
  return sp.toString();
}
