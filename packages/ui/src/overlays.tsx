import { CheckCircle2, Info, X, XCircle } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { cx } from '@hangyul/utils';
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Button } from './primitives';

function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () => node?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])') ?? [];
    const first = focusables()[0];
    (first ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && node) {
        const f = Array.from(focusables());
        if (!f.length) return;
        const [a, b] = [f[0], f[f.length - 1]];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
        else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  return ref;
}

/** `useLayoutEffect` that does not warn when the tree is rendered on a server, where it is a no-op anyway. */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface Placement { top: number; left: number; width: number; avail: number; side: 'top' | 'bottom' }

/** Distance held between the trigger and the panel, and between the panel and the edge of the viewport. */
const POPOVER_GAP = 8;
const POPOVER_EDGE = 12;

/**
 * Where an open panel goes: below if it fits below, above if it only fits above, otherwise the roomier side.
 * `avail` is the space on the chosen side, published to the panel so content with its own scroll area can
 * shrink to fit instead of being clipped.
 */
function placePopover(anchor: HTMLElement, panel: HTMLElement, align: 'start' | 'end', width?: number): Placement {
  const r = anchor.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  const w = Math.min(width ?? panel.offsetWidth, vw - POPOVER_EDGE * 2);
  const h = panel.offsetHeight;

  const below = vh - r.bottom - POPOVER_GAP - POPOVER_EDGE;
  const above = r.top - POPOVER_GAP - POPOVER_EDGE;
  const side: Placement['side'] = h <= below || below >= above ? 'bottom' : 'top';
  const avail = Math.max(side === 'bottom' ? below : above, 0);
  const height = Math.min(h, avail);
  const top = side === 'bottom' ? r.bottom + POPOVER_GAP : r.top - POPOVER_GAP - height;

  // `align` is logical: "end" is the right edge in LTR and the left edge in RTL, as the inset properties it
  // replaces were. If the requested edge would push the panel off the viewport, try the opposite edge of the
  // *same trigger* before clamping — a 320 px `align="end"` panel on the footer's language button, which sits
  // near the inline start, otherwise gets shoved to the viewport margin and reads as unanchored. Flipping the
  // alignment keeps one of its edges on one of the trigger's. Clamping stays as the last resort, for a panel
  // too wide to align either way.
  const rtl = getComputedStyle(anchor).direction === 'rtl';
  const atEnd = (align === 'end') !== rtl;
  const fits = (x: number) => x >= POPOVER_EDGE && x + w <= vw - POPOVER_EDGE;
  const preferred = atEnd ? r.right - w : r.left;
  const alternate = atEnd ? r.left : r.right - w;
  const x = fits(preferred) || !fits(alternate) ? preferred : alternate;
  const left = Math.min(Math.max(x, POPOVER_EDGE), Math.max(vw - w - POPOVER_EDGE, POPOVER_EDGE));

  return { top: Math.max(top, POPOVER_EDGE), left, width: w, avail, side };
}

