import { useApi, useAuth } from '@hangyul/auth';
import type { ProfileUnlockSection, StudentProfile } from '@hangyul/types';
import { Avatar, Button, Modal, QueryState, SkeletonCard, StatusText, useToast } from '@hangyul/ui';
import { countryName, formatDate, formatMoney } from '@hangyul/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { PageIntro } from '../components/bits';
import { StepView } from '../components/ProfileSteps';
import { useT } from '../lib/i18n';
import { draftFromProfile, saveStep, stepValid, type Draft, type StepKey } from '../lib/onboarding';
import { useCountries, useProfile, useTaxonomy } from '../lib/queries';

function useSummary() {
  const { t, locale } = useT();
  const none = t('profile.notSet');
  return (step: StepKey, p: StudentProfile): { label: string; value: ReactNode }[] => {
    switch (step) {
      case 'basics': return [
        { label: t('onboarding.basics.nationality'), value: p.nationality ? countryName(p.nationality, locale) : none },
        { label: t('onboarding.basics.residence'), value: p.residence_country ? countryName(p.residence_country, locale) : none },
        { label: t('onboarding.basics.dob'), value: p.date_of_birth ? formatDate(p.date_of_birth, locale) : none },
      ];
      case 'goals': return [
        { label: t('onboarding.goals.degree'), value: p.target_degree ? t(`common:degree.${p.target_degree}`) : none },
        { label: t('onboarding.goals.fields'), value: p.desired_fields.length ? p.desired_fields.map((f) => t(`common:field.${f}`, { defaultValue: f })).join(', ') : none },
        { label: t('onboarding.goals.intake'), value: p.target_intake_year ? `${p.target_intake_term ? t(`common:term.${p.target_intake_term}`) : ''} ${p.target_intake_year}`.trim() : none },
      ];
      case 'education': {
        const e = p.educations[0];
        return e ? [
          { label: t('onboarding.education.level'), value: t(`onboarding.education.levels.${e.level}`, { defaultValue: e.level }) },
          { label: t('onboarding.education.institution'), value: `${e.institution || t('profile.institutionMissing')} · ${countryName(e.country, locale)}` },
          { label: t('onboarding.education.gpa'), value: e.gpa_value !== null && e.gpa_scale_max ? `${e.gpa_value} / ${e.gpa_scale_max} → ${e.gpa_percent ?? '—'}%` : none },
        ] : [{ label: t('onboarding.education.level'), value: none }];
      }
      case 'language': return [
        { label: t('onboarding.language.tests'), value: p.languages.length ? p.languages.map((l) => (l.is_planned ? t('profile.planned', { test: t(`onboarding.language.test.${l.test}`, { defaultValue: l.test }) }) : `${t(`onboarding.language.test.${l.test}`, { defaultValue: l.test })} ${l.score}`)).join(' · ') : none },
        { label: t('onboarding.language.korean'), value: p.korean_self_level ? t(`onboarding.language.level.${p.korean_self_level}`) : none },
        { label: t('onboarding.language.english'), value: p.english_self_level ? t(`onboarding.language.level.${p.english_self_level}`) : none },
      ];
      case 'preferences': return [
        { label: t('onboarding.preferences.budget'), value: p.annual_budget_krw ? `${formatMoney(p.annual_budget_krw, 'KRW', locale, { compact: true })}${t('units.perYear')}` : none },
        { label: t('onboarding.preferences.scholarship'), value: p.needs_scholarship === null ? none : p.needs_scholarship ? t('onboarding.preferences.scholarshipYes') : t('onboarding.preferences.scholarshipNo') },
        { label: t('onboarding.preferences.housing'), value: p.housing_preference ? t(`onboarding.preferences.housingOpt.${p.housing_preference}`) : none },
        { label: t('onboarding.preferences.regions'), value: p.preferred_regions.length ? p.preferred_regions.map((r) => t(`common:region.${r}`, { defaultValue: r })).join(', ') : t('profile.anywhere') },
      ];
      case 'passport': return [
        { label: t('onboarding.passport.has'), value: p.has_passport === null ? none : p.has_passport ? `${t('onboarding.passport.yes')}${p.passport_expiry ? ` · ${t('profile.expires', { date: formatDate(p.passport_expiry, locale) })}` : ''}${p.passport_number_masked ? ` · ${p.passport_number_masked}` : ''}` : t('onboarding.passport.no') },
        { label: t('onboarding.passport.inKorea'), value: p.in_korea_now === null ? none : p.in_korea_now ? `${t('onboarding.passport.inKoreaYes')}${p.current_korean_visa ? ` · ${p.current_korean_visa}` : ''}` : t('onboarding.passport.inKoreaNo') },
        { label: t('onboarding.passport.previousVisa'), value: p.previous_korean_visa ? t(`onboarding.passport.visa.${p.previous_korean_visa}`, { defaultValue: p.previous_korean_visa }) : none },
      ];
      case 'sponsor': return [
        { label: t('onboarding.sponsor.who'), value: p.financial_sponsor ? t(`onboarding.sponsor.option.${p.financial_sponsor}`, { defaultValue: p.financial_sponsor }) : none },
        { label: t('onboarding.sponsor.goal'), value: p.career_goal || none },
      ];
    }
  };
}

