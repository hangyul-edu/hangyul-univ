# Kyrgyz (ky, Cyrillic): V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `ky`
- Status: NOT human-reviewed. Do not set `status` to `HUMAN_REVIEWED` on the basis of this record.
- Leak check (step 4): not run by this agent. The coordinator runs it.

## Scope

- Merged `scripts/i18n/v9-data/ky-1.json` … `ky-12.json`. Together they cover the full todo: common 95, student 1661, dossier 187,
  success 297, writing 120, visaroute 484, concierge 468 and mobile 428. That is 3,740 values (3,309 web + 431 native-only).
  New namespace files: student, dossier, success, writing, visaroute, concierge, mobile.
- `ky-13.json` holds the revisions from this review, plus 2 STATE_MAP fixes to existing `common:tier.*` strings. `ky-14.json` removes 2 English leftovers.
- Result: `v9-todo ky` gives web 3652 keys with 0 missing, identical or stale. `--native` gives 4160 keys with 0 missing, identical or stale.
- Kept identical to English on purpose (`_identical_ok`, 27 keys): IELTS, TOEFL iBT, TOPIK, GPA, PhD, Google Maps, the service plan names
  (Application Support, Free Explorer, Premium Success), the messenger names (KakaoTalk, LINE, Telegram, WhatsApp, Zalo), Hangyul and
  Hangyul Univ, "—", and strings that hold only placeholders or `$t()` references.

## Sample read

