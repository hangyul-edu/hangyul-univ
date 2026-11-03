# V29 l10n record — ro (Romanian)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/ro.json` → `scripts/i18n/v28/tx-v29/ro.json`). Korean is canonical, English second reference. Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=ro` → 0 problems.

## Personas

- Elev de 18 ani din Cluj care vrea să studieze în Coreea
- Părinte care compară cele trei planuri și verifică ce costuri sunt separate
- Candidat la master (26) care vrea să știe exact câte runde de corectură primește

## Key term decisions

- **No round limit within the contracted documents**: "Fără limită de runde pentru documentele din contract"; notă: "în cadrul documentelor de candidatură și al calendarului din contract". Fără "nelimitat".
- **Up to N managed applications**: "Gestionăm până la N candidaturi" (rând: "Candidaturi gestionate") — distinct de "Universități recomandate".
- **Custom quote**: "Ofertă personalizată".
- **Airport pickup arrangement**: "Organizarea preluării de la aeroport"; notă: "printr-o firmă de transport parteneră".
- **Plurals**: Am adăugat forma CLDR `_few` (2–19: "zile", "runde"), `_other` = "de zile", "de runde".
- **Day counts**: "Zile de la prima consultație: {{count}}" fiindcă support_window_days is 1 or 3 (packages/types/src/plans.ts) and the job has no plural pair for these keys.

## Glossary

| Concept | EN | ro |
|---|---|---|
| Plan names | Everything in Basic · up to 5 recommendations | Tot ce include Basic · până la 5 recomandări |
| No round limit within contracted documents | No round limit within your contracted documents | Fără limită de runde pentru documentele din contract |
| Premium editing scope note | Premium editing has no round limit within your contracted application documents and schedule. | La Premium, corectarea nu are limită de runde, în cadrul documentelor de candidatură și al calendarului din contract. |
| Up to N managed applications | Up to 2 university applications managed | Gestionăm până la 2 candidaturi la universități |
| Applications managed (row) | Applications managed | Candidaturi gestionate |
| Universities recommended (row) | Universities recommended | Universități recomandate |
| Custom quote | Custom quote | Ofertă personalizată |
| Airport pickup arrangement | Airport pickup arrangement | Organizarea preluării de la aeroport |
| Pickup note | Airport pickup is arranged through a partner transport provider. | Preluarea de la aeroport este organizată printr-o firmă de transport parteneră. |
| Diagnostic consultation | Schedule the diagnostic consultation | Programează consultația de diagnostic |
| Follow-up consultation | {{count}} follow-up consultation | {{count}} consultație ulterioară |
| Statement & study-plan editing | Statement & study-plan editing | Scrisoare de intenție și plan de studiu |
| Editing round | 1 round | 1 rundă |
| Mock interview | Mock interview | Interviu de probă |
| Dormitory | Dormitory | Cămin |
| Settling in | Arrival & settling in | Sosire și instalare |
| Additional service (add-on) | Additional services | Servicii suplimentare |
| Agreed scope | Agreed scope | Conform acordului |
| Dedicated team · priority | Dedicated team · priority | Echipă dedicată · prioritate |
| Priority response | Priority response | Răspuns prioritar |
| Contract term | Contract term | Durata contractului |
| Service period | Service period | Perioada serviciului |
| Visa decision disclaimer | Visa support means help preparing and applying; the decision is the authority's. | Sprijinul pentru viză înseamnă ajutor la pregătire și depunere; decizia aparține autorității competente. |
| Upgrade | Ask the team about upgrading | Întreabă echipa despre schimbarea planului |
| Not included / Included | Not included | Nu este inclus |
| Notarization | Writing a new document, translation and notarization may cost extra. | Redactarea unui document nou, traducerile și legalizările notariale pot avea costuri suplimentare. |

## Review passes

### Pass A — meaning vs Korean — 4 strings changed

- "De la {{before}} zile înainte" → "De la {{before}} de zile înainte" (valoarea reală 30)
- "{{count}} zile de la prima consultație" → "Zile de la prima consultație: {{count}}"
- "corectare nelimitată" → "fără limită de runde"
- "2 candidaturi" → "Gestionăm până la 2 candidaturi la universități"
- "Preluare de la aeroport" → "Organizarea preluării de la aeroport"

### Pass B — native naturalness — 3 strings changed

- "Comparăm condițiile de admitere…" → "Comparație: condiții de admitere, taxe de școlarizare, date-cheie"
- "Un preț corect, un domeniu clar" → "Un preț corect,<br>servicii clar definite"
- "Încearcă iar într-un moment" → "Încearcă din nou peste câteva momente"
- "Nu mulțumesc" → "Nu, mulțumesc"
- "Suma încasată" → "Suma debitată de pe card"

### Pass C — UI brevity / one term per concept — 2 strings changed

- "Corectarea scrisorii de intenție și a planului de studiu" → rând: "Scrisoare de intenție și plan de studiu"
- "Serviciu extra" → "Serviciu suplimentar" peste tot
- "O stabilim împreună când începe serviciul" → mobil: "Se stabilește la început"
- "Sprijin ulterior din partea echipei" → mobil: "Sprijin din partea echipei"
- "Cămin studențesc" → "Cămin" (termen existent)

## Final source↔target comparison

Every key re-read against Korean: no "unlimited" rendering, managed applications never phrased as a guarantee or as "apply to any N", recommended vs managed kept as two different nouns, visa decision attributed to the authority, airport pickup phrased as arranged through a partner, no currency amount translated; all {{placeholders}} and <br> kept.

## Marketing scorecard (marketing:v29.why.*)

| Section | Clarity | Trust | Naturalness | Brevity | CTA | Cultural fit | Total |
|---|---|---|---|---|---|---|---|
| v29.why.s1 (title + text) | 5 | 4 | 5 | 4 | 4 | 4 | 26/30 |
| v29.why.s3 (title + text) | 5 | 5 | 4 | 4 | 4 | 4 | 26/30 |

## Unsure

- "1 transfer organizat" ca unitate.
- "Scrisoare de intenție" (termen existent) vs. "scrisoare de motivație".
- "legalizări notariale" pentru 공증.

## Counts

- Job keys: 158 (all had `current: null`)
- Kept verbatim: 0
- Rewritten: 0
- Newly translated: 158
- Extra CLDR plural forms added: 3 (_few)

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
