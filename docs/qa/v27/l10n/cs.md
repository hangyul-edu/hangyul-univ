# V27 l10n review — Czech (cs)

Output: `scripts/i18n/v27/tx/cs.json`, 729 of 729 keys (common 205, student 212, mobile 58, dossier 32, visaroute 88, marketing 134).
Register: formal *vy*, the same as the existing `packages/i18n/locales/cs` bundle, including the agency and university pages.
Brand: "Hangyul Univ" / "Hangyul", Latin script, not declined in running text except "Hangyulu" (dative, payments).

## Personas

- **Tereza, 18, Brno**: in her final year of gymnázium. She is applying for a bachelor's at a Korean university, has a TOPIK 2 and is nervous about the paperwork.
- **Ondřej, 27, Ostrava**: a mechanical engineer applying for a master's taught in English. He holds IELTS Academic 7.0 and reads every condition closely.
- **Jana, 49, Tereza's mother**: she pays the tuition. She cares about who is paid, when, and whether the money is safe.

## Glossary

| English | Korean | Czech (chosen) |
|---|---|---|
| scholarship | 장학 | stipendium |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS); category label "Vládní stipendium GKS (Global Korea Scholarship)" |
| admission guide | 모집요강 | pokyny k přijímacímu řízení |
| apostille | 아포스티유 | apostila |
| consular legalization | 영사확인 | konzulární superlegalizace (verb: nechat si udělat superlegalizaci) |
| Apostille Convention | 아포스티유 협약 | Apostilní úmluva |
| Korean language institute | 한국어학당 | institut korejského jazyka (při univerzitě) |
| certificate of admission / admission letter | 표준입학허가서 | potvrzení o přijetí |
| offer | 합격 | nabídka přijetí |
| counselor | 담당자 | poradce |
| Hangyul team | 한귤 팀 | tým Hangyul |
| plan (paid) | 플랜 | balíček |
| tuition | 등록금 | školné |
| dormitory / university housing | 기숙사 | kolej / univerzitní koleje |
| residence card | 외국인등록증 | průkaz o pobytu |
| proof of funds / bank balance certificate | 재정 증빙 / 잔고증명서 | doklad o finančních prostředcích / potvrzení o zůstatku na účtu |
| CCVI | 사증발급인정서 | potvrzení o schválení vydání víza (CCVI) |
| e-visa | 전자비자 | e-vízum |
| TB certificate | 결핵 진단서 | potvrzení o vyšetření na TBC |
| immigration office | 출입국관리사무소 | imigrační úřad |
| match / strong match / possible match | 매칭 | shoda / silná shoda / možná shoda |
| Recommended (sort) | 추천순 | Doporučené (pořadí pro procházení, ne žebříček) |
| Integrated master's and PhD | 석박사 통합 | spojené magisterské a doktorské studium |
| personal statement / essay | 자기소개서 / 에세이 | motivační dopis / esej |

## Pass A: meaning (7 strings changed)

1. `common:fit.level.COMBINED` "Navazující magisterské a PhD" → "Spojené magisterské a doktorské". In Czech, *navazující* means a follow-on master's, not an integrated master's + PhD track. The same fix went into `common:degree.COMBINED` and `visaroute:degree.COMBINED`.
2. `common:uni27.intl.kli_named` "Kurzy korejštiny vede {{name}}." → "Kurzy korejštiny nabízí v rámci {{name}}." The subject is the university, which runs the courses *at* the institute, not the institute itself.
3. `common:uni27.cat.GKS` "Global Korea Scholarship (GKS)" → "Vládní stipendium GKS (Global Korea Scholarship)". Czech has no established local name. The label now says what it is and keeps the official name.
4. `mobile:student.home.subtitle` "Takhle postupujete ke studiu v Koreji." → "Tady je váš postup na cestě ke studiu v Koreji." The draft read as "this is how you proceed", but the source means "here is your progress".
5. `marketing:v10.check.lede` "…obor studia, který chcete…" → "…stupeň studia, o který máte zájem…". The source means degree level, not field of study.

## Pass B: native naturalness (16 strings changed)

