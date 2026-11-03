# V27 l10n review — Romanian (ro)

Output: `scripts/i18n/v27/tx/ro.json`, 729 of 729 keys (common 205, student 212, mobile 58, dossier 32, visaroute 88, marketing 134).
Register: informal *tu* everywhere, matching the existing `packages/i18n/locales/ro` bundle. The bundle also uses *tu* on its agency page ("îți trimite studenți…").
Orthography: ș/ț with comma below, „…” quotes.
Brand: "Hangyul Univ" / "Hangyul" (undeclined; "către Hangyul", "echipa Hangyul").

## Personas

- **Ioana, 18, Cluj-Napoca**: in her last year of liceu. She is applying for a bachelor's in Korea, has TOPIK 2, loves K-culture and is anxious about paperwork.
- **Andrei, 27, Iași**: a software engineer. He is looking at an English-taught master's, holds IELTS Academic 7.0 and reads every condition carefully.
- **Mihaela, 50, Ioana's mother**: she pays the tuition. She wants to know where the money goes and how to avoid intermediaries.

## Glossary

| English | Korean | Romanian (chosen) |
|---|---|---|
| scholarship | 장학 | bursă |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS); label "Bursa Global Korea Scholarship (GKS)" (as in the bundle) |
| admission guide | 모집요강 | ghidul de admitere |
| apostille | 아포스티유 | apostilă |
| consular legalization | 영사확인 | supralegalizare consulară |
| Apostille Convention | 아포스티유 협약 | Convenția de la Haga privind apostila |
| Korean language institute | 한국어학당 | institutul de limba coreeană (al unei universități) |
| application (to a university) | 지원서 | candidatură (never "aplicație", which means an app) |
| to apply | 지원하다 | a aplica (for the visa and university); a depune cererea |
| admission letter | 표준입학허가서 | scrisoare de admitere |
| offer | 합격 | ofertă (de admitere) |
| counselor | 담당자 | consilier |
| plan (paid) | 플랜 | pachet |
| tuition | 등록금 | taxa de școlarizare |
| dormitory | 기숙사 | cămin |
| residence card | 외국인등록증 | permis de ședere |
| proof of funds / bank balance certificate | 재정 증빙 / 잔고증명서 | dovada fondurilor / certificat de sold bancar |
| CCVI | 사증발급인정서 | certificat de confirmare a eliberării vizei (CCVI) |
| e-visa | 전자비자 | viză electronică |
| TB certificate | 결핵 진단서 | certificat TBC |
| immigration office | 출입국관리사무소 | biroul de imigrare |
| match / strong / possible | 매칭 | potrivire / potrivire puternică / potrivire posibilă |
| Recommended (sort) | 추천순 | Recomandate (ordine de navigare, nu clasament) |
| Integrated master's and PhD | 석박사 통합 | master și doctorat integrat |
| personal statement | 자기소개서 | scrisoare de intenție |

## Pass A: meaning (4 strings changed)

1. `common:task.reviewEssay` "Revizuiește {{essayType}}…" → "Verifică {{essayType}}…". This is the staff task to *review* an essay. The draft used the same verb as the student task `reviseEssay`, which merged two different actions.
2. `marketing:home.trust.lede` "…Iată cum le gestionăm, la fel ca informațiile pe care ți le arătăm." → "…Iată cum le gestionăm și ce informații îți arătăm." The draft changed the meaning.
3. `marketing:v20.uni.why.breadthBody` "…cât de larg este choice-ul…" → "…cât de mare e oferta odată ce ajungi aici." An English word had leaked into the draft.
4. `mobile:student.home.subtitle` "Iată cât ai progresat…" → "Iată progresul tău spre studiile în Coreea." The source means "here is your progress", not a measured amount.

## Pass B: native naturalness (19 strings changed)

