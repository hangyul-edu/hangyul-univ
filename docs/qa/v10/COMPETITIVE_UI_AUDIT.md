# V10 Competitive UI audit

*2026-10-16. Four references, each opened in a real browser at 1440 / 1024 / 768 / 430 / 390 and read end to end.
Screenshots: `docs/qa/v10/koreanasha-original/`, `docs/qa/v10/koreanasha-live/`, `docs/qa/v10/benchmark/`,
`docs/qa/v10/before/marketing/`. Measurements come from `scripts/qa/v10-shots.mjs` and
`scripts/qa/v10-capture.mjs`. The question is **not** "what should we copy" but "what do they communicate better
than Hangyul, and what is the underlying problem to solve better".*

---

## 0. The four references

| Ref | What it is | Captured |
|---|---|---|
| **K-local** | `template-koreanasha/` served locally | 5 widths |
| **K-live** | <https://univ.talkhangyul.com/> | 5 widths — **byte-identical page to K-local** (same heights, title, markup), so they are treated as one reference |
| **V-Ed** | <https://www.v-education.com/kr> | 5 widths + full text extraction |
| **HG V9** | Hangyul marketing at `localhost:3100` before any V10 change | 7 routes × 5 widths |

*Note on the baseline artifact: `docs/qa/v10/before/metrics.json` was later overwritten by a partial re-run of
the capture script. The screenshots themselves were not, and a full-page PNG is exactly as tall as the page was,
so `scripts/qa/v10-metrics-from-shots.py before` recovers every height from the preserved evidence into
`before/heights.json`. The numbers below come from that file and match what was recorded at capture time.*

---

## 1. Measured

| Measure (home) | Koreanasha | V-Education | Hangyul V9 |
|---|---|---|---|
| Page height @1440 | 8,938 px (9.9 screens) | 12,211 px (13.6) | 6,039 px (**6.7**) |
| Page height @1024 | 9,147 px (11.9) | 12,586 px (16.4) | 7,826 px (10.2) |
| Page height @390 | 12,817 px (15.2) | 21,001 px (**24.9**) | 6,269 px (**7.4**) |
| Horizontal overflow | 0 | 0 | 0 |
| `<h1>` count | **0** | 1 | 1 |
| JS page errors | 0 | 1–2 per width | 0 |
| Loaded CSS+JS | ~1.5 MB | heavy (Instagram embeds, video) | 143.4 KB JS gzip + 38–58 KB CSS |
| Languages | 2 (ko, ru) | 3 (ru, en, kr) | 55 (20 complete for the student journey) |
| Public conversion action | one 20-field modal form | one contact form + Telegram | quick check (no account) + register |

**Read:** Hangyul V9 is already the shortest, fastest, most accessible and most localised of the three.
It loses on none of these numbers. It loses on the thing the numbers do not measure.

---

## 2. Scored, dimension by dimension

5 = best in set. Scores are this audit's judgement against the brief's criteria, from the captures above.

| Dimension | Koreanasha | V-Ed | HG V9 | Who wins and why |
|---|---|---|---|---|
| **First impression** | **5** | 3 | 2 | K: the page *opens as a photograph* — full viewport, a real person, golden light, a floating white pill of chrome. HG V9 opens with a near-black night river and a white form card bolted to the right. |
| **Visual quality** | 4 | 3 | 3 | K: one idea executed consistently. V-Ed: competent purple-gradient SaaS. HG: clean and disciplined but anonymous — it looks like a well-built admin product's landing page. |
| **Human presence** | **5** | **5** | **1** | K: the founder's face is the hero. V-Ed: team in branded jackets, named curators, Instagram Reels, event photos. HG: **not one human being appears anywhere on the home page.** |
| **Trust** | 2 | 3 | **5** | V-Ed shows a business ID, a registered address, two phone numbers — real Korean trust signals — but also "98 % 성공적인 합격", "1,000명 이상", "8년 경력", "높은 합격률", none of them sourced. Hangyul shows sourced numbers with the date each was checked and refuses to state a success rate. **Hangyul already wins this outright.** |
| **Navigation** | 3 | 4 | 2 | K: 4 anchors on one page — simple but it is one page. V-Ed: 7 labelled destinations, all student-facing. HG V9: 4 items **plus a "Partners ∨" dropdown that sells to universities and agencies on the student's page**. |
| **Service clarity** | 3 | **5** | 2 | V-Ed names services as nouns a student recognises: 공항 픽업, 숙소 지원, 자기소개서 작성, 통번역 서비스, 여름·겨울 캠프. HG V9's home never lists a service at all; "Services" is a pricing page. |
| **University discovery** | 1 | 1 | **5** | K and V-Ed both stop at "50+ universities" / "partner universities" with no list. Hangyul shows **real programmes with the deadline, the language requirement and the first-year cost on the card** — and a searchable catalogue behind it. Nobody else is close. |
| **Cost transparency** | 3 | 4 | **5** | K: prices with invented discounts. V-Ed: an honest FREE-vs-PREMIUM **comparison table** (14 rows) — the best pricing explanation in the set — but the premium price is "from $450, calculated individually". Hangyul: payee, timing, refundability, basis and source date per line, plus money-to-show. |
| **Admissions process** | 2 | **5** | 4 | V-Ed's 6 numbered steps (free consultation → matching → documents → online application → acceptance → ongoing support) are the clearest process statement in the set. Hangyul's 4-phase journey is good but arrives late on the page. |
| **Documents / writing** | 2 | 3 | **5** | V-Ed sells "자기소개서 작성" (we *write* your statement — which is the anti-pattern). Hangyul reviews the student's own writing with versions, comments and an authorship rule. |
| **Visa** | 1 | 2 | **5** | Neither competitor goes past "visa assistance". Hangyul resolves a nationality-specific route with a checklist and funds-to-show. |
| **Housing / pickup / arrival** | 3 | 4 | 4 | V-Ed names them clearly and early. Hangyul has the deeper workflow but mentions it in one line, three-quarters down the page. |
| **Social proof** | 2 | **5** | 1 | V-Ed has six long, specific, named testimonials (student first name + the actual university), Instagram Reels and event photography. Hangyul has none and **will not invent any** — this is a real gap that only real customers can close. |
| **Mobile** | 3 | 1 | **4** | V-Ed is 24.9 phone screens. K is 15.2 with a genuinely art-directed portrait hero crop. Hangyul is 7.4 but its phone hero is a form card over a dark photo. |
| **Conversion model** | 2 | 2 | 3 | Both competitors funnel everything into one form; the relationship starts with a stranger reading your 20 answers. Hangyul lets you *use* something first. |
| **Total (/75)** | 41 | 50 | 51 | |

