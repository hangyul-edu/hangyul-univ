/**
 * Hangyul Univ design tokens — v2 ("Calm / Precise").
 * Derived from the Hangyul Brand Identity Design Guidelines (2026, ABBG):
 *   Brand: Hangyul Tangerine #FF5000 · Hangyul Black #282828 · Green #008200 · Soft Green #F5F5E6
 *   UI:    Primary #FF6700 · Mint #66CCCC · Positive #547CF1 · Negative #F24147 · Pretendard
 *
 * Principles
 *   - Neutral first. Surfaces are white and near-white greys; text is a near-black ink.
 *   - Tangerine is reserved for the single primary action, the "you are here" marker and focus.
 *     It is never used for decoration, section headers or large fills.
 *   - Semantic colours (success / warning / danger / info) only express state.
 *   - One type scale, one spacing scale, one radius scale. No half-pixel sizes.
 *
 * Single source for web (CSS variables via scripts/build-css.mjs) and React Native (import directly).
 */

export const palette = {
  tangerine: {
    50: '#FFF4EC', 100: '#FFE4D1', 200: '#FFC9A3', 300: '#FFA96B', 400: '#FF8A3D',
    500: '#FF7A1F', 600: '#FF7010', 700: '#F56A00', 800: '#FF6700', 900: '#FF5000',
  },
  brandTangerine: '#FF5000',
  brandBlack: '#282828',
  brandGreen: '#008200',
  softGreen: '#F5F5E6',
  mint: '#66CCCC',
  // V31 (REPORT §419): the neutral ramp is WARM. It was blue-grey (#E7E8EA, #555A62, #8A9099…), and every hairline,
  // secondary label and control edge in four products carried that cool cast — the "grey enterprise" look owners saw.
  // Each step keeps or improves its WCAG role: control edge 3.22 → 3.61:1, tertiary text 5.20 → 5.78:1 on white.
  warm: { 25: '#FBFAF7', 50: '#F6F3EE', 100: '#EFEBE4', 200: '#E3DED6' },
  gray: {
    0: '#FFFFFF', 50: '#F6F3EE', 100: '#EFEBE4', 200: '#E8E4DD', 300: '#D6D0C6', 400: '#A29C92',
    500: '#6A655D', 600: '#56524B', 700: '#3D3A35', 800: '#292722', 900: '#181A1F', 1000: '#000000',
  },
  ink: { 700: '#2B3038', 800: '#1D2026', 900: '#131519' },
  blue: { 50: '#EEF3FE', 100: '#DCE6FD', 500: '#4F74E8', 600: '#3A5BCC', 700: '#2C47A6' },
  red: { 50: '#FDEFEF', 100: '#FADADB', 500: '#E5484D', 600: '#CD2B31', 700: '#A61E23' },
  green: { 50: '#EBF6EF', 100: '#D3EDDC', 500: '#2E9E5B', 600: '#1F7F45', 700: '#176535' },
  amber: { 50: '#FEF6E7', 100: '#FCE8C3', 500: '#E69A00', 600: '#B97A00', 700: '#8A5A00' },
  teal: { 50: '#E8F6F6', 100: '#CDEBEB', 500: '#3AA8A8', 600: '#2B8686', 700: '#226A6A' },
} as const;

/**
 * `primary` is the ACTION tangerine (buttons, links, focus, current step). White on it = 4.51:1 (WCAG AA).
 * The bright brand tangerine #FF6700 (2.92:1 with white) is kept for the logo and rare large brand moments only.
 */
export const color = {
  primary: '#CC4E00',
  primaryHover: '#B34400',
  primaryPressed: '#9E3C00',
  primarySubtle: '#FFF1E7',
  primaryText: '#B84600', // 5.2:1 on white
  brandBright: palette.tangerine[800],
  brand: palette.brandTangerine,
  secondary: palette.mint,
  bg: palette.gray[0],
  bgCanvas: palette.warm[25],
  bgMuted: palette.gray[50],
  surface: palette.gray[0],
  surfaceWarm: palette.warm[50],
  surfaceSunken: palette.gray[100],
  surfaceHover: '#F9F7F3',
  border: palette.gray[200],
  borderSubtle: '#F0ECE6',
  borderStrong: palette.gray[300],
  /**
   * The outline of a control the reader has to recognise as clickable — a secondary button on white.
   * `borderStrong` (#D5D7DB) is 1.44:1 on white: fine for separating two blocks of content, not enough for
   * the only edge a button has. This is the lightest grey that still reaches **3:1**, which is WCAG 1.4.11's
   * floor for the boundary of a user-interface component, so the button reads as a button before hover.
   */
  borderControl: '#8C867C',
  text: palette.gray[900],
  textSecondary: palette.gray[600],
  textTertiary: palette.gray[500],
  textDisabled: palette.gray[400],
  textOnPrimary: '#FFFFFF',
  focus: '#CC4E00',
  overlay: 'rgba(19, 21, 25, 0.44)',
  admin: { sidebar: palette.gray[50], sidebarText: palette.gray[600], sidebarActive: palette.gray[900] },
} as const;

