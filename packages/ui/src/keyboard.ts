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
