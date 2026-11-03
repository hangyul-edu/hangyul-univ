# V27 l10n review — Swedish (sv)

Scope: all 729 strings of `scripts/i18n/v27/strings.json` (215 new, 514 changed). Output: `scripts/i18n/v27/tx/sv.json`.
Register: **du**, matching the existing `packages/i18n/locales/sv/` bundle ("Fortsätt där du slutade"). Student-facing copy is
warm and plain ("plugga" in a few headline spots, "studera" elsewhere), as Swedish youth-facing study sites write.
Changed keys were translated fresh from the new English (Korean consulted for ambiguity), not patched from the old Swedish.

## Personas

| Persona | Who | Reads for |
| --- | --- | --- |
| **Elsa, 19, Göteborg** | just finished gymnasiet, wants a Korean language year then a kandidatprogram | friendly du-copy, short buttons |
| **Ahmed, 28, Stockholm** | civilingenjör, applying for an English-taught master's | precise visa/document terms (apostille, konsulär legalisering, bevis på ekonomiska medel) |
| **Karin, 51, Elsas mamma** | pays the studieavgift, reads payment/refund text | clear money wording, no admission promises |

## Glossary

| English | Swedish (chosen) | Note |
| --- | --- | --- |
| scholarship | stipendium / stipendier | matches bundle |
| Global Korea Scholarship (GKS) | Global Korea Scholarship (GKS, koreanskt statligt stipendium) | no established Swedish name; official name kept, gloss in the category label |
| admission guide (모집요강) | antagningsinformation | the term Swedish universities use |
| apostille / Apostille Convention | apostille (pl. apostiller) / Apostillkonventionen | |
| consular legalization (영사확인) | konsulär legalisering / konsulärt legaliserat | matches bundle |
| certificate of admission / admission letter | antagningsbesked | matches bundle |
| Korean language institute | språkinstitut (för koreanska) | matches bundle |
| program(me) | program; språkprogram | matches bundle |
| counselor | rådgivare ("din rådgivare") | matches bundle |
| Hangyul team | Hangyul-teamet | |
| plan (paid) | paket | matches bundle |
| deadline | sista dag | matches bundle |
| proof of funds | bevis på ekonomiska medel | |
| bank balance certificate | intyg om banksaldo / bankintyg | matches bundle |
| residence card | uppehållskort | matches bundle |
| tuition | studieavgift | matches bundle |
| match / strong match | matchning / stark matchning | matches bundle |
| Recommended (sort) | Rekommenderas | matches bundle; defined as "ingen rankning, en ordning att bläddra i" |
| immigration office | migrationskontor | matches bundle |
| TB certificate | tbc-intyg | |
| business registration certificate | registreringsbevis | |

## Pass A — meaning (8 strings changed)

| Key | Before | After |
| --- | --- | --- |
| student:services.success.assignedText | Hangyul-teamet hälsar på dig i Meddelanden… | Hangyul-teamet hör av sig i Meddelanden… ("hälsa på" = visit) |
| common:uni27.service.COUNSELING | Kurator och rådgivning | Rådgivning (draft added "kurator") |
| visaroute:doc.business_registration.why | Universitetets organisationsregistrering… | Universitetets registreringsbevis… (it is a document) |
| student:v4.gap.degree | {{program}}-program, men du letar efter {{target}} | Programmet är på nivån {{program}}, men du letar efter {{target}} ({{program}} is a degree level) |
| marketing:proof.match.text | …och det du inte uppfyller… | …och det krav du inte uppfyller… |

Others: `v9.funds.waived` "frågar efter" → "kräver"; `summary.S_OPTIONAL` "stärka" → "hjälpa" (no overstatement); `english_levels` says "utbildningar" (degree programmes, not degrees).

## Pass B — native naturalness (14 strings changed)

| Key | Before | After |
| --- | --- | --- |
| marketing:matching.lede | …förklarar varje resultat på ren svenska… | …förklarar varje resultat med enkla ord… |
| marketing:agencyNet.title | …noggrant utvalda och ansvarsskyldiga. | …noggrant utvalda och som tar ansvar. |
| marketing:trust.lede | Så här håller vi det du läser korrekt… | Så här ser vi till att det du läser stämmer… |
| common:fit.reason.met_track | …för program med Undervisning på koreanska. | …för program (Koreanskspråkig). (track labels now adjectives) |
| student:legalFlow.step.consular.title | Låt dokumentet konsulärt legaliseras vid… | Få dokumentet konsulärt legaliserat vid… |

## Pass C — UI context, brevity, consistency (10 strings changed)

| Key | Before | After |
| --- | --- | --- |
| common:fit.sort.label | Sortera | Sortera efter |
| visaroute:docStatus.EXPIRED | Har gått ut, skaffa ett nytt | Utgånget, skaffa nytt |
| student:home.docAction.RENEW | Har gått ut. Förnya | Utgånget. Förnya |
| common:fit.level.COMBINED | Integrerad master och doktor | Integrerad master och doktorsexamen (same as `degree.COMBINED`) |
| common:fit.level.LANGUAGE | Koreanska språkprogram | Koreanskt språkprogram (one term for 어학 programs across keys) |

## Final comparison (source ↔ target)

All 729 strings re-read against English (and Korean where the English was ambiguous); no further changes. Automated
cross-check: every test name, visa code, office name, number and email in the English is present in the Swedish (0 flagged).
No admission-probability or guarantee wording. Placeholders and `<em>` identical. Validator:
`node scripts/i18n/v27/validate.mjs --only=sv` → 729 valid, 0 problems.

## Unsure

- Government tier names ”excellent” / ”certified” / ”consulting” kept in English inside quotes (as the source does); Swedish readers will understand them but a native reviewer may prefer translated tier names.
- `fit.level.TRANSFER` "Kandidat (överflyttning)": closest Swedish term for 편입.
- "plugga" vs "studera": used "plugga" only in the quick-check questions, taglines and hero; a reviewer may want "studera" throughout.
- Base plural keys (`uni27.schol.count`, `fit.unlock`, `group.readyCount`, `summary.*`) use "label: {{count}}" / "({{count}})" so they work for any count.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Inget språkresultat krävs för att söka. Efter antagningen behöver du {{tests}} eller högre.
- `fit.reason.far` → Kräver {{options}} eller högre, långt över ditt nuvarande resultat.
- `fit.tier.UNCLEAR.title` → Långt kvar just nu
- `fit.tier.UNCLEAR.short` → Mer förberedelse
- `fit.tier.UNCLEAR.lede` → Ditt nuvarande resultat ligger långt under det publicerade kravet. Ge dig mer tid att förbereda dig och kolla sedan igen.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
