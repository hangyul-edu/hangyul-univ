import type { useLocale } from '@hangyul/i18n';
import type { Requirements } from '@hangyul/types';
import { z } from 'zod';

const num = (max: number, opts: { int?: boolean; step?: number } = {}) =>
  z.string().trim().refine((v) => {
    if (v === '') return true;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > max) return false;
    if (opts.int && !Number.isInteger(n)) return false;
    if (opts.step && Math.abs(n / opts.step - Math.round(n / opts.step)) > 1e-9) return false;
    return true;
  }, { message: 'validation.scoreRange' });

/** Admission-rule form. Inputs are strings; blank numeric fields mean "no minimum". */
export const rulesSchema = z.object({
  min_gpa_percent: num(100),
  min_topik_level: num(6, { int: true }),
  min_ielts: num(9, { step: 0.5 }),
  min_toefl_ibt: num(120, { int: true }),
  min_prior_education: z.enum(['', 'HIGH_SCHOOL', 'ASSOCIATE', 'BACHELOR', 'MASTER']),
  language_alternative: z.boolean(),
  requires_interview: z.boolean(),
  notes: z.string().max(2000),
  source_url: z.string().trim().max(1000).refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), { message: 'university:rules.invalidUrl' }),
});
export type RulesValues = z.infer<typeof rulesSchema>;

const s = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

export function rulesDefaults(r: (Requirements & { source_url?: string | null }) | null): RulesValues {
  return {
    min_gpa_percent: s(r?.min_gpa_percent),
    min_topik_level: s(r?.min_topik_level),
    min_ielts: s(r?.min_ielts),
    min_toefl_ibt: s(r?.min_toefl_ibt),
    min_prior_education: (r?.min_prior_education ?? '') as RulesValues['min_prior_education'],
    language_alternative: !!r?.language_alternative,
    requires_interview: !!r?.requires_interview,
    notes: r?.notes ?? '',
    source_url: r?.source_url ?? '',
  };
}

/** API payload: blanks become null (explicitly clearing the minimum). */
export function rulesPayload(v: RulesValues) {
  const n = (x: string) => (x.trim() === '' ? null : Number(x));
  return {
    min_gpa_percent: n(v.min_gpa_percent),
    min_topik_level: n(v.min_topik_level),
    min_ielts: n(v.min_ielts),
    min_toefl_ibt: n(v.min_toefl_ibt),
    min_prior_education: v.min_prior_education || null,
    language_alternative: v.language_alternative,
    requires_interview: v.requires_interview,
    notes: v.notes.trim() || null,
    source_url: v.source_url.trim() || null,
  };
}

/** Plain-language requirement lines — the same sentences a student reads ("GPA 65% or higher"). */
export function requirementLines(r: Partial<Requirements> | null | undefined, t: ReturnType<typeof useLocale>['t']): string[] {
  if (!r) return [];
  const out: string[] = [];
  if (r.min_prior_education) out.push(t('university:v4.req.education', { level: t(`university:eduLevel.${r.min_prior_education}`, { defaultValue: r.min_prior_education }) }));
  if (r.min_gpa_percent !== null && r.min_gpa_percent !== undefined) out.push(t('university:v4.req.gpa', { value: r.min_gpa_percent }));
  const lang = [
    r.min_topik_level ? t('university:v4.req.topik', { value: r.min_topik_level }) : null,
    r.min_ielts ? t('university:v4.req.ielts', { value: r.min_ielts }) : null,
    r.min_toefl_ibt ? t('university:v4.req.toefl', { value: r.min_toefl_ibt }) : null,
  ].filter((x): x is string => !!x);
  if (lang.length) out.push(lang.join(r.language_alternative ? ` ${t('university:v4.req.or')} ` : ` ${t('university:v4.req.and')} `));
  else out.push(t('university:v4.req.noLanguage'));
  out.push(r.requires_interview ? t('university:v4.req.interview') : t('university:v4.req.noInterview'));
  if (r.requires_portfolio) out.push(t('university:v4.req.portfolio'));
  return out;
}

