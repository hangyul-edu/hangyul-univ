/**
 * The operations pipeline board (design pass 2026-11): the attention lanes and the application journey, as one control.
 *
 *   lanes   WHO NEEDS US — act now (red) · our turn · waiting on the student / the university (amber).
 *   rail    WHERE THEY ARE — All, then the nine stages in order, then Closed.
 *
 * Reading rules, so the stages are not nine equally weak boxes: the selected one is the only tangerine one; a stage
 * holding a tier-1 student carries a red bar and says so in words; a stage whose students all wait on someone outside
 * the team is amber; everything else is neutral ink; an empty stage is quiet and not offered as a filter.
 * Every count is a button that filters the table beneath to exactly those rows (lib/caseload.ts).
 */
import { useLocale } from '@hangyul/i18n';
import { cx, formatNumber } from '@hangyul/utils';
import type { ReactNode } from 'react';

import type { LaneKey, StageTone } from '../lib/caseload';

export interface Lane { key: LaneKey; label: string; count: number; tone: 'danger' | 'neutral' | 'warning'; hint?: string }
export interface RailStage<K extends string> { key: K; label: string; count: number; tone?: StageTone }

export function PipelineBoard<K extends string>({
  lanes, lane, onLane, lanesLabel, stages, selected, onSelect, railLabel, allLabel, allCount, closedLabel, closedCount, closedSelected, onClosed, closedHint, toneLabel, loading, aside,
}: {
  lanes?: Lane[]; lane?: LaneKey | null; onLane?: (k: LaneKey | null) => void; lanesLabel?: string;
  stages: RailStage<K>[]; selected: K | null; onSelect: (k: K | null) => void; railLabel: string;
  allLabel: string; allCount: number;
  closedLabel: string; closedCount: number; closedSelected: boolean; onClosed: () => void; closedHint?: string;
  toneLabel: Record<'urgent' | 'waiting', string>; loading?: boolean; aside?: ReactNode;
}) {
  const { locale } = useLocale('common');
  const n = (v: number) => (loading ? '–' : formatNumber(v, locale));
  const allOn = selected == null && !closedSelected;
  return (
    <div className="ops-board" data-loading={loading || undefined}>
      {lanes && lanes.length > 0 && (
        <div className="ops-lanes" role="group" aria-label={lanesLabel}>
          <span className="ops-lanes__label" aria-hidden>{lanesLabel}</span>
          <div className="ops-lanes__list">
            {lanes.map((l) => {
              const on = lane === l.key;
              const empty = l.count === 0 && !on;
              return (
                <button key={l.key} type="button" className="ops-lane" data-lane={l.key} data-tone={l.tone} data-count={l.count} aria-pressed={on} disabled={empty} title={l.hint}
                  onClick={() => onLane?.(on ? null : l.key)}>
                  <span className="ops-lane__dot" aria-hidden />
                  <span className="ops-lane__label">{l.label}</span>
                  <span className="ops-lane__count hg-num">{n(l.count)}</span>
                </button>
              );
            })}
          </div>
          {aside && <div className="ops-lanes__aside">{aside}</div>}
        </div>
      )}
      <div className="ops-rail">
        <button type="button" className="ops-rail__view" data-view="all" data-count={allCount} aria-pressed={allOn} onClick={() => onSelect(null)}>
          <span className="ops-rail__label">{allLabel}</span>
          <span className="ops-rail__count hg-num">{n(allCount)}</span>
        </button>
        <ol className="ops-rail__stages" aria-label={railLabel}>
          {stages.map((s) => {
            const on = selected === s.key;
            const empty = s.count === 0 && !on;
            const tone = s.count === 0 ? undefined : s.tone;
            const inner = (
              <>
                <span className="ops-rail__label">{s.label}</span>
                <span className="ops-rail__count hg-num">{n(s.count)}</span>
                <span className="ops-rail__state">{tone === 'urgent' || tone === 'waiting' ? toneLabel[tone] : ' '}</span>
              </>
            );
            return (
              <li key={s.key} className={cx('ops-rail__stage', empty && 'is-empty')} data-stage={s.key} data-count={s.count} data-tone={tone}>
                {empty
                  ? <span className="ops-rail__btn is-static">{inner}</span>
                  : <button type="button" className="ops-rail__btn" aria-pressed={on} onClick={() => onSelect(on ? null : s.key)}>{inner}</button>}
              </li>
            );
          })}
        </ol>
        <button type="button" className="ops-rail__view ops-rail__view--closed" data-view="closed" data-count={closedCount} aria-pressed={closedSelected} title={closedHint}
          disabled={closedCount === 0 && !closedSelected} onClick={onClosed}>
          <span className="ops-rail__label">{closedLabel}</span>
          <span className="ops-rail__count hg-num">{n(closedCount)}</span>
        </button>
      </div>
    </div>
  );
}
