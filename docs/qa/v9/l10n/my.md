# Burmese (my) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `my`
- Status: NOT human-reviewed. `status` must not be set to `HUMAN_REVIEWED` on the basis of this record.
- Script: Unicode Burmese (no Zawgyi). The U+2060 word-joiner is used only in existing `marketing` headlines; no student-journey
  string used it, so none of the new strings add it.
- Leak check (step 4): not run by this agent — the coordinator runs it.

## Scope

- Merged: `scripts/i18n/v9-data/my.json` (287 todo keys + 5 STATE_MAP fixes, incl. 1 native-only key), `my-2.json` (2 English leftovers
  in existing strings), `my-3.json` (5 revisions from this review).
- Result: `v9-todo my` → web 3556 keys, 0 missing / identical / stale; `--native` → 4050 keys, 0 missing / identical / stale.
- No `_identical_ok` needed: plan names and "Google Maps" are translated (`Google မြေပုံ`); `v9.funds.amount.ANY` and
  `dossier:v9.who.sentItem` are placeholder-only.

## Sample read

All 287 todo keys, plus existing verdict strings and a Latin-script scan of every web-manifest key:

- Family link (`student:v9.family.*`) and the sponsor's page (`student:v9.sponsor.*`) — parents are the readers.
- Money (`student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `concierge:status.REFUND.*`).
- Routes without a test (`student:v9.routes.*`), announced rule changes (`v9.announced.*`), visa caveats (`v9.visa.*`).
- Who can see documents (`dossier:v9.who.*`), application status notifications (`common:notify.application.*`, reusing `common:appStatus.*` wording).
- `student:verdict.*`, `student:start.tier.*`, `mobile:v3.quick.tier.*` against docs/STATE_MAP.md.

No screenshots (browsers are off for translator agents); the coordinator's leak-check screenshots are the screen-level check.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 4 / 4 / 4 / 5 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 5 / 4 / 4 / 4 / 5 | 5 / 4 / 5 / 4 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 3 / 4 / 4 | 5 / 4 / 5 / 5 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 3 / 3 / 3 / 4 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Why first scores were below 4: trust was 3 for C/D because existing verdicts were mislabelled (a *Possible match* displayed as
*Strong match*). D's naturalness/action clarity were 3 because of "waiting from you" (`သင့်ထံမှ စောင့်နေသည်`) on the refund status,
a redundant insurance label, and a "consulting" tier label that read as "advice-receiving".

## Issues found and fixed

| Key | Before → After | Why |
|---|---|---|
| `student:verdict.COMPETITIVE` | အလွန် ကိုက်ညီ → ကိုက်ညီနိုင် | Used the *Strong match* term for *Possible match* — overstates the result. |
| `student:verdict.REACH` | ကိုက်ညီနိုင် → အရည်အချင်း မပြည့်မီသေး | English is "Not eligible yet"; old string read as *Possible match*. |
| `student:start.tier.POSSIBLE`, `mobile:v3.quick.tier.POSSIBLE` | ကိုက်ညီနိုင် → တစ်ဆင့်သာ လိုတော့သည် | STATE_MAP: "One step away" belongs to *Not eligible yet*, not *Possible match*; now matches `mobile:v3.quick.possible_*`. |
| `student:university.campus.naver` | Naver Map တွင် ဖွင့်ရန် → Naver မြေပုံတွင် ဖွင့်ရန် | English word "Map" left in. |
| `concierge:pickup.handle` | သင့် ID သို့မဟုတ် နံပါတ် → သင့် အကောင့်အမည် သို့မဟုတ် ဖုန်းနံပါတ် | "ID" English; "number" ambiguous. |
| `student:v9.refund.status.WAITING_STUDENT`, `concierge:status.REFUND.WAITING_STUDENT` | သင့်ထံမှ စောင့်နေသည် → သင့်အကြောင်းပြန်ချက်ကို စောင့်နေသည် | Unnatural; now says what the student must do (reply). |
| `student:v9.money.line.insurance` | ကျန်းမာရေး အာမခံ (အမျိုးသား ကျန်းမာရေး အာမခံ) → အမျိုးသား ကျန်းမာရေး အာမခံ | Redundant. |
| `student:v9.sponsor.landing` | {{when}} တွင် ဆိုက်ရောက်မည် → ဆိုက်ရောက်ချိန်: {{when}} | Works whether `{{when}}` is a date or relative time. |
| `student:v9.funds.longer_other` | ('အကြံပြုချက်ခံ') → ('ကြီးကြပ်ခံ') | The Korean "consulting university" tier means a university under supervision. |

## Terminology

| Concept | Burmese (reused from existing strings) |
|---|---|
| Strong match | အလွန် ကိုက်ညီ |
| Possible match | ကိုက်ညီနိုင် |
| Not eligible yet / one step away | အရည်အချင်း မပြည့်မီသေး / တစ်ဆင့်သာ လိုတော့သည် |
| Needs your grades | သင့်အမှတ်များ လိုအပ်သည် |
| Counselor / agency | အတိုင်ပင်ခံ / အေဂျင်စီ |
| Tuition / semester / dormitory | ကျူရှင်ခ / စာသင်နှစ်ဝက် / ကျောင်းအဆောင် |
| Embassy / consulate / immigration office | သံရုံး / ကောင်စစ်ဝန်ရုံး / လူဝင်မှုကြီးကြပ်ရေးရုံး |
| Admission letter (certificate) | ဝင်ခွင့်ပြုစာ |
| Residence card | နိုင်ငံခြားသား မှတ်ပုံတင်ကတ် |
| NHIS | အမျိုးသား ကျန်းမာရေး အာမခံ (the code "NHIS" is not an allowed Latin token, so it is spelled out) |
| Sponsor | ထောက်ပံ့သူ |
| Refund / money changer / broker | ငွေပြန်အမ်း / ငွေလဲသူ / ပွဲစား |
| Family relationship certificate | မိသားစု ဆက်နွယ်မှု သက်သေခံ |

## Residual risks (check first with a native reviewer)

1. Plan names (`student:services.*.name`: အခမဲ့ ရှာဖွေရေး / လျှောက်လွှာ အကူအညီ / ပရီမီယံ အောင်မြင်ရေး) are translated, not brand-locked — confirm with product.
2. `student:v9.visa.methodNote.VISA_CENTRE_DHAKA` keeps "VFS Global" and "visa.go.kr" in Latin (operator name and URL). The leak check may flag "VFS Global".
3. Existing strings still contain Latin keycaps/codes: "Enter"/"Shift" (`student:messages.hint`), "CSV", "Hukou", "CHSI / CDGDC", airport codes, "Hangyul Univ". Left as is (literal key names and official codes).
4. Money/visa sentences (`v9.funds.*`, `v9.guard.text`, `v9.announced.rule.*`) should be checked for legal precision, especially the conditional "would" (ရမည် ဖြစ်သည်) on announced-but-not-in-force rules.
5. Register: formal written style (–သည်/–ပါ) matching existing strings; a native reader may prefer a softer spoken tone for students.
6. "Sponsor" appears as both ထောက်ပံ့သူ and အာမခံသူ in older strings; new strings use ထောက်ပံ့သူ.
