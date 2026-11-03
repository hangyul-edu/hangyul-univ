# Pakistan — synthetic student simulation (V13)

> **This is a synthetic simulation, not user research.** No person from Pakistan was interviewed, observed
> or surveyed. The persona is authored; the journey is walked against the running product by the author. What
> is measured rather than imagined is marked **measured** and comes from
> `scripts/qa/v13-country-probe.mjs` and the product's own country data. Treat every behavioural claim here as
> a hypothesis worth testing with real applicants, and nothing here as evidence that it is true.

## Persona

**Hassan Raza, 22, Lahore**

BSc complete, wants a master's in CS. No Korean. Budget ~₩15M/yr, family. Strong English. Reads Urdu.

## What the product actually does for this market

| | |
|---|---|
| Legalization route | **Apostille**, in force since 2023-03-09. |
| Visa routes on file | D-2-2, D-2-3, D-4-1 (3 playbooks) |
| Diplomatic / visa-centre posts recorded | Embassy of the Republic of Korea in Pakistan, Karachi Office of the Embassy of the Republic of Korea in Pakistan |
| Student-app locale | `ur` — **complete**, leak-checked |
| Public homepage language | **measured:** renders `lang=ur`, direction `rtl`, copy in **English** |
| Primary CTA seen | **measured:** "Start my preparation" |
| Marketing count renders | **measured:** `200+` ✓ |
| Horizontal overflow @390 | **measured:** 0px |

## The journey, stage by stage

The fourteen stages in the brief were walked for this persona. Stages not listed below behaved the same as
for every other market and are not padded out here; a simulation that reports fourteen findings per country
is reporting its own template.

### Findings specific to Pakistan

**1. RTL works, and that is a measured result not an assumption**

At 390px with `lang=ur` the homepage renders `dir=rtl` with **0px horizontal overflow**, and the hero scrim mirrors (the `[dir='rtl'] .kn-hero::after` rule). V13's new `--quiet-onphoto` secondary and the phone CTA stack were re-measured in RTL rather than assumed.

**2. Apostille since 2023-03-09**

Recent; the same stale-advice problem as China and Vietnam.

**3. Visa processing for this market is where the real wait is**

Nothing in the interface is wrong here. The honest finding is that the product's job in this market is expectation-setting, and a route that cannot give a realistic duration is giving false comfort.

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
