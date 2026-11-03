import { useLocale } from '@hangyul/i18n';
import type { AdmissionsFunnel as Funnel } from '@hangyul/types';
import { InfoTip } from '@hangyul/ui';
import { cx, formatNumber, formatPercent } from '@hangyul/utils';
import { Link } from 'react-router';

/** Phase colour per step (index-10 "My Courses" inline progress): review · offer · arrival. */
const PHASE: Record<string, 'primary' | 'success' | 'teal'> = {
  SUBMITTED: 'primary', REVIEWED: 'primary', OFFERED: 'success', ACCEPTED: 'success', TUITION_PAID: 'success', VISA_ISSUED: 'teal', ARRIVED: 'teal', ENROLLED: 'teal',
};

/** The step with the lowest rated conversion — "where are students dropping?". Withheld (n < min) steps never qualify. */
export function largestDrop(data: Funnel): string | null {
  let worst: { key: string; v: number } | null = null;
  data.steps.forEach((s) => {
    const c = s.conversion;
    if (!c || c.insufficient_data || c.value === null || c.value >= 1) return;
    if (!worst || c.value < worst.v) worst = { key: s.key, v: c.value };
  });
  return (worst as { key: string } | null)?.key ?? null;
}

/**
 * Submitted → reviewed → offered → accepted → tuition paid → visa issued → arrived → enrolled (unified metrics service).
 * One population (this university's submitted applications), so each step's conversion is honest.
 * Conversions with fewer than `min_denominator` records are withheld, never shown as a noisy percentage.
 * V7: YNEX table + inline progress (index-10), phase colours, the largest rated drop marked in text.
 */
/** V8: `linkFor(step)` makes each step's count open exactly the applications that reached it (same filters). */
export function AdmissionsFunnel({ data, linkFor, dense }: { data: Funnel; linkFor?: (step: string) => string | undefined; dense?: boolean }) {
  const { t, locale } = useLocale(['university', 'common']);
  const max = Math.max(1, data.steps[0]?.count ?? 0);
  const drop = largestDrop(data);
  return (
    <div className={cx('table-responsive uv7-funnelwrap', dense && 'uv15-funnel--dense')} tabIndex={0} role="region" aria-label={t('university:af.title')}>
      <table className="table mb-0 uv7-funnel">
        <caption className="hg-sr-only">{t('university:af.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('university:af.step')}</th>
            <th scope="col" className="uv7-funnel__bar"><span className="hg-sr-only">{t('university:v7.funnel.share')}</span></th>
            <th scope="col" className="text-end">{t('university:af.applications')}</th>
            <th scope="col" className="text-end">{t('university:af.fromPrevious')}</th>
          </tr>
        </thead>
        <tbody>
          {data.steps.map((s) => {
            const c = s.conversion;
            const isDrop = s.key === drop;
            return (
              <tr key={s.key} data-drop={isDrop || undefined}>
                <th scope="row" className="fw-semibold">
                  <span className="d-inline-flex align-items-center gap-1">
                    <span className={cx('uv7-dot', `bg-${PHASE[s.key] ?? 'primary'}`)} aria-hidden />
                    {t(`university:af.stepName.${s.key}`)}
                    <InfoTip text={s.definition ?? t(`university:af.stepDef.${s.key}`)} label={t('university:kpi.definitionOf', { label: t(`university:af.stepName.${s.key}`) })} />
                  </span>
                </th>
                <td className="uv7-funnel__bar" aria-hidden>
                  <div className="progress progress-xs">
                    <div className={cx('progress-bar', `bg-${PHASE[s.key] ?? 'primary'}`)} style={{ width: `${(s.count / max) * 100}%` }} />
                  </div>
                </td>
                <td className="text-end fw-semibold fs-15 uv7-num">{(() => {
                  const to = s.count > 0 ? linkFor?.(s.key) : undefined;
                  return to ? <Link to={to} aria-label={t('university:v8.an.openStep', { step: t(`university:af.stepName.${s.key}`), n: formatNumber(s.count, locale) })}>{formatNumber(s.count, locale)}</Link> : formatNumber(s.count, locale);
                })()}</td>
                <td className="text-end">
                  {c === null ? <span className="text-muted uv7-nodata">—</span>
                    : c.insufficient_data
                      ? <span className="text-muted fs-12" title={t('university:kpi.insufficientDetail', { n: c.denominator, min: data.min_denominator })}>
                          {t('university:af.lowN')}
                          {/* V15 dense (Overview): the "n of N" repeat is dropped. The numerator is already
                              the count in the column to its left and the denominator is the row above it, so
                              in a narrow column it was wrapping every row to two lines to restate numbers
                              the reader can see. It stays in the cell's title, and in full on Analytics. */}
                          {!dense && <span className="uv7-rate__n">{t('university:metric.ofN', { num: formatNumber(c.numerator, locale), den: formatNumber(c.denominator, locale) })}</span>}
                        </span>
                      : (
                        <span className="d-inline-flex align-items-center gap-2 justify-content-end flex-wrap">
                          {isDrop && <span className="badge bg-warning-transparent">{t('university:v7.funnel.drop')}</span>}
                          <span className="fw-semibold" title={t('university:metric.ofN', { num: formatNumber(c.numerator, locale), den: formatNumber(c.denominator, locale) })}>{formatPercent(c.value, locale, 0)}</span>
                          {!dense && <span className="uv7-rate__n">{t('university:metric.ofN', { num: formatNumber(c.numerator, locale), den: formatNumber(c.denominator, locale) })}</span>}
                        </span>
                      )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
