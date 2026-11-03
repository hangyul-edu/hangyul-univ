import { ListRow, Section } from '@hangyul/ui';
import { Link } from 'react-router';

import { PageIntro } from '../components/bits';
import { useMoreLinks } from '../components/AppLayout';
import { useT } from '../lib/i18n';

export default function More() {
  const { t } = useT();
  const links = useMoreLinks();
  return (
    <div className="st-page">
      <PageIntro title={t('common:nav.journey')} />
      {/* V11 gates the Korea group on the journey stage (REPORT §76.3), so a group can legitimately be empty —
          render the heading only when it has something under it, never as a title over nothing. */}
      {(['prepare', 'korea', 'account'] as const).map((g) => {
        const group = links.filter((l) => l.group === g);
        if (group.length === 0) return null;
        return (
          <Section key={g} title={t(`more.group.${g}`)}>
            <div className="hg-panel">
              <ul className="hg-list">
                {group.map((l) => (
                  <li key={l.to}>
                    <ListRow as={Link} to={l.to} chevron lead={<span className="st-more__icon" aria-hidden>{l.icon}</span>} title={l.label} meta={l.hint} />
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        );
      })}
    </div>
  );
}
