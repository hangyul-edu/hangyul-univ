# V31 native-quality review — Uzbek (uz, Latin script)

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`

Job: `scripts/i18n/v28/jobs-v31/uz.json` · Output: `scripts/i18n/v28/tx-v31/uz.json` · Glossary: `docs/qa/v31/l10n/glossary/uz.json` · Brief: `docs/qa/v31/l10n/BRIEF.md`
Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=uz` → `V28 l10n (1 locales): 1729 strings valid, 0 problems`

## Counts

| | keys |
|---|---|
| Reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,410 |
| Rewritten | 319 |
| — new source (`v31`) | 202 (the other ~40 `v31` keys already said what the new source says and were kept) |
| — terminology | 55 (includes ~16 keys whose only change was the apostrophe characters) |
| — naturalness | 48 |
| — quality (UI role / tone / format) | 8 |
| — meaning (non-`v31` keys) | 6 |

Uzbek has CLDR plural categories `one`/`other` only; no extra forms were added. The two keys with a null `current`
(`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`) were translated.

## Orthography and register

- Modern standard Uzbek Latin. `oʻ`/`gʻ` always use U+02BB (ʻ); the tutuq belgisi (maʼlumot, eʼlon, taʼlim) always uses
  U+02BC (ʼ). The existing translation mixed ASCII `'`, U+2018/U+2019 and the correct characters (≈110 strings with ASCII
  apostrophes, mostly owner `v11.*` copy); every string now uses the two correct characters only. No English possessives
  (e.g. "GPA’ingiz" → "GPA balingiz").
- Polite *siz* register throughout; buttons are short verbs, labels are nouns.

## Terminology decisions (applied in every key)