Every todo key was read by namespace, in screen order:
- Money and family: `student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `v9.family.*`, `v9.sponsor.*`, `budget.*`
  (read mostly as profiles C and D).
- Dashboard next actions and the application workspace: `dashboard.nextAction.*`, `v4.ws.*`, `ws3.*`, `mobile:v3.*`, `mobile:v4.*`.
- Visa route (`visaroute:*`), documents (`dossier:*`), essay review (`writing:*`), plan and submission (`success:*`).
- Arrival (`concierge:*`).
- Every verdict and tier string, checked against docs/STATE_MAP.md. That covers `student:verdict.*`, `discover.verdict.*`,
  `start.tier.*`, `mobile:v3.quick.tier.*`, `mobile:v3.match.*`, `success:group.*` and `common:tier.*`.

No screenshots were taken, because translator agents do not run browsers.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 4 / 4 / 5 / 5 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 5 / 4 / 4 / 5 / 5 | 5 / 4 / 5 / 5 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 3 / 4 / 4 | 5 / 4 / 5 / 5 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 3 / 3 / 4 / 4 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Why some first scores were below 4:
- **Trust (C, D): 3.** Two existing `common:tier.*` strings broke STATE_MAP. `tier.COMPETITIVE` (*Possible match*) read
  "Атаандаштыкка жөндөмдүү" ("competitive"). `tier.REACH` (*Not eligible yet*) read "Татаалыраак максат" ("a harder target"). Both read as
  odds-style grading, not a statement about requirements.
- **Naturalness (D): 3.** Some first drafts attached case suffixes to placeholders, for example `{{university}} университетине`. This
  doubles the word when the name already contains "University", and some sentences with numbers read stiffly ("Алардын 1и …").

## Issues found and fixed

| Key | Before → After | Why |
|---|---|---|
| `common:tier.COMPETITIVE` | Атаандаштыкка жөндөмдүү → Мүмкүн болгон дал келүү | STATE_MAP: COMPETITIVE = *Possible match* (no odds wording) |
| `common:tier.REACH` | Татаалыраак максат → Азырынча ылайык эмес | English is "Not eligible yet" (one step away) |
| `student:v4.offer.pay`, `v4.offer.payNoDate` | `{{university}} университетине {{amount}} төлөйсүз` → `{{date}} чейин төлөйсүз: {{amount}} ({{university}})` | No suffix on the placeholder. The amount and the payee stay explicit for parents |
| `student:v4.ws.consequence.tuition` | `{{university}} университетиндеги ордуңуз` → `ордуңуз ырасталат ({{university}})` | Same reason |
| `success:block.inChecklist_*`, `success:obs.SOME_OVER_BUDGET_*` | "Алардын 1и …", "Арыздарыңыздын 1инин …" → "Алардын бирөө …", "Арыздарыңыздын биринин …" | Natural number wording |
| `student:dashboard.nextAction.PROFILE_UNLOCK.gpa.text` | "{{total}} программаңыздын {{count}} …" → "{{total}} программаңыздын ичинен {{count}} программа …" | Clear "X of Y" |
| `student:register.prior.question` | "Бүтүрдүңүз беле: {{level}}?" → "{{level}} — бүтүрдүңүзбү?" | Natural question |
| `dossier:finding.NEAR_EXPIRY` | "… бүтөт, бул {{until}} чейин" → "… бүтөт, бирок ал {{until}} чейин керек" | Meaning was unclear |
| `writing:student6.checkGuide` | Spelling (тексттин → текстин) | Typo |
| `visaroute:doc.other_sop.name`, `common:task.visa.residence_card` | English words removed ("statement of purpose", "(residence card)") | No English for profile D |
| Placeholder pattern throughout (`dashboard.nextAction.APPLICATION_ITEM.*.title`, `mobile:v4.home.item.*`, `v4.ws.you.*`, `dossier:upload.*`, `success:item.*`) | Written as `{{university}}: жүктөңүз — {{label}}` and `Оңдоңуз: {{label}}` | A colon form never needs a case suffix on the placeholder. Counts use `{{ready}}/{{total}}` |

## Terminology

| English | Kyrgyz |
|---|---|
| Strong match | Күчтүү дал келүү |
| Possible match | Мүмкүн болгон дал келүү |
| Not eligible yet | Азырынча ылайык эмес |
| One step away | Бир кадам калды (matches marketing `quick.tier.POSSIBLE`) |
| Not eligible yet — close (`mobile:v3.match.close`) | Азырынча ылайык эмес — бир кадам калды |
| Needs your grades | Бааларыңыз керек |
| Counselor | Кеңешчи |
| Application | Арыз |
| Offer | Сунуш |
| Admission letter | (Стандарттык) кабыл алуу каты |
| Tuition | Окуу акысы |
| Application fee / visa fee | Арыз төлөмү / виза төлөмү |
| Residence card (ARC) | Резидент картасы (as in existing `common:docCategory.RESIDENCE_CARD`) |
| Immigration office | Иммиграция кеңсеси |
| Embassy / consulate / post | Элчилик / консулдук / өкүлчүлүк |
| Visa issuance certificate (CCVI) | Виза берүү тууралуу күбөлүк |
| Apostille / consular legalization | Апостиль / консулдук легализация (консулдук ырастоо) |
| Bank balance certificate / statement | Банктагы калдык тууралуу маалымкат / банк көчүрмөсү (выписка) |
| Family relationship certificate | Туугандык байланыш тууралуу маалымкат |
| TB certificate | Кургак учук (туберкулез) боюнча маалымкат |
| Deposit (housing) | Күрөө акысы |
| Sponsor | Демөөрчү |
| Refund | Акчаны кайтаруу |
| Authorize / withdraw (submission) | Уруксат берүү / уруксатты кайтарып алуу |
| Airport pickup | Аэропорттон тосуп алуу |
| Document vault | Документтер сактагычы |
| Certification tiers "excellent" / "consulting" | «мыкты» / «консалтинг» |
| Application statuses | Same as `common:appStatus.*` |

Kept in Latin script: Hangyul, TOPIK, KIIP, IELTS, TOEFL iBT, GPA, NHIS, HiKorea, T-money, VFS Global, visa.go.kr, g4k.go.kr, e-Form,
eSIM, SIM, D-2/D-4/D-4-1, CHSI / CDGDC, Aadhaar, NRC, the messenger names and the key names Enter and Shift.

## Money, visa and legal precision checks

- `v9.funds.title` reads "Көрсөтүү керек болгон (төлөнбөгөн) акча" ("money you must show, not pay"). `v9.funds.sub` says the money is paid to no one and must really belong to the student or the family.
- `v9.funds.genuine` says that putting money in only to get a certificate is "Кореянын мыйзамы боюнча тыюу салынган" (forbidden by Korean law). The wording is not softened.
- `v9.guard.text`, `v9.refund.*` and `tuition.*` say to pay the university directly, in the student's own name, never through money changers, agents or someone else's account. Refunds go only to the student's own account.
- `v9.announced.*` and `v9.visa.caveat.SCHEDULED_CHANGE` say "күчүнө кире элек" (not yet in force). The announced rules are written in the conditional mood (-мак), as planned effects.
- `v9.routes.notOffer` and `start.result.honest` say the result is not an offer and not a prediction, and that the university decides. No reassurance was added. `services.honestText` keeps "universities decide, the government issues visas".
- `submission.*` keeps every "never share your portal password" warning. `lease.disclaimer` keeps "юридикалык текшерүү эмес" (not a legal review).
- Durations, deadlines and amounts are carried exactly: 90 days, 15 days, 6 months, 30 days, 10 days, 2 working days, the intake windows (1 Dec–15 Feb, 1 Jun–14 Aug), 2 Sep 2026, 1 Oct 2026 and 11 Sep 2026.

## Residual risks (for a native human reviewer)

1. **"Дал келүү" as the match noun.** It follows the existing ky marketing strings. A reviewer should confirm that
   "Мүмкүн болгон дал келүү" reads naturally as a verdict label on small mobile chips. A shorter alternative is "Мүмкүн".
2. **Suffixes after Latin names.** A few names take a suffix after an apostrophe, for example "Hangyul'га" and "HiKorea'да". This is
   common practice, but check it on screen. Ordinal forms such as `{{level}}-деңгээл` and `{{version}}-нуска` follow the existing common file.
3. **Embassy route.** Kyrgyz nationals apply at the Korean Embassy in Bishkek. The visaroute strings themselves are generic. Check the
   Bishkek route screen once the leak check runs.
4. **"Резидент картасы" for the ARC.** This term is kept from the existing common file. Some Kyrgyz sources use "чет элдиктин катталуу
   картасы". A human should choose one term.
5. **Untouched marketing strings.** Older marketing strings, which are not in the student manifest, still use "атаандаштыкка жөндөмдүү" and
   "татаалыраак максат" for the old tier names (`matching.p1`, `journey.stages.MATCH.text`). They were left as they are because they are outside this scope.
6. **Leak check.** The leak check and the screen-level read have not run yet (coordinator step 4).
