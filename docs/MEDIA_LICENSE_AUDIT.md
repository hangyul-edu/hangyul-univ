# Media licence audit (current — V26)

Every photograph the product ships, classified, with the rule that lets it ship. First written for V14; the current
rules and coverage are at the top, the V14/V20 record is kept below as history. `docs/MARKETING_ASSETS.md` (V10) was
merged into the "Marketing photographs" section in V26.

Gates: `npm run qa:media` (`scripts/qa/v14-media-licence.mjs`) for the marketing slots, `npm run qa:v25` for university
photographs. Sourcing tools: `scripts/media/fetch_cc0.py` (marketing, CC0/PD only), `scripts/universities/v25-*.mjs` +
`v25-sheet.py` / `v25-import.py` (university photographs).

---

## The rule (two tiers — do not confuse them)

| Tier | What | Licences allowed | Credit |
|---|---|---|---|
| **General marketing photographs** — hero, service rows, bands, journey, page headers, city fallbacks | Imagery of Korea that stands for Hangyul's message | Hangyul-owned (`HANGYUL_OWNED`, `OWNER_AUTHORISED`) or CC0 / public domain only | **None visible, anywhere.** The `/credits` page was retired in V14 (it now redirects to `/`); the 13 CC BY photographs that needed credits were withdrawn rather than left uncredited |
| **A university's own photographs** — directory card, detail hero, gallery, student app | Pictures of that campus, shown only for that institution | CC0 / PD, and **CC BY / CC BY-SA / KOGL-1** | **Rendered on the picture** by `PhotoCredit` (author, licence name linked to the licence, link to the source) — always visible, attached to the image. Nothing attribution-bearing is ever shown without it |

Internal rights metadata (owner/source, licence, author, date acquired, asset path, permitted use) is recorded for every
asset in both tiers and enforced per class by the gates. Customers never see it for tier one; compliance depends on it.

**Coverage today:** **166 of 425** institutions have a real photograph of their own campus (462 university photographs
with full rights metadata); **259 do not** and fall back to a designed identity composition. The remaining route is
commissioned or university-supplied photography (`OWNER_AUTHORISED`) — see "University photographs" below and REPORT §0.6.

## University photographs (current — V25, REPORT §312, §320)

Two rules coexist and must not be confused:

- **General marketing photography** (hero, service rows, bands) stays attribution-free: Hangyul-owned or CC0 only, no credit
  anywhere. Unchanged.
- **A university's own photographs** (directory card, detail hero, gallery, student app) may be **CC BY / CC BY-SA / KOGL-1**
  *because* the credit the licence requires is rendered **on the picture itself** (`PhotoCredit`, since V21): author, licence
  name linked to the licence, link to the source. V25 restyled it as a quiet caption on a soft gradient; it is still always
  visible and attached to the image. Nothing attribution-bearing is ever shown without it.

Counted from `server/app/data/university_content.json` after V25: **462 university photographs** — 395 `ATTRIBUTION_SUPPORTED`
(credit rendered), 67 `CC0_PUBLIC_DOMAIN`. Every one carries licence, source URL, author (where credit is required), licence
URL, `verified_at`, renditions (640/1200/2400 JPEG + WebP) and focal point; `qa:v25` fails on any missing field, missing file
or an asset shared by two institutions.

What V25 did **not** do: rehost anything from an official university site (0 of 259 photo-less institutions publish an open
licence on their own pages — `server/app/data/raw/v25_official_rights.json`), fetch 공유마당 originals behind a robots.txt that
blocks automated agents (listed for a person in `docs/qa/v25/MANUAL_MEDIA_ACQUISITION.md`), or treat a YouTube poster as a
photograph. The launch dependency is unchanged: **commissioned or university-supplied photography (OWNER_AUTHORISED)** is the
only route to 425/425.

## Marketing photographs (current)

*Merged from `MARKETING_ASSETS.md` (V10) in V26; only what is still true is kept.*

