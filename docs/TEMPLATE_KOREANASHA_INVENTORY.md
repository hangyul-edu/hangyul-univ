# Template inventory — `template-koreanasha`

*Audited 2026-10-16 for the V10 pass. Source: `/root/hangyul-univ/template-koreanasha` (owner-authorised; the same
build is served at <https://univ.talkhangyul.com/> — verified identical: every one of the five review widths
returns the same page height, the same title and the same markup). Companion sections: REPORT §65–68.*

---

## 0. The headline finding

**Koreanasha is itself a customised build of Eduan.** `assets/css/main.css` opens with the Eduan banner:

```
Template Name: Eduan - School University & Online Education Template
```

and the class vocabulary (`h2_blog-item`, `h6_footer-area`, `h4_faq-content`, `section-area-6`, `theme-btn`,
`brand-active`) is Eduan's. `assets/js/main.js` is the **unmodified** Eduan bundle: it boots ~25 Swiper instances for
demo pages that do not exist here.

What Koreanasha actually added on top of Eduan is a thin, high-value **customisation layer** of ~500 hand-written CSS
lines prepended to `main.css` plus one appended media-query block. That layer is the thing the user prefers — not
Eduan, and not Koreanasha's content:

| The Koreanasha layer | Why it reads better than our V9 Eduan build |
|---|---|
| Floating white **pill header** (`position: fixed; inset: 40px 30px auto; border-radius: 60px`) | The page starts as a photograph, not as a dark chrome band |
| **Full-viewport photographic hero** (`height: 100dvh`) with **three hand-made crops**, one per breakpoint | The image is composed for each device instead of `object-fit: cover` at one focal point |
| Alternating **white / `#E8EFFD`** section bands at `pt-100 pb-90` | A calm, obvious rhythm; every section is a distinct movement |
| Centred **eyebrow → two-tone headline → lead** | One typographic idea, repeated; the second headline line carries the brand colour |
| **20 px-radius white cards**, `padding: 50px 45px`, no border | Content feels placed on the band, not boxed in |
| **15 px-radius full-width photography** in alternating image/text rows | Photography is a first-class element at real scale |
| Three-row **logo marquee**, alternating direction | Institutional credibility without a claim |

**V10 decision:** port that layer (re-themed to Hangyul), not the Eduan chassis underneath it and not Koreanasha's
content. Because Koreanasha and Eduan are the same template family, `packages/eduan-ui` and the new
`packages/koreanasha-ui` cannot visually disagree — which satisfies the brief's "must look like ONE website".

---

## 1. Technology

| Layer | What is there | V10 decision |
|---|---|---|
| Pages | **One** static `index.html` (122 KB, 1,760 lines). No build step, no router, no second page. | — |
| CSS | Bootstrap 5 (195 KB), `main.css` (**425 KB**, Eduan + Koreanasha layer), Font Awesome Pro (**505 KB**), animate.css (69 KB), magnific-popup, odometer, nice-select, meanmenu, swiper, select2, datepicker, bxslider, jQuery-UI range slider | **REMOVE** the stack. PORT only the Koreanasha layer (~500 lines) + the handful of Eduan rules it depends on. |
| SCSS | 46 partials (`assets/scss`) — Eduan's, unmodified; the Koreanasha layer exists **only** in compiled `main.css`, never in SCSS | ADAPT: the layer is re-authored as `packages/koreanasha-ui/src/styles/*.scss` so it is maintainable for the first time. |
| JS | jQuery 3 + 14 plugins + **two copies of Swiper** (`swiper-bundle.min.js` 142 KB and `swipper-bundle.min.js` 141 KB, both loaded? — only the first is), `jquery-ui-slider-range.js` (**558 KB**), i18next + `lang.js` (109 KB, ko/ru), AOS and SweetAlert2 from CDN, GA4 | **REMOVE**. React ports replace the four behaviours actually used. |
| Behaviours actually used | sticky-scroll class, offcanvas toggle, Bootstrap collapse (FAQ) + modal + pills, rAF logo marquee, AOS reveal, i18next text injection | PORT (4) / ADAPT (2) — see §4. |
| Fonts | Roboto + Sansita Swashed from Google Fonts; Font Awesome Pro webfonts (18 files, both `fonts/` and `webfonts/` — duplicated) | **REMOVE**. Hangyul uses Pretendard Variable (self-hosted) + Lucide. |
| i18n | `lang.js`: a 109 KB object of ko/ru strings injected with `innerHTML` into `id="..."` placeholders | **REMOVE**. Hangyul has 56 locale bundles (33 markets) in `@hangyul/i18n`; `innerHTML` injection is also an XSS pattern. |
| `<html lang="zxx">` | "no linguistic content" — wrong, and an a11y defect | Fixed by our existing locale handling. |

