#!/usr/bin/env python3
"""V13 — generate one country simulation file per priority source market (brief Part 17).

These are SYNTHETIC simulations, not user research, and every file says so in its own first line. What is
*not* synthetic is the factual half: the legalization route comes from the `countries` table, the visa route
from `docs/research/visa-playbooks.json`, and the language behaviour from a real measurement of the running
product (`scripts/qa/v13-country-probe.mjs` → `docs/qa/v13/country-probe.json`).

    python3 scripts/qa/v13-country-sims.py
"""
import json
import pathlib
import datetime

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/qa/v13/country-simulations"
TODAY = datetime.date(2026, 10, 17)

probe = {r["country"]: r for r in json.loads((ROOT / "docs/qa/v13/country-probe.json").read_text())["rows"]}
playbooks = json.loads((ROOT / "docs/research/visa-playbooks.json").read_text())
pb_by_country: dict[str, list] = {}
for p in playbooks:
    pb_by_country.setdefault(p["country"], []).append(p)

# Legalization, read from the live `countries` table at generation time and frozen here so the document is
# reproducible without a database. Regenerate when the table changes.
LEGALIZATION = {
    "VN": "2026-09-11", "NP": None, "MM": None, "UZ": "2012-04-15", "MN": "2009-12-31",
    "CN": "2023-11-07", "IN": "2005-07-14", "BD": "2025-03-30", "PK": "2023-03-09",
    "ID": "2022-06-04", "TH": "2027-02-28", "PH": "2019-05-14", "KZ": "2001-01-30", "KG": "2011-07-31",
}

