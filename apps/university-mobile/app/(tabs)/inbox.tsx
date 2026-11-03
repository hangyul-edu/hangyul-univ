import { useTranslation } from '@hangyul/i18n';
import { ConversationList, NotificationsList, QueryState, Screen, SegmentedControl, useConversations, useNotifications } from '@hangyul/mobile-ui';
import { router } from 'expo-router';
import { useState } from 'react';

type View = 'messages' | 'notifications';

export default function MessagesScreen() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('messages');
  const convs = useConversations();
  const notifications = useNotifications();
  const unreadMsgs = (convs.data ?? []).reduce((s, c) => s + c.unread, 0);
  return (
    <Screen title={t('university.inbox.title')} onRefresh={() => Promise.all([convs.refetch(), notifications.refetch()])}>
      <SegmentedControl<View>
        options={[
          { value: 'messages', label: t('v3.messages.conversations'), count: unreadMsgs || undefined },
          { value: 'notifications', label: t('common:nav.notifications'), count: notifications.data?.unread || undefined },
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'messages' ? (
        <QueryState query={convs}>
          {(list) => <ConversationList conversations={list} showStudent onOpen={(c) => router.push(`/messages/${c.id}`)} />}
        </QueryState>
      ) : (
        <QueryState query={notifications}>
          {(d) => (
            <NotificationsList
              items={d.items}
              unread={d.unread}
              onOpen={(n) => {
                const m = n.link?.match(/\/applicants\/([\w-]+)|\/applications\/([\w-]+)/);
                const id = m?.[1] ?? m?.[2];
                if (id) router.push(`/applicants/${id}`);
              }}
            />
          )}
        </QueryState>
      )}
    </Screen>
  );
}
