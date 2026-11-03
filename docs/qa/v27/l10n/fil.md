# V27 localization review: fil (Filipino)

Scope: all 729 strings in `scripts/i18n/v27/strings.json` (215 `new`, 514 `changed`; `changed` strings were translated again from the V27 English, not patched from the bundle).
Output: `scripts/i18n/v27/tx/fil.json`.
Register: conversational Taglish with *ka / mo*, which is how Philippine apps, schools and study-abroad agencies write to students. Filipino carries the grammar and tone, and English is kept for the words Philippine higher education and banks actually use (*tuition*, *transcript*, *deadline*, *requirements*, *application form*, *bank certificate*, *apostille*). Established bundle terms kept: *Team Hangyul*, *Apostille Convention*, *e-visa*, *proof of funds*, *checklist*, *Mga dokumento* (the Documents section). Bundle terms changed: *kumpirmasyon ng konsulado* → **consular legalization** (영사확인 is a legalization, and Filipinos know the term from DFA and consular authentication), *tagapayo* → *counselor* (the word Filipino students use for agency or school counselors), *Aking paglalakbay* → *Aking progreso* (V27 English "My progress"), *liham ng pagtanggap* → *certificate of admission / admission letter*.

## Personas

1. **Andrea, 18, Quezon City.** Senior high graduate (STEM strand). She wants a Korean language institute year (D-4-1) and then a bachelor's. Mobile-first, writes in Taglish.
2. **Paolo, 26, Cebu.** IT professional applying for an English-taught master's. Wants exact requirements and to know whether he applies in Manila or Cebu.
3. **Tita Marites, 52, Andrea's mother, OFW in Dubai.** Sends the tuition and the show money. She is very alert to scams, agents asking for money and "guaranteed" promises.

## Glossary

| English | Korean | fil rendering |
|---|---|---|
| scholarship | 장학(금) | scholarship |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS) in running text; category label *Scholarship ng gobyerno ng Korea (GKS)* |
| admission guide | 모집요강 | admission guide |
| apostille | 아포스티유 | apostille (*magpa-apostille*); Apostille Convention |
| consular legalization | 영사확인 | consular legalization |
| notarized | 공증 | notaryado / *ipa-notaryo* |
| Korean language institute | 어학당 | Korean language institute (ng unibersidad) |
| certificate of admission | 표준입학허가서 | certificate of admission / standard admission letter |
| CCVI | 사증발급인정서 | Certificate of Confirmation of Visa Issuance (CCVI) |
| e-visa | 전자비자 | e-visa |
| residence card | 외국인등록증 | residence card |
| immigration office | 출입국관리사무소 | immigration office |
| proof of funds / bank balance certificate | 재정 증빙 / 잔고증명서 | proof of funds / bank certificate |
| tuition / application fee | 등록금 / 전형료 | tuition / application fee |
| counselor / Hangyul team | 상담사 / 한귤 상담팀 | counselor / Team Hangyul |
| meets the requirement | 충족 | *pasok ka sa* … requirement |
| eligible | 자격 | kwalipikado |
| offer | 합격 | offer |
| Recommended (sort) | 추천순 | Inirerekomenda (`fit.order` says it is *hindi ranking*) |
| embassy / consulate | 대사관 / 영사관 | embassy / consulate |
| documents store | 서류함 | Mga dokumento (section name from the bundle) |

## Pass A: meaning (4 strings changed)

- `marketing:v6.product.match.r2`: *(minimum: level 3 lang)* → *(ang minimum ay level 3)*. The draft added "only", which is not in the source. The plain English form fails the left-in-English check.
- `common:uni27.schol.living`: *allowance sa gastusin* → *allowance para sa gastusin sa pamumuhay*. "Gastusin" alone could mean any expense; this is a living allowance.
- `common:task.reviseEssay`: *Ayusin* → *I-revise*. *Ayusin* reads as "fix/repair", but the source means a revision of a draft.
- `student:budget.scholarshipAlternative`: *Alternatibo, hindi idinadagdag.* → *Alternatibo ito, hindi idinadagdag sa iba.* Makes clear it is not added on top of the other scholarships.

## Pass B: native naturalness (8 strings changed)

