# Eduan template inventory (V7)

*Audited 2026-10-09 from `themeforest-eduan/` (licensed ThemeForest purchase, authorised by the project owner for use inside Hangyul Univ). Screenshots of every page at 390 / 768 / 1440 (+ full page at 390 / 1440): `docs/qa/v7/template-eduan/` (`scripts/qa/v7-template-capture.mjs eduan`).*

## 1. What the package is

| Item | Finding |
|---|---|
| Location | `themeforest-eduan/eduan/` (site), `themeforest-eduan/docs/` (one-page documentation) |
| Technology | Static HTML5 · Bootstrap 5 (CSS + bundle JS) · jQuery 3 · SCSS sources (`assets/scss`, Dart-Sass module syntax `@use`/`@forward`) compiled to `assets/css/main.css` (434 KB) |
| Pages | 27 HTML files: 10 homepages (`index.html`, `index-2…10.html`), about, course ×2, course-details, event, event-details, blog, blog-details, team, team-details, gallery, price, contact, sign-in, sign-up, 404 |
| SCSS architecture | `abstracts/` (`_variables` breakpoints + fonts, `_colors` map → `:root --clr-*` custom properties, `_mixins`, `_common` reset/utilities/spacing) + 41 `components/` partials (one per section family: header, banner, section, category, course, course-details, about, event, testimonial, counter, blog, cta, teacher, price, breadcrumb, gallery, account, contact, 404, admission, education, faq, feature, video, program, research, tuition, campus, apply, scholarship, career, instagram, choose, class, footer, …). Each homepage's sections are prefixed `h2_`…`h10_` inside the shared partials. |
| JS plugins | jQuery, Bootstrap bundle, Swiper (sliders), WOW + animate.css (scroll reveals), MeanMenu (mobile menu), Nice Select, Magnific Popup (video/lightbox), Odometer + appear (counters), scrollUp, GSAP (docs credit), jQuery UI range slider, bxSlider, rProgressbar, datepicker, select2 |
| Fonts | Roboto (Google Fonts), Sansita Swashed (display accent), Font Awesome 6 **Pro** (light/thin/duotone, 9.6 MB webfonts ×2 copies) |
| Images | 366 files, 14 MB, by section (`img/banner/1…10`, `course`, `campus`, `program`, `research`, `admission`, `tuition`, `scholarship`, `event`, `blog`, `cta`, `about`, `teacher`, `testimonial`, `brand`, `bg`, shapes/icons). Documentation lists **no image credits**; the photos are stock photography of (mostly Western) campuses and models. |
| Colours | `--clr-theme-primary` #1268EB (home 1–2), `-3` #F5530D, `-4` #F6BA2A, `-6` **#B1040E** (university homes 6–7), `-10` #4846AB (campus panel), headings #1E1E1E, body text rgba(30,30,30,.6) |
| Accessibility (as shipped) | `a:focus`, `button:focus`, `input:focus` → `outline: 0` (no visible focus); empty `alt=""` on content images; icon-only links without names; autoplay sliders without pause; body text rgba(30,30,30,.6) on white ≈ 5.0:1 (passes) but 14 px meta text at .5 opacity fails; menus are hover-only on desktop. **All of these are fixed in the port** (see §4). |
| RTL | None (physical `left/right`, `margin-left` everywhere). The port generates `[dir=rtl]` rules automatically (`postcss-rtlcss`). |

## 2. Homepage variants

