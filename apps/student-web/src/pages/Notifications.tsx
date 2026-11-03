import { useApi } from '@hangyul/auth';
import { CheckCheck } from '@hangyul/icons';
import type { NotificationItem } from '@hangyul/types';
import { Button, EmptyState, QueryState, SkeletonCard } from '@hangyul/ui';
import { cx, formatDate, formatDateTime } from '@hangyul/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { PageIntro } from '../components/bits';
import { notifyParams, useT } from '../lib/i18n';

export default function Notifications() {
  const { t, locale } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.notifications.list() });
  const text = (n: NotificationItem) => {
    const s = n.title_key.startsWith('notify.') ? t(`common:${n.title_key}`, { ...notifyParams(t, n.params ?? {}, locale), defaultValue: '' }) : '';
    return s && !s.includes('{{') ? s : n.text;
  };
  const open = async (n: NotificationItem) => {
    if (!n.read) await api.notifications.read(n.id).catch(() => undefined);
    qc.invalidateQueries({ queryKey: ['notifications'] });
    if (n.link) nav(n.link);
  };
  return (
    <div className="st-page">
      <PageIntro title={t('notifications.title')} subtitle={t('notifications.subtitle')}
        actions={(q.data?.unread ?? 0) > 0 ? <Button variant="ghost" icon={<CheckCheck />} onClick={async () => { await api.notifications.readAll(); qc.invalidateQueries({ queryKey: ['notifications'] }); }}>{t('common:notify.markAllRead')}</Button> : undefined} />
      <QueryState query={q} skeleton={<SkeletonCard lines={5} />} isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title={t('common:notify.empty')} text={t('notifications.emptyText')} />}>
        {(d) => {
          // Group by calendar day: Today, Yesterday, then dates.
          const dayKey = (iso: string) => new Date(iso).toDateString();
          const today = new Date().toDateString();
          const yesterday = new Date(Date.now() - 86_400_000).toDateString();
          const groups: { key: string; label: string; items: NotificationItem[] }[] = [];
          d.items.forEach((n) => {
            const k = dayKey(n.at);
            let g = groups.find((x) => x.key === k);
            if (!g) {
              g = { key: k, label: k === today ? t('notificationsV3.today') : k === yesterday ? t('notificationsV3.yesterday') : formatDate(n.at, locale, { dateStyle: 'medium' }), items: [] };
              groups.push(g);
            }
            g.items.push(n);
          });
          return (
            <>
              {groups.map((g) => (
                <section key={g.key}>
                  <h2 className="sno-day">{g.label}</h2>
                  <ul className="hg-panel sno-list">
                    {g.items.map((n) => (
                      <li key={n.id}>
                        <button type="button" className="sno-row" data-unread={!n.read || undefined} onClick={() => open(n)}>
                          <span className={cx('sno-dot', n.read && 'sno-dot--read')} aria-label={n.read ? undefined : t('notifications.unread')} />
                          <span className="hg-grow">{text(n)}</span>
                          <time className="sno-time" dateTime={n.at} title={formatDateTime(n.at, locale)}>{formatDate(n.at, locale, { timeStyle: 'short' })}</time>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
