/**
 * 한국 대학 — the public Korean university directory (V20; brief §18–§22).
 *
 * **What this page was.** The national register as two columns of text: 425 names, 24 to a page, three
 * grey words each, no image anywhere, and a vertical rhythm that broke because some rows carried IEQAS
 * chips and some did not (REPORT §211.1). The comment V14 left in `InstitutionTile` explains why the
 * thumbnail had been removed — Hangyul held one licensed campus photograph, so 424 rows drew the same
 * peach square — and that conclusion was right for one photograph and wrong as a permanent answer.
 *
 * **What it is now.** The same register, drawn as places. Every result gets the same shape through
 * `resolveUniversityVisual`'s four tiers (§19): this institution's own photograph where one is licensed,
 * the poster of its verified official introduction film where there is one, its own mark over a
 * region-tinted field where it has a mark, and a composition built from its monogram and its place
 * where it has neither. **No institution ever shows another institution's campus**, and no photograph is
 * reused as a stand-in — the tier is a property of the content record, not a choice this file makes.
 *
 * What has deliberately *not* changed: the question at the top is still "where in Korea do you want to
 * study?", the map is still the main affordance at desktop width and the chips are still the second way
 * in (§22 — the map works, so it is improved rather than replaced). There is no cost, no deadline, no
 * requirement and no match score anywhere on this page, because all of those need an account and a
 * profile before anything true can be said.
 */
import { useLocale } from '@hangyul/i18n';
import type { InstitutionCard } from '@hangyul/types';
import { Map as MapIcon, Play, Search, SlidersHorizontal } from '@hangyul/icons';
import { Button, Drawer, EmptyState, ErrorState, FilterSelect, PhotoCredit, SkeletonCard, UniversityIdentityArt, UniversityLogo, UniversityPhoto } from '@hangyul/ui';
import { resolveUniversityVisual } from '@hangyul/utils';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { KoreaMap, RegionSelector, type RegionCounts } from '../components/KoreaMap';
import { useDirectoryRegions, useInstitutions } from '../lib/queries';
import { LocaleLink } from '../components/LocaleLink';
import { useSeo } from '../lib/useSeo';
import { KOREA_REGIONS } from '../media/korea-regions';
import '../styles/directory.css';
import '../styles/university.css';

const PAGE_SIZE = 24;

/** `?region=seoul` ⇄ the registry's `Seoul`. The URL stays lower-case so it reads like a place, not a key. */
const REGION_KEYS = KOREA_REGIONS.map((r) => r.key);
const KINDS = ['UNIVERSITY', 'JUNIOR_COLLEGE', 'GRADUATE_UNIVERSITY'] as const;

/**
 * How people actually think about where in Korea they would live (V21, brief §8).
 *
 * The register's unit is the 광역자치단체 — seventeen of them, three of which have fewer than seven
 * institutions. That is the right unit for a precise filter and the wrong one for a first screen:
 * nobody browses "Sejong". These eight groups are the conventional pairing used in Korean
 * higher-education writing, and they are an **editorial** decision, so they live here and the server
 * only does the filtering.
 *
 * The default is 전체 and the order inside it is the register's own (kind, then name). No popularity,
 * no ranking, nothing invented — §8 forbids all three and there is no honest data for any of them.
 */
const REGION_GROUPS: { key: string; regions: string[] }[] = [
  { key: 'all', regions: [] },
  { key: 'seoul', regions: ['Seoul'] },
  { key: 'gyeonggi', regions: ['Gyeonggi', 'Incheon'] },
  { key: 'busan', regions: ['Busan', 'Gyeongnam', 'Ulsan'] },
  { key: 'daejeon', regions: ['Daejeon', 'Chungbuk', 'Chungnam', 'Sejong'] },
  { key: 'daegu', regions: ['Daegu', 'Gyeongbuk'] },
  { key: 'gwangju', regions: ['Gwangju', 'Jeonbuk', 'Jeonnam'] },
  { key: 'gangwon', regions: ['Gangwon', 'Jeju'] },
];
const fromParam = (v: string | null) => REGION_KEYS.find((k) => k.toLowerCase() === v?.toLowerCase()) ?? null;

