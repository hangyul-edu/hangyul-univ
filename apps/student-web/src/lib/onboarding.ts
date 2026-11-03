import type { ApiClient } from '@hangyul/api-client';
import type { DegreeLevel, IntakeTerm, LanguageScore, StudentProfile } from '@hangyul/types';
import { LANGUAGE_MAX } from '@hangyul/validation';

import { normalizeGpa, parseNum } from './format';

export const STEP_KEYS = ['basics', 'goals', 'education', 'language', 'preferences', 'passport', 'sponsor'] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export type TestKey = 'TOPIK' | 'IELTS' | 'TOEFL_IBT';
export const TESTS: TestKey[] = ['TOPIK', 'IELTS', 'TOEFL_IBT'];
export interface LangDraft { selected: boolean; score: string; planned: boolean; id?: string }

export interface EduDraft {
  id?: string;
  level: 'HIGH_SCHOOL' | 'ASSOCIATE' | 'BACHELOR' | 'MASTER' | 'DOCTORATE' | '';
  institution: string;
  country: string;
  major: string;
  graduation_status: 'GRADUATED' | 'EXPECTED' | 'IN_PROGRESS' | '';
  graduation_year: string;
  gpa_value: string;
  gpa_scale_max: string;
}

export interface Draft {
  nationality: string; residence_country: string; date_of_birth: string;
  target_degree: DegreeLevel | ''; desired_fields: string[]; target_intake_year: number | null; target_intake_term: IntakeTerm | '';
  edu: EduDraft;
  langs: Record<TestKey, LangDraft>;
  korean_self_level: string; english_self_level: string;
  annual_budget_krw: number | null; needs_scholarship: boolean | null; housing_preference: string; preferred_regions: string[];
  has_passport: boolean | null; passport_expiry: string; passport_number: string;
  previous_korean_visa: string; current_korean_visa: string; in_korea_now: boolean | null;
  financial_sponsor: string; career_goal: string;
}

export const GPA_SCALES = ['4', '4.3', '4.5', '5', '10', '20', '100'];

function langFrom(scores: LanguageScore[], test: TestKey): LangDraft {
  const s = scores.find((l) => l.test === test);
  return s ? { selected: true, score: s.is_planned ? '' : String(s.score), planned: s.is_planned, id: s.id } : { selected: false, score: '', planned: false };
}

export function draftFromProfile(p: StudentProfile | undefined | null): Draft {
  const e = p?.educations?.[0];
  return {
    nationality: p?.nationality ?? '',
    residence_country: p?.residence_country ?? '',
    date_of_birth: p?.date_of_birth ?? '',
    target_degree: p?.target_degree ?? '',
    desired_fields: p?.desired_fields ?? [],
    target_intake_year: p?.target_intake_year ?? null,
    target_intake_term: p?.target_intake_term ?? '',
    edu: {
      id: e?.id,
      level: (e?.level as EduDraft['level']) ?? '',
      institution: e?.institution ?? '',
      country: e?.country ?? p?.nationality ?? '',
      major: e?.major ?? '',
      graduation_status: (e?.graduation_status as EduDraft['graduation_status']) ?? '',
      graduation_year: e?.graduation_year ? String(e.graduation_year) : '',
      gpa_value: e?.gpa_value !== null && e?.gpa_value !== undefined ? String(e.gpa_value) : '',
      gpa_scale_max: e?.gpa_scale_max ? String(e.gpa_scale_max) : '',
    },
    langs: { TOPIK: langFrom(p?.languages ?? [], 'TOPIK'), IELTS: langFrom(p?.languages ?? [], 'IELTS'), TOEFL_IBT: langFrom(p?.languages ?? [], 'TOEFL_IBT') },
    korean_self_level: p?.korean_self_level ?? '',
    english_self_level: p?.english_self_level ?? '',
    annual_budget_krw: p?.annual_budget_krw ?? null,
    needs_scholarship: p?.needs_scholarship ?? null,
    housing_preference: p?.housing_preference ?? '',
    preferred_regions: p?.preferred_regions ?? [],
    has_passport: p?.has_passport ?? null,
    passport_expiry: p?.passport_expiry ?? '',
    passport_number: '',
    previous_korean_visa: p?.previous_korean_visa ?? '',
    current_korean_visa: p?.current_korean_visa ?? '',
    in_korea_now: p?.in_korea_now ?? null,
    financial_sponsor: p?.financial_sponsor ?? '',
    career_goal: p?.career_goal ?? '',
  };
}

const orNull = <T,>(v: T | '' | null | undefined): T | null => (v === '' || v === undefined ? null : v);

