# Uzbek (uz, Latin) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `uz`
- Status: NOT human-reviewed. `status` must not be set to `HUMAN_REVIEWED` on the basis of this record.
- Leak check (step 4): not run by this agent. The coordinator runs it.

## Scope

- Merged: `scripts/i18n/v9-data/uz-1.json` … `uz-7.json` (the full todo, 2,113 values: common 91, student 340, dossier 187,
  writing 120, success 295, visaroute 484, concierge 468, mobile 59), `uz-8.json` (5 revisions from this review),
  `uz-9.json` (4 STATE_MAP terminology fixes to existing strings).
- Result: `v9-todo uz` → web 3645 keys, 0 missing / identical / stale. `--native` → 4153 keys, 0 missing / identical / stale.
- Orthography: the existing uz files use oʻ/gʻ (U+02BB) and the tutuq belgisi ʼ (U+02BC), as in maʼlumot. Every new value was
  normalised to the same characters, and no ASCII apostrophes remain.
- Identical to English on purpose (`_identical_ok`): PhD, CV, Sejong, Ulsan, Portfolio, Google Maps, GPA, Gimpo (GMP), Terminal,
  Server, messenger names (KakaoTalk, LINE, Telegram, WhatsApp, Zalo), city names that are spelled the same in Uzbek
  (Astana, Bangkok, Bishkek, Chengdu, Jakarta, Karachi, Lalitpur, Manila, Yangon), and placeholder-only strings.

## Sample read

All todo keys were read by namespace in screen order:

- The money screens (`student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`) and the family/sponsor pages
  (`v9.family.*`, `v9.sponsor.*`), mainly as readers C and D.
- The visa route (`visaroute:*`: caveats, conditions, document names and reasons, the form, tracking, embassy posts and methods).
- Documents (`dossier:*`), writing review (`writing:*`), the application plan and submission (`success:*`).
- Arrival (`concierge:*`: pickup, housing, lease check, residence card, emergency numbers) and the native app (`mobile:*`).
- The existing verdict strings (`student:verdict.*`, `student:discover.verdict.*`, `scholarships.group.*`, `matches.tierText.*`),
  checked against docs/STATE_MAP.md.

No screenshots were taken, because browsers are off for translator agents.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 4 / 4 / 5 / 5 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 5 / 4 / 4 / 4 / 5 | 5 / 4 / 5 / 4 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 3 / 4 / 4 | 5 / 4 / 5 / 5 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 3 / 3 / 4 / 4 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Why some first scores were below 4:

- C and D gave trust a 3. Two existing verdict strings were mislabelled: *Possible match* was shown as *Strong match*, and
  *Not eligible yet* was shown as *Possible match*. This overstates the result to the person who pays.
- D gave naturalness a 3. A few strings were literal calques: the "consulting" university tier, "u {{name}} da", "Insondan so'rash"
  and "Uchrashuv bo'lmadi".

## Issues found and fixed

| Key | Before → After | Why |
|---|---|---|
| `student:verdict.COMPETITIVE` | Kuchli moslik → Ehtimoliy moslik | It used the *Strong match* wording for *Possible match*, which breaks STATE_MAP. |
| `student:verdict.REACH` | Ehtimoliy moslik → Hali talabga mos emas | The English is "Not eligible yet". |
| `student:scholarships.group.NOT_ELIGIBLE`, `matches.tierText.NOT_ELIGIBLE` | Hozircha mos emas → Hali talabga mos emas | Now uses the same term as every other *Not eligible yet* string. |
| `student:v9.funds.longer_*` | quyi (“maslahat beriladigan”) toifa → quyi (“konsalting”) toifa | "Maslahat" collides with *maslahatchi* (counselor). "Konsalting" is the name the tier is known by. |
| `writing:sl.LATE` | … — u {{name}} da. → … — hozir uni {{name}} ko'rib chiqmoqda. | The old wording was a calque and unclear. |
| `visaroute:help.ask` | Insondan so'rash → Xodimdan so'rash | "Inson" (human being) read oddly. "Xodim" (staff member) is plain. |
| `concierge:status.AIRPORT_PICKUP.NO_SHOW` | Uchrashuv bo'lmadi → Kutib olish amalga oshmadi | It now names the service, so it doesn't sound like a missed meeting. |