export function Modal({ open, onClose, title, children, footer, width = 520, description }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number; description?: ReactNode }) {
  const ref = useFocusTrap(open, onClose);
  const id = useId();
  const { t } = useLocale('common');
  if (!open) return null;
  return createPortal(
    <>
      <div className="hg-overlay" onClick={onClose} aria-hidden />
      <div ref={ref} className="hg-modal" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} style={{ '--w': `${width}px` } as CSSProperties}>
        <div className="hg-modal__head">
          <div>
            <h2 id={id} className="hg-title-md">{title}</h2>
            {description && <p className="hg-muted hg-small" style={{ marginTop: 4 }}>{description}</p>}
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={<X />} onClick={onClose} aria-label={t('actions.close')} />
        </div>
        <div className="hg-modal__body">{children}</div>
        {footer && <div className="hg-modal__foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, footer, width = 440, side = 'end', sheet = true }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number; side?: 'start' | 'end'; sheet?: boolean }) {
  const ref = useFocusTrap(open, onClose);
  const id = useId();
  const { t } = useLocale('common');
  if (!open) return null;
  return createPortal(
    <>
      <div className="hg-overlay" onClick={onClose} aria-hidden />
      <div ref={ref} className={cx('hg-drawer', side === 'start' && 'hg-drawer--start', sheet && 'hg-drawer--sheet')} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} style={{ '--w': `${width}px` } as CSSProperties}>
        <div className="hg-drawer__head">
          <h2 id={id} className="hg-title-md hg-truncate">{title}</h2>
          <Button variant="ghost" size="sm" iconOnly icon={<X />} onClick={onClose} aria-label={t('actions.close')} />
        </div>
        <div className="hg-drawer__body">{children}</div>
        {footer && <div className="hg-drawer__foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

/**
 * Anchored popover (menus, the notification panel, the language picker). Closes on outside click / Escape.
 *
 * **It flips.** Until V14 this was `position: absolute; top: calc(100% + 8px)` on a child of the trigger — one
 * placement, downwards, always. That is fine for a toolbar button at the top of a page and broken for the
 * language button in the footer, which is by definition the *last* thing on the page: a 400 px panel opened
 * below a trigger that is 60 px from the bottom of the document had roughly 340 px of itself underneath the
 * viewport, and no amount of scrolling could reach it because the document had already ended. Being a child of
 * the trigger also put it at the mercy of every ancestor: one `overflow: hidden` section, one `transform` (which
 * makes a containing block out of any ancestor and re-roots `position: fixed` too) or one competing stacking
 * context and the panel is clipped or painted underneath the next band.
 *
 * Both problems have the same root and one fix: the panel does not live in the trigger's subtree any more. It is
 * portalled to `document.body` and positioned `fixed` from the trigger's own viewport rect, so no ancestor can
 * clip it, no ancestor's stacking context can bury it, and the placement is a decision we make rather than one
 * the document's remaining height makes for us:
 *
 *   1. measure the panel at its natural size (rendered hidden for exactly one frame, inside a layout effect, so
 *      nothing is painted at the wrong place first);
 *   2. put it below the trigger if it fits below, above if it does not fit below but fits above, and otherwise
 *      on whichever side has more room — where it also publishes that room as `--hg-popover-avail` so the
 *      content can shrink its own scroll area instead of being cut off (the locale list does exactly this, which
 *      is what keeps the search box on screen rather than scrolling it away);
 *   3. clamp horizontally into the viewport, honouring writing direction, so an `align="end"` panel on a trigger
 *      near the inline edge slides in rather than hanging off it.
 *
 * Re-measured on scroll (capturing, so panels inside scrollable regions follow their trigger), on resize, and
 * whenever the panel's own content changes size — the language list changes height on every keystroke in its
 * search box, and a panel that was flipped upward has to stay pinned to the trigger as it shrinks.
 *
 * Keyboard. A portalled panel is no longer the trigger's DOM neighbour, so Tab would walk past it into the rest
 * of the page. Opening therefore moves focus into the panel (its first focusable, or the panel itself), Tab and
 * Shift+Tab cycle within it, and Escape closes and hands focus back to the trigger — unless focus has already
 * been given to something else on the page, which must not be yanked back.
 */
export function Popover({ trigger, children, align = 'end', className, open: controlled, onOpenChange, width }: {
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' | 'dialog' }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'start' | 'end';
  className?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  width?: number;
}) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const setOpen = useCallback((v: boolean) => { setInner(v); onOpenChange?.(v); }, [onOpenChange]);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Placement | null>(null);

  // A click inside the panel is not an outside click, even though the panel is no longer inside `ref`.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, setOpen]);

  useIsoLayoutEffect(() => {
    if (!open) { setPlace(null); return; }
    const anchor = ref.current, panel = panelRef.current;
    if (!anchor || !panel) return;
    // Equal measurements must not produce a new object. The panel's own `max-height` comes from the previous
    // measurement, so a measure can feed the next one; bailing on "nothing moved" is what makes that settle
    // after a single corrective pass instead of re-rendering on every observer tick.
    const measure = () => setPlace((prev) => {
      const next = placePopover(anchor, panel, align, width);
      return prev && (['top', 'left', 'width', 'avail', 'side'] as const).every((k) => prev[k] === next[k]) ? prev : next;
    });
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    ro?.observe(panel);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, align, width]);

  /**
   * Whether focus has deliberately gone somewhere else on the page, which is the one case where it must not be
   * handed back to the trigger on close. The closing panel cannot be asked: by the time any cleanup runs React
   * has detached its nodes and the browser has quietly moved focus to `document.body`, which is
   * indistinguishable from "the user focused nothing". So the answer is recorded while the panel is still
   * live, from a `focusout` that names a real element outside it.
   */
  const leftRef = useRef(false);

  // Focus goes in on open and comes back on close; Tab cycles inside. See the note above.
  //
  // Gated on the panel having been *placed*, not merely opened: before the first measurement it is still
  // `visibility: hidden`, and a hidden element cannot take focus — the browser drops the call silently, which
  // is exactly how the language picker's search box ended up unfocused with no error to show for it. `place`
  // is replaced on every re-measure, so `ready` is a boolean and this does not re-run on scroll.
  const ready = open && place !== null;
  useIsoLayoutEffect(() => {
    if (!ready) return;
    const panel = panelRef.current;
    if (!panel) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])',
    ));
    leftRef.current = false;
    if (!panel.contains(document.activeElement)) (focusables()[0] ?? panel).focus();
    const onOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && !panel.contains(next)) leftRef.current = true;
    };
    panel.addEventListener('focusout', onOut);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      const [first, last] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    panel.addEventListener('keydown', onKey);
    return () => {
      panel.removeEventListener('keydown', onKey);
      panel.removeEventListener('focusout', onOut);
      if (!leftRef.current) prev?.focus?.();
    };
  }, [ready]);

  const close = () => setOpen(false);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger({ onClick: () => setOpen(!open), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      {open && createPortal(
        <div
          ref={panelRef}
          className={cx('hg-popover', className)}
          tabIndex={-1}
          data-placement={place?.side ?? 'bottom'}
          style={{
            // Until the first measurement lands the panel is laid out but not painted, so it is never seen at
            // the top-left corner on the way to its real position.
            position: 'fixed',
            top: place ? `${place.top}px` : 0,
            left: place ? `${place.left}px` : 0,
            width: place ? `${place.width}px` : width,
            visibility: place ? undefined : 'hidden',
            ['--hg-popover-avail' as string]: place ? `${place.avail}px` : undefined,
          } as CSSProperties}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Toasts
interface ToastItem { id: number; kind: 'success' | 'error' | 'info'; text: ReactNode }
const ToastCtx = createContext<(kind: ToastItem['kind'], text: ReactNode) => void>(() => undefined);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: ToastItem['kind'], text: ReactNode) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="hg-toasts" role="status" aria-live="polite">
        {items.map((it) => (
          <div key={it.id} className={cx('hg-toast', `hg-toast--${it.kind}`)}>
            {it.kind === 'success' ? <CheckCircle2 aria-hidden /> : it.kind === 'error' ? <XCircle aria-hidden /> : <Info aria-hidden />}
            <div>{it.text}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const push = useContext(ToastCtx);
  return { success: (t: ReactNode) => push('success', t), error: (t: ReactNode) => push('error', t), info: (t: ReactNode) => push('info', t) };
}
