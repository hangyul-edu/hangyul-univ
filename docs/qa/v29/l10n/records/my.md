# V29 l10n record — my (Burmese)

Job: `scripts/i18n/v28/jobs-v29/my.json` (158 keys, 0 existing) → `scripts/i18n/v28/tx-v29/my.json`.
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=my` → 158 valid, 0 problems. Not applied.

## Personas
| Persona | Who | Reads for |
|---|---|---|
| Hnin Wai, 18, Yangon (first-time visitor) | matriculation passed | plain, kind Burmese, clear first step |
| Kyaw Zin, 26, Mandalay (comparison shopper) | comparing Hangyul with local agents | exact counts, what is extra, no promises |
| Daw Moe, parent/payer | pays in USD by card | one-time payment, exchange-rate note, no visa promise |

## Glossary (consistent with the V28 my glossary)
| English | Burmese | Note |
|---|---|---|
| Basic / All-in-One / Premium | Latin | |
| plan | အစီအစဉ် | V28 term |
| the Hangyul Univ team | Hangyul Univ အဖွဲ့ | V28 team term |
| your team | သင့်အဖွဲ့ / တာဝန်ခံအဖွဲ့ | |
| consultation | ဆွေးနွေးမှု (အကြံပေးဆွေးနွေးမှု) | V28 term |
| follow-up | နောက်ဆက်တွဲ | |
| recommended | အကြံပြု | research & suggest |
| managed application | လျှောက်လွှာ စီမံပေး | distinct from အကြံပြု |
| up to N | အများဆုံး N | |
| editing | တည်းဖြတ်မှု | |
| round | ကြိမ် | |
| no round limit within contracted documents | စာချုပ်ပါ စာရွက်စာတမ်းအတွင်း အကြိမ်ရေ ကန့်သတ်ချက်မရှိ | never အကန့်အသတ်မဲ့ |
| personal statement / study plan | ကိုယ်ရေးထုတ်ဖော်ချက် / လေ့လာမှု အစီအစဉ် | existing essayType terms |
| mock interview | အစမ်း အင်တာဗျူး | |
| dormitory | အဆောင် | V28 term |
| airport pickup arrangement | လေဆိပ် ကြိုဆိုရေး စီစဉ်ပေးခြင်း | via partner transport company |
| custom quote | သီးခြား ဈေးနှုန်းတွက်ချက်ပေးမည် | |
| additional service | အပို ဝန်ဆောင်မှု | |
| settling in | အခြေချနေထိုင်ခြင်း | |
| Korean language institute | ဘာသာစကားသင်တန်း | |
| contract / term | စာချုပ် / စာချုပ်ကာလ | |
| service period | ဝန်ဆောင်မှု ကာလ | |
| priority response | ဦးစားပေး ပြန်ကြားမှု | |
| dedicated team | သီးသန့်အဖွဲ့ | |
| deadline | နောက်ဆုံးရက် | V28 term |
| notarization | နိုတာရီ | |

## Pass A — meaning vs Korean (5 changed)
- premium.f3: "အကန့်အသတ်မဲ့ တည်းဖြတ်" → "စာချုပ်ပါ လျှောက်လွှာစာရွက်စာတမ်း တည်းဖြတ်မှု၊ အကြိမ်ရေ ကန့်သတ်ချက်မရှိ".
- all_in_one.f2: "တက္ကသိုလ် 2 ခု လျှောက်ပေး" → "တက္ကသိုလ် လျှောက်လွှာ အများဆုံး 2 ခု စီမံပေး".
- addon.pickupNote: "ကျွန်ုပ်တို့ ကြိုဆိုပေး" → "မိတ်ဖက် သယ်ယူပို့ဆောင်ရေး ကုမ္ပဏီမှတစ်ဆင့် စီစဉ်ပေးပါသည်".
- notes.visaDecision: decision explicitly "သက်ဆိုင်ရာ အာဏာပိုင်က ဆုံးဖြတ်သည်".
- compare.value.settlement: both bounds (မရောက်မီ {{before}} ရက်မှ ရောက်ပြီး {{count}} ရက်အထိ).

## Pass B — naturalness (5 changed)
- addOn.decline: "မဟုတ်ပါ ကျေးဇူး" → "မလိုပါ၊ ကျေးဇူးပါ".
- addOn.noPressure: dash removed, two short sentences.
- why.s1.title: "သင်လိုအပ်သလောက် အကူအညီ" → "လိုသလောက် ကူညီမည်".
- addOn.failed: "လုပ်ဆောင်မှု ပျက်ကွက်" → "မအောင်မြင်ပါ။ ခဏနေမှ ထပ်ကြိုးစားပါ။".
- notes.title: "မဝယ်မီ" → "မဝယ်မီ သိထားရန်".

## Pass C — UI brevity (3 changed)
- mobile unrationed.TEAM → "အဖွဲ့ နောက်ဆက်တွဲ".
- mobile termToAgree → "စတင်ချိန်တွင် သတ်မှတ်မည်".
- "ပြင်ဆင်ပေးခြင်း" (ambiguous with "prepare") unified to "တည်းဖြတ်မှု" for editing.

## Marketing scorecard
| Section | Score |
|---|---|
| v29.why.s1 | 5+5+4+4+4+5 = 27 |
| v29.why.s3 | 5+5+4+4+4+5 = 27 |

## Unsure
- "သီးခြား ဈေးနှုန်းတွက်ချက်ပေးမည်" is long for a price cell; a native reviewer may prefer a shorter form.
- "ဘာသာစကားသင်တန်း" for 어학당 is generic (does not say Korean); fine in the Korea-only context.

## Counts
Job keys 158 · kept verbatim 0 · rewritten 0 · newly translated 158 · extra plural forms 0 (my has only other).

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
