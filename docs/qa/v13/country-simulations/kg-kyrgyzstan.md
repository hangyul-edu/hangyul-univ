# Kyrgyzstan — synthetic student simulation (V13)

> **This is a synthetic simulation, not user research.** No person from Kyrgyzstan was interviewed, observed
> or surveyed. The persona is authored; the journey is walked against the running product by the author. What
> is measured rather than imagined is marked **measured** and comes from
> `scripts/qa/v13-country-probe.mjs` and the product's own country data. Treat every behavioural claim here as
> a hypothesis worth testing with real applicants, and nothing here as evidence that it is true.

## Persona

**Aizada Toktogulova, 19, Bishkek**

Finished school. Wants medicine or nursing. TOPIK 1. Budget ~₩12M/yr, tight; mother works in Russia. Reads Kyrgyz and Russian; little English.

## What the product actually does for this market

| | |
|---|---|
| Legalization route | **Apostille**, in force since 2011-07-31. |
| Visa routes on file | D-2, D-4-1 (2 playbooks) |
| Diplomatic / visa-centre posts recorded | Embassy of the Republic of Korea in the Kyrgyz Republic |
| Student-app locale | `ky` — **complete**, leak-checked |
| Public homepage language | **measured:** renders `lang=ky`, direction `ltr`, copy in **Russian — the owner's own writing, via the V13 fallback chain** |
| Primary CTA seen | **measured:** "\u041d\u0430\u0447\u0430\u0442\u044c \u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043a\u0443" |
| Marketing count renders | **measured:** `200+` ✓ |
| Horizontal overflow @390 | **measured:** 0px |

## The journey, stage by stage

The fourteen stages in the brief were walked for this persona. Stages not listed below behaved the same as
for every other market and are not padded out here; a simulation that reports fourteen findings per country
is reporting its own template.

### Findings specific to Kyrgyzstan

**1. Third instance of the Russian fallback finding — which makes it a pattern, not a case**

Uzbekistan, Kazakhstan and Kyrgyzstan between them are a large share of this product's addressable market, all read Russian, all have complete owner-written Russian copy available, and all are currently served English. **One fallback-chain change serves three markets.** This was the single highest-value i18n finding in the V13 pass, it cost no translation, and it is done: measured 3 of 14 markets now reading the owner's own Russian, up from 0.

**2. Remittance sponsorship**

A mother working in Russia is the sponsor. Same shape as Bangladesh: the money is real, the documentation is awkward, and the product's sponsor model assumes a cleaner arrangement.

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
