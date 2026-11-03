/**
 * V22 workflow grammar (REPORT §249–§250, brief §44, §47–§48, §52, §57–§58).
 *
 * `StageStrip` — the process, visible immediately: every stage shows its count, is clickable, filters the work
 * underneath, and the arrows say "this happens after that". Selected = tangerine. Done (student journey) = quiet
 * check. It is the one mental model shared by the student home, the agency home and the university home; what
 * differs is the stages and the table under it, never the grammar.
 *
 * `WorkToolbar` — search + a few small filters that sit directly under the strip, above the table.
 */
import { Check, ChevronRight, Search } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { cx, formatNumber } from '@hangyul/utils';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface Stage<K extends string = string> {
  key: K;
  label: ReactNode;
  /** Shown as a tabular number; omit for a journey (student) strip. */
  count?: number;
  /** Journey mode: completed / current / upcoming. Work mode leaves it undefined. */
  state?: 'done' | 'current' | 'todo';
  /** Not clickable (for example a stage the viewer cannot act on yet). */
  disabled?: boolean;
  hint?: ReactNode;
}

/**
 * A VIEW beside the pipeline (전체, 종료) — not a stage. V31 (REPORT §421): "전체" used to sit inside the rail as if it
 * were the first step of the journey; a view filters the table without being part of the process, so it is drawn in
 * its own grammar (a quiet segmented toggle), separated from the rail by a divider.
 */
export function StageView({ label, count, selected, onSelect, title, tone }: {
  label: ReactNode; count?: number; selected: boolean; onSelect: () => void; title?: string;
  /** `alert` = an ATTENTION view (긴급): a cut across every stage, its count drawn in the danger tone. */
  tone?: 'alert';
}) {
  const { locale } = useLocale('common');
  return (
    <button type="button" className={cx('hg-pipe__view', selected && 'is-selected', tone && `hg-pipe__view--${tone}`)} aria-pressed={selected} onClick={onSelect} title={title}>
      <span className="hg-pipe__viewlabel">{label}</span>
      {count !== undefined && <span className="hg-pipe__viewcount hg-num">{formatNumber(count, locale)}</span>}
    </button>
  );
}

/**
 * The work pipeline (V31, REPORT §421) — what an operator should PERCEIVE, not read.
 *
 * Each stage is ONE target: label, its count as data underneath, and a segment of a continuous track whose fill is the
 * stage's share of the largest stage. Read left to right the segments are the journey; the overloaded stage is the
 * fullest segment; the selected stage is the only tangerine one. A zero stage stays in the process (quiet, readable)
 * but is not offered as a filter that can only return an empty table (V24 §295) unless it is the selected one.
 */
function PipelineRail<K extends string>({ stages, selected, onSelect, label, allLabel, allCount, after, before, allSelected }: {
  stages: Stage<K>[]; selected?: K | null; onSelect?: (k: K | null) => void; label: string;
  allLabel?: ReactNode; allCount?: number; after?: ReactNode; before?: ReactNode; allSelected?: boolean;
}) {
  const { locale } = useLocale('common');
  const max = Math.max(1, ...stages.map((s) => s.count ?? 0));
  // V31: when the rail must scroll (narrow consoles), say so — an edge fade on the side that has more stages,
  // instead of a hard cut through a label.
  const railRef = useRef<HTMLOListElement>(null);
  const [more, setMore] = useState<'start' | 'end' | 'both' | undefined>();
  useEffect(() => {
    const el = railRef.current; if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth; const x = Math.abs(el.scrollLeft);
      const s = x > 2, e = x < max - 2;
      setMore(max <= 2 ? undefined : s && e ? 'both' : s ? 'start' : e ? 'end' : undefined);
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null; ro?.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => { ro?.disconnect(); el.removeEventListener('scroll', update); };
  }, [stages.length]);
  return (
    <div className="hg-pipe" data-has-selection={selected != null || undefined}>
      {(allLabel !== undefined || before) && (
        <div className="hg-pipe__views hg-pipe__views--lead">
          {before}
          {allLabel !== undefined && <StageView label={allLabel} count={allCount} selected={allSelected ?? selected == null} onSelect={() => onSelect?.(null)} />}
        </div>
      )}
      <ol ref={railRef} className="hg-pipe__rail" aria-label={label} data-more={more}>
        {stages.map((s, i) => {
          const sel = selected === s.key;
          const n = s.count ?? 0;
          const empty = n === 0 && !sel;
          const clickable = !!onSelect && !s.disabled && !empty;
          const share = n === 0 ? 0 : Math.max(0.08, n / max);
          const inner = (
            <>
              <span className="hg-pipe__label">{s.label}</span>
              <span className="hg-pipe__count hg-num">{formatNumber(n, locale)}</span>
              <span className="hg-pipe__seg" aria-hidden><span className="hg-pipe__fill" style={{ inlineSize: `${Math.round(share * 100)}%` }} /></span>
            </>
          );
          return (
            <li key={s.key} className={cx('hg-pipe__stage', sel && 'is-selected', empty && 'is-empty')} data-stage={s.key} data-count={n} data-step={i + 1}>
              {clickable ? (
                <button type="button" className="hg-pipe__btn" aria-pressed={sel} title={typeof s.hint === 'string' ? s.hint : undefined}
                  onClick={() => onSelect?.(sel ? null : s.key)}>{inner}</button>
              ) : (
                <span className="hg-pipe__btn is-static">{inner}</span>
              )}
            </li>
          );
        })}
      </ol>
      {after && <div className="hg-pipe__views hg-pipe__views--trail">{after}</div>}
    </div>
  );
}

