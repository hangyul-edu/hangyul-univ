/**
 * Mobile keyboard: keep the field being typed into on screen (exhaustive pass, 2026-11-21).
 *
 * The viewport meta asks for `interactive-widget=resizes-content`, so on Android Chrome the layout shrinks when the
 * keyboard opens and the browser normally scrolls the focused field into view. Not every browser does — in-app browsers
 * (Kakao, LINE, Facebook), some WebViews and iOS edge cases leave the field, its error line and the button under it
 * behind the keyboard. When the visible viewport shrinks and the focused field is outside it, this brings the field
 * back to the middle of what is visible. It never moves the page while nothing editable has focus.
 */
const EDITABLE = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=hidden]), textarea, [contenteditable="true"], [role="combobox"][aria-expanded="true"]';

let installed = false;
export function installKeyboardFocusKeeper(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const vv = window.visualViewport;
  let last = vv?.height ?? window.innerHeight;
  let frame = 0;
  const check = () => {
    const h = vv?.height ?? window.innerHeight;
    const shrank = h < last - 40; // a keyboard, not a scrollbar or a URL bar settling
    last = h;
    if (!shrank) return;
    const el = document.activeElement as HTMLElement | null;
    if (!el || !el.matches?.(EDITABLE)) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const top = vv?.offsetTop ?? 0;
      const bottom = top + h;
      if (r.top >= top + 8 && r.bottom <= bottom - 8) return;
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    });
  };
  (vv ?? window).addEventListener('resize', check);
}

/**
 * WCAG 2.2 · 2.4.11 Focus Not Obscured (product-excellence pass, 2026-11-22).
 *
 * A sticky top bar, a bottom tab bar, a chat composer or a fixed decision bar paints over the page. When keyboard focus
 * moves to a control that sits under one of them, the browser does not scroll — the control is "in the viewport" — so
 * the focus ring is hidden. On every keyboard focus (`:focus-visible`), this measures the pinned author content above
 * and below the control (fixed/sticky ancestors of whatever is painted at its top and bottom edge) and scrolls the page
 * just enough to clear it. Only Tab / Shift+Tab focus moves the page — never a tap, a click or a script; nothing runs while
 * focus stays inside the pinned bar.
 */
let focusInstalled = false;
function pinnedAncestor(n: Element | null, el: Element): HTMLElement | null {
  for (let e = n as HTMLElement | null; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
    if (e.contains(el)) return null;
    const p = getComputedStyle(e).position;
    if (p === 'fixed' || p === 'sticky') return e;
  }
  return null;
}
export function installFocusNotObscured(): void {
  if (focusInstalled || typeof window === 'undefined') return;
  focusInstalled = true;
  // Only focus that Tab / Shift+Tab moved. Text fields match `:focus-visible` on any focus (a tap, a click, a script), and
  // moving the page under a pointer between aiming and clicking made a click land on nothing (E2E, visa receipt field).
  let tabAt = -Infinity;
  document.addEventListener('keydown', (e) => { if (e.key === 'Tab') tabAt = performance.now(); }, true);
  document.addEventListener('focusin', (ev) => {
    const el = ev.target as HTMLElement | null;
    if (!el || el === document.body || performance.now() - tabAt > 250 || !el.matches?.(':focus-visible')) return;
    // Inside a pinned bar itself (the top bar's search, the composer): it is the bar, nothing covers it.
    for (let e: HTMLElement | null = el; e && e !== document.body; e = e.parentElement) {
      const p = getComputedStyle(e).position;
      if (p === 'fixed' || p === 'sticky') return;
    }
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const x = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 2);
      // A control half above the viewport edge is probed where it is still visible (its top may be negative).
      const topY = Math.max(r.top, 0) + 2;
      const topPin = r.bottom > 0 && topY < window.innerHeight ? pinnedAncestor(document.elementFromPoint(x, topY), el) : null;
      const botY = r.bottom - 2;
      const botPin = botY >= 0 && botY < window.innerHeight ? pinnedAncestor(document.elementFromPoint(x, botY), el) : null;
      const margin = 12;
      if (topPin) {
        const cover = topPin.getBoundingClientRect().bottom;
        if (cover > r.top) window.scrollBy({ top: r.top - cover - margin, behavior: 'auto' });
      } else if (botPin) {
        const cover = botPin.getBoundingClientRect().top;
        if (cover < r.bottom) window.scrollBy({ top: r.bottom - cover + margin, behavior: 'auto' });
      }
    });
  });
}