- Plan = **tarif**; plan names Basic / All-in-One / Premium in Latin; brand Hangyul / Hangyul Univ; "the Hangyul team" = **Hangyul jamoasi** (not "Hangyul Univ jamoasi", which is kept only where the source itself says "Hangyul Univ team").
- Support window = **maslahatdan keyin savol berish muddati** (never "maslahat davri").
- Managed applications = **siz bilan birga olib boradigan arizalarimiz** (never "biz boshqaradigan arizalar" / "boshqariladigan arizalar"); recommended = **tavsiya etilgan**; the two are never merged.
- Personal statement = **motivatsion xat** (not the literal "shaxsiy bayonot"); study plan = **oʻqish rejasi** (never "oʻquv rejasi", which means a curriculum).
- Document review = **hujjatlarni koʻrib chiqish** (≠ preparing); editing = **tahrirlash** (≠ writing for the student).
- Apostille = **apostil**; consular legalization = **konsullik legallashtiruvi** (never bare "legalizatsiya"); notarization = **notarial tasdiqlash**; transcript = **baholar qaydnomasi (transkript)**.
- Korean language institute = **universitet qoshidagi koreys tili markazi** (never "til maktabi").
- Admission offer = **qabul qarori / qabul qilish toʻgʻrisidagi qaror** (not "Taklif").
- Visa help = **viza hujjatlarini tayyorlashda yordam**; the decision stays with the immigration authorities.
- Airport pickup = **hamkor orqali aeroportda kutib olish**.
- Premium "no limit" always carries **shartnomangizdagi ariza hujjatlari va jadval doirasida**.
- Residence (alien registration) card = **chet ellik roʻyxat kartasi (ARC)**.

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:appStatus.VISA_PREPARATION` | Viza tayyorlanmoqda (the visa itself is being prepared/issued) | Vizaga tayyorgarlik |
| 2 | `common:v29.pricing.compare.row.support` | Maslahat davri (consultation period, support window confused with sessions) | Maslahatdan keyin savol berish muddati |
| 3 | `common:v29.pricing.compare.row.managed` | Biz boshqaradigan arizalar (Hangyul manages/owns the applications) | Siz bilan birga olib boradigan arizalarimiz |
| 4 | `common:v29.pricing.compare.scopeNote` | omitted that new documents, translation and notarization are not included | exclusion added in full |
| 5 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` | Hujjatlarni tayyorlash (Hangyul prepares the visa documents) | Viza hujjatlarini tayyorlashda yordam |
| 6 | `common:v29.pricing.all_in_one.f5` | Viza hujjatlarini tayyorlash (Hangyul prepares visa documents) | Viza hujjatlarini tayyorlashda yordam |
| 7 | `common:v29.addon.item.airport_pickup` | Aeroportda kutib olishni tashkil qilish (no partner; reads as Hangyul runs transport) | Hamkor orqali aeroportda kutib olish |
| 8 | `common:v29.pricing.compare.value.documents.INTENSIVE` | Chuqur tekshirish (notes on what to fix missing) | Chuqur koʻrib chiqish va nimani tuzatish kerakligi boʻyicha izohlar |
| 9 | `common:fit.test.UNIV_KLI` | Universitet koreys tili kursi (lost 'completed', reads as a course, not a qualification) | Universitet koreys tili kursini tamomlaganman |
| 10 | `common:v29.pricing.premium.position` | Viza, kelish va Koreyadagi ilk haftalarda ham yordam (application stage omitted) | Ariza topshirishdan tortib viza, kelish va Koreyadagi ilk haftalargacha |
| 11 | `common:v29.pricing.premium.f4` | Viza muddatlarini yaqindan boshqarish (visa documents dropped; 'boshqarish' = Hangyul runs the visa) | Viza hujjatlari va muhim sanalar yaqindan nazoratda |
| 12 | `concierge:moveIn.item.address_report.text` | 15 days counted from getting the residence card | 15 days counted from the move |
| 13 | `common:v29.pricing.all_in_one.f2` | 2 tagacha universitet arizasini boshqarish (Hangyul manages/submits) | 2 tagacha universitetga arizani siz bilan birga olib boramiz |
| 14 | `concierge:status.DORMITORY.ASSIGNED` | Xona taklif qilindi (room offered, not assigned) | Xona ajratildi |
| 15 | `dossier:group.extraCount` | Yana {{count}} tasi keyinroq uchun saqlangan (a statement 'saved for later', not a show-more button for stored documents) | Yana {{count}} ta saqlangan hujjatni koʻrsatish |
| 16 | `dossier:page.summary` | adds 'barcha arizalar uchun' (ready for all applications), not in source | {{total}} tadan {{ready}} tasi tayyor |
| 17 | `success:group.possible` | Mos kelishi mumkin (lost 'meets requirements' and 'needs checking') | Talablarga javob beradi, tekshirish kerak |
| 18 | `dossier:package.line` | {{total}} ta talab (total requirements, not documents needed) | {{total}} ta hujjat kerak |
| 19 | `visaroute:step.slow_items.why` | Legalizatsiya... (apostille omitted, bare 'legalizatsiya') | Apostil yoki konsullik legallashtiruvi... |
| 20 | `visaroute:help.ask` | Xodimdan soʻrash (an anonymous staff member, not the Hangyul team) | Hangyul jamoasidan soʻrash |
| 21 | `marketing:v11.why.s3.text` | Hangyul ... talabalik hayotingiz muvaffaqiyatli oʻtishiga koʻmaklashadi; 'toʻlaganingizga arziydigan, mutlaqo boshqacha yordam' (Korean source guaranteed a successful study life) | Adolatli narxda puxta, amaliy yordam; tarifga nimalar kirishini toʻlovdan oldin aniq koʻrasiz. Kafolat yoʻq |
| 22 | `marketing:v11.why.s3.title` | Eng oqilona narx, eng yaxshi natija (unverifiable superlative + promised result) | Adolatli narx, kutilmagan xarajatlarsiz |
| 23 | `marketing:v11.services.s1.text` | toʻliq mos ... hujjat tayyorlashdan universitet bilan yozishmalargacha butun jarayonni oʻz zimmamizga olamiz (Hangyul takes over the whole process, 'til markazlari') | mos universitetlar va koreys tili markazlarini tavsiya qilamiz ... hujjatlarni tayyorlash va universitet bilan muloqotda yordam beramiz |
| 24 | `marketing:v11.why.s1.text` | har bir bosqich uchun biz javob beramiz ... muvaffaqiyat yoʻlidagi hamrohingiz (responsibility for outcome, implied success) | har bir bosqichda yordam beramiz; boshidan oxirigacha bitta jamoa |
| 25 | `marketing:v11.why.s1.title` | Birinchi qadamdan muvaffaqiyatgacha toʻliq yordam | Har bir bosqichda yordam, boshidan oxirigacha |
| 26 | `marketing:v11.why.s2.text` | oʻquv rejasi bilan ... eng yaxshi yoʻl; Hangyul imkoniyatlaringizni toʻliq ochadi | rejangizni baholaringiz, maqsadlaringiz va byudjetingizdan kelib chiqib tuzamiz; tavsiyalar siz uchun real |
| 27 | `marketing:v11.why.s2.title` | 100% shaxsiy strategiya, faqat siz uchun | Aynan sizga moslangan reja |
| 28 | `marketing:v11.faq.q6.a` | Universitetlarning har biri chet ellik talabalar uchun stipendiya taklif qiladi (every university) | Aksariyat universitetlar beradi, lekin miqdori va shartlari turlicha |
| 29 | `marketing:v11.services.s2.text` | Viza olish ... kerakli hamma narsani birga bajaramiz (reads as Hangyul obtaining the visa and doing everything) | viza arizasi, xorijlik guvohnomasi va darslarga yozilish bosqichlarida yordam beramiz |
| 30 | `marketing:v11.services.s2.title` | Qabul qilingandan keyin ham xotirjam (Korean '완벽 지원' perfect support implied) | Qabul qarori olingandan keyin: joylashib olguningizcha yordam |
| 31 | `marketing:v11.faq.q8.a` | Xavotir olmang! ... bemalol murojaat qiling; 'oʻrta maktab yoki kollej diplomi' as only requirement framed as reassurance | aksariyatida yosh chegarasi yoʻq, ayrimlarida bor; mos universitetlarni tavsiya qila olamiz; tamomlaganlik haqidagi hujjat kerak |
| 32 | `marketing:v11.hero.lede` | Orzuingizni haqiqatga aylantiramiz (promise to make dreams come true) | Mos universitetni toping va har bir bosqichni yoningizdagi jamoa bilan bosib oʻting |
| 33 | `marketing:v20.city.Gyeonggi.line` | arzonroq, koʻkalamzorroq (roomier rendered as greener) | arzonroq, kengroq |
| 34 | `marketing:v20.city.Gyeonggi.body` | second paragraph said campuses have their own dormitories instead of a street of rentals; dropped that more students live in dormitories | shuning uchun koʻproq talabalar ... universitet yotoqxonalarida yashaydi |
| 35 | `marketing:v12.terms.services.documents` | Ariza hujjatlarini tayyorlash va koʻrib chiqish (Hangyul prepares the documents) | Ariza hujjatlarini tayyorlashda yordam va hujjatlarni koʻrib chiqish |
| 36 | `marketing:v12.terms.services.writing` | Shaxsiy esse va oʻquv rejalarini koʻrib chiqish (editing shown as review; study plan as curriculum) | Motivatsion xat va oʻqish rejalarini tahrirlash |
| 37 | `marketing:v12.terms.universityInfo.p` | contained Hangul '대학알리미' and 'muayyan aʼzo' phrasing | Koreya universitetlarining rasmiy maʼlumotlarni oshkor qilish xizmati (Academy Info) |
| 38 | `marketing:v12.privacy.retention.contract.record` | Shartnomalar va obunadan voz kechish yozuvlari (subscription opt-out) | Shartnomalar va buyurtmani bekor qilishga oid yozuvlar |
| 39 | `marketing:v12.privacy.collect.verification.purpose` | avtomatik roʻyxatdan oʻtishning oldini olish (automated, not fraudulent) | firibgarlik bilan roʻyxatdan oʻtishning oldini olish |
| 40 | `marketing:v12.privacy.collect.profile.purpose` | oʻquv rejasini tayyorlash (preparing a curriculum) | xorijda oʻqishingizni rejalashtirish |
| 41 | `marketing:v20.uni.intl.admissionsLine` | Xalqaro qabul mahalliy qabuldan alohida sahifada yuritiladi (a separate page, not a separate track) | Chet ellik talabalar uchun alohida qabul tartibi bor |
| 42 | `marketing:v15.pricing.compare.item` | Bandlar (English source intentionally empty) | (empty) |
| 43 | `marketing:v11.faq.q4.q` | Koreys tilini bilmasam ham tayyorlana olamanmi? (prepare, not apply) | Koreys tilini bilmasam ham hujjat topshira olamanmi? |
| 44 | `student:discover.verdict.reach` | Ehtimoliy moslik — "Ehtimoliy moslik" hid that requirements are met and must be verified | Talablarga mos, tekshirish kerak |
| 45 | `student:register.privacyNote` | Hujjatlaringiz va shaxsiy maʼlumotlaringiz faqat siz tanlagan maslahatchi va universitetlar bilan ulashiladi. Maʼlumotlaringizni istalgan vaqtda eksport qilishingiz yoki oʻchirishingiz mumkin. — "only the counsellor you chose and universities" — omitted the Hangyul team partner agency that also receives data | Hujjatlaringiz va shaxsiy maʼlumotlaringiz faqat sizga yordam beradigan Hangyul jamoasi (uning hamkor agentligi bilan birga) va siz tanlagan universitetlar bilan ulashiladi. Maʼlumotlaringizni istalgan vaqtda eksport qilishingiz yoki oʻchirishingiz mumkin. |
| 46 | `student:phase.prepare.text` | Hujjatlarni yigʻing, tekshirtiring va Hangyul Univ jamoasi bilan motivatsion xat va oʻquv rejangizni yozing. — "write your statement with the Hangyul Univ team" — reads as co-writing (editing != writing); "oʻquv rejasi" = curriculum | Hujjatlaringizni yigʻib, tekshirtiring, soʻng Hangyul jamoasining izohlarini hisobga olib motivatsion xat va oʻqish rejangizni yozing. |
| 47 | `student:v15.services.allowance.unlimited` | Hangyul Univ jamoasi bilan doimiy aloqa — "constant contact with the team" — unlimited without the service-term scope | Xizmat muddati davomida Hangyul jamoasiga istalgan vaqtda savol bering |
| 48 | `student:v15.services.allowance.key.max_managed_applications` | Boshqariladigan arizalar — "Boshqariladigan arizalar" — forbidden passive count label; lost "with you" | Siz bilan birga olib boradigan arizalarimiz |
| 49 | `student:v15.services.scope.consultation` | Maslahat davomiyligi — "Maslahat davomiyligi" (consultation duration) — stale V15 minutes model | Maslahat |
| 50 | `student:v4.ws.team.final` | Yakuniy tekshiruv, soʻng arizangizni {{university}} ga yuboradi — "final check, then [the team] sends your application to {{university}}" — Hangyul submitting on the student's behalf | {{university}} ga arizani oʻzingiz topshirishingizdan oldin yakuniy tekshiruv |
| 51 | `student:v4.ws.uni.waitingDetail` | Universitet hujjatlaringizni faqat ular yuborilgandan keyin koʻradi. — passive "after they are sent" — hid that the student submits | Universitet hujjatlaringizni faqat siz topshirganingizdan keyin koʻradi. |
| 52 | `student:dashboard.counselor.nextCall` | Keyingi qoʻngʻiroq: {{when}} — "Next call" instead of next consultation | Keyingi maslahat: {{when}} |
| 53 | `student:budget.beforeArrivalHint` | Birinchi semestr oʻqish toʻlovi, ariza toʻlovi, yotoqxonaning birinchi davri va birinchi oyingiz — "first period of dormitory and your first month" — dropped "fees"/"living costs"; incomplete meaning | Birinchi semestr oʻqish toʻlovi, ariza toʻlovi, birinchi semestr uchun yotoqxona haqi va birinchi oydagi yashash xarajatlari |
| 54 | `student:register.consent.CROSS_BORDER_VERIFICATION.label` | Shaxsni tasdiqlash uchun elektron pochta va mobil raqamim chet elda qayta ishlanishi haqidagi bildirishnoma bilan tanishdim — "to verify identity" — the processing is to verify email and phone, not identity | Elektron pochta va mobil raqamimni tasdiqlash uchun ular chet elda qayta ishlanishini bilaman |
| 55 | `student:v15.services.level.visa_support.DOCUMENT_PREP` | Hujjat tayyorlashda yordam — "help with document preparation" generic — now explicitly the student's documents | Hujjatlaringizni tayyorlashda yordam |
| 56 | `student:scholarshipsV3.group.ELIGIBLE` | Siz mos kelasiz — "Siz mos kelasiz" heading said "you fit" rather than "scholarships you can receive" | Siz olishingiz mumkin boʻlgan stipendiyalar |
| 57 | `student:stage.OFFERED` | Taklif olindi — "Taklif olindi" (proposal received) for an admission offer | Qabul qilish toʻgʻrisida qaror olindi |