export function StageStrip<K extends string>({ stages, selected, onSelect, label, allLabel, allCount, size = 'md', numbered, after, before, allSelected }: {
  stages: Stage<K>[]; selected?: K | null; onSelect?: (k: K | null) => void; label: string;
  /** An "all" view before the stages — the unfiltered table (drawn as a view, not a stage). */
  allLabel?: ReactNode; allCount?: number; size?: 'md' | 'lg'; numbered?: boolean;
  /** V31: other views that are not stages of the journey (e.g. 종료), drawn after the rail. */
  after?: ReactNode;
  /** V31: attention views (e.g. 긴급) drawn before 전체, in the same leading group — not stages either. */
  before?: ReactNode;
  /** Override for whether 전체 is the active view (when an attention/closed view is active instead). */
  allSelected?: boolean;
}) {
  const { locale } = useLocale('common');
  // Work mode — counted stages without journey state — is the operational pipeline rail.
  if (!numbered && stages.every((s) => s.count !== undefined && !s.state)) {
    return <PipelineRail stages={stages} selected={selected} onSelect={onSelect} label={label} allLabel={allLabel} allCount={allCount} after={after} before={before} allSelected={allSelected} />;
  }
  return (
    <ol className={cx('hg-strip', `hg-strip--${size}`, numbered && 'hg-strip--numbered')} aria-label={label}>
      {allLabel !== undefined && (
        <li className="hg-strip__item hg-strip__item--all">
          <button type="button" className={cx('hg-strip__btn', selected == null && 'is-selected')} aria-pressed={selected == null} onClick={() => onSelect?.(null)}>
            <span className="hg-strip__label">{allLabel}</span>
            {allCount !== undefined && <span className="hg-strip__count hg-num">{formatNumber(allCount, locale)}</span>}
          </button>
        </li>
      )}
      {stages.map((s, i) => {
        const sel = selected === s.key;
        // V24 (REPORT §295): an empty work stage is shown — the process stays whole — but not offered as a
        // filter that can only produce an empty table. A selected one stays clickable so it can be cleared.
        const empty = s.count === 0 && !s.state && !sel;
        const clickable = !!onSelect && !s.disabled && !empty;
        const inner = (
          <>
            {numbered && <span className="hg-strip__num hg-num" aria-hidden>{s.state === 'done' ? <Check size={12} /> : String(i + 1).padStart(2, '0')}</span>}
            <span className="hg-strip__label">{s.label}</span>
            {s.count !== undefined && <span className="hg-strip__count hg-num">{formatNumber(s.count, locale)}</span>}
          </>
        );
        return (
          <li key={s.key} className={cx('hg-strip__item', s.state && `is-${s.state}`, empty && 'is-empty')} data-stage={s.key}>
            {i > 0 && <ChevronRight className="hg-strip__arrow hg-flip-rtl" aria-hidden size={14} />}
            {clickable ? (
              <button type="button" className={cx('hg-strip__btn', sel && 'is-selected')} aria-pressed={sel} aria-current={s.state === 'current' ? 'step' : undefined}
                title={typeof s.hint === 'string' ? s.hint : undefined} onClick={() => onSelect?.(sel ? null : s.key)}>{inner}</button>
            ) : (
              <span className={cx('hg-strip__btn', 'is-static', sel && 'is-selected')} aria-current={s.state === 'current' ? 'step' : undefined}>{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function WorkToolbar({ search, onSearch, placeholder, children, meta, searchAside }: {
  search: string; onSearch: (v: string) => void; placeholder: string; children?: ReactNode; meta?: ReactNode;
  /** V30: a control that belongs beside the search field (the phone "Filters" toggle), not on a row of its own. */
  searchAside?: ReactNode;
}) {
  return (
    <div className="hg-worktools">
      <div className="hg-worktools__searchrow">
        <div className="hg-input-icon hg-worktools__search">
          <Search aria-hidden />
          <input type="search" className="hg-input hg-input--sm" value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        </div>
        {searchAside}
      </div>
      <div className="hg-worktools__filters">{children}</div>
      {meta && <div className="hg-worktools__meta hg-small hg-muted">{meta}</div>}
    </div>
  );
}
