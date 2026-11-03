# V22 University Discovery — enrichment notes

Date: 2026-10-23. Scope: all 425 institutions in `server/app/data/korean_institutions.json`.
Result table: `docs/qa/v22/UNIVERSITY_CONTENT_COVERAGE.csv` (one row per institution, 425 rows).
Content record written: `server/app/data/university_content.json` (`records`, per slug).

## 1. What was run, in order

| step | script | reads | writes |
|---|---|---|---|
| A(c)/E | `scripts/universities/v22-wikidata.mjs` | Wikidata (`wbsearchentities` + SPARQL) | `server/app/data/raw/v22_wikidata.json` |
| A/B | `scripts/universities/v22-harvest-commons.mjs` | Commons API, ko/en Wikipedia API | `server/app/data/raw/v22_commons_candidates.json` |
| A/B | `scripts/universities/v22-fetch-media.mjs` | Commons (standard-width renditions) | `apps/{marketing-web,student-web}/public/media[/unilogo]`, `apps/marketing-web/src/media/credits.json`, `scripts/universities/curated/v22-media-picked.json` |
| C/D/E | `scripts/universities/v22-research-official.mjs` | each institution's own website (robots.txt honoured) | `server/app/data/raw/v22_official.json` |
| C | `scripts/universities/v22-verify-youtube.mjs` | YouTube channel pages, RSS feeds, oEmbed | `server/app/data/raw/v22_youtube.json` |
| A–E | `scripts/universities/v22-apply.mjs` | the four raw files + the media pick | `server/app/data/university_content.json` |
| F/G | `scripts/universities/v22-coverage.mjs` | registry + content + credits | `docs/qa/v22/UNIVERSITY_CONTENT_COVERAGE.csv` |

Shared rule modules: `v22-licences.mjs` (servable licence classes), `v22-subject.mjs` (what is and is not a
campus photograph; overseas/disambiguated categories), `v22-statements.mjs` (statement and destination-link
sanity). Every step is deterministic and re-runnable; nothing was hand-edited in the content JSON.

Backups of the files rewritten: `/tmp/claude-0/-root-hangyul-univ/5641a8a5-1041-42db-8879-23a3f0fb4f56/scratchpad/uni-backup/`
(V21 `university_content.json`, `credits.json`, `curated/`, V21 coverage CSV).

## 2. Sources and rights, as applied

* **Wikidata** — 100 institutions had no item in V21. Resolved by *exact* Korean label/alias match confirmed by
  the item's own claims (`P17` South Korea and a `P31` class under educational institution): 58 resolved,
  42 left `UNRESOLVED` (31 of them 한국폴리텍 campuses with no item of their own; the rest no exact label).
  Refreshed for all 383 items: P18 image, P154 logo, P94 arms, P373 Commons category, P856 website,
  P2397 YouTube, P1451 motto, P571 inception, P112 founder, ko/en sitelinks.
