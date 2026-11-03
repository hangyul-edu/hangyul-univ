import { Compass } from '@hangyul/icons';
import { ButtonLink, EmptyState } from '@hangyul/ui';
import { Link } from 'react-router';

import { useT } from '../components/bits';

export default function NotFound() {
  const { t } = useT();
  return (
    <div className="ag-page">
      {/* V19: `headingLevel={1}` — the empty state is the whole page, so its title is the page heading. */}
      <EmptyState headingLevel={1} icon={<Compass />} title={t('states.notFound')} text={t('misc.notFoundText')}
        action={<ButtonLink as={Link} to="/" variant="primary" size="sm">{t('nav.dashboard')}</ButtonLink>} />
    </div>
  );
}
