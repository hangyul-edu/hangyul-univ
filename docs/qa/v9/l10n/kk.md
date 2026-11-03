# Kazakh (kk) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `kk` (PIPELINE.md steps 0–3 and 5; step 4, the leak check, is run by the coordinator)
- Status: NOT human-reviewed. Do not set `status` to `HUMAN_REVIEWED` on the basis of this record.
- Starting point: web 9.3 % (3,309 missing, 1 identical), native 10 % (3,739 missing, 1 identical); only `common` and `marketing` existed.
- After this work: `v9-todo kk` → 0 missing / 0 identical / 0 stale for web (3,652 keys) and native (4,160 keys).
- Merged data: `scripts/i18n/v9-data/kk-1.json` … `kk-13.json` (3,740 values), `kk-tier.json` (common:tier fix), `kk-review.json` (37 revisions). All through `v9-merge.mjs`; new namespace files: student, dossier, success, writing, visaroute, concierge, mobile.
- Script and register: Kazakh Cyrillic, as in the existing `kk/common.json`. Polite «Сіз» throughout, short sentences. Brand **Hangyul** kept in Latin; TOPIK, IELTS, TOEFL iBT, D-2, D-4, NHIS, HiKorea, visa.go.kr, KRW/₩ kept as is.
- Plurals: kk uses `one` / `other` (CLDR). Both written for every family; Kazakh nouns after numerals stay singular, so most pairs are identical.

## Sample read

