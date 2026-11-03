import { localName } from '@hangyul/i18n';
import { Heart } from '@hangyul/icons';
import { ButtonLink, EmptyState, ListRow, QueryState, Skeleton, UniMark } from '@hangyul/ui';
import { formatMoney, formatRelative } from '@hangyul/utils';
import { Link } from 'react-router';

import { SaveButton } from '../components/ProgramCard';
import { useT } from '../lib/i18n';
import { useSaved } from '../lib/queries';

/** The shortlist: saved universities with the one fact that matters most after fit — what living there costs. */
export function SavedList() {
  const { t, locale } = useT();
  const q = useSaved();
  return (
    <QueryState
      query={q}
      skeleton={<Skeleton h={180} r={10} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon={<Heart />} title={t('saved.empty')} text={t('saved.emptyText')} action={<ButtonLink as={Link} to="/explore?tab=foryou" variant="primary">{t('saved.explore')}</ButtonLink>} />}
    >
      {(list) => (
        <div className="hg-stack" style={{ '--hg-gap': '12px' } as React.CSSProperties}>
          <div className="hg-panel">
            <ul className="hg-list">
              {list.map((u) => (
                <li key={u.id} className="sv-saved">
                  <ListRow as={Link} to={`/universities/${u.slug}${u.program_id ? `?program=${u.program_id}` : ''}`}
                    lead={<UniMark name={u.name_en} color={u.brand_color} photo={u.photo} />}
                    title={localName(u)}
                    meta={[u.city, t(`common:institution.${u.institution_type}`), u.est_living_cost_monthly_krw ? t('saved.livingShort', { amount: formatMoney(u.est_living_cost_monthly_krw, 'KRW', locale, { compact: true }) }) : null, u.saved_at ? t('saved.savedAt', { when: formatRelative(u.saved_at, locale) }) : null].filter(Boolean).join(' · ')}
                  />
                  <SaveButton universityId={u.id} name={localName(u)} />
                </li>
              ))}
            </ul>
          </div>
          <div className="hg-row-wrap">
            {list.length >= 2 && <ButtonLink as={Link} to="/compare" size="sm" variant="primary">{t('v4.compare.savedCta', { count: Math.min(list.length, 4) })}</ButtonLink>}
            <ButtonLink as={Link} to="/compare#budget" size="sm">{t('saved.budget')}</ButtonLink>
            <span className="hg-small hg-subtle">{t('saved.budgetWhy')}</span>
          </div>
        </div>
      )}
    </QueryState>
  );
}
