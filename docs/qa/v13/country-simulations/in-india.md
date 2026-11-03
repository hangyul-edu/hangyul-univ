# India — synthetic student simulation (V13)

> **This is a synthetic simulation, not user research.** No person from India was interviewed, observed
> or surveyed. The persona is authored; the journey is walked against the running product by the author. What
> is measured rather than imagined is marked **measured** and comes from
> `scripts/qa/v13-country-probe.mjs` and the product's own country data. Treat every behavioural claim here as
> a hypothesis worth testing with real applicants, and nothing here as evidence that it is true.

## Persona

**Ananya Reddy, 20, Hyderabad**

Second year of a BTech, wants to transfer or do a master's. No Korean. Budget ~₩19M/yr, education loan. Excellent English — would rather read English than Hindi.

## What the product actually does for this market

| | |
|---|---|
| Legalization route | **Apostille**, in force since 2005-07-14. |
| Visa routes on file | D-2-2, D-2-3, D-4-1 (3 playbooks) |
| Diplomatic / visa-centre posts recorded | Consulate General of the Republic of Korea in Chennai (applications via KVAC-VFS Chennai / Bengaluru), Consulate General of the Republic of Korea in Mumbai (from 2026-10-01 via designated travel agencies only), Embassy of the Republic of Korea in India (applications via VFS Global Korea Visa Application Centre, New Delhi or Kolkata) |
| Student-app locale | `hi` — **complete**, leak-checked |
| Public homepage language | **measured:** renders `lang=hi`, direction `ltr`, copy in **English** |
| Primary CTA seen | **measured:** "Start my preparation" |
| Marketing count renders | **measured:** `200+` ✓ |
| Horizontal overflow @390 | **measured:** 0px |

## The journey, stage by stage

The fourteen stages in the brief were walked for this persona. Stages not listed below behaved the same as
for every other market and are not padded out here; a simulation that reports fourteen findings per country
is reporting its own template.

### Findings specific to India

**1. Hindi is not the answer**

The student app is complete in Hindi. Ananya reads English by preference and may not read Devanagari comfortably at all; a product that detects `hi` from her phone and switches is worse for her, not better. **Language should follow the account's choice, not the device's guess** — which the student app already does. The homepage does not ask.

**2. Degree-level mismatch is the real friction**

A BTech transfer into a Korean university is governed by credit-transfer rules the product does not model. `ELIG_EDUCATION` will say 'the program needs a qualification you don't have yet', which is true and unhelpful for a transfer case.

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