/** The PATCH body for profile-field steps (education & language are saved through their own endpoints). */
export function patchForStep(step: StepKey, d: Draft): Record<string, unknown> {
  switch (step) {
    case 'basics':
      return { nationality: orNull(d.nationality), residence_country: orNull(d.residence_country), date_of_birth: orNull(d.date_of_birth) };
    case 'goals':
      return { target_degree: orNull(d.target_degree), desired_fields: d.desired_fields, target_intake_year: d.target_intake_year, target_intake_term: orNull(d.target_intake_term) };
    case 'education':
      return {};
    case 'language':
      return { korean_self_level: orNull(d.korean_self_level), english_self_level: orNull(d.english_self_level) };
    case 'preferences':
      return { annual_budget_krw: d.annual_budget_krw, needs_scholarship: d.needs_scholarship, housing_preference: orNull(d.housing_preference), preferred_regions: d.preferred_regions };
    case 'passport': {
      const body: Record<string, unknown> = {
        has_passport: d.has_passport,
        passport_expiry: d.has_passport ? orNull(d.passport_expiry) : null,
        previous_korean_visa: orNull(d.previous_korean_visa),
        current_korean_visa: d.in_korea_now ? orNull(d.current_korean_visa) : null,
        in_korea_now: d.in_korea_now,
      };
      if (d.has_passport && d.passport_number.trim()) body.passport_number = d.passport_number.trim();
      return body;
    }
    case 'sponsor':
      return { financial_sponsor: orNull(d.financial_sponsor), career_goal: d.career_goal.trim() || null };
  }
}

/** Minimum to move on. Everything else can be skipped and filled later. */
export function stepValid(step: StepKey, d: Draft): boolean {
  switch (step) {
    case 'basics': return !!d.nationality && !!d.residence_country;
    case 'goals': return !!d.target_degree;
    case 'education': {
      if (!d.edu.level) return false;
      const gpa = educationGpaError(d.edu);
      return !gpa && (!d.edu.institution || !!d.edu.country);
    }
    case 'language': return TESTS.every((k) => !langError(k, d.langs[k]));
    default: return true;
  }
}

export function educationGpaError(e: EduDraft): 'validation.gpaAboveScale' | null {
  const v = parseNum(e.gpa_value);
  const max = parseNum(e.gpa_scale_max);
  if (v !== undefined && max !== undefined && v > max) return 'validation.gpaAboveScale';
  return null;
}

export function gpaPreview(e: EduDraft): number | null {
  const v = parseNum(e.gpa_value);
  const max = parseNum(e.gpa_scale_max);
  if (v === undefined || max === undefined || v > max) return null;
  return normalizeGpa(v, 0, max);
}

export function langError(test: TestKey, l: LangDraft): 'validation.scoreRange' | null {
  if (!l.selected || l.planned || l.score === '') return null;
  const n = parseNum(l.score);
  if (n === undefined || n < 0 || n > LANGUAGE_MAX[test]) return 'validation.scoreRange';
  return null;
}

/** Persist a step. Profile fields → PATCH; education/languages → their endpoints. Returns the updated profile. */
export async function saveStep(api: ApiClient, step: StepKey, d: Draft, prev: StudentProfile | undefined, extra: Record<string, unknown> = {}): Promise<StudentProfile> {
  if (step === 'education' && d.edu.level && d.edu.institution.trim() && d.edu.country) {
    const body = {
      level: d.edu.level,
      institution: d.edu.institution.trim(),
      country: d.edu.country,
      major: d.edu.major.trim() || null,
      graduation_status: d.edu.graduation_status || 'GRADUATED',
      graduation_year: parseNum(d.edu.graduation_year) ?? null,
      gpa_value: parseNum(d.edu.gpa_value) ?? null,
      gpa_scale_min: 0,
      gpa_scale_max: parseNum(d.edu.gpa_scale_max) ?? null,
    };
    if (d.edu.id) await api.me.updateEducation(d.edu.id, body);
    else await api.me.addEducation(body);
  }
  if (step === 'language') {
    const existing = prev?.languages ?? [];
    for (const test of TESTS) {
      const l = d.langs[test];
      const current = existing.find((x) => x.test === test);
      const wanted = l.selected && (l.planned || l.score !== '');
      const score = l.planned ? 0 : parseNum(l.score) ?? 0;
      const same = current && wanted && current.is_planned === l.planned && (l.planned || current.score === score);
      if (same) continue;
      if (current) await api.me.deleteLanguage(current.id);
      if (wanted) await api.me.addLanguage({ test, score, is_planned: l.planned });
    }
  }
  return api.me.updateProfile({ ...patchForStep(step, d), ...extra });
}

export function nextIntakeYears(now = new Date()): number[] {
  const y = now.getFullYear();
  return [y + 1, y + 2, y + 3].filter((x) => x >= 2025 && x <= 2035);
}
