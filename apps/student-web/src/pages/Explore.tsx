import { useApi } from '@hangyul/auth';
import { Info, Search, SlidersHorizontal, UserCheck, X } from '@hangyul/icons';
import { DEGREE_LEVELS, type Match } from '@hangyul/types';
import { Button, ButtonLink, Callout, Chip, Drawer, EmptyState, ErrorState, Field, SearchInput, Segmented, FilterSelect, Select, Skeleton, Switch, Tabs } from '@hangyul/ui';
import { ELIGIBILITY_GROUPS, eligibilityGroup, formatMoney, formatNumber, isOtherDegree, type EligibilityGroup } from '@hangyul/utils';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';

import { PageIntro } from '../components/bits';
import { ProgramGroups, UniversityGroup, groupByUniversity } from '../components/ProgramRow';
import { SavedList } from './Saved';
import { RoutesCard } from '../components/Routes';
import { useT } from '../lib/i18n';
import type { LanguageRoutes } from '../lib/routes';
import { useMyMatches, useProfile, useSaved, useTaxonomy } from '../lib/queries';

const PAGE_SIZE = 12;
/** URL keys that never mean "the student searched" (V26, REPORT §334 S1: `?lang=ko` opened the full list). */
export const NON_FILTER_KEYS = new Set(['tab', 'verdict', 'lang', 'welcome', 'from']);
const LIST_KEYS = ['degree', 'field', 'region', 'institution_type', 'language'] as const;
const BOOL_KEYS = ['has_scholarship', 'has_dorm', 'partner_only', 'open_only'] as const;
const NUM_KEYS = ['max_tuition', 'max_topik', 'max_ielts'] as const;
type ListKey = (typeof LIST_KEYS)[number];
type BoolKey = (typeof BOOL_KEYS)[number];
type NumKey = (typeof NUM_KEYS)[number];

export interface Filters {
  q: string;
  sort: string;
  intake_term: string;
  lists: Record<ListKey, string[]>;
  bools: Record<BoolKey, boolean>;
  nums: Record<NumKey, string>;
}

export function parseFilters(sp: URLSearchParams): Filters {
  return {
    q: sp.get('q') ?? '',
    sort: sp.get('sort') ?? 'relevance',
    intake_term: sp.get('intake_term') ?? '',
    lists: Object.fromEntries(LIST_KEYS.map((k) => [k, sp.getAll(k)])) as Filters['lists'],
    bools: Object.fromEntries(BOOL_KEYS.map((k) => [k, sp.get(k) === '1'])) as Filters['bools'],
    nums: Object.fromEntries(NUM_KEYS.map((k) => [k, sp.get(k) ?? ''])) as Filters['nums'],
  };
}

export function toSearch(f: Filters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set('q', f.q);
  if (f.sort && f.sort !== 'relevance') sp.set('sort', f.sort);
  if (f.intake_term) sp.set('intake_term', f.intake_term);
  LIST_KEYS.forEach((k) => f.lists[k].forEach((v) => sp.append(k, v)));
  BOOL_KEYS.forEach((k) => { if (f.bools[k]) sp.set(k, '1'); });
  NUM_KEYS.forEach((k) => { if (f.nums[k]) sp.set(k, f.nums[k]); });
  return sp;
}

export function activeCount(f: Filters): number {
  return LIST_KEYS.reduce((s, k) => s + f.lists[k].length, 0) + BOOL_KEYS.filter((k) => f.bools[k]).length + NUM_KEYS.filter((k) => f.nums[k]).length + (f.intake_term ? 1 : 0);
}

function toQuery(f: Filters) {
  return {
    q: f.q || undefined,
    sort: f.sort,
    intake_term: f.intake_term || undefined,
    ...f.lists,
    ...Object.fromEntries(BOOL_KEYS.map((k) => [k, f.bools[k] || undefined])),
    ...Object.fromEntries(NUM_KEYS.map((k) => [k, f.nums[k] || undefined])),
  };
}