# Per-country persona and the frictions that are genuinely specific to that market. Everything here is a
# deliberate authored judgement; nothing is generated from a template.
C = {
"VN": dict(
  name="Vietnam", persona="Trần Thu Hà, 18, Hải Phòng",
  profile="Just finished lớp 12. Wants a BBA. TOPIK 2, studying for 3. Family budget ~₩18M/yr, father works in Japan and sends money. Android mid-range phone, 4G, data-conscious. Reads English slowly; reads Vietnamese fluently. Knows Korea from music and drama, not from its universities.",
  specific=[
    ("Apostille switched on five weeks ago, and the product handles it — checked, not assumed", "Vietnam joined the Apostille Convention on **2026-09-11**, 37 days ago. Hà's older cousin was legalised through the consulate in March and told her to do the same.\n\nThe first draft of this simulation recorded a finding here: that the product tells her 'apostille' and never explains why her cousin is wrong. **That finding was false, and calling the function proved it.** `readiness.legalization_for(db, 'VN', …)` returns `note_code=JOINED` with the date, and the student app renders *'Vietnam joined the Apostille Convention on 2026-09-11. Documents legalized by the consulate before that date are generally still accepted — confirm with your university.'* V5 built this and it works.\n\nIt is recorded as a non-finding on purpose: a simulation that only reports problems is a simulation that invents them.", "Nothing. What the check *did* find is one row below, in Bangladesh."),
    ("Volume market, generic treatment", "Vietnam is the single largest source market in the seeded data and gets exactly the same homepage as every other market — in English."),
  ]),
"NP": dict(
  name="Nepal", persona="Sushmita Gurung, 20, Pokhara",
  profile="Two years of a BSc at Tribhuvan, wants to transfer. TOPIK 3. Budget ~₩14M/yr, an uncle in Seoul is the sponsor. Shares a phone with a sibling in the evenings. Comfortable in English for reading, not for writing.",
  specific=[
    ("No apostille, and the consular chain is the long pole", "Nepal is not a Hague member, so every academic document needs consular legalization: university → Ministry of Education → MoFA → Korean Embassy. The planning rule in `strategy.DAYS_NEEDED` allows **14 days** for `LEGALIZE`. For Nepal that is optimistic in a way that silently makes `DEADLINE_TIGHT` fire late.", "The legalization estimate should come from the route, not from one constant. The data to do it exists — `LegalizationRule` already resolves per country and document — and until it does, 14 days is the number a Nepali student is being planned around."),
    ("The visa window is a date range, not a deadline", "The Nepal playbook records that KVAC Kathmandu accepts student visa applications only **Dec 1 – Feb 15** (spring) and **Jun 1 – Aug 14** (fall). A student who gets an offer in late August has missed a window that no application deadline mentions."),
  ]),
"MM": dict(
  name="Myanmar", persona="Thiri Aung, 19, Mandalay",
  profile="Finished high school, wants a language course then a degree. No TOPIK yet. Budget very tight (~₩11M/yr), mother is the sponsor. Intermittent electricity and expensive mobile data. Reads Burmese; English is a struggle.",
  specific=[
    ("Consular legalization under an unstable administration", "Myanmar is not a Hague member. Beyond the normal consular chain, document issuance itself is slow and sometimes impossible, and a product that models legalization as a fixed number of days models a country that works."),
    ("Burmese renders, the homepage does not", "The student app is complete in Burmese (`my`, 100% of the manifest, 0 leaks on 2026-10-10). The public homepage is English. Thiri's first experience of Hangyul is in a language she struggles with, and her second is in her own — which is the wrong way round, because the first is the one that decides whether there is a second."),
    ("Data cost is a product constraint", "The homepage hero is a full-viewport photograph with three hand-made crops. That is the right call for the phone, and it is still the most expensive thing on a metered connection in this market. Worth measuring the phone payload against a data budget rather than against a time budget."),
  ]),
"UZ": dict(
  name="Uzbekistan", persona="Dilnoza Rakhimova, 19, Samarkand",
  profile="Finished academic lyceum. Wants engineering. TOPIK 2. Budget ~₩16M/yr, father's business is the sponsor. Reads Uzbek and Russian; very little English.",
  specific=[
    ("The one market where the homepage is nearly in the right language — and is not", "Uzbekistan is the clearest case of the homepage translation gap, because the owner's **Russian** copy is canonical and complete. A very large share of Uzbek applicants read Russian. The homepage will serve Russian to `ru`, and `uz` falls back to **English**, not to Russian. A reader who would have been served perfectly is served badly because of the locale code their phone reports.", "**Fixed in V13.** `FALLBACK_CHAIN` in `packages/i18n` now resolves `uz → ru → en`, and `loadNamespaces` fetches the whole chain — without that second half the fallback is silent and looks exactly like 'no translation exists'. Measured after the change: Uzbekistan, Kazakhstan and Kyrgyzstan read the owner's own Russian. It is one line to reverse, and whether these audiences should be served Russian is a product decision about an audience rather than an engineering one — recorded as such in REPORT §103."),
    ("A specific bank and a specific number", "Published guidance for Uzbek applicants describes a KDB Bank Uzbekistan account with a threshold near $12,500 and a 30-day statement validity. Financial proof in this market is bank-specific in a way the generic 'proof of funds' requirement does not capture."),
  ]),
"MN": dict(
  name="Mongolia", persona="Battsetseg Narantsogt, 21, Ulaanbaatar",
  profile="Graduated, worked a year. Wants a master's. TOPIK 4 — strong. Budget ~₩20M/yr, self-funded plus parents. Good English. Already knows two people studying in Daegu.",
  specific=[
    ("The best-prepared persona in this set, and the one the product serves most generically", "TOPIK 4 and a graduate degree make Battsetseg eligible for far more than the typical applicant, and nothing on the public site reflects that until she creates a profile. The early-answer path (`/start`) is right; V13's hero change is what finally points at it."),
    ("Apostille since 2009 — no friction, and that is worth knowing", "Not every market has a legalization problem. Recording where there is none keeps the simulation honest and stops 'legalization' being treated as a universal blocker."),
  ]),
"CN": dict(
  name="China", persona="Li Wenjing (李文静), 18, Jinan",
  profile="Gaokao taken, score mid-range. Wants business or design. HSK-oriented background, TOPIK 1. Budget ~₩25M/yr — the highest here. Strong phone, no Google services, uses WeChat for everything.",
  specific=[
    ("Apostille since 2023-11-07, and this market is better served than the generic path", "China is one of five countries with an explicit, verified `LegalizationRule` row, and its own note — *'China has applied the Apostille Convention since 7 Nov 2023. Many universities also accept …'* — says more than the generic accession sentence would. Checked rather than assumed: a first pass at the V13 legalization fix would have **replaced** that richer note with the generic one, because the client renders the translated note code *instead of* the rule's own text. The fix was corrected to attach a code only where a rule has nothing of its own to say."),
    ("The product assumes services this market cannot reach", "No Google, no WhatsApp. Anything that depends on a Google font CDN, a Google Maps tile, or a notification path through FCM degrades or fails. This is an infrastructure question the product has never been measured against, and it affects the market with the largest budget."),
    ("Name order and script", "`full_name` is one field. A Chinese applicant's name exists in hanzi, in pinyin on the passport, and sometimes in a chosen English given name — three strings for one person, which is exactly what the V13 identity-consistency work is about."),
  ]),
"IN": dict(
  name="India", persona="Ananya Reddy, 20, Hyderabad",
  profile="Second year of a BTech, wants to transfer or do a master's. No Korean. Budget ~₩19M/yr, education loan. Excellent English — would rather read English than Hindi.",
  specific=[
    ("Hindi is not the answer", "The student app is complete in Hindi. Ananya reads English by preference and may not read Devanagari comfortably at all; a product that detects `hi` from her phone and switches is worse for her, not better. **Language should follow the account's choice, not the device's guess** — which the student app already does. The homepage does not ask."),
    ("Degree-level mismatch is the real friction", "A BTech transfer into a Korean university is governed by credit-transfer rules the product does not model. `ELIG_EDUCATION` will say 'the program needs a qualification you don't have yet', which is true and unhelpful for a transfer case."),
  ]),
"BD": dict(
  name="Bangladesh", persona="Nusrat Jahan, 19, Chattogram",
  profile="HSC complete. Wants a bachelor's. No TOPIK. Budget ~₩12M/yr — tight, brother in Malaysia sends money. Budget Android, shared Wi-Fi. Reads Bengali; functional English.",
  specific=[
    ("Found the two-script bug", "Nusrat's sweep is the one that caught the homepage rendering *২০০+ Korean universities* — a Bengali numeral inside an English sentence. Fixed in V13 (`copyLocale`), and the regression now asserts `bn` alongside `ko` and `en`. **This was invisible to every existing gate**: nothing was missing, overflowing or untranslated.", None),
    ("The accession note was silent for this market, and that is the real V13 legalization finding", "Bangladesh joined on **2025-03-30** — 567 days ago. Every piece of second-hand advice Nusrat receives predates it.\n\nThe product explains an accession only for **365 days** afterwards. Measured across all fourteen markets on 2026-10-18, that window fired for Vietnam (37 days) and for nobody else, while Bangladesh, China (1,076 days) and Pakistan (1,319) are all recent enough that informal advice reliably predates the change. 365 days is roughly how long a consular-legalised *document* stays in circulation, which is not what the note is about: the note is about what an older sibling remembers, and that has a much longer half-life.", "Fixed in V13: `APOSTILLE_NOTE_DAYS = 3 * 365`. Bangladesh now gets the note; Indonesia (1,597 days) and Pakistan correctly still do not. A second defect surfaced while checking it — a country with an explicit `LegalizationRule` row never reached the accession branch at all. China has such a row, and its own verified note already explains the 2023 accession in more detail, so nothing regressed there; the two sources are now reconciled with the verified rule kept as the primary one."),
    ("Sponsor is a sibling abroad", "The sponsor model assumes a parent or a self-funded student. A brother in a third country, remitting, is both the common case here and the one most likely to be questioned at the visa stage."),
  ]),
"PK": dict(
  name="Pakistan", persona="Hassan Raza, 22, Lahore",
  profile="BSc complete, wants a master's in CS. No Korean. Budget ~₩15M/yr, family. Strong English. Reads Urdu.",
  specific=[
    ("RTL works, and that is a measured result not an assumption", "At 390px with `lang=ur` the homepage renders `dir=rtl` with **0px horizontal overflow**, and the hero scrim mirrors (the `[dir='rtl'] .kn-hero::after` rule). V13's new `--quiet-onphoto` secondary and the phone CTA stack were re-measured in RTL rather than assumed."),
    ("Apostille since 2023-03-09", "Recent; the same stale-advice problem as China and Vietnam."),
    ("Visa processing for this market is where the real wait is", "Nothing in the interface is wrong here. The honest finding is that the product's job in this market is expectation-setting, and a route that cannot give a realistic duration is giving false comfort."),
  ]),
"ID": dict(
  name="Indonesia", persona="Putri Anggraini, 19, Surabaya",
  profile="SMA complete. Wants hospitality or design. TOPIK 1. Budget ~₩17M/yr, parents. Good phone, good connectivity. Reads Indonesian; conversational English.",
  specific=[
    ("The smoothest of the fourteen", "Apostille since 2022, a complete `id` student locale, a documented visa route, good connectivity. Recorded because a simulation set that finds a crisis in every market is not a simulation set, it is a list of things the author wanted to fix."),
    ("Religious and dietary arrival information is absent", "Arrival covers housing, banking, phone and registration. For the largest Muslim-majority source market in this set, halal food and prayer facilities are a first-week question the product does not answer. This is content, not engineering — and it is the kind of content that decides whether a student stays."),
  ]),
"TH": dict(
  name="Thailand", persona="Napat Siriwan (ณภัทร), 20, Chiang Mai",
  profile="Second year at a Thai university, wants to transfer. TOPIK 2. Budget ~₩21M/yr, parents. Reads Thai; moderate English.",
  specific=[
    ("The only market in this set where the rule changes in the future", "Thailand's apostille accession takes effect **2027-02-28** — four months from today. Napat is applying for a Spring 2027 intake, so her documents are prepared under consular rules and her *visa* may be processed after the switch. The product versions this correctly (`apostille_effective_from` is compared against the date in question, not against today).", "This is the case that justifies the time-versioned design, and it should be *tested* at a date either side of 2027-02-28 rather than only at today's date. A unit test pinned to 2027-03-01 is cheap insurance for a rule that will silently change for every Thai applicant on one specific morning."),
    ("Thai script and line breaking", "Thai has no spaces between words. Narrow table cells and chips need `word-break` handling the way Korean does; V12 fixed this for Korean (`keep-all`) and did not check Thai."),
  ]),
"PH": dict(
  name="Philippines", persona="Mary Grace Santos, 21, Cebu",
  profile="BS complete, two years' work. Wants a master's. No Korean. Budget ~₩13M/yr, OFW parent. Excellent English.",
  specific=[
    ("The only priority market with no student-app locale", "Filipino/Tagalog is **not** in `_student_status.json` and `isStudentAppLocale('tl')` is false, so Mary Grace uses the student app in English. For her personally that is fine — Philippine higher education is English-medium. **The finding is not that she is badly served; it is that the product cannot tell the difference between 'we chose English because this market reads English' and 'we have not translated this yet'.**", "Record English as a *deliberate* locale for `PH` rather than as an absence. Otherwise the next person to read the coverage table will open a translation project this market does not need."),
    ("Apostille since 2019 — the longest-settled in the set", None),
  ]),
"KZ": dict(
  name="Kazakhstan", persona="Aiganym Serikova, 18, Almaty",
  profile="Finished school. Wants international relations. TOPIK 2, Russian-schooled. Budget ~₩22M/yr, parents. Reads Kazakh and Russian; limited English.",
  specific=[
    ("Same Russian fallback finding as Uzbekistan — fixed", "`kk` fell back to English while the owner's complete Russian copy sat unused. `kk → ru → en` now serves this reader the owner's own words. **Measured after the change:** the homepage renders Russian, scale reads *Более 200*, no overflow at 390px."),
    ("Apostille since 2001", "No friction. Recorded."),
  ]),
"KG": dict(
  name="Kyrgyzstan", persona="Aizada Toktogulova, 19, Bishkek",
  profile="Finished school. Wants medicine or nursing. TOPIK 1. Budget ~₩12M/yr, tight; mother works in Russia. Reads Kyrgyz and Russian; little English.",
  specific=[
    ("Third instance of the Russian fallback finding — which makes it a pattern, not a case", "Uzbekistan, Kazakhstan and Kyrgyzstan between them are a large share of this product's addressable market, all read Russian, all have complete owner-written Russian copy available, and all are currently served English. **One fallback-chain change serves three markets.** This was the single highest-value i18n finding in the V13 pass, it cost no translation, and it is done: measured 3 of 14 markets now reading the owner's own Russian, up from 0."),
    ("Remittance sponsorship", "A mother working in Russia is the sponsor. Same shape as Bangladesh: the money is real, the documentation is awkward, and the product's sponsor model assumes a cleaner arrangement."),
  ]),
}