/** Semantic status colours. Each has fg (text/icon), bg (subtle fill) and solid (dot / bar). */
export const status = {
  success: { fg: palette.green[700], bg: palette.green[50], solid: palette.green[500] },
  info: { fg: palette.blue[700], bg: palette.blue[50], solid: palette.blue[500] },
  warning: { fg: palette.amber[700], bg: palette.amber[50], solid: palette.amber[500] },
  danger: { fg: palette.red[700], bg: palette.red[50], solid: palette.red[500] },
  neutral: { fg: palette.gray[600], bg: palette.gray[100], solid: palette.gray[400] },
  brand: { fg: '#B84600', bg: '#FFF1E7', solid: '#CC4E00' },
  teal: { fg: palette.teal[700], bg: palette.teal[50], solid: palette.teal[500] },
} as const;
export type StatusTone = keyof typeof status;

/**
 * Chart palette (validated with the dataviz six-checks script: lightness band, chroma, CVD ΔE ≥ 12, normal-vision ΔE ≥ 17).
 * Single-series charts use slot 1 (slate blue). Tangerine (slot 2) is the "highlight / you" series.
 * Slot 7 is "Other". Dark-mode steps live in build-css.mjs.
 */
export const chart = {
  categorical: ['#4A6FD1', '#FF6700', '#1F9A8A', '#B7860B', '#8E62C9', '#D6457A', '#9DA3AD'],
  sequential: ['#F0F1F3', '#D9DCE1', '#B4BAC3', '#8A919C', '#5F6670', '#3A3F47', '#16181C'],
  highlight: palette.tangerine[800],
  ink: '#4A6FD1',
  muted: palette.gray[300],
  positive: palette.green[500],
  negative: palette.red[500],
  grid: palette.gray[100],
  axis: palette.gray[500],
} as const;

/** 4px base spacing scale. */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80, 24: 96 } as const;
/**
 * Composition spacing (V13, brief Part 22) — the vertical rhythm *between the parts of one content group*,
 * as opposed to `space`, which is the raw step scale.
 *
 * A page-level `gap: 12` says nothing about why; `--hg-flow-copy` says "this is the distance between a piece
 * of supporting copy and the controls that act on it", which is a decision a designer can review and a
 * reviewer can argue with. Every value is fluid, because the right optical gap at 320 px is not the right one
 * at 1728 px, and the pair has to stay *ordered* — copy→action must always read as a larger break than
 * heading→copy, or the three parts collapse into one block, which is exactly the defect V13 opened with.
 *
 * Measured against the brief's ranges: heading→copy 24–32, copy→action 28–36, action↔action 12–16.
 */
export const flow = {
  /**
   * Headline → its supporting copy. The small break: these two are one thought.
   *
   * V14 final pass: the ceiling comes down from 30 to 26 px. At 30/36 the two hero gaps were six pixels
   * apart, which is inside both ranges and still reads as one compressed block — the eye cannot see a 20 %
   * difference between two gaps separated by a line of text. The ratio is what carries the hierarchy, not
   * either number on its own.
   */
  heading: 'clamp(22px, 1.8vw, 26px)',
  /**
   * Supporting copy → the controls that act on it. The large break: a new kind of thing starts here.
   *
   * V14 final pass: ceiling 36 → 40 px, floor 28 → 30 px. With `heading` above, the desktop pair is now
   * 26/40 (a 1.54 ratio) instead of 30/36 (1.2), so the second pause is unmistakably the larger one.
   */
  copy: 'clamp(30px, 3.2vw, 40px)',
  /** Between sibling actions in one decision area. */
  actions: 'clamp(12px, 1vw, 16px)',
  /** Section heading block → the content it introduces. */
  section: 'clamp(32px, 3.4vw, 48px)',
  /** One content group → the next content group inside a section. */
  group: 'clamp(40px, 4.6vw, 64px)',
} as const;

