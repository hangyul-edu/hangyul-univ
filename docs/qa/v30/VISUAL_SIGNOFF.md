# V30 visual sign-off

Every row below was **opened and looked at** by the reviewer (the screenshot itself, not a gate's PASS line).
"Gate" columns are supporting evidence only. Paths are relative to the repo root. Contact sheets used for review:
`docs/qa/v30/compare/contact-*.png`; before/after sheets: `docs/qa/v30/compare/*-ko-*.png`.

Verdicts: **OK** = no locally solvable visual/interaction defect seen at this viewport; **FIXED** = defect seen and fixed,
after-shot re-opened; **OPEN** = defect seen, not fixed in V30 (reason given).

## Marketing

| Route | Screenshot (after) | Viewport · locale | Primary action | Issues found | Fix | Verdict |
|---|---|---|---|---|---|---|
| `/` hero | `docs/qa/v30/visual/after/shots/marketing-root-ko-1280.png` | 1280 · ko | 내 유학 준비 | none — one tangerine primary, quiet on-photo secondary | — | OK |
| `/` crest band | `docs/qa/v30/marquee/marquee-ko-1440-{0,25,50,75}.png` | 1440 · ko | any crest → its page | 5 of 6 crests dead (0/27 at 75 %) | §407 | FIXED (760/760 clicks) |
| `/` crest band RTL | `docs/qa/v30/marquee/marquee-ar-1440-75.png` | 1440 · ar | any crest | band empty at 75 % of the loop | RTL keyframes §407.3 | FIXED |
| `/` crest band, reduced motion | `docs/qa/v30/marquee/marquee-reduced-{ko,ar}-1440.png` | 1440 · ko/ar | any crest | — | — | OK (23/23) |
| `/universities` toolbar | `docs/qa/v30/compare/directory-toolbar-ko-1440.png`, `docs/qa/v30/directory/toolbar-{ko,en,vi,zh-Hans,ar}-1440.png` | 1440 · 5 locales | search / type / region | "전체" box, detached chevron, two border families, chips 46 vs controls 52 | §408 | FIXED |
| `/universities` phone | `docs/qa/v30/before/directory/dir-ko-390.png`, `docs/qa/v30/directory/sheet-390.png` | 390 · ko | 필터 → sheet | sheet led with 17 provinces, type last; faint chip edges | type first, 3:1 chips | FIXED |
| `/universities/yonsei-university` | contact-marketing (1280 + 390) | 1280/390 · ko | 이 대학 유학 준비하기 | none | — | OK |
| `/start` | contact-marketing | 1280/390 · ko | (form) | none (form fields full-width by design) | — | OK |
| `/privacy`, `/terms` | contact-marketing | 1280 · ko | — | none | — | OK |
| 404 | contact-marketing (before fix) | 1280/390 · ko | 홈으로 가기 | two dark bands, four CTAs; buttons dropped the locale | `useNoClosingCta`, `LocaleLink` (§413) | FIXED — after-shot re-opened below |
| 404 (after) | `docs/qa/v30/visual/final-probe/shots/marketing-__v30-not-a-page-vi-1280.png` | 1280 · vi | Về trang chủ | — | — | OK (one band; buttons keep `?lang=vi`) |

## Student (`docs/qa/v30/compare/contact-student-1280.png`, before/after sheets)

| Route | Screenshot (after) | Viewport · locale | Primary action | Issues found | Fix | Verdict |
|---|---|---|---|---|---|---|
| Home | `docs/qa/v30/compare/student-home-ko-1280.png`, `-390.png` | 1280/390 · ko | 고치는 방법 보기 | raw "Request timed out after 20s" on the error state; task title carries the English university name | `ErrorState` (§409); task title = server-stored text | FIXED / **OPEN** (stored task titles, V28 "50 server sites") |
| Explore | contact-student-1280 | 1280 · ko | programme row | English university names on a Korean screen | `localName()` (§410.2 #16) | FIXED |
| Applications / detail | contact-student-1280 | 1280 · ko | 고치는 방법 보기 | 부산대학교 vs "Pusan National University" in adjacent lists | `localName()` | FIXED (lists from components); stored titles OPEN |
| Documents | `docs/qa/v30/compare/student-documents-ko-1280.png` | 1280 · ko | 올리기 / 고치기 | row actions read as labels, `→` promised navigation, 28 px dead tail | secondary button, grid fix | FIXED |
| Essays, Visa, Housing, Arrival, Messages, Profile, Services | contact-student-1280 | 1280 · ko | per page | none locally solvable (empty states are calm, one action) | — | OK |
| Scholarships | crawl `after` 390 | 390 · ko | — | page 425 px wide | `.ssc-meta` wrap | FIXED (390 px) |
| University detail | crawl | 1280 · ko | 지원 시작하기 | 56-px primary beside 32-px "비교" | same height | FIXED |
| Locales en/vi/zh-Hans/ar | `docs/qa/v30/visual/after-locales-student/shots/` | 390/1280 | — | "11 other tasks →" 21-px target beside another | `.hg-link-arrow` 24 px | FIXED |

## Agency (`docs/qa/v30/compare/contact-agency-1280.png`)

| Route | Screenshot (after) | Viewport · locale | Primary action | Issues found | Fix | Verdict |
|---|---|---|---|---|---|---|
| Today | `docs/qa/v30/compare/agency-today-ko-1280.png`, `-390.png` | 1280/390 · ko | row → workspace | 4 wide unlabeled selects wrapping to 2 rows; band wrapped into 3 ragged rows; phone 필터 slab above search; (after-shot) 80-px gap | FilterSelect, band grid, `searchAside`, row width | FIXED |
| Tasks | `docs/qa/v30/compare/contact-tasks.png` | 1280/1728/390 · ko | 완료 / row | student names cut to 5 chars; titles to 8; "바로 가 / 능" | name floor + container query | FIXED |
| Catalogue | `docs/qa/v30/compare/agency-catalog-ko-1280.png` | 1280 · ko | — | **HTTP 500 on any `?lang=`**; 5 oversized filters | `teach` key + 422; FilterSelect | FIXED |
| Applications + drawer | gate shots | 1280 · ko | 상태 변경 | drawer close button under the top bar | z-index tokens (§414) | FIXED |
| Students, workspace, documents, essays, messages, services, team, settings, performance | contact-agency-1280 | 1280 · ko | per page | English definitions on ops/services/performance | translated definitions | FIXED; rest OK |
| Task titles in seed data | — | — | — | English task titles ("Send the study plan feedback summary") | stored content | **OPEN** |

## University (`docs/qa/v30/compare/contact-university-1280.png`)

| Route | Screenshot (after) | Viewport · locale | Primary action | Issues found | Fix | Verdict |
|---|---|---|---|---|---|---|
| Applicants (home) | `docs/qa/v30/compare/university-home-ko-1280.png` | 1280 · ko | row → review | inline label + oversized selects; sort select clipped its own value | FilterSelect | FIXED |
| Application review | `docs/qa/v30/visual/final-probe/shots/university-applications_id-ko-1280.png` | 1280 · ko | 서류 요청 | disabled pager showed a pointer cursor | `cursor: default` | FIXED |
| Analytics | final-probe | 1280 · ko | — | 5 wide selects, labels clip-hidden | FilterPick | FIXED |
| Documents, programmes, partnership | contact-university-1280 | 1280 · ko | — | hidden-label filters; English definition | FilterSelect, translated definition | FIXED |
| Cohorts, exports, messages, settings, manage | contact-university-1280 | 1280 · ko | per page | none locally solvable | — | OK |

## Not inspected on a device

Native apps: static code audit only in V30 (no emulator run — see REPORT §415).
