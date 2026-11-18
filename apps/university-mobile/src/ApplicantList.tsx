import { useApi } from '@hangyul/auth';
import { MARKETS, useTranslation, localName } from '@hangyul/i18n';
import { AppText, EmptyState, ErrorState, ListGroup, ListItem, LoadingState, MarketFlag, StatusBadge, StatusText, theme, useFormat } from '@hangyul/mobile-ui';
import type { Application } from '@hangyul/types';
import { countryName } from '@hangyul/utils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { UserSearch } from 'lucide-react-native';
import { View } from 'react-native';

import { AWAITING_DECISION, viewQuery, type ViewKey } from './views';

/** `sort: 'decision'` is the web console's default order (GET /applications): the applicants that can be decided first. */
export function useApplicants(view: ViewKey, q = '', pageSize = 100, sort: 'updated' | 'decision' = 'updated') {
  const api = useApi();
  return useQuery({
    queryKey: ['applications', { view, q, pageSize, sort }],
    queryFn: () => api.applications.list({ ...viewQuery(view), q: q || undefined, sort, page_size: pageSize }),
    placeholderData: keepPreviousData,
  });
}

export function ApplicantList({ query, emptyTitle, emptyBody, showCount = true }: { query: ReturnType<typeof useApplicants>; emptyTitle: string; emptyBody?: string; showCount?: boolean }) {
  const { t } = useTranslation();
  if (query.isPending) return <LoadingState rows={5} />;
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const items = query.data?.items ?? [];
  if (items.length === 0) return <EmptyState icon={UserSearch} title={emptyTitle} body={emptyBody} compact />;
  return (
    <View style={{ gap: 8 }}>
      {showCount ? <AppText variant="caption">{t('common:table.results', { count: query.data?.total ?? items.length })}</AppText> : null}
      <ListGroup>{items.map((a) => <ApplicantRow key={a.id} a={a} />)}</ListGroup>
    </View>
  );
}

/**
 * Name first, then program · intake and where the applicant is from; the status in words; and, while a decision is
 * still open, what that decision needs — a minimum not met, a document request waiting, how many required documents
 * are verified. Only fields the list API returns; a country without a flag asset shows its name alone (never an emoji).
 */
export function ApplicantRow({ a }: { a: Application }) {
  const { t } = useTranslation();
  const f = useFormat();
  const name = a.student?.full_name ?? t('university.applicants.anonymous');
  const intake = t('common:intakeLabel', { term: t(`common:term.${a.intake.term}`), year: a.intake.year });
  const nat = a.student?.nationality ?? null;
  const country = nat ? countryName(nat, f.locale) : null;
  const hasFlag = !!nat && MARKETS.some((m) => m.code === nat);
  const submitted = a.submitted_at ? t('university.applicants.submitted', { date: f.dateShort(a.submitted_at) }) : null;
  const where = [country, submitted].filter(Boolean).join(' · ');
  const awaiting = AWAITING_DECISION.includes(a.status);
  const docs = awaiting && a.documents?.required ? t('university.applicants.checklistProgress', { ready: a.documents.verified, total: a.documents.required }) : null;
  const docsDone = !!a.documents && a.documents.verified >= a.documents.required;
  const status = t(`common:appStatus.${a.status}`);
  const needs = [
    a.eligibility?.status === 'BELOW' ? t('v3.uni.check.state.below') : null,
    a.open_document_requests ? t('v3.uni.openRequests', { count: a.open_document_requests }) : null,
    docs,
    a.flagged ? t('university.flagged.flagged') : null,
  ].filter(Boolean);
  return (
    <ListItem
      title={name}
      subtitle={`${localName(a.program)} · ${intake}`}
      accessibilityLabel={[name, `${localName(a.program)} · ${intake}`, where, status, ...needs].filter(Boolean).join('. ')}
      footer={(
        <View style={{ gap: 6 }}>
          {where ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {hasFlag ? <MarketFlag code={nat ?? undefined} height={12} /> : null}
              <AppText variant="caption" color={theme.color.textTertiary} numberOfLines={1} style={{ flexShrink: 1 }}>{where}</AppText>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 }}>
            <StatusBadge kind="application" value={a.status} />
            {a.eligibility?.status === 'BELOW' ? <StatusText label={t('v3.uni.check.state.below')} tone="danger" hollow /> : null}
            {a.open_document_requests ? <StatusText label={t('v3.uni.openRequests', { count: a.open_document_requests })} tone="warning" hollow /> : null}
            {docs ? <StatusText label={docs} tone={docsDone ? 'success' : 'neutral'} hollow={!docsDone} /> : null}
            {a.flagged ? <StatusText label={t('university.flagged.flagged')} tone="danger" /> : null}
          </View>
        </View>
      )}
      onPress={() => router.push(`/applicants/${a.id}`)}
    />
  );
}
