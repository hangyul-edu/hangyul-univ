/**
 * The language control (V14, brief Parts 42, 43, 45).
 *
 * One component for every surface. Desktop renders a compact searchable popover; phones render a searchable
 * bottom sheet with 56 px rows, because a 31-item popover anchored to a 40 px button in the corner of a phone
 * is unusable and a raw `<select>` of 31 options is worse.
 *
 * What a row shows is a flag, the language in its own script, and the market it serves. What a row *matches*
 * is wider than what it shows, which is the brief's example: "Vietnam", "베트남", "Tiếng Việt" and "VN" must
 * all find Vietnamese. Search therefore covers the native language name, the English language name, the Korean
 * language name, all three country names and the ISO code.
 *
 * The flags are the owner's own assets from `apps/flags`, published per app by `scripts/media/sync-flags.mjs`
 * and addressed by real ISO country code — never emoji, which render as two letters on Windows and are not
 * the artwork the owner supplied. Each is drawn in a fixed 20×14 box with `object-fit: cover`, so a 2:3
 * Nepali pennant and a 1:2 Qatari banner cannot distort each other's row.
 *
 * Choosing a language **navigates**: `?lang=` is the authority (brief Part 44), and the href preserves the
 * path, every other query parameter and the hash. The rows are real `<a>` elements, so they can be opened in
 * a new tab and copied as links — which is the point of putting the locale in the URL at all.
 */
import { Check, Globe, Search } from '@hangyul/icons';
import {
  flagUrl, isStudentAppLocale, localeHref, LOCALES, MARKETS, marketForLocale, marketMatches, useLocale,
  type LocaleDef, type Market, isConsoleLocale,
} from '@hangyul/i18n';
import { cx } from '@hangyul/utils';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import { Button } from './primitives';
import { Popover } from './overlays';

/** Which locales a surface offers. `student` applies the V9 student-journey completeness gate. */
let surface: 'all' | 'student' | 'agency' | 'university' = 'all';
export function setLocaleSelectorSurface(s: 'all' | 'student' | 'agency' | 'university') { surface = s; }

export interface LocaleOption { def: LocaleDef; market: Market | undefined }

/**
 * The offered list — **exactly the 32 approved markets** (V17, brief §15).
 *
 * It used to be every locale bundle that exists: the 33 markets first, then the ~20 further bundles the
 * repository carries. That produced the defect the owner reported as "language names render but flags
 * don't" — a bundle with no market row has no country, `<Flag code={undefined}>` draws the grey
 * `hg-flag--none` placeholder, and the list became an inconsistent 52 entries where a third of the rows had
 * no flag and some were 0 % translated.
 *
 * The fix is not a fallback flag. It is to stop offering markets the business does not serve: **every
 * exposed row now has a market, so every exposed row has a flag, by construction rather than by luck.**
 *
 * The one exception is `current`. If a reader somehow arrives in a locale outside the 32 — a saved
 * preference from an older build, a hand-typed `?lang=` — the list keeps their current language in it, or
 * the control would show a language the reader cannot see or switch away from.
 */
export function localeOptions(current: string): LocaleOption[] {
  const rows = MARKETS
    .map((m) => ({ def: LOCALES.find((l) => l.code === m.locale), market: m }))
    .filter((r): r is { def: LocaleDef; market: Market } => !!r.def);
  // V29 (brief §30): a console offers only the locales whose console namespace is complete — never a language it
  // would then show mostly in English. No "stray" exception there: the console boots out of an incomplete locale.
  if (surface === 'agency' || surface === 'university') {
    const app = surface;
    return rows.filter((r) => isConsoleLocale(app, r.def.code));
  }
  const offered = surface === 'student'
    ? rows.filter((r) => isStudentAppLocale(r.def.code) || r.def.code === current)
    : rows;
  if (offered.some((r) => r.def.code === current)) return offered;
  const stray = LOCALES.find((l) => l.code === current);
  return stray ? [...offered, { def: stray, market: marketForLocale(current) }] : offered;
}