1. `student:applicationDetail.done.SUBMITTED` "Aplicație trimisă." → "Candidatură trimisă." In Romanian, *aplicație* means an app, so every university application in the student namespace is now *candidatură*. The same change was made in `start.created`, `documents.emptyText`, `essays.emptyText`, `documentsV2.*`, `tasksV3.subtitle`, `v4.ws.idle.prep` and `v22.home.appsQuiet_*`, 11 strings in all.
2. `student:matches.tierText.COMPETITIVE` "…o fac mai puțin sigură." → "…fac rezultatul mai puțin sigur." The draft was an English-structure calque.
3. `common:matchReason.DEADLINE_SOON` "Termen limită în {{days}} zile." → "Zile rămase până la termen: {{days}}." For 20 or more, Romanian needs "de zile", so the label form keeps the count grammatical. `uni27.house.capacity` got the same treatment.
4. `dossier:reason.NEAR_EXPIRY_DATE` "înainte de termenul {{university}}" → "înainte de termenul-limită al {{university}}". The genitive was missing.
5. `marketing:v7.hero.text` "Apoi Hangyul îți pregătește împreună cu tine…" → "Apoi Hangyul pregătește împreună cu tine, pas cu pas, documentele, candidatura, viza și sosirea." The draft had a doubled dative.

Other changes in this pass: `fit.level.ASSOCIATE`, `uni27.schol.renewal`, `uni27.intl.gks` and `mobile:university.cohorts.riskHint`. The last one mixed plural "voastre" with singular "contactezi".

## Pass C: UI context & brevity (5 strings changed)

1. `common:uni27.cat.GKS` "Bursa Guvernului Coreei: Global Korea Scholarship (GKS)" → "Bursa Global Korea Scholarship (GKS)". This is shorter and identical to the bundle's established form.
2. `common:fit.tier.CHALLENGE.short` "Merită o privire" → "Merită văzut". The chip is shorter and idiomatic.
3. `common:fit.reason.met_track` "…pentru programele: {{track}}." → "…({{track}})." The track label reads cleanly in brackets.
4. `common:fit.reason.needed_track` "Programele ({{track}}) necesită…" → "{{track}}: necesită…"
5. `student:compare.legalCount_other` "Documente care necesită apostilă sau supralegalizare: {{count}}" → "Necesită apostilă sau supralegalizare: {{count}}". This shortens a compare-table cell.

Consistency check: scholarship is "bursă", consular legalization is "supralegalizare consulară" and apostille is "apostilă". Admission letter is "scrisoare de admitere", counselor is "consilier", and university application is "candidatură" everywhere. "Aplicație" is left only where it means the app, as in `i18n.machine`, `settingsV3.translation.*` and `editOnWeb`.

## Final source ↔ target comparison

All 729 strings were re-read against `en`, and against `ko` for 건, 등급 and 컨설팅. All placeholders and `<em>` are intact. No wording implies admission probability or a guarantee. Plural bases and `_other` keys avoid the Romanian "de" rule by using label forms ("Burse verificate: {{count}}", "Universități de luat în calcul: {{formatted}}"), and `_one` keys are singular. The Hangul in `v20.uni.why.breadthBody` was replaced by a Romanian description of Academy Info. Validator: `node scripts/i18n/v27/validate.mjs --only=ro` reports 729 valid, 0 problems.

## Unsure

- **`{{days}} zile` in `dossier:reason.NEAR_TOO_OLD` and `visaroute:timing.noDate`.** Strictly, "de zile" is needed for 20 or more, and these are often 30 or 90. The no-"de" form is common in administrative Romanian, but a native reviewer may prefer a rephrase.
- **`v9.funds.longer_*` „consulting”.** The government tier name (컨설팅 대학) is kept as a quoted foreign term.
- **`fit.level.ASSOCIATE` "Studii de scurtă durată".** This is the closest equivalent to 전문학사. Romania has no direct counterpart.
- **`fit.gpa.placeholder` "ex. 3.6".** It keeps the decimal point, because the input may not accept "3,6".
- **"Seul".** This follows standard Romanian spelling. The other city names use Revised Romanization, as the bundle does.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Nu se cere niciun rezultat la limbă pentru aplicare. După admitere vei avea nevoie de {{tests}} sau mai mult.
- `fit.reason.far` → Necesită {{options}} sau mai mult, mult peste rezultatul tău actual.
- `fit.tier.UNCLEAR.title` → Deocamdată e încă un drum lung
- `fit.tier.UNCLEAR.short` → Mai multă pregătire
- `fit.tier.UNCLEAR.lede` → Rezultatul tău actual este mult sub cerința publicată. Acordă-ți mai mult timp de pregătire, apoi verifică din nou.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
