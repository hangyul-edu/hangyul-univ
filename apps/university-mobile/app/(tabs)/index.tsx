import { useApi, useAuth } from '@hangyul/auth';
import { useTranslation, localName } from '@hangyul/i18n';
import { AppText, ErrorState, ListGroup, LoadingState, Screen, SectionTitle, theme } from '@hangyul/mobile-ui';
import type { UniversityAttention } from '@hangyul/types';
import { useQueries, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, CircleCheck } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ApplicantList, useApplicants } from '../../src/ApplicantList';
import { HEAD_VIEWS, viewQuery, type HeadView } from '../../src/views';
import { useOverview } from '../../src/queries';

/** What needs our decision: the applications to review, then the other open decisions. Rates live on the Pipeline tab. */
export default function NeedsReviewScreen() {
  const { t } = useTranslation();
  const api = useApi();
  const { session } = useAuth();
  const overview = useOverview();
  const attention = useQuery({ queryKey: ['university', 'attention'], queryFn: () => api.university.attention() });
  const latest = useApplicants('review', '', 5);
  return (
    <Screen onRefresh={() => Promise.all([attention.refetch(), latest.refetch()])} edges={['top', 'left', 'right']}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" accessibilityRole="header">{t('v3.uni.needsTitle')}</AppText>
          <AppText variant="caption" numberOfLines={1}>{localName(overview.data?.university) || session?.active_org?.org_name}</AppText>
        </View>
      </View>
      <Headline />
      {attention.isPending ? <LoadingState rows={4} /> : attention.isError ? <ErrorState error={attention.error} onRetry={() => void attention.refetch()} /> : <Decisions a={attention.data!} />}
      <View style={{ gap: 8 }}>
        {/* V4: the review queue is this list (no separate "N to review" row above it). */}
        <SectionTitle title={attention.data ? t('v4.uni.toReview', { count: attention.data.awaiting_review }) : t('v3.uni.latest')} action={t('v3.common.all')} onAction={() => router.push({ pathname: '/applicants', params: { view: 'review' } })} />
        <ApplicantList query={latest} emptyTitle={t('v3.uni.nothingToReview')} showCount={false} />
      </View>
    </Screen>
  );
}

/**
 * V26 (REPORT §337) put the web console's four headline figures in a 2×2 grid; V31 found that two "this week" zeros
 * then weighed exactly as much as the six items needing a decision (REPORT §433). V32: one figure leads — how many
 * applications need a decision — and the other three recede into a single quiet line of secondary counts, each still
 * the total of the exact list it opens. A zero is still shown (a quiet week is information) but is muted and opens nothing.
 */
function Headline() {
  const { t } = useTranslation();
  const api = useApi();
  const counts = useQueries({
    queries: HEAD_VIEWS.map((v) => ({ queryKey: ['applications', 'count', v], queryFn: () => api.applications.list({ ...viewQuery(v), page_size: 1 }), staleTime: 30_000 })),
  });
  const n = (v: HeadView) => counts[HEAD_VIEWS.indexOf(v)].data?.total;
  const decide = n('decide');
  const open = (v: HeadView) => router.push({ pathname: '/applicants', params: { view: v } });
  return (
    <View style={styles.head2} accessibilityRole="summary" accessibilityLabel={t('v26.uni.head.label')}>
      <Pressable disabled={!decide} onPress={() => open('decide')} accessibilityRole="button" accessibilityLabel={`${t('v26.uni.head.decide')} ${decide ?? 0}`}
        style={({ pressed }) => [styles.lead, pressed && { opacity: 0.6 }]}>
        <AppText variant="display" color={decide ? theme.color.primaryText : theme.color.textTertiary}>{decide ?? '–'}</AppText>
        <AppText variant="subheading">{t('v26.uni.head.decide')}</AppText>
        {decide ? <ChevronRight size={18} color={theme.color.textTertiary} /> : null}
      </Pressable>
      <View style={styles.secondary}>
        {(['requests', 'fresh', 'moved'] as HeadView[]).map((v) => {
          const c = n(v);
          return (
            <Pressable key={v} disabled={!c} onPress={() => open(v)} accessibilityRole="button" accessibilityLabel={`${t(`v26.uni.head.${v}`)} ${c ?? 0}`}
              style={({ pressed }) => [styles.secondaryItem, pressed && { opacity: 0.6 }]}>
              <AppText variant="subheading" color={c ? theme.color.text : theme.color.textTertiary}>{c ?? '–'}</AppText>
              <AppText variant="caption" numberOfLines={2} color={c ? theme.color.textSecondary : theme.color.textTertiary}>{t(`v26.uni.head.${v}`)}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Decisions({ a }: { a: UniversityAttention }) {
  const { t } = useTranslation();
  const rows = [
    { key: 'returned', n: a.documents_returned, view: 'review' },
    { key: 'documents', n: a.waiting_for_documents },
    { key: 'interview', n: a.interviews },
    { key: 'offer', n: a.offers_awaiting_response },
    { key: 'admitted', n: a.tuition_pending },
    { key: 'flagged', n: a.flagged },
  ];
  const active = rows.filter((r) => r.n > 0);
  return (
    <View style={{ gap: 8 }}>
      {active.length ? (
        <ListGroup>
          {active.map((r) => (
            <Pressable key={r.key} onPress={() => router.push({ pathname: '/applicants', params: { view: r.view ?? r.key } })} accessibilityRole="button"
              accessibilityLabel={t(`v3.uni.decision.${r.key}`, { count: r.n })} android_ripple={{ color: 'rgba(24,26,31,0.06)' }}
              style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && { opacity: 0.6 }]}>
              <AppText variant="metric" style={styles.count} color={r.key === 'review' || r.key === 'returned' ? theme.color.primaryText : theme.color.text}>{r.n}</AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="subheading">{t(`v3.uni.decision.${r.key}`, { count: r.n })}</AppText>
                <AppText variant="caption">{t(`v3.uni.decisionHint.${r.key}`)}</AppText>
              </View>
              <ChevronRight size={18} color={theme.color.textTertiary} />
            </Pressable>
          ))}
        </ListGroup>
      ) : a.awaiting_review ? null : (
        <View style={styles.clear}><CircleCheck size={16} color={theme.status.success.fg} /><AppText variant="body">{t('v3.uni.allClear')}</AppText></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, minHeight: 64 },
  count: { minWidth: 36, textAlign: 'center' },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  head2: { gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  lead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  secondary: { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  secondaryItem: { flex: 1, gap: 2 },
});
