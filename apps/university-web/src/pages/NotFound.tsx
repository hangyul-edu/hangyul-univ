import { Compass } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { ButtonLink, EmptyState } from '@hangyul/ui';
import { Link } from 'react-router';

export default function NotFound() {
  const { t } = useLocale(['university', 'common']);
  return (
    <EmptyState
      headingLevel={1}
      icon={<Compass />}
      title={t('common:states.notFound')}
      text={t('university:notFound.body')}
      action={<ButtonLink as={Link} to="/" variant="primary">{t('university:notFound.cta')}</ButtonLink>}
    />
  );
}