## Marketing scorecard (after rewrite)

CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY, each /5.

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| hero (seo.home.*, v11.hero.*) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| why (v11.why.*, v29.why.*) | 5 | 5 | 4 | 5 | 4 | 4 | 27 |
| services rows (v11.services.*) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| pricing: plan cards + comparison (common v29.pricing.*) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| add-ons and purchase notes (common v29.addon.*, v31.pricing.notes.*) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| pricing: legacy comparison (marketing v15.pricing.*) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| FAQ (v11.faq.*) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| closing CTA (v11.cta.*, v13/v14 cta) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| directory/discovery (v12.directory.*, v20/v21/v23/v24.dir.*, v20.uni.*, v20.city.*) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

Before the rewrite, the why, services and FAQ areas would have scored well below 26 on TRUST and SPECIFICITY (guarantees
of success, "best price", "all universities offer scholarships", Hangyul taking over the whole process), and pricing
would have failed SEMANTIC/TRUST on the support window, managed applications and visa rows. Every area is now ≥ 26/30.
This is an internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| home | 5 | 5 | 4 | 5 | 4 | Hangyul jamoasi (not Hangyul Univ) where source says the Hangyul team; next consultation instead of next call; services-in-progress title |
| applications | 5 | 5 | 4 | 5 | 4 | final check says the student submits; university sees file after you submit; offer stages use qabul qarori; reach tier = meets requirements, needs checking |
| documents | 5 | 5 | 4 | 5 | 4 | checked (not approved) documents reused; konsullik legallashtiruvi; motivatsion xat / oʻqish rejasi; draft label trimmed |
| services | 5 | 5 | 4 | 5 | 4 | managed applications label, unlimited scoped to the service term, consultation no longer a duration, review vs preparation terms, external costs list, tarif not reja |
| visa_housing | 5 | 5 | 4 | 5 | 4 | before you apply for your visa, tuition safety notice, dormitory dates tracked (not managed), family-documents hint |

