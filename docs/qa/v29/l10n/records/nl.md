# V29 l10n record — nl (Dutch)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/nl.json` → `scripts/i18n/v28/tx-v29/nl.json`). Korean is canonical, English second reference. Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=nl` → 0 problems.

## Personas

- Eerstejaars (18) uit Rotterdam die voor het eerst een studie in Korea verkent
- Ouder die drie plannen naast elkaar legt en op kosten en garanties let
- Masteraanvrager (26) die exact wil weten hoeveel redactierondes er zijn

## Key term decisions

- **No round limit within the contracted documents**: "Geen rondelimiet voor de documenten in je contract" (card/mobile), notes: "Bij Premium geldt geen limiet op redactierondes, binnen de aanmeldingsdocumenten en planning uit je contract". "Onbeperkt" bewust vermeden.
- **Up to N managed applications**: "Tot N begeleide aanmeldingen" — "begeleid" = Hangyul voert de aanmelding mee uit; los van "aanbevolen universiteiten".
- **Custom quote**: "Offerte op maat".
- **Airport pickup arrangement**: "Ophalen van het vliegveld regelen" + note "regelen we via een vervoerspartner" (Hangyul rijdt niet zelf).
- **Day counts**: Teksten met {{count}} zonder meervoudspaar (support_window_days is 1 or 3 (packages/types/src/plans.ts) and the job has no plural pair for these keys) neutraal opgebouwd: "Dagen vanaf je eerste consult: {{count}}".
- **Register**: je/jij zoals de bestaande nl-bundel; plan-namen Basic / All-in-One / Premium onvertaald; upgrade = "overstap" zoals bestaand.

## Glossary

| Concept | EN | nl |
|---|---|---|
| Plan names | Everything in Basic · up to 5 recommendations | Alles uit Basic · tot 5 aanbevelingen |
| No round limit within contracted documents | No round limit within your contracted documents | Geen rondelimiet voor de documenten in je contract |
| Premium editing scope note | Premium editing has no round limit within your contracted application documents and schedule. | Bij Premium geldt geen limiet op redactierondes, binnen de aanmeldingsdocumenten en planning uit je contract. |
| Up to N managed applications | Up to 2 university applications managed | Tot 2 begeleide aanmeldingen bij universiteiten |
| Applications managed (row) | Applications managed | Begeleide aanmeldingen |
| Universities recommended (row) | Universities recommended | Aanbevolen universiteiten |
| Custom quote | Custom quote | Offerte op maat |
| Airport pickup arrangement | Airport pickup arrangement | Ophalen van het vliegveld regelen |
| Pickup note | Airport pickup is arranged through a partner transport provider. | Het ophalen van het vliegveld regelen we via een vervoerspartner. |
| Diagnostic consultation | Schedule the diagnostic consultation | Diagnosegesprek inplannen |
| Follow-up consultation | {{count}} follow-up consultation | {{count}} vervolggesprek |
| Statement & study-plan editing | Statement & study-plan editing | Redactie motivatiebrief en studieplan |
| Editing round | 1 round | 1 ronde |
| Mock interview | Mock interview | Oefengesprek |
| Dormitory | Dormitory | Studentenhuis |
| Settling in | Arrival & settling in | Aankomst en settelen |
| Additional service (add-on) | Additional services | Extra diensten |
| Agreed scope | Agreed scope | Afgesproken omvang |
| Dedicated team · priority | Dedicated team · priority | Vast team · voorrang |
| Priority response | Priority response | Antwoord met voorrang |
| Contract term | Contract term | Contractperiode |
| Service period | Service period | Serviceperiode |
| Visa decision disclaimer | Visa support means help preparing and applying; the decision is the authority's. | Visumhulp is hulp bij het voorbereiden en aanvragen; over het visum beslist de bevoegde instantie. |
| Upgrade | Ask the team about upgrading | Vraag het team naar overstappen |
| Not included / Included | Not included | Niet inbegrepen |
| Notarization | Writing a new document, translation and notarization may cost extra. | Voor een nieuw document schrijven, vertaling en notariële bekrachtiging kunnen extra kosten gelden. |

## Review passes

### Pass A — meaning vs Korean — 4 strings changed

- "{{count}} dagen vanaf je eerste consult" → "Dagen vanaf je eerste consult: {{count}}" (count kan 1 zijn)
- "Tot {{date}} · nog {{count}} dagen" → "Tot {{date}} · resterende dagen: {{count}}"
- "Redactie van je gecontracteerde documenten, onbeperkt" → "…in je contract, zonder maximum aantal rondes"
- "de beslissing ligt bij de autoriteiten" → "over het visum beslist de bevoegde instantie"
- "Tot 2 aanmeldingen door ons" → "Tot 2 begeleide aanmeldingen bij universiteiten"

### Pass B — native naturalness — 3 strings changed

- "Een eerlijke prijs, een duidelijke omvang" → "Een eerlijke prijs,<br>duidelijk wat je krijgt"
- "Schema het diagnosegesprek" → "Diagnosegesprek inplannen" (taak-infinitief)
- "Probeer het zo nog eens" → "Probeer het zo opnieuw"
- "Basisinformatie over het dagelijks leven" → "Basisinfo over het dagelijks leven"
- "Regeling van ophalen" → "Ophalen van het vliegveld regelen"

### Pass C — UI brevity / one term per concept — 3 strings changed

- "Consultatieperiode" → "Consultperiode" (= bestaand "Consult")
- "Studentenkamer" → "Studentenhuis" (bestaande term)
- "Afgesproken bij de start van de service" → "Afgesproken bij de start" (mobiel)
- "Antwoord met voorrang van je team" → "Antwoord met voorrang"
- "Extra aanvullende dienst" → "Extra dienst"

## Final source↔target comparison

Every key re-read against Korean: no "unlimited" rendering, managed applications never phrased as a guarantee or as "apply to any N", recommended vs managed kept as two different nouns, visa decision attributed to the authority, airport pickup phrased as arranged through a partner, no currency amount translated; all {{placeholders}} and <br> kept.

## Marketing scorecard (marketing:v29.why.*)

| Section | Clarity | Trust | Naturalness | Brevity | CTA | Cultural fit | Total |
|---|---|---|---|---|---|---|---|
| v29.why.s1 (title + text) | 5 | 4 | 5 | 4 | 4 | 4 | 26/30 |
| v29.why.s3 (title + text) | 5 | 5 | 4 | 4 | 4 | 4 | 26/30 |

## Unsure

- "settelen" (bestaande term) is informeel; alternatief "je draai vinden".
- "notariële bekrachtiging" voor 공증 — juridisch correct maar formeel.
- "Studentenhuis" voor een Koreaans universiteitsdorm (bestaande glossaryterm).

## Counts

- Job keys: 158 (all had `current: null`)
- Kept verbatim: 0
- Rewritten: 0
- Newly translated: 158
- Extra CLDR plural forms added: 0

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
