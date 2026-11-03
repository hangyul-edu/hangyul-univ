import { ChatThread, theme } from '@hangyul/mobile-ui';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { qk } from '../../src/queries';

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [subject, setSubject] = useState('');
  const onRead = useCallback(() => void qc.invalidateQueries({ queryKey: qk.dashboard }), [qc]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bgCanvas }}>
      <Stack.Screen options={{ title: subject }} />
      <ChatThread conversationId={id} onRead={onRead} onLoaded={setSubject} />
    </View>
  );
}
