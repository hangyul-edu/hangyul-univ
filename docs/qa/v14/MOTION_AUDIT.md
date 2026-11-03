# V14 Motion audit

What moves on the public site, why, and what happens when it must not.

The point of this document is the brief's own test: *"The document should prove that motion is deliberate
rather than random."* Every entry below names the purpose the motion serves. If a piece of motion had no
purpose, it was not built.

---

## The motion language

Six durations and four easings, in `packages/design-tokens/src/index.ts`, emitted as CSS variables.

| Token | Value | For |
|---|---|---|
| `--hg-motion-fast` | 120 ms | a control responding to a pointer |
| `--hg-motion-base` | 180 ms | a hover or state change |
| `--hg-motion-slow` | 260 ms | something opening — a sheet, an accordion |
| `--hg-motion-reveal` | 560 ms | an entrance: text and small elements |
| `--hg-motion-media` | 760 ms | an entrance: photography, masked reveals |
| `--hg-motion-hero` | 1400 ms | the hero's one first-load settle |
| `--hg-motion-stagger` | 80 ms | the gap between siblings in a group reveal |

| Easing | Curve | For |
|---|---|---|
| `--hg-ease-standard` | `cubic-bezier(.2,.8,.2,1)` | interface state |
| `--hg-ease-enter` / `--hg-ease-out` | `cubic-bezier(.22,1,.36,1)` | every entrance |
| `--hg-ease-exit` | `cubic-bezier(.4,0,1,1)` | something leaving |
| `--hg-ease-emphasis` | `cubic-bezier(.16,1,.3,1)` | reserved for the conversion moment |

Interface state gets ~3× less time than an entrance, because they are different kinds of event: a button that
takes 560 ms to respond feels broken, and a section that arrives in 180 ms reads as a flicker rather than as
something that arrived.

`--hg-ease-enter` is the brief's premium-entrance curve: a fast start that *settles* rather than decelerating
evenly, which is what makes an element look like it arrived somewhere instead of sliding to a stop. Nothing
springs and nothing bounces.

## One component

`Reveal` in `@hangyul/koreanasha-ui`, four variants. There is no `Reveal2`, no `PremiumReveal`, no
`AnimationV14` — the brief rules those out by name and the component predates this pass, so it was refined
rather than replaced.

| Variant | What it does | Used for |
|---|---|---|
| `fade` | opacity only | something whose position is the point — a heading over a photograph |
| `rise` | opacity + 20 px lift | the default, for text and small elements |
| `media` | `clip-path` wipe up + 12 px settle + 1.2 % scale | one large photograph per section |
| `stagger` | a container whose direct children arrive 80 ms apart | the hero copy block, the value triptych |

**The resting state is visible.** The hidden state is applied only once script adds `.kn-reveal--armed`, and
that only happens when `IntersectionObserver` exists and the reader has not asked for reduced motion. Koreanasha's
own build loads AOS from a CDN, which sets `opacity: 0` on every section at parse time — if the CDN fails, the
page is blank. This cannot do that.

`@media print` resets every armed state, so a reveal is never the reason something is missing from a printout.

## Section by section

