# Thailand — synthetic student simulation (V13)

> **This is a synthetic simulation, not user research.** No person from Thailand was interviewed, observed
> or surveyed. The persona is authored; the journey is walked against the running product by the author. What
> is measured rather than imagined is marked **measured** and comes from
> `scripts/qa/v13-country-probe.mjs` and the product's own country data. Treat every behavioural claim here as
> a hypothesis worth testing with real applicants, and nothing here as evidence that it is true.

## Persona

**Napat Siriwan (ณภัทร), 20, Chiang Mai**

Second year at a Thai university, wants to transfer. TOPIK 2. Budget ~₩21M/yr, parents. Reads Thai; moderate English.

## What the product actually does for this market

| | |
|---|---|
| Legalization route | **Consular legalization until 2027-02-28**, apostille afterwards. The rule changes during the current application cycle, so the correct answer depends on the date the document is used, not on today. |
| Visa routes on file | D-2, D-4-1 (2 playbooks) |
| Diplomatic / visa-centre posts recorded | Embassy of the Republic of Korea in Thailand |
| Student-app locale | `th` — **complete**, leak-checked |
| Public homepage language | **measured:** renders `lang=th`, direction `ltr`, copy in **English** |
| Primary CTA seen | **measured:** "Start my preparation" |
| Marketing count renders | **measured:** `200+` ✓ |
| Horizontal overflow @390 | **measured:** 0px |

## The journey, stage by stage

The fourteen stages in the brief were walked for this persona. Stages not listed below behaved the same as
for every other market and are not padded out here; a simulation that reports fourteen findings per country
is reporting its own template.

### Findings specific to Thailand

**1. The only market in this set where the rule changes in the future**

Thailand's apostille accession takes effect **2027-02-28** — four months from today. Napat is applying for a Spring 2027 intake, so her documents are prepared under consular rules and her *visa* may be processed after the switch. The product versions this correctly (`apostille_effective_from` is compared against the date in question, not against today).

*What should change:* This is the case that justifies the time-versioned design, and it should be *tested* at a date either side of 2027-02-28 rather than only at today's date. A unit test pinned to 2027-03-01 is cheap insurance for a rule that will silently change for every Thai applicant on one specific morning.

**2. Thai script and line breaking**

Thai has no spaces between words. Narrow table cells and chips need `word-break` handling the way Korean does; V12 fixed this for Korean (`keep-all`) and did not check Thai.

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
