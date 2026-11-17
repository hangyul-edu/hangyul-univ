# Hangyul Univ brand assets

The owner-supplied final logo set (2026-11-17). One source, one definition, generated derivatives.

## Where things live

| What | Path |
| --- | --- |
| **Masters** (owner originals, never edited) | `packages/icons/assets/brand/hangyul-univ/master/` |
| **Runtime derivatives** (generated) | `packages/icons/assets/brand/hangyul-univ/` |
| **Brand definition** | `HANGYUL_UNIV_BRAND` in `packages/icons/src/index.ts` |
| **Components** | `Logo`, `LogoVertical` in `packages/ui/src/brand.tsx` |
| Generator | `npm run brand:build` (`scripts/brand/build-brand-assets.py`) |
| Regression gate | `npm run qa:brand` (add `BASE=https://univ.talkhangyul.com` to check the live site) |

`brand:build` trims the masters' transparent padding, resizes (premultiplied-alpha Lanczos) and publishes copies to
`apps/*-web/public` (favicons, manifest), `apps/marketing-web/public/og`, `apps/*-mobile/assets` and
`packages/mobile-ui/assets/brand`. Never hand-edit a derivative: change the master, re-run the generator.

## Which logo

| Surface | Variant |
| --- | --- |
| **Marketing site** header, menu and footer (white / light) | **horizontal orange** — `<Logo color="orange" />` (owner decision 2026-11-17: ties the brand to the orange primary action) |
| Product shells and auth pages on light (student app, admin, university console) | **horizontal black** — `<Logo />` |
| Dark (navy sidebar, dark footer/CTA, over a photograph) | **horizontal ivory** — `<Logo tone="light" />` |
| Orange / tangerine | **ivory**. Never the orange logo on orange. |
| White / ivory identity moment (native splash, native sign-in, app icon, favicon) | **orange** |

- **Horizontal** for anything bar-shaped: headers, navigation, footers, auth headers, e-mail bars.
- **Vertical** only for a centred identity moment: native splash, native sign-in, an empty/centred brand area
  (`<LogoVertical />`). Never in a header.
- **Symbol** (cap + leaf, cropped from the horizontal lockup): collapsed console rail, team avatar, favicon, app icon.
- Size with `--hg-logo-h` (default 26 px; marketing phones 24 px, ≤ 359 px 22 px). Height only — width follows.
- The link carries the accessible name ("Hangyul Univ"), so the image inside it is `alt=""`. A logo that stands
  alone and is not a link gets `alt="Hangyul Univ"`.
- Product vs tenant: the shell lockup is always Hangyul Univ; a university's own crest appears only where the UI
  represents that institution (console org label, university pages).

## Social sharing

- **OG / X card:** `https://univ.talkhangyul.com/og/hangyul-univ-og-v1.jpg` — 1200×630, resized from the 3600×1890 master.
- Tags are in the **static HTML** (crawlers do not run the app): `apps/marketing-web/index.html` for the homepage,
  and `scripts/seo/prerender-meta.mjs` writes `/universities`, `/universities/<slug>`, `/privacy`, `/terms` at build
  time with their own title, description and canonical. `useSeo` keeps the same tags current client-side.
- University pages share as `<University> | Hangyul Univ` with the Hangyul Univ card; no university has an
  approved share image, so none is used.
- The signed-in apps (`app.`, `admin.`, `partner.`) carry only the generic product card — never page or person data.
- **Replacing the card:** bump the filename (`-v2`) in the generator, `HANGYUL_UNIV_BRAND.social`, the four
  `index.html` files and `scripts/qa/brand.mjs`. Do not add a `?v=` query. KakaoTalk, Facebook, LinkedIn, Slack and
  others cache previews for hours to days; a correct tag does not mean an instantly refreshed preview
  (Kakao and Facebook have manual cache-reset tools).
- **Banner:** `hangyul-univ-banner-1024x500.jpg` (master 3072×1500) — store feature graphic / profile banner. Kept
  in the brand folder; not placed on any page and not bundled into any app.
- Stable public logo URL (structured data, e-mail, partners): `https://univ.talkhangyul.com/brand/hangyul-univ-logo-horizontal-black.png`.

## Favicon and app mark

Symbol only — the wordmark is never squeezed into an icon. `favicon.ico` (16/32/48), `favicon-32.png`,
`favicon-48.png` transparent; `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` and the native
`app-icon-1024.png` are the orange symbol on brand ivory `#F5F5E6`, inside the maskable safe zone. Android adaptive
foreground keeps the symbol inside the 66 % safe circle. Native splash: vertical orange logo on `#FFFDF8`.

### Android (all three Expo apps)

| Piece | File (in `apps/*-mobile/assets/`) | Notes |
| --- | --- | --- |
| Adaptive foreground | `adaptive-foreground-1024.png` | orange symbol + green leaf, 45 % of the canvas — inside the 66 dp safe circle on circle / squircle / rounded-square / Samsung masks |
| Adaptive background | `#F5F5E6` (app.json) | brand ivory; never black |
| Themed (Android 13+) | `adaptive-monochrome-1024.png` | single-colour silhouette from the black master |
| Legacy / iOS / store icon | `app-icon-1024.png` | orange symbol on ivory |
| Notification small icon | `notification-icon.png` (student) | white silhouette, tinted `#CC4E00` by the system; never the colour icon |
| Splash (student, Android 12+) | `splash-icon.png`, `imageWidth: 140` | vertical orange logo on a transparent square, sized to sit inside the system splash circle |

The launcher icon never carries the wordmark. After changing any of these, re-run `expo prebuild` and rebuild —
an installed app keeps its old icon until the new APK is installed (launchers also cache icons).

## Do not

Recolour, redraw, re-space, outline, shadow, add gradients, stretch, approximate in CSS/SVG/AI, crop into the artwork,
convert a logo to JPG, or place black on dark / ivory on white / orange on orange. Resize, trim transparent padding
and optimise only.
