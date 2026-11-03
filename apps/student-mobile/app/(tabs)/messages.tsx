import { useTranslation } from '@hangyul/i18n';
import { ConversationList, QueryState, Screen, useConversations } from '@hangyul/mobile-ui';
import { router } from 'expo-router';

export default function MessagesScreen() {
  const { t } = useTranslation();
  const convs = useConversations();
  return (
    <Screen title={t('common:nav.messages')} subtitle={t('student.messages.subtitle')} onRefresh={() => convs.refetch()}>
      <QueryState query={convs}>
        {(list) => <ConversationList conversations={list} onOpen={(c) => router.push(`/messages/${c.id}`)} />}
      </QueryState>
    </Screen>
  );
}
