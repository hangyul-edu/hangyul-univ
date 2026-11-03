# V29 l10n record — de (German)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/de.json` → `scripts/i18n/v28/tx-v29/de.json`). Brief: docs/qa/v29/l10n/BRIEF.md + docs/qa/v28/l10n/BRIEF.md. Korean used as canonical meaning.

Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=de` → 0 problems (158 strings). Not applied (`--apply` left to the merge owner).

## Personas

- Lena, 19, first-time visitor comparing study-abroad options from Hamburg
- Jonas, 27, master's applicant comparing three agencies' price sheets line by line
- A parent paying by card who reads the fine print on fees and exchange rates

## Register and conventions

du throughout (matches existing student.json and marketing v15.pricing.lede). Plan = Tarif (existing v15.pricing.compare.*). Team = "Hangyul Univ-Team" (existing).

## Key term decisions

- No round limit within contracted documents: "Korrektur deiner vertraglich vereinbarten Bewerbungsunterlagen ohne Rundenlimit"; scope note says "im Rahmen der vertraglich vereinbarten Bewerbungsunterlagen und des Zeitplans". Never "unbegrenzt".
- Up to N managed applications: "Betreuung von bis zu N (Hochschul)bewerbungen" / row "Betreute Bewerbungen" vs recommended "Empfohlene Hochschulen".
- Custom quote: "Individuelles Angebot".
- Airport pickup arrangement: "Vermittlung einer Flughafenabholung"; note: "vermitteln wir über einen Partner-Transportdienst" (Hangyul does not drive).
- Statement = Motivationsschreiben (existing essayType), editing = Korrektur, mock interview = Probeinterview, dormitory = Wohnheim.

## Glossary (as written in the output)

| Concept | Rendering |
|---|---|
| Hangyul Univ team | Das Hangyul Univ-Team hat dir eine Zusatzleistung vorgeschlagen |
| Additional service / add-on | Zusatzleistungen |
| Add-on (compare cell) | Zusatzleistung |
| Custom quote (별도 견적) | Individuelles Angebot |
| Airport pickup arrangement (공항 픽업 연결) | Vermittlung einer Flughafenabholung |
| Partner-provider pickup note | Die Flughafenabholung vermitteln wir über einen Partner-Transportdienst. |
| Mock interview | Probeinterview |
| Diagnostic consultation | Persönliches Analysegespräch + 1 Folgegespräch |
| Recommended universities (추천) | Empfohlene Hochschulen |
| Managed applications (지원 관리) | Betreute Bewerbungen |
| Up to N managed applications | Betreuung von bis zu 2 Hochschulbewerbungen |
| Up to N rounds | Bis zu {{count}} Runden |
| Statement & study-plan editing | Korrektur von Motivationsschreiben & Studienplan |
| No round limit within contracted documents (card) | Korrektur deiner vertraglich vereinbarten Bewerbungsunterlagen ohne Rundenlimit |
| No round limit within contract (cell) | Ohne Rundenlimit im Vertragsumfang |
| Premium scope note | Premium-Korrekturen haben kein Rundenlimit, im Rahmen der vertraglich vereinbarten Bewerbungsunterlagen und des Zeitplans. |
| No round limit (student app) | Ohne Rundenlimit für deine Vertragsunterlagen |
| No limit (mobile chip) | Ohne Limit für Vertragsunterlagen |
| Dormitory | Wohnheim |
| Settling in | Visum & Einleben |
| Visa decision disclaimer | Visumsunterstützung heißt Hilfe bei Vorbereitung und Antrag; die Entscheidung trifft die zuständige Behörde. |
| Consultation support period | Beratungszeitraum |
| Contract term | Vertragslaufzeit |
| Service period | Leistungszeitraum |
| Priority response | Vorrangige Antworten |
| Dedicated team | Festes Team · Vorrang |
| Upgrade | Das Team zum Upgrade fragen |
| Notarization | Für neu zu erstellende Unterlagen, Übersetzung und notarielle Beglaubigung können Zusatzkosten anfallen. |
| One-time payment in USD | Alle Preise sind Einmalzahlungen in US-Dollar (USD). |
| Agree and pay CTA | Zustimmen und {{amount}} zahlen |

## Review passes

- Pass A (meaning vs Korean): 4 changed (e.g. 'Vorbereitung vor der Ankunft starten' kept; 'Hilfe bei der Ankunft' → 'Erste Hilfe beim Einleben leisten' to match 초기 정착; addons.lede made explicit that payment comes only after agreement; visaDecision says 'die zuständige Behörde' decides).
- Pass B (native marketer naturalness): 5 changed (e.g. 'Ein Nein ändert nichts: Dein Tarif läuft unverändert weiter'; 'Fairer Preis,<br>klarer Umfang'; 'Nein, danke').
- Pass C (UI brevity, one term per concept): 3 changed (mobile chip 'Ohne Limit für Vertragsunterlagen'; 'Festes Team · Vorrang'; 'Bis zu {{count}} Runden').
- Final check: no wording implies unlimited editing/documents/translation/time, guaranteed admission or a visa issued by Hangyul; recommended vs managed kept distinct; amounts left as placeholders; plan names Basic / All-in-One / Premium kept in Latin as in existing v29.pricing.<slug>.name.

## Marketing scorecard (marketing:v29.why.*; clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

- s1 (title + text): 26/30
- s3 (title + text): 26/30

## Unsure

- 'Probeinterview' vs 'Übungs-Vorstellungsgespräch' — chose the shorter, common form.
- upgrade.used: 'genutzte Kontingente' slightly technical for students.

## Counts

Job keys: 158 · extra plural forms: 0 · kept verbatim: 0 (no `current` values) · rewritten: 0 · newly translated: 158.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
