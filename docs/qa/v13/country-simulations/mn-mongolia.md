# Mongolia — synthetic student simulation (V13)

> **This is a synthetic simulation, not user research.** No person from Mongolia was interviewed, observed
> or surveyed. The persona is authored; the journey is walked against the running product by the author. What
> is measured rather than imagined is marked **measured** and comes from
> `scripts/qa/v13-country-probe.mjs` and the product's own country data. Treat every behavioural claim here as
> a hypothesis worth testing with real applicants, and nothing here as evidence that it is true.

## Persona

**Battsetseg Narantsogt, 21, Ulaanbaatar**

Graduated, worked a year. Wants a master's. TOPIK 4 — strong. Budget ~₩20M/yr, self-funded plus parents. Good English. Already knows two people studying in Daegu.

## What the product actually does for this market

| | |
|---|---|
| Legalization route | **Apostille**, in force since 2009-12-31. |
| Visa routes on file | D-2-2, D-2-3, D-4-1 (3 playbooks) |
| Diplomatic / visa-centre posts recorded | Embassy of the Republic of Korea in Mongolia |
| Student-app locale | `mn` — **complete**, leak-checked |
| Public homepage language | **measured:** renders `lang=mn`, direction `ltr`, copy in **English** |
| Primary CTA seen | **measured:** "Start my preparation" |
| Marketing count renders | **measured:** `200+` ✓ |
| Horizontal overflow @390 | **measured:** 0px |

## The journey, stage by stage

The fourteen stages in the brief were walked for this persona. Stages not listed below behaved the same as
for every other market and are not padded out here; a simulation that reports fourteen findings per country
is reporting its own template.

### Findings specific to Mongolia

**1. The best-prepared persona in this set, and the one the product serves most generically**

TOPIK 4 and a graduate degree make Battsetseg eligible for far more than the typical applicant, and nothing on the public site reflects that until she creates a profile. The early-answer path (`/start`) is right; V13's hero change is what finally points at it.

**2. Apostille since 2009 — no friction, and that is worth knowing**

Not every market has a legalization problem. Recording where there is none keeps the simulation honest and stops 'legalization' being treated as a universal blocker.

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