| File | Demo name (template menu) | Composition (top → bottom) | Fit for "study in Korea" |
|---|---|---|---|
| index.html | Education Main | rounded colour-field hero + photo, brand strip, categories, course grid, about, events, testimonial, counters, blog, CTA | Medium — playful, online-course feel |
| index-2 | Online Education | tutor hero with avatars, counters, categories, course, about, CTA, price, teachers, blog | Low — e-learning marketplace |
| index-3 | Classic LMS | search-form hero, about, categories, course, admission, teachers, testimonial, blog | Medium — search hero |
| index-4 | Elearning Education | tag hero, about, categories, course, education, FAQ, testimonial, blog | Low |
| index-5 | College Status | hero + contact cards, feature, categories, course, about, video, teachers, events, blog | Medium |
| **index-6** | **University Campus** | **full-bleed campus slider hero · about with outlined "1913 Establish" + outline text ticker · academic programs as 3 photo cards · research split (photo + stats + outline ticker) · "Explore the possibilities" big photo with overlapping white admissions form + outline "Apply for Admission" ticker · tuition & fees (dark + light cost panels) · campus triptych (photo / colour panel with link buttons / photo) · upcoming events (date blocks + photo) · teachers · blog · testimonial on photo · brand strip · CTA band with person cut-out · footer** | **Highest — institutional, photographic, editorial; has tuition, admissions, campus and dated-event patterns that map directly to Hangyul content** |
| **index-7** | **Academic Education** | top info bar · full-bleed slider hero · **4 colour category tiles straddling the hero edge** · about (two photos + video) · "Campus Academics Programs" ticker + **3 colour program columns** · "Apply Now" ticker + **numbered 01/02/03 steps with hover image** · **outline counters** · campus triptych · tuition · **scholarship** (huge type over photo + outline word) · blog · events (cards) · teachers · testimonial · CTA · footer | High — complements index-6 with steps, category tiles, counters, scholarship |
| index-8 | Online Courses | top bar, hero with image, categories, about, counters, course, career, teachers, testimonial, blog, instagram, brand | Medium |
| index-9 | Kids Education | slider, FAQ, choose, teachers, testimonial, blog (Sansita Swashed, playful) | Low |
| index-10 | Preschool Program | hero, about, categories, course, class, teachers, events, testimonial, blog, contact, counters | Low |

**Chosen base: index-6 "University Campus", completed with index-7's category tiles, numbered apply steps, outline counters and scholarship block.** Rationale in REPORT §41.1.

## 3. Component inventory

Reuse method: **DIRECT** (markup + CSS used as is, content swapped) · **PORT_TO_REACT** (markup reproduced as a React component with the template's own CSS, jQuery behaviour reimplemented) · **ADAPT** (template CSS/structure kept, content model or layout changed for Hangyul's data) · **DO_NOT_USE**.

### 3.1 Global

| Template page / file | Visual pattern | Potential Hangyul use | Reuse |
|---|---|---|---|
| index-6 `h6_header-area` (`_header.scss`) | Transparent header over the hero, white menu with dropdown chevrons, solid red "Apply Now ↗" button; becomes white + sticky on scroll (`header-sticky`) | Marketing header (logo, Universities / How it works / Services / Guides / Partners, language, Sign in, primary CTA) | PORT_TO_REACT (sticky via IntersectionObserver; dropdown keyboard-operable) |
| index-7 `h7_header-top` | Thin red info bar with phone / email / address + social | — (no phone line; would add noise) | DO_NOT_USE |
| `_sidebar.scss` side-info offcanvas + MeanMenu | Slide-in mobile menu with logo, menu, contact | Mobile navigation drawer | PORT_TO_REACT (MeanMenu replaced by a React offcanvas with focus trap) |
| index-6 `h6_footer-area` | Dark footer: logo + text + socials, 3 link columns, newsletter with consent checkbox, copyright bar | Marketing footer (product, students, partners, company, legal, photo credits; language) | ADAPT (newsletter removed — no mailing list exists) |
| `_breadcrumb.scss` `breadcrumb-area` | Photo page-title band with breadcrumb | Inner page header (Universities, How it works, Services, Guides, Trust, Legal) | ADAPT (Hangyul photography + tangerine sun device) |
| `_button.scss` `theme-btn`, `theme-btn-7`, `-yellow`, `theme-btn-medium` | Square-cornered solid buttons with arrow icon, hover darken | All marketing buttons | DIRECT (colour → tangerine) |
| `_section.scss` `section-area-6` subtitle / title / text | Small coloured subtitle, 46 px bold title, 16 px text | Every section heading | DIRECT |
| `program-text-ticker`, `apply-text-ticker`, h6 outline words ("Unforgettable memories", "research", "Apply for Admission") | Huge outlined (stroke-only) words scrolling across the section | Section decoration ("Study in Korea", "Admission", "Life in Korea") | PORT_TO_REACT (CSS animation; paused under `prefers-reduced-motion`; `aria-hidden`) |
| WOW/animate.css `wow fadeInUp` | Scroll reveal | Section reveals | PORT_TO_REACT (`Reveal` with IntersectionObserver; no motion when reduced) |
| Odometer counters | Count-up numbers | Only for real, sourced numbers | ADAPT (CSS-only, no plugin) |
| Swiper sliders (hero, teachers, testimonials, events) | Autoplay carousels | Hero (single slide), horizontal card rows on phones | ADAPT (no autoplay carousel; CSS scroll-snap rows with buttons) |
| Magnific Popup video | Play-button video lightbox | — (no Hangyul video) | DO_NOT_USE |
| Nice Select / select2 | Styled selects | Quick-check selects | ADAPT (native `<select>` styled like Nice Select — accessible, localisable) |
| Font Awesome Pro icons | `fa-light`/`fa-thin` icons | — | DO_NOT_USE (9.6 MB; Lucide already ships and matches the thin stroke); Eduan's **inline SVG icons** (program/campus/scholarship line icons) are DIRECT |
| Roboto / Sansita Swashed | Template fonts | — | DO_NOT_USE (Hangyul BI: Pretendard; Roboto metrics ≈ Pretendard Latin, so proportions hold) |

