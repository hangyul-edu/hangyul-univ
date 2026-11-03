# Russian (ru) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `ru` (PIPELINE.md steps 0–3 and 5; step 4, the leak check, is run by the coordinator)
- Status: NOT human-reviewed. Do not set `status` to `HUMAN_REVIEWED` on the basis of this record.
- Starting point: web 30.6 % (2,649 missing), native 30.5 % (3,023 missing). After this work: `v9-todo ru` → 0 missing / 0 identical / 0 stale for web (3,830 keys) and native (4,366 keys).
- Merged data: `scripts/i18n/v9-data/ru-1.json` … `ru-10.json` (about 3,050 values, all through `v9-merge.mjs`).
- Register: polite «вы» (lower case, as in the existing ru strings), short sentences, no slang. Gender-neutral past tense uses «подал(а)», «добавил(а)».
- Plurals: one / few / many / other written for every family; `other` uses the genitive singular (fractional form).

## Sample read

- All new strings, read side by side with the English while translating (common, student, dossier, success, writing, visaroute, concierge, mobile).
- Second pass, as the four readers, on: `student:verdict.*`, `discover.verdict*`, `start.*`, `v4.verdictText.*`, `universityV2.verdictLine.*`, `common:tier.*`,
  `mobile:v3.match.*`, `mobile:v3.quick.*`, `mobile:student.matches.tierShort.*` (STATE_MAP); `student:budget.*`, `v9.money.*`, `v9.funds.*`, `v9.guard.*`,
  `v9.refund.*`, `ws3.tuition.*`, `v4.offer.*`, `success:submission.*` (money, fees, authorisation); `visaroute:*` (visa); `student:v9.family.*`, `v9.sponsor.*` (parent page).
- Whole-locale greps for odds/promise wording («шанс», «гарантир», «конкурент», «амбициоз», «не волнуйтесь») and for term drift (application fee, admission letter, counselor).
- No screens: the leak check and screenshots are run by the coordinator, and I did not launch a browser.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 4 / 3 / 4 / 4 / 5 | 5 / 4 / 4 / 4 / 5 |
| B. Graduate applicant 23–29 | 4 / 4 / 3 / 4 / 5 | 5 / 4 / 4 / 5 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 4 / 4 / 5 | 5 / 4 / 5 / 4 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 4 / 4 / 3 / 5 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Scores below 4 before revisions:
- B, trust 3: the pre-existing tier badges used admission-odds words. `common:tier.COMPETITIVE` was «Конкурентный» and `common:tier.REACH` was «Амбициозный». The mobile short tiers had the same words, and `student:dashboard.recommended.subtitle` said «Сильные и конкурентные варианты». STATE_MAP says COMPETITIVE = *Possible match* and REACH = *Not eligible yet (one step away)*.
- A, naturalness 3: calques in a few count strings («Ещё до 1 программы остался один шаг», «1 дело к сроку: …»).
- D, action clarity 3: status chips read «Нужны вы» ("You are needed"). This is unclear to an older reader; it does not say that the student has to act.

## Issues found and fixed

| Key | Before → After | Why |
|---|---|---|
| `common:tier.COMPETITIVE` | Конкурентный → Возможно, подходит | STATE_MAP *Possible match*; no odds wording. |
| `common:tier.REACH` | Амбициозный → Пока не подходит | STATE_MAP group *Not eligible yet* (English now "Not eligible yet"). |
| `common:tier.STRONG` | Сильное совпадение → Хорошо подходит | Same series as the other three verdicts. |
| `mobile:student.matches.tierShort.STRONG/COMPETITIVE/REACH` | Сильный / Конкурентный / Амбициозный → Подходит / Возможно / Почти | Short chips in the STATE_MAP series. |
| `student:verdict.COMPETITIVE` / `verdict.REACH` (new) | — → Возможно, подходит / Пока не подходит | Checked against STATE_MAP. REACH is never shown as a possible match. |
| `student:start.tier.POSSIBLE`, `mobile:v3.quick.tier.POSSIBLE` | — → Остался один шаг | "One step away" belongs to *Not eligible yet*, not to *Possible match*. |
| `student:dashboard.recommended.subtitle` | Сильные и конкурентные варианты → Программы, которые хорошо или, возможно, подходят | STATE_MAP terms. |
| `student:matches.emptyText.STRONG` | …сильные варианты → …программы, которые хорошо подходят | STATE_MAP terms. |
| `mobile:v3.quick.possible_*` | Ещё до N программы остался один шаг → Ещё для N программ остался один шаг | Natural Russian. |
| `student:v4.home.thingsDue_*` | N дело к сроку: {{label}} → {{label}}: N дело с приближающимся сроком | Natural Russian. |
| `student:v4.ws.state.todo`, `writing.needYou`, `dossier:state.todo` | Нужны вы → Ждёт вас | Clear status chip. |
| `dossier:group.todo`, `visaroute:docs.needsYou`, `mobile:v3.documents.needsYou` | Нужны вы → Требует вашего участия | Clear heading. |

## Terminology (ru)

| English (STATE_MAP / core) | ru |
|---|---|
| Strong match | Хорошо подходит |
| Possible match | Возможно, подходит |
| Not eligible yet (one step away) | Пока не подходит (остался один шаг) |
| Needs your grades | Нужны ваши оценки (existing) |
| Counselor | Консультант (existing) |
| Offer | Предложение (о зачислении) (existing) |
| (Standard) admission letter | (Стандартное) письмо о зачислении (existing) |
| Residence card | Карта регистрации иностранца (ARC) (existing) |
| Application fee / tuition | Регистрационный сбор / плата за обучение |
| Money you must show (not pay) | Деньги, которые нужно показать (а не заплатить) |
| Bank balance certificate | Справка об остатке на банковском счёте |
| Apostille / consular legalization | Апостиль / консульская легализация |
| Dormitory | Общежитие |

## Residual risks (what a native reviewer should check first)

1. **«Регистрационный сбор»** for the university application fee follows the existing student-app strings. Some Russian readers may confuse it with residence registration. The public website (`marketing`) uses «сбор за подачу». A human should pick one term for both surfaces.
2. **Short verdict chips** (`mobile:student.matches.tierShort.*`: Подходит / Возможно / Почти / Пока нет). «Почти» for REACH is compact but could be read as "almost eligible". Check it against the STATE_MAP intent on a real phone screen.
3. **Visa / legal precision**: `visaroute:caveat.*`, `v9.funds.*` (for example «консультационная» / «отличная» for the university certification tiers, and «сертификат на выдачу визы» for 사증발급인정서). These should be checked against the Russian-language pages of the Korean embassies in Almaty, Tashkent and Bishkek.
4. **Gendered verbs** with `{{university}}` («{{university}} запросил», «принял решение») assume a masculine noun («университет»). They read correctly with Latin university names, but a reviewer should check them on screen.
5. **City and airport names** were transliterated (Алматы, Инчхон (ICN), Кимпхо (GMP)). Check them against the official Russian spellings used by the embassies.
6. Leak check not run by this agent (the coordinator runs it).
