/**
 * Koreanasha layout primitives ported to React (V10).
 *
 * Koreanasha is a customised Eduan build (REPORT §65.1), so the accessible ports that already exist in
 * `@hangyul/eduan-ui` — Offcanvas, useStickyHeader — are reused rather than written twice. What is new here is
 * Koreanasha's own anatomy: the floating pill header, the three-crop full-viewport hero, the band rhythm, the
 * card / media-row / marquee / FAQ blocks, and a reveal that degrades the right way.
 */
import { cx } from '@hangyul/utils';
import { ChevronDown } from '@hangyul/icons';
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';

/* ------------------------------------------------------------------------------------------------- Reveal */

/**
 * The product's **one** reveal (V14, brief Part 29). There is no `Reveal2`, no `PremiumReveal`, no
 * `AnimationV14`: four variants of one component cover every entrance on the site.
 *
 *   fade    opacity only — for something already in place that should not move (a heading over a photograph)
 *   rise    opacity + a short lift — the default for text and small elements
 *   media   a clip-path wipe plus a slight settle — reserved for large photography, one per section
 *   stagger a container whose direct children arrive in order, `--hg-motion-stagger` apart
 *
 * Koreanasha uses AOS from a CDN, which sets `opacity: 0` on every section at parse time — if the CDN fails the
 * page is blank. This starts **visible** and only arms the animation once the observer is known to exist and the
 * reader has not asked for reduced motion, so the content is never hidden by a script that did not run. That is
 * also the whole of the reduced-motion story (brief Part 31): nothing is armed, so nothing moves and nothing is
 * left half-faded.
 *
 * `once` defaults to true. An element that re-animates every time it re-enters the viewport is the thing that
 * makes a page feel like a demo rather than a product.
 */
export type RevealVariant = 'fade' | 'rise' | 'media' | 'stagger';

export function Reveal({ children, as: As = 'div', variant = 'rise', className, delay = 0, style, amount = 0.08 }: {
  children: ReactNode;
  as?: ElementType;
  variant?: RevealVariant;
  className?: string;
  /** Milliseconds of transition-delay. Use it to order a few siblings; prefer `variant="stagger"` for a group. */
  delay?: number;
  style?: CSSProperties;
  /** How far into the viewport the element must come before it is considered in, as a fraction of the viewport. */
  amount?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Something already on screen at mount (the hero, the first band on a short page) should play immediately
    // rather than wait for a scroll that may never come.
    setArmed(true);
    let raf1 = 0;
    let raf2 = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      /*
       * **The hidden state has to be painted before the visible one, or there is nothing to transition
       * from** (V19, REPORT §192).
       *
       * For an element already in the viewport at mount — the hero, which is the first and most important
       * animation on the site — the observer fires on the very next frame after `observe()`. React then
       * batches `setArmed(true)` and `setShown(true)` into a single render, the element appears in the DOM
       * already carrying both classes, and the browser has no previous computed value to interpolate from.
       * The hero therefore *snapped* to its resting state: the whole entrance existed in the stylesheet and
       * never ran. Frame-by-frame capture at 65/116/151/298/401/604 ms caught it — the hero was absent and
       * then fully opaque, with no intermediate value, which is why reading the duration tokens could never
       * have found this.
       *
       * Two frames: one for the armed state to be committed and painted, one to be certain it was.
       * Below-fold elements are unaffected — their observer fires seconds later, so ~33 ms is invisible.
       */
      raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setShown(true)); });
    }, { rootMargin: `0px 0px -${Math.round(amount * 100)}% 0px` });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [amount]);
  return (
    <As
      ref={ref}
      data-reveal={variant}
      className={cx('kn-reveal', armed && 'kn-reveal--armed', shown && 'is-in', className)}
      style={delay ? { ...style, transitionDelay: `${delay}ms` } : style}
    >
      {children}
    </As>
  );
}

/* --------------------------------------------------------------------------------------------------- Band */

