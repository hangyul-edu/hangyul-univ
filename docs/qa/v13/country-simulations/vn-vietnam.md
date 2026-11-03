# Vietnam — synthetic student simulation (V13)

> **This is a synthetic simulation, not user research.** No person from Vietnam was interviewed, observed
> or surveyed. The persona is authored; the journey is walked against the running product by the author. What
> is measured rather than imagined is marked **measured** and comes from
> `scripts/qa/v13-country-probe.mjs` and the product's own country data. Treat every behavioural claim here as
> a hypothesis worth testing with real applicants, and nothing here as evidence that it is true.

## Persona

**Trần Thu Hà, 18, Hải Phòng**

Just finished lớp 12. Wants a BBA. TOPIK 2, studying for 3. Family budget ~₩18M/yr, father works in Japan and sends money. Android mid-range phone, 4G, data-conscious. Reads English slowly; reads Vietnamese fluently. Knows Korea from music and drama, not from its universities.

## What the product actually does for this market

| | |
|---|---|
| Legalization route | **Apostille**, in force since 2026-09-11 — recent enough that second-hand advice is likely to predate it. |
| Visa routes on file | D-2-2, D-2-3, D-4-1 (3 playbooks) |
| Diplomatic / visa-centre posts recorded | Consulate General of the Republic of Korea in Da Nang, Consulate General of the Republic of Korea in Ho Chi Minh City (applications via HCMC KVAC), Embassy of the Republic of Korea in Viet Nam (applications via Hanoi KVAC) |
| Student-app locale | `vi` — **complete**, leak-checked |
| Public homepage language | **measured:** renders `lang=vi`, direction `ltr`, copy in **English** |
| Primary CTA seen | **measured:** "Start my preparation" |
| Marketing count renders | **measured:** `200+` ✓ |
| Horizontal overflow @390 | **measured:** 0px |

## The journey, stage by stage

The fourteen stages in the brief were walked for this persona. Stages not listed below behaved the same as
for every other market and are not padded out here; a simulation that reports fourteen findings per country
is reporting its own template.

### Findings specific to Vietnam

**1. Apostille switched on five weeks ago, and the product handles it — checked, not assumed**

Vietnam joined the Apostille Convention on **2026-09-11**, 37 days ago. Hà's older cousin was legalised through the consulate in March and told her to do the same.

The first draft of this simulation recorded a finding here: that the product tells her 'apostille' and never explains why her cousin is wrong. **That finding was false, and calling the function proved it.** `readiness.legalization_for(db, 'VN', …)` returns `note_code=JOINED` with the date, and the student app renders *'Vietnam joined the Apostille Convention on 2026-09-11. Documents legalized by the consulate before that date are generally still accepted — confirm with your university.'* V5 built this and it works.

It is recorded as a non-finding on purpose: a simulation that only reports problems is a simulation that invents them.

*What should change:* Nothing. What the check *did* find is one row below, in Bangladesh.

**2. Volume market, generic treatment**

Vietnam is the single largest source market in the seeded data and gets exactly the same homepage as every other market — in English.

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