### 3.2 Homepage sections

| Template page / file | Visual pattern | Potential Hangyul use | Reuse |
|---|---|---|---|
| index-6 `h6_banner-area` (slider) | Full-bleed campus photo, dark gradient, subtitle with red rule, 70 px title with an italic emphasised word, arrows | **Hero**: Korea photograph, "Your next chapter is in *Korea*", one CTA, inline quick-check entry | PORT_TO_REACT (single slide, no autoplay; Hangyul licensed Korea photography) |
| index-7 `h7_category` tiles under hero | 4 colour tiles with line icons overlapping the hero's bottom edge | **Journey strip**: Find a university · Documents · Apply · Visa & arrival (anchors) | ADAPT |
| index-6 `h6_about-area` | Photo with outlined year numeral ("1913 Establish"), heading, two paragraphs, red button, outline ticker | **Why Hangyul** opener (outlined number = real catalogue count) | ADAPT |
| index-6 h6 admission ("Explore the possibilities") | Wide photo with a white form card overlapping the bottom edge + outline ticker | **Quick eligibility** — the sentence-form check as the white card; result replaces the form | ADAPT |
| index-6 `h6_program-area` | 3 photo cards with dark caption bar, title, "Read more ↗", line icon | **Study options** (Undergraduate · Korean language · Graduate) → filtered discovery | ADAPT |
| index-7 `h7_program-area` | 3 colour columns, list links with arrows | — (overlaps h6 program cards) | DO_NOT_USE (one program pattern is enough) |
| index-6 `h6_research-area` | Photo + frame, heading, outlined big number + icon facts, outline word | **How Hangyul works** (matching → documents → writing review), facts with icons | ADAPT |
| index-7 `h7_apply-area` | "Apply Now" ticker, numbered rows 01/02/03 (number · title · text), image revealed on hover | **Admission success** steps 01–06 (realistic shortlist, strategy, documents, personal statement review, counselor review, deadline protection) | PORT_TO_REACT |
| index-7 `h7_counter-area` | 4 huge outlined numbers + caption | **Trust facts** — only sourced/live numbers (international students in Korea with source, programs in the catalogue, languages, visa routes) | ADAPT |
| index-6/7 `h6_tuition-area` | Icon + "Tuition & Fees" + text + link; dark panel and light panel of line items with totals | **What it costs** — first-year estimate for a real catalogue program (tuition, living, insurance, visa, total) in KRW + local currency; second panel for another city | ADAPT (numbers from the catalogue API, with source and verified date) |
| index-6/7 `h6_campus-area` | Triptych: photo · colour panel with photo + heading + outline buttons · photo | **Life in Korea** — housing, airport pickup, SIM, bank, residence card, orientation as the panel's buttons | ADAPT |
| index-7 `h7_scholarship-area` | Huge "Scholarship" over a photo, outline "Programs", text + button on colour band | Scholarships teaser | ADAPT (merged into discovery when space is tight) |
| index-6 `h5_event-area` (h6 variant) | Stacked date blocks (big day + month) beside titles, photo right | **Application → visa → arrival timeline** (stage blocks with typical month) and **upcoming deadlines** (real intake deadlines from the API) | ADAPT |
| index-7 `event-area` cards | Image cards with meta and "Get ticket" | — | DO_NOT_USE |
| index-6 `h3_teacher-area` | Portrait cards with name/role + share | — (no real counselors to show publicly) | DO_NOT_USE |
| index-6 `h6_testimonial-area` | Quote card over a large photo | — (no real testimonials; V6 honesty rule) | DO_NOT_USE |
| `brand-area` | Partner logo strip | — (no verified public partners) | DO_NOT_USE |
| index-6 `h5_blog-area` | Feature card (photo background) + 2 white cards, red tag, date, arrow | **Guides** (real guide articles from the content API) | DIRECT |
| index-6 `h6_cta-area` | Dark band with campus photo, person cut-out, heading, white button | **Final CTA** — person replaced by the Hangyul tangerine sun | ADAPT |

