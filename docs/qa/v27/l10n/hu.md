# V27 l10n review — Hungarian (hu)

Output: `scripts/i18n/v27/tx/hu.json`, 729 of 729 keys (common 205, student 212, mobile 58, dossier 32, visaroute 88, marketing 134).
Register: informal *te* for students and families, as in the existing `packages/i18n/locales/hu` bundle. Pages for agencies and universities (`agenciesPage.*`, `uniPage.*`) use *Önök*, as the bundle's marketing namespace does.
Brand: "Hangyul Univ" / "Hangyul", with suffixes on the brand only where unavoidable ("a Hangyulnak", "a Hangyullal"). The team is "a Hangyul csapat".
Placeholders: Hungarian case suffixes cannot attach to `{{university}}`, `{{country}}`, `{{city}}` or `{{date}}`, so those sentences use "a(z) {{x}}", "itt: {{x}}" or "{{date}} óta / Lejár: {{date}}" constructions.

## Personas

- **Lili, 18, Debrecen**: in her final gimnázium year. She wants a bachelor's in Korea, has TOPIK 2 and is unsure about the paperwork.
- **Bence, 27, Győr**: an automotive engineer. He is looking at an English-taught master's, holds IELTS Academic 6.5 and reads conditions literally.
- **Katalin, 50, Lili's mother**: she pays the tuition. She wants to know who gets paid, when, and how to avoid scams.

## Glossary

| English | Korean | Hungarian (chosen) |
|---|---|---|
| scholarship | 장학 | ösztöndíj |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS); category label "Kormányzati ösztöndíj: Global Korea Scholarship (GKS)" |
| admission guide | 모집요강 | felvételi tájékoztató |
| apostille | 아포스티유 | Apostille (as in the bundle) |
| consular legalization | 영사확인 | konzuli felülhitelesítés |
| Apostille Convention | 아포스티유 협약 | Apostille-egyezmény |
| Korean language institute | 한국어학당 | (egyetemi) koreai nyelvi intézet |
| admission letter / certificate of admission | 표준입학허가서 | felvételi levél |
| offer | 합격 | felvételi ajánlat |
| counselor | 담당자 | tanácsadó |
| plan (paid) | 플랜 | csomag |
| tuition | 등록금 | tandíj |
| dormitory | 기숙사 | kollégium |
| residence card | 외국인등록증 | tartózkodási kártya |
| proof of funds / bank balance certificate | 재정 증빙 / 잔고증명서 | anyagi fedezet igazolása / bankszámla-egyenleg igazolás |
| CCVI | 사증발급인정서 | vízumkiadási engedély (CCVI) |
| e-visa | 전자비자 | e-vízum |
| TB certificate | 결핵 진단서 | TBC-igazolás |
| immigration office | 출입국관리사무소 | bevándorlási hivatal |
| change of status | 체류자격 변경 | jogcímváltozás |
| match / strong / possible | 매칭 | egyezés / erős egyezés / lehetséges egyezés |
| Recommended (sort) | 추천순 | Ajánlott (böngészési sorrend, nem rangsor) |
| Integrated master's and PhD | 석박사 통합 | integrált mester- és doktori képzés |
| personal statement | 자기소개서 | motivációs levél |

## Pass A: meaning (6 strings changed)

1. `common:uni27.cat.GKS` "Koreai kormányzati ösztöndíj (GKS)" → "Kormányzati ösztöndíj: Global Korea Scholarship (GKS)". Hungarian has no established local name, so the official English name stays. Keeping it as the only text would trip the validator's "left in English" check, so a Hungarian lead-in is added.
2. `dossier:group.readyCount` "{{count}} dokumentum, amely minden jelentkezéshez kész" → "Minden jelentkezéshez kész dokumentumok mutatása ({{count}})". The source is a "Show …" toggle, and the draft had lost the action. `_one` and `_other` got the same fix.
3. `visaroute:reason.GET_LATER` "{{date}} után kérd" → "Legkorábban ekkor kérd: {{date}}". The source says "on or after", and *után* would exclude the date itself.
4. `mobile:student.home.subtitle` "Így haladsz a koreai tanulás felé." → "Itt látod, hol tartasz a koreai tanulás felé vezető úton." The draft read as "this is how you progress", but the source means "here is your progress".

## Pass B: native naturalness (13 strings changed)