/**
 * Koreanasha's `pt-100 pb-90` section. **The page is white** and a band is transparent by default (V14) —
 * there is no tinted alternation, and no `tint` modifier to bring one back. Three opt-ins remain:
 *
 *   afterHero  the short warm-to-white bridge, for the first band below the hero and nowhere else
 *   canvas     explicitly #FFFFFF — the university marks, where the requirement is stated rather than implied
 *   ink        the near-black band, reserved for a conversion moment
 *
 * Separation between sections comes from type, measure, space, imagery and motion. If a section looks empty,
 * the composition is wrong; a background colour is not the fix.
 *
 * `pageTop` is the fourth opt-in and the one a *subpage* needs (V19). The header is fixed, so it takes no
 * space in the flow; a band that is the first thing on a page therefore has to reserve the pill's footprint
 * or its heading renders underneath it. Setting it here rather than in each page's own stylesheet is the
 * whole point: this is the one place that knows how tall the pill is, so a page cannot get the number wrong
 * and a change to the header cannot leave five pages behind. A page that opens on a full-bleed photograph —
 * the homepage hero, the university detail's visual head — does **not** set it: there the image is the
 * clearance and reserving space above it would put a white strip over the design.
 */
export function Band({ children, afterHero, canvas, ink, id, flushTop, pageTop, className, labelledBy, narrow }: {
  children: ReactNode; afterHero?: boolean; canvas?: boolean; ink?: boolean;
  id?: string; flushTop?: boolean; className?: string; labelledBy?: string; narrow?: boolean;
  /** This band is the first thing under the floating header. Reserves the pill plus the page-top rhythm. */
  pageTop?: boolean;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy}
      className={cx('kn-band', afterHero && 'kn-band--afterhero', canvas && 'kn-band--canvas',
        ink && 'kn-band--ink', flushTop && 'kn-band--flush-top', pageTop && 'kn-band--pagetop', className)}>
      <div className={cx('kn-container', narrow && 'kn-container--narrow')}>{children}</div>
    </section>
  );
}

/**
 * Koreanasha's centred `section-area`: a headline whose emphasised line carries the brand colour, and a lead.
 * Put the coloured part of the title in `<em>`.
 *
 * There is **no eyebrow** (V14, brief Part 12). Koreanasha's original put a small orange-dotted label above
 * every heading — "서비스 소개", "FAQ" — and the owner asked for that layer to go, not to be reworded. A
 * section that already carries an `<h2>` does not need a smaller, quieter copy of the same idea above it; the
 * prop is removed rather than left optional so the layer cannot come back one section at a time. The heading
 * levels are untouched, because hierarchy here is type and space, not a decorative line of text.
 */
export function SectionHead({ title, lede, id, align = 'center', as: As = 'h2', reveal, action }: {
  title: ReactNode; lede?: ReactNode; id?: string; align?: 'center' | 'start'; as?: ElementType;
  /**
   * V25 (REPORT §311 M2): the section's own action, set directly under its heading. A section-level link that
   * floats after the section's content belongs to neither that section nor the next one.
   */
  action?: ReactNode;
  /**
   * Reveal the heading first and the supporting copy a beat later (V14 continuation, Task 3). The two parts
   * get their own `Reveal` rather than one around the pair, because a section head read as a single block is
   * exactly the thing the brief asks not to do: the heading is the promise and the copy qualifies it, so the
   * copy should arrive after it, not with it. Off by default — a head outside a reveal context, or one in a
   * place where its position is the point, renders as it always did.
   */
  reveal?: boolean;
}) {
  const head = (
    <>
      <As id={id} className="kn-head__title">{title}</As>
      {lede && <p className="kn-head__lede">{lede}</p>}
      {action && <div className="kn-head__action">{action}</div>}
    </>
  );
  return (
    <div className={cx('kn-head', align === 'start' && 'kn-head--start')}>
      {reveal ? (
        <>
          <Reveal variant="rise"><As id={id} className="kn-head__title">{title}</As></Reveal>
          {/* V17: the lede is copy, so it carries the copy duration rather than the heading's, and the beat
              between the two grew with them — at 120 ms against a 920 ms heading the two read as one event.
              180 ms is the interval at which the heading is clearly the promise and the lede clearly the
              qualification, which is what this component exists to say. */}
          {lede && <Reveal variant="fade" delay={180}><p className="kn-head__lede">{lede}</p></Reveal>}
          {action && <Reveal variant="fade" delay={240}><div className="kn-head__action">{action}</div></Reveal>}
        </>
      ) : head}
    </div>
  );
}

/* --------------------------------------------------------------------------------------------------- Hero */

export interface HeroSource {
  /** `media` for a <source>; omit on the last entry, which becomes the <img>. */
  media?: string;
  /** `srcset` value — width descriptors. */
  srcSet: string;
  webpSrcSet?: string;
  sizes?: string;
}

