# V29 l10n record — sv (Swedish)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/sv.json` → `scripts/i18n/v28/tx-v29/sv.json`). Korean is canonical, English second reference. Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=sv` → 0 problems.

## Personas

- Gymnasieelev (19) i Göteborg som funderar på ett utbytesår i Korea
- Förälder som jämför tre paket och vill veta vad som inte ingår
- Masterstudent (25) som vill veta exakt vad "ingen gräns" gäller

## Key term decisions

- **No round limit within the contracted documents**: "Ingen gräns för omgångar för handlingarna i ditt avtal"; notes: "inom de ansökningshandlingar och den tidplan som avtalet omfattar". Aldrig "obegränsat".
- **Up to N managed applications**: "Upp till N ansökningar som vi sköter" (rad: "Ansökningar vi sköter") — skilt från "Rekommenderade universitet".
- **Custom quote**: "Offert på begäran".
- **Airport pickup arrangement**: "Förmedling av hämtning på flygplatsen"; note: "förmedlas via en samarbetspartner för transport".
- **Day counts**: Neutral form "Dagar från din första konsultation: {{count}}" eftersom support_window_days is 1 or 3 (packages/types/src/plans.ts) and the job has no plural pair for these keys.
- **Register**: du-tilltal; "Byt plan" för upgrade som i befintlig bundle.

## Glossary

| Concept | EN | sv |
|---|---|---|
| Plan names | Everything in Basic · up to 5 recommendations | Allt i Basic · upp till 5 rekommendationer |
| No round limit within contracted documents | No round limit within your contracted documents | Ingen gräns för omgångar för handlingarna i ditt avtal |
| Premium editing scope note | Premium editing has no round limit within your contracted application documents and schedule. | I Premium är bearbetningen inte begränsad till ett antal omgångar, inom de ansökningshandlingar och den tidplan som avtalet omfattar. |
| Up to N managed applications | Up to 2 university applications managed | Upp till 2 universitetsansökningar som vi sköter |
| Applications managed (row) | Applications managed | Ansökningar vi sköter |
| Universities recommended (row) | Universities recommended | Rekommenderade universitet |
| Custom quote | Custom quote | Offert på begäran |
| Airport pickup arrangement | Airport pickup arrangement | Förmedling av hämtning på flygplatsen |
| Pickup note | Airport pickup is arranged through a partner transport provider. | Hämtning på flygplatsen förmedlas via en samarbetspartner för transport. |
| Diagnostic consultation | Schedule the diagnostic consultation | Boka den inledande studiekonsultationen |
| Follow-up consultation | {{count}} follow-up consultation | {{count}} uppföljande konsultation |
| Statement & study-plan editing | Statement & study-plan editing | Personligt brev och studieplan |
| Editing round | 1 round | 1 omgång |
| Mock interview | Mock interview | Övningsintervju |
| Dormitory | Dormitory | Studentboende |
| Settling in | Arrival & settling in | Ankomst och etablering |
| Additional service (add-on) | Additional services | Tilläggstjänster |
| Agreed scope | Agreed scope | Enligt överenskommelse |
| Dedicated team · priority | Dedicated team · priority | Eget team · förtur |
| Priority response | Priority response | Svar med förtur |
| Contract term | Contract term | Avtalstid |
| Service period | Service period | Tjänsteperiod |
| Visa decision disclaimer | Visa support means help preparing and applying; the decision is the authority's. | Visumstöd betyder hjälp att förbereda och ansöka; beslutet fattas av myndigheten. |
| Upgrade | Ask the team about upgrading | Fråga teamet om att byta plan |
| Not included / Included | Not included | Ingår inte |
| Notarization | Writing a new document, translation and notarization may cost extra. | Att skriva en ny handling, översättning och notarialbestyrkande kan kosta extra. |

## Review passes

### Pass A — meaning vs Korean — 4 strings changed

- "{{count}} dagar kvar" → "dagar kvar: {{count}}"
- "{{count}} dagar från din första konsultation" → "Dagar från din första konsultation: {{count}}"
- "Obegränsad bearbetning" → "…utan gräns för antal omgångar"
- "Upp till 2 ansökningar" → "Upp till 2 universitetsansökningar som vi sköter"
- "Hämtning på flygplatsen" → "Förmedling av hämtning på flygplatsen"

### Pass B — native naturalness — 3 strings changed

- "Från början till slut" → "från start till mål"
- "En rättvis kostnad" → "Ett rimligt pris"
- "Nej, tack" → "Nej tack"
- "Att säga nej ändrar ingenting" → "Säger du nej ändras ingenting"
- "Kostnader från tredje part är separata" → "Kostnader till tredje part tillkommer"

### Pass C — UI brevity / one term per concept — 2 strings changed

- "Bearbetning av personligt brev och studieplan" → rad: "Personligt brev och studieplan"
- "Tilläggstjänst" / "Extra tjänst" → "Tilläggstjänst(er)" överallt, kolumnvärde "Tillägg"
- "Bestäms när tjänsten startar tillsammans med dig" → mobil: "Bestäms när tjänsten startar"
- "Uppföljning från ditt team" → mobil: "Uppföljning av teamet"
- "Studentboende" / "Studenthem" → "Studentboende" (befintlig term)

## Final source↔target comparison

Every key re-read against Korean: no "unlimited" rendering, managed applications never phrased as a guarantee or as "apply to any N", recommended vs managed kept as two different nouns, visa decision attributed to the authority, airport pickup phrased as arranged through a partner, no currency amount translated; all {{placeholders}} and <br> kept.

## Marketing scorecard (marketing:v29.why.*)

| Section | Clarity | Trust | Naturalness | Brevity | CTA | Cultural fit | Total |
|---|---|---|---|---|---|---|---|
| v29.why.s1 (title + text) | 5 | 4 | 5 | 4 | 4 | 4 | 26/30 |
| v29.why.s3 (title + text) | 5 | 5 | 4 | 4 | 4 | 4 | 26/30 |

## Unsure

- "notarialbestyrkande" för 공증 — korrekt men formellt.
- "1 bokning" som enhet för en flygplatshämtning.
- "studiekonsultation" för 진단 상담 i stället för ordagrant "diagnoskonsultation".

## Counts

- Job keys: 158 (all had `current: null`)
- Kept verbatim: 0
- Rewritten: 0
- Newly translated: 158
- Extra CLDR plural forms added: 0

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