### How the system works

| Piece | Where |
|---|---|
| Files | `apps/marketing-web/public/media/<slug>-<width>.<jpg\|webp>` (640 / 1200 / 2400; the hero adds 1600) |
| Metadata | `apps/marketing-web/src/media/credits.json` — subject, orientation, intrinsic size, focal point, people, licence, author, source; owner-supplied assets carry `"owner": true` |
| Slot map | `apps/marketing-web/src/media/slots.ts` — which slug fills which section; every slug there must be attribution-free or the gate fails |
| Component | `apps/marketing-web/src/components/Photo.tsx` — `<img>` with `srcset`, `sizes`, `objectPosition` from the focal point, optional portrait source below 700 px |
| Hero | `@hangyul/koreanasha-ui` `<Hero sources=…>` — a `<picture>` with **one hand-made crop per breakpoint** (`korea-campus-autumn` ≥ 1200 px, `-tablet` 576–1199 px, `-portrait` 3:4 bottom-anchored ≤ 575 px) and a WebP source per crop |

To replace any photograph with Hangyul's own, drop files with the same slug and widths into `public/media` and update
its row in `credits.json`. Nothing else changes.

### What the marketing site uses today, and under which licence

| Slot (`slots.ts` / home services) | Asset | Rights |
|---|---|---|
| Home hero (+ tablet and portrait crops) | `korea-campus-autumn` | `HANGYUL_OWNED` — owner-supplied (Koreanasha `s1_c`) |
| Home · service 1 (university & language-school recommendation) | `kyunghee-main-building` | CC0 |
| Home · service 2 (support until you are settled) | `korean-air-apron` | `HANGYUL_OWNED` — owner-supplied (`s2_c`) |
| Home · service 3 (student community) | `korea-palace-hanbok` | `HANGYUL_OWNED` — owner-supplied (`s3_c`) |
| Journey · discover; quick-check band | `snu-law-library` | CC0 |
| Journey · apply; university fallback for Seoul National University | `snu-main-gate` | CC0 1.0 |
| Journey · admission | `seoul-songpa-sunset` | CC0 |
| Journey · visa | `seoul-subway-line9-platform` | CC0 1.0 |
| Journey · arrive; life in Korea (band and inset) | `seoul-cheonggyecheon-walk` | CC0 |
| Life in Korea · closing image | `seoul-yeouido-river-dusk` | CC0 |
| Inner-page header | `seoul-namsan-tower` | CC0 |
| City fallback — Seoul (labelled as the city, never as a campus) | `seoul-han-river-golden-hour` | CC0 1.0 |
| Closing conversion band | `seoul-jamsil-lotte-tower-night` | CC0 1.0 |
| Region photography (V20): Busan, Jeonju, Gyeongju, Daejeon, Sokcho, Ulsan | `busan-gwangan-bridge-night`, `busan-gamcheon-village`, `jeonju-hanok-rooftops`, `gyeongju-bulguksa`, `daejeon-expo-bridge-night`, `sokcho-seoraksan-skyline`, `ulsan-bridge-harbour` | CC0 / public domain |

A campus photograph appears **only on that university's own page**, never as generic imagery — showing a named campus
next to Hangyul's brand would imply an affiliation that does not exist. No region borrows another's image: a region with
no licensed photograph falls through to the brand visual.

### Images deliberately not used

| Asset | Where from | Why not |
|---|---|---|
| `p1*`, `p2*`, `p3*`, `banner*.webp` | template-koreanasha | Captioned with, or shot around, named Koreanasha people (the founder and two consultants). Real staff of another company; not ours to show, and the brief forbids inventing replacements |
| `assets/img/logo/*`, `favicon.png`, `pre_img.png` | template-koreanasha | Another company's brand |
| Eduan template photographs | themeforest-eduan | No redistribution licence recorded in the package; none ships since V14 |
| The 13 CC BY photographs of V6–V10 | Wikimedia Commons | Attribution-required; retired in V14 (table below), files and provenance kept in `docs/media/retired-attribution-required/` |

