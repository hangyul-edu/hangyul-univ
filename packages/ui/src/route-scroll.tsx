/**
 * **One route-scroll policy for all four web apps** (V19, REPORT §191).
 *
 * ## The defect this replaces
 *
 * Marketing rendered react-router's `<ScrollRestoration />`. That component keys its saved positions on
 * `location.key` and persists the map in `sessionStorage` — and `location.key` is the literal string
 * `"default"` for the *first* history entry of **every** document. The site's one conversion action
 * (`유학 준비`) is a plain `<a href="/start">`, so it is a full document load. The sequence was therefore:
 *
 *   1. Home loads. Its first (and only) entry has key `"default"`.
 *   2. The reader scrolls to the closing band. On unload, `{"default": 6209}` goes into sessionStorage.
 *   3. `/start` loads as a **new document**. Its first entry also has key `"default"`.
 *   4. `ScrollRestoration` finds `6209` for `"default"` and restores it. `/start` is 1733 px tall, so the
 *      browser clamps to 833 — the bottom of a page the reader has not seen the top of.
 *
 * `scripts/qa/v19/_scroll-probe.mjs` prints that map and reproduces it. It is not a missing `scrollTo`: it
 * is one storage slot shared by every page in the origin, so *any* full-document navigation inherited the
 * previous page's offset. The student app papered over the same class of problem with a per-app
 * `useEffect(() => window.scrollTo({top: 0}), [pathname])`, which never restores on Back; the agency and
 * university consoles had nothing at all and simply kept the old offset across every route change.
 *
 * ## The policy
 *
 * | Navigation | Behaviour |
 * |---|---|
 * | PUSH/REPLACE to a different pathname | top, instantly |
 * | POP (Back/Forward), same document | restore the remembered offset for that entry |
 * | POP across documents | **left to the browser** — see the note on `scrollRestoration` below |
 * | A location with a `#hash` | untouched; the hash target owns the scroll |
 * | Same pathname, different search — `?lang=`, filters, sort, a modal or drawer on the URL | untouched |
 *
 * The last row is the one that makes this more than a `scrollTo` in a `useEffect`. Changing the language
 * from the footer, opening a drawer that writes `?doc=12`, or sorting a table are all *pushes*, and a naive
 * policy throws the reader back to the top of a page they were reading. The pathname is the page; the query
 * string is the state of the page.
 *
 * ## Why `history.scrollRestoration` is left alone
 *
 * react-router sets it to `'manual'`. This component deliberately does not: at the browser default
 * (`'auto'`) the engine restores the scroll position of a *cross-document* history entry itself, from its
 * own per-entry store, which is both more accurate than anything reconstructable here and survives a
 * restart. We own same-document navigation, the browser owns cross-document, and neither needs a shared
 * key — which is precisely the coupling that broke.
 *
 * Positions are still written to `sessionStorage` so a same-document entry survives a reload of that entry.
 * Every access is guarded: `sessionStorage` throws in some privacy modes, and a scroll policy must never be
 * the reason a page fails to render.
 */
import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigation, useNavigationType } from 'react-router';

const STORE = 'hg:route-scroll';

type Positions = Record<string, number>;

function read(): Positions {
  try {
    const raw = sessionStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Positions) : {};
  } catch {
    return {};
  }
}

function write(p: Positions) {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(p));
  } catch {
    /* private mode, or the quota is full. Losing a scroll offset is not worth an exception. */
  }
}

/**
 * The slot a history entry's offset is remembered under.
 *
 * `location.key` is unique per entry *within* a document, which is exactly what we want — and is `"default"`
 * for the entry a document opens on, which is what collided. Namespacing that one case by pathname keeps
 * every page's first entry in its own slot, so the Home offset can never be read back on `/start`.
 */
function slot(key: string, pathname: string): string {
  return key && key !== 'default' ? key : `d:${pathname}`;
}


/**
 * Scroll to a remembered offset, and keep trying for a moment.
 *
 * A restored offset is almost always *past the bottom of the document as it exists right now*: on a POP the
 * route's component has rendered, but its lazy chunks, its images and anything measured by an observer have
 * not settled, so the page is still short and the browser silently clamps the scroll. That is why the first
 * version of this file restored the directory to 107 px instead of 1400 — the number was right and there
 * was nowhere to put it.
 *
 * So the target is re-applied each frame until it sticks, the document stops growing, or a second has
 * passed. The loop also stops the moment the reader scrolls themselves: wheel, touch and keyboard only,
 * because a programmatic `scrollTo` fires `scroll` too and listening for that would cancel the restoration
 * with its own first attempt.
 */