function EditModal({ step, profile, onClose }: { step: StepKey; profile: StudentProfile; onClose: () => void }) {
  const { t } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const countries = useCountries();
  const tax = useTaxonomy();
  const [draft, setDraft] = useState<Draft>(() => draftFromProfile(profile));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await saveStep(api, step, draft, profile);
      await qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['matches'] });
      toast.success(t('profile.saved'));
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} width={760} title={t(`onboarding.steps.${step}.title`)} description={t(`onboarding.steps.${step}.subtitle`)}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common:actions.cancel')}</Button><Button variant="primary" loading={busy} disabled={!stepValid(step, draft)} onClick={save}>{t('common:actions.save')}</Button></>}>
      <StepView step={step} loading={countries.isLoading || tax.isLoading} draft={draft} set={(p) => setDraft((d) => ({ ...d, ...p }))}
        countries={countries.data ?? []} fields={tax.data?.fields ?? []} regions={tax.data?.regions ?? []} />
    </Modal>
  );
}

const SECTION_OF: Record<StepKey, ProfileUnlockSection['key'][]> = {
  basics: ['basics'], goals: ['goals'], education: ['education', 'gpa'], language: ['language'], preferences: ['budget'], passport: ['documents'], sponsor: ['sponsor'],
};
/** Order: what changes your matches most comes first. */
const ORDER: StepKey[] = ['language', 'education', 'goals', 'preferences', 'basics', 'passport', 'sponsor'];

function unlockText(t: ReturnType<typeof useT>['t'], u: ProfileUnlockSection): string | null {
  const n = u.count ?? 0;
  switch (u.effect.kind) {
    case 'UNBLOCK': return n ? t('profileV3.unlock.language', { count: n }) : null;
    case 'NEXT_LEVEL': return n && u.effect.level ? t('profileV3.unlock.nextLevel', { count: n, level: u.effect.level }) : null;
    case 'CONFIRM': return n ? t(`profileV3.unlock.${u.key}`, { count: n }) : null;
    case 'FOCUS': return n ? t('profileV3.unlock.goals', { count: n }) : null;
    case 'BUDGET_FIT': return n ? t('profileV3.unlock.budget', { count: n }) : null;
    default: return t(`profileV3.unlock.${u.key}`);
  }
}

export default function Profile() {
  const { t } = useT();
  const api = useApi();
  const { session } = useAuth();
  const q = useProfile();
  const unlocks = useQuery({ queryKey: ['profile', 'unlocks'], queryFn: () => api.me.profileUnlocks(), staleTime: 60_000 });
  const summary = useSummary();
  const [sp] = useSearchParams();
  const [editing, setEditing] = useState<StepKey | null>(() => (ORDER.includes(sp.get('edit') as StepKey) ? (sp.get('edit') as StepKey) : null));
  return (
    <div className="st-page">
      <PageIntro title={t('profileV3.title')} subtitle={t('profileV3.subtitle')} />
      <QueryState query={q} skeleton={<SkeletonCard lines={8} />}>
        {(p) => {
          const steps = p.completion?.steps ?? [];
          const sections = unlocks.data?.sections ?? [];
          const missing = ORDER.filter((k) => !steps.find((s) => s.key === k)?.done);
          return (
            <>
              <div className="pf-head">
                <Avatar name={session?.user.full_name ?? ''} size={48} />
                <div style={{ minWidth: 0 }}>
                  <div className="hg-medium">{session?.user.full_name}</div>
                  <div className="hg-small hg-subtle hg-truncate">{session?.user.email}</div>
                </div>
                <p className="pf-head__state">{missing.length === 0 ? t('profileV3.allDone') : t('profileV3.left', { count: missing.length })}</p>
              </div>
              <ul className="hg-panel pf-list">
                {ORDER.map((k) => {
                  const done = !!steps.find((s) => s.key === k)?.done;
                  const lines = SECTION_OF[k].map((key) => sections.find((x) => x.key === key)).filter((u) => u && (!done || u.effect.kind === 'NEXT_LEVEL')).map((u) => unlockText(t, u!)).filter(Boolean) as string[];
                  const values = summary(k, p).filter((v) => v.value !== t('profile.notSet')).slice(0, 3);
                  return (
                    <li key={k} className="pf-row" data-done={done}>
                      <div className="pf-row__main">
                        <div className="hg-row" style={{ gap: 10 }}>
                          <h2 className="pf-row__title">{t(`profile.section.${k}`)}</h2>
                          <StatusText tone={done ? 'success' : 'neutral'} hollow={!done}>{done ? t('profileV3.done') : t('profileV3.notAdded')}</StatusText>
                        </div>
                        <p className="pf-row__why">{t(`profileV3.why.${k}`)}</p>
                        {lines.length > 0 && <p className="pf-row__unlock">{lines.join(' ')}</p>}
                        {done && values.length > 0 && <p className="pf-row__values">{values.map((v) => (typeof v.value === 'string' ? v.value : null)).filter(Boolean).join(' · ')}</p>}
                      </div>
                      {/* The accessible name has to agree with the visible one: this button said "Add" and
                          announced "Edit education", which is the kind of mismatch a sighted reviewer never
                          sees and a screen-reader user hears every time. */}
                      <Button size="sm" variant={done ? 'ghost' : 'secondary'} onClick={() => setEditing(k)}
                        aria-label={t(done ? 'profile.editSection' : 'profile.addSection', { section: t(`profile.section.${k}`) })}>
                        {done ? t('common:actions.edit') : t('profileV3.add')}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <p className="hg-small hg-subtle">{t('profileV3.privacy')}</p>
              {editing && <EditModal step={editing} profile={p} onClose={() => { setEditing(null); unlocks.refetch(); }} />}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
