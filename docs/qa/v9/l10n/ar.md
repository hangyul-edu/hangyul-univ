# Arabic (ar) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `ar`
- Status: NOT human-reviewed. Do not set `status` to `HUMAN_REVIEWED` on the basis of this record.
- Leak check (step 4): not run by this agent. The coordinator runs it.
- Register: Modern Standard Arabic, polite second person (masculine generic, as in the existing ar strings). Short buttons use
  imperatives (ارفع، أرسل، اطّلع). RTL marks were added by `v9-merge.mjs` (rtl-mark).
- Plurals: all six CLDR forms (zero/one/two/few/many/other) are written for every plural family, with the dual and the
  counted-noun agreement (3–10 plural genitive, 11–99 singular accusative, 100+ singular genitive).

## Scope

- Merged: `scripts/i18n/v9-data/ar-1.json` … `ar-12.json` (2,290 todo keys: common 91, student 479, dossier 215, writing 132,
  success 323, visaroute 484, concierge 500, mobile 67) and `ar-13.json` (3 keys added by other agents during the run, plus
  13 revisions from this review).
- New namespace files: `ar/dossier.json`, `writing.json`, `success.json`, `visaroute.json`, `concierge.json`.
- Result: `v9-todo ar` → web 4,008 keys, 0 missing, 0 identical, 0 stale. `--native` → 4,572 keys, 0 missing.
- Values that stay Latin are only allowed tokens: placeholders, `$t()` nesting, the brand (Hangyul, Hangyul Univ), app names
  (KakaoTalk, LINE, WhatsApp, Telegram, Zalo), tests (TOPIK, IELTS, TOEFL iBT, KIIP), NHIS, HiKorea, T-money, visa.go.kr,
  g4k.go.kr, VFS Global, CHSI/CDGDC, NRC, Aadhaar, OECD, airport codes, visa codes (D-2, D-4-1). No `_identical_ok` entries.
- The four previously identical keys are now translated: the three service plan names (دعم التقديم، الاستكشاف المجاني،
  النجاح المميّز) and `university.campus.google` (خرائط Google).

## STATE_MAP bug fixed (existing strings)

The existing Arabic verdict labels did not match docs/STATE_MAP.md:

| Key | English | Before | After |
|---|---|---|---|
| `student:verdict.COMPETITIVE` | Possible match | مطابقة قوية (= Strong match) | مطابقة ممكنة |
| `student:verdict.REACH` | Not eligible yet | مطابقة ممكنة (= Possible match) | غير مؤهل بعد |
| `student:start.tier.POSSIBLE` | One step away | مطابقة ممكنة | على بُعد خطوة واحدة |
| `mobile:v3.quick.tier.POSSIBLE` | One step away | توافق محتمل | على بُعد خطوة واحدة |
| `mobile:v3.match.strong` / `.possible` / `.notYet`, `v3.quick.tier.STRONG` / `.NOT_YET` | Strong match / Possible match / Not eligible yet | توافق قوي / توافق محتمل / غير مؤهَّل بعد | مطابقة قوية / مطابقة ممكنة / غير مؤهل بعد (one term across web and app) |

A REACH program was shown to Arabic students as a "possible match" and a COMPETITIVE one as a "strong match". Both labels
overstated the verdict.

## Sample read

I read every todo key with its screen in mind. I spent the most time on:

- Money and payment safety: `student:v9.money.*`, `v9.funds.*` (money you show vs. money you pay, whose name the account is in,
  how long it is held), `v9.guard.*`, `v9.refund.*`, `success:submission.fee.*`, `student:v4.offer.*`. Parents (C and D) read these screens.
- Family link and sponsor page: `student:v9.family.*`, `v9.sponsor.*`.
- Visa route (`visaroute:*`): methods, caveats, document names, time-limited papers, posts (السفارة/القنصلية الكورية في …).
- Legalization: `student:legalFlow.*`, `dossier:*` (أبوستيل vs. تصديق قنصلي, التوثيق لدى كاتب العدل, ترجمة معتمدة).
- Submission authorization: `success:submission.authorize.*` (who submits, consent, withdrawal, never sharing a portal password).
- Arrival: `concierge:*` (residence card 90-day rule, NHIS, lease-check disclaimer, emergency numbers 119 and 112).
- Verdict strings (`student:verdict.*`, `start.tier.*`, `success:group.*`, `mobile:v3.match.*`, `v3.quick.tier.*`), checked against
  docs/STATE_MAP.md and `student:discover.verdict.*`.

I took no screenshots, because browsers are off for translator agents. The coordinator's leak-check run is the screen-level check.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 4 / 4 / 4 / 5 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 5 / 4 / 3 / 5 / 5 | 5 / 4 / 5 / 5 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 3 / 3 / 5 | 5 / 4 / 5 / 4 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 4 / 4 / 3 / 5 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Scores below 4 before revisions:
- B and C, trust 3: the verdict labels above (COMPETITIVE shown as "strong match", REACH as "possible match"). This overstates
  eligibility, which is the one thing STATE_MAP forbids.
