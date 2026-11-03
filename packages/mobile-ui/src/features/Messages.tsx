import { useApi, useAuth } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import type { ChatMessage, ConversationSummary } from '@hangyul/types';
import { messageSchema } from '@hangyul/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Lock, MessagesSquare, Paperclip, Send, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { Avatar } from '../components/Avatar';
import { CountDot } from '../components/Badge';
import { IconButton } from '../components/Button';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useFontsReady } from '../fonts';
import { useFormat } from '../format';
import { fontFamily, theme } from '../theme';
import { UploadSheet, type PickedFile } from './Upload';
import { isUnavailable, v3, type Attachment } from './v3';
import { absoluteApiUrl } from '../bootstrap/api';

export const messageKeys = {
  list: (studentId?: string) => (studentId ? (['conversations', { studentId }] as const) : (['conversations'] as const)),
  thread: (id: string) => ['conversations', id] as const,
};

export function useConversations(studentId?: string) {
  const api = useApi();
  return useQuery({ queryKey: messageKeys.list(studentId), queryFn: () => api.messages.conversations(studentId) });
}

/** Conversation rows (V3: unboxed, one line of preview, unread = bold + count). Staff see the student first, subject second. */
export function ConversationList({ conversations, onOpen, showStudent }: {
  conversations: ConversationSummary[]; onOpen: (c: ConversationSummary) => void; showStudent?: boolean;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  if (conversations.length === 0) return <EmptyState icon={MessagesSquare} title={t('mobile:messages.empty')} body={t('mobile:messages.emptyBody')} />;
  // V4: staff see the student first; the subject only when it says something (not the same default on every row).
  const subjects = conversations.filter((c) => c.student).map((c) => c.subject);
  const common = subjects.sort((a, b) => subjects.filter((x) => x === b).length - subjects.filter((x) => x === a).length)[0];
  const showSubject = (c: (typeof conversations)[number]) => showStudent && !!c.student && (subjects.length < 2 || c.subject !== common);
  return (
    <View>
      {conversations.map((c, i) => {
        const who = showStudent && c.student ? c.student.full_name : c.subject;
        const lm = c.last_message;
        const preview = lm ? `${lm.author ? `${isTeam(lm.author) ? t('mobile:v23.team.name') : lm.author.full_name.split(' ').slice(-1)[0]}: ` : ''}${lm.body}` : t('mobile:messages.noMessages');
        const unread = c.unread > 0;
        return (
          <Pressable
            key={c.id}
            onPress={() => onOpen(c)}
            accessibilityRole="button"
            accessibilityLabel={[who, showStudent && c.student ? c.subject : null, unread ? t('mobile:messages.unreadCount', { count: c.unread }) : null,
              lm?.internal ? t('mobile:messages.internalLabel') : null, preview, c.last_message_at ? f.relative(c.last_message_at) : null].filter(Boolean).join(', ')}
            android_ripple={{ color: 'rgba(24,26,31,0.06)' }}
            style={({ pressed }) => [styles.conv, i > 0 && styles.convDivider, pressed && Platform.OS === 'ios' && { opacity: 0.6 }]}
          >
            <Avatar name={who} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.convTop}>
                <AppText variant={unread ? 'bodyStrong' : 'body'} numberOfLines={1} style={styles.flex}>{who}</AppText>
                {c.last_message_at ? <AppText variant="caption" color={unread ? theme.color.primaryText : theme.color.textTertiary}>{f.relative(c.last_message_at)}</AppText> : null}
              </View>
              {showSubject(c) ? <AppText variant="caption" numberOfLines={1} color={theme.color.textSecondary}>{c.subject}</AppText> : null}
              <View style={styles.convTop}>
                {lm?.internal ? <Lock size={12} color={theme.status.warning.fg} /> : null}
                <AppText variant="caption" numberOfLines={1} color={unread ? theme.color.text : theme.color.textTertiary} style={styles.flex}>{preview}</AppText>
                <CountDot count={c.unread} />
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface ChatThreadProps {
  conversationId: string;
  /** Staff apps can post internal notes that the student never sees. */
  allowInternal?: boolean;
  onRead?: () => void;
  /** Called with the subject (and, for staff, the student's name — V4 uses it as the thread title). */
  onLoaded?: (subject: string, studentName?: string | null) => void;
}

/** Message thread with composer. Internal notes are visually distinct (amber, lock icon) and labelled. */
export function ChatThread({ conversationId, allowInternal, onRead, onLoaded }: ChatThreadProps) {
  const { t } = useTranslation();
  const api = useApi();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const fontsReady = useFontsReady();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const attach = async (file: PickedFile) => {
    setUploading(true);
    setError(null);
    try {
      const a = await v3.uploadAttachment(api, conversationId, file);
      setPending((p) => [...p, a]);
    } catch (e) {
      setError(isUnavailable(e) ? t('mobile:v3.messages.attachUnavailable') : (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const thread = useQuery({ queryKey: messageKeys.thread(conversationId), queryFn: () => api.messages.thread(conversationId), refetchInterval: 15_000 });

  // Callbacks via refs so inline props never re-trigger effects.
  const cb = useRef({ onRead, onLoaded });
  cb.current = { onRead, onLoaded };
  const subject = thread.data?.subject;
  const studentName = thread.data?.student?.full_name ?? null;
  useEffect(() => {
    if (subject) cb.current.onLoaded?.(subject, studentName);
  }, [subject, studentName]);

  useEffect(() => {
    api.messages.markRead(conversationId).then(() => {
      void qc.invalidateQueries({ queryKey: messageKeys.list() });
      cb.current.onRead?.();
    }).catch(() => undefined);
  }, [api, conversationId, qc]);

  const send = useMutation({
    mutationFn: (v: { body: string; internal: boolean }) => (pending.length
      ? v3.sendWithAttachments(api, conversationId, { ...v, attachment_ids: pending.map((a) => a.id) })
      : api.messages.send(conversationId, v)),
    onSuccess: () => {
      setBody('');
      setPending([]);
      void qc.invalidateQueries({ queryKey: messageKeys.thread(conversationId) });
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const submit = () => {
    const text = body.trim() || (pending.length ? t('mobile:v3.messages.attachmentOnly', { count: pending.length }) : body);
    const parsed = messageSchema.safeParse({ body: text, internal: allowInternal ? internal : false });
    if (!parsed.success) { setError(t(`common:${parsed.error.issues[0]?.message ?? 'validation.required'}`)); return; }
    setError(null);
    send.mutate({ body: parsed.data.body, internal: parsed.data.internal });
  };

  const messages = [...(thread.data?.messages ?? [])].reverse();
  const internalOn = allowInternal && internal;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      {thread.isPending ? (
        <View style={styles.pad}><LoadingState rows={5} /></View>
      ) : thread.isError && !thread.data ? (
        <ErrorState error={thread.error} onRetry={() => void thread.refetch()} />
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => <Bubble m={item} older={messages[index + 1]} />}
          ListEmptyComponent={<EmptyState compact title={t('mobile:messages.noMessages')} />}
          keyboardShouldPersistTaps="handled"
        />
      )}
      <View style={[styles.composer, internalOn && styles.composerInternal, { paddingBottom: Math.max(12, insets.bottom) }]}>
        {allowInternal ? (
          <View style={styles.internalRow}>
            <Lock size={14} color={internalOn ? theme.status.warning.fg : theme.color.textSecondary} />
            <AppText variant="caption" color={internalOn ? theme.status.warning.fg : theme.color.textSecondary} style={styles.flex}>
              {internalOn ? t('mobile:messages.internalOn') : t('mobile:messages.internalToggle')}
            </AppText>
            <Switch
              value={internal}
              onValueChange={setInternal}
              accessibilityLabel={t('mobile:messages.internalToggle')}
              trackColor={{ true: theme.status.warning.solid, false: theme.color.borderStrong }}
              thumbColor="#FFFFFF"
            />
          </View>
        ) : null}
        {error ? <AppText variant="caption" tone="danger" accessibilityRole="alert">{error}</AppText> : null}
        {pending.length ? (
          <View style={styles.pendingRow}>
            {pending.map((a) => (
              <View key={a.id} style={styles.pendingChip}>
                <FileText size={14} color={theme.color.textSecondary} />
                <AppText variant="caption" numberOfLines={1} style={{ maxWidth: 160 }}>{a.filename}</AppText>
                <Pressable onPress={() => setPending((p) => p.filter((x) => x.id !== a.id))} accessibilityRole="button" accessibilityLabel={t('mobile:v3.messages.removeAttachment', { name: a.filename })} hitSlop={10}>
                  <X size={14} color={theme.color.textTertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.inputRow}>
          <IconButton icon={Paperclip} color={theme.color.textSecondary} accessibilityLabel={t('mobile:v3.messages.attach')} onPress={() => setAttachOpen(true)} disabled={uploading} />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={internalOn ? t('mobile:messages.internalPlaceholder') : t('mobile:messages.placeholder')}
            placeholderTextColor={theme.color.textTertiary}
            multiline
            maxLength={8000}
            accessibilityLabel={internalOn ? t('mobile:messages.internalPlaceholder') : t('mobile:messages.placeholder')}
            style={[styles.input, fontsReady && { fontFamily: fontFamily.regular }, internalOn && styles.inputInternal]}
          />
          <IconButton
            icon={Send}
            color={body.trim() || pending.length ? theme.color.primary : theme.color.textTertiary}
            accessibilityLabel={internalOn ? t('mobile:messages.sendInternal') : t('common:actions.send')}
            onPress={submit}
            disabled={send.isPending || (!body.trim() && !pending.length)}
          />
        </View>
      </View>
      <UploadSheet visible={attachOpen} title={t('mobile:v3.messages.attach')} onClose={() => setAttachOpen(false)} onPicked={(f) => void attach(f)} />
    </KeyboardAvoidingView>
  );
}

const dayKey = (iso: string) => new Date(iso).toDateString();

/** V23 (REPORT §274 N2): the API sends `{ id: 'team', kind: 'team' }` for every staff author **to a student**; show the
 *  localized 한귤 유니브 상담팀 instead of its English `full_name`. Staff apps receive real authors and are unaffected. */
function isTeam(a: { id?: string; kind?: string } | null | undefined): boolean {
  return !!a && (a.kind === 'team' || a.id === 'team');
}

/** One message. Shows a day divider above the first message of each day and the author only when it changes. */
function Bubble({ m, older }: { m: ChatMessage; older?: ChatMessage }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { session } = useAuth();
  const authorName = (a: NonNullable<ChatMessage['author']>) => (isTeam(a) ? t('mobile:v23.team.name') : a.full_name);
  const mine = m.mine || m.author?.id === session?.user.id;
  const newDay = !older || dayKey(older.at) !== dayKey(m.at);
  const showAuthor = !mine && !!m.author && (newDay || older?.author?.id !== m.author.id || !!older?.internal !== !!m.internal);
  const time = new Date(m.at).toLocaleTimeString(f.locale, { hour: 'numeric', minute: '2-digit' });
  const day = dayKey(m.at) === new Date().toDateString() ? t('common:time.today') : f.date(m.at);
  const light = mine && !m.internal;
  return (
    <View style={{ gap: 6 }}>
      {newDay ? (
        <View style={styles.day} accessibilityRole="header">
          <AppText variant="label" color={theme.color.textTertiary}>{day}</AppText>
        </View>
      ) : null}
      <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
        <View
          style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, m.internal && styles.bubbleInternal]}
          accessible
          accessibilityLabel={`${m.internal ? `${t('mobile:messages.internalLabel')}. ` : ''}${m.author ? authorName(m.author) : ''}: ${m.body}. ${f.dateTime(m.at)}`}
        >
          {m.internal ? (
            <View style={styles.internalTag}>
              <Lock size={12} color={theme.status.warning.fg} />
              <AppText variant="label" color={theme.status.warning.fg}>{t('mobile:messages.internalLabel')}</AppText>
            </View>
          ) : null}
          {showAuthor ? <AppText variant="label" color={theme.color.textSecondary}>{authorName(m.author!)}</AppText> : null}
          <AppText variant="body" color={light ? '#FFFFFF' : theme.color.text} selectable>{m.body}</AppText>
          {((m as { attachments?: Attachment[] }).attachments ?? []).map((a) => <AttachmentLink key={a.id} a={a} light={light} />)}
          <AppText variant="caption" color={light ? 'rgba(255,255,255,0.85)' : theme.color.textTertiary} style={[styles.time, mine && { textAlign: 'right' }]}>{time}</AppText>
        </View>
      </View>
    </View>
  );
}

function AttachmentLink({ a, light }: { a: Attachment; light?: boolean }) {
  const api = useApi();
  const { t } = useTranslation();
  const open = async () => {
    try { const r = await v3.attachmentUrl(api, a.id); await Linking.openURL(absoluteApiUrl(r.url)); } catch { /* signed URL unavailable */ }
  };
  const fg = light ? '#FFFFFF' : theme.color.text;
  return (
    <Pressable onPress={() => void open()} accessibilityRole="link" accessibilityLabel={t('mobile:v3.messages.openAttachment', { name: a.filename })}
      style={[styles.attachment, light && { borderColor: 'rgba(255,255,255,0.35)' }]}>
      <FileText size={16} color={fg} />
      <AppText variant="caption" color={fg} numberOfLines={1} style={{ flex: 1 }}>{a.filename}</AppText>
    </Pressable>
  );
}

/** Pressable used for inbox filters etc. (kept here to avoid another tiny file). */
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={label} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}>
      <AppText variant="bodyStrong" color={theme.color.primaryText}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: 16 },
  list: { padding: 16, gap: 6 },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '84%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleMine: { backgroundColor: theme.color.text, borderBottomEndRadius: 4 },
  bubbleTheirs: { backgroundColor: theme.color.bgMuted, borderBottomStartRadius: 4 },
  day: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  conv: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 64 },
  convDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },
  convTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bubbleInternal: { backgroundColor: theme.status.warning.bg, borderWidth: 1, borderColor: theme.palette.amber[100], borderStyle: 'dashed' },
  internalTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  time: { fontSize: 11, lineHeight: 14 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border, backgroundColor: theme.color.surface, paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  composerInternal: { backgroundColor: theme.status.warning.bg },
  internalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  input: {
    flex: 1, minHeight: 44, maxHeight: 140, fontSize: 16, color: theme.color.text, backgroundColor: theme.color.bgMuted, borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, textAlign: 'auto',
  },
  pendingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pendingChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 32, borderRadius: 8, backgroundColor: theme.color.bgMuted },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.color.border, marginTop: 2 },
  inputInternal: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: theme.status.warning.solid },
});
