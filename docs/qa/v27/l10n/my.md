# V27 l10n review — Burmese (my)

Scope: all 727 strings of `scripts/i18n/v27/strings.json` → `scripts/i18n/v27/tx/my.json`. The file had 729 strings when
I started. Two `_one` keys in common (`uni27.schol.count_one`, `fit.unlock_one`) were removed upstream during the run,
and the output follows the current source.

**Encoding: Unicode only.** I scanned every string for Zawgyi signatures: ေ (U+1031) at the start of a word or after a
space, code points U+1060–U+1097, U+1033 or U+1034. There were 0 hits. Every string passes the validator's Myanmar-block
check (U+1000–U+109F).

Register: polite written Burmese with "-ပါ" requests and "-သည်/-ပါသည်" statements, the style Myanmar education agencies
use online. The reader is addressed as သင်, as in the existing bundle. Burmese numerals are used in prose (၃၀ စက္ကန့်,
၆ လ, ၁၁၂). Test levels and GPA examples keep Latin digits (TOPIK အဆင့် 4, ဥပမာ 3.6), as the bundle does.

## Personas

| Persona | Who | What they need from the copy |
|---|---|---|
| Hnin Wai, 18, Yangon | Matriculation passed, plans a Korean language institute (D-4-1) and then a bachelor's | Simple, kind Burmese with no heavy Pali-derived terms |
| Kyaw Zin, 26, Mandalay | Engineering graduate, master's applicant | Exact visa and document terms (အပိုစတီးလ်, သံရုံး အတည်ပြုခြင်း, CCVI) |
| Hnin Wai's mother, 50, Yangon | Paying, worried about agents and money transfers | Clear payment, refund and "never use borrowed money" warnings |

## Glossary

| English | Burmese | Note |
|---|---|---|
| scholarship | ပညာသင်ဆု | bundle term |
| Global Korea Scholarship (GKS) | ကိုရီးယား အစိုးရ ပညာသင်ဆု (GKS) | the name Myanmar applicants use |
| admission guide (모집요강) | ဝင်ခွင့် လမ်းညွှန် | |
| apostille | အပိုစတီးလ် (Convention: အပိုစတီးလ် သဘောတူစာချုပ်) | short form of the bundle's term |
| consular legalization (영사확인) | သံရုံး အတည်ပြုခြင်း / အတည်ပြုချက် | bundle term |
| Korean language institute | ကိုရီးယားဘာသာ သင်တန်းကျောင်း | |
| counselor | အတိုင်ပင်ခံ | bundle term |
| the Hangyul team | Hangyul အဖွဲ့ | bundle term |
| tuition | ကျူရှင်ခ | bundle term |
| deadline | နောက်ဆုံးရက် | bundle term |
| admission letter / certificate of admission | ဝင်ခွင့်ပြုစာ (Certificate of Admission) | bundle term |
| residence card | နိုင်ငံခြားသား မှတ်ပုံတင်ကတ် | bundle term |
| embassy / consulate | သံရုံး / ကောင်စစ်ဝန်ရုံး | |
| immigration office | လူဝင်မှုကြီးကြပ်ရေး ရုံး | |
| CCVI | ဗီဇာထုတ်ပေးရန် အတည်ပြုလက်မှတ် (CCVI) | |
| agency | အေဂျင်စီ | |
| match | ကိုက်ညီမှု | bundle term |
| Recommended (sort) | အကြံပြု အစီအစဉ် | not အဆင့်သတ်မှတ်ချက် (ranking) |
| save | သိမ်းရန် | bundle term |
| upload | အပ်လုဒ်လုပ်ပါ | bundle term |
| essay | စာစီစာကုံး | |
| bank balance certificate | ဘဏ်လက်ကျန်ငွေ ထောက်ခံစာ | bundle term |

## Pass A: meaning (3 strings changed)

| Key | Before | After |
|---|---|---|
| student:essay.precheck.code.OVERCLAIM | အတိအကျ ပြောဆိုချက်များကို ရှောင်ပါ။ | ချဲ့ကား ပြောဆိုချက်များကို ရှောင်ပါ။ (the first version said "avoid *precise* statements", the opposite of the meaning) |
| student:v9.funds.waived | …သံရုံးက ဤအရာကို မတောင်းနိုင်ပါ။ | …မတောင်းဘဲ နေနိုင်သည်။ ("cannot ask" became "may not ask") |
| marketing:agenciesPage.valueLede | နောက်ယောင်ခံ လိုက်ရသည့် အလုပ်… | နောက်ဆက်တွဲ လိုက်လံ ဆက်သွယ်ရသည့် အလုပ်… (the first version read as "stalking"; "follow-up" was meant) |

## Pass B: native naturalness (5 strings changed)