No facial recognition was used; every association comes from repository metadata (filenames, captions, copy beside the image).

### Brand assets

Canonical source: `packages/icons/assets/brand/`, exported as `brandAssets` from `@hangyul/icons`. `logo-combined.png`
(+ `@2x`) is **the lockup** in every header and footer; `logo-combined-light.png` (+ `@2x`) is the derived light-ink variant
for dark surfaces (only the `#282828` wordmark ink repainted white; the tangerine symbol is byte-identical); `symbol.webp`
serves collapsed console rails; `favicon-32/64.png`, `apple-touch-icon.png`, `app-icon-1024.png`, `adaptive-foreground-1024.png`
and `splash.png` are the tab, home-screen and native icons; `hand-tangerine.webp` is the student login aside;
`wordmark-en.png` / `wordmark-ko.png` are available but not placed. No Koreanasha or Eduan logo ships in any app or bundle.

---

## History — V14 audit and V20 changes (dated record)

*What follows is the V14 pass (2026-10-18) and the V20 additions (2026-10-21) as written. Counts and slot names are of
that time; the current slot map is the table above.*

## The problem this audit exists to solve

The owner's requirement is **no customer-visible photo attribution**: no "사진: 한귤 사진 자료" under the hero,
no credit labels, no `/credits` page.

The product could not meet that requirement, because **13 of its 19 photographs were licensed CC BY** — a
licence whose single condition is that you credit the author. Deleting the captions would have left us using
thirteen photographs in breach of their licences, which the brief rules out in as many words: *"Do NOT simply
delete legally required attribution … Replace the asset instead."*

So the captions were not hidden. The thirteen photographs were taken out of the product.

## Classification

| Class | V14 | V20 | May ship? |
|---|--:|--:|---|
| `HANGYUL_OWNED` | 3 | 3 | yes |
| `CC0_PUBLIC_DOMAIN` | 10 | **17** | yes |
| `OWNER_AUTHORISED` | 0 | 0 photographs, **23 university crests** | yes |
| `COMMERCIAL_NO_ATTRIBUTION` | 0 | 0 | yes (none held) |
| `ATTRIBUTION_REQUIRED` | 13 | 13 | **no** |
| `UNKNOWN` | 0 | 0 | **no** |

## V20 — what changed (REPORT §213, §217.4, §221)

**Seven CC0/public-domain photographs added**, each reviewed by eye against the quality bar before
download: `busan-gwangan-bridge-night`, `busan-gamcheon-village`, `jeonju-hanok-rooftops`,
`gyeongju-bulguksa`, `daejeon-expo-bridge-night`, `sokcho-seoraksan-skyline`, `ulsan-bridge-harbour`.
Twelve further attribution-free candidates were **refused on quality** — a city bus, three city halls,
a hospital, a council office, a car park, two coast guard cutters, a lotus pond and a flat grey-sky
landmark. Region photography now covers 7 of Korea's 17 regions, up from 1 (Seoul).

**`kyunghee-main-building` is finally in use.** CC0, downloaded and encoded in V14, attached to no
institution until V20.

**A live breach was closed.** `UniversityStory.UniversityLogo` rendered `enrichment.logo.url` hot-linked
from `upload.wikimedia.org`, and five of the fourteen logos were CC BY-SA — attribution-required images
on a customer page with no attribution (Global Cyber, Kumoh, Sungkyul, UNIST, Hansung). The V14 gate
could not see them because it inspects `credits.json` and the `public/` directories, and these were
external URLs in a JSON blob on the institution row. Every logo is now licence-re-checked against the
Commons API, classified, and **hosted on Hangyul's own origin**; the five are gone and
`scripts/qa/v20-gate.mjs` fails on any rendered asset that is not attribution-free, locally hosted and
provenance-complete.