export const radius = { xs: 4, sm: 6, md: 8, lg: 10, xl: 14, pill: 999 } as const;
/**
 * V25 (REPORT §317) — one action shape for the whole brand. Marketing buttons were 999-px pills, the student app 8 px and the
 * consoles 6 px: three shapes for one brand. Every product now draws its buttons from these values; pills are kept for chips,
 * selectors and stage markers, where the shape means "a tag" rather than "an action".
 *
 *   radius        soft rectangle — editorial, not a SaaS pill
 *   secondaryBg   SECONDARY on a light surface: a warm-neutral filled surface that is visible on white without looking like
 *                 an input (the V24 1.5 px outline read as a form field); ink text, no border
 *   heights       40 / 48 / 56 — every size clears the 44 px touch target except `sm`, which is for dense consoles
 */
export const control = {
  radius: 10,
  heightSm: 40,
  height: 48,
  heightLg: 56,
  // V27 (REPORT §361) made SECONDARY = white + a visible 3:1 edge, but only in the generated tokens.css — this source
  // still said V25's filled #F1EEEA, so the next regeneration would have reverted it. V31 moves it here (warm edge).
  secondaryBg: '#FFFFFF',
  secondaryBgHover: '#F6F3EE',
  secondaryBgPressed: '#EFEBE4',
  secondaryText: '#181A1F',
  secondaryBorder: '#8C867C',
  secondaryBorderHover: '#57534C',
} as const;
export const font = {
  family: {
    sans: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans KR', 'Noto Sans Myanmar', 'Noto Sans Devanagari', 'Noto Sans Arabic', sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  /** Type scale: caption 12 · small 13 · body 14 · body-lg 15/16 · title 18/20 · heading 24/28 · display 36/48/64. */
  size: { xs: 12, sm: 13, base: 14, md: 15, lg: 16, xl: 18, '2xl': 20, '3xl': 24, '4xl': 28, '5xl': 36, '6xl': 48, '7xl': 64 },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  lineHeight: { tight: 1.15, snug: 1.3, normal: 1.5, relaxed: 1.65 },
  /**
   * V24 (REPORT §297) — the seven roles every product sets type by, as size / line-height pairs. New CSS names a
   * role, never a pixel value; the numeric scale above stays for the code that already uses it.
   */
  role: {
    display: { size: 'clamp(32px, 3.4vw, 44px)', leading: 1.15 },
    h1: { size: 'clamp(24px, 2.2vw, 30px)', leading: 1.25 },
    h2: { size: '22px', leading: 1.3 },
    h3: { size: '18px', leading: 1.4 },
    body: { size: '16px', leading: 1.6 },
    small: { size: '14px', leading: 1.5 },
    caption: { size: '12px', leading: 1.4 },
  },
} as const;
export const shadow = {
  xs: '0 1px 2px rgba(19, 21, 25, 0.04)',
  sm: '0 1px 2px rgba(19, 21, 25, 0.05), 0 1px 3px rgba(19, 21, 25, 0.04)',
  md: '0 4px 12px -2px rgba(19, 21, 25, 0.08), 0 1px 3px rgba(19, 21, 25, 0.05)',
  lg: '0 16px 40px -12px rgba(19, 21, 25, 0.22), 0 2px 6px rgba(19, 21, 25, 0.05)',
  focus: '0 0 0 3px rgba(204, 78, 0, 0.25)',
} as const;
export const breakpoint = { sm: 390, md: 768, lg: 1024, xl: 1280, '2xl': 1440 } as const;
/**
 * One motion language (V14, brief Part 19).
 *
 * Three durations for **interface state** — a button responding, a menu opening, an accordion unfolding — and
 * three for **entrances**, which are a different kind of event and need roughly three times as long to read as
 * deliberate rather than as a flicker. Six numbers in total: the brief's rule is that a product with dozens of
 * durations has no motion language, only a pile of transitions.
 *
 * `enter` is the premium-entrance curve the brief names: a fast start that settles rather than decelerating
 * evenly, which is what makes an element look like it arrived somewhere instead of sliding to a stop. `exit` is
 * its mirror. `emphasis` overshoots very slightly and is reserved for the one conversion moment; nothing here
 * springs or bounces.
 *
 * `stagger` is the gap between siblings in a group reveal.
 *
 * ---------------------------------------------------------------------------------------------------------
 * **V17 separated the entrance durations by what is entering** (brief Part 3).
 *
 * V14 shipped one entrance duration, `reveal: 640ms`, and every non-media entrance used it: a 42 px section
 * heading, a paragraph of supporting copy and a 15 px tick all arrived in exactly the same time. That reads
 * as a single mechanical sweep rather than as a composition, because **a duration that is right for a small
 * element is too short for a large one** — the eye tracks distance, and a heading covers far more of the
 * viewport than a caption does.
 *
 * So there are now four entrance durations instead of two, each matched to the size of the thing moving:
 *
 *   small    650 → 780 ms   ticks, chips, list items, a card's own arrival inside a stagger
 *   copy     640 → 880 ms   lede paragraphs and supporting text
 *   reveal   640 → 920 ms   the default, and what a section heading uses
 *   media    760 → 1080 ms  photography and masked wipes — the largest thing on any screen
 *
 * That is 22–42 % slower where the element is large, and deliberately **not** uniform: applying one
 * multiplier to everything would keep the defect and simply make it slower. The hero's first-load settle
 * stays at 1400 ms, which was already cinematic and is the one entrance nobody waits through twice.
 *
 * `stagger` goes 80 → 120 ms. At 80 ms a row of three completed in under 400 ms and read as simultaneous;
 * at 120 ms the same row takes 240 ms to unfold and the order is legible, which is the whole point of a
 * stagger. It stays well under the 160 ms the brief allows, because beyond that the last item in a row of
 * five arrives half a second after the first and the group stops reading as a group.
 *
 * **What is deliberately NOT slowed** (brief Part 3): `fast`, `base` and `slow` are interface state —
 * button hover, menus, dropdowns, accordions, form feedback, payment interactions — and they are unchanged.
 * A slow interface feels broken; a slow entrance feels composed. They are different events and V17 only
 * touches the second kind.
 *
 * ---------------------------------------------------------------------------------------------------------
 * **V18 made the editorial entrance a little more perceptible** (brief §4). The owner liked V17's direction
 * but wanted to actually *see* it, so each entrance duration moved up once more:
 *
 *   small    780 → 840 ms    copy    880 → 950 ms     reveal  920 → 1020 ms
 *   media   1080 → 1180 ms   hero   1400 → 1450 ms    stagger 120 → 140 ms
 *
 * The shape of V17's decision is kept rather than rescaled: the increases are +6 to +9 %, largest in
 * absolute terms where the element is largest, so the ordering small < copy < reveal < media still holds
 * and the composition still unfolds heading-first. `reveal` crossing 1 s is the point of the change — a
 * section heading now reads as *arriving* rather than as having appeared.
 *
 * `hero` moves only 50 ms. It was already the longest entrance in the product and the one a returning
 * visitor sits through most often; past ~1.5 s a first-load settle stops reading as cinematic and starts
 * reading as a slow page.
 *
 * `stagger` at 140 ms keeps a row of three unfolding over 280 ms — legible as an order, still inside the
 * 160 ms ceiling the V17 brief set, and still short enough that a row of five lands within ~560 ms.
 *
 * Interface motion is untouched again: 120 / 180 / 260 ms. The V18 gate asserts both halves — that the
 * entrance tokens sit in their V18 ranges, and that `fast`/`base`/`slow` have not drifted.
 */
export const motion = {
  fast: '120ms',
  base: '180ms',
  slow: '260ms',
  /** Entrances, by the size of what is entering. See the note above for why these are not one number. */
  small: '840ms',
  copy: '950ms',
  reveal: '1020ms',
  media: '1180ms',
  hero: '1450ms',
  stagger: '140ms',
  easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

/** The four easings of the motion language. Emitted as `--hg-ease-*`; `motion.easing` stays the UI default. */
export const ease = {
  standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  enter: 'cubic-bezier(0.22, 1, 0.36, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  emphasis: 'cubic-bezier(0.16, 1, 0.3, 1)',
  /** Alias so `--hg-ease-out` reads naturally where an entrance is being authored. */
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;
export const zIndex = { sticky: 10, header: 20, tabbar: 25, sidebar: 30, popover: 45, drawer: 50, modal: 50, toast: 60 } as const;

export const tokens = { palette, color, status, chart, space, flow, radius, control, font, shadow, breakpoint, motion, ease, zIndex };
export default tokens;
