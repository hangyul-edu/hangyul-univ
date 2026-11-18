import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { AppText, ChipGroup, EmptyState, IconButton, ListGroup, QueryState, Screen, TextField, theme, useFormat } from '@hangyul/mobile-ui';
import type { AgencySavedView } from '@hangyul/types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Search, Users, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';

import { StudentRow } from '../../src/StudentRow';

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
    // Today's first-response row counts "past or near the promise" (server `sla_risk`), so this list uses the same predicate.
    if (view === 'sla') return { sla_risk: true, q: q || undefined, page_size: 100 };
    return { view: view === 'all' ? undefined : view, q: q || undefined, page_size: 100 };
  }, [savedView, view, q]);
  const list = useQuery({ queryKey: ['agency', 'students', query], queryFn: () => api.agency.students(query), placeholderData: keepPreviousData });
  const c = counts.data as Record<string, number> | undefined;

  return (
    <Screen title={t('common:nav.students')} onRefresh={() => Promise.all([list.refetch(), counts.refetch(), saved.refetch()])}>
      <TextField label={t('v3.agency.findStudent')} hideLabel placeholder={t('v3.agency.searchPlaceholder')} value={input} onChangeText={setInput} autoCorrect={false}
        trailing={input ? <IconButton icon={X} size={18} accessibilityLabel={t('agency.students.clear')} onPress={() => setInput('')} /> : <Search size={18} color={theme.color.textTertiary} />} />
      <ChipGroup
        options={[
          ...BUILT_IN.map((v) => ({ value: v as string, label: c?.[v] !== undefined ? `${t(`v3.agency.view.${v}`)} · ${c[v]}` : t(`v3.agency.view.${v}`) })),
          ...(saved.data ?? []).map((v) => ({ value: `saved:${v.id}`, label: v.scope === 'TEAM' ? t('v3.agency.teamView', { name: v.name }) : v.name })),
        ]}
        selected={[view]}
        onToggle={setView}
      />
      {/* Views opened from Today that have no chip of their own say what they list. */}
      {view === 'sla' ? <AppText variant="caption">{t('v3.agency.view.sla')}</AppText> : null}
      {view === 'deadline7' ? <AppText variant="caption">{t('v3.agency.att.closingStudents', { count: 2 })}</AppText> : null}
      <QueryState query={list}>
        {(page) => page.items.length === 0 ? <EmptyState icon={Users} title={t('v3.agency.noStudents')} body={t('v3.agency.noStudentsBody')} /> : (
          <>
            <AppText variant="caption">{t('common:table.results', { count: page.total })}</AppText>
            <ListGroup>{page.items.map((s) => <StudentRow key={s.id} s={s} due={f.due} />)}</ListGroup>
          </>
        )}
      </QueryState>
    </Screen>
  );
}
