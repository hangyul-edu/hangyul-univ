import { useApi } from '@hangyul/auth';
import { useTranslation, localName } from '@hangyul/i18n';
import { EmptyState, ListGroup, ListItem, QueryState, Screen, SegmentedControl, StatusBadge, useFormat } from '@hangyul/mobile-ui';
import type { Application, ApplicationStatus } from '@hangyul/types';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { GraduationCap } from 'lucide-react-native';
import { useState } from 'react';

import { qk } from '../../src/queries';

const CLOSED: ApplicationStatus[] = ['REJECTED', 'WITHDRAWN', 'ENROLLED'];
type Filter = 'active' | 'closed';

export default function ApplicationsScreen() {
  const { t } = useTranslation();
  const api = useApi();
  const [filter, setFilter] = useState<Filter>('active');
  const apps = useQuery({ queryKey: qk.applications, queryFn: () => api.applications.list({ page_size: 100 }) });
  const all = apps.data?.items ?? [];
  const active = all.filter((a) => !CLOSED.includes(a.status));
  const closed = all.filter((a) => CLOSED.includes(a.status));
  const shown = filter === 'active' ? active : closed;

  return (
    <Screen title={t('common:nav.applications')} subtitle={t('student.applications.subtitle')} onRefresh={() => apps.refetch()}>
      <SegmentedControl<Filter>
        options={[
          { value: 'active', label: t('student.applications.active'), count: active.length },
          { value: 'closed', label: t('student.applications.closed'), count: closed.length },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <QueryState query={apps}>
        {() =>
          shown.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title={filter === 'active' ? t('student.applications.empty') : t('student.applications.emptyClosed')}
              body={filter === 'active' ? t('student.applications.emptyBody') : undefined}
              actionLabel={filter === 'active' ? t('v3.home.findUniversities') : undefined}
              onAction={() => router.push('/explore')}
            />
          ) : (
            <ListGroup>{shown.map((a) => <ApplicationRow key={a.id} app={a} />)}</ListGroup>
          )
        }
      </QueryState>
    </Screen>
  );
}

function ApplicationRow({ app: a }: { app: Application }) {
  const { t } = useTranslation();
  const f = useFormat();
  const intake = t('common:intakeLabel', { term: t(`common:term.${a.intake.term}`), year: a.intake.year });
  const preSubmit = ['DRAFT', 'PROFILE_REVIEW', 'DOCUMENT_PREPARATION', 'READY'].includes(a.status);
  const meta = preSubmit
    ? t('v3.home.closes', { date: f.deadlineShort(a.intake.application_deadline), left: f.due(a.intake.application_deadline) })
    : a.submitted_at ? t('student.applications.submittedOn', { date: f.date(a.submitted_at) }) : null;
  return (
    <ListItem title={localName(a.university)} subtitle={`${localName(a.program)} · ${intake}`} meta={meta}
      footer={<StatusBadge kind="application" value={a.status} />} onPress={() => router.push(`/applications/${a.id}`)} />
  );
}