---

## 2. Section-by-section inventory

Every row: **source** · **component** · **visual purpose** · **current Koreanasha content** · **Hangyul use** · **decision**.

| # | Source | Component / section | Visual purpose | Current Koreanasha content | Hangyul use | Decision |
|---|---|---|---|---|---|---|
| 1 | `index.html:50-70` | `.sidebar-info` offcanvas + overlay | Mobile navigation drawer | Logo, close, mirrored menu | Mobile nav | **PORT** — we already have an accessible `Offcanvas` in `eduan-ui`; reuse it, restyle. |
| 2 | `index.html:74-128`, `main.css:293` | **Floating pill header** `.header-area.header` | The signature: chrome floats over the photograph | Logo, 4 anchors, language flag dropdown, one blue "Заявка" button, burger | Site header on every page | **DIRECT** — the single most valuable element. Re-themed; CTA becomes **Login**. |
| 3 | `index.html:131-158`, `main.css:3926` + tail media queries | **Full-viewport hero** `.banner-area > .single-banner` | Desire. `100dvh`, background image, text with `text-shadow`, one CTA | Kim Yechan on a Seoul walkway; "Учеба в Корее - это просто!" | Home hero | **ADAPT** — keep the pattern and the three-crop system; **replace the photograph** (brief Part 2) and the CTA. |
| 4 | `main.css:23363`, `:23457` | **Per-breakpoint hero crops** `banner_c / banner_t_c / banner_m_c` | ≤575 px gets a *portrait* 900×1200 crop; 575–1199 a 1560×919; ≥1200 a 4032×2250 | three hand-made crops of one shoot | Hero art direction | **DIRECT (technique)** — this is exactly the "intentional focal-position/crop configuration" the brief asks for. |
| 5 | `main.css:23364-23380` | Mobile hero composition | Content absolute at `bottom: 70px`, centred; desktop button hidden, a mobile-only button shown | — | Hero on phones | **ADAPT** — same idea, implemented without duplicate buttons (one button, repositioned). |
| 6 | `index.html:160-228` | About — **alternating image/text rows** `.about-img` + `.about-content`, 15 px radius, caption overlay | Human presence at photographic scale | §1 Kim Yechan (live); §2 Alina Chebotareva, §3 Alexandra Sairanova (both commented out) | — | **ADAPT (layout) / REMOVE (content)** — the layout becomes the Services rows (#13). The person content is removed: no fake employee (brief). |
| 7 | `index.html:177` → `assets/img/p1_c.webp` | CEO portrait with `.text-overlay` name badge | — | **김예찬 — Koreanasha 대표** (`lang.js:27-28`) | — | **REMOVE** — explicitly Kim Yechan-associated (see §5). |
| 8 | `index.html:232-280` | **Why** — three white cards on `bg-gray`, icon + coloured heading + lead | Three reasons, equal weight | Full support / 100 % tailored / best price | "What complexity disappears" | **PORT** — card anatomy kept; content replaced with concrete Hangyul statements. |
| 9 | `index.html:283-340`, `index.html:1676-1725` | **Logo marquee** — 3 tracks × 10–12 SVGs, alternating direction, rAF 1 px/frame | "50+ Korean universities are waiting" | 32 university crest SVGs | University discovery band | **ADAPT** — port the *look*; reimplement as a CSS animation (see §4.3) and show **our catalogue's real universities**, with no partnership claim. |
| 10 | `index.html:342-958` | **Pricing** — 4 tab pills + 3 cards, discount badges, strikethrough prices, checklist pills with chevrons | Plan comparison | 4 categories, 8 plans, "42 % OFF", "Максимальная скидка", "BEST" | Services & plans page | **ADAPT (card + checklist anatomy) / REMOVE (urgency)** — no invented discounts or "BEST" badges; real `is_demo`-flagged prices only. |
| 11 | `index.html:961-1021` | **Services** — three alternating image/text rows with large 15 px-radius photography | Service breadth, concretely | Campus / Korean Air / hanbok visitors | "Real student services" on home | **PORT** — the best composition in the template for Hangyul's housing / pickup / visa / documents story. |
| 12 | `index.html:1024-1138` | Reviews / testimonials | Social proof | **Commented out** | — | **REMOVE** — Hangyul has no verified reviews and will not invent any (brief Part 23). |
| 13 | `index.html:1140-1288` | **FAQ** — Bootstrap accordion, white pills on `bg-gray` | Answer real questions | 10 questions (documents, TOPIK, language exams, deadlines, scholarships, GPA, age, work) | Home FAQ | **PORT** — pattern and the question *set* (these are the real student questions); answers rewritten from our own sourced data. |
| 14 | `index.html:1290-1336` | Footer — logo, legal identity line, 6 social icons | Identity and reachability | 대표 / 이메일 / 사업자등록번호 + Instagram, TikTok, YouTube, Facebook, VK, Telegram | — | **ADAPT** — keep "legal identity in the footer" (strong Korean trust signal); our footer already has link columns. No social accounts are invented. |
| 15 | `index.html:1340-1500` | **Apply modal** — 4-step form, ~20 fields incl. nationality, age, degree, language scores, budget, city, post-graduation plan, consents | The template's single conversion goal | — | — | **REMOVE** — the brief forbids a public application form; this work belongs in the authenticated Student Platform. |
| 16 | `index.html:84-110` | Language dropdown with flag images (`ko.jpg`, `ru.jpg`) | Language switch | 2 languages | — | **REMOVE** — we have a searchable `LanguageSwitcher` over 33 markets (56 bundles); flag-per-language is also a known i18n anti-pattern. |
| 17 | `main.css:477` | `.bg-gray` = **`#E8EFFD`** (not grey) | Section-band alternation | — | Band alternation | **ADAPT** — becomes Hangyul tangerine-50 `#FFF4EC`. |
| 18 | `main.css:2320+` | `.theme-btn` (h 40, radius 6) + `.btn-blue` (radius 60, `#1C49FF`) | Pill CTA | — | Buttons | **ADAPT** — pill geometry kept, re-themed; height raised to 48/56 for touch targets. |

---

## 3. Design tokens extracted

| Token | Koreanasha | Hangyul V10 | Why |
|---|---|---|---|
| Primary action | `#1C49FF` | `#CC4E00` (`color.primary`) | Hangyul action tangerine; white on it = 4.51:1 (AA) |
| Accent text | `#145CE6` (`.text-blue`) | `#B84600` (`color.primaryText`) | 5.2:1 on white |
| Headline gradient | `linear-gradient(270deg,#070251,#145CE6)` | **dropped** | Gradient text has no reliable fallback and fails at small sizes |
| Band tint | `#E8EFFD` | `#FFF4EC` (tangerine-50) | Same rhythm, Hangyul's warmth |
| Headline ink | `#1E1E1E` | `#181A1F` / brand black `#282828` | Existing token |
| Card | `#FFF`, radius 20, pad 50/45, no border | same radius/pad, `1px` hairline added | Cards on a tinted band need an edge at AA contrast |
| Photo radius | 15 px | 16 px | Our radius scale |
| Section rhythm | `pt-100 pb-90` | `--kn-band: 100px` (72 on tablet, 56 on phone) | Koreanasha has no phone step-down; ours does |
| Header | fixed, `top 40 / inset 30`, radius 60, `1px #E5E5E5`, `0 0 4px rgba(0,0,0,.25)` | same geometry; shadow softened to `0 2px 18px rgba(24,26,31,.14)` | The original's 4 px blur at 25 % reads as a hard edge |
| Body font | Roboto | Pretendard Variable | Already self-hosted; covers Korean |

---

## 4. Behaviours — how each is ported to React

| # | Koreanasha | Mechanism | V10 implementation |
|---|---|---|---|
| 4.1 | Sticky header | `$(window).on('scroll')` adds `.sticky` | **PORT** — `useStickyHeader` already exists in `eduan-ui`; reused. |
| 4.2 | Offcanvas mobile menu | jQuery class toggles, no focus trap, no Esc | **ADAPT** — the existing accessible `Offcanvas` (focus trap + Esc + `aria-expanded`). |
| 4.3 | Logo marquee | `requestAnimationFrame`, 1 px/frame, forever, no reduced-motion check, no off-screen pause | **ADAPT** — CSS `@keyframes` translateX on a duplicated track: GPU-composited, pauses on hover/focus, and `@media (prefers-reduced-motion: reduce)` stops it and makes the row a plain wrapped grid. |
| 4.4 | FAQ accordion | Bootstrap collapse (JS, `data-bs-*`) | **ADAPT** — native `<details>/<summary>`: keyboard- and screen-reader-correct with no JS. |
| 4.5 | Scroll reveal | AOS from CDN; elements sit at `opacity: 0` until the library loads — **if the CDN fails the page is blank** | **ADAPT** — `IntersectionObserver` reveal that starts *visible* and only animates when the observer is available; reduced-motion disables it. |
| 4.6 | Pricing tabs | Bootstrap pills | **ADAPT** — existing `YTabs`-style roving-tabindex tablist. |
| 4.7 | Apply modal | Bootstrap modal + 4-step custom JS | **REMOVE**. |
| 4.8 | Counters | odometer + appear.js | **REMOVE** — V9 already renders solid numerals. |

---

## 5. Image inventory and the Kim Yechan rule

The brief: replace every photograph **explicitly** associated with 김예찬 through filename, alt text, caption,
content reference, team/member metadata or page context — and do **not** infer identity from an unlabeled face.

Searching the whole folder for `예찬|yechan` matches **one file**, `assets/js/lang.js`, at three places:

| Match | Line | What it binds to |
|---|---|---|
| `about_us_section1_subtitle: "<h5>김예찬</h5>Koreanasha 대표"` | 27 | The `.text-overlay` caption on **`assets/img/p1_c.webp`** (`index.html:177`) |
| `about_us_section1_title: "…Koreanasha의 대표 김예찬입니다."` | 28 | The body copy of that same row |
| `footer_description: "<strong>대표</strong>: 김예찬…"` | 263 | Footer legal identity (text, no image) |

**Explicitly associated images → replaced/removed:**

| Asset | Association (evidence) | Action |
|---|---|---|
| `assets/img/p1.png`, `p1_c.png`, `p1_c.webp` | Caption `about_us_section1_subtitle` renders *over* this image; the adjacent copy names him | **Not carried into Hangyul.** The person-centric row is removed entirely (no fake employee). |
| `assets/img/banner/banner*.webp` (6 files) | Hero. Not labelled with his name, but it is the same company's founder-led shoot, and the brief orders the hero replaced regardless | **Replaced** (brief Part 2 exception 1). |

**Named, but not Kim Yechan** — also not used, for the same no-fake-staff reason:

| Asset | Association | Action |
|---|---|---|
| `p2*.{png,webp}` | `about_us_section2_subtitle`: 체보타레바 알리나, Koreanasha 컨설턴트 (section commented out) | Not used — real named staff of another company. |
| `p3*.{png,webp}` | `about_us_section3_subtitle`: 사이라노바 알렉산드라, Koreanasha 컨설턴트 (commented out) | Not used — same. |

**Preserved** (no person association; carried into the Hangyul photo system — see `docs/MEDIA_LICENSE_AUDIT.md`, "Marketing photographs" (formerly `docs/MARKETING_ASSETS.md`)):

| Asset | Subject | Hangyul slug | Use |
|---|---|---|---|
| `s1_c.webp` 3000×1830 | Korean university campus from the air, autumn, golden hour, mountains behind | `korea-campus-autumn-aerial` | **Hero** (desktop/tablet) + `korea-campus-autumn-portrait` (phone crop) |
| `s2_c.webp` 5569×3712 | Korean Air widebody on the apron | `korean-air-apron` | Arrival & airport pickup service row |
| `s3_c.webp` 5184×3456 | Visitors in hanbok at a palace | `gyeongbokgung-hanbok-visitors` | Available; **not used on home** — tourism-cliché for our message (brief Part 2) |
| `assets/img/university/u-*.svg` (32) | University crests | — | **Not used.** They are third-party marks and showing them implies partnership Hangyul does not have (brief Part 23). |
| `assets/img/icon/*.svg` (handshake, flight_takeoff, credit_score, inventory, check_circle_outline…) | Material Symbols outlines | — | Not used; Lucide already covers these and is one icon system. |

**Koreanasha brand artifacts removed:** `logo.png/svg`, `logo-white.png`, the five colour logo variants,
`favicon.png`, `pre_img.png` (OG image), `og:*`/`twitter:*`/`canonical` to `edu.koreanasha.com`, the
`naver-site-verification` token, the GA4 id `G-01X2GWJKSD`, the Russian keyword block, six social URLs, the business
registration number `139-74-00672` and `koreanasha333@gmail.com`.

---

## 6. Defects found in the original (not reproduced)

| # | Defect | Evidence |
|---|---|---|
| 1 | `<html lang="zxx">` — "no linguistic content" on a bilingual page | `index.html:2` |
| 2 | **No `<h1>`** anywhere; the hero is an `<h2>` | document outline |
| 3 | Content invisible if a CDN fails — AOS elements are `opacity: 0` until `cdnjs` answers | `index.html:1516` |
| 4 | `alt` missing on every `.about-img` and `.about-content` photo; marquee alt text is `"Slide 1".."Slide 12"` | `index.html:177, 294-333, 975` |
| 5 | Duplicate `id="experiment-premium-installment-discount-rate"` (lines 392 and 586) — invalid HTML | `index.html` |
| 6 | The page *loads* ~1.5 MB of CSS+JS (Font Awesome Pro CSS 505 KB + `main.css` 425 KB + Bootstrap 195 KB + jQuery/Swiper/plugins), of which Font Awesome supplies **four** glyphs (`angle-right`, `bars`, `star`, `times`); a further ~750 KB sits in `assets/` shipped but never referenced (`jquery-ui-slider-range.js` 558 KB, select2, datepicker, bxslider, a second Swiper copy `swipper-bundle.min.js`); the Font Awesome webfonts are duplicated across `fonts/` and `webfonts/` | `index.html:1502-1517` vs. asset listing |
| 7 | `main.js` initialises ~25 Swiper sliders for Eduan demo pages that do not exist | `assets/js/main.js:31-989` |
| 8 | Hero images are unoptimised: `p1_c.webp` is 5712×4284 / 1.2 MB for a half-width column | `identify` |
| 9 | Marquee rAF loop never stops — it runs off-screen, in background tabs and under `prefers-reduced-motion` | `index.html:1703-1716` |
| 10 | Mobile hides the real CTA with `visibility: hidden` and renders a **second** duplicate button — two tab stops, one invisible | `main.css:23369`, `index.html:144-152` |
| 11 | `lang.js` writes translations with `innerHTML` | `lang.js` |
| 12 | Three commented-out sections (reviews, about §2, §3) left in the shipped HTML | `index.html:198-224, 1024-1138` |
| 13 | Pricing invents urgency: "42 % OFF", "Максимальная скидка", "BEST" with struck-through prices | `index.html:385-690` |
| 14 | 15.2 phone screens; the pricing section alone is 2,800 px at 390 px | capture metrics |
| 15 | `#about-us`, `#pricing-plans` etc. are anchors on one page — no routes, no per-page SEO, one `<title>` | `index.html` |

---

## 7. What V10 takes, in one list

**DIRECT** (geometry/technique kept as-is, re-themed): floating pill header · full-viewport photographic hero ·
per-breakpoint hero crops · band alternation · centred eyebrow/two-tone-headline/lead · 20 px white cards ·
15 px full-width photography in alternating rows · pill CTA.

**PORT** (reimplemented in React, same look): sticky header · offcanvas · logo marquee · FAQ accordion ·
three-card "why" row · service rows · checklist pills.

**ADAPT**: hero photograph · colour system · reveal animation · tabs · mobile hero composition · marquee content.

**REMOVE**: every Koreanasha brand artifact · the apply modal and the whole public-form conversion model ·
person-centric about rows · invented discounts and "BEST" badges · university crest marquee content ·
testimonials · flag language picker · jQuery + 14 plugins · Font Awesome · AOS · odometer · `lang.js` ·
Eduan's unused `main.js`.
