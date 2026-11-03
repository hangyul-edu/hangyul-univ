import { Compass, Home, RefreshCw } from '@hangyul/icons';
import { Button, ButtonLink, EmptyState, Logo } from '@hangyul/ui';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router';

import { useT } from '../lib/i18n';

export default function NotFound() {
  const { t } = useT();
  return (
    <div className="st-center-page">
      <EmptyState
        // V19: this empty state *is* the page, so its title is the page's heading. Without `headingLevel`
        // the 404 document had no `<h1>` at all and was unreachable by heading navigation.
        headingLevel={1}
        icon={<Compass />}
        title={t('notFound.title')}
        text={t('notFound.text')}
        action={<ButtonLink as={Link} to="/" variant="primary" icon={<Home />}>{t('notFound.home')}</ButtonLink>}
      />
    </div>
  );
}

/** Shown when a route fails to render (e.g. a chunk failed to load after a deploy). */
export function RouteError() {
  const { t } = useT();
  const err = useRouteError();
  const is404 = isRouteErrorResponse(err) && err.status === 404;
  return (
    <div className="st-center-page" style={{ minHeight: '100dvh' }}>
      <div className="hg-stack" style={{ alignItems: 'center' }}>
        <Logo />
        <EmptyState
          headingLevel={1}
          icon={<RefreshCw />}
          title={is404 ? t('notFound.title') : t('routeError.title')}
          text={is404 ? t('notFound.text') : t('routeError.text')}
          action={
            <div className="hg-row-wrap" style={{ justifyContent: 'center' }}>
              <Button variant="primary" onClick={() => window.location.reload()}>{t('routeError.reload')}</Button>
              <a className="hg-btn" href="/">{t('notFound.home')}</a>
            </div>
          }
        />
      </div>
    </div>
  );
}