## Terminology (reused from existing uz strings)

| English | Uzbek |
|---|---|
| Strong match | Kuchli moslik |
| Possible match | Ehtimoliy moslik |
| Not eligible yet (incl. one step away) | Hali talabga mos emas |
| Needs your grades | Baholaringiz kerak |
| Your counselor | Maslahatchingiz |
| Tuition | Oʻqish toʻlovi |
| Admission letter / certificate | (Standart) qabul xati |
| Residence card | Chet ellik roʻyxat kartasi (short: roʻyxat kartasi) |
| Immigration office | Immigratsiya idorasi |
| Embassy / consulate / post | Elchixona / konsullik / vakolatxona |
| Family relationship certificate | Qarindoshlik haqida maʼlumotnoma |
| Bank balance certificate / statement | Bank hisobidagi qoldiq haqida maʼlumotnoma / bank koʻchirmasi |
| TB certificate | Sil (TB) tekshiruvi haqida maʼlumotnoma |
| Transcript | Baholar vedomosti (transkript) |
| Apostille / consular legalization | Apostil / konsullik legalizatsiyasi |
| Dormitory / deposit | Yotoqxona / depozit |
| Sponsor | Homiy |
| Refund | (Pulni) qaytarish |
| Application statuses | identical to `common:appStatus.*` |

Kept in Latin script as is: Hangyul, TOPIK, KIIP, IELTS, TOEFL iBT, GPA, NHIS, HiKorea, T-money, VFS Global, visa.go.kr, g4k.go.kr,
e-Form, D-2/D-4 codes, CHSI / CDGDC.

## Money / visa / legal precision checks

- `v9.funds.title`: "Koʻrsatishingiz kerak boʻlgan pul (toʻlanmaydi)". The strings say plainly that the money is not paid to
  anyone and must really be the student's or the family's.
- `v9.funds.genuine`: depositing money only to get a certificate is translated as "Koreya qonunlariga zid" (against Korean law).
  The wording is not softened.
- `v9.guard.text` and `v9.refund.*`: pay the university directly, in the student's name. Refunds go only to the student's own
  account. The warning about money changers and agents is kept in full.
- `v9.announced.*` and `v9.visa.caveat.SCHEDULED_CHANGE` say "hali kuchga kirmagan" (not yet in force). The rule texts are
  written as planned effects, not as rules that already apply.
- `v9.routes.notOffer`: "Bu taklif ham, bashorat ham emas — qarorni universitetlar qabul qiladi" (not an offer and not a
  prediction; universities decide). No reassurance was added.
- `success:submission.*`: "ruxsat berish" (authorize) and "qaytarib olish" (withdraw) are used consistently. The "never share
  your portal password" warnings are kept word for word.

## Residual risks (for a native human reviewer)

1. Placeholders followed by a separate suffix ("{{label}} ni", "{{date}} da", "{{university}} ga") follow the existing uz files.
   They read correctly but mechanically. Check the screens with the most of them (the dashboard next actions and the dossier).
2. City names (Pekin, Guanchjou, Xoshimin, Tsindao, Dalyan, Shenyan, Uxan, Sian, Ulan-Bator) use the common Uzbek forms. Confirm
   them against the forms the Uzbek MFA or embassy uses.
3. The "consulting" and "excellent" tier names ("konsalting", "aʼlo") need checking against how Uzbek agencies describe
   Korea's university certification.
4. `v9.routes.korean.count_*` has no number in the string ("ta til dasturi …"), because the UI shows the number before it. Check it
   on screen.
5. Older uz strings still mix "motivatsion xat" and "shaxsiy bayonot" for the personal statement, and "yashash guvohnomasi" and
   "roʻyxat kartasi" for the residence card (`student:servicesV3.taskHint.arrival`). Pick one term for each.
6. The leak check and screen-level reading have not run yet (coordinator step 4).
