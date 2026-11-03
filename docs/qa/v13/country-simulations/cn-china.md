# China — synthetic student simulation (V13)

> **This is a synthetic simulation, not user research.** No person from China was interviewed, observed
> or surveyed. The persona is authored; the journey is walked against the running product by the author. What
> is measured rather than imagined is marked **measured** and comes from
> `scripts/qa/v13-country-probe.mjs` and the product's own country data. Treat every behavioural claim here as
> a hypothesis worth testing with real applicants, and nothing here as evidence that it is true.

## Persona

**Li Wenjing (李文静), 18, Jinan**

Gaokao taken, score mid-range. Wants business or design. HSK-oriented background, TOPIK 1. Budget ~₩25M/yr — the highest here. Strong phone, no Google services, uses WeChat for everything.

## What the product actually does for this market

| | |
|---|---|
| Legalization route | **Apostille**, in force since 2023-11-07 — recent enough that second-hand advice is likely to predate it. |
| Visa routes on file | D-2-2, D-2-3, D-4-1 (3 playbooks) |
| Diplomatic / visa-centre posts recorded | Consulate General in Chengdu, Consulate General in Guangzhou (visa intake at Korea Visa Application Center Guangzhou, visaforkorea-gz.com), Consulate General in Qingdao, Consulate General in Shanghai, Consulate General in Shenyang (visa intake at Korea Visa Application Center Shenyang, visaforkorea-shenyang.com), Consulate General in Wuhan, Consulate General in Xi'an, Dalian Office (출장소) of the Consulate General in Shenyang, Embassy of the Republic of Korea in China (visa intake at Korea Visa Application Center Beijing, visaforkorea-bj.com) |
| Student-app locale | `zh-Hans` — **complete**, leak-checked |
| Public homepage language | **measured:** renders `lang=zh-Hans`, direction `ltr`, copy in **English** |
| Primary CTA seen | **measured:** "Start my preparation" |
| Marketing count renders | **measured:** `200+` ✓ |
| Horizontal overflow @390 | **measured:** 0px |

## The journey, stage by stage

The fourteen stages in the brief were walked for this persona. Stages not listed below behaved the same as
for every other market and are not padded out here; a simulation that reports fourteen findings per country
is reporting its own template.

### Findings specific to China

**1. Apostille since 2023-11-07, and this market is better served than the generic path**

China is one of five countries with an explicit, verified `LegalizationRule` row, and its own note — *'China has applied the Apostille Convention since 7 Nov 2023. Many universities also accept …'* — says more than the generic accession sentence would. Checked rather than assumed: a first pass at the V13 legalization fix would have **replaced** that richer note with the generic one, because the client renders the translated note code *instead of* the rule's own text. The fix was corrected to attach a code only where a rule has nothing of its own to say.

**2. The product assumes services this market cannot reach**

No Google, no WhatsApp. Anything that depends on a Google font CDN, a Google Maps tile, or a notification path through FCM degrades or fails. This is an infrastructure question the product has never been measured against, and it affects the market with the largest budget.

**3. Name order and script**

`full_name` is one field. A Chinese applicant's name exists in hanzi, in pinyin on the passport, and sometimes in a chosen English given name — three strings for one person, which is exactly what the V13 identity-consistency work is about.

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
