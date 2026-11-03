import { ArrowRight, Columns3, X } from '@hangyul/icons';
import { Button, ButtonLink } from '@hangyul/ui';
import { Link, useLocation } from 'react-router';

import { COMPARE_MAX, useCompare } from '../lib/compare';
import { useT } from '../lib/i18n';

/** Sticky tray listing programs picked for comparison (max 4). Hidden on the compare page itself. */
export function CompareTray() {
  const { t } = useT();
  const { items, remove, clear } = useCompare();
  const { pathname } = useLocation();
  if (!items.length || pathname.startsWith('/compare') || pathname.startsWith('/messages')) return null;
  const href = `/compare?ids=${items.map((i) => i.id).join(',')}`;
  return (
    <aside className="st-tray" aria-label={t('compare.tray.label')}>
      <div className="st-tray__inner">
        <Columns3 aria-hidden className="st-tray__icon" />
        <div className="st-tray__items">
          <span className="hg-strong hg-small">{t('compare.tray.count', { count: items.length, max: COMPARE_MAX })}</span>
          <ul className="st-tray__chips">
            {items.map((i) => (
              <li key={i.id} className="st-tray__chip">
                <span className="hg-truncate">{i.university}</span>
                <button type="button" onClick={() => remove(i.id)} aria-label={t('compare.tray.remove', { name: `${i.university} — ${i.label}` })}><X aria-hidden /></button>
              </li>
            ))}
          </ul>
        </div>
        <Button variant="ghost" size="sm" onClick={clear}>{t('compare.tray.clear')}</Button>
        {items.length >= 2 ? (
          <ButtonLink as={Link} to={href} variant="primary" size="sm" iconEnd={<ArrowRight className="hg-flip-rtl" />}>{t('common:actions.compare')}</ButtonLink>
        ) : (
          <span className="hg-subtle hg-xs st-tray__hint">{t('compare.tray.addOne')}</span>
        )}
      </div>
    </aside>
  );
}
