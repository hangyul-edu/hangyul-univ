import { useApi } from '@hangyul/auth';
import {
  Baby, BookOpen, Briefcase, Building, Building2, CalendarClock, GraduationCap, HandCoins, Home, Languages, Library, MapPin, NotebookPen,
  Plane, School, Shuffle, User, Users,
} from '@hangyul/icons';
import type { Country, DegreeLevel } from '@hangyul/types';
import { Callout, Chip, CountrySelect, Field, FreshnessBadge, Input, OptionCards, Segmented, Select, Skeleton, Textarea } from '@hangyul/ui';
import { countryName, formatMoney, formatNumber } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useId, type ReactNode } from 'react';

import { useT } from '../lib/i18n';
import {
  educationGpaError, GPA_SCALES, gpaPreview, langError, nextIntakeYears, TESTS, type Draft, type EduDraft, type StepKey, type TestKey,
} from '../lib/onboarding';

export interface StepProps {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  countries: Country[];
  fields: string[];
  regions: string[];
}

function Group({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="st-group">
      <legend className="st-group__label">{label}</legend>
      {hint && <p className="st-group__hint">{hint}</p>}
      {children}
    </fieldset>
  );
}

// ------------------------------------------------------------------ 1 · basics
function Basics({ draft, set, countries }: StepProps) {
  const { t, locale } = useT();
  const api = useApi();
  const dob = useId();
  const legal = useQuery({
    queryKey: ['legalization', draft.nationality, 'TRANSCRIPT'],
    queryFn: () => api.catalog.legalizationPath(draft.nationality, 'TRANSCRIPT'),
    enabled: draft.nationality.length === 2,
    staleTime: 3_600_000,
  });
  const country = countries.find((c) => c.code === draft.nationality);
  return (
    <div className="hg-stack" style={{ '--hg-gap': '22px' } as React.CSSProperties}>
      <Group label={t('onboarding.basics.nationality')}>
        <CountrySelect countries={countries} value={draft.nationality} onChange={(v) => set({ nationality: v, residence_country: draft.residence_country || v })} label={t('onboarding.basics.nationality')} />
      </Group>
      <Group label={t('onboarding.basics.residence')} hint={t('onboarding.basics.residenceHint')}>
        <CountrySelect countries={countries} value={draft.residence_country} onChange={(v) => set({ residence_country: v })} label={t('onboarding.basics.residence')} />
      </Group>
      <Field label={t('onboarding.basics.dob')} htmlFor={dob} optional hint={t('onboarding.basics.dobHint')}>
        <Input id={dob} type="date" value={draft.date_of_birth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ date_of_birth: e.target.value })} />
      </Field>
      {legal.data && legal.data.path !== 'NONE' && country && (
        <Callout tone="info" title={t('onboarding.basics.legalTitle')}>
          <span style={{ display: 'block' }}>
            {t('onboarding.basics.legalText', { country: countryName(country.code, locale), path: t(`common:legalization.${legal.data.path}`) })}
          </span>
          {legal.data.note && <span style={{ display: 'block', marginTop: 6 }}>{legal.data.note}</span>}
          <span style={{ display: 'block', marginTop: 6 }}>
            <FreshnessBadge data={{ source_url: legal.data.source_url ?? null, verified_at: legal.data.verified_at ?? null, verification_status: legal.data.verification_status ?? (legal.data.verified ? 'CURRENT' : null) }} />
          </span>
        </Callout>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ 2 · goals
const DEGREE_OPTIONS: { value: DegreeLevel; icon: ReactNode }[] = [
  { value: 'LANGUAGE', icon: <Languages /> },
  { value: 'ASSOCIATE', icon: <School /> },
  { value: 'BACHELOR', icon: <GraduationCap /> },
  { value: 'TRANSFER', icon: <Shuffle /> },
  { value: 'MASTER', icon: <BookOpen /> },
  { value: 'DOCTORATE', icon: <Library /> },
];

function Goals({ draft, set, fields }: StepProps) {
  const { t } = useT();
  const years = nextIntakeYears();
  if (draft.target_intake_year && !years.includes(draft.target_intake_year)) years.unshift(draft.target_intake_year);
  const toggleField = (f: string) => set({ desired_fields: draft.desired_fields.includes(f) ? draft.desired_fields.filter((x) => x !== f) : [...draft.desired_fields, f] });
  return (
    <div className="hg-stack" style={{ '--hg-gap': '26px' } as React.CSSProperties}>
      <Group label={t('onboarding.goals.degree')}>
        <OptionCards
          label={t('onboarding.goals.degree')}
          min={230}
          value={draft.target_degree || null}
          onChange={(v) => set({ target_degree: v as DegreeLevel })}
          options={DEGREE_OPTIONS.map((o) => ({ value: o.value, icon: o.icon, label: t(`common:degree.${o.value}`), sub: t(`onboarding.goals.degreeSub.${o.value}`) }))}
        />
      </Group>
      <Group label={t('onboarding.goals.fields')} hint={t('onboarding.goals.fieldsHint')}>
        <div className="hg-row-wrap" role="group" aria-label={t('onboarding.goals.fields')}>
          {fields.map((f) => (
            <Chip key={f} pressed={draft.desired_fields.includes(f)} onClick={() => toggleField(f)}>{t(`common:field.${f}`, { defaultValue: f })}</Chip>
          ))}
        </div>
      </Group>
      <Group label={t('onboarding.goals.intake')} hint={t('onboarding.goals.intakeHint')}>
        <div className="hg-row-wrap">
          <Segmented
            label={t('onboarding.goals.year')}
            value={draft.target_intake_year ? String(draft.target_intake_year) : ''}
            onChange={(v) => set({ target_intake_year: Number(v) })}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
          <Segmented
            label={t('onboarding.goals.term')}
            value={draft.target_intake_term}
            onChange={(v) => set({ target_intake_term: v as Draft['target_intake_term'] })}
            options={(['SPRING', 'FALL'] as const).map((v) => ({ value: v, label: t(`onboarding.goals.termLabel.${v}`) }))}
          />
        </div>
      </Group>
    </div>
  );
}

// ------------------------------------------------------------------ 3 · education
const EDU_LEVELS: { value: Exclude<EduDraft['level'], ''>; icon: ReactNode }[] = [
  { value: 'HIGH_SCHOOL', icon: <School /> },
  { value: 'ASSOCIATE', icon: <Building /> },
  { value: 'BACHELOR', icon: <GraduationCap /> },
  { value: 'MASTER', icon: <BookOpen /> },
];

function Education({ draft, set, countries }: StepProps) {
  const { t, locale } = useT();
  const ids = { inst: useId(), major: useId(), year: useId(), gpa: useId(), scale: useId() };
  const e = draft.edu;
  const setE = (patch: Partial<EduDraft>) => set({ edu: { ...e, ...patch } });
  const pct = gpaPreview(e);
  const gpaErr = educationGpaError(e);
  return (
    <div className="hg-stack" style={{ '--hg-gap': '24px' } as React.CSSProperties}>
      <Group label={t('onboarding.education.level')}>
        <OptionCards
          label={t('onboarding.education.level')}
          min={200}
          value={e.level || null}
          onChange={(v) => setE({ level: v as EduDraft['level'] })}
          options={EDU_LEVELS.map((o) => ({ value: o.value, icon: o.icon, label: t(`onboarding.education.levels.${o.value}`) }))}
        />
      </Group>
      <div className="st-form-grid">
        <Field label={t('onboarding.education.institution')} htmlFor={ids.inst}>
          <Input id={ids.inst} value={e.institution} onChange={(ev) => setE({ institution: ev.target.value })} placeholder={t('onboarding.education.institutionPh')} autoComplete="organization" />
        </Field>
        <Field label={t('onboarding.education.country')}>
          <CountrySelect countries={countries} value={e.country} onChange={(v) => setE({ country: v })} label={t('onboarding.education.country')} />
        </Field>
        <Field label={t('onboarding.education.major')} htmlFor={ids.major} optional>
          <Input id={ids.major} value={e.major} onChange={(ev) => setE({ major: ev.target.value })} />
        </Field>
        <Field label={t('onboarding.education.gradYear')} htmlFor={ids.year} optional>
          <Input id={ids.year} inputMode="numeric" value={e.graduation_year} onChange={(ev) => setE({ graduation_year: ev.target.value.replace(/[^0-9]/g, '').slice(0, 4) })} placeholder="2025" />
        </Field>
      </div>
      <Group label={t('onboarding.education.status')}>
        <OptionCards
          label={t('onboarding.education.status')}
          min={170}
          value={e.graduation_status || null}
          onChange={(v) => setE({ graduation_status: v as EduDraft['graduation_status'] })}
          options={(['GRADUATED', 'EXPECTED', 'IN_PROGRESS'] as const).map((v) => ({ value: v, label: t(`onboarding.education.statuses.${v}`) }))}
        />
      </Group>
      <Group label={t('onboarding.education.gpa')} hint={t('onboarding.education.gpaHint')}>
        <div className="st-gpa">
          <Field label={t('onboarding.education.gpaValue')} htmlFor={ids.gpa} error={gpaErr ?? undefined}>
            <Input id={ids.gpa} inputMode="decimal" value={e.gpa_value} invalid={!!gpaErr} onChange={(ev) => setE({ gpa_value: ev.target.value.replace(/[^0-9.,]/g, '') })} placeholder="8.4" />
          </Field>
          <span className="st-gpa__slash" aria-hidden>/</span>
          <Field label={t('onboarding.education.gpaScale')} htmlFor={ids.scale}>
            <Select id={ids.scale} value={e.gpa_scale_max} onChange={(ev) => setE({ gpa_scale_max: ev.target.value })}>
              <option value="">{t('common:form.selectPlaceholder')}</option>
              {GPA_SCALES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <div className="st-gpa__preview" aria-live="polite">
            {pct !== null ? (
              <>
                <span className="hg-subtle hg-xs">{t('onboarding.education.normalized')}</span>
                <strong className="hg-num">{e.gpa_value} / {e.gpa_scale_max} → {formatNumber(pct, locale, { maximumFractionDigits: 1 })}%</strong>
              </>
            ) : <span className="hg-subtle hg-xs">{t('onboarding.education.previewEmpty')}</span>}
          </div>
        </div>
        <p className="st-group__hint" style={{ marginTop: 10 }}>{t('onboarding.education.method')}</p>
      </Group>
    </div>
  );
}

// ------------------------------------------------------------------ 4 · language
const SELF_LEVELS = ['NONE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'NATIVE'];
const TEST_MAX: Record<TestKey, string> = { TOPIK: '1–6', IELTS: '0–9', TOEFL_IBT: '0–120' };

function Language({ draft, set }: StepProps) {
  const { t } = useT();
  const setL = (k: TestKey, patch: Partial<Draft['langs'][TestKey]>) => set({ langs: { ...draft.langs, [k]: { ...draft.langs[k], ...patch } } });
  const selected = TESTS.filter((k) => draft.langs[k].selected);
  return (
    <div className="hg-stack" style={{ '--hg-gap': '24px' } as React.CSSProperties}>
      <Group label={t('onboarding.language.tests')} hint={t('onboarding.language.testsHint')}>
        <OptionCards
          multiple
          label={t('onboarding.language.tests')}
          min={160}
          value={selected}
          onChange={(v) => {
            const next = new Set(v as TestKey[]);
            set({ langs: Object.fromEntries(TESTS.map((k) => [k, { ...draft.langs[k], selected: next.has(k) }])) as Draft['langs'] });
          }}
          options={TESTS.map((k) => ({ value: k, label: t(`onboarding.language.test.${k}`), sub: t(`onboarding.language.testSub.${k}`) }))}
        />
      </Group>
      {selected.map((k) => {
        const l = draft.langs[k];
        const err = langError(k, l);
        return (
          <div key={k} className="st-lang-row">
            <div className="hg-strong">{t(`onboarding.language.test.${k}`)}</div>
            <Segmented
              label={t(`onboarding.language.test.${k}`)}
              value={l.planned ? 'planned' : 'have'}
              onChange={(v) => setL(k, { planned: v === 'planned' })}
              options={[{ value: 'have', label: t('onboarding.language.have') }, { value: 'planned', label: t('onboarding.language.planning') }]}
            />
            {!l.planned && (
              <Field label={t('onboarding.language.score', { range: TEST_MAX[k] })} error={err ?? undefined}>
                <Input inputMode="decimal" value={l.score} invalid={!!err} onChange={(e) => setL(k, { score: e.target.value.replace(/[^0-9.]/g, '') })} style={{ maxWidth: 160 }} />
              </Field>
            )}
          </div>
        );
      })}
      <Group label={t('onboarding.language.korean')}>
        <OptionCards label={t('onboarding.language.korean')} min={140} value={draft.korean_self_level || null} onChange={(v) => set({ korean_self_level: v as string })}
          options={SELF_LEVELS.map((v) => ({ value: v, label: t(`onboarding.language.level.${v}`) }))} />
      </Group>
      <Group label={t('onboarding.language.english')}>
        <OptionCards label={t('onboarding.language.english')} min={140} value={draft.english_self_level || null} onChange={(v) => set({ english_self_level: v as string })}
          options={SELF_LEVELS.map((v) => ({ value: v, label: t(`onboarding.language.level.${v}`) }))} />
      </Group>
    </div>
  );
}

// ------------------------------------------------------------------ 5 · preferences
export const BUDGETS = [12_000_000, 18_000_000, 24_000_000, 30_000_000, 40_000_000];

function Preferences({ draft, set, regions }: StepProps) {
  const { t, locale } = useT();
  const money = (v: number) => formatMoney(v, 'KRW', locale, { compact: true });
  const toggleRegion = (r: string) => set({ preferred_regions: draft.preferred_regions.includes(r) ? draft.preferred_regions.filter((x) => x !== r) : [...draft.preferred_regions, r] });
  return (
    <div className="hg-stack" style={{ '--hg-gap': '26px' } as React.CSSProperties}>
      <Group label={t('onboarding.preferences.budget')} hint={t('onboarding.preferences.budgetHint')}>
        <OptionCards
          label={t('onboarding.preferences.budget')}
          min={170}
          value={draft.annual_budget_krw ? String(draft.annual_budget_krw) : null}
          onChange={(v) => set({ annual_budget_krw: Number(v) })}
          options={BUDGETS.map((b, i) => ({
            value: String(b),
            label: i === BUDGETS.length - 1 ? t('onboarding.preferences.budgetOver', { amount: money(BUDGETS[i - 1]) }) : t('onboarding.preferences.budgetUpTo', { amount: money(b) }),
            sub: t('onboarding.preferences.perMonth', { amount: money(Math.round(b / 12 / 10_000) * 10_000) }),
          }))}
        />
      </Group>
      <Group label={t('onboarding.preferences.scholarship')}>
        <OptionCards
          label={t('onboarding.preferences.scholarship')}
          min={220}
          value={draft.needs_scholarship === null ? null : draft.needs_scholarship ? 'yes' : 'no'}
          onChange={(v) => set({ needs_scholarship: v === 'yes' })}
          options={[
            { value: 'yes', icon: <HandCoins />, label: t('onboarding.preferences.scholarshipYes'), sub: t('onboarding.preferences.scholarshipYesSub') },
            { value: 'no', icon: <Briefcase />, label: t('onboarding.preferences.scholarshipNo') },
          ]}
        />
      </Group>
      <Group label={t('onboarding.preferences.housing')}>
        <OptionCards
          label={t('onboarding.preferences.housing')}
          min={200}
          value={draft.housing_preference || null}
          onChange={(v) => set({ housing_preference: v as string })}
          options={[
            { value: 'DORM', icon: <Building2 />, label: t('onboarding.preferences.housingOpt.DORM'), sub: t('onboarding.preferences.housingSub.DORM') },
            { value: 'OFF_CAMPUS', icon: <Home />, label: t('onboarding.preferences.housingOpt.OFF_CAMPUS') },
            { value: 'NO_PREFERENCE', icon: <Shuffle />, label: t('onboarding.preferences.housingOpt.NO_PREFERENCE') },
          ]}
        />
      </Group>
      <Group label={t('onboarding.preferences.regions')} hint={t('onboarding.preferences.regionsHint')}>
        <div className="hg-row-wrap" role="group" aria-label={t('onboarding.preferences.regions')}>
          {regions.map((r) => (
            <Chip key={r} icon={<MapPin />} pressed={draft.preferred_regions.includes(r)} onClick={() => toggleRegion(r)}>{t(`common:region.${r}`, { defaultValue: r })}</Chip>
          ))}
        </div>
      </Group>
    </div>
  );
}

// ------------------------------------------------------------------ 6 · passport & visa
const VISAS = ['NONE', 'D-2', 'D-4', 'C-3', 'E-7', 'F', 'OTHER'];

function Passport({ draft, set }: StepProps) {
  const { t } = useT();
  const ids = { exp: useId(), num: useId() };
  return (
    <div className="hg-stack" style={{ '--hg-gap': '24px' } as React.CSSProperties}>
      <Group label={t('onboarding.passport.has')}>
        <OptionCards
          label={t('onboarding.passport.has')}
          min={200}
          value={draft.has_passport === null ? null : draft.has_passport ? 'yes' : 'no'}
          onChange={(v) => set({ has_passport: v === 'yes' })}
          options={[
            { value: 'yes', icon: <Plane />, label: t('onboarding.passport.yes') },
            { value: 'no', icon: <CalendarClock />, label: t('onboarding.passport.no'), sub: t('onboarding.passport.noSub') },
          ]}
        />
      </Group>
      {draft.has_passport && (
        <div className="st-form-grid">
          <Field label={t('onboarding.passport.expiry')} htmlFor={ids.exp} hint={t('onboarding.passport.expiryHint')}>
            <Input id={ids.exp} type="date" value={draft.passport_expiry} onChange={(e) => set({ passport_expiry: e.target.value })} />
          </Field>
          <Field label={t('onboarding.passport.number')} htmlFor={ids.num} optional hint={t('onboarding.passport.numberHint')}>
            <Input id={ids.num} value={draft.passport_number} autoComplete="off" onChange={(e) => set({ passport_number: e.target.value.toUpperCase().slice(0, 20) })} />
          </Field>
        </div>
      )}
      <Group label={t('onboarding.passport.inKorea')}>
        <OptionCards
          label={t('onboarding.passport.inKorea')}
          min={200}
          value={draft.in_korea_now === null ? null : draft.in_korea_now ? 'yes' : 'no'}
          onChange={(v) => set({ in_korea_now: v === 'yes' })}
          options={[{ value: 'no', label: t('onboarding.passport.inKoreaNo') }, { value: 'yes', label: t('onboarding.passport.inKoreaYes') }]}
        />
      </Group>
      {draft.in_korea_now && (
        <Group label={t('onboarding.passport.currentVisa')}>
          <OptionCards label={t('onboarding.passport.currentVisa')} min={120} value={draft.current_korean_visa || null} onChange={(v) => set({ current_korean_visa: v as string })}
            options={VISAS.filter((v) => v !== 'NONE').map((v) => ({ value: v, label: t(`onboarding.passport.visa.${v}`) }))} />
        </Group>
      )}
      <Group label={t('onboarding.passport.previousVisa')} hint={t('onboarding.passport.previousHint')}>
        <OptionCards label={t('onboarding.passport.previousVisa')} min={120} value={draft.previous_korean_visa || null} onChange={(v) => set({ previous_korean_visa: v as string })}
          options={VISAS.map((v) => ({ value: v, label: t(`onboarding.passport.visa.${v}`) }))} />
      </Group>
    </div>
  );
}

// ------------------------------------------------------------------ 7 · sponsor & goal
const SPONSORS: { value: string; icon: ReactNode }[] = [
  { value: 'PARENTS', icon: <Users /> },
  { value: 'SELF', icon: <User /> },
  { value: 'RELATIVE', icon: <Baby /> },
  { value: 'SCHOLARSHIP', icon: <HandCoins /> },
  { value: 'EMPLOYER', icon: <Briefcase /> },
  { value: 'OTHER', icon: <NotebookPen /> },
];

function Sponsor({ draft, set }: StepProps) {
  const { t } = useT();
  const goal = useId();
  return (
    <div className="hg-stack" style={{ '--hg-gap': '24px' } as React.CSSProperties}>
      <Group label={t('onboarding.sponsor.who')} hint={t('onboarding.sponsor.whoHint')}>
        <OptionCards label={t('onboarding.sponsor.who')} min={180} value={draft.financial_sponsor || null} onChange={(v) => set({ financial_sponsor: v as string })}
          options={SPONSORS.map((o) => ({ value: o.value, icon: o.icon, label: t(`onboarding.sponsor.option.${o.value}`) }))} />
      </Group>
      <Field label={t('onboarding.sponsor.goal')} htmlFor={goal} optional hint={t('onboarding.sponsor.goalHint')}>
        <Textarea id={goal} rows={4} maxLength={2000} value={draft.career_goal} onChange={(e) => set({ career_goal: e.target.value })} placeholder={t('onboarding.sponsor.goalPh')} />
      </Field>
    </div>
  );
}

const VIEWS: Record<StepKey, (p: StepProps) => ReactNode> = {
  basics: Basics, goals: Goals, education: Education, language: Language, preferences: Preferences, passport: Passport, sponsor: Sponsor,
};

export function StepView({ step, loading, ...props }: StepProps & { step: StepKey; loading?: boolean }) {
  if (loading) return <div className="hg-stack"><Skeleton h={56} /><Skeleton h={56} /><Skeleton h={56} /></div>;
  const View = VIEWS[step];
  return <View {...props} />;
}