* **Wikimedia Commons** — five routes per institution: (1) the institution's own categories (P373,
  `Category:<English name>`, `Category:<Korean name>`, and category-search hits whose title names the
  institution) with two levels of subcategory, never descending into people/alumni/hospital/station/sports/
  affiliated-school subcategories, and never into a disambiguated or overseas one ("Calvin University
  (Michigan)", "Inha University in Tashkent"); (2) the ko/en Wikipedia infobox `그림/image` and `로고/logo`
  fields, resolved to files that exist **on Commons** (local fair-use uploads refused); (3) other files used
  in the article; (4) Commons full-text search for the Korean and English names; (5) P18/P154/P94. Files from
  routes 3–4 are accepted only when Commons categorises them under the institution **or** the title names the
  institution in full; a name match is awarded to the **longest** registry name it matches, so "Korea
  University" cannot claim a file about "Korea University of Technology and Education"; a city or province
  name alone is never a match. Licence is read from the Commons API per file (`LicenseShortName`):
  CC0/public domain (incl. PD-textlogo/PD-shape/PD-ineligible) → `CC0_PUBLIC_DOMAIN`; CC BY / CC BY-SA with
  a named author → `ATTRIBUTION_SUPPORTED` (credit rendered: author, licence, licence URL, source URL);
  NC, ND, GFDL-only, FAL, KOGL type 0/2+, and credited licences with no author → recorded as blocked with
  the licence. Logos are servable only in the no-credit class because the logo slot renders no credit.
* **Subject rules** (`v22-subject.mjs`) refuse, by name/description: maps, logos (in the photo slot),
  hospitals/medical centres, stations, affiliated schools, ceremonies, portraits, group photographs,
  military/outreach events, interviews, equipment, signboards, interiors, animals; a title-only tie must also
  carry campus vocabulary; a title made of a place name without campus vocabulary ("PanoDaejeon.jpg" in
  Category:KAIST) is refused; a file Commons categorises under a named overseas place is refused.
* **Official sites** — websites from the registry (281) then Wikidata P856 (+67). At most six pages per
  institution, all on its own origin, after `robots.txt`: homepage → sitemap → 대학소개 → 교육이념 page →
  international office page → English landing page. A site that refuses the identified bot UA with 403/406 is
  retried once with a browser UA (recorded `ua_fallback`); a site whose TLS chain Node cannot verify is
  re-read through curl without chain verification (recorded `tls_fallback`). `location.href`/meta-refresh
  landing pages are followed (≤2 hops).
* **YouTube** — a channel is considered only when the institution's own site links to it (`own-site`, the
  page recorded as `source_url`) or its Wikidata item carries P2397. It is stored only when the resolved
  channel's own title names the institution (full name, stem, first distinctive English word + "univ",
  or the English initials as a whole word: UNIST, DGIST) **and** is not a sub-unit (입학처, 방송국, 도서관,
  "Global"/international office, a department, a student body). The introduction film is searched inside
  that channel only — featured trailer → RSS feed (`feeds/videos.xml?channel_id=`) → /videos tab →
  in-channel search — and accepted when the title matches the introduction vocabulary (대학/공식 홍보영상,
  소개영상, 캠퍼스 투어, brand film, promotional video …), matches none of the avoid-list (lectures,
  ceremonies, ambassadors, one department's promo, a library re-opening, admission testimonials, contest
  entries, dormitory/government promos, another university's name …) and oEmbed names this channel as the
  uploader. Titles are NFC-normalised first — YouTube returns some Korean titles decomposed (NFD), which
  no NFC regex can match; V21's `verify-youtube.mjs` has the same latent defect.
* **Philosophy** — verbatim statements under fenced headings (건학이념 / 교육이념 / 교육목표 / 교육목적 /
  비전 / 미션 / 교훈 / 인재상 / 핵심가치) on the located page, cut at a sentence end, ≤400 chars, refused
  when they read as a menu, chrome, a profile or a caption. Stored in `philosophy_candidate` at
  `SOURCED_UNREVIEWED`; the page renders only `HANGYUL_REVIEWED`. No prose was written by this pass.
* **Founding facts** — `founded_year` (P571, where the record had none) and `founding_body` (P112 label)
  as structured fields with `source: wikidata:…`; never as prose.

## 3. Counts — V21 → V22 (all 425 institutions)

"Before" is the V21 content record measured with the same `v22-coverage.mjs` (snapshot in the backup dir).

| measure | V21 | V22 |
|---|--:|--:|
| Wikidata item | 325 | **383** |
| logo (no-credit licence, servable) | 29 | **63** |
| hero photograph (rights-verified, local file) | 44 | **151** |
| gallery > 0 (hero never in gallery; ≤4 per institution) | 1 | **104** |
| two or more photographs | 1 | 97 |
| media rights verified (hero or gallery) | 44 | **161** |
| official site readable (OK) | 203 | **265** |
| international office page | 60 | **105** |
| admissions page | 96 | **188** |
| dormitory page | 64 | **112** |
| education philosophy — Hangyul-reviewed (unchanged, untouched) | 13 | 13 |
| education philosophy — sourced, unreviewed (`philosophy_candidate`) | 4 | **51** |
| academic identity (motto / sourced vision·mission·인재상 / founding body) | 4 | 37 |
| official YouTube channel (verified) | 84 | **138** |
| introduction film (verified channel, title-matched, uploader-confirmed) | 81 | **128** |
| founded year (registry + P571) | 290 | 335 |
| founding body (P112) | 0 | 17 |

Status (coverage script's definition): OFFICIAL_DATA_LIMITED 326 → **234**, TEXT_COMPLETE_MEDIA_LIMITED 93 → **179**,
RIGHTS_BLOCKED 3 → 2, FULLY_ENRICHED 6 → **10**.

Per-step yields: Wikidata resolve 58 new items / 42 unresolved; Commons sweep 172 institutions with ≥1 own
category, 166 with ≥1 servable photograph (1,760 files), 63 with a servable logo, 2,373 files refused
(rights/quality/subject, each with its reason); media fetch 425 files downloaded + 106 reused, 0 failed,
1 pruned; official sites 263 OK / 48 unreachable / 35 robots-disallowed / 77 no website, 141 YouTube links,
61 statement pages; YouTube 54 new channels (51 own-site, 3 Wikidata), 47 new films (15 trailer, 8 RSS,
3 videos-tab, 21 in-channel search), 10 channel-only, 9 refused on name, 2 unresolved.

Heroes V21 chose and a person reviewed are kept (36 of 43). Six were replaced because the wide sweep
surfaced a better-subject file or the V21 file now fails the subject rule: 한국해양대 (training ship →
campus), 충북대 (hospital → 정문), 대전보건대 (02 → 01 main building), 강원대 (**a 국립강릉원주대학교 file**,
another institution → 강원대 도계캠퍼스), 조선대 (post office → 108 stair), 가톨릭대 (서울성모병원 → medical
college). 공주대 lost its V21 hero (file no longer on Commons; the only replacements were US Army outreach
photographs, refused).

## 4. Blocking reasons (coverage CSV, `blocking_reason`, counts over 425)

| reason | n |
|---|--:|
| no logo under a no-credit licence | 339 |
| no photograph of this institution under a licence Hangyul may serve | 227 |
| international office: site not readable | 160 |
| no international office link found (site readable) | 160 |
| no philosophy page found on the official site | 122 |
| no YouTube link on the pages read | 119 |
| philosophy page located, no extractable statement (image/JS content) | 79 |
| official site: no website known (registry or Wikidata) | 77 |
| no channel evidence (no website) | 77 |
| philosophy statement sourced, awaiting Hangyul review | 51 |
| official site unreachable (DNS dead / TLS / 5xx) | 48 |
| no channel evidence (site unreachable) | 45 |
| no Wikidata item / Commons category — nothing to search | 42 |
| official site robots-disallowed | 35 |
| no channel evidence (site robots-disallowed) | 35 |
| logo found but attribution-bearing licence (logo slot renders no credit) | 23 |
| channel linked from own site but its title does not name the institution | 11 |
| verified channel has no introduction film by title | 10 |
| photograph found on Commons but rights-blocked (NC/ND/no author) | 5 |

## 5. Invariants and gate

`node scripts/qa/v21-gate.mjs --static`: **45 passed, 0 failed** before and after. `v22-coverage.mjs`
invariants OK: no hero in its own gallery, no asset served under two institutions, no CITY/REGION kind on an
institution, every served asset servable per `credits.json` and present on disk in both apps, every credited
asset carries author + licence + licence URL + source URL, every channel has a verification route, no video
without a channel, no logo in a credit-bearing class.

## 6. What could not be verified (UNVERIFIED — not guessed)

* 42 institutions have no Wikidata item (31 한국폴리텍 campuses; 원광보건대 has an item that is not typed
  as an educational institution; the rest no exact label): no Commons, no P856 website for them.
* 77 institutions have no website in the registry or on Wikidata; 48 sites are unreachable (dead DNS such
  as `web.kit.ac.kr`, TLS failures curl also refuses, 5xx); 35 forbid robots. Nothing was read from them.
* 11 channels linked from an institution's own site were **not** stored because the channel title does not
  name the institution (꽃대TV, 웨신대, 서울문예대, 해날, TU head office, Woosong "Global", 신라대 입학처,
  전주비전대 linked from 예원예대, …). They may well be official; nothing here proves it.
* 51 philosophy candidates are verbatim and unreviewed; one known-imperfect capture class remains possible
  (a heading followed by a figure caption list). The 13 reviewed entries were not touched.
* Hero/gallery *subject* is enforced by Commons categorisation, infobox fields and name/vocabulary rules,
  not by a person looking at 450 images. Four random heroes were eyeballed (campus buildings). A contact
  sheet review is still the right next step; `curated/commons-selected.json` is where a `null` or an
  explicit title goes.
* Photographs come from Commons only. No university press kit publishes reusable-rights media that this pass
  could verify, so route (1) of the allowed-source order yielded nothing.
* 23 logos exist on Commons only under CC BY/BY-SA and are recorded as blocked; 339 institutions have no
  no-credit mark at all.

## 7. Files changed by this pass

* `server/app/data/university_content.json` (425 records; 100 created)
* `apps/marketing-web/src/media/credits.json` (75 → 465 entries, +390; the 13 V21 `ATTRIBUTION_REQUIRED` entries untouched)
* `apps/marketing-web/public/media/*--*-{640,1200,2400}.jpg`, `apps/student-web/public/media/…` (425 new photographs × 3 sizes × 2 apps; 331 MB / 317 MB per app now), `apps/*/public/media/unilogo/` (+34 marks)
* `scripts/universities/curated/v22-media-picked.json` (new)
* `server/app/data/raw/v22_{wikidata,commons_candidates,official,youtube}.json` (new caches)
* `scripts/universities/v22-{wikidata,harvest-commons,fetch-media,research-official,verify-youtube,apply,coverage,licences,subject,statements}.mjs` (new)
* `docs/qa/v22/UNIVERSITY_CONTENT_COVERAGE.csv`, this file

Not touched: React pages, server Python, i18n, `docs/REPORT.md`, `docs/qa/v21/*`, the V21 scripts.
Six V21 photographs replaced as heroes stay on disk and in `credits.json` (unreferenced); nothing renders them.
