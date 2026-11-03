# Bangladesh — synthetic student simulation (V13)

> **This is a synthetic simulation, not user research.** No person from Bangladesh was interviewed, observed
> or surveyed. The persona is authored; the journey is walked against the running product by the author. What
> is measured rather than imagined is marked **measured** and comes from
> `scripts/qa/v13-country-probe.mjs` and the product's own country data. Treat every behavioural claim here as
> a hypothesis worth testing with real applicants, and nothing here as evidence that it is true.

## Persona

**Nusrat Jahan, 19, Chattogram**

HSC complete. Wants a bachelor's. No TOPIK. Budget ~₩12M/yr — tight, brother in Malaysia sends money. Budget Android, shared Wi-Fi. Reads Bengali; functional English.

## What the product actually does for this market

| | |
|---|---|
| Legalization route | **Apostille**, in force since 2025-03-30 — recent enough that second-hand advice is likely to predate it. |
| Visa routes on file | D-2-2, D-2-3, D-4-1 (3 playbooks) |
| Diplomatic / visa-centre posts recorded | Embassy of the Republic of Korea in Bangladesh (decides on the visa; intake via KVAC Dhaka), Korea Visa Application Center Dhaka (KVAC, operated by VFS Global) |
| Student-app locale | `bn` — **complete**, leak-checked |
| Public homepage language | **measured:** renders `lang=bn`, direction `ltr`, copy in **English** |
| Primary CTA seen | **measured:** "Start my preparation" |
| Marketing count renders | **measured:** `200+` ✓ |
| Horizontal overflow @390 | **measured:** 0px |

## The journey, stage by stage

The fourteen stages in the brief were walked for this persona. Stages not listed below behaved the same as
for every other market and are not padded out here; a simulation that reports fourteen findings per country
is reporting its own template.

### Findings specific to Bangladesh

**1. Found the two-script bug**

Nusrat's sweep is the one that caught the homepage rendering *২০০+ Korean universities* — a Bengali numeral inside an English sentence. Fixed in V13 (`copyLocale`), and the regression now asserts `bn` alongside `ko` and `en`. **This was invisible to every existing gate**: nothing was missing, overflowing or untranslated.

**2. The accession note was silent for this market, and that is the real V13 legalization finding**

Bangladesh joined on **2025-03-30** — 567 days ago. Every piece of second-hand advice Nusrat receives predates it.

The product explains an accession only for **365 days** afterwards. Measured across all fourteen markets on 2026-10-18, that window fired for Vietnam (37 days) and for nobody else, while Bangladesh, China (1,076 days) and Pakistan (1,319) are all recent enough that informal advice reliably predates the change. 365 days is roughly how long a consular-legalised *document* stays in circulation, which is not what the note is about: the note is about what an older sibling remembers, and that has a much longer half-life.

*What should change:* Fixed in V13: `APOSTILLE_NOTE_DAYS = 3 * 365`. Bangladesh now gets the note; Indonesia (1,597 days) and Pakistan correctly still do not. A second defect surfaced while checking it — a country with an explicit `LegalizationRule` row never reached the accession branch at all. China has such a row, and its own verified note already explains the 2023 accession in more detail, so nothing regressed there; the two sources are now reconciled with the verified rule kept as the primary one.

**3. Sponsor is a sibling abroad**

The sponsor model assumes a parent or a self-funded student. A brother in a third country, remitting, is both the common case here and the one most likely to be questioned at the visa stage.

### Findings this market shares with every other

1. **The public homepage is in English for 11 of the 14 markets.** Measured. The owner's copy exists in
   Korean and Russian; English is an AI translation of it; the remaining 52 locales render that English.
   V13 reduced this from 14 by adding a Russian fallback chain for Uzbek, Kazakh, Kyrgyz and Tajik — those
   three markets now read the owner's own Russian rather than a translation of it, at no translation cost.
   For the other eleven this is a translation dependency, not a defect in code, and it remains the largest
   single gap between what this product can do and what a first-time visitor experiences.
2. **No locale is human-reviewed.** Carried from §92.3. Every non-Korean, non-Russian string this persona
   reads was machine-drafted and AI-reviewed.
3. **The first screen now asks for the right thing.** Before V13 the hero's filled button was *대학 둘러보기*
   and the other one said *로그인*. For a visitor who has not decided to study in Korea yet, neither is the
   action that matters. It is now *내 유학 준비* / *Start my preparation*.

## Measurements taken

| Measure | Result |
|---|---|
| Homepage renders without horizontal overflow @390 | pass |
| Primary CTA present and first in the hero | pass |
| Marketing count in the script of its own sentence | pass |
| Student-app locale gate (100% manifest + 0-leak scan) | pass |
| Visa route resolvable for this nationality | pass |
| Legalization rule resolvable and time-versioned | pass |