/**
 * Full-viewport photographic hero with one hand-made crop per breakpoint — Koreanasha's best idea
 * (`main.css:3926` plus the two media-query swaps at `:23363` and `:23457`), expressed as real responsive
 * sources so the crops can be preloaded, served as WebP and sized by the browser.
 *
 * `sources` is ordered most-specific first; the last entry is the fallback `<img>`.
 */
export function Hero({ sources, alt, eyebrow, title, lede, actions, width, height, focus, focusSm }: {
  sources: HeroSource[];
  alt: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  width?: number;
  height?: number;
  /** `object-position` for the desktop crop and, separately, for the phone/tablet one (brief Part 15). */
  focus?: string;
  focusSm?: string;
}) {
  const fallback = sources[sources.length - 1];
  const rest = sources.slice(0, -1);
  return (
    <section className="kn-hero" style={{ '--kn-hero-focus': focus, '--kn-hero-focus-sm': focusSm } as CSSProperties}>
      <picture className="kn-hero__media">
        {rest.map((s, i) => (
          <Fragment key={i}>
            {s.webpSrcSet && <source media={s.media} type="image/webp" srcSet={s.webpSrcSet} sizes={s.sizes ?? '100vw'} />}
            <source media={s.media} srcSet={s.srcSet} sizes={s.sizes ?? '100vw'} />
          </Fragment>
        ))}
        {fallback.webpSrcSet && <source type="image/webp" srcSet={fallback.webpSrcSet} sizes={fallback.sizes ?? '100vw'} />}
        <img src={fallback.srcSet.split(' ')[0]} srcSet={fallback.srcSet} sizes={fallback.sizes ?? '100vw'}
          alt={alt} width={width} height={height} fetchPriority="high" decoding="async" />
      </picture>
      <div className="kn-hero__inner">
        <div className="kn-container">
          {/* One stagger for the whole block: headline, then lede, then actions, 80 ms apart. Not one
              animation per line — the brief rules that out by name, and a headline whose two lines arrive
              separately reads as a slideshow. */}
          <Reveal variant="stagger" className="kn-hero__content">
            {eyebrow && <p className="kn-hero__eyebrow">{eyebrow}</p>}
            <h1 className="kn-hero__title">{title}</h1>
            {lede && <p className="kn-hero__lede">{lede}</p>}
            {actions && <div className="kn-hero__actions">{actions}</div>}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------------------------------- Cards */

export function Cards({ children, cols = 3 }: { children: ReactNode; cols?: 3 | 4 }) {
  return <div className={cx('kn-cards', cols === 4 ? 'kn-cards--4' : 'kn-cards--3')}>{children}</div>;
}

export function Card({ icon, title, children, className }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <article className={cx('kn-card', className)}>
      {icon && <span className="kn-card__icon" aria-hidden>{icon}</span>}
      <h3 className="kn-card__title">{title}</h3>
      {children && <div className="kn-card__text">{children}</div>}
    </article>
  );
}

/* ---------------------------------------------------------------------------------------------- Media row */

/** Koreanasha's alternating photo/text row — the composition that carries its service section. */
export function MediaRow({ media, title, children, points, flip, action, textReveal }: {
  media: ReactNode; title: ReactNode; children?: ReactNode; points?: ReactNode; flip?: boolean; action?: ReactNode;
  /** Image-first motion (brief Part 22): the words arrive one stagger step behind the photograph. */
  textReveal?: boolean;
}) {
  const words = (
    <>
      <h3 className="kn-mediarow__title">{title}</h3>
      {children && <p className="kn-mediarow__text">{children}</p>}
      {points && <ul className="kn-mediarow__list">{points}</ul>}
      {action}
    </>
  );
  return (
    <div className={cx('kn-mediarow', flip && 'kn-mediarow--flip')}>
      <figure className="kn-mediarow__media">{media}</figure>
      {/* The same direction for every row. An alternating layout whose halves animate in from opposite sides
          draws attention to the alternation rather than to the content. */}
      {textReveal ? <Reveal variant="rise" delay={120}>{words}</Reveal> : <div>{words}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ Marquee */

/**
 * A seamless infinite belt (V14, brief Part 7).
 *
 * The anatomy is two identical groups inside one track, with the track translated by exactly one group width
 * per iteration. Group B is a pixel-identical clone of group A, so the moment the animation restarts, the
 * pixels under the viewport are the ones that were there a frame earlier and nothing can be seen to jump.
 *
 * **Why V13 had visible seams, which is worth stating because it is a geometry bug and not a tuning problem.**
 * The track was `display: flex; gap: G` holding 2N items and was translated `-50%`. With one gap *between*
 * every pair of items, the track measures `2N·w + (2N−1)·G`, so half of it is `N·w + N·G − G/2`: half a gap
 * short of one group. Every iteration therefore jumped backwards by G/2 — at the 40 px desktop gap, a 20 px
 * tear, which is exactly the "occasional small gap" that was reported. No change to duration, item count or
 * easing could have fixed it; the number being animated was wrong.
 *
 * The fix is to make one group measure a whole number of repeats: the track carries **no** gap, each group
 * carries `gap: G` *and* a trailing `padding-inline-end: G`, so a group is exactly `N·w + N·G` and `-50%` of
 * two of them is exactly one. `scripts/qa/v14-marquee.mjs` samples a live row across more than a full cycle and
 * fails if a seam reappears.
 *
 * **Every rendered instance stays interactive (V30, REPORT §407).** Until V30 the padding repeats and the
 * whole of group B were `inert`. `inert` does not only hide an element from assistive technology — the HTML
 * spec makes the browser *hit-test straight through it*, so a click on any repeat landed on the row behind it.
 * With 8 crests and `minItems = 18` a row renders six copies of each crest and only the first was live: one
 * visible logo in six worked, and at some loop positions none of the ~27 on screen did. The V14 gate filtered
 * `[inert]` out before testing, so it only ever measured the copies that worked.
 *
 * Accessibility now comes from two attributes instead of `inert`: the canonical pass (group A, first repeat)
 * is the one a keyboard or screen-reader user meets, once per university; every other copy is rendered with
 * `repeat: true`, which the caller turns into `tabIndex={-1}` + `aria-hidden` **on the interactive element
 * itself** (the per-item wrapper is `display: contents`, and ARIA on such a box is unreliable). Group B also
 * carries `aria-hidden` (a real box, so that is reliable). Nothing focusable is in sequential focus order
 * inside a hidden subtree, which is what axe's `aria-hidden-focus` requires.
 */
export function Marquee<T>({ items, render, itemKey, label, seconds = 50, reverse, minItems = 12, offset = 0 }: {
  items: readonly T[];
  /** `repeat` is true for every copy except the canonical one — render it pointer-only (see above). */
  render: (item: T, opts: { repeat: boolean }) => ReactNode;
  itemKey: (item: T) => string;
  label: string; seconds?: number; reverse?: boolean; minItems?: number;
  /** 0–1 of one loop, applied as a negative animation delay so stacked rows do not start in lock-step. */
  offset?: number;
}) {
  // A group has to be wider than the widest viewport or a gap opens at the end of it mid-loop; short lists are
  // repeated until they are. Only the first pass is in the accessibility tree; every pass is clickable.
  const repeats = items.length ? Math.max(1, Math.ceil(minItems / items.length)) : 1;
  const group = (clone: boolean) => (
    <div className="kn-marquee__group" {...(clone ? { 'aria-hidden': true } : {})}>
      {Array.from({ length: repeats }, (_, r) => items.map((it) => {
        const repeat = clone || r > 0;
        return (
          <span key={`${r}-${itemKey(it)}`} {...(repeat ? { 'data-kn-dup': '' } : {})}>{render(it, { repeat })}</span>
        );
      }))}
    </div>
  );
  return (
    <div className="kn-marquee" role="group" aria-label={label}>
      <div className={cx('kn-marquee__track', reverse && 'kn-marquee__track--reverse')}
        style={{ '--kn-marquee-s': `${seconds}s`, '--kn-marquee-delay': `-${(offset * seconds).toFixed(2)}s` } as CSSProperties}>
        {group(false)}
        {group(true)}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------------- FAQ */

/** Bootstrap collapse replaced by native `<details>`: correct for keyboard and screen readers with no JS. */
export function Faq({ items }: { items: { q: ReactNode; a: ReactNode }[] }) {
  return (
    <div className="kn-faq">
      {items.map((it, i) => (
        <details key={i} className="kn-faq__item">
          <summary className="kn-faq__q"><span>{it.q}</span><ChevronDown aria-hidden /></summary>
          <div className="kn-faq__a">{it.a}</div>
        </details>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------------- CTA */

export function Cta({ title, text, actions, id }: { title: ReactNode; text?: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <div className="kn-cta">
      <div>
        <h2 id={id} className="kn-cta__title">{title}</h2>
        {text && <p className="kn-cta__text">{text}</p>}
      </div>
      {actions && <div className="kn-cta__actions">{actions}</div>}
    </div>
  );
}
