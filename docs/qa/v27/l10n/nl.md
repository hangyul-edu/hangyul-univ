# V27 l10n review — Dutch (nl)

Scope: all 729 strings of `scripts/i18n/v27/strings.json` (215 new, 514 changed). Output: `scripts/i18n/v27/tx/nl.json`.
Register: informal **je/jij**, matching the existing `packages/i18n/locales/nl/` bundle ("Ga verder waar je gebleven was").
Changed keys were translated fresh from the new English (Korean consulted for ambiguity), not patched from the old Dutch.

## Personas

| Persona | Who | Reads for |
| --- | --- | --- |
| **Noor, 18, Utrecht** | vwo-leerling, wants a Korean-taught bachelor after a year at a language institute | plain, friendly je-copy; short buttons |
| **Daan, 26, Eindhoven** | software engineer, applying for an English-taught master's | correct visa/document terms (apostille, consulaire legalisatie, bewijs van financiële middelen) |
| **Marieke, 50, Noors moeder** | pays collegegeld, reads payment and refund copy | clear money wording, no promises about admission |

## Glossary

| English | Dutch (chosen) | Note |
| --- | --- | --- |
| scholarship | beurs | matches bundle "Beurzen" |
| Global Korea Scholarship (GKS) | Global Korea Scholarship (GKS, overheidsbeurs) | no established Dutch name; official name kept, gloss in the category label |
| admission guide (모집요강) | toelatingsgids | |
| apostille / Apostille Convention | apostille / Apostilleverdrag | |
| consular legalization (영사확인) | consulaire legalisatie / consulair legaliseren | matches bundle |
| certificate of admission / admission letter | toelatingsbrief | matches bundle |
| Korean language institute | (Koreaans) taleninstituut | matches bundle |
| program(me) | opleiding; taalprogramma for language programs | matches bundle "Opleidingen" |
| counselor | adviseur ("je adviseur") | matches bundle |
| Hangyul team | Hangyul-team | |
| plan (paid) | pakket | matches bundle |
| deadline | deadline | common in Dutch higher-ed |
| proof of funds | bewijs van financiële middelen | |
| bank balance certificate | bankverklaring (van je saldo) | matches bundle |
| residence card | verblijfskaart | matches bundle |
| tuition | collegegeld | matches bundle |
| match / strong match | match / sterke match | matches bundle |
| Recommended (sort) | Aanbevolen | defined as "geen ranglijst, een volgorde om door te bladeren" |
| immigration office | immigratiekantoor | matches bundle |
| TB certificate | tbc-verklaring | |
| apply (for a programme) / apply (for a visa) | je aanmelden / aanvragen | |

## Pass A — meaning (12 strings changed)

| Key | Before | After |
| --- | --- | --- |
| student:start.result.none | Nog geen enkele opleiding voldoet aan alle gepubliceerde eisen… | Er is nog geen vermelde opleiding waarvan je aan alle gepubliceerde eisen voldoet… (subject was wrong) |
| student:v9.announced.rule.TOPIK4_FINANCIAL_EXEMPTION | …hoeven voor het visum geen financiële middelen aan te tonen. | …zouden … geen financiële middelen meer hoeven aan te tonen. (announced, not in force) |
| common:fit.reason.several | Nog nodige taaleisen: {{count}}. | Taaleisen waaraan je nog niet voldoet: {{count}}. |
| visaroute:reason.GET_LATER | …Haal het op of na {{date}}… | …Vraag het aan op of na {{date}}… ("ophalen" read as "pick up") |
| marketing:home.show.match.p1 | Toelaatbaar, haalbaar of nog niet | Toelaatbaar, bijna of nog niet ("haalbaar" overstated a reach) |

Others: NHIS line names the insurance explicitly; refund rule also conditional; `route.feeUnknown` says "visumkosten"; `uni27.schol.renewal` names the beurs; `v20.uni.match.degree` says "biedt onderwijs op het niveau".

## Pass B — native naturalness (14 strings changed)

| Key | Before | After |
| --- | --- | --- |
| student:services.success.assignedText | Het Hangyul-team zegt hallo in Berichten… | Het Hangyul-team stelt zich voor in Berichten… |
| marketing:agenciesPage.valueLede | Minder achter mensen aan zitten, meer advies geven. | Minder nabellen, meer adviseren. |
| common:uni27.cat.ACADEMIC | Studieresultaatbeurzen | Beurzen voor studieresultaten |
| student:dashboard.nextAction.TASK.text.APPLICATION_SUBMIT | Dien in wanneer je er klaar voor bent. | Dien in wanneer het jou uitkomt. |
| marketing:trustStrip.title | Gebouwd op officiële bronnen, niet op horen zeggen | Gebaseerd op officiële bronnen, niet op geruchten |

## Pass C — UI context, brevity, consistency (17 strings changed)

| Key | Before | After |
| --- | --- | --- |
| student:legalFlow.step.consular.title | Laat consulaire legalisatie doen bij… | Laat het consulair legaliseren bij… (same verb as the document line `v27.doc.legal.CONSULAR`) |
| common:fit.family.KOREAN | Toets Koreaans | Taaltoets Koreaans (4 labels aligned) |
| visaroute:docStatus.EXPIRED | Verlopen, vraag een nieuwe aan | Verlopen, nieuwe aanvragen (status chips in infinitive style) |
| common:fit.saved | {{name}} verwijderen uit bewaard | {{name}} niet meer bewaren |
| common:uni27.schol.dorm | woonondersteuning | woonsteun (same word as the housing category) |

## Final comparison (source ↔ target)

All 729 strings re-read against English (and Korean where the English was ambiguous); no further changes. Automated
cross-check: every test name, visa code, office name, number and email in the English is present in the Dutch (0 flagged).
No admission-probability or guarantee wording. Placeholders and `<em>` identical. Validator:
`node scripts/i18n/v27/validate.mjs --only=nl` → 729 valid, 0 problems.

## Unsure

- `fit.level.TRANSFER` "Bachelor (instroom hoger jaar)": Dutch has no single term for Korean 편입.
- `v9.funds.longer_*`: government tier name kept as ‘consulting’ in quotes (English loanword is understood in Dutch).
- `uni27.service.COUNSELING` "Studentenbegeleiding": Korean 상담 covers both personal and study counselling; this is the usual Dutch umbrella term.
- Base plural keys (`uni27.schol.count`, `fit.unlock`, `group.readyCount`, `summary.*`) use "label: {{count}}" / "({{count}})" so they read correctly for any count.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Voor je aanmelding is geen taalscore nodig. Na je toelating heb je {{tests}} of hoger nodig.
- `fit.reason.far` → Vereist {{options}} of hoger, ruim boven je huidige score.
- `fit.tier.UNCLEAR.title` → Voorlopig nog een lange weg
- `fit.tier.UNCLEAR.short` → Meer voorbereiding
- `fit.tier.UNCLEAR.lede` → Je huidige score ligt ruim onder de gepubliceerde eis. Neem meer tijd om je voor te bereiden en kijk dan opnieuw.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
