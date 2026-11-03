import { NotificationsList, QueryState, Screen, useNotifications } from '@hangyul/mobile-ui';
import { router } from 'expo-router';

import { mapWebLink } from '../src/links';
import { PushOptIn } from '../src/push';

export default function NotificationsScreen() {
  const q = useNotifications();
  return (
    <Screen onRefresh={() => q.refetch()}>
      <PushOptIn />
      <QueryState query={q}>
        {(d) => (
          <NotificationsList
            items={d.items}
            unread={d.unread}
            onOpen={(n) => {
              const to = mapWebLink(n.link);
              if (to) router.push(to);
            }}
          />
        )}
      </QueryState>
    </Screen>
  );
}
