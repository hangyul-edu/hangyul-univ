import { useAuth } from '@hangyul/auth';
import { Bell } from '@hangyul/icons';
import { errorText, useLocale } from '@hangyul/i18n';
import type { NotificationItem } from '@hangyul/types';
import { Button, Card, EmptyState, QueryState, SkeletonCard, useToast } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import { cx, formatDateTime, formatRelative } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';

export default function Notifications() {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.notifications.list() });
  const toast = useToast();
  const readAll = useMutation({ mutationFn: () => api.notifications.readAll(), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }), onError: (e) => toast.error(errorText(e)) });
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
                    <span className={cx('uc-notif__dot', !n.read && 'is-unread')} aria-hidden />
                    <span className="uc-notif__text">{!n.read && <span className="hg-sr-only">{t('university:notifications.unread')} · </span>}{text(n)}</span>
                    <time className="uc-notif__time" dateTime={n.at} title={formatDateTime(n.at, locale)}>{formatRelative(n.at, locale)}</time>
                  </>
                );
                const onClick = () => { if (!n.read) api.notifications.read(n.id).then(() => qc.invalidateQueries({ queryKey: ['notifications'] })).catch(() => undefined); };
                const cls = cx('uc-notif', !n.read && 'is-unread');
                return <li key={n.id}>{href ? <Link to={href} className={cls} onClick={onClick}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
              })}
            </ul>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
