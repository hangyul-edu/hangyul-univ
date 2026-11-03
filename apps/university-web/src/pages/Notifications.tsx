import { useAuth } from '@hangyul/auth';
import { Bell } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { NotificationItem } from '@hangyul/types';
import { Button, Card, EmptyState, QueryState, SkeletonCard } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import { cx, formatDateTime, formatRelative } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';

export default function Notifications() {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.notifications.list() });
  const readAll = useMutation({ mutationFn: () => api.notifications.readAll(), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const text = (n: NotificationItem) => {
    const k = n.title_key.startsWith('notify.') ? n.title_key : '';
    const tr = k ? t(`common:${k}`, { ...n.params, defaultValue: '' }) : '';
    return tr && !tr.includes('{{') ? tr : n.text;
  };
  const toLink = (link: string | null) => (link && link.startsWith('/') ? link : null);
  return (
    <div className="hg-stack uc-page uv7">
      <PageHeader title={t('common:nav.notifications')} sub={t('university:notifications.subtitle')}
        actions={(q.data?.unread ?? 0) > 0 ? <Button onClick={() => readAll.mutate()} loading={readAll.isPending}>{t('common:notify.markAllRead')}</Button> : undefined} />
      <QueryState query={q} skeleton={<SkeletonCard lines={5} />} isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon={<Bell />} title={t('common:notify.empty')} />}>
        {(d) => (
          <Card>
            <ul className="uc-notifs">
              {d.items.map((n) => {
                const href = toLink(n.link);
                const body = (
                  <>
                    {!n.read && <span className="hg-dot" aria-label={t('university:notifications.unread')} />}
                    <span className="hg-grow">
                      <span className={cx('hg-small', !n.read && 'hg-strong')} style={{ display: 'block' }}>{text(n)}</span>
                      <span className="hg-xs hg-subtle" title={formatDateTime(n.at, locale)}>{formatRelative(n.at, locale)}</span>
                    </span>
                  </>
                );
                const onClick = () => { if (!n.read) api.notifications.read(n.id).then(() => qc.invalidateQueries({ queryKey: ['notifications'] })); };
                return <li key={n.id}>{href ? <Link to={href} className="uc-notif" onClick={onClick}>{body}</Link> : <div className="uc-notif">{body}</div>}</li>;
              })}
            </ul>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
