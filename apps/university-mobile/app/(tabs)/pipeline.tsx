import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { AppText, ChipGroup, ListGroup, ListItem, QueryState, Screen, theme, useFormat } from '@hangyul/mobile-ui';
import { router } from 'expo-router';
import { GraduationCap } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

/** One population, one funnel: every step shows its count and conversion as "n of d". */
export default function PipelineScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const intakeLabel = (key: string, fallback: string) => { const [y, term] = key.split('-'); return y && term ? t('common:intakeLabel', { term: t(`common:term.${term}`), year: y }) : fallback; };
  // V4: one cohort by default — the intake in admissions now (API `current`), not a mix of every intake.
  const [picked, setPicked] = useState<string | null>(null);
  const base = useQuery({ queryKey: ['university', 'metrics', ''], queryFn: () => api.university.metrics() });
  const current = base.data?.intakes.find((i) => i.current)?.key ?? '';
  const intake = picked ?? current;
  const setIntake = (v: string) => setPicked(v);
  const q = useQuery({ queryKey: ['university', 'metrics', intake], queryFn: () => api.university.metrics(intake ? { intake } : undefined), enabled: base.isSuccess });
  return (
    <Screen title={t('v3.uni.tab.pipeline')} onRefresh={() => q.refetch()}>
      <QueryState query={base.isSuccess ? q : base}>
        {(m) => {
          const steps = m.pipeline.steps;
          const top = Math.max(1, ...steps.map((s) => s.count));
          return (
            <>
              {m.intakes.length ? (
                <ChipGroup options={[{ value: '', label: t('v3.uni.allIntakes') }, ...m.intakes.map((i) => ({ value: i.key, label: intakeLabel(i.key, i.label) }))]} selected={[intake]} onToggle={setIntake} />
              ) : null}
              <AppText variant="caption">{intake ? t('v3.uni.populationIntake', { count: m.pipeline.population.size, intake: intakeLabel(intake, intake) }) : t('v3.uni.populationAll', { count: m.pipeline.population.size })}{m.pipeline.population.period.from ? ` · ${f.date(m.pipeline.population.period.from)} – ${f.date(m.pipeline.population.period.to)}` : ''}</AppText>
              <ListGroup>
                {steps.map((s) => (
                  <View key={s.key} style={styles.step} accessible accessibilityLabel={`${t(`v3.uni.step.${s.key}`)}: ${s.count}. ${s.definition}`}>
                    <View style={styles.stepHead}>
                      <AppText variant="subheading" style={{ flex: 1 }}>{t(`v3.uni.step.${s.key}`, { defaultValue: s.key })}</AppText>
                      <AppText variant="heading">{s.count}</AppText>
                    </View>
                    <View style={styles.track}><View style={[styles.fill, { width: `${(s.count / top) * 100}%` }]} /></View>
                    <AppText variant="caption" color={theme.color.textTertiary}>
                      {s.conversion ? (s.conversion.insufficient_data ? t('v3.uni.convFew', { n: s.conversion.numerator, d: s.conversion.denominator }) : t('v3.uni.conv', { pct: f.percent(s.conversion.value), n: s.conversion.numerator, d: s.conversion.denominator })) : s.definition}
                    </AppText>
                  </View>
                ))}
              </ListGroup>
              <AppText variant="caption">{t('v3.uni.closed', { rejected: m.pipeline.closed.rejected, withdrawn: m.pipeline.closed.withdrawn, min: m.pipeline.min_denominator })}</AppText>
            </>
          );
        }}
      </QueryState>
      {/* V23 §274 N5: the cohort view (retention after enrolment) is the second half of 현황, one tap away. */}
      <ListGroup>
        <ListItem icon={GraduationCap} title={t('v3.uni.tab.students')} onPress={() => router.push('/cohorts')} />
      </ListGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { paddingVertical: 12, paddingHorizontal: 16, gap: 6 },
  stepHead: { flexDirection: 'row', alignItems: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: theme.color.surfaceSunken, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: theme.chart.categorical[0], borderRadius: 3 },
});
