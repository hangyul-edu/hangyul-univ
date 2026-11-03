# Myanmar — synthetic student simulation (V13)

> **This is a synthetic simulation, not user research.** No person from Myanmar was interviewed, observed
> or surveyed. The persona is authored; the journey is walked against the running product by the author. What
> is measured rather than imagined is marked **measured** and comes from
> `scripts/qa/v13-country-probe.mjs` and the product's own country data. Treat every behavioural claim here as
> a hypothesis worth testing with real applicants, and nothing here as evidence that it is true.

## Persona

**Thiri Aung, 19, Mandalay**

Finished high school, wants a language course then a degree. No TOPIK yet. Budget very tight (~₩11M/yr), mother is the sponsor. Intermittent electricity and expensive mobile data. Reads Burmese; English is a struggle.

## What the product actually does for this market

| | |
|---|---|
| Legalization route | **Consular legalization** — not a Hague Apostille Convention member. Every academic document goes through the issuing body, the national ministries and the Korean diplomatic post. |
| Visa routes on file | D-2-2, D-2-3, D-4-1 (3 playbooks) |
| Diplomatic / visa-centre posts recorded | Embassy of the Republic of Korea in Myanmar |
| Student-app locale | `my` — **complete**, leak-checked |
| Public homepage language | **measured:** renders `lang=my`, direction `ltr`, copy in **English** |
| Primary CTA seen | **measured:** "Start my preparation" |
| Marketing count renders | **measured:** `200+` ✓ |
| Horizontal overflow @390 | **measured:** 0px |

## The journey, stage by stage

The fourteen stages in the brief were walked for this persona. Stages not listed below behaved the same as
for every other market and are not padded out here; a simulation that reports fourteen findings per country
is reporting its own template.

### Findings specific to Myanmar

**1. Consular legalization under an unstable administration**

Myanmar is not a Hague member. Beyond the normal consular chain, document issuance itself is slow and sometimes impossible, and a product that models legalization as a fixed number of days models a country that works.

**2. Burmese renders, the homepage does not**

The student app is complete in Burmese (`my`, 100% of the manifest, 0 leaks on 2026-10-10). The public homepage is English. Thiri's first experience of Hangyul is in a language she struggles with, and her second is in her own — which is the wrong way round, because the first is the one that decides whether there is a second.

**3. Data cost is a product constraint**

The homepage hero is a full-viewport photograph with three hand-made crops. That is the right call for the phone, and it is still the most expensive thing on a metered connection in this market. Worth measuring the phone payload against a data budget rather than against a time budget.

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