1. `common:matchReason.DEADLINE_SOON` "Uzávěrka za {{days}} d. Začněte hned" → "Do uzávěrky zbývá dní: {{days}}. Začněte hned". This drops the clipped abbreviation and works for any count.
2. `student:matches.tierText.COMPETITIVE` "…jiné faktory … to dělají méně jistým." → "…kvůli jiným faktorům … to není tak jisté." The draft was an English-structure calque.
3. `student:legalFlow.note.JOINED` "{{country}} přistoupila…" → "Země {{country}} přistoupila…". The past-tense gender no longer depends on the country name. `legalFlow.note.JOINS` was aligned to match.
4. `dossier:page.method` "ne v fotkách" → "ne ve fotkách" (vocalised preposition). `dossier:check.rejected` "Beru na vědomí" → "Bereme na vědomí" (the service speaks as "we").
5. `visaroute:why.POST_BY_REGION` "konzulát v {{city}}" → "konzulát ve městě {{city}}". A bare place-name placeholder cannot take the locative case. `why.POST_FOR_COUNTRY` got the same fix.

Other changes in this pass: `fit.reason.met_track` and `fit.reason.needed_track` (the track label in brackets or as a lead-in), `v4.docs.essayWrite`, `v9.funds.longer_one` and `v9.funds.longer_other` (count-neutral "měs."), `essay.comments.subtitle`, `login.aside.title` and `v3.home.stageLine.admission`.

## Pass C: UI context & brevity (7 strings changed)

1. `common:fit.tier.CHALLENGE.short` "Stojí za pohled" → "Stojí za zvážení". The chip is still short and is now idiomatic. The title was aligned to match.
2. `student:home.docAction.RENEW` "Prošlé. Obnovte ho" → "Prošlý. Obnovte ho". The grammatical gender now agrees with *dokument* in every document chip.
3. `student:home.docAction.TOO_OLD` "Příliš staré. Opatřete si nové" → "Příliš starý. Opatřete si novou kopii"
4. `mobile:v3.docAction.TOO_OLD` "Vydáno příliš dávno. Opatřete si nové" → "Vydán příliš dávno. Opatřete si novou kopii"
5. `visaroute:docStatus.EXPIRED` "Prošlé, opatřete si nové" → "Prošlý, opatřete si nový"

Consistency check: 영사확인 is "superlegalizace" in all 16 strings that mention it, scholarship is "stipendium" throughout, and the CTAs use the imperative *vy* form ("Ověřit…" for links, "Zobrazit…" for buttons).

## Final source ↔ target comparison

All 729 strings were re-read against `en` (with `ko` where English was ambiguous). Every placeholder and `<em>` tag is preserved. No string implies admission probability or a guarantee: "Doporučené" is explained as a browsing order, and tier labels say "splňuje minima / chybí jeden krok". The Hangul "대학알리미" in `v20.uni.why.breadthBody` was replaced by a Czech description of Academy Info, because Hangul is not allowed outside ko. Plural bases (`uni27.schol.count`, `fit.unlock`, `compare.legalCount_other`, `dossier` counts and others) use count-neutral "Label: {{count}}" or bracket forms, so Czech 2–4 / 5+ agreement cannot break. `_one` keys are singular. Validator: `node scripts/i18n/v27/validate.mjs --only=cs` reports 729 valid, 0 problems.

## Unsure

- **Consular legalization.** The existing bundle mostly uses "konzulární ověření". I chose "konzulární superlegalizace", which is the term the Czech Foreign Ministry and Czech students use for 영사확인, and the bundle itself already says "Superlegalizace není nutná". Untouched older bundle strings still say "konzulární ověření" and should be aligned later.
- **`fit.level.ASSOCIATE` "Vyšší odborné".** This is the closest Czech level to 전문학사. It is not an exact equivalent.
- **`fit.gpa.placeholder` "např. 3.6".** It keeps the decimal point, because the input may not accept a comma. Czech normally writes 3,6.
- **City romanisation in the `v20.city.*` bodies.** These use Czech transcription (Pusan, Tegu, Inčchon, Čchonan, Kongdžu, Pujo). The rest of the bundle should be checked for whether it prefers the official RR spelling (Busan, Daegu).
- **`fit.levelValue.KING_SEJONG` "Sejong Korean {{level}}".** This is kept as the course-book name.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → K přihlášce není potřeba žádný jazykový výsledek. Po přijetí budete potřebovat {{tests}} nebo vyšší.
- `fit.reason.far` → Vyžaduje {{options}} nebo vyšší, což je výrazně nad vaším současným výsledkem.
- `fit.tier.UNCLEAR.title` → Zatím ještě dlouhá cesta
- `fit.tier.UNCLEAR.short` → Více přípravy
- `fit.tier.UNCLEAR.lede` → Váš současný výsledek je výrazně pod zveřejněným požadavkem. Dejte si na přípravu víc času a pak to zkontrolujte znovu.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