/**
 * One result (V21, brief §3, §7).
 *
 * Four tiers, and **none of them invents an image**:
 *
 *   A  this institution's own rights-cleared photograph
 *   B  the poster of its verified official introduction film
 *   C  its own mark, centred on a quiet surface
 *   D  its full name, both scripts, typeset — no mark exists and none is faked
 *
 * V20's tier D set two syllables chopped out of the name at 90 px, which is what the owner rejected:
 * eight of the nine tiles on the first screen read 아신 · 아주 · 안양 · 백석 · 교육 · 장신 · 외국 · 칼빈
 * and the page looked machine-generated because it was. The fragment is gone; the name is the design.
 *
 * City photography is deliberately **absent** from every tier here. Hangyul holds three pictures of
 * Seoul and Seoul has 85 institutions, so a city fallback puts the Han River on one screen eight
 * times — the exact failure §3 names. A city picture belongs on the detail page, once, captioned.
 *
 * Nothing on the tile is a fee, a deadline, a document count or a badge wall (§7).
 */
export function InstitutionTile({ inst, index }: { inst: InstitutionCard; index?: number }) {
  const { t, locale } = useLocale(['marketing', 'common']);
  const korean = locale === 'ko';
  const primary = korean || !inst.name_en ? inst.name_ko : inst.name_en;
  const secondary = korean ? inst.name_en : inst.name_ko;
  const content = inst.enrichment ?? null;
  const v = resolveUniversityVisual(inst.slug, inst.region, content, { index });
  const regionLabel = t(`common:region.${inst.region}`, { defaultValue: inst.region });
  const photo = v.campus;
  // The script the identity composition sets, and whether the caption still needs an alternate line.
  const identityFace = (korean ? inst.name_en : inst.name_ko) || inst.name_ko;
  const identity = v.tier === 'D_IDENTITY' || v.tier === 'C_LOGO';
  const identityIsSecondary = identity && identityFace === secondary;
  // V28 (UX_AUDIT MK-6): at most one verified reason to look closer — the same wording the detail page leads with.
  const sig = inst.signals;
  const signal = sig?.scholarships ? t('v28.uni.why.scholarships', { count: sig.scholarships })
    : sig?.gks ? t('v28.uni.why.gks') : sig?.english_degrees ? t('v28.uni.why.english') : null;

  return (
    <article className="mk-unicard" data-tier={v.tier}>
      <div className={`mk-unicard__visual${photo || v.poster ? ' mk-unicard__visual--photo' : ''}`}>
        {v.poster ? (
          <>
            {/* The official film's own poster, served by YouTube from the channel we verified. The play mark
                says what it is — a film, not a photograph of the campus (V23 §270 D2). */}
            <img src={v.poster.url} alt="" aria-hidden width={480} height={360} loading="lazy" decoding="async" />
            <span className="mk-unicard__play" aria-hidden><Play size={14} /></span>
          </>
        ) : photo ? (
          <UniversityPhoto media={photo} sizes="(min-width: 1400px) 22vw, (min-width: 640px) 32vw, 92vw" alt={t(photo.alt_key, { name: primary })} />
        ) : (
          /* Tiers C/D — the identity composition (V23 §270 D1): the name in the other script, the province mark,
             the mark on a plate where one is licensed. Registry facts only; never an image of a campus. */
          <UniversityIdentityArt
            name={identityFace}
            nameLang={identityFace === inst.name_ko ? 'ko' : 'en'}
            region={inst.region}
            content={content}
            regionLabel={regionLabel}
          />
        )}
        {v.logo && (photo || v.poster) && (
          <UniversityLogo content={content} name={primary} size={30} className="mk-unicard__logo" />
        )}
        {/* The licence's condition, where the work is used (§15) — now *on* the picture, the way the detail hero
            carries it, instead of a fourth line of small print under every photo tile (V24 §292). Always
            visible: a credit that appears only on hover is not a credit a reader can be said to have seen. */}
        {photo && !v.poster && <PhotoCredit media={photo} className="mk-unicard__credit mk-unicard__credit--over" />}
      </div>
      <div className="mk-unicard__body">
        <h3 className="mk-unicard__name">
          <LocaleLink className="mk-unicard__link" to={`/universities/${inst.slug}`}>{primary}</LocaleLink>
        </h3>
        {secondary && !identityIsSecondary && <p className="mk-unicard__alt" lang={korean ? 'en' : 'ko'}>{secondary}</p>}
        <p className="mk-unicard__where">
          <span>{regionLabel}</span>
          <span>{t(`v12.type.${inst.institution_type}`)}</span>
        </p>
        {signal && <p className="mk-unicard__signal">{signal}</p>}
      </div>
    </article>
  );
}

