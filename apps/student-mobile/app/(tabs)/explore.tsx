import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import {
  AppText, Button, ChipGroup, EmptyState, ErrorState, IconButton, ListGroup, ListItem, LoadingState, Screen, SegmentedControl, Sheet, StatusText,
  TextField, theme, useFormat,
} from '@hangyul/mobile-ui';
import type { DegreeLevel, InstructionLanguage, Match, Program } from '@hangyul/types';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Heart, Search, SearchX, SlidersHorizontal, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useReasonText } from '../../src/components';
import { matchMeta } from '../../src/journey';
import { qk, useSaved } from '../../src/queries';

const PAGE_SIZE = 20;
type Tab = 'foryou' | 'all' | 'saved';
type Verdict = 'strong' | 'possible' | 'notyet';
const DEGREES: DegreeLevel[] = ['LANGUAGE', 'BACHELOR', 'TRANSFER', 'MASTER', 'DOCTORATE'];
const TUITION = ['', '3500000', '4500000', '5500000'] as const;

export function useMatches() {
  const api = useApi();
  return useQuery({ queryKey: qk.matches, queryFn: () => api.me.matches({ limit: 120 }), staleTime: 5 * 60_000 });
}

/** One place to find programs: personal matches first, the full catalogue second, the shortlist third. */
export default function UniversitiesScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('foryou');
  const matches = useMatches();
  const saved = useSaved();
  return (
    <Screen title={t('common:nav.universities')} onRefresh={() => Promise.all([matches.refetch(), saved.refetch()])}>
      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'foryou', label: t('v3.discover.forYou') },
          { value: 'all', label: t('v3.discover.all') },
          { value: 'saved', label: t('v3.discover.saved', { count: saved.data?.length ?? 0 }) },
        ]}
      />
      {tab === 'foryou' ? <ForYou /> : tab === 'all' ? <AllPrograms /> : <Saved />}
    </Screen>
  );
}

function ForYou() {
  const { t } = useTranslation();
  const matches = useMatches();
  const [verdict, setVerdict] = useState<Verdict>('strong');
  if (matches.isPending) return <LoadingState rows={5} />;
  if (matches.isError && !matches.data) return <ErrorState error={matches.error} onRetry={() => void matches.refetch()} />;
  const d = matches.data!;
  const byVerdict: Record<Verdict, Match[]> = {
    strong: d.items.filter((m) => m.tier === 'STRONG'),
    possible: d.items.filter((m) => m.tier === 'COMPETITIVE'),
    notyet: d.items.filter((m) => m.tier === 'REACH' || m.tier === 'NOT_ELIGIBLE'),
  };
  const items = byVerdict[verdict];
  return (
    <>
      <AppText variant="body">{t('v3.discover.summary', { count: byVerdict.strong.length + byVerdict.possible.length })}</AppText>
      <ChipGroup<Verdict>
        options={[
          { value: 'strong', label: `${t('v3.match.strong')} · ${byVerdict.strong.length}` },
          { value: 'possible', label: `${t('v3.match.possible')} · ${byVerdict.possible.length}` },
          { value: 'notyet', label: `${t('v3.match.notYet')} · ${byVerdict.notyet.length}` },
        ]}
        selected={[verdict]}
        onToggle={setVerdict}
      />
      <AppText variant="caption">{t(`v3.discover.explain.${verdict}`)}</AppText>
      {items.length === 0 ? (
        <EmptyState icon={SearchX} title={t('v3.discover.emptyVerdict')} compact />
      ) : (
        <ListGroup>{items.map((m) => <ProgramRow key={m.program_id} program={m.program} match={m} tierShown={verdict !== 'notyet'} />)}</ListGroup>
      )}
    </>
  );
}

