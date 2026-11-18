import { useTranslation } from '@hangyul/i18n';
import { useApi } from '@hangyul/auth';
import { AppText, Button, ConversationList, QueryState, Screen, theme, useConversations } from '@hangyul/mobile-ui';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

export default function MessagesScreen() {
  const { t } = useTranslation();
  const api = useApi();
  // Today's "waiting for your reply" row opens this tab with `filter=reply`: the server's needs-reply set, which is what it counted.
  const params = useLocalSearchParams<{ filter?: string }>();
  const [replyOnly, setReplyOnly] = useState(params.filter === 'reply');
  useEffect(() => { if (params.filter) setReplyOnly(params.filter === 'reply'); }, [params.filter]);
  const all = useConversations();
  const waiting = useQuery({ queryKey: ['conversations', 'needs-reply'], queryFn: () => api.messages.conversations(undefined, { needs_reply: true }), enabled: replyOnly });
  const convs = replyOnly ? waiting : all;
  return (
    <Screen title={t('agency.messages.title')} subtitle={t('agency.messages.subtitle')} onRefresh={() => convs.refetch()}>
      {replyOnly ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <AppText variant="caption" style={{ flex: 1 }}>{t('v3.agency.att.replyThreads', { count: waiting.data?.length ?? 2 })}</AppText>
          <Button label={t('v3.common.all')} size="sm" variant="ghost" onPress={() => setReplyOnly(false)} />
        </View>
      ) : null}
      <QueryState query={convs}>
        {(list) => <ConversationList conversations={list} showStudent onOpen={(c) => router.push(`/messages/${c.id}`)} />}
      </QueryState>
    </Screen>
  );
}