export default function Universities() {
  const { t, locale } = useLocale(['marketing', 'common']);
  useSeo({ title: t('v12.seo.directory.title'), description: t('v12.seo.directory.description') });
  const [params, setParams] = useSearchParams();

  const region = fromParam(params.get('region'));
  // One more axis than place, and only one: §21 asks for search, region and kind, and warns against
  // turning the first screen into a filter dashboard. Degree level, language and tuition are not here
  // because none of them can be answered truthfully without the visitor's own profile.
  const kind = KINDS.find((k) => k === params.get('kind')) ?? null;
  const group = REGION_GROUPS.find((g) => g.key === params.get('group')) ?? REGION_GROUPS[0];
  const page = Math.max(1, Number(params.get('page')) || 1);
  const query = params.get('q') ?? '';
  const [draft, setDraft] = useState(query);
  useEffect(() => { setDraft(query); }, [query]);

  const regionsQuery = useDirectoryRegions();
  // Sort in the script the visitor is reading (the registry's canonical order is Korean).
  const listQuery = useInstitutions({
    region: region ?? undefined,
    // A precise region chip wins over a browsing group; they are two ways of asking the same question
    // and answering both at once would silently intersect them.
    regions: !region && group.regions.length ? group.regions.join(',') : undefined,
    institution_type: kind ?? undefined,
    q: query || undefined, page, page_size: PAGE_SIZE, order: locale === 'ko' ? 'ko' : 'en',
  });

  const counts = useMemo<RegionCounts>(
    () => Object.fromEntries((regionsQuery.data?.regions ?? []).map((r) => [r.key, r.count])),
    [regionsQuery.data],
  );
  // The API returns the regions in the order the chips (and so the map's keyboard) should follow.
  const regionKeys = useMemo(() => (regionsQuery.data?.regions ?? []).map((r) => r.key), [regionsQuery.data]);

  const searchId = useId();
  const [mapOpen, setMapOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  /** Choosing a region on a phone must land you on the answer, not leave it below the fold. Instant, not
      smooth: a URL-driven scroll that is still animating swallows the next tap (V11, §80.2). */
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (region && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 991px)').matches) {
      listRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [region]);

  const select = (next: string | null) => {
    const p = new URLSearchParams(params);
    if (next) p.set('region', next.toLowerCase()); else p.delete('region');
    p.delete('q');
    p.delete('group');
    p.delete('page');
    setParams(p);                       // a real history entry: the back button undoes the choice
  };

  /** A name search is a different question from a place, so choosing one clears the other. */
  const setQuery = (next: string | null) => {
    const p = new URLSearchParams(params);
    if (next) { p.set('q', next); p.delete('region'); } else p.delete('q');
    p.delete('page');
    setParams(p);
  };

  /** Choosing a group clears a single-region chip, and vice versa — see the note on the query above. */
  const setGroup = (next: string) => {
    const p = new URLSearchParams(params);
    if (next && next !== 'all') p.set('group', next); else p.delete('group');
    p.delete('region'); p.delete('page');
    setParams(p);
  };

  const setKind = (next: string | null) => {
    const p = new URLSearchParams(params);
    if (next) p.set('kind', next); else p.delete('kind');
    p.delete('page');
    setParams(p);
  };

  const goPage = (next: number) => {
    const p = new URLSearchParams(params);
    if (next > 1) p.set('page', String(next)); else p.delete('page');
    setParams(p, { replace: true });
    listRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  };

  const total = listQuery.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const regionLabel = region ? t(`common:region.${region}`, { defaultValue: region }) : null;

  /** Phones get one Filters button and a sheet; the chips and the map stay on wider screens (V23 §270 D3). */
  const [sheet, setSheet] = useState(false);
  const activeCount = (region || group.key !== 'all' ? 1 : 0) + (kind ? 1 : 0);
  const clearAll = () => {
    const p = new URLSearchParams(params);
    ['region', 'group', 'kind', 'page'].forEach((k) => p.delete(k));
    setParams(p);
  };

  /**
   * V30 (REPORT §408): the type filter says what it filters. It used to be a bare native select reading only
   * "전체", sized by its longest option (109 px for a 24 px word), the chevron pinned to the far edge and the
   * category ("학교 유형") visible to screen readers only. `FilterSelect` shows `학교 유형 · 전체 ⌄` as one
   * content-sized control in the same family as search and the map action.
   */
  const kindSelect = (id: string) => (
    <FilterSelect id={id} label={t('v20.dir.filterType')} value={kind ?? ''} active={!!kind} onChange={(e) => setKind(e.target.value || null)}>
      <option value="">{t('v20.dir.typeAll')}</option>
      {KINDS.map((k) => <option key={k} value={k}>{t(`v12.type.${k}`)}</option>)}
    </FilterSelect>
  );

  return (
    <div className="mk-dir">
      {/* V23 — the page asks one question, "which Korean university should I explore?", and answers it: a
          heading, the search field, the results. No subtitle and no account of where the register comes from
          (REPORT §269 M4); that provenance lives in the data and in each page's "공식 기록" date. */}
      <section className="kn-container mk-dir__top">
        <h1 className="mk-dir__title">{t('v24.dir.title')}</h1>
        <div className="mk-dir__bar">
          <form
            className="mk-dir__find"
            role="search"
            onSubmit={(e) => { e.preventDefault(); setQuery(draft.trim() || null); }}
          >
            <label htmlFor={`${searchId}-q`} className="hg-sr-only">{t('v12.directory.findLabel')}</label>
            <Search aria-hidden className="mk-dir__findicon" />
            <input
              id={`${searchId}-q`}
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('v12.directory.findPlaceholder')}
              enterKeyHint="search"
            />
            {query && (
              <button type="button" className="mk-dir__findclear" onClick={() => setQuery(null)}>
                {t('common:actions.clear', { defaultValue: 'Clear' })}
              </button>
            )}
          </form>
          <span className="mk-dir__wide mk-dir__kindwrap">{kindSelect(`${searchId}-kind`)}</span>
          <button
            type="button"
            className="mk-dir__maptoggle mk-dir__wide"
            aria-expanded={mapOpen}
            aria-controls="mk-dir-map"
            onClick={() => setMapOpen((v) => !v)}
          >
            <MapIcon aria-hidden size={16} />
            {t(mapOpen ? 'v12.map.hide' : 'v21.dir.byRegion')}
          </button>
          <button type="button" className="mk-dir__filterbtn mk-dir__narrow" onClick={() => setSheet(true)} aria-haspopup="dialog">
            <SlidersHorizontal aria-hidden size={16} />
            {t('v23.dir.filters')}
            {activeCount > 0 && <span className="mk-dir__filtercount">{activeCount}</span>}
          </button>
        </div>
        {/* Eight places, one row. It scrolls sideways rather than wrapping into a wall of chips. */}
        <div className="mk-dir__groups mk-dir__wide" role="group" aria-label={t('v21.dir.groupsLabel')}>
          {REGION_GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              className="mk-dir__group"
              aria-pressed={!region && group.key === g.key}
              onClick={() => setGroup(g.key)}
            >
              {t(`v21.dir.group.${g.key}`)}
            </button>
          ))}
        </div>
        {/* On a phone the active filters are shown as what they are, each one removable. */}
        {activeCount > 0 && (
          <div className="mk-dir__active mk-dir__narrow">
            {(region || group.key !== 'all') && (
              <button type="button" className="mk-dir__chip" onClick={() => (region ? select(null) : setGroup('all'))}>
                {regionLabel ?? t(`v21.dir.group.${group.key}`)} <span aria-hidden>×</span>
                <span className="hg-sr-only">{t('common:actions.clear', { defaultValue: 'Clear' })}</span>
              </button>
            )}
            {kind && (
              <button type="button" className="mk-dir__chip" onClick={() => setKind(null)}>
                {t(`v12.type.${kind}`)} <span aria-hidden>×</span>
                <span className="hg-sr-only">{t('common:actions.clear', { defaultValue: 'Clear' })}</span>
              </button>
            )}
          </div>
        )}
      </section>

      <Drawer
        open={sheet}
        onClose={() => setSheet(false)}
        title={t('v23.dir.filters')}
        footer={(
          <>
            <Button variant="ghost" onClick={clearAll} disabled={!activeCount}>{t('v23.dir.clearAll')}</Button>
            <Button variant="primary" onClick={() => setSheet(false)} style={{ flex: 1 }}>
              {listQuery.isFetching ? t('common:states.loading') : t('v23.dir.showResults', { count: total })}
            </Button>
          </>
        )}
      >
        <div className="mk-dir__sheet">
          <fieldset>
            <legend>{t('v20.dir.filterType')}</legend>
            <div className="mk-dir__sheetopts">
              <button type="button" className="mk-dir__group" aria-pressed={!kind} onClick={() => setKind(null)}>{t('v20.dir.typeAll')}</button>
              {KINDS.map((k) => (
                <button key={k} type="button" className="mk-dir__group" aria-pressed={kind === k} onClick={() => setKind(k)}>{t(`v12.type.${k}`)}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t('v21.dir.groupsLabel')}</legend>
            <div className="mk-dir__sheetopts">
              {REGION_GROUPS.map((g) => (
                <button key={g.key} type="button" className="mk-dir__group" aria-pressed={!region && group.key === g.key} onClick={() => setGroup(g.key)}>
                  {t(`v21.dir.group.${g.key}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t('v23.dir.region')}</legend>
            <div className="mk-dir__sheetopts">
              {(regionsQuery.data?.regions ?? []).map((r) => (
                <button key={r.key} type="button" className="mk-dir__group" aria-pressed={region === r.key} onClick={() => select(r.key)}>
                  {t(`common:region.${r.key}`, { defaultValue: r.key })} <span className="mk-dir__n">{r.count}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </Drawer>

      <section className="kn-container mk-dir__body" aria-label={t('v21.dir.resultsLabel')}>
        {/*
          V21 — **the map is no longer the first thing on the page.** It used to own the left column at
          every width: 360 px wide and the full height of the first three result rows, which made an
          aspirational product read as a data explorer and pushed the universities themselves below the
          fold (REPORT §226.2). It is a disclosure now, at every width, under the search field. It is
          still a real keyboard-operable control and the region chips are still the second way in; what
          changed is that choosing a province is offered rather than demanded.
        */}
        <div className="mk-dir__picker mk-dir__wide" data-open={mapOpen || undefined}>
          {/* A real control at every width: a radio group with arrow-key selection and an accessible name per
              region, compact on a phone and full-size from 992px (brief Part 7). It is never `aria-hidden` —
              an earlier build hid the wrapper while leaving its regions focusable, which axe correctly refused
              and which also made the map unusable from the keyboard on the desktop where it is the main
              affordance. The chips below are the second way in, which Part 23 requires. */}
          {/* V20 — on a phone the map is a 400 px tall control above the answer, so it opens on request
              and the results are the first thing below the search field (§21 mobile). It stays mounted and
              fully keyboard-operable at desktop width, where it is the main affordance. */}
          <div className="mk-dir__mapwrap" id="mk-dir-map" data-open={mapOpen || undefined}>
            <KoreaMap counts={counts} selected={region} onSelect={select} regionOrder={regionKeys} />
          </div>
          <RegionSelector
            regions={regionsQuery.data?.regions ?? []}
            selected={region}
            onSelect={select}
            total={regionsQuery.data?.total ?? 0}
          />
        </div>

        <div className="mk-dir__results" ref={listRef}>
          <div className="mk-dir__resulthead">
            <h2 className="mk-dir__resulttitle">
              {query
                ? t('v12.directory.matching', { q: query })
                : regionLabel ? t('v12.directory.inRegion', { region: regionLabel })
                  : group.key === 'all' ? t('v12.directory.all') : t(`v21.dir.group.${group.key}`)}
            </h2>
            <p className="mk-dir__count" aria-live="polite">
              {/* A failed load is not "0 institutions": the count is only stated for data that loaded. */}
              {listQuery.isLoading ? t('common:states.loading') : listQuery.isError ? null : t('v12.directory.count', { count: total })}
            </p>
          </div>

          {listQuery.isLoading ? (
            <div className="mk-dir__grid">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={3} />)}</div>
          ) : listQuery.isError ? (
            <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
          ) : total === 0 ? (
            <EmptyState
              title={t('v12.directory.emptyTitle')}
              text={t('v12.directory.emptyText')}
              action={<Button onClick={() => select(null)}>{t('v12.directory.all')}</Button>}
            />
          ) : (
            <>
              <ul className="mk-dir__grid" aria-busy={listQuery.isFetching || undefined}>
                {listQuery.data?.items.map((inst, i) => <li key={inst.slug}><InstitutionTile inst={inst} index={i} /></li>)}
              </ul>
              {pages > 1 && (
                <nav className="mk-dir__pager" aria-label={t('search.pagination')}>
                  {/* V26 (REPORT §333 M5): full-size targets (≥ 44 px) with direction arrows — the small pair at the foot of a
                      425-entry directory was the hardest control on the page to hit. */}
                  <Button disabled={page <= 1} onClick={() => goPage(page - 1)}><span aria-hidden className="hg-flip-rtl">←</span> {t('common:table.previous')}</Button>
                  <span className="mk-dir__pageof hg-num">{t('common:table.pageOf', { page, pages })}</span>
                  <Button disabled={page >= pages} onClick={() => goPage(page + 1)}>{t('common:table.next')} <span aria-hidden className="hg-flip-rtl">→</span></Button>
                </nav>
              )}
            </>
          )}

        </div>
      </section>
    </div>
  );
}
