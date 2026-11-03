import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { AppText, ListGroup, MetricRow, QueryState, Screen, SectionTitle, useFormat } from '@hangyul/mobile-ui';
import type { RateKpi } from '@hangyul/types';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';

/** After admission: are Hangyul students staying and graduating? Rates only where the sample is large enough. */
export default function StudentsScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const q = useQuery({ queryKey: ['university', 'metrics', ''], queryFn: () => api.university.metrics() });
  const rate = (r: RateKpi & { definition?: string }, label: string, explain = true) => (
    <MetricRow label={label} value={r.value === null ? '—' : f.percent(r.value)} detail={t('v3.uni.nOfD', { n: r.numerator, d: r.denominator })}
      definition={explain ? r.definition ?? null : null} insufficient={r.insufficient_data} insufficientLabel={t('v3.uni.tooFew')} />
  );
  return (
    <Screen title={t('v3.uni.tab.students')} onRefresh={() => q.refetch()}>
      <QueryState query={q}>
        {(m) => (
          <>
            <AppText variant="body">{t('v3.uni.cohortIntro', { count: m.cohorts.total.enrolled })}</AppText>
            <View style={{ gap: 8 }}>
              <SectionTitle title={t('v3.uni.allCohorts')} />
              <ListGroup>
                {rate(m.cohorts.total.retention, t('v3.uni.retention'))}
                {rate(m.cohorts.total.graduation, t('v3.uni.graduation'))}
              </ListGroup>
            </View>
            {m.cohorts.cohorts.map((c) => (
              <View key={c.cohort} style={{ gap: 8 }}>
                <SectionTitle title={t('v3.uni.cohort', { label: c.label, count: c.enrolled })} />
                <ListGroup>
                  {rate(c.retention, t('v3.uni.retention'), false)}
                  {rate(c.graduation, t('v3.uni.graduation'), false)}
                </ListGroup>
              </View>
            ))}
            <AppText variant="caption">{t('v3.uni.cohortNote', { min: m.cohorts.min_denominator, date: f.date(m.cohorts.as_of) })}</AppText>
          </>
        )}
      </QueryState>
    </Screen>
  );
}