function restore(target: number): (() => void) | undefined {
  if (target <= 0) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    return;
  }
  let raf = 0;
  let done = false;
  const deadline = performance.now() + 1000;
  const stop = () => {
    done = true;
    cancelAnimationFrame(raf);
    for (const e of ['wheel', 'touchstart', 'keydown'] as const) window.removeEventListener(e, stop);
  };
  for (const e of ['wheel', 'touchstart', 'keydown'] as const) window.addEventListener(e, stop, { passive: true, once: true });

  const tick = () => {
    if (done) return;
    window.scrollTo({ top: target, left: 0, behavior: 'instant' });
    if (Math.abs(window.scrollY - target) <= 2 || performance.now() > deadline) return stop();
    raf = requestAnimationFrame(tick);
  };
  tick();
  return stop;
}

export function RouteScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigation = useNavigation();
  // What the previous render was looking at, so we know whose offset to save and whether the page changed.
  const prev = useRef<{ slot: string; pathname: string } | null>(null);
  /*
   * The last offset this document was actually *at*, sampled as the reader scrolls.
   *
   * Reading `window.scrollY` at navigation time looks like it should work and does not: React has already
   * committed the new route's DOM by the time a layout effect runs, so if the incoming page is shorter than
   * the outgoing one the browser has **already clamped** the scroll to the new maximum. Leaving the bottom
   * of a 7,109 px Home for a 1,733 px `/start` recorded 833 px as "where Home was" — the restoration then
   * worked perfectly and returned the reader to the wrong place, which is a harder bug to see than no
   * restoration at all. Sampling during scroll captures the real value before any of that happens.
   */
  const lastY = useRef(0);
  /*
   * The offset captured the instant a navigation *started*, which is earlier and more trustworthy than
   * either of the above.
   *
   * All four apps use `createBrowserRouter`, so a navigation that has to resolve a lazy route chunk sits in
   * `navigation.state === 'loading'` for a few frames first. During those frames the outgoing page is still
   * the one in the DOM, so this is the last moment the real offset is readable. Without it, opening a
   * university from 1,400 px down the directory recorded **107** — the clamp against a momentarily short
   * document — and Back then faithfully restored the reader to 107.
   *
   * The scroll sample above remains the fallback for a navigation that resolves without ever leaving
   * `idle`; in that case there is no intermediate render to clamp against and it is already correct.
   */
  const pending = useRef<{ slot: string; y: number } | null>(null);

  useLayoutEffect(() => {
    const sample = () => { lastY.current = window.scrollY; };
    sample();
    window.addEventListener('scroll', sample, { passive: true });
    return () => window.removeEventListener('scroll', sample);
  }, []);

  useLayoutEffect(() => {
    if (navigation.state !== 'idle' && prev.current && pending.current?.slot !== prev.current.slot) {
      pending.current = { slot: prev.current.slot, y: window.scrollY };
    }
  }, [navigation.state]);

  useLayoutEffect(() => {
    const here = slot(location.key, location.pathname);
    const before = prev.current;
    prev.current = { slot: here, pathname: location.pathname };

    if (before && before.slot !== here) {
      const captured = pending.current?.slot === before.slot ? pending.current.y : lastY.current;
      write({ ...read(), [before.slot]: captured });
    }
    pending.current = null;

    // First render of this document. The browser has already decided where a cross-document entry sits
    // (`history.scrollRestoration === 'auto'`), and a link click lands at 0 on its own. Nothing to do, and
    // forcing the issue here would undo a correct native Back restoration.
    if (!before) return;

    // `/page#section` — the anchor is the destination. Each app's own hash handler, or the browser's, owns
    // this; resetting to the top afterwards is how a hash link appears not to work.
    if (location.hash) return;

    if (navigationType === 'POP') {
      return restore(read()[here] ?? 0);
    }

    // Same page, different state: `?lang=ko`, a filter, a sort, a drawer or modal written to the URL. The
    // reader is still reading the thing they were reading.
    if (before.pathname === location.pathname) return;

    // A genuine page change. `instant` rather than `auto`, because `auto` honours a `scroll-behavior:
    // smooth` set anywhere up the tree and a route transition must never be animated.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.key, location.pathname, location.hash, navigationType]);

  // Remember where we were if the reader leaves this document by a link or a reload, so that coming Back to
  // this entry in the same tab can restore it.
  useLayoutEffect(() => {
    const onHide = () => {
      const here = prev.current;
      if (here) write({ ...read(), [here.slot]: lastY.current });
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  return null;
}
