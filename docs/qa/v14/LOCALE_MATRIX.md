# V14 Locale matrix — the 31 target markets

Generated from `apps/flags` (the owner's drop, and the source of truth for which markets exist),
`packages/i18n/src/markets.ts` (the country → locale mapping) and the locale bundles themselves. Regenerate the
coverage columns with `npm run i18n:check`; the visual pass that sits behind them is `node
scripts/qa/v14-locales.mjs`.

---

## The count: 31, not 32

The brief says there should be 32 target countries. **`apps/flags` contains 31 flag assets**, and the owner's
own `index.ts` wires 30 of them. Nothing in this pass invented a 32nd market to reach the number, because the
brief's own instruction is to build the plan from what is actually in the folder.

| | |
|---|---|
| `.svg` files in `apps/flags` | **31** |
| exported by `apps/flags/index.ts` | 30 |
| not exported | **1** — `RS.svg` (Serbia) |
| markets in `markets.ts` | **31** (all of them) |

`RS.svg` was in the folder and absent from the index, and no `sr` locale existed anywhere in the product. The
most likely reading is that whoever wrote `index.ts` dropped Serbia because there was no Serbian locale to
point it at, rather than that Serbia is not a target market — so V14 added the locale rather than dropping the
flag. **If the owner intended a 32nd market, the asset for it was not delivered, and only the owner can say
which country it is.** That is an open question, not a defect this pass could resolve.

## Three filenames do not name the country they depict

These are the owner's filenames and they are **not renamed** — `apps/flags` is treated as read-only. The
mapping lives in `markets.ts`, so the product addresses every flag by its real ISO 3166-1 alpha-2 code and
`scripts/media/sync-flags.mjs` publishes `GP.svg` to `public/flags/FR.svg`.

| Asset | Actually depicts | Served as | Note |
|---|---|---|---|
| `GP.svg` | the French tricolour | `FR.svg` | `GP` is Guadeloupe; `index.ts` already noted the reuse |
| `ID2.svg` | the Polish flag | `PL.svg` | white over red — Indonesia is red over white; `index.ts` noted it |
| `KO.svg` | the flag of South Korea | `KR.svg` | `ko` is a *language* tag; the country is `KR` |

`ID.svg` and `ID2.svg` are near-mirror images of each other, which is exactly how a red-over-white Indonesian
flag and a white-over-red Polish one differ. Getting this wrong would show a Polish reader the Indonesian flag,
so it is checked in `scripts/qa/v14-locales.mjs`: the language control's flag must match the market's ISO code.

## Country is not language

`locale` is the language a market is **served in**, which is not mechanically its country's name:

- **India → `hi`.** Hindi is the native option; Indian applicants who prefer English have `en` one row away.
- **Philippines → `fil`.** Filipino, not Tagalog's `tl`; `resolveLocale` maps `tl` → `fil`.
- **Saudi Arabia → `ar`.** The only RTL market in the set.
- **China → `zh-Hans`.** Simplified, with the script subtag preserved through `?lang=` — `zh` alone would be
  ambiguous and `zh-Hant` is a different market the owner did not include.

In this particular set of 31 no two markets share a locale, so no translation is reused across markets and the
"one language, several markets" case does not arise yet. It will the moment a second Arabic-speaking or
Spanish-speaking market is added, and `markets.ts` is already shaped for it: several `Market` rows may carry
the same `locale`, and the selector lists markets rather than languages.

---

## The matrix

**Home** is the homepage (the 49 `v11.*` keys — hero, university band, value triptych, services, FAQ, closing
band). **Directory** is the public university directory and detail pages (the `v12.*` keys). **Common** is the
shared namespace every surface draws on.

| # | Flag file | Country | ISO | Locale | Native language | English | Korean | Dir | Home | Directory | Common | Status |
|--:|---|---|---|---|---|---|---|---|--:|--:|--:|---|
| 1 | `KO.svg` ⚠️ | South Korea | KR | `ko` | 한국어 | Korean | 대한민국 | LTR | 100% | 100% | 100% | SYNTHETIC_REVIEWED |
| 2 | `US.svg` | United States | US | `en` | English | English | 미국 | LTR | 100% | 100% | 100% | SOURCE_APPROVED |
| 3 | `VN.svg` | Vietnam | VN | `vi` | Tiếng Việt | Vietnamese | 베트남 | LTR | 100% | 1% | 100% | SYNTHETIC_REVIEWED |
| 4 | `CN.svg` | China | CN | `zh-Hans` | 简体中文 | Chinese (Simplified) | 중국 | LTR | 100% | 1% | 100% | SYNTHETIC_REVIEWED |
| 5 | `JP.svg` | Japan | JP | `ja` | 日本語 | Japanese | 일본 | LTR | 100% | 1% | 100% | SYNTHETIC_REVIEWED |
| 6 | `UZ.svg` | Uzbekistan | UZ | `uz` | Oʻzbekcha | Uzbek | 우즈베키스탄 | LTR | 100% | 1% | 100% | SYNTHETIC_REVIEWED |
| 7 | `MN.svg` | Mongolia | MN | `mn` | Монгол | Mongolian | 몽골 | LTR | 100% | 1% | 100% | SYNTHETIC_REVIEWED |
| 8 | `KZ.svg` | Kazakhstan | KZ | `kk` | Қазақша | Kazakh | 카자흐스탄 | LTR | 100% | 1% | 100% | MACHINE_DRAFT |
| 9 | `KG.svg` | Kyrgyzstan | KG | `ky` | Кыргызча | Kyrgyz | 키르기스스탄 | LTR | 100% | 1% | 100% | MACHINE_DRAFT |
| 10 | `TH.svg` | Thailand | TH | `th` | ไทย | Thai | 태국 | LTR | 100% | 1% | 99% | SYNTHETIC_REVIEWED |
| 11 | `ID.svg` | Indonesia | ID | `id` | Bahasa Indonesia | Indonesian | 인도네시아 | LTR | 100% | 1% | 99% | MACHINE_DRAFT |
| 12 | `PH.svg` | Philippines | PH | `fil` | Filipino | Filipino | 필리핀 | LTR | 100% | 1% | 100% | MACHINE_DRAFT |
| 13 | `IN.svg` | India | IN | `hi` | हिन्दी | Hindi | 인도 | LTR | 100% | 1% | 100% | MACHINE_DRAFT |
| 14 | `BD.svg` | Bangladesh | BD | `bn` | বাংলা | Bengali | 방글라데시 | LTR | 100% | 1% | 100% | MACHINE_DRAFT |
| 15 | `SA.svg` | Saudi Arabia | SA | `ar` | العربية | Arabic | 사우디아라비아 | RTL | 100% | 1% | 100% | MACHINE_DRAFT |
| 16 | `TR.svg` | Türkiye | TR | `tr` | Türkçe | Turkish | 튀르키예 | LTR | 100% | 1% | 100% | MACHINE_DRAFT |
| 17 | `RU.svg` | Russia | RU | `ru` | Русский | Russian | 러시아 | LTR | 100% | 1% | 100% | MACHINE_DRAFT |
| 18 | `UA.svg` | Ukraine | UA | `uk` | Українська | Ukrainian | 우크라이나 | LTR | 100% | 1% | 80% | MACHINE_DRAFT |
| 19 | `ID2.svg` ⚠️ | Poland | PL | `pl` | Polski | Polish | 폴란드 | LTR | 100% | 1% | 80% | MACHINE_DRAFT |
| 20 | `CZ.svg` | Czechia | CZ | `cs` | Čeština | Czech | 체코 | LTR | 100% | 1% | 80% | MACHINE_DRAFT |
| 21 | `HU.svg` | Hungary | HU | `hu` | Magyar | Hungarian | 헝가리 | LTR | 100% | 1% | 80% | MACHINE_DRAFT |
| 22 | `RO.svg` | Romania | RO | `ro` | Română | Romanian | 루마니아 | LTR | 100% | 1% | 80% | MACHINE_DRAFT |
| 23 | `RS.svg` | Serbia | RS | `sr` | Српски | Serbian | 세르비아 | LTR | 100% | 1% | 2% | MACHINE_DRAFT |
| 24 | `GR.svg` | Greece | GR | `el` | Ελληνικά | Greek | 그리스 | LTR | 100% | 1% | 80% | MACHINE_DRAFT |
| 25 | `IT.svg` | Italy | IT | `it` | Italiano | Italian | 이탈리아 | LTR | 100% | 1% | 80% | MACHINE_DRAFT |
| 26 | `ES.svg` | Spain | ES | `es` | Español | Spanish | 스페인 | LTR | 100% | 1% | 100% | MACHINE_DRAFT |
| 27 | `PT.svg` | Portugal | PT | `pt` | Português | Portuguese | 포르투갈 | LTR | 100% | 1% | 80% | MACHINE_DRAFT |
| 28 | `GP.svg` ⚠️ | France | FR | `fr` | Français | French | 프랑스 | LTR | 100% | 1% | 100% | MACHINE_DRAFT |
| 29 | `DE.svg` | Germany | DE | `de` | Deutsch | German | 독일 | LTR | 100% | 1% | 80% | MACHINE_DRAFT |
| 30 | `NL.svg` | Netherlands | NL | `nl` | Nederlands | Dutch | 네덜란드 | LTR | 100% | 1% | 80% | MACHINE_DRAFT |
| 31 | `SE.svg` | Sweden | SE | `sv` | Svenska | Swedish | 스웨덴 | LTR | 100% | 1% | 80% | MACHINE_DRAFT |
---

## What these numbers mean, and what is still open

**Home: 31/31 markets at 100%.** This is the V14 change. Before this pass the homepage existed in Korean,
English and Russian only — 28 of the 31 markets read the owner's own marketing copy in English. All 49 strings
were translated **from the Korean source**, which is the canonical semantic original (brief Part 41); English
was used only as a second reading to check meaning. Every string went through
`scripts/i18n/v14-merge.mjs`, which refuses a value that drops or invents an interpolation, that uses markup
the renderer cannot handle, that is byte-identical to the English source, or that contains characters from a
writing system the locale does not use.

That last check earned its place immediately: the first batch written by hand contained a Chinese sentence
ending in the Russian word "материалы" and a Japanese one containing the Korean "설계" — both invisible to a
coverage count, both obvious to a native reader. One genuine cognate is recorded by name (`fr` /
`v11.nav.services` / "Services") so that "equals the English" is always either a decision or a failure.

**Directory: ~1 % in 29 markets.** The public directory and university detail pages (225 `v12.*` keys) exist
in Korean and English only; the 1 % is the three footer and navigation labels the chrome pass translated,
which happen to live in that namespace. This is the largest remaining localization gap and it is stated plainly rather than
rounded up: a Vietnamese reader gets a fully Vietnamese homepage and then an English university page. The
pipeline to close it is the same one used for the homepage.

**Privacy and terms are deliberately excluded.** `v12.privacy` and `v12.terms` account for the largest share
of the missing keys, and they are out of scope on purpose: a privacy policy is a legal instrument, not UI copy,
and publishing a machine-drafted one in 29 languages would be worse than publishing an English one that is
correct. They are translated when a named reviewer with legal standing signs off per language — brief Part 40's
"where a localized legal version is intended".

**No locale is `HUMAN_REVIEWED`.** The translations added in this pass are `SYNTHETIC_REVIEWED` at best: drafted
and then read back against a rubric by AI personas, recorded per locale in `docs/qa/v14/locales/<locale>.md`.
`HUMAN_REVIEWED` requires a named human reviewer and no locale has one.

The `status` column above is the **locale's overall status across every namespace**, and this pass does not
raise it. 23 of the 31 still read `MACHINE_DRAFT`, which is accurate: their homepage is synthetic-reviewed and
their student, writing and visa namespaces are not. A per-locale status necessarily reflects the weakest part
of a locale, and raising it on the strength of one namespace would make the field say less than it does now.

**`sr` is new and partial.** Serbian has the homepage and the site chrome and nothing else — `common` is at
**2 %** (the ten chrome keys of 587), so a Serbian reader who moves beyond the homepage sees English sooner
than a reader of any other market. It is in the selector because the market is real and the homepage
is genuinely Serbian; it is listed here as incomplete rather than quietly presented as finished.

---

## Two lists, deliberately different

`apps/flags` is the source of truth for which markets the product **presents itself to**, because the brief
says so and because supplying those assets is the owner's decision. It is not the only market list this
product holds, and the second one is not wrong for being different.

| | Defined by | Answers |
|---|---|---|
| `MARKETS` (31) | `apps/flags` | which markets we **present** to |
| `RESEARCH_MARKETS` (14) | `docs/research/visa-playbooks.json`, `docs/qa/v13/country-simulations/`, seed personas | which markets we **know how to serve** |

Both live in `packages/i18n/src/markets.ts`; `marketGap()` computes the difference and
`scripts/qa/v14-locales.mjs` prints it on every run.

### Where they differ today

| | Count | |
|---|--:|---|
| In both | **11** | presented *and* researched |
| Researched, not presented | **3** | Nepal (`ne`), Myanmar (`my`), Pakistan (`ur`) |
| Presented, not yet researched | **19** | US JP SA TR RU UA PL CZ HU RO RS GR IT ES PT FR DE NL SE |

Korea is excluded from the second row: it is the destination, not a source market.

### What this means, and what was *not* done about it

**Nepal, Myanmar and Pakistan read the public homepage in English.** Not because the translation pass skipped
them — because they have no flag in `apps/flags`, so they are not in the presented set the pass covered. All
three have a visa playbook, a country simulation and a student persona; Nepali and Burmese are gated to 100 %
in the student app. The product knows how to serve them and does not advertise to them.

**Nineteen presented markets have no recruitment research.** A flag is a statement of intent, and intent
ahead of research is a normal way to enter a market. It is only a problem if nobody knows it is the state.

Three things were deliberately **not** done:

1. **No flag was invented.** Nepal, Myanmar and Pakistan are not added to `MARKETS`, because `apps/flags` is
   the owner's list and inventing an asset to make a table symmetrical is the opposite of treating it as the
   source of truth.
2. **No locale was dropped.** `ne`, `my` and `ur` keep every string they have. A language is not removed
   because its go-to-market paperwork is missing.
3. **The lists were not merged.** They measure different things, and collapsing them would destroy the only
   signal that says which markets are ready and which are aspirational.

What the owner can decide — and only the owner can — is whether to add flag assets for the three researched
markets, commission research for some of the nineteen, or leave the lists as they are and treat the gap as
the intended shape of the business.
