# V28 l10n review: cs (Čeština)

Job `scripts/i18n/v28/jobs/cs.json` → `scripts/i18n/v28/tx/cs.json`. Register: polite «vy» (lower case, as Czech web
copy writes it), warm and plain for students; short professional Czech in the consoles.

## Personas

- **Tereza, 18, Brno (first-time visitor)**: final year of gymnázium, arrives on a university page from search, has
  TOPIK 2 and is nervous about the paperwork.
- **Ondřej, 27, Ostrava (comparison shopper)**: engineer comparing English-taught master's programmes and service tiers.
  Reads every condition.
- **Jana, 49, Tereza's mother**: pays the tuition; cares who is paid, when, and that nothing is promised.

## Glossary (reused from V27 cs, extended)

| English | Korean | Czech |
|---|---|---|
| the Hangyul team | 한귤 상담팀 | tým Hangyul (never «váš poradce») |
| consular legalization | 영사확인 | konzulární superlegalizace |
| legalization (generic) | 공증·인증 | ověření listin / superlegalizace |
| apostille | 아포스티유 | apostila |
| admission guide | 모집요강 | pokyny k přijímacímu řízení |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS) |
| scholarship | 장학금 | stipendium |
| tuition | 등록금 | školné |
| plan (paid) | 플랜 | balíček |
| application | 지원서 | přihláška |
| intake | 모집 학기 | termín nástupu |
| deadline | 마감 | termín / uzávěrka |
| offer | 합격 | nabídka (přijetí) |
| enrollment | 등록 | zápis |
| residence card | 외국인등록증 | průkaz o pobytu |
| proof of funds | 재정 증명 | doklad o finančních prostředcích |
| international office | 국제교류처 | mezinárodní oddělení |
| dormitory | 기숙사 | kolej |
| case / case owner | 건 / 담당자 | případ / odpovědná osoba |
| Writing section / essay | 글쓰기 / 에세이 | Psaní / esej |
| interview | 면접 | pohovor |
| diplomatic post | 공관 | úřad |
| far quick-fit tier | 준비가 더 필요한 대학 | Je potřeba víc přípravy |
| match | 매칭 | shoda |

## Plurals

CLDR cs: one / few / many / other, where `other` is the form for 0 and 5+ and `many` is for fractions. Every `_other`
job key (10) got `_few` and `_many` (20 forms): programů / programy / programu, semestrů / semestry / semestru,
přihlášek / přihlášky / přihlášky (+ `_one` přihláška), «před {{count}} dny / dny / dne». Count labels without agreement
use a colon («Neověřené dokumenty: {{count}}»). The three `_one`-only job keys cannot take extra forms (no `_other` in the
job).

## Pass A: meaning (28 strings changed)

All 20 «poradce» strings now name the Hangyul team; fit tiers follow the V28 English.

| Key | Before | After |
|---|---|---|
| common:fit.tier.UNCLEAR.title | Zatím ještě dlouhá cesta | Je potřeba víc přípravy |
| common:fit.tier.MEETS.title | Splňujete jejich zveřejněná minima | Univerzity, jejichž minima splňujete |
| visaroute:step.slow_items.why | Ověření, test na TBC… | Superlegalizace, test na TBC… |
| university:v22.stageHint.decision | Na čekací listině — rozhodnutí je stále na nás | Na čekací listině. Rozhodnutí zatím nepadlo |
| marketing:v15.pricing.premium.f5 | Žádost o kolej, online orientace před odletem… | Kolej, příjezd a 30 dní pomoci se zabydlením |

## Pass B: native naturalness (40 strings changed)

| Key | Before | After |
|---|---|---|
| marketing:v20.uni.ctaTitle | Chcete to vzít vážně? | Uvažujete o přihlášce sem? |
| marketing:v20.uni.whyTitle | Jaká je tato univerzita | Čím se odlišuje |
| agency:v8.ops.ageing.title | Stárnutí případů podle fáze | Doba stání případů podle fáze |
| agency:v9.ops.unpaid.q | Kdo zaplatil za službu a jeho případ nikdo nevlastní? | Kteří studenti zaplatili za službu, ale nemají odpovědnou osobu? |
| student:v4.compare.scholarshipHint | Pouze pokud splníte jeho pravidla | Jen pokud splníte jeho podmínky |

## Pass C: UI context, brevity, one term per concept (6 strings changed)

| Key | Before | After |
|---|---|---|
| agency:v27.stage.recent (draft) | Poslední změna před {{count}} dny | Dní od poslední změny: {{count}} (no wrong «před 1 dny») |
| university:v8.aq.need | Potřeba k rozhodnutí | Potřebné k rozhodnutí |
| visaroute:help.who | Kdo jedná | Kdo to dělá |
| visaroute:form.source.missing | Není v Hangyul | Nemáme v záznamech |
| agency:docs.sc.checks | Zaškrtnout kontrolu / vybrat důvod | Zaškrtněte kontrolu nebo vyberte důvod |