- Every new string, read side by side with the English while translating (common, student, dossier, success, writing, visaroute, concierge, mobile).
- Second pass, as the four readers, on:
  - STATE_MAP / verdicts: `student:verdict.*`, `student:discover.verdict.*`, `discover.emptyVerdict.*`, `start.tier.*`, `start.result.*`, `v4.verdictText.*`, `universityV2.verdictLine.*`, `common:tier.*`, `success:group.*`, `success:obs.*`, `mobile:v3.match.*`, `mobile:v3.quick.*`, `mobile:v3.discover.explain.*`, `mobile:v3.university.verdict.*`.
  - Money: `student:budget.*`, `v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `ws3.tuition.*`, `v4.offer.*`, `services.*`, `success:submission.*` (fees, authorisation).
  - Visa: all of `visaroute:*`, `common:task.visa.*`, `v9.visa.*` (including the Almaty/Astana caveats, which are the ones Kazakh readers will actually see).
  - Parent page: `student:v9.family.*`, `v9.sponsor.*`.
- Greps over the whole kk locale for odds/promise wording («бәсеке», «қиындау», «мүмкіндігіңіз», «кепілдік», «уайымдамаңыз») and for Kazakh grammar problems around placeholders (missing accusative after `{{label}}` / `{{essay}}` / `{{item}}`, partitive «N-нің M» constructions).
- No screens: the leak check and screenshots are run by the coordinator, and no browser was launched.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 4 / 3 / 4 / 4 / 5 | 5 / 4 / 4 / 5 / 5 |
| B. Graduate applicant 23–29 | 4 / 4 / 3 / 4 / 5 | 5 / 4 / 4 / 5 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 3 / 4 / 5 | 5 / 4 / 5 / 4 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 3 / 4 / 4 / 5 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Scores below 4 before revisions:
- B and C, trust 3: the existing `common:tier.COMPETITIVE` was «Бәсекеге қабілетті» ("competitive") and `common:tier.REACH` was «Қиындау мақсат» ("harder target"). Both are odds-style words, and STATE_MAP says COMPETITIVE = *Possible match* and REACH = *Not eligible yet (one step away)*. Also, `student:v9.routes.korean.count_*` first read «тіл бағдарламасы сізді қазір қабылдайды» ("…will admit you now"), which a parent reads as an admission promise.
- A and D, naturalness 3: count strings used Kazakh partitive forms that need a case suffix on the number («{{total}} құжаттың {{ready}} дайын», «Олардың {{count}} …»). Some imperatives had a bare `{{label}}` / `{{essay}}` object with no accusative («{{essay}} жазыңыз»). Kazakh needs «…мәтінін жазыңыз».

## Issues found and fixed

| Key | Before → After | Why |
|---|---|---|
| `common:tier.COMPETITIVE` | Бәсекеге қабілетті → Ықтимал сәйкестік | STATE_MAP *Possible match*; no odds wording. |
| `common:tier.REACH` | Қиындау мақсат → Әзірге сәйкес емес | STATE_MAP group *Not eligible yet* (English is "Not eligible yet"). |
| `student:verdict.*`, `discover.verdict.*`, `success:group.*`, `mobile:v3.match.*` (new) | — → Жоғары сәйкестік / Ықтимал сәйкестік / Әзірге сәйкес емес / Бағаларыңыз қажет | Checked against STATE_MAP and the existing `common:tier.STRONG` / `NOT_ELIGIBLE`. REACH is never shown as a possible match. |
| `student:start.tier.POSSIBLE`, `mobile:v3.quick.tier.POSSIBLE` (new) | — → Бір қадам қалды | "One step away" belongs to *Not eligible yet*. It is written as a gap, not as a probability. |
| `student:v9.routes.korean.count_*` | …сізді қазір қабылдайды → …талаптарына қазір сәйкес келесіз | Eligibility, not admission (trust, parents). |
| `student:start.result.possible_*` | …бір олқылықты жапсаңыз болады → …бір ғана олқылықты жабу керек | Colloquial and slightly vague → precise. |
| `dossier:page.summary`, `dossier:summary.S_READY_ALL`, `mobile:v3.documents.readyOf`, `visaroute:form.progress`, `writing:finding.UNDER_LENGTH`, `UNDER_CHAR_LENGTH`, `student:home.arrivalProgress` | «N-нің M …» → «M / N …» or «… : N ішінен M» | Grammatical with any number. |
| `success:block.inChecklist_*`, `success:obs.SOME_OVER_BUDGET_*`, `success:block.history` | «Олардың {{count}} …» → «Олардың ішінде {{count}} тармақ …» etc. | Same partitive problem. |
| `student:v4.ws.you.*`, `v4.ws.team.readingEssay`, `approvedEssay`, `action.openEssay`, `success:item.DOC_MISSING/ESSAY_*`, `dossier:upload.*`, `requests.uploadNewer` | «{{essay}} жазыңыз» → «{{essay}} мәтінін жазыңыз»; «{{label}} жүктеңіз» → «{{label}} құжатын жүктеңіз» | Accusative object required in Kazakh. |
| `mobile:v4.application.nextFix/Upload/Write` | «{{item}} түзетіңіз» → «Түзетіңіз: {{item}}» | `{{item}}` may be a document or an essay; the colon form works for both. |

## Terminology (kk)

| English (STATE_MAP / core) | kk |
|---|---|
| Strong match | Жоғары сәйкестік (existing) |
| Possible match | Ықтимал сәйкестік |
| Not eligible yet | Әзірге сәйкес емес (existing) |
| one step away | бір қадам қалды |
| Needs your grades | Бағаларыңыз қажет |
| You might qualify (scholarships) | Сәйкес келуіңіз мүмкін (existing `common:eligibility.POSSIBLE`) |
| Counselor | Кеңесші (existing) |
| Offer | Ұсыныс (existing) |
| (Standard) admission letter | (Стандартты) қабылдау хаты (existing) |
| Residence card | Резидент картасы (existing) |
| Application fee / tuition | Өтінім алымы / оқу ақысы |
| Money you must show (not pay) | Көрсетуге (төлеуге емес) тиіс қаражат |
| Bank balance certificate | Банктегі қалдық туралы анықтама (existing) |
| Apostille / consular legalization | Апостиль / консулдық заңдастыру (existing) |
| Visa issuance certificate (사증발급인정서) | визаны беруге арналған куәлік |
| Dormitory / deposit | Жатақхана / кепілақы |
| Post (embassy or consulate) | мекеме |

## Residual risks (what a native reviewer should check first)

1. **«Ықтимал сәйкестік»** for *Possible match*. It is neutral, but a reviewer should confirm that Kazakh readers do not hear "probable admission" in «ықтимал». The alternative is «Сәйкес келуі мүмкін».
2. **Public website still uses odds words**: `kk/marketing.json` (`…p1`, the "strong, competitive or reach" lines) mirrors the English marketing copy, which itself still says "competitive / reach". This is outside the student-journey manifest and was not changed here. It needs the marketing owner to update the English first.
3. **Visa precision for Kazakhstan**: `visaroute:caveat.DIPLOMA_APOSTILLE_POSTS`, `v9.visa.caveat.TB_POST_CONFLICT`, «мекеме» for "post", «визаны беруге арналған куәлік» for CCVI, «үздік» / «кеңес беру» for the university certification tiers. Check these against the Kazakh/Russian pages of the Korean embassy in Astana and the consulate in Almaty.
4. **Placeholder grammar**: Kazakh case endings after `{{university}}`, `{{country}}`, `{{doc}}`, `{{label}}` are avoided with helper nouns («… университетіне», «… құжатын», «{{country}} елінде»). Check on screen with real Latin university names and Kazakh document labels.
5. **City and airport names** were written in Kazakh Cyrillic (Бейжің, Ұлан-Батор, Инчхон (ICN), Кимпхо (GMP)). Check them against the official spellings.
6. **Localised examples**: `onboarding.education.institutionPh` uses «Әл-Фараби атындағы ҚазҰУ» and `sponsor.goalPh` uses Korean–Kazakhstani companies instead of the Vietnamese examples in the English.
7. Leak check not run by this agent (the coordinator runs it).