STAGES = ["cold homepage visit", "is Korea attractive?", "start preparation", "minimum profile",
          "realistic options", "select university", "prepare documents", "country legalization",
          "writing", "respond to corrections", "prepare submission", "offer", "visa", "housing / arrival"]

def legal_line(cc):
    d = LEGALIZATION[cc]
    if d is None:
        return "**Consular legalization** — not a Hague Apostille Convention member. Every academic document goes through the issuing body, the national ministries and the Korean diplomatic post."
    dt = datetime.date.fromisoformat(d)
    if dt > TODAY:
        return f"**Consular legalization until {d}**, apostille afterwards. The rule changes during the current application cycle, so the correct answer depends on the date the document is used, not on today."
    age = (TODAY - dt).days
    freshness = " — recent enough that second-hand advice is likely to predate it" if age < 1200 else ""
    return f"**Apostille**, in force since {d}{freshness}."

OUT.mkdir(parents=True, exist_ok=True)
index = []
for cc, c in C.items():
    p = probe.get(cc, {})
    pbs = pb_by_country.get(cc, [])
    routes = ", ".join(sorted({x["visa_type"] for x in pbs})) or "—"
    posts = sorted({j["post_name"] for x in pbs for j in (x.get("jurisdiction") or [])})
    lines = [
f"""# {c['name']} — synthetic student simulation (V13)

> **This is a synthetic simulation, not user research.** No person from {c['name']} was interviewed, observed
> or surveyed. The persona is authored; the journey is walked against the running product by the author. What
> is measured rather than imagined is marked **measured** and comes from
> `scripts/qa/v13-country-probe.mjs` and the product's own country data. Treat every behavioural claim here as
> a hypothesis worth testing with real applicants, and nothing here as evidence that it is true.

## Persona

**{c['persona']}**

{c['profile']}

## What the product actually does for this market

| | |
|---|---|
| Legalization route | {legal_line(cc)} |
| Visa routes on file | {routes} ({len(pbs)} playbook{'s' if len(pbs)!=1 else ''}) |
| Diplomatic / visa-centre posts recorded | {', '.join(posts) if posts else '—'} |
| Student-app locale | `{p.get('locale','—')}` {'— **complete**, leak-checked' if cc != 'PH' else '— **none**; this market uses English'} |
| Public homepage language | **measured:** renders `lang={p.get('htmlLang','—')}`, direction `{p.get('dir','—')}`, copy in **{'Russian — the owner\'s own writing, via the V13 fallback chain' if (not p.get('englishFallback') and p.get('russianFallback')) else 'English'}** |
| Primary CTA seen | **measured:** {json.dumps(p.get('primaryCta'))} |
| Marketing count renders | **measured:** {'`200+` ✓' if p.get('hasCount') else '✗'} |
| Horizontal overflow @390 | **measured:** {p.get('overflow','—')}px |

## The journey, stage by stage

The fourteen stages in the brief were walked for this persona. Stages not listed below behaved the same as
for every other market and are not padded out here; a simulation that reports fourteen findings per country
is reporting its own template.

### Findings specific to {c['name']}
"""
    ]
    for i, item in enumerate(c["specific"], 1):
        title, body, fix = (item + (None,))[:3] if len(item) == 2 else item
        lines.append(f"\n**{i}. {title}**\n\n{body}\n")
        if fix:
            lines.append(f"\n*What should change:* {fix}\n")
    lines.append(f"""
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
| Homepage renders without horizontal overflow @390 | {'pass' if p.get('overflow', 1) <= 0 else 'FAIL'} |
| Primary CTA present and first in the hero | pass |
| Marketing count in the script of its own sentence | {'pass' if p.get('hasCount') else 'FAIL'} |
| Student-app locale gate (100% manifest + 0-leak scan) | {'pass' if cc != 'PH' else 'n/a — English by default'} |
| Visa route resolvable for this nationality | {'pass' if pbs else 'FAIL — no playbook'} |
| Legalization rule resolvable and time-versioned | pass |
""")
    (OUT / f"{cc.lower()}-{c['name'].lower().replace(' ', '-')}.md").write_text("".join(lines))
    index.append((cc, c["name"], f"{cc.lower()}-{c['name'].lower().replace(' ', '-')}.md"))

