import { useAuth } from '@hangyul/auth';
import { Bell, CheckCheck } from '@hangyul/icons';
import type { NotificationItem } from '@hangyul/types';
import { Button, Card, EmptyState, PageHeader, QueryState, Segmented } from '@hangyul/ui';
import { cx, formatDateTime, formatRelative } from '@hangyul/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { useT } from '../components/bits';
import { dayKey, groupBy } from '../lib/logic';

export default function Notifications() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const q = useQuery({ queryKey: ['notifications', 'page', filter], queryFn: () => api.notifications.list(filter === 'unread') });
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const text = (n: NotificationItem) => {
    const k = n.title_key.startsWith('notify.') ? n.title_key : '';
    const tr = k ? t(k, { ...n.params, defaultValue: '' }) : '';
    return tr && !tr.includes('{{') ? tr : n.text;
  };
  return (
    <div className="hg-stack ag-page">
      <PageHeader title={t('nav.notifications')} subtitle={t('notifs.sub')}
        actions={<>
          <Segmented label={t('notifs.filter')} value={filter} onChange={setFilter} options={[{ value: 'all', label: t('inbox.all') }, { value: 'unread', label: t('inbox.unread') }]} />
          <Button size="sm" icon={<CheckCheck />} onClick={async () => { await api.notifications.readAll(); refresh(); }}>{t('notify.markAllRead')}</Button>
        </>} />
      <QueryState query={q} isEmpty={(d) => d.items.length === 0} empty={<EmptyState icon={<Bell />} title={t('notify.empty')} />}>
        {(d) => (
          <div className="hg-stack">
            {groupBy(d.items, (n) => dayKey(n.at)).map(([day, items]) => (
              <Card key={day} as="section" aria-label={day}>
                <h2 className="ag-task-group__head">{formatDateTime(`${day}`, locale).split(',')[0]}</h2>
                <ul className="hg-list">
                  {items.map((n) => (
                    <li key={n.id}>
                      <Link to={n.link ?? '#'} className={cx('ag-notif', !n.read && 'is-unread')}
                        onClick={() => { if (!n.read) api.notifications.read(n.id).then(refresh); }}>
                        {!n.read && <span className="hg-dot" aria-label={t('inbox.unread')} />}
                        <span className="hg-grow hg-small">{text(n)}</span>
                        <span className="hg-subtle hg-xs" title={formatDateTime(n.at, locale)}>{formatRelative(n.at, locale)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
