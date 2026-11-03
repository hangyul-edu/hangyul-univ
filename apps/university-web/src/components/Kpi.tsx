import { ArrowDownRight, ArrowUpRight, Info } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { cx, type Tone } from '@hangyul/utils';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';

import { MIN_N } from '../lib/metrics';

/** Accessible definition hint: visible on hover *and* keyboard focus, announced via aria-describedby. */
export function DefinitionHint({ text, label }: { text: string; label: string }) {
  const id = useId();
  return (
    <span className="uc-hint">
      <button type="button" className="uc-hint__btn" aria-label={label} aria-describedby={id}>
        <Info aria-hidden size={14} />
      </button>
      <span role="tooltip" id={id} className="uc-hint__tip">{text}</span>
    </span>
  );
}

export interface KpiTileProps {
  label: string;
  value: ReactNode;
  definition?: string;
  /** API said the sample is too small: show an intentional "not enough data" state, never a number. */
  insufficient?: boolean;
  /** Sample size behind the value (e.g. denominator). */
  sample?: number;
  foot?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  to?: string;
  delta?: number | null;
  invertDelta?: boolean;
  emphasis?: boolean;
}

export function KpiTile({ label, value, definition, insufficient, sample, foot, icon, tone = 'brand', to, delta, invertDelta, emphasis }: KpiTileProps) {
  const { t } = useLocale(['university', 'common']);
  const up = (delta ?? 0) >= 0;
  const good = invertDelta ? !up : up;
  const body = (
    <div className={cx('hg-card hg-stat uc-kpi', emphasis && 'uc-kpi--emphasis', insufficient && 'uc-kpi--insufficient')} data-testid="kpi-tile">
      <div className="hg-row hg-between" style={{ alignItems: 'flex-start', gap: 8 }}>
        <div className="hg-stat__label">
          <span>{label}</span>
          {definition && <DefinitionHint text={definition} label={t('university:kpi.definitionOf', { label })} />}
        </div>
        {icon && <div className={cx('hg-stat__icon', `hg-tone-${tone}`)} aria-hidden>{icon}</div>}
      </div>
      {insufficient ? (
        <div className="uc-kpi__insufficient">
          <span className="uc-kpi__dash" aria-hidden>—</span>
          <span className="uc-kpi__note">{t('common:states.insufficientData')}</span>
        </div>
      ) : (
        <div className="hg-stat__value uc-kpi__value">{value}</div>
      )}
      <div className="hg-stat__foot">
        {delta !== undefined && delta !== null && !insufficient && (
          <span className={cx('hg-delta', good ? 'hg-delta--up' : 'hg-delta--down')}>
            {up ? <ArrowUpRight aria-hidden size={14} /> : <ArrowDownRight aria-hidden size={14} />}
            {Math.abs(delta)}%
          </span>
        )}
        {insufficient
          ? <span>{t('university:kpi.insufficientDetail', { n: sample ?? 0, min: MIN_N })}</span>
          : sample !== undefined ? <span>{t('university:kpi.sample', { n: sample })}</span> : null}
        {foot}
        {to && <Link to={to} className="uc-kpi__link">{t('university:kpi.viewList')}<span aria-hidden className="hg-flip-rtl"> →</span><span className="hg-sr-only"> — {label}</span></Link>}
      </div>
    </div>
  );
  return body;
}

/** Big honest placeholder used where a chart/table has too little data. */
export function InsufficientBlock({ n, min = MIN_N, children }: { n: number; min?: number; children?: ReactNode }) {
  const { t } = useLocale(['university', 'common']);
  return (
    <div className="uc-insufficient" role="note">
      <div className="uc-insufficient__title">{t('common:states.insufficientData')}</div>
      <div className="hg-muted hg-small">{t('university:kpi.insufficientDetail', { n, min })}</div>
      {children}
    </div>
  );
}