function ChipGroup({ label, values, selected, onChange, render }: { label: string; values: string[]; selected: string[]; onChange: (v: string[]) => void; render: (v: string) => ReactNode }) {
  return (
    <fieldset className="st-group">
      <legend className="st-group__label">{label}</legend>
      <div className="hg-row-wrap" style={{ '--hg-gap': '6px' } as React.CSSProperties}>
        {values.map((v) => (
          <Chip key={v} pressed={selected.includes(v)} onClick={() => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])}>{render(v)}</Chip>
        ))}
      </div>
    </fieldset>
  );
}

function FilterPanel({ f, set }: { f: Filters; set: (f: Filters) => void }) {
  const { t, locale } = useT();
  const tax = useTaxonomy();
  const list = (k: ListKey) => (v: string[]) => set({ ...f, lists: { ...f.lists, [k]: v } });
  const num = (k: NumKey) => (v: string) => set({ ...f, nums: { ...f.nums, [k]: v } });
  const bool = (k: BoolKey) => (v: boolean) => set({ ...f, bools: { ...f.bools, [k]: v } });
  return (
    <div className="sx-filters">
      <ChipGroup label={t('explore.filters.degree')} values={DEGREE_LEVELS.filter((d) => d !== 'COMBINED')} selected={f.lists.degree} onChange={list('degree')} render={(v) => t(`common:degreeShort.${v}`)} />
      <ChipGroup label={t('explore.filters.language')} values={['KOREAN', 'ENGLISH', 'BILINGUAL']} selected={f.lists.language} onChange={list('language')} render={(v) => t(`common:instruction.${v}`)} />
      <Field label={t('explore.filters.maxTuition')} htmlFor="f-tuition">
        <Select id="f-tuition" value={f.nums.max_tuition} onChange={(e) => num('max_tuition')(e.target.value)}>
          <option value="">{t('explore.filters.any')}</option>
          {[2_500_000, 3_500_000, 4_500_000, 5_500_000, 7_000_000].map((v) => <option key={v} value={v}>{t('explore.filters.upTo', { amount: formatMoney(v, 'KRW', locale, { compact: true }) })}</option>)}
        </Select>
      </Field>
      <Field label={t('explore.filters.myTopik')} htmlFor="f-topik" hint={t('explore.filters.myTopikHint')}>
        <Select id="f-topik" value={f.nums.max_topik} onChange={(e) => num('max_topik')(e.target.value)}>
          <option value="">{t('explore.filters.any')}</option>
          <option value="0">{t('explore.filters.noTopik')}</option>
          {[1, 2, 3, 4, 5, 6].map((v) => <option key={v} value={v}>{t('explore.filters.topikLevel', { level: v })}</option>)}
        </Select>
      </Field>
      <Field label={t('explore.filters.intake')}>
        <Segmented label={t('explore.filters.intake')} value={f.intake_term} onChange={(v) => set({ ...f, intake_term: v })}
          options={[{ value: '', label: t('explore.filters.any') }, { value: 'SPRING', label: t('common:term.SPRING') }, { value: 'FALL', label: t('common:term.FALL') }]} />
      </Field>
      <details className="sx-more" open={f.lists.field.length + f.lists.region.length + f.lists.institution_type.length > 0 || !!f.nums.max_ielts || f.bools.has_dorm || f.bools.partner_only || undefined}>
        <summary>{t('discover.moreFilters')}</summary>
        <div className="sx-filters">
          <ChipGroup label={t('explore.filters.field')} values={tax.data?.fields ?? []} selected={f.lists.field} onChange={list('field')} render={(v) => t(`common:field.${v}`, { defaultValue: v })} />
          <ChipGroup label={t('explore.filters.region')} values={tax.data?.regions ?? []} selected={f.lists.region} onChange={list('region')} render={(v) => t(`common:region.${v}`, { defaultValue: v })} />
          <ChipGroup label={t('explore.filters.type')} values={['NATIONAL', 'PUBLIC', 'PRIVATE']} selected={f.lists.institution_type} onChange={list('institution_type')} render={(v) => t(`common:institution.${v}`)} />
          <Field label={t('explore.filters.myIelts')} htmlFor="f-ielts">
            <Select id="f-ielts" value={f.nums.max_ielts} onChange={(e) => num('max_ielts')(e.target.value)}>
              <option value="">{t('explore.filters.any')}</option>
              {[5, 5.5, 6, 6.5, 7, 7.5, 8].map((v) => <option key={v} value={v}>{formatNumber(v, locale, { minimumFractionDigits: 1 })}</option>)}
            </Select>
          </Field>
          <div className="sx-switches">
            {BOOL_KEYS.map((k) => (
              <label key={k} className="sx-switch">
                <span className="hg-grow hg-small">{t(`explore.filters.${k}`)}</span>
                <Switch checked={f.bools[k]} onChange={bool(k)} label={t(`explore.filters.${k}`)} />
              </label>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="hg-panel" aria-busy="true">
      {[0, 1, 2, 3, 4].map((i) => <div key={i} className="sx-skel"><Skeleton w={36} h={36} r={8} /><div className="hg-grow hg-stack" style={{ '--hg-gap': '8px' } as React.CSSProperties}><Skeleton w="45%" h={14} /><Skeleton w="30%" h={12} /></div><Skeleton w={120} h={12} /></div>)}
    </div>
  );
}

type Verdict = EligibilityGroup;
const VERDICTS = ELIGIBILITY_GROUPS;
// V4 groups (Strong / Possible / Not eligible yet) + V8 "Needs your grades": missing information is never shown as
// ineligibility, and programs at another degree level leave "For you". Rule shared via @hangyul/utils (STATE_MAP).
export const verdictOf = eligibilityGroup;
export const otherDegree = isOtherDegree;

/** PRIMARY QUESTION (Discovery): "Where can I apply?" */
function ForYou() {
  const { t } = useT();
  const q = useMyMatches();
  const [sp, setSp] = useSearchParams();
  const pool = useMemo(() => (q.data?.items ?? []).filter((m) => !otherDegree(m)), [q.data]);
  if (q.isLoading) return <RowsSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const elsewhere = d.items.length - pool.length;
  const count = (v: Verdict) => pool.filter((m) => verdictOf(m) === v).length;
  // Default to the first group that has programs, so a new student never lands on an empty list.
  const fallback: Verdict = VERDICTS.find((v) => count(v) > 0) ?? 'eligible';
  const verdict = (VERDICTS.includes(sp.get('verdict') as Verdict) ? sp.get('verdict') : fallback) as Verdict;
  const waitingOnEducation = count('check');
  const items: Match[] = pool.filter((m) => verdictOf(m) === verdict);
  // V9 S5: zero-count groups collapse — only groups with programs are offered (the open one always stays visible).
  const shown = VERDICTS.filter((v) => count(v) > 0 || v === verdict);
  const routes = (d as typeof d & { routes?: LanguageRoutes | null }).routes;
  return (
    <div className="hg-stack" style={{ '--hg-gap': '16px' } as React.CSSProperties}>
      {routes && <RoutesCard routes={routes} />}
      {waitingOnEducation > 0 ? (
        <Callout tone="brand" title={t('discover.confirmEducation.title', { count: waitingOnEducation })}
          action={<ButtonLink as={Link} to="/profile?edit=education" size="sm" variant="primary">{t('discover.confirmEducation.cta')}</ButtonLink>}>
          {t('discover.confirmEducation.text')}
        </Callout>
      ) : d.profile_percent < 100 && (
        <Callout tone="warning" title={t('matches.incomplete.title', { percent: d.profile_percent })}
          action={<ButtonLink as={Link} to="/profile" size="sm">{t('matches.incomplete.cta')}</ButtonLink>}>
          {t('matches.incomplete.text')}
        </Callout>
      )}
      <div className="sx-bar">
        {shown.length > 1 ? (
          <Segmented label={t('matches.tabsLabel')} value={verdict} onChange={(v) => { const n = new URLSearchParams(sp); n.set('verdict', v); setSp(n, { replace: true }); }}
            options={shown.map((v) => ({ value: v, label: `${t(`discover.verdict.${v}`)} ${count(v)}` }))} />
        ) : <p className="hg-medium">{t(`discover.verdict.${verdict}`)} · {count(verdict)}</p>}
        <details className="sx-method">
          <summary><Info size={14} aria-hidden /> {t('matches.method.title')}</summary>
          <div className="sx-method__body">
            <p>{t('matches.method.stage1')}</p>
            <p>{t('matches.method.stage2')}</p>
            <p className="hg-subtle">{t('matches.method.noProbability')} {t('matches.method.engine', { version: d.engine_version })}</p>
          </div>
        </details>
      </div>
      {/* V10: the university groups below are h3 and nothing between them and the page's h1 was a heading, so
          the outline jumped h1 → h3. The open group's name and count is that heading; it reads as the same
          small explanatory line it always did. */}
      <h2 className="sx-verdict__h hg-small hg-muted">{t(`v4.verdictText.${verdict}`)}</h2>
      {items.length === 0 ? (
        <EmptyState title={t('matches.empty')} text={t(`discover.emptyVerdict.${verdict}`)}
          action={<ButtonLink as={Link} to="/explore?tab=all" size="sm">{t('discover.browseAll')}</ButtonLink>} />
      ) : (
        <div className="v4-groups">{groupByUniversity(items).map((g) => <UniversityGroup key={g[0].program.university_id} matches={g} hideVerdict />)}</div>
      )}
      {elsewhere > 0 && (
        <p className="hg-small hg-muted">
          {t('discover.otherDegree', { count: elsewhere })} <Link to="/explore?tab=all" className="hg-link">{t('discover.browseAll')}</Link>
        </p>
      )}
    </div>
  );
}

function AllPrograms() {
  const { t, locale } = useT();
  const api = useApi();
  const profile = useProfile();
  const matches = useMyMatches();
  const [sp, setSp] = useSearchParams();
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [q, setQ] = useState(filters.q);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(filters);
  const n = activeCount(filters);
  const byProgram = useMemo(() => new Map((matches.data?.items ?? []).map((m) => [m.program_id, m])), [matches.data]);
  const apply = (f: Filters) => { const next = toSearch(f); next.set('tab', 'all'); setSp(next, { replace: true }); };

  useEffect(() => { setQ(filters.q); }, [filters.q]);
  useEffect(() => {
    if (q === filters.q) return;
    const h = setTimeout(() => apply({ ...filters, q: q.trim() }), 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filters]);

  const query = useInfiniteQuery({
    queryKey: ['programs', toSearch(filters).toString()],
    queryFn: ({ pageParam }) => api.catalog.programs({ ...toQuery(filters), page: pageParam, page_size: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.page_size < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  const applyProfile = () => {
    const p = profile.data;
    if (!p) return;
    const topik = p.languages.find((l) => l.test === 'TOPIK' && !l.is_planned);
    const ielts = p.languages.find((l) => l.test === 'IELTS' && !l.is_planned);
    apply({
      ...filters,
      lists: { ...filters.lists, degree: p.target_degree ? [p.target_degree] : [], field: p.desired_fields, region: p.preferred_regions },
      nums: { ...filters.nums, max_topik: topik ? String(Math.floor(topik.score)) : '', max_ielts: ielts ? String(ielts.score) : '' },
      intake_term: p.target_intake_term ?? '',
      bools: { ...filters.bools, open_only: true },
    });
  };
  const clear = () => apply({ ...parseFilters(new URLSearchParams()), q: filters.q, sort: filters.sort });
  const listLabel = (k: ListKey, v: string) => k === 'degree' ? t(`common:degreeShort.${v}`) : k === 'field' ? t(`common:field.${v}`, { defaultValue: v })
    : k === 'region' ? t(`common:region.${v}`, { defaultValue: v }) : k === 'institution_type' ? t(`common:institution.${v}`) : t(`common:instruction.${v}`);
  const numLabel = (k: NumKey, v: string) => k === 'max_tuition' ? t('explore.filters.upTo', { amount: formatMoney(Number(v), 'KRW', locale, { compact: true }) })
    : k === 'max_topik' ? (v === '0' ? t('explore.filters.noTopik') : t('discover.myTopik', { level: v })) : t('discover.myIelts', { score: v });

  return (
    <div className="sx-layout">
      <aside className="sx-rail" aria-label={t('common:actions.filter')}>
        <div className="sx-rail__head">
          <span className="hg-strong">{t('common:actions.filter')}</span>
          {n > 0 && <Button variant="link" size="sm" onClick={clear}>{t('common:actions.clearFilters')}</Button>}
        </div>
        {profile.data?.target_degree && <Button size="sm" block icon={<UserCheck />} onClick={applyProfile}>{t('explore.useProfile')}</Button>}
        <FilterPanel f={filters} set={apply} />
      </aside>
      <div className="sx-results">
        <div className="sx-toolbar">
          <div className="hg-grow">
            <SearchInput icon={<Search aria-hidden />} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('explore.searchPh')} aria-label={t('explore.searchPh')} />
          </div>
          <Button className="sx-filter-btn" icon={<SlidersHorizontal />} onClick={() => { setDraft(filters); setOpen(true); }}>
            {t('common:actions.filter')}{n > 0 && <span className="sx-count">{n}</span>}
          </Button>
          <FilterSelect size="sm" label={t('explore.sort.label')} value={filters.sort} onChange={(e) => apply({ ...filters, sort: e.target.value })} style={{ width: 'auto' }}>
            {['relevance', 'deadline', 'tuition', 'name'].map((s) => <option key={s} value={s}>{t(`explore.sort.${s}`)}</option>)}
          </FilterSelect>
        </div>
        <div className="sx-quick">
          <Chip pressed={filters.bools.open_only} onClick={() => apply({ ...filters, bools: { ...filters.bools, open_only: !filters.bools.open_only } })}>{t('explore.filters.open_only')}</Chip>
          <Chip pressed={filters.bools.has_scholarship} onClick={() => apply({ ...filters, bools: { ...filters.bools, has_scholarship: !filters.bools.has_scholarship } })}>{t('explore.filters.has_scholarship')}</Chip>
          <Chip pressed={filters.lists.language.includes('ENGLISH')} onClick={() => apply({ ...filters, lists: { ...filters.lists, language: filters.lists.language.includes('ENGLISH') ? filters.lists.language.filter((x) => x !== 'ENGLISH') : [...filters.lists.language, 'ENGLISH'] } })}>{t('discover.englishTaught')}</Chip>
        </div>
        {n > 0 && (
          <div className="sx-active" aria-label={t('discover.activeFilters')}>
            {LIST_KEYS.flatMap((k) => filters.lists[k].map((v) => (
              <button key={`${k}-${v}`} type="button" className="sx-active__chip" onClick={() => apply({ ...filters, lists: { ...filters.lists, [k]: filters.lists[k].filter((x) => x !== v) } })}
                aria-label={t('discover.removeFilter', { name: listLabel(k, v) })}>{listLabel(k, v)} <X aria-hidden /></button>
            )))}
            {BOOL_KEYS.filter((k) => filters.bools[k]).map((k) => (
              <button key={k} type="button" className="sx-active__chip" onClick={() => apply({ ...filters, bools: { ...filters.bools, [k]: false } })}
                aria-label={t('discover.removeFilter', { name: t(`explore.filters.${k}`) })}>{t(`explore.filters.${k}`)} <X aria-hidden /></button>
            ))}
            {NUM_KEYS.filter((k) => filters.nums[k]).map((k) => (
              <button key={k} type="button" className="sx-active__chip" onClick={() => apply({ ...filters, nums: { ...filters.nums, [k]: '' } })}
                aria-label={t('discover.removeFilter', { name: numLabel(k, filters.nums[k]) })}>{numLabel(k, filters.nums[k])} <X aria-hidden /></button>
            ))}
            {filters.intake_term && (
              <button type="button" className="sx-active__chip" onClick={() => apply({ ...filters, intake_term: '' })}>{t(`common:term.${filters.intake_term}`)} <X aria-hidden /></button>
            )}
            <Button variant="link" size="sm" onClick={clear}>{t('common:actions.clearFilters')}</Button>
          </div>
        )}
        {/* V10: an <h2>, not a <p>. The university group headings below are h3 and nothing else on the page is
            an h2, so the document outline jumped h1 → h3. The result count is the results region's heading. */}
        <h2 className="sx-results__count hg-small hg-subtle" aria-live="polite">{query.isLoading ? t('common:states.loading') : t('explore.results', { count: total, formatted: formatNumber(total, locale) })}</h2>
        {query.isLoading ? <RowsSkeleton /> : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title={t('explore.empty')} text={t('explore.emptyText')} action={<Button onClick={clear}>{t('common:actions.clearFilters')}</Button>} />
        ) : (
          <>
            <ProgramGroups items={items} byProgram={byProgram} dim={query.isPlaceholderData} />
            {query.hasNextPage && (
              <div style={{ display: 'grid', placeItems: 'center' }}>
                <Button onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>{t('explore.more', { shown: items.length, total })}</Button>
              </div>
            )}
          </>
        )}
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title={t('common:actions.filter')} width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft({ ...parseFilters(new URLSearchParams()), q: filters.q, sort: filters.sort })}>{t('common:actions.clearFilters')}</Button>
            <div className="hg-grow" />
            <Button variant="primary" onClick={() => { apply(draft); setOpen(false); }}>{t('explore.showResults')}</Button>
          </>
        }>
        <FilterPanel f={draft} set={setDraft} />
      </Drawer>
    </div>
  );
}

export default function Explore() {
  const { t } = useT();
  const [sp, setSp] = useSearchParams();
  const matches = useMyMatches();
  const saved = useSaved();
  // `lang` (the V14 URL locale) and `verdict` are not search filters: a localized link must open "For you", not the full list.
  const hasFilters = [...sp.keys()].some((k) => !NON_FILTER_KEYS.has(k));
  const tab = sp.get('tab') === 'saved' ? 'saved' : sp.get('tab') === 'all' || (!sp.get('tab') && hasFilters) ? 'all' : 'foryou';
  // "For you" counts what the tab lists: every program at the student's degree level (the groups below split it).
  const forYou = (matches.data?.items ?? []).filter((m) => !otherDegree(m)).length;
  return (
    <div className="st-page">
      <PageIntro title={t('discover.title')} subtitle={t('v4.discoverSubtitle')}
        actions={<Link to="/compare#budget" className="hg-link-arrow">{t('discover.budgetLink')}</Link>} />
      <div className="hg-stack" style={{ '--hg-gap': '20px' } as React.CSSProperties}>
        <Tabs label={t('discover.title')} value={tab} onChange={(v) => setSp({ tab: v }, { replace: true })}
          tabs={[
            { value: 'foryou', label: t('discover.forYou'), count: matches.data ? forYou : undefined },
            { value: 'all', label: t('discover.all') },
            { value: 'saved', label: t('discover.savedTab'), count: saved.data?.length || undefined },
          ]} />
        {tab === 'foryou' ? <ForYou /> : tab === 'saved' ? <SavedList /> : <AllPrograms />}
      </div>
    </div>
  );
}