**University crests.** The 23 marks in `apps/marketing-web/public/media/universities` came from the
owner's own Koreanasha drop and are `OWNER_AUTHORISED`. They had only ever been drawn by the homepage
marquee; from V20 they are the primary logo source for the university pages in both the marketing site
and the student app.

**Still the launch dependency it was.** 2 of 425 institutions have an attribution-free photograph of
their own campus. Commissioned photography is the fix. *(V20 figure. After V25: 166 of 425 have a real campus
photograph under the two-tier rule above; 259 do not.)*

`attribution_required` is derived from the licence, not asserted by hand, and the gate fails if a class and
the flag disagree.

## Shippable — everything a customer can see

| Asset | Rights | Licence | Author (internal record) | Attribution required | Status |
|---|---|---|---|---|---|
| `seoul-cheonggyecheon-walk` | CC0_PUBLIC_DOMAIN | CC0 | lumoplank | no | in use |
| `seoul-han-river-golden-hour` | CC0_PUBLIC_DOMAIN | CC0 1.0 | SpaceshipMe | no | in use |
| `seoul-jamsil-lotte-tower-night` | CC0_PUBLIC_DOMAIN | CC0 1.0 | mauveine.kim | no | in use |
| `seoul-namsan-tower` | CC0_PUBLIC_DOMAIN | CC0 | lumoplank | no | in use |
| `seoul-songpa-sunset` | CC0_PUBLIC_DOMAIN | CC0 | cmmellow | no | in use |
| `seoul-subway-line9-platform` | CC0_PUBLIC_DOMAIN | CC0 1.0 | Udonhan1992 | no | in use |
| `seoul-yeouido-river-dusk` | CC0_PUBLIC_DOMAIN | CC0 | pixabay: @heecheol890102 | no | in use |
| `snu-law-library` | CC0_PUBLIC_DOMAIN | CC0 | EllalineSeoul | no | in use |
| `snu-main-gate` | CC0_PUBLIC_DOMAIN | CC0 1.0 | H. Y. Shin 000 | no | in use |
| `kyunghee-main-building` | CC0_PUBLIC_DOMAIN | CC0 | Kikolipu | no | in use |
| `korea-campus-autumn` | HANGYUL_OWNED | Owner-supplied | Hangyul | no | in use |
| `korea-palace-hanbok` | HANGYUL_OWNED | Owner-supplied | Hangyul | no | in use |
| `korean-air-apron` | HANGYUL_OWNED | Owner-supplied | Hangyul | no | in use |

Six of the nine CC0 assets were sourced in this pass through `scripts/media/fetch_cc0.py`, which refuses to
download anything whose licence **Wikimedia Commons' own API** does not report as CC0 or public domain — not
the page text, not a category, not the uploader's claim. Two candidates were downloaded, looked at and
**rejected on quality** rather than licence (a parked truck in the foreground of one; an amateur snapshot full
of banners and a bank sign in the other), because "legally clear" is not the same as "makes someone want to be
there".

## Retired — attribution-required, no longer served