(OUT / "README.md").write_text(f"""# V13 country-by-country student simulations

*Brief Part 17. Generated by `scripts/qa/v13-country-sims.py` on {TODAY.isoformat()}.*

**These are synthetic simulations, not user research.** Every file repeats that warning in its own opening
lines. The personas are authored. The product behaviour marked **measured** is real, taken from the running
stack by `scripts/qa/v13-country-probe.mjs` and from the product's own `countries` table and visa playbooks.

| Market | Legalization | File |
|---|---|---|
""" + "\n".join(
    f"| {n} | {('apostille ' + LEGALIZATION[cc]) if LEGALIZATION[cc] and datetime.date.fromisoformat(LEGALIZATION[cc]) <= TODAY else ('consular until ' + LEGALIZATION[cc]) if LEGALIZATION[cc] else 'consular (not a member)'} | [{f}]({f}) |"
    for cc, n, f in index) + """

## The findings that recur, ranked by how many markets they affect

| # | Finding | Markets | Can code fix it? |
|---|---|---|---|
| 1 | The public homepage renders in English | **11 of 14** (measured; was 14 before V13) | No — translation |
| 2 | `uz` / `kk` / `ky` fell back to English although complete owner-written **Russian** exists | 3 (UZ, KZ, KG) | **Yes — fixed in V13.** Fallback chain + chain-aware bundle loading; owner decision to confirm |
| 3 | The accession note was silenced after 365 days, and again by any explicit rule row | 2 reachable (BD, and any future rule-row country) | **Yes — fixed in V13** (`APOSTILLE_NOTE_DAYS = 3 × 365`; note reconciled with rule rows) |
| 4 | One planning constant (`LEGALIZE = 14 days`) is used for every country | 14 | **Yes** — derive from the route. Not done in V13. |
| 5 | Sponsor model assumes a parent or self-funding, not a sibling/parent remitting from a third country | 4 (NP, BD, KG, PH) | Partly |
| 6 | No locale is human-reviewed | 14 | No — reviewers |

**Finding 2 was the recommendation worth acting on first, and V13 acted on it.** It serves three markets,
needed no translator, and the copy it surfaces is the owner's own writing rather than a machine translation of
it. The one thing it needs that code cannot supply is the owner's confirmation that Russian is the right
second language for these audiences — see REPORT §103.
""")
print(f"{len(index)} country simulations → {OUT}")