| Section | Purpose | Trigger | Duration & easing | Phone | Reduced motion |
|---|---|---|---|---|---|
| **Header pill** | orientation — it is the same pill at the top of the page and 4,000 px down | none | — | identical | identical |
| **Hero image** | emotion — the photograph is half of what this screen sells | first load, once | scale 1.025 → 1, 1400 ms, `ease-enter` | identical | no animation |
| **Hero copy** | hierarchy — headline, then lede, then the action | first load (already on screen) | `stagger`, 560 ms + 80 ms steps | identical; copy is in the upper half | appears immediately |
| **Primary CTA** | orientation — the control answers the pointer | hover / focus | 120–180 ms, `ease-standard` | tap state only | colour change only, no transform |
| **University band heading** | hierarchy | enters viewport | `fade`, 560 ms | identical | appears immediately |
| **University marquee** | emotion + continuity — the band is alive before you reach it | continuous | 46 s / 54 s / 50 s linear, left · right · left | same, slower relative speed at 52 px crest height | **stopped**; becomes a centred static grid of the 23 unique marks |
| **Crest hover** | orientation — these are links | hover / focus | 3 px lift, 180 ms | no hover on touch | transition and transform removed outright |
| **Value triptych** | hierarchy — three propositions in an order | enters viewport | `stagger`, whole group settled in ~400 ms | same stagger, stacked | all three appear immediately |
| **Service photography** | emotion — image first, words after | enters viewport | `media`, 760 ms wipe | identical, 4:3 crop | appears immediately |
| **Service text** | continuity — the words follow their picture | enters viewport | `rise`, 560 ms, +120 ms delay | identical | appears immediately |
| **FAQ accordion** | orientation — what just opened | click / Enter | native `<details>`, 260 ms, chevron rotation | identical | instant open, no rotation |
| **Closing band** | emotion — the one conversion moment | enters viewport | `rise`, 560 ms | identical | appears immediately |
| **Language sheet (phone)** | orientation — where this came from | tap | 260 ms rise + fade, `ease-enter` | — | no animation |

### What is deliberately *not* animated

- **The logos in the marquee.** The band's motion is the belt. Adding a hover bounce or an entrance fade to
  logos that are already sliding gives the section two competing effects (brief Part 21).
- **Section backgrounds.** The surface system is one continuous page; there is nothing to animate between.
- **Scroll-linked parallax.** It was considered and not built. The continuity problem it would have solved is
  solved by the surface system instead, and parallax costs a scroll-linked repaint on exactly the devices
  least able to afford one.
- **Icons, numbers, counters.** Nothing counts up. Nothing floats.
- **Section pinning / scroll hijacking.** Normal page scrolling is intact everywhere.

## Reduced motion

`prefers-reduced-motion: reduce` is not "the same animations, slower". Three mechanisms, all verified by
`npm run qa:marquee`:

1. **`Reveal` never arms.** The script checks the media query before adding `--armed`, so no element is ever
   given an opacity of 0 to recover from. There is no half-faded state to get stuck in.
2. **The marquee stops completely.** `animation: none`, the mask is removed, the track wraps, and the clone
   group plus every padding repeat is hidden — so each of the 23 universities appears exactly once rather
   than six times. Measured: **0 animated tracks, 23 crests shown, 0 duplicates.**
3. **Hero settle, crest hover and the language sheet are switched off** at the rule level.

The page under reduced motion is the finished page. Nothing is missing and nothing is mid-transition.

## Performance

The brief's rule is that motion may only animate `transform`, `opacity` and — sparingly — `clip-path`.

| Property animated | Where | Compositor-friendly |
|---|---|---|
| `transform` | marquee, hero settle, reveals, crest hover | yes |
| `opacity` | every reveal | yes |
| `clip-path` | `media` variant only, one photograph per section | repaint, but bounded and rare |

Nothing animates `top`, `left`, `width`, `height`, `box-shadow` or `filter: blur()`, and nothing animates a
large area continuously except the marquee — which uses `translate3d` and `will-change: transform` so it runs
on its own compositor layer and costs no main-thread layout while the rest of the page is revealing.

The marquee pauses on hover and on focus-within, so it is not burning frames while someone is reading a crest
or tabbing through the links.

### A trap worth recording

A reveal-on-scroll system makes **full-page screenshots lie**. Playwright's `fullPage` capture renders beyond
the viewport *without scrolling*, so every section that has never been on screen is still at `opacity: 0` and
the PNG shows blank bands no real visitor would ever see.

`scripts/qa/v14-capture.mjs` and `scripts/qa/v14-locales.mjs` therefore sweep the page before capturing — and
that sweep has to pass `behavior: 'instant'`, because Bootstrap sets `html { scroll-behavior: smooth }` on this
site and a loop of plain `scrollTo` calls restarts the smooth animation every step, leaving the page a few
hundred pixels from the top however many steps you ask for. The first V14 capture produced exactly that: a
homepage that was 4,000 px of white.