## Unresolved ambiguity (listed, not guessed)

- marketing:v12.privacy.retention.advertising.record (표시·광고, 'labeling and advertising'): rendered as 'Mahsulot haqidagi maʼlumot va reklamaga oid yozuvlar'; exact Uzbek legal equivalent of the Korean 표시 category unclear.
- marketing:v12.type.JUNIOR_COLLEGE kept as 'Kollej': in Uzbekistan 'kollej' is a secondary-vocational school, so it is the closest local level, not an exact equivalent of a Korean junior college.
- marketing:v11.faq.q1.a item 4: Korean says 'if a parent has no foreign passport', English 'no passport'; translated from the English.
- student:v9.funds.longer_other — the government rating label (컨설팅/"consulting") has no established Uzbek term; kept «konsalting» in quotes.
- student:v25.lane.you — KO is first person (내가 할 일), EN second person; followed EN with siz register.
- student:onboarding.passport/residence-card wording "chet ellik roʻyxat kartasi" kept for the Korean alien registration (residence) card; no single official Uzbek term.
- common:fit.level.ASSOCIATE — Uzbekistan has no associate degree; rendered «Kollej (2–3 yillik oliy taʼlim)» as the closest local level.
- common:fit.test.UNIV_KLI — option label phrased in first person («…tamomlaganman») because it is an answer choice in the fit form; confirm UI context.
- common:uni27.intl.gks — kept the established local name «Koreya hukumati stipendiyasi (GKS)» rather than the English programme name.
- visaroute:doc.business_registration.* — Korean 사업자등록증 rendered «davlat roʻyxatidan oʻtganlik guvohnomasi»; Uzbek has no exact equivalent of a Korean business registration certificate.
- Residence card kept as «(chet ellik) roʻyxat kartasi (ARC)», the existing term across concierge keys.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31` — not human-reviewed.
