import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import type { NotificationItem } from '@hangyul/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellDot } from 'lucide-react-native';

import { Button } from '../components/Button';
import { ListGroup, ListItem } from '../components/List';
import { EmptyState } from '../components/States';
import { useFormat } from '../format';
import { theme } from '../theme';

export const notificationKeys = { list: ['notifications'] as const };

export function useNotifications() {
  const api = useApi();
  return useQuery({ queryKey: notificationKeys.list, queryFn: () => api.notifications.list(false) });
}

/** Localised notification text: common:notify.<key> with params, falling back to the server text. */
export function useNotificationText() {
  const { t } = useTranslation();
  return (n: NotificationItem) => t(`common:${n.title_key}`, { ...n.params, defaultValue: n.text });
}

export function NotificationsList({ items, unread, onOpen }: { items: NotificationItem[]; unread: number; onOpen?: (n: NotificationItem) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const qc = useQueryClient();
  const text = useNotificationText();
  const readAll = useMutation({ mutationFn: () => api.notifications.readAll(), onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.list }) });
  const readOne = useMutation({ mutationFn: (id: string) => api.notifications.read(id), onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.list }) });

  if (items.length === 0) return <EmptyState icon={Bell} title={t('common:notify.empty')} />;
  return (
    <>
      {unread > 0 ? <Button label={t('common:notify.markAllRead')} variant="secondary" size="sm" onPress={() => readAll.mutate()} loading={readAll.isPending} /> : null}
      <ListGroup>
        {items.map((n) => (
          <ListItem
            key={n.id}
            icon={n.read ? Bell : BellDot}
            iconColor={n.read ? theme.color.textTertiary : theme.color.primary}
            title={text(n)}
            meta={f.relative(n.at)}
            accessibilityLabel={`${n.read ? '' : `${t('mobile:notifications.unread')}, `}${text(n)}, ${f.relative(n.at)}`}
            onPress={() => {
              if (!n.read) readOne.mutate(n.id);
              onOpen?.(n);
            }}
            chevron={!!n.link && !!onOpen}
          />
        ))}
      </ListGroup>
    </>
  );
}
