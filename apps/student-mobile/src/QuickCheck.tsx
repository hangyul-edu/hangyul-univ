import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { AppText, Button, ChipGroup, ListGroup, ListItem, Sheet, StatusText, TextField, theme } from '@hangyul/mobile-ui';
import {
  EMPTY_FIT_ANSWERS, FIT_TIERS, fitComplete, fitGpa, GPA_SCALES, LANGUAGE_TESTS, normaliseGpa, STUDY_LEVELS,
  type FitAnswers, type FitResult, type FitTier, type LanguageTestCode, type StudyLevel, type TestFamily,
} from '@hangyul/types';
import { countryName, fitReasonText } from '@hangyul/utils';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

const COUNTRIES = ['VN', 'CN', 'UZ', 'MN', 'NP', 'MM', 'ID', 'TH', 'IN', 'BD', 'KH', 'LK', 'PH', 'KZ', 'JP', 'US'];
const TIER_TONE: Record<FitTier, 'success' | 'info' | 'neutral' | 'warning'> = { MEETS: 'success', ONE_STEP: 'warning', CHALLENGE: 'info', UNCLEAR: 'neutral' };

/**
 * V27 (REPORT §356, brief §44): the same quick fit as the web — same endpoint (`POST /public/fit`), same registry
 * (study levels incl. doctorate, GPA on the student's own scale, the language-test registry), same four honest groups
 * and the same reason vocabulary (`fitReasonText`). Never an admission probability; "추천순" is a browsing order.
 */