| Asset | Rights | Licence | Author (internal record) | Attribution required | Status |
|---|---|---|---|---|---|
| `busan-gwangan-bridge-dusk` | ATTRIBUTION_REQUIRED | CC BY 4.0 | Busan Tourism Organization | yes | **retired** |
| `busan-gwangan-bridge-sunset` | ATTRIBUTION_REQUIRED | CC BY 4.0 | Horizonjumpers | yes | **retired** |
| `coex-starfield-library` | ATTRIBUTION_REQUIRED | CC BY 4.0 | Sean Young (@assanges) | yes | **retired** |
| `ewha-ecc-campus-valley` | ATTRIBUTION_REQUIRED | CC BY 2.0 | LWYang | yes | **retired** |
| `incheon-airport-t1-arrivals` | ATTRIBUTION_REQUIRED | CC BY 4.0 | ノボホショコロトソ | yes | **retired** |
| `incheon-airport-t2-hall` | ATTRIBUTION_REQUIRED | CC BY 4.0 | AirportTerminalGuy | yes | **retired** |
| `kaist-atrium-staircase` | ATTRIBUTION_REQUIRED | CC BY 4.0 | Ahmed | yes | **retired** |
| `kyunghee-central-library` | ATTRIBUTION_REQUIRED | CC BY 3.0 | Kys951 | yes | **retired** |
| `seoul-han-river-yeouido-night` | ATTRIBUTION_REQUIRED | CC BY 2.0 | Tony | yes | **retired** |
| `seoul-light-trails-dusk` | ATTRIBUTION_REQUIRED | CC BY 2.0 | Carmine.shot | yes | **retired** |
| `seoul-ramyeon-shop` | ATTRIBUTION_REQUIRED | CC BY 2.0 | lazy fri13th | yes | **retired** |
| `yonsei-underwood-hall` | ATTRIBUTION_REQUIRED | CC BY 4.0 | Kimhs5400 | yes | **retired** |
| `yonsei-yeonhui-hall-ivy` | ATTRIBUTION_REQUIRED | CC BY 3.0 | Fumihiko Ueno | yes | **retired** |

These are **not deleted**. The files and their full provenance are kept in
`docs/media/retired-attribution-required/` and their rows stay in `credits.json` with the licence, the author
and the source URL intact, so the record of what we once used and under what terms survives. What changed is
that they are not in any `public/` directory and no slot can reference them — the gate fails on either.

## Where each customer-facing slot now points

| Slot | Asset | Rights |
|---|---|---|
| Homepage hero (and its phone/tablet crops) | `korea-campus-autumn` | HANGYUL_OWNED |
| Service 1 — university & language-school recommendation | `kyunghee-main-building` | CC0 |
| Service 2 — support until you are settled | `korean-air-apron` | HANGYUL_OWNED |
| Service 3 — student community | `korea-palace-hanbok` | HANGYUL_OWNED |
| Inner-page header | `seoul-namsan-tower` | CC0 |
| Closing conversion band | `seoul-jamsil-lotte-tower-night` | CC0 |
| City fallback — Seoul | `seoul-han-river-golden-hour` | CC0 |
| University campus — Seoul National University | `snu-main-gate` | CC0 |

## What this cost, stated plainly

Two things got worse before they got better, and both are open:

**Yonsei and Kyung Hee lost their campus photographs.** Both were CC BY. Their university pages and student
cards now fall through to the region/brand visual. That is honest — we are not showing a Seoul photograph and
implying it is their campus (brief Part 36) — but it is less good than having the photograph, and it will stay
that way until a licensed campus photograph of each exists.

**There is no attribution-free Busan photograph.** The Busan entry in `cityFallback` was removed rather than
pointed at a Seoul image. A Busan university now shows the brand visual.

**The CC0 pool for Korean campus photography is thin.** Nine usable assets came out of a sweep of Wikimedia
Commons, and most of the genuinely aspirational Korean campus photography on Commons is CC BY. The durable fix
is not more sourcing: it is **commissioned or licensed stock photography**, which is the one category in the
brief's allowed list (`COMMERCIAL_NO_ATTRIBUTION`) that Hangyul holds none of. That is recorded as a launch
dependency, not as something this pass could invent its way around.

## What is no longer in the product

- the hero caption `사진: 한귤 사진 자료` and the `.kn-hero__credit` element — the rule is deleted, not hidden
- the `credit` prop on `Hero`
- the `/credits` route, its page component and its footer link (`/credits` now redirects to `/`)
- `v6.credits.*` and `v11.credits.*` — removed from all 55 locale bundles

The internal rights metadata is **unchanged and still required**: owner/source, licence, author, date acquired,
asset path and permitted usage for every asset, enforced per class by the gate. Customers do not see it;
compliance depends on it.
