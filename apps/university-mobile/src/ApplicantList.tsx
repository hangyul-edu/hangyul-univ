import { useApi } from '@hangyul/auth';
import { useTranslation, localName } from '@hangyul/i18n';
import { AppText, EmptyState, ErrorState, ListGroup, ListItem, LoadingState, StatusBadge, StatusText, useFormat } from '@hangyul/mobile-ui';
import type { Application } from '@hangyul/types';
import { countryName } from '@hangyul/utils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { UserSearch } from 'lucide-react-native';
import { View } from 'react-native';

import { viewQuery, type ViewKey } from './views';

export function useApplicants(view: ViewKey, q = '', pageSize = 100) {
  const api = useApi();
  return useQuery({
    queryKey: ['applications', { view, q, pageSize }],
    queryFn: () => api.applications.list({ ...viewQuery(view), q: q || undefined, sort: 'updated', page_size: pageSize }),
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

/** Applicant · program · intake, then status in words; nationality and submission date as quiet metadata. */
export function ApplicantRow({ a }: { a: Application }) {
  const { t } = useTranslation();
  const f = useFormat();
  const name = a.student?.full_name ?? t('university.applicants.anonymous');
  const intake = t('common:intakeLabel', { term: t(`common:term.${a.intake.term}`), year: a.intake.year });
  return (
    <ListItem
      title={name}
      subtitle={`${localName(a.program)} · ${intake}`}
      meta={[a.student?.nationality ? countryName(a.student.nationality, f.locale) : null, a.submitted_at ? t('university.applicants.submitted', { date: f.dateShort(a.submitted_at) }) : null].filter(Boolean).join(' · ')}
      footer={<View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 }}><StatusBadge kind="application" value={a.status} />{a.eligibility?.status === 'BELOW' ? <StatusText label={t('v3.uni.check.state.below')} tone="danger" hollow /> : null}{a.open_document_requests ? <StatusText label={t('v3.uni.openRequests', { count: a.open_document_requests })} tone="warning" hollow /> : null}{a.flagged ? <StatusText label={t('university.flagged.flagged')} tone="danger" /> : null}</View>}
      onPress={() => router.push(`/applicants/${a.id}`)}
    />
  );
}
