import { ArrowRight } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { ButtonLink } from '@hangyul/ui';

import { PageHero, useNoClosingCta } from '../components/blocks';
import { LocaleLink } from '../components/LocaleLink';
import { useSeo } from '../lib/useSeo';

export default function NotFound() {
  const { t } = useLocale(['marketing', 'common']);
  useSeo({ title: t('notFound.title'), description: t('notFound.text') });
  // V30 (REPORT §413): a dead URL needs a way back, not a pitch. The closing "한국 유학, 지금 시작하세요" band stacked a
  // second dark section with two more buttons under this one — four calls to action on an error page.
  useNoClosingCta();
  return (
    <PageHero
      eyebrow="404"
      title={t('notFound.title')}
      lede={t('notFound.text')}
      actions={<>
        <ButtonLink as={LocaleLink} to="/" variant="primary" iconEnd={<ArrowRight className="hg-flip-rtl" />}>{t('notFound.home')}</ButtonLink>
        <ButtonLink as={LocaleLink} to="/universities">{t('notFound.browse', { defaultValue: t('nav.universities') })}</ButtonLink>
      </>}
    />
  );
}