/**
 * A flag, sized by **height** with its own width (V17).
 *
 * It used to be a fixed 20 × 14 with `object-fit: cover`, which is fine for thirty-one rectangles and wrong
 * for the thirty-second: Nepal's flag is the only non-quadrilateral national flag in the world — two stacked
 * pennons, portrait at roughly 0.82 : 1 — and `cover` at 20 × 14 crops it into a rectangle, which is exactly
 * what the brief forbids.
 *
 * So the manifest carries each market's `flagRatio`, the image is given its true aspect, and every flag is
 * centred in a fixed-width slot. The slot is what keeps the rows' text aligned; the image inside it is free
 * to be the shape it actually is. Nepal is then a narrow flag, not a special case, and no other flag changed.
 */
export function Flag({ code, className }: { code: string | undefined; className?: string }) {
  const market = code ? MARKETS.find((m) => m.code === code) : undefined;
  if (!code) return <span className={cx('hg-flag-slot', className)} aria-hidden><span className="hg-flag hg-flag--none" /></span>;
  const ratio = market?.flagRatio ?? 1.5;
  return (
    // Decorative: the row's own text names the language, so a screen reader reading "flag of Vietnam" as
    // well would be duplication. Lazy, because the picker is usually never opened.
    <span className={cx('hg-flag-slot', className)} aria-hidden>
      <img
        className="hg-flag"
        data-shape={ratio < 1 ? 'pennon' : undefined}
        style={{ '--hg-flag-ratio': ratio } as CSSProperties}
        src={flagUrl(code)}
        alt=""
        loading="lazy"
        decoding="async"
        width={Math.round(14 * ratio)}
        height={14}
      />
    </span>
  );
}

function useOptions(query: string, current: string) {
  return useMemo(() => {
    const all = localeOptions(current);
    if (!query.trim()) return all;
    return all.filter(({ def, market }) => {
      const names = [def.name, def.english, def.code];
      if (market) return marketMatches(market, query, names);
      const q = query.trim().toLowerCase();
      return names.some((n) => n.toLowerCase().includes(q));
    });
  }, [query, current]);
}

function Rows({ options, current, onPick, onChange }: {
  options: LocaleOption[]; current: string; onPick: () => void; onChange?: (code: string) => void;
}) {
  const { t } = useLocale('common');
  const loc = typeof window === 'undefined'
    ? { pathname: '/', search: '', hash: '' }
    : { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash };
  if (!options.length) return <p className="hg-locale__empty hg-subtle hg-small">{t('i18n.noLanguageMatch')}</p>;
  return (
    <ul className="hg-locale__list" role="listbox" aria-label={t('actions.language')}>
      {options.map(({ def, market }) => (
        <li key={def.code} role="option" aria-selected={def.code === current}>
          <a
            className={cx('hg-locale__row', def.code === current && 'is-current')}
            href={localeHref(def.code, loc)}
            hrefLang={def.code}
            lang={def.code}
            onClick={() => { onChange?.(def.code); onPick(); }}
          >
            <Flag code={market?.code} />
            <span className="hg-locale__names">
              <span className="hg-locale__lang">{def.name}</span>
              {/* The market, not a second copy of the language: "Tiếng Việt / Việt Nam" tells someone they
                  are in the right place; "Tiếng Việt / Vietnamese" tells them nothing they cannot see. */}
              <span className="hg-locale__market">{market ? market.nameNative : def.english}</span>
            </span>
            {def.status === 'MACHINE_DRAFT' && <span className="hg-locale__beta" title={t('a11y.machineDraft')}>β</span>}
            {def.code === current && <Check aria-hidden className="hg-locale__check" />}
          </a>
        </li>
      ))}
    </ul>
  );
}

