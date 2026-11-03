# Mongolian (mn, Cyrillic): V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `mn`
- Status: NOT human-reviewed. Do not set `status` to `HUMAN_REVIEWED` on the basis of this record.
- Leak check (step 4): not run by this agent. The coordinator runs it.

## Scope

- Merged `scripts/i18n/v9-data/mn-1.json` … `mn-14.json`. These cover the full todo plus keys added during the run: common 93,
  student 408, dossier 187, success 295, writing 120, visaroute 484, concierge 468 and mobile 59, about 2,110 values in all.
  New namespace files: dossier, success, writing, visaroute, concierge.
- `mn-15.json` holds 35 revisions from this review (placeholder suffixes). `mn-16.json` holds 6 STATE_MAP terminology fixes to existing strings.
- Result: `v9-todo mn` → web 3649 keys with 0 missing, identical or stale. `--native` → 4157 keys with 0 missing, identical or stale.
- Identical to English on purpose (`_identical_ok`): PhD, CV, GPA, Google Maps, service plan names (Application Support, Free
  Explorer, Premium Success), messenger names (KakaoTalk, LINE, Telegram, WhatsApp, Zalo), "Hangyul" (dev group), and strings that are only placeholders
  or `$t()` references.

## Sample read

All todo keys were read by namespace in screen order:
- Money and family: `student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `v9.family.*`, `v9.sponsor.*`
  (mostly as readers C and D).
- Dashboard next actions and the application workspace: `dashboard.nextAction.APPLICATION_ITEM.*`, `v4.ws.*`, `mobile:v4.*`.
- Visa route (`visaroute:*`), documents (`dossier:*`), essay review (`writing:*`), plan and submission (`success:*`).
- Arrival (`concierge:*`).
- The existing verdict strings, checked against docs/STATE_MAP.md.
No screenshots were taken, because browsers are off for translator agents.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 4 / 4 / 5 / 5 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 5 / 4 / 4 / 4 / 5 | 5 / 4 / 5 / 5 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 3 / 4 / 4 | 5 / 4 / 5 / 5 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 3 / 3 / 4 / 4 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Why some first scores were below 4:
- **Trust (C, D): 3.** Existing verdict strings broke STATE_MAP. `verdict.COMPETITIVE` (*Possible match*) showed *Сайн тохирол*
  (Strong match), and `verdict.REACH` (*Not eligible yet*) showed *Боломжит тохирол* (Possible match). Both overstate the result
  to the person who pays.
- **Naturalness (D): 3.** Fixed case suffixes were attached to placeholders: `{{label}}-аа`, `{{other}}-тэй`, `{{total}}-аас`.
  Mongolian vowel harmony makes many of them wrong for the actual document name or number (for example "эссэ-аа" or "2-аас").

## Issues found and fixed

| Key | Before → After | Why |
|---|---|---|
| `student:verdict.COMPETITIVE` | Сайн тохирол → Боломжит тохирол | STATE_MAP: COMPETITIVE = *Possible match* |
| `student:verdict.REACH` | Боломжит тохирол → Хараахан шаардлага хангахгүй | English is "Not eligible yet" (one step away) |
| `student:start.tier.POSSIBLE`, `mobile:v3.quick.tier.POSSIBLE` | Боломжит тохирол → Нэг алхам дутуу | English is "One step away". Now matches marketing `quick.tier.POSSIBLE` |
| `student:scholarships.group.NOT_ELIGIBLE`, `matches.tierText.NOT_ELIGIBLE` | Одоогоор … → Хараахан шаардлага хангахгүй … | One term everywhere for *Not eligible yet* |
| `student:dashboard.nextAction.APPLICATION_ITEM.{FIX,REVISE_ESSAY,LEGALIZE,REQUEST}.title` + `mobile:v4.home.item.*` | `{{university}}: {{label}}-аа засах` → `{{university}}: засах — {{label}}` | No suffix on the placeholder, so vowel harmony is never wrong |
| `dossier:finding.DUPLICATE`, `finding.POSSIBLE_DUPLICATE`, `upload.replacing` | `{{other}}-тэй`, `{{title}}-ийг` → sentence rebuilt with a colon | Same reason |
| Counts "X of Y" (`success:submission.docs`, `.essays`, `dossier:page.summary`, `visaroute:docs.progress`, `student:v5.home.stepsDone`, `success:block.history`, `writing:finding.UNDER_*`, `OVER_*`) | `{{total}}-аас {{ready}}` → `{{ready}}/{{total}}` | A numeral suffix depends on the number. The slash form is neutral and easy for parents to read |
| `student:v9.routes.korean.opens_*` | TOPIK {{level}}-тэй бол → TOPIK {{level}} авбал | Natural, no suffix |
| `success:obs.SAVED_STRONG_OPTION`, `writing:finding.OTHER_UNIVERSITY`, `submission.step.open_portal` | `{{university}}-ийг …` → colon form | Same reason |

## Terminology

| English | Mongolian |
|---|---|
| Strong match | Сайн тохирол |
| Possible match | Боломжит тохирол |
| Not eligible yet | Хараахан шаардлага хангахгүй |
| One step away | Нэг алхам дутуу |
| Needs your grades | Таны дүн хэрэгтэй |
| Counselor | Зөвлөх |
| Tuition | Сургалтын төлбөр |
| Application fee / visa fee | Өргөдлийн хураамж / визийн хураамж |
| Admission letter | (Стандарт) элсэлтийн бичиг |
| Offer | Санал (элсэлтийн санал) |
| Residence card (ARC) | Гадаад иргэний бүртгэлийн үнэмлэх (short: бүртгэлийн үнэмлэх) |
| Immigration office | Цагаачлалын алба |
| Embassy / consulate / post | Элчин сайдын яам / консулын газар / төлөөлөгчийн газар |
| Visa issuance certificate (CCVI) | Визийн зөвшөөрлийн бичиг (CCVI) |
| Apostille / consular legalization | Апостиль / консулын баталгаажуулалт |
| Bank balance certificate / statement | Банкны үлдэгдлийн тодорхойлолт / банкны хуулга |
| Family relationship certificate | Ураг төрлийн холбоо нотлох бичиг |
| TB certificate | Сүрьеэгийн шинжилгээний бичиг |
| Deposit (housing) | Барьцаа төлбөр |
| Sponsor | Ивээн тэтгэгч |
| Refund | Буцаан олголт |
| Authorize / withdraw (submission) | Зөвшөөрөх / зөвшөөрлөө цуцлах |
| Airport pickup | Нисэх буудлаас тосолт |
| Application statuses | identical to `common:appStatus.*` |

Kept in Latin script: Hangyul, TOPIK, KIIP, IELTS, TOEFL iBT, GPA, NHIS, HiKorea, T-money, VFS Global, visa.go.kr, g4k.go.kr,
e-Form, eSIM, D-2/D-4/D-4-1, CHSI / CDGDC, Aadhaar, NRC.

## Money, visa and legal precision checks

- `v9.funds.title` reads "Харуулах (төлөхгүй) мөнгө". `v9.funds.sub` says the money is paid to no one and must really belong to the student or the family.
- `v9.funds.genuine` says that putting money in only to get a certificate is "Солонгосын хуулиар хориотой" (forbidden by Korean law). The wording is not softened.
- `v9.guard.text` and `v9.refund.*` say to pay the university directly, in the student's own name. Refunds go only to the student's account. The warning about money changers and agents is kept in full.
- `v9.announced.*` and `v9.visa.caveat.SCHEDULED_CHANGE` say "хүчин төгөлдөр болоогүй" (not yet in force). The rules are written as planned effects.
- `v9.routes.notOffer` says "элсэлтийн санал ч биш, таамаглал ч биш — шийдвэрийг их сургууль гаргана" (not an offer and not a prediction; the university decides). No reassurance was added.
- `submission.*` keeps every "never share your portal password" warning. `lease.disclaimer` keeps "not a legal review".
- Durations, deadlines and amounts are carried exactly: 90 days, 15 days, 6 months, intake windows, 2 Sep 2026, 1 Oct 2026, 11 Sep 2026.

## Residual risks (for a native human reviewer)

1. Suffixes remain on `{{date}}` (-нд, -нээс), `{{university}}` (-д, -ийн, -аас) and a few `{{city}}`/`{{country}}` (-ийн, -д).
   These follow the existing mn files, but vowel harmony can be wrong for some university or country names. Check the
   dashboard, submission and visaroute screens first.
2. City names (Себу, Чэнду, Чиндао, Шэньян, Шиань, Дака) and airport names (Чонжу, Кимпо, Кимхэ) use common Mongolian forms.
   Confirm them against MFA or embassy usage.
3. The tier names "шилдэг" (excellent) and "зөвлөгөө авах" (consulting) need checking against how Mongolian agencies describe
   Korea's university certification.
4. `v9.routes.korean.count_*` has no number in the string, because the UI puts the count before it. Check this on screen.
5. Existing older strings use both "Баримт бичиг" and "Баримт" for documents. Common `tier.COMPETITIVE`/`REACH` ("Өрсөлдөхүйц"/"Сорилттой") follow
   different English and were left as they are.
6. The leak check and screen-level reading have not run yet (coordinator step 4).
