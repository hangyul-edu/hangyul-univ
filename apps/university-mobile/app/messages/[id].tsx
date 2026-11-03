import { ChatThread, theme } from '@hangyul/mobile-ui';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [subject, setSubject] = useState('');
  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bgCanvas }}>
      <Stack.Screen options={{ title: subject }} />
      <ChatThread conversationId={id} onLoaded={setSubject} />
    </View>
  );
}
