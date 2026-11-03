import { useLocale } from '@hangyul/i18n';
import type { MetricPopulation } from '@hangyul/types';
import { formatDate, formatNumber } from '@hangyul/utils';

import { intakeText } from '../lib/format';

/** States exactly which population and time range every number on a panel describes. */
export function PopulationNote({ pop }: { pop: MetricPopulation }) {
  const { t, locale } = useLocale(['university', 'common']);
  return (
    <span>
      {t('university:metric.population', {
        intake: pop.intake ? intakeText(pop.intake, t) : t('university:filters.allIntakes'),
        n: formatNumber(pop.size, locale),
      })}
      {pop.period.from && pop.period.to ? ` · ${t('university:metric.period', { from: formatDate(pop.period.from, locale), to: formatDate(pop.period.to, locale) })}` : ''}
    </span>
  );
}

/** Short population sentence under a section title: "Spring 2027 · 3 submitted applications". */
export function PopulationLine({ pop }: { pop: MetricPopulation }) {
  const { t, locale } = useLocale(['university', 'common']);
  return <>{t('university:v4.population', { intake: pop.intake ? intakeText(pop.intake, t) : t('university:filters.allIntakes'), count: pop.size, n: formatNumber(pop.size, locale) })}</>;
}