Each string was read as Andrea, Paolo and Tita Marites.
- `marketing:v20.city.Chungnam.body`: *upang pang-probinsya* → *renta na pang-probinsya*. *Upang* reads as "in order to", a real misreading.
- `marketing:v20.city.Gangwon.line`: rebuilt as *ang probinsyang pinakakaunti ang tao at pinakamaganda ang tanawin*. The draft followed English word order.
- `common:fit.family.KOREAN/ENGLISH`: *Korean test* → *Test sa Korean* / *Test sa English*. These read as Taglish, not as English left untranslated.
- `student:documentsV2.group.todoSub`: *humaharang sa isang aplikasyon* → *pumipigil sa pag-usad ng isang aplikasyon*.
- `mobile:university.funnelNote.PREPARING`: *pagkakakilanlan* → *pangalan ng estudyante*. The deep-Tagalog word sounded bookish.

## Pass C: UI context and brevity (6 strings changed)

- `common:uni27.cat.GKS`: was identical to the English and rejected by the validator → *Scholarship ng gobyerno ng Korea (GKS)* as a category label (it sits beside *Scholarship ng unibersidad* etc.). Running text keeps the official name.
- `common:fit.testLabel.KOREAN/ENGLISH`: → *Uri ng Korean test / Uri ng English test*. The select label now differs from the family chip, like the Korean 시험 종류.
- `common:uni27.link.kli`: → *Korean language institute ng unibersidad*.
- `common:uni27.intl.eyebrow`: → *Para sa international students*.
- `common:fit.gpa.scale`: *Sa scale na* → *Scale ng grado*. A field label, not a sentence fragment.

## Final: source ↔ target comparison (3 strings changed)

The whole set was compared with the English and Korean for meaning, numbers, test and code names, placeholders/tags and the no-guarantee / no-ranking rule (a script also checked numbers and Latin test/code names).
- `dossier:upload.sendText`, `visaroute:reason.VISA_ONLY`, `visaroute:docs.readyCount`: *mga dokumento mo* → *(seksyong) Mga dokumento*. They now point to the documents section by its bundle name, so they do not just say "your documents".

The `{{track}}` reason strings use *{{track}}: …*. No string implies admission probability or a guarantee (*tsansa* appears only in "we never invent a chance"). All placeholders and the `<em>` tag are preserved. The Hangul 대학알리미 in the English `v20.uni.why.breadthBody` was dropped, keeping *Academy Info* (no Hangul outside ko).
About 40 short labels stay identical to the English on purpose: test names, degree names (*Bachelor's*, *Master's*), *Application form*, *Portfolio*, *Orientation*, *Consular legalization*, *Flight booking*. This is standard Philippine usage, and all of them are ≤ 3 words, so the validator accepts them.
Validator: `node scripts/i18n/v27/validate.mjs --only=fil` reports 729 strings valid, 0 problems.

## Unsure

- The amount of English in Taglish is a judgement call. A more formal Filipino style (closer to the old bundle: *tagapayo*, *matrikula*) may be preferred for parents. The more conversational style was chosen for students.
- `uni27.cat.GKS`: there is no established Filipino name. Filipinos say "GKS" or the older "KGSP". The label *Scholarship ng gobyerno ng Korea (GKS)* was used only because the exact English is rejected.
- `v9.funds.longer_*` / `waived`: the tier names 'consulting' / 'excellent' were kept in English, as the Korean government's own English labels.
- `fit.level.ASSOCIATE` *Associate degree*: Philippine 2-year programmes are also called associate degrees, but they are not identical to 전문학사.
- `visaroute:caveat.APOSTILLE_TRANSITION` *11 Set 2026*: Filipino month abbreviation. English-format dates (*Sep 11, 2026*) are equally common in the Philippines.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Walang hinihinging language score para mag-apply. Kakailanganin mo ang {{tests}} o mas mataas pagkatapos matanggap.
- `fit.reason.far` → Kailangan ng {{options}} o mas mataas, malayo pa sa kasalukuyan mong score.
- `fit.tier.UNCLEAR.title` → Malayo pa sa ngayon
- `fit.tier.UNCLEAR.short` → Maghanda pa
- `fit.tier.UNCLEAR.lede` → Malayo pa ang kasalukuyan mong score sa inilathalang requirement. Maglaan ng mas mahabang panahon sa paghahanda, saka tingnan ulit.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