function AllPrograms() {
  const { t } = useTranslation();
  const api = useApi();
  const matches = useMatches();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [degrees, setDegrees] = useState<DegreeLevel[]>([]);
  const [lang, setLang] = useState<InstructionLanguage[]>([]);
  const [maxTuition, setMaxTuition] = useState<(typeof TUITION)[number]>('');
  const [openOnly, setOpenOnly] = useState(false);
  useEffect(() => { const h = setTimeout(() => setQ(input.trim()), 350); return () => clearTimeout(h); }, [input]);
  const byProgram = useMemo(() => new Map((matches.data?.items ?? []).map((m) => [m.program_id, m])), [matches.data]);
  const programs = useInfiniteQuery({
    queryKey: [...qk.programs(q, degrees), lang, maxTuition, openOnly],
    queryFn: ({ pageParam }) => api.catalog.programs({ q, degree: degrees, language: lang, max_tuition: maxTuition || undefined, open_only: openOnly || undefined, page: pageParam, page_size: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.page_size < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
  const items = programs.data?.pages.flatMap((p) => p.items) ?? [];
  const total = programs.data?.pages[0]?.total ?? 0;
  const active = degrees.length + lang.length + (maxTuition ? 1 : 0) + (openOnly ? 1 : 0);
  const clear = () => { setDegrees([]); setLang([]); setMaxTuition(''); setOpenOnly(false); };
  const toggle = <T,>(set: (fn: (c: T[]) => T[]) => void) => (v: T) => set((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]));
  return (
    <>
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <TextField label={t('common:actions.search')} hideLabel placeholder={t('student.explore.searchPlaceholder')} value={input} onChangeText={setInput}
            returnKeyType="search" autoCorrect={false}
            trailing={input ? <IconButton icon={X} size={18} accessibilityLabel={t('student.explore.clear')} onPress={() => setInput('')} /> : <Search size={18} color={theme.color.textTertiary} />} />
        </View>
        <Button label={active ? t('v3.discover.filtersN', { count: active }) : t('v3.discover.filters')} variant="secondary" icon={SlidersHorizontal} onPress={() => setOpen(true)} />
      </View>
      {active ? (
        <View style={styles.activeRow}>
          <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
            {[...degrees.map((d) => t(`common:degreeShort.${d}`)), ...lang.map((l) => t(`common:instruction.${l}`)), maxTuition ? t('v3.discover.upTo', { amount: Number(maxTuition) / 1_000_000 }) : null, openOnly ? t('v3.discover.openOnly') : null].filter(Boolean).join(' · ')}
          </AppText>
          <Pressable onPress={clear} accessibilityRole="button" hitSlop={10}><AppText variant="caption" weight="semibold" color={theme.color.primaryText}>{t('common:actions.clearFilters')}</AppText></Pressable>
        </View>
      ) : null}
      {programs.isPending ? <LoadingState rows={5} /> : programs.isError && !programs.data ? (
        <ErrorState error={programs.error} onRetry={() => void programs.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={SearchX} title={t('common:states.noResults')} actionLabel={t('common:actions.clearFilters')} onAction={() => { setInput(''); clear(); }} />
      ) : (
        <>
          <AppText variant="caption" accessibilityLiveRegion="polite">{t('common:table.results', { count: total })}</AppText>
          <ListGroup>{items.map((p) => <ProgramRow key={p.id} program={p} match={byProgram.get(p.id)} />)}</ListGroup>
          {programs.hasNextPage ? <Button label={t('common:actions.loadMore')} variant="secondary" onPress={() => void programs.fetchNextPage()} loading={programs.isFetchingNextPage} /> : null}
        </>
      )}
      <Sheet visible={open} title={t('v3.discover.filters')} onClose={() => setOpen(false)} closeLabel={t('common:actions.cancel')}
        footer={<Button label={t('v3.discover.showResults', { count: total })} onPress={() => setOpen(false)} fullWidth />}>
        <View style={{ gap: 8 }}>
          <AppText variant="subheading">{t('v3.discover.degree')}</AppText>
          <ChipGroup options={DEGREES.map((d) => ({ value: d, label: t(`common:degreeShort.${d}`) }))} selected={degrees} onToggle={toggle(setDegrees)} />
        </View>
        <View style={{ gap: 8 }}>
          <AppText variant="subheading">{t('v3.discover.language')}</AppText>
          <ChipGroup<InstructionLanguage> options={(['KOREAN', 'ENGLISH', 'BILINGUAL'] as InstructionLanguage[]).map((l) => ({ value: l, label: t(`common:instruction.${l}`) }))} selected={lang} onToggle={toggle(setLang)} />
        </View>
        <View style={{ gap: 8 }}>
          <AppText variant="subheading">{t('v3.discover.tuition')}</AppText>
          <ChipGroup options={TUITION.map((v) => ({ value: v, label: v ? t('v3.discover.upTo', { amount: Number(v) / 1_000_000 }) : t('v3.discover.any') }))} selected={[maxTuition]} onToggle={(v) => setMaxTuition(v)} />
        </View>
        <ChipGroup options={[{ value: 'open', label: t('v3.discover.openOnly') }]} selected={openOnly ? ['open'] : []} onToggle={() => setOpenOnly(!openOnly)} />
      </Sheet>
    </>
  );
}

function Saved() {
  const { t } = useTranslation();
  const saved = useSaved();
  if (saved.isPending) return <LoadingState rows={3} />;
  if (!saved.data?.length) return <EmptyState icon={Heart} title={t('v3.discover.savedEmpty')} body={t('v3.discover.savedEmptyBody')} />;
  return (
    <ListGroup>
      {saved.data.map((u) => (
        <ListItem key={u.id} title={u.name_en} subtitle={`${u.city} · ${t(`common:institution.${u.institution_type}`)}`} onPress={() => router.push(`/universities/${u.slug}`)} />
      ))}
    </ListGroup>
  );
}

/** A result row: identity, verdict + the one gap that matters, then cost · language · deadline. Save is a sibling control. */
/** `tierShown`: the list is already grouped by tier (heading says it), so the row doesn't repeat the verdict (V4). */
export function ProgramRow({ program: p, match, tierShown }: { program: Program; match?: Match; tierShown?: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const qc = useQueryClient();
  const saved = useSaved();
  const reason = useReasonText();
  const uni = p.university;
  const isSaved = !!uni && (saved.data ?? []).some((u) => u.id === uni.id);
  const toggle = useMutation({
    mutationFn: () => (isSaved ? api.me.unsave(uni!.id) : api.me.save(uni!.id, p.id)),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.saved }),
  });
  const meta = match ? matchMeta(match.tier) : null;
  const gap = match?.reasons.find((r) => r.kind === 'missing');
  const yearly = match?.estimated_annual_cost_krw ?? p.estimated_annual_cost_krw ?? null;
  const next = match?.intake ?? p.next_intake ?? null;
  const lang = p.requirements?.min_topik_level ? `TOPIK ${p.requirements.min_topik_level}` : p.requirements?.min_ielts ? `IELTS ${p.requirements.min_ielts}` : t('v3.discover.noLanguageMin');
  // V4 one cost model: "₩A–₩B first year" (tuition + fees + living, before scholarship) when the budget service has it.
  const range = match?.first_year_range_krw ?? p.first_year_range_krw;
  const cost = range?.low && range.high
    ? t('v4.discover.firstYear', { range: range.low === range.high ? f.money(range.low, 'KRW', true) : `${f.money(range.low, 'KRW', true)}–${f.money(range.high, 'KRW', true)}` })
    : yearly ? t('v3.discover.perYear', { amount: f.money(yearly, 'KRW', true) }) : null;
  const facts = [cost, lang, next ? t('v3.discover.closes', { date: f.deadlineShort(next.application_deadline) }) : null].filter(Boolean).join(' · ');
  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.rowMain, pressed && Platform.OS === 'ios' && { opacity: 0.6 }]}
        onPress={() => uni && router.push({ pathname: '/universities/[slug]', params: { slug: uni.slug, program: p.id } })}
        accessibilityRole="button"
        accessibilityLabel={[p.name_en, uni?.name_en, meta ? t(meta.key) : null, gap ? reason(gap) : null, facts].filter(Boolean).join(', ')}
        android_ripple={{ color: 'rgba(24,26,31,0.06)' }}
      >
        {/* V4: university first (what a student recognises), then the program. */}
        {uni ? <AppText variant="caption" weight="semibold" color={theme.color.textSecondary} numberOfLines={1}>{uni.name_en} · {uni.city}</AppText> : null}
        <AppText variant="subheading" numberOfLines={2}>{p.name_en} <AppText variant="caption">· {t(`common:degreeShort.${p.degree_level}`)}</AppText></AppText>
        {meta && !(tierShown && !gap) ? (
          <View style={{ gap: 2, marginTop: 4 }}>
            {tierShown ? null : <StatusText label={t(meta.key)} tone={meta.tone} />}
            {gap ? <AppText variant="caption" color={theme.color.textSecondary} numberOfLines={2}>{reason(gap)}</AppText> : null}
          </View>
        ) : null}
        <AppText variant="caption" color={theme.color.textTertiary} style={{ marginTop: 4 }}>{facts}</AppText>
      </Pressable>
      {uni ? (
        <IconButton icon={Heart} color={isSaved ? theme.color.primary : theme.color.textTertiary}
          accessibilityLabel={isSaved ? t('student.explore.unsave', { name: uni.name_en }) : t('student.explore.save', { name: uni.name_en })}
          onPress={() => toggle.mutate()} disabled={toggle.isPending} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: -8 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowMain: { flex: 1, paddingVertical: 14, paddingStart: 16, gap: 2 },
});