---

## 3. What each does better than Hangyul — and the real problem under it

| # | They communicate better | Underlying problem | How V10 solves it better (not by copying) |
|---|---|---|---|
| 1 | **Koreanasha: the page is a photograph.** `100dvh`, three hand-made crops, chrome floating as a white pill over it. | A student decides whether to care in two seconds, and that decision is emotional. V9 spends those two seconds on a dark empty river and a form. | Adopt the exact technique — full-viewport hero, per-breakpoint crops, floating pill header — with a Korean university campus at golden hour. Then put the first *useful* thing (real programmes) directly under it. |
| 2 | **V-Ed: services are nouns.** 공항 픽업. 숙소 지원. 통번역. | Abstractions ("complete support") carry no information. V9's home never names a service. | A "Real student services" band in Koreanasha's alternating image/text rhythm, written to the brief's rule: not "visa assistance" but *"See exactly which visa documents your consulate asks for."* |
| 3 | **V-Ed: the plan comparison table.** 14 rows, FREE vs PREMIUM, ticks and gaps. | "What do I get, and what does it cost?" is the second question every student asks. | Keep the table pattern on the Services page; keep our honesty (prices flagged `is_demo`, no invented discount, no "BEST" badge). |
| 4 | **V-Ed: a numbered process.** Six steps with names. | "What happens after I contact you?" | We have the journey; move it up and number it. |
| 5 | **Both: human presence.** | Nobody wants to hand a passport to a logo. | Hangyul **has no staff photos and will not invent an employee** (brief). Solve it instead with *evidence of a human*: the counselor row in the product moments, "a person checks your work" in Trust, and photographs containing students (distant, licensed) rather than empty cityscapes. |
| 6 | **V-Ed: company identity in the footer** (business ID, address, two phones). | Korean buyers check 사업자등록번호. | Carry the pattern; fill it only when Hangyul's real registration details are supplied — a business dependency, not a code one. |
| 7 | **Koreanasha: section rhythm.** Alternating white / tinted bands, one idea each. | V9 reads as one continuous scroll of white. | Band alternation with tangerine-50. |

---

## 4. What Hangyul already does better — and must not lose

| # | Hangyul advantage | Neither competitor has it |
|---|---|---|
| 1 | **Real programmes on the home page**, each with deadline, language level and first-year cost, from a catalogue with per-field sources and check dates | K: "50+ universities". V-Ed: "partner universities". |
| 2 | **Eligibility-aware discovery** that never turns missing data into "not eligible", and language *routes* when TOPIK blocks a degree | Both answer "contact us". |
| 3 | **One document dossier** reused across universities and the visa | Both re-collect per application. |
| 4 | **Writing review** — the student writes, a reviewer comments, versions are kept | V-Ed *writes the statement for you*; ApplyBoard generates it. Both are the anti-pattern. |
| 5 | **Country-specific visa route** with funds-to-show | "Visa assistance". |
| 6 | **Honesty as a feature** — no success rate, no probability, sources with dates | V-Ed publishes four unsourced success claims. |
| 7 | **55 locales**, 20 complete and leak-scanned for the student journey | 2 and 3. |
| 8 | **7.4 phone screens** against 15.2 and 24.9 | |

---

## 5. Explicitly not copied

| Not copied | From | Why |
|---|---|---|
| "98 % 성공적인 합격", "1,000명 이상의 학생", "8년 경력", "높은 합격률" | V-Ed | No verified equivalent evidence exists for Hangyul (brief Part 23 / REPORT §64 business dependency). |
| Testimonials, review carousels, student quotes | V-Ed | Hangyul has no customers yet. Inventing them is the dishonesty the brief forbids. |
| Partner-university logo walls, university crests | both | Hangyul records **no** university agreement; showing a crest implies one. |
| "42 % OFF", "Максимальная скидка", "BEST" over struck-through prices | Koreanasha | Invented urgency; our prices are `is_demo` and labelled. |
| "자기소개서 작성" (we write your statement) | V-Ed | Directly against our authorship rule. |
| The 20-field public application modal / contact form | both | The brief removes the public application form; this is the Student Platform's job. |
| Instagram Reels embed, event galleries | V-Ed | Third-party content, heavy, and we have no such library. |
| Visual assets and copy | V-Ed | Benchmark only. |

---

## 6. The one-line verdict

Koreanasha wins the **first two seconds**. V-Education wins the **next thirty** — it tells you exactly what you get,
for what money, in what order, from which humans. Hangyul V9 wins everything after that and is the only one of the
three that is honest, but a student has to get past a dark photograph and a form card to find out.

**V10 = Koreanasha's opening, V-Education's concreteness, Hangyul's substance and honesty.**