«termín nástupu» for intake everywhere in the university console; «balíček» for plan; «kolej» for dormitory.

## Marketing scorecard (30 points)

| Section | Score | Notes |
|---|---|---|
| SEO / home description | 26 | two sentences, «vyřiďte vízum» |
| Pricing | 26 | lede leads with the choice |
| City pages | 25 | Gyeonggi reworded around travel time; Seoul line new |
| University page | 26 | CTA title as a question; English/GKS/scholarship cards new |
| Universities index + FAQ | 25 | «Univerzity z celé Koreje.» |

## Unsure

- `university:documents.legalization` «Ověření listin»: a column covering apostila and superlegalizace; «Legalizace»
  is shorter but less common in Czech.
- `marketing:v20.uni.why.ieqasExcellent` «IEQAS: vynikající úroveň»: no official Czech grade name.
- `agency:docs.uploadForName` «Nahrát za: {{name}}» avoids declining the name; slightly terse.
- `agency:v8.ops.deadlines.q` «do {{count}} dnů» reads oddly for exactly 1; not a plural key.

## Final source↔target comparison

Placeholders, numbers (1 500 wonů), test names, GKS/IEQAS/SLA/OCR, ÷ and → preserved; percentages with a space
(«{{pct}} %»). Validator: `390 strings valid, 0 problems` (370 job keys + 20 extra plural forms).

## Counts

Job keys 370 · kept verbatim 42 · rewritten 74 · newly translated 254 · extra plural forms 20.

## Second pass (jobs2): leak families the crawl missed

Scope: `scripts/i18n/v28/jobs2/cs.json`: marketing 2 · student 39 · success 465 · dossier 124 = **630 job keys** + 14 extra plural forms (`_few`/`_many` for the 7 `_other` keys).
Output `scripts/i18n/v28/tx2/cs.json`. Same personas, glossary and method as above. The first-pass glossary terms are reused
unchanged: přihláška (application) · podat/podání (submit) · zmocnění / zmocnit (authorization) · poplatek za přihlášku · doklad (receipt) · esej · konzulární superlegalizace · apostila · tým Hangyul. Student-facing "your counselor" → the Hangyul team throughout; console `{{counselor}}` name placeholders
and the agency `ownerShort.counselor` column keep the role word.

Passes: A meaning (counselor → team, authorization ≠ calque, "Strong/Possible match" = first-pass `group.*` labels), B naturalness,
C UI brevity and placeholder-safe word order (count-first plurals turned into «label: {{count}}» where a bare fallback key exists).
Marketing (2 keys, `v20.uni.intl.*`): scored 26/30 (clarity 5, trust 5, naturalness 4, brevity 4, CTA 4, cultural fit 4) after one rewrite.

Examples (draft → final):
- `success:item.ESSAY_WRITE.why`: *Váš poradce si ho přečte…* → *Tým Hangyul si esej přečte, než půjde na univerzitu.*
- `success:submission.authorize.basis`: *Doložený právní základ: {{basis}}* → *Doložený základ: {{basis}}*
- `success:agency.strategyNone`: *Nic nezbývá.* → *Nic nezbývá vyřešit.*
- `success:obs.SAME_DAY_DEADLINES`: *{{count}} termínů {{date}}.* → *Termíny {{date}}: {{count}}.*
- `dossier:finding.LEGALIZATION_NEEDED`: *…potřebuje {{path}} (path in nominative)* → *Aby ho univerzity přijaly, potřebuje {{path}}. (path.* in accusative: apostilu / konzulární superlegalizaci)*

Unsure:
- `dossier:path.*` are in the accusative (apostilu, konzulární superlegalizaci) because their only slot is the object of «potřebuje»; any other reuse would read wrong.
- Czech `_many` (decimals) added as instructed; the forms use genitive singular («{{count}} dokumentu»).
- `success:status.READY_FOR_HANDOFF` «Připraveno k odeslání» kept identical to first-pass `agency:v15.readiness.READY`, while the verb elsewhere is «podat».
- `success:block.title_one`, `block.inChecklist_one`, `line.more_one`: `_one`-only keys with no `_other`, so no extra forms can be added; the English has a literal 1, kept as a word/digit.
- `dossier:upload.status.NEEDS_REVIEW` / `UPLOADED` / `NEEDS_CORRECTION` are intentionally empty (validator requires empty); `upload.haveTitle*` was built so the empty status slot reads cleanly.
- `page.needYou` and `check.matching` are bare fallback keys beside `_one`; written as «label: {{count}}» so they are grammatical for any count.

Counts: job keys 630 · kept verbatim 0 (no `current` values) · rewritten 0 · newly translated 630 · extra plural forms 14.
Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=cs` → `644 strings valid, 0 problems` (EXIT=0).

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