function SearchBox({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const { t } = useLocale('common');
  return (
    <div className="hg-locale__search">
      <Search aria-hidden />
      <input
        className="hg-locale__input"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('i18n.searchLanguages')}
        aria-label={t('i18n.searchLanguages')}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

/** Phones: a bottom sheet. Full width, 56 px rows, search pinned at the top, the list scrolling under it. */
function Sheet({ open, onClose, current, onChange }: {
  open: boolean; onClose: () => void; current: string; onChange?: (code: string) => void;
}) {
  const { t } = useLocale('common');
  const [q, setQ] = useState('');
  const options = useOptions(q, current);
  const ref = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // The reader's own language is usually not the first row — Nepali is third, Swedish is last of 32 — so the
  // list opens showing where they already are rather than at the top. `block: 'center'` rather than
  // `nearest`, because a selected row flush against the first visible edge reads as the top of the list.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      scroller.current?.querySelector<HTMLElement>('.hg-locale__row.is-current')
        ?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    setQ('');
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <>
      <div className="hg-overlay" onClick={onClose} aria-hidden />
      <div ref={ref} className="hg-locale__sheet" role="dialog" aria-modal="true" aria-label={t('actions.language')}>
        <span className="hg-locale__grip" aria-hidden />
        <SearchBox value={q} onChange={setQ} />
        <div ref={scroller} className="hg-locale__scroll"><Rows options={options} current={current} onPick={onClose} onChange={onChange} /></div>
      </div>
    </>,
    document.body,
  );
}

/**
 * `compact` shows the globe alone (the header pill at small widths); otherwise the current language's flag and
 * name are on the button, which is what makes the control findable rather than a mystery icon.
 */
export function LocaleSelector({ compact, align = 'end', onChange }: {
  compact?: boolean;
  align?: 'start' | 'end';
  /**
   * Fired with the chosen code *before* navigation, for the one caller that needs more than a URL change:
   * the account settings page, which also persists the choice to the server so it follows the student to
   * their next device. The selector still navigates — `?lang=` remains the authority for this view — so
   * there is one language UI in the product rather than a header control and a settings control that look
   * and behave differently (brief Part 42).
   */
  onChange?: (code: string) => void;
}) {
  const { t, locale } = useLocale('common');
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState(false);
  const options = useOptions(q, locale);
  const def = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];
  const market = marketForLocale(locale);

  const [phone, setPhone] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const label = `${t('actions.language')}: ${def.name}`;

  if (phone) {
    return (
      <>
        {/* Same anatomy as the desktop trigger: a flag plus the language in its own script when there is room,
            the globe alone in the header pill. A control that shows only a globe is a control nobody finds. */}
        <Button variant="ghost" size="sm" icon={compact ? <Globe /> : undefined} onClick={() => setSheet(true)} aria-haspopup="dialog" aria-expanded={sheet} aria-label={label}>
          {!compact && <span className="hg-locale__trigger"><Flag code={market?.code} />{def.name}</span>}
        </Button>
        <Sheet open={sheet} onClose={() => setSheet(false)} current={locale} onChange={onChange} />
      </>
    );
  }

  return (
    <Popover
      width={320}
      align={align}
      onOpenChange={(open) => { if (open) setQ(''); }}
      trigger={(p) => (
        <Button variant="ghost" size="sm" icon={compact ? <Globe /> : undefined} {...p} aria-label={label}>
          {!compact && <span className="hg-locale__trigger"><Flag code={market?.code} />{def.name}</span>}
        </Button>
      )}
    >
      {(close) => (
        <div
          className="hg-locale"
          style={{ '--hg-locale-max': 'min(340px, max(168px, calc(var(--hg-popover-avail, 100vh) - 76px)))' } as CSSProperties}
        >
          <SearchBox value={q} onChange={setQ} autoFocus />
          <div className="hg-locale__scroll"><Rows options={options} current={locale} onPick={close} onChange={onChange} /></div>
        </div>
      )}
    </Popover>
  );
}