1. `student:legalFlow.note.JOINS` "{{country}} {{date}}-án/én csatlakozik…" → "{{date}}: {{country}} csatlakozik…". The slash suffix was a machine-like workaround. `legalFlow.note.JOINED` is now "{{date}} óta {{country}} az Apostille-egyezmény tagja."
2. `common:fit.schol.best` "Megfelelhetsz ennek a feltételeinek: {{name}}." → "Megfelelhetsz a(z) {{name}} feltételeinek." The `_pct` variant got the same fix, with "tandíjkedvezménnyel".
3. `dossier:reason.NEAR_EXPIRY_DATE` "{{date}}-án/én lejár, …" → "Lejár: {{date}}, még a(z) {{university}} határideje előtt. …"
4. `visaroute:why.POST_BY_REGION` "…amely a {{city}} koreai nagykövetséghez…" → "A lakóhelyed ahhoz a koreai nagykövetséghez vagy konzulátushoz tartozik, amely ebben a városban van: {{city}}. …". The city name now needs no suffix. `why.POST_FOR_COUNTRY` got the same fix.
5. `mobile:university.cohorts.riskHint` "…a rendszereitek… vedd fel…" → "…az egyetemi rendszerek által megosztott adatokon alapulnak… érdemes felvenni a kapcsolatot…". This removes the mixed plural and singular address.

Other changes in this pass: `uni27.schol.youMay`, `uni27.intl.gks`, `matchReason.LANGUAGE_GAP_SMALL`, `legalFlow.step.consular.title` and `v3.home.stageLine.admission`.

## Pass C: UI context & brevity (10 strings changed)

1. `common:fit.gpa.outOf` "{{max}}-ból/ből" → "max. {{max}}". This is a short select label with no suffix hack.
2. `common:uni27.service.ORIENTATION` "Gólyahét, orientáció" → "Orientáció" (a service chip, so one word).
3. `common:uni27.service.BUDDY` "Mentorprogram (buddy)" → "Buddy-program".
4. `marketing:v6.unis.lede` "Szöul, Puszan, Tegu…" → "Szöul, Busan, Daegu…". Korean place names now follow the bundle's majority spelling (Szöul, otherwise Revised Romanization: Busan, Daegu, Incheon).
5. `marketing:v20.city.Chungnam.body` "Cshungcshong… Cshonan és Aszan… Kongdzsu és Puje… Pekcse" → "Chungcheong… Cheonan és Asan… Gongju és Buyeo… Baekje". The same change was made in the Seoul, Incheon, Ulsan, Chungnam-line and Gyeongnam-line strings.

Consistency check: there is one word each for scholarship (ösztöndíj), apostille (Apostille), consular legalization (konzuli felülhitelesítés), admission letter (felvételi levél) and counselor (tanácsadó). Every "Hangyul team" is "a Hangyul csapat".

## Final source ↔ target comparison

All 729 strings were re-read against `en`, with `ko` used where the English was ambiguous. For example, `compare.legalCount` 건 means documents, so the Hungarian says "dokumentumhoz". All placeholders and the `<em>` tag are intact. Nothing implies admission chances: "Ajánlott" is described as a browsing order, and the tier names are "Minimumok teljesítve / Egy lépésre / Érdemes megnézni / Nehéz megerősíteni". Hungarian puts nouns after numerals in the singular, so the `_one` and `_other` pairs are naturally count-safe. The Hangul in `v20.uni.why.breadthBody` was replaced by a Hungarian description of Academy Info. Validator: `node scripts/i18n/v27/validate.mjs --only=hu` reports 729 valid, 0 problems.

## Unsure

- **`v9.funds.longer_*` "tanácsadásra szoruló".** This renders the government's 'consulting' tier (컨설팅 대학). The Korean term has no Hungarian equivalent, so the wording needs a human check.
- **`fit.level.ASSOCIATE` "Felsőfokú szakképzés".** This is the nearest Hungarian level to 전문학사. It is not identical.
- **`fit.gpa.placeholder` "pl. 3.6".** It keeps the decimal point, because the input may not accept "3,6".
- **Place-name spelling.** The bundle mixes Hungarian transcription (Puszan, Tegu) and Revised Romanization. I followed the majority, which is Revised Romanization except for Szöul.
- **`uni27.intl.kli_named` "Koreai nyelvtanfolyamokat tart itt: {{name}}."** This is correct but slightly list-like, because no suffix can attach to `{{name}}`.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → A jelentkezéshez nem kell nyelvi eredmény. A felvétel után {{tests}} vagy magasabb eredményre lesz szükséged.
- `fit.reason.far` → {{options}} vagy magasabb szükséges, ez jóval a mostani eredményed felett van.
- `fit.tier.UNCLEAR.title` → Egyelőre még hosszú az út
- `fit.tier.UNCLEAR.short` → Több felkészülés
- `fit.tier.UNCLEAR.lede` → A mostani eredményed jóval elmarad a közzétett követelménytől. Szánj több időt a felkészülésre, aztán nézz vissza.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