| Key | Before | After |
|---|---|---|
| common:fit.q.nationality | သင့်နိုင်ငံသားက ဘာလဲ။ | သင် ဘယ်နိုင်ငံသားလဲ။ |
| common:fit.q.level | ဘာ သင်ယူချင်ပါသလဲ။ | ဘာကို လေ့လာချင်ပါသလဲ။ |
| student:dashboard.nextAction.TASK.text.APPLICATION_SUBMIT | …စိတ်ကျေနပ်သည့်အခါ တင်သွင်းပါ။ | …သင် အဆင်သင့်ဖြစ်သည့်အခါ တင်သွင်းပါ။ ("comfortable" had been calqued as "satisfied") |
| dossier:check.rejected | မှတ်သားပြီး။ … | မှတ်ထားပါပြီ။ … |
| student:matches.tierText.COMPETITIVE | …သေချာမှု နည်းသည်။ | …သေချာမှု နည်းပါသည်။ (now uses the polite ending) |

## Pass C: UI context, brevity, consistency (10 strings changed)

| Key | Before | After |
|---|---|---|
| student:legalFlow.note.JOINS (and 5 others) | Apostille သဘောတူစာချုပ် | အပိုစတီးလ် သဘောတူစာချုပ် (one script for "apostille" throughout) |
| marketing:trust.lede | Apostille အဖွဲ့ဝင်ဖြစ်မှု | အပိုစတီးလ် အဖွဲ့ဝင်ဖြစ်မှု |
| marketing:howPage.lede | …မိတ်ဖက် ကိုယ်စားလှယ်များ… | …မိတ်ဖက် အေဂျင်စီများ… (ကိုယ်စားလှယ် means "representative"; the agency term is now consistent) |
| mobile:university.flagged.hint | …ကျောင်းသားများနှင့် ကိုယ်စားလှယ်များ မမြင်ရပါ။ | …ကျောင်းသားများနှင့် အေဂျင်စီများ မမြင်ရပါ။ |
| visaroute:methodNote.ACCREDITED_ONLY | …အသိအမှတ်ပြုထားသော ကိုယ်စားလှယ်များမှတစ်ဆင့်… | …အသိအမှတ်ပြုထားသော အေဂျင်စီများမှတစ်ဆင့်… |

## Final comparison

I compared all 727 pairs against the English and the Korean. Placeholders, `<em>`, the email address and g4k.go.kr are
intact, and each placeholder is followed by a space before a Burmese particle (`{{name}} ၏`), so the rendered text
reads correctly. Nothing guarantees admission or invents a chance ("ဝင်ခွင့်ကို အာမမခံပါ", "ဝင်ခွင့်ရနိုင်ခြေကို ဘယ်တော့မှ
လုပ်ကြံ မပြောပါ"). "Recommended" is a browsing order. Counts use the classifier ခု, so the base keys work for any number.
`node scripts/i18n/v27/validate.mjs --only=my` reports 727 strings valid and 0 problems, and the Zawgyi scan has 0 hits.

## Unsure

- `fit.test.*` carry the suffix "စာမေးပွဲ" to satisfy the script check, and Duolingo reads "Duolingo English Test
  (အွန်လိုင်း စာမေးပွဲ)".
- `fit.level.BACHELOR` = ဘွဲ့ကြို follows the bundle. Strictly, it means "undergraduate", which is acceptable for a level
  picker. `fit.level.ASSOCIATE` keeps "Associate ဘွဲ့", because Myanmar has no equivalent degree.
- "e-visa" stays in Latin, as Myanmar applicants see it on official sites.
- Transliterations of Korean places (ချွန်အန်, တုံယောင်း, ဟွတ်ဆော့, ဘေ့ကျယ်) have no established Burmese spellings.
- `v20.uni.why.breadthBody` omits the Hangul "(대학알리미)".
- Burmese strings run long in code points. All are within the validator's 2.2× + 12 limit, but a few, such as
  `fit.tier.*.title`, may wrap on narrow phones.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → လျှောက်ထားရန် ဘာသာစကား ရမှတ် မလိုပါ။ ဝင်ခွင့်ရပြီးနောက် {{tests}} နှင့်အထက် ရှိရန် လိုအပ်သည်။
- `fit.reason.far` → {{options}} နှင့်အထက် လိုအပ်သည်။ သင့်လက်ရှိ ရမှတ်ထက် များစွာ မြင့်သည်။
- `fit.tier.UNCLEAR.title` → ယခုအတွက် အလှမ်းဝေးသေးသည်
- `fit.tier.UNCLEAR.short` → ပြင်ဆင်ရန် လို
- `fit.tier.UNCLEAR.lede` → သင့်လက်ရှိ ရမှတ်သည် ထုတ်ပြန်ထားသော စည်းကမ်းချက်ထက် များစွာ နိမ့်နေသည်။ ပြင်ဆင်ရန် အချိန်ပိုယူပြီး ထပ်စစ်ပါ။

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