- C, action clarity 3: payment deadlines used «قبل {{date}}» ("before the date"). For "by {{date}}" a parent can read this as
  "the day before is the last day". Money and embassy deadlines now say «في موعد أقصاه {{date}}» (no later than).
- D, action clarity 3: the short status «بانتظار» ("waiting for…") stood alone with no object, and «الموعد: {{date}}» did not say
  it was a deadline.

## Issues found and fixed (`ar-1.json`, `ar-13.json`)

| Key | Before → After | Why |
|---|---|---|
| `student:verdict.COMPETITIVE`, `verdict.REACH`, `start.tier.POSSIBLE`, `mobile:v3.match.*`, `v3.quick.tier.*` | see table above | STATE_MAP meanings; one term (مطابقة) across web and app |
| `student:v4.offer.pay`, `v4.offer.ifNothing`, `success:item.SCHOLARSHIP_APPLY.title`, `concierge:residence.due`, `visaroute:home.embassy_request`, `help.issue.EMBASSY_REQUEST.needed` | قبل {{date}} → في موعد أقصاه {{date}} | "by" includes the date itself. Money and legal deadlines must be exact |
| `student:v4.ws.due`, `visaroute:track.requestDueOn` | الموعد: {{date}} → آخر موعد: {{date}} | Says it is a deadline |
| `visaroute:track.requestDue` | قبل أي تاريخ؟ → ما آخر موعد؟ | Same |
| `student:v4.ws.state.waiting`, `writing:gate.studentState.WAITING` | بانتظار → قيد الانتظار | «بانتظار» needs an object. It read as an unfinished label |
| `concierge:housing.perMonth` | /شهريًا → /شهر | "₩500,000/شهريًا" is ungrammatical |
| `visaroute:form.section.school` | جامعتك في كوريا → جهة دراستك في كوريا | Language-programme (D-4) students are at an institute, not always a university |
| `student:services.*.name`, `university.campus.google` | English → Arabic | Were identical to English (Latin text on an Arabic screen) |

## Terminology (reused from existing ar strings)

| English | ar |
|---|---|
| Strong match | مطابقة قوية |
| Possible match | مطابقة ممكنة |
| Not eligible yet (one step away) | غير مؤهل بعد (على بُعد خطوة واحدة) |
| Needs your grades | نحتاج درجاتك |
| Your counselor | مستشارك |
| Offer / accept the offer | عرض قبول / قبول العرض |
| (Standard) admission letter | خطاب القبول (الرسمي) |
| Tuition / application fee | الرسوم الدراسية / رسوم التقديم |
| Apostille / consular legalization | أبوستيل / تصديق قنصلي |
| Notarization / certified translation | التوثيق لدى كاتب العدل / ترجمة معتمدة |
| Bank balance certificate / bank statement | شهادة الرصيد البنكي / كشف الحساب البنكي |
| Family relationship certificate | شهادة القرابة العائلية |
| Residence card | بطاقة الإقامة |
| Immigration office | مكتب الهجرة |
| Visa issuance certificate (CCVI) | شهادة إصدار التأشيرة |
| e-visa | تأشيرة إلكترونية |
| Sponsor | الكفيل |
| Agency | وكالة |
| Post (embassy/consulate) | بعثة |
| Personal statement / study plan | البيان الشخصي / خطة الدراسة |
| Waitlisted | على قائمة الانتظار |
| Deposit (housing) | التأمين |
| TB certificate | شهادة فحص السل (TB) |
| Dormitory | السكن الجامعي |
| Writing (tab) | الكتابة |

## Residual risks (what a native human reviewer should check first)

1. **«الكفيل» for sponsor.** It is the existing ar term (`docCategory.SPONSOR_DOCUMENT`). In Gulf countries «كفيل» also means a
   labour-visa sponsor. A Gulf reader may read it that way. Consider «الجهة الممولة» / «المتكفّل بالنفقات».
2. **Korean administrative terms**: شهادة إصدار التأشيرة (CCVI), the university certification tiers «ممتازة» / «معتمدة» /
   «الاستشارية», شهادة السجل التجاري للجامعة, and the group residence-card filing. Check them against the Arabic pages of
   Korean embassies in Arab countries, if any exist.
3. **Money sentences**: `v9.funds.*`, `v9.money.note.NHIS_*`, `v9.guard.text`, `v9.refund.*`. I checked each one against the
   English. A parent reviewer should still confirm none of them can be misread.
4. **Gender**: the counselor and the student are addressed in the masculine generic, as in the existing ar strings. Universities
   and agencies take feminine verbs (طلبت {{university}}). This is correct only when the placeholder is a university/agency name.
   Female students see masculine forms. That is a product choice, not something the translation can fix.
5. **Plural agreement with placeholders**: a few strings use «{{count}} من …» (e.g. `success:obs.COMPARE_OFFERS`, `dossier:home.checkDetails`) to avoid
   number-noun agreement when a family is not plural in English. Read naturally, but a native reviewer should spot-check.
6. **Pre-existing ar strings outside the todo** (not re-read in full): `marketing:*.STRONG` still says «توافق قوي» (website only),
   and `mobile:v3.match.close` keeps «غير مؤهَّل بعد — لكنك قريب».
