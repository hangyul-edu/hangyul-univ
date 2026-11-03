import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { AppText, ChipGroup, EmptyState, IconButton, ListGroup, ListItem, QueryState, Screen, StatusBadge, TextField, theme, useFormat, taskTitle } from '@hangyul/mobile-ui';
import type { AgencySavedView, AgencyStudentRow } from '@hangyul/types';
import { flagEmoji } from '@hangyul/utils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Search, Users, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';

const BUILT_IN = ['mine', 'attention', 'waiting_us', 'waiting_student', 'deadline', 'docs', 'university', 'visa', 'all'] as const;

/** Find a student in seconds; the same views the team uses on the web, including their saved views. */
export default function StudentsScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const params = useLocalSearchParams<{ q?: string; view?: string }>();
  const [input, setInput] = useState(params.q ?? '');
  const [q, setQ] = useState(params.q ?? '');
  const [view, setView] = useState<string>(params.view ?? 'mine');
  useEffect(() => { if (params.view) setView(params.view); if (params.q !== undefined) { setInput(params.q); setQ(params.q); } }, [params.view, params.q]);
  useEffect(() => { const h = setTimeout(() => setQ(input.trim()), 300); return () => clearTimeout(h); }, [input]);
  const counts = useQuery({ queryKey: ['agency', 'views'], queryFn: () => api.agency.studentViews(), staleTime: 60_000 });
  const saved = useQuery({ queryKey: ['agency', 'saved-views'], queryFn: () => api.agency.savedViews(), staleTime: 5 * 60_000 });
  const savedView: AgencySavedView | undefined = (saved.data ?? []).find((v) => `saved:${v.id}` === view);
  const query = useMemo(() => {
    if (savedView) return { ...(savedView.filters as Record<string, string>), q: q || undefined, page_size: 100 };
    if (view === 'sla') return { sla_breached: true, q: q || undefined, page_size: 100 };
    return { view: view === 'all' ? undefined : view, q: q || undefined, page_size: 100 };
  }, [savedView, view, q]);
  const list = useQuery({ queryKey: ['agency', 'students', query], queryFn: () => api.agency.students(query), placeholderData: keepPreviousData });
  const c = counts.data as Record<string, number> | undefined;

  return (
    <Screen title={t('common:nav.students')} onRefresh={() => Promise.all([list.refetch(), counts.refetch(), saved.refetch()])}>
      <TextField label={t('v3.agency.findStudent')} hideLabel placeholder={t('v3.agency.searchPlaceholder')} value={input} onChangeText={setInput} autoCorrect={false}
        trailing={input ? <IconButton icon={X} size={18} accessibilityLabel={t('student.explore.clear')} onPress={() => setInput('')} /> : <Search size={18} color={theme.color.textTertiary} />} />
      <ChipGroup
        options={[
          ...BUILT_IN.map((v) => ({ value: v as string, label: c?.[v] !== undefined ? `${t(`v3.agency.view.${v}`)} · ${c[v]}` : t(`v3.agency.view.${v}`) })),
          ...(saved.data ?? []).map((v) => ({ value: `saved:${v.id}`, label: v.scope === 'TEAM' ? t('v3.agency.teamView', { name: v.name }) : v.name })),
        ]}
        selected={[view]}
        onToggle={setView}
      />
      {view === 'sla' ? <AppText variant="caption">{t('v3.agency.view.sla')}</AppText> : null}
      <QueryState query={list}>
        {(page) => page.items.length === 0 ? <EmptyState icon={Users} title={t('v3.agency.noStudents')} body={t('v3.agency.noStudentsBody')} /> : (
          <>
            <AppText variant="caption">{t('common:table.results', { count: page.total })}</AppText>
            <ListGroup>{page.items.map((s) => <Row key={s.id} s={s} due={f.due} />)}</ListGroup>
          </>
        )}
      </QueryState>
    </Screen>
  );
}

function Row({ s, due }: { s: AgencyStudentRow; due: (d: string) => string }) {
  const { t } = useTranslation();
  const intake = (v: string | null) => { const m = v?.match(/^(\d{4})-(\w+)$/); return m ? t('common:intakeLabel', { term: t(`common:term.${m[2]}`), year: m[1] }) : v; };
  const next = s.next_task ? taskTitle(t, s.next_task) : null;
  const meta = [
    s.next_deadline ? t('v3.agency.deadline', { uni: s.next_deadline.university, when: due(s.next_deadline.date) }) : null,
    s.documents_to_fix ? t('v3.agency.toFix', { count: s.documents_to_fix }) : null,
    s.waiting_on ? t(`v3.agency.waitingOn.${s.waiting_on}`) : null,
  ].filter(Boolean).join(' · ');
  return (
    <ListItem
      title={`${s.nationality ? `${flagEmoji(s.nationality)} ` : ''}${s.full_name}`}
      subtitle={next ? t('v3.agency.nextAction', { what: next }) : intake(s.target_intake)}
      meta={meta || null}
      footer={<StatusBadge kind="pipeline" value={s.pipeline_stage} />}
      onPress={() => router.push(`/students/${s.id}`)}
    />
  );
}
