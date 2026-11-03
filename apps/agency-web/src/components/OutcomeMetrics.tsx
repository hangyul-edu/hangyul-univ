import { useAuth } from '@hangyul/auth';
import type { OutcomeMetric } from '@hangyul/types';
import { QueryState } from '@hangyul/ui';
import { YCard } from '@hangyul/ynex-ui';
import { formatNumber, formatPercent } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';

import { useT } from './bits';

const GROUPS: OutcomeMetric['group'][] = ['admission', 'documents', 'writing', 'services'];

/** V5 "Outcome quality": what actually changes students' results — each figure with its population and definition
 *  (shown, not hidden in a tooltip); small samples are withheld, never estimated. */
export function OutcomeMetrics({ days }: { days: number }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const q = useQuery({ queryKey: ['agency', 'outcome-metrics', days], queryFn: () => api.agency.outcomeMetrics(days) });
  const value = (m: OutcomeMetric) => {
    if (m.withheld || m.value === null) return <span className="hg-subtle">{t('states.insufficientData')}</span>;
    if (m.unit === 'share') return formatPercent(m.value, locale);
    if (m.unit === 'days' || m.unit === 'hours' || m.unit === 'rounds') return t(`outcome.unit.${m.unit}`, { n: formatNumber(m.value, locale, { maximumFractionDigits: 1 }) });
    return formatNumber(m.value, locale, { maximumFractionDigits: 2 });
  };
  const basis = (m: OutcomeMetric) => (m.denominator !== null ? t('outcome.ofN', { num: m.numerator ?? 0, den: m.denominator }) : m.n !== null ? t('outcome.n', { count: m.n }) : '');
  return (
    <YCard title={t('outcome.title')} flush footer={<p className="text-muted fs-12 mb-0">{t('outcome.sub', { count: days })}</p>}>
      <QueryState query={q}>
        {(d) => (
          <div className="table-responsive">
            <table className="hg-table ag7-table">
              <thead><tr><th>{t('outcome.metric')}</th><th className="hg-table__num">{t('outcome.value')}</th><th className="hg-table__num">{t('outcome.basis')}</th></tr></thead>
              {GROUPS.map((g) => (
                <tbody key={g}>
                  <tr><th colSpan={3} scope="colgroup" className="hg-small">{t(`outcome.group.${g}`)}</th></tr>
                  {d.metrics.filter((m) => m.group === g).map((m) => (
                    <tr key={m.key}>
                      <td><div>{t(`outcome.key.${m.key}`)}</div><div className="hg-xs hg-subtle">{m.definition}</div></td>
                      <td className="hg-table__num">{value(m)}</td>
                      <td className="hg-table__num hg-subtle">{basis(m)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
            <p className="hg-xs hg-subtle" style={{ padding: '8px 16px' }}>{t('outcome.foot', { min: d.min_n })}</p>
          </div>
        )}
      </QueryState>
    </YCard>
  );
}
