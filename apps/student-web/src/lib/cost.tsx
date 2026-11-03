import type { FirstYearRange } from '@hangyul/types';

import { range, useDisplayCurrency, useFx } from './budget';
import { useT } from './i18n';

/**
 * V4 — one cost model. Every student surface shows a program's cost as
 * "First year, estimated ₩A – ₩B" (tuition + fees + housing + living, before scholarship),
 * taken from the budget service (`first_year_range_krw`). Tuition alone is labelled "Tuition / year".
 */
export function useFirstYearText() {
  const { t, locale } = useT();
  const [cur] = useDisplayCurrency();
  const fx = useFx();
  return (r: FirstYearRange | null | undefined): string =>
    r && r.low !== null ? range(r.low, r.high, cur, fx.data?.krw_per_unit, locale) : t('v4.cost.unknown');
}

/** The range alone (numbers), for tight rows where the label is given by the column / sentence. */
export function FirstYearAmount({ value }: { value: FirstYearRange | null | undefined }) {
  const text = useFirstYearText();
  return <span className="hg-num">{text(value)}</span>;
}

/** Label + range, e.g. on the program page and in compare. */
export function FirstYearCost({ value, showBasis = true }: { value: FirstYearRange | null | undefined; showBasis?: boolean }) {
  const { t } = useT();
  const text = useFirstYearText();
  return (
    <span className="v4-cost">
      <span className="v4-cost__label">{t('v4.cost.firstYear')}</span>{' '}
      <strong className="hg-num v4-cost__amount">{text(value)}</strong>
      {showBasis && value && value.low !== null && value.basis === 'SAMPLE' && <span className="v4-cost__basis"> · {t('common:freshness.unverified').toLowerCase()}</span>}
    </span>
  );
}