export function QuickCheck({ onSignup }: { onSignup?: () => void } = {}) {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<FitAnswers>({ ...EMPTY_FIT_ANSWERS, nationality: 'VN', level: 'BACHELOR', gpaScale: '4' });
  const [family, setFamily] = useState<TestFamily | 'NONE' | null>(null);
  const check = useMutation({
    mutationFn: () => api.public.fit({ nationality: a.nationality, level: a.level as StudyLevel, gpa: fitGpa(a), languages: a.languages, limit: 5 }),
  });
  const r: FitResult | undefined = check.data;
  const [code, setCode] = useState<LanguageTestCode | null>(null);
  const test = a.languages[0];
  const def = LANGUAGE_TESTS.find((d) => d.code === code);
  const levels = def?.kind === 'LEVEL' ? Array.from({ length: (def.max - def.min) / def.step + 1 }, (_, i) => def.min + i * def.step) : null;
  const gpa = fitGpa(a);
  const pct = gpa ? normaliseGpa(gpa.value, gpa.scale_max) : null;
  // A test is chosen first, its score second; the answer counts only once both are known.
  const setTest = (c: LanguageTestCode, score?: number) => { setCode(c); setA({ ...a, noLanguage: false, languages: score === undefined ? [] : [{ test: c, score }] }); };

  return (
    <View style={{ gap: 8 }}>
      <Button label={t('v3.quick.open')} variant="secondary" onPress={() => setOpen(true)} fullWidth />
      <Sheet visible={open} title={r ? t('common:fit.result.title', { count: r.total, formatted: String(r.total) }) : t('common:fit.title')} onClose={() => setOpen(false)} closeLabel={t('common:actions.close')}
        footer={r ? (
          <View style={{ gap: 8 }}>
            <Button label={t('v3.quick.createAccount')} onPress={() => onSignup?.()} fullWidth />
            <Button label={t('v3.quick.again')} variant="secondary" onPress={() => check.reset()} fullWidth />
          </View>
        ) : <Button label={t('common:fit.submit')} onPress={() => check.mutate()} loading={check.isPending} disabled={!fitComplete(a)} fullWidth />}>
        {r ? (
          <>
            <AppText variant="body" secondary>
              {FIT_TIERS.map((k) => `${t(`common:fit.tier.${k}.short`)} ${r.counts[k]}`).join(' · ')}
            </AppText>
            {r.unlock ? <AppText variant="body">{t('common:fit.unlock', { test: t(`common:fit.test.${r.unlock.test}`), min: r.unlock.min, count: r.unlock.count })}</AppText> : null}
            {(r.sections ?? []).filter((s) => s.total).map((s) => (
              <View key={s.tier} style={{ gap: 6 }}>
                <AppText variant="subheading">{`${t(`common:fit.tier.${s.tier}.title`)} ${s.total}`}</AppText>
                <ListGroup>
                  {s.items.map((it) => (
                    <ListItem key={it.slug} title={i18n.language === 'ko' || !it.name_en ? it.name_ko : it.name_en}
                      subtitle={fitReasonText(it, t)}
                      meta={t(`common:region.${it.region}`, { defaultValue: it.region })}
                      footer={<StatusText label={t(`common:fit.tier.${it.tier}.short`)} tone={TIER_TONE[it.tier]} />}
                      onPress={() => { setOpen(false); router.push(`/universities/${it.slug}`); }} />
                  ))}
                </ListGroup>
              </View>
            ))}
            <AppText variant="caption" color={theme.color.textTertiary}>{t('common:fit.order', { verified: r.verified_rule_institutions })}</AppText>
          </>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <AppText variant="subheading">{t('common:fit.q.nationality')}</AppText>
              <ChipGroup options={COUNTRIES.map((c) => ({ value: c, label: countryName(c, i18n.language) }))} selected={[a.nationality]} onToggle={(v) => setA({ ...a, nationality: v })} />
            </View>
            <View style={{ gap: 8 }}>
              <AppText variant="subheading">{t('common:fit.q.level')}</AppText>
              <ChipGroup options={STUDY_LEVELS.map((d) => ({ value: d, label: t(`common:fit.level.${d}`) }))} selected={[a.level]} onToggle={(v) => setA({ ...a, level: v as StudyLevel })} />
            </View>
            {a.level !== 'LANGUAGE' && (
              <View style={{ gap: 8 }}>
                <AppText variant="subheading">{t('common:fit.q.gpa')}</AppText>
                <TextField label={t('common:fit.gpa.value')} keyboardType="decimal-pad" value={a.gpa} placeholder={t('common:fit.gpa.placeholder')}
                  onChangeText={(v) => setA({ ...a, gpa: v.replace(',', '.').replace(/[^0-9.]/g, '').slice(0, 6) })}
                  hint={pct !== null ? t('common:fit.gpa.normalised', { value: gpa!.value, max: gpa!.scale_max, pct }) : t('common:fit.gpa.why')} />
                <AppText variant="caption" secondary>{t('common:fit.gpa.scale')}</AppText>
                <ChipGroup options={GPA_SCALES.map((s) => ({ value: String(s), label: s === 100 ? t('common:fit.gpa.percent') : t('common:fit.gpa.outOf', { max: s }) }))}
                  selected={[a.gpaScale]} onToggle={(v) => setA({ ...a, gpaScale: v })} />
              </View>
            )}
            <View style={{ gap: 8 }}>
              <AppText variant="subheading">{t('common:fit.q.language')}</AppText>
              <ChipGroup options={(['KOREAN', 'ENGLISH', 'NONE'] as const).map((f) => ({ value: f, label: t(`common:fit.family.${f}`) }))}
                selected={family ? [family] : []}
                onToggle={(f) => { setFamily(f); setCode(null); setA({ ...a, languages: [], noLanguage: f === 'NONE' }); }} />
              {family && family !== 'NONE' && (
                <ChipGroup options={LANGUAGE_TESTS.filter((d) => d.family === family).map((d) => ({ value: d.code, label: t(`common:fit.test.${d.code}`) }))}
                  selected={code ? [code] : []} onToggle={(c) => setTest(c as LanguageTestCode)} />
              )}
              {def && levels ? (
                <ChipGroup options={levels.map((l) => ({ value: String(l), label: t(`common:fit.levelValue.${def.code}`, { level: l, defaultValue: String(l) }) }))}
                  selected={test ? [String(test.score)] : []} onToggle={(v) => setTest(def.code, Number(v))} />
              ) : def ? (
                <TextField label={t('common:fit.scoreLabel')} keyboardType="decimal-pad" placeholder={`${def.min}–${def.max}`}
                  onChangeText={(v) => { const n = Number(v.replace(',', '.')); if (v && Number.isFinite(n) && n >= def.min && n <= def.max) setTest(def.code, n); }}
                  hint={!def.common ? t('common:fit.notEverywhere') : undefined} />
              ) : null}
            </View>
            {check.isError ? <AppText variant="caption" tone="danger" accessibilityRole="alert">{t('common:states.error')}</AppText> : null}
          </>
        )}
      </Sheet>
    </View>
  );
}
