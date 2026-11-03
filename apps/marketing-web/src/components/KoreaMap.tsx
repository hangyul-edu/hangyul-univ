/**
 * The interactive Korea map (V12, brief Part 7 / Part 23).
 *
 * One job: let somebody say *there* — and then read what is there. It is a region selector, not a data
 * visualisation, so there is no heat shading, no colour scale and no pin per institution. A region is either the
 * selected one (tangerine) or it is not (one neutral fill).
 *
 * Accessibility (Part 23): the SVG is a `radiogroup` of `radio`s, which is what it behaves like — exactly one
 * region at a time, arrow keys move between them, Space/Enter picks one. Each region carries its own accessible
 * name and count, and the map is **never** the only way to choose: `RegionSelector` below renders the same set
 * as ordinary buttons, and it is that list, not the map, that phones get.
 *
 * Hover state lives in React rather than in `:hover` because the hover label has to be read out of it, and a
 * touch device must not get stuck in a hover state it cannot leave.
 */
import { useLocale } from '@hangyul/i18n';
import type { DirectoryRegion } from '@hangyul/types';
import { cx } from '@hangyul/utils';
import { useCallback, useId, useMemo, useRef, useState } from 'react';

import { KOREA_REGIONS, KOREA_VIEWBOX } from '../media/korea-regions';

/** Regions whose shape is too small to aim at: they also get a dot, and the dot is part of the same control. */
const SMALL = new Set(['Seoul', 'Sejong', 'Gwangju', 'Daejeon', 'Ulsan', 'Daegu', 'Incheon', 'Busan']);

export type RegionCounts = Record<string, number>;

function useRegionName() {
  const { t } = useLocale(['marketing', 'common']);
  return useCallback((key: string) => t(`common:region.${key}`, { defaultValue: key }), [t]);
}

export function KoreaMap({
  counts,
  selected,
  onSelect,
  regionOrder,
  className,
}: {
  counts: RegionCounts;
  selected: string | null;
  onSelect: (region: string | null) => void;
  /** The order the region chips are shown in, so the keyboard walks the map the same way. */
  regionOrder: string[];
  className?: string;
}) {
  const { t } = useLocale(['marketing', 'common']);
  const regionName = useRegionName();
  const [hover, setHover] = useState<string | null>(null);
  const groupId = useId();
  const refs = useRef(new Map<string, SVGGElement | null>());

  /**
   * Arrow-key order follows the region chips below the map, not the order the boundary file happens to be
   * generated in. The map's own layout is geographic, so any linear order through it is a choice; matching the
   * list a sighted user can see beside it is the least surprising one. (Generated order starts
   * Seoul → Busan → Daegu; the chips read Seoul → Gyeonggi → Incheon → Busan.)
   */
  const order = useMemo(() => {
    const listed = regionOrder.filter((k) => KOREA_REGIONS.some((r) => r.key === k));
    const rest = KOREA_REGIONS.map((r) => r.key).filter((k) => !listed.includes(k));
    return [...listed, ...rest];
  }, [regionOrder]);

  /** Arrow keys walk the regions in reading order; Home/End jump to the ends. A roving tabindex keeps the
   *  whole map one tab stop, which is what a radio group is supposed to be. */
  const onKeyDown = (event: React.KeyboardEvent, key: string) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next: string | undefined;
    if (delta) next = order[(order.indexOf(key) + delta + order.length) % order.length];
    else if (event.key === 'Home') next = order[0];
    else if (event.key === 'End') next = order[order.length - 1];
    else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onSelect(selected === key ? null : key);
      return;
    } else return;
    event.preventDefault();
    if (next) {
      onSelect(next);
      refs.current.get(next)?.focus();
    }
  };

  const active = hover ?? selected;
  const activeCount = active ? (counts[active] ?? 0) : null;

  return (
    <div className={cx('mk-map', className)}>
      <svg
        viewBox={KOREA_VIEWBOX}
        className="mk-map__svg"
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        onMouseLeave={() => setHover(null)}
      >
        <title id={`${groupId}-label`}>{t('v12.map.title')}</title>
        {KOREA_REGIONS.map((r) => {
          const count = counts[r.key] ?? 0;
          const isSelected = selected === r.key;
          const name = regionName(r.key);
          return (
            <g
              key={r.key}
              ref={(el) => { refs.current.set(r.key, el); }}
              role="radio"
              aria-checked={isSelected}
              aria-label={t('v12.map.regionLabel', { region: name, count })}
              tabIndex={isSelected || (!selected && r.key === order[0]) ? 0 : -1}
              className={cx('mk-map__region', isSelected && 'is-selected', hover === r.key && 'is-hover')}
              onClick={() => onSelect(isSelected ? null : r.key)}
              onMouseEnter={() => setHover(r.key)}
              onFocus={() => setHover(r.key)}
              onBlur={() => setHover(null)}
              onKeyDown={(e) => onKeyDown(e, r.key)}
            >
              <path d={r.d} className="mk-map__shape" />
              {/* The metropolitan cities are a few pixels across at this scale. The dot is not decoration: it
                  is the part of the control you can actually hit, on a mouse and with a fingertip. */}
              {SMALL.has(r.key) && <circle cx={r.label[0]} cy={r.label[1]} r={13} className="mk-map__dot" />}
            </g>
          );
        })}
      </svg>

      {/* One label, for whichever region the pointer or the keyboard is on. Seventeen permanent labels collide
          in the capital region, where four of them overlap; one live label does not, and says more. */}
      <p className="mk-map__readout" aria-hidden={!active}>
        {active
          ? <><strong>{regionName(active)}</strong><span>{t('v12.directory.countShort', { count: activeCount ?? 0 })}</span></>
          : <span className="mk-map__readout-idle">{t('v12.map.hint')}</span>}
      </p>
    </div>
  );
}

/**
 * The same choice as ordinary buttons. On a phone this *is* the control (the map is decorative there and marked
 * `aria-hidden`); on a desktop it sits under the map so the map never has to be the only way in.
 */
export function RegionSelector({
  regions,
  selected,
  onSelect,
  total,
}: {
  regions: DirectoryRegion[];
  selected: string | null;
  onSelect: (region: string | null) => void;
  total: number;
}) {
  const { t } = useLocale(['marketing', 'common']);
  const regionName = useRegionName();
  return (
    <div className="mk-regions" role="group" aria-label={t('v12.map.listLabel')}>
      <button
        type="button"
        className={cx('mk-regions__chip', selected === null && 'is-selected')}
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
      >
        {t('v12.directory.all')}<span className="mk-regions__n">{total}</span>
      </button>
      {regions.map((r) => (
        <button
          key={r.key}
          type="button"
          className={cx('mk-regions__chip', selected === r.key && 'is-selected')}
          aria-pressed={selected === r.key}
          onClick={() => onSelect(selected === r.key ? null : r.key)}
        >
          {regionName(r.key)}<span className="mk-regions__n">{r.count}</span>
        </button>
      ))}
    </div>
  );
}