### 3.3 Inner pages

| Template page / file | Visual pattern | Potential Hangyul use | Reuse |
|---|---|---|---|
| course.html `innerPage_course-*`, `course-item` | Results count + category select + search; 4-col cards: image, university mark + name, title, meta icons, price; hover panel with description, check list, Add to cart + heart | **University / program discovery cards** (campus image or university colour, university, program, city, degree, first-year cost, language, deadline; hover: why it fits + Save + View) | PORT_TO_REACT |
| course-2.html | Same card in list/grid variant with sidebar filters | Discovery filters sidebar (desktop) / drawer (phone) | ADAPT |
| course-details.html | Hero image, title, meta row, pill tabs (Overview / Curriculum / Instructor / Reviews), accordion, sticky sidebar price box + includes list + button | **Program detail**: hero, decision box (match, cost, deadline, language, scholarship, CTA), tabs → section anchors (Why it fits · Admissions · Documents · Cost · Scholarships · Housing · Campus · Sources) | ADAPT |
| event.html / event-details.html | Event cards; detail with info sidebar (date, time, venue, map) | Deadline detail sidebar pattern | ADAPT (detail sidebar only) |
| blog.html / blog-details.html | Blog grid + sidebar (search, categories, recent posts, tags); article with share, author, comments | **Guides list + guide article** | ADAPT (no comments) |
| about.html | Breadcrumb + about + team + blog | Trust page structure | ADAPT |
| team.html / team-details.html | Staff portraits / profile | — | DO_NOT_USE |
| gallery.html | Masonry photo grid with lightbox | Photo credits page (thumbnails + licence) | ADAPT |
| price.html | 3 pricing cards with feature lists | **Service plans** (Basic · All-in-One · Premium — V15; prices from `packages/types/src/plans.ts`) | ADAPT |
| contact.html | Contact info cards + form + map | Support contact | ADAPT (no map) |
| sign-in.html / sign-up.html `account-area` | Centered card form with social buttons | Student sign-in / register look on marketing | ADAPT (no social login exists) |
| 404.html | Big illustration + message + button | Marketing 404 | ADAPT |

## 4. What the port changes on purpose

| Area | Change | Why |
|---|---|---|
| Colour | `--clr-theme-primary-6` #B1040E → Hangyul action tangerine #CC4E00 (4.6:1 with white); campus/scholarship purple → Hangyul charcoal-green field; logo stays #FF6700 | Hangyul BI; AA contrast |
| Type | Roboto → Pretendard Variable (same proportions); italic emphasis word → Pretendard italic synthesis replaced by a tangerine accent | BI; Korean glyphs; 56 locale bundles (33 markets) |
| Focus | Restored visible focus ring everywhere (template removes outlines) | WCAG 2.4.7 |
| Motion | WOW reveals, tickers, hover zooms respect `prefers-reduced-motion`; no autoplay carousels | WCAG 2.2.2 |
| RTL | Physical properties mirrored by `postcss-rtlcss` | Arabic / Persian / Urdu |
| Text | Every string from i18n (`marketing` namespace) | 56 locale bundles (33 markets) |
| JS | jQuery, Swiper, WOW, MeanMenu, Nice Select, Magnific, Odometer → none (React + CSS) | DOM ownership, bundle size |
| CSS | Only the partials Hangyul renders; unused selectors purged at build | Performance |
| Images | Korea-specific sections use Hangyul's licensed Korea photography (CC0/CC BY, `/credits`); Eduan photos only for generic study moments (people studying, documents, laptops) and never captioned as Hangyul students, staff or partner campuses | Honesty: a Western brick campus must not stand for Korea; no implied testimonials |
