import { useLocale } from '@hangyul/i18n';
import { formatNumber, formatPercent } from '@hangyul/utils';
import type { ReactNode } from 'react';

/** Conversion funnel (pure CSS — no chart library). Each row can link to the affected records. */
export function Funnel({ steps, onSelect, title }: { steps: { key: string; label: ReactNode; count: number; note?: string }[]; onSelect?: (key: string) => void; title: string }) {
  const { locale } = useLocale('common');
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <div className="hg-funnel" role="list" aria-label={title}>
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null;
        const conv = prev ? s.count / prev : null;
        const label = onSelect ? <button type="button" className="hg-btn--link" style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }} onClick={() => onSelect(s.key)}>{s.label}</button> : s.label;
        return (
          <div className="hg-funnel__row" role="listitem" key={s.key} title={s.note}>
            <span className="hg-truncate hg-strong" style={{ fontSize: 13 }}>{label}</span>
            <div className="hg-funnel__bar"><div className="hg-funnel__fill" style={{ width: `${(s.count / max) * 100}%`, opacity: 1 - i * 0.055 }} /></div>
            <div className="hg-funnel__conv">
              <strong style={{ color: 'var(--hg-text)', fontSize: 14 }}>{formatNumber(s.count, locale)}</strong>
              {conv !== null && prev ? <div>{formatPercent(conv, locale)}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
