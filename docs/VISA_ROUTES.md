# Visa routes — D-2 / D-4-1 playbooks (research, 2026-09-29)

Owner: research workstream "visa + submission". Data files:

| File | Contents |
|---|---|
| `docs/research/visa-playbooks.json` | 41 routes for 14 countries × visa type (D-2-x / D-4-1): jurisdiction, method, documents, finance, fees, time, sources |
| `docs/research/post-arrival-official.json` | Residence card, address change, NHIS, part-time work, stay extension (the same for every nationality) |
| `docs/research/submission-methods.json` | How the 10 target universities take applications (see `docs/SUBMISSION_CONNECTORS.md`) |

> This is research data, not legal advice. Every fact has a `sources[]` entry with the exact official URL, verification date, the page's own date where one is shown, and a short quote or paraphrase. Anything that could not be verified is marked `PARTIAL` / `NEEDS_REVIEW` with `reviewer_notes`. Nothing was inferred from one country to another.

## 1. Method

- **Sources used, in order of preference:**
  1. The Korean embassy or consulate site for each country (`overseas.mofa.go.kr/<cc>-ko|en|ru`), including attached PDF/HWP/image lists.
  2. The Korea Visa Application Centre (KVAC) pages that the embassy links to.
  3. The Ministry of Justice (MOJ) manuals published on HiKorea.
  4. NHIS, HCCH and easylaw.go.kr.
  5. For the NHIS 2026 premium figure only: a university notice (it is labelled that way in the data).
- **Agency blogs** were used only to find official pages. They are never cited.
- **National MOJ rules** come from the official **MOJ visa manual "사증민원 자격별 안내 매뉴얼" (2026-09-01)** and the **stay manual "체류민원 자격별 안내 매뉴얼" (2026-09-18)**. Both are attachments to HiKorea notice [체류자격별 통합 안내 매뉴얼(최신)](https://www.hikorea.go.kr/board/BoardNtcDetailR.pt?BBS_SEQ=1&BBS_GB_CD=BS10&NTCCTT_SEQ=1062). In the route data these rules are labelled `[MOJ national rule]` and kept apart from embassy-specific facts.
- **Apostille status** was checked against the HCCH status table for the Apostille Convention (HCCH table updated 2026-06-30).

## 2. National rules that apply to every route (MOJ, 2026-09)

| Rule | Source |
|---|---|
| **D-2 sub-types:** D-2-1 associate, D-2-2 bachelor, D-2-3 master, D-2-4 doctorate, D-2-5 research, D-2-6 exchange, D-2-7 work-study, D-2-8 visiting. **D-4 sub-types:** D-4-1 Korean language, D-4-7 foreign language. | Visa manual 2026-09-01 |
| **Common D-2 documents:** application form, passport copy, 1 photo (taken within 6 months), the university's business registration, the standard admission certificate (표준입학허가서) issued by the president or dean, a TB certificate (if applicable), family-relation proof (only when parents' bank balance is used), and proof of final education with **apostille or Korean consular confirmation**. China uses CHSI/CDGDC reports. Also proof of funds for **1 year of tuition + living costs** (D-4-1: 6 months). Vietnam additionally needs a *deposit-hold* study-fund balance certificate. | Visa manual |
| **Bank balance certificates:** the manual's **30-day** rule ("잔고증명서는 30일 이내 발급한 것만 유효") is national **only for D-4**. For D-2 the manual states no window — each post's own window applies. Parents' certificates need a family-relation certificate. Embassies may add or remove documents. *(Corrected in V9; before it was shown as a rule for all D-2/D-4.)* | Visa manual 2026.9 |
| **3-month validity** ("국내에서 발급․제출하는 서류의 유효기간은 … 3개월") covers **Korea-issued documents only** (e.g. the university's business registration). There is no national validity rule for foreign documents — each post's rule applies. *(V9)* | Visa manual 2026.9 |
| **Where to apply:** at the post that covers the applicant's **country of residence, or the country of the last school attended** ("신청인의 거주국 또는 최종학교 소재지 관할 공관에서 신청 원칙"). The manual's third-country restriction for the 21 designated countries applies to **E-6-2 only**, not to D-2/D-4; some posts run their own third-country lists (Hanoi "법무부 고시국가 (31개국)", Bangkok's 2-year-residence rule). *(Corrected in V9.)* | Visa manual 2026.9 |
| **Who can get an e-visa** (via visa.go.kr, filed by the university): **excellent-certified universities** for all D-2 levels; **certified universities** for D-2-3/D-2-4 only. **No e-visa for D-4-1.** Cuba, Syria, North Macedonia and Kosovo nationals are excluded. | Visa manual, issuance table |
| **When a CCVI is required instead of a normal visa application.** The CCVI (visa issuance confirmation, 사증발급인정서) is filed online by the university's international-student officer at the immigration office that covers the campus. It is **required** for: China, Vietnam, Mongolia and Uzbekistan nationals doing D-4-1 at general or lower-tier universities; D-4-1/D-2-6/D-2-8 at "consulting" universities; and D-2-4/5/6 at visa-restricted universities. Excellent-certified universities may use a CCVI for any route. | Visa manual |
| **TB certificate:** required when applying for a visa for a stay of more than 90 days by nationals of the **35 TB high-risk countries**, which include **all 14 priority markets**. E-visa holders submit it at alien registration instead. | Visa manual, "결핵진단서 제출 의무" |
| **Stricter-screening countries:** the MOJ list of **21 countries with frequent illegal stay** includes **all 14 priority markets** (CN, PH, ID, BD, VN, MN, TH, PK, LK, IN, MM, NP, IR, UZ, KZ, KG, UA, NG, GH, EG, PE). For these nationals, excellent-certified and certified universities *cannot* waive the finance documents at extension. | Visa manual and stay manual |
| **Visa validity:** D-2-1 to D-2-4 up to 2 years, single entry. D-4-1 up to 6 months, single entry. | Visa manual |
| **Minimum funds:** KRW 20,000,000 per year for degree study (Seoul area) or 16,000,000 (regional) — now also stated in the MOJ 2026-10-07 strategy annex ("인증대를 제외한 유학생 2천만원(비수도권 1천6백만원) 재정입증"). KRW 10,000,000 / 8,000,000 for language study comes **only from posts** (no MOJ figure; the manual says "1년간 (어학연수 6개월)의 재정능력"). **Embassies set their own figures, in their own currency and holding period.** Always show the route's `financial` block, never the national figure. | Policy briefing 2023; MOJ 2026-10-07 (V9) |

## 3. Per-country summary

Status legend: **VERIFIED** means all key fields come from a current official page. **PARTIAL** means the route can be used, but some fields conflict, are stale or are missing (read `reviewer_notes`). **NEEDS_REVIEW** means do not show it as guidance.

Every route requires a TB certificate from an embassy-designated clinic. The MOJ rule and every embassy list agree on this.

### Nepal

- **Apostille:** not a member. Consular confirmation by the Korean Embassy is required.
- **Jurisdiction:** Embassy in Kathmandu. Applications go through KVAC in Lalitpur.
- **Method:** VISA_CENTER. Student intake windows: Dec 1–Feb 15 and Jun 1–Aug 14.
- **Key documents:** admission certificate, business registration, consular-confirmed diploma and transcript (provisional certificate only within 1 year of graduation), cover letter, study plan, TB report from one of 4 named hospitals.
- **Finance:** no minimum amount is stated. The embassy asks for 6 months of statements from Class A banks.
- **Fee and time:** USD 60 (NPR 9,300 from 2026-07-01). 8 working days, 10 in peak months.

| Route | Status |
|---|---|
| D-2-2, D-2-3 | VERIFIED |
| D-4-1 | PARTIAL |

### Myanmar

- **Apostille:** not a member.
- **Jurisdiction:** Embassy in Yangon.
- **Method:**
  - D-2: IN_PERSON. Collect a waiting number at the embassy gate first.
  - D-4-1: APPOINTMENT. Book a slot online during the announced windows.
- **Finance:**
  - D-2: KRW 20M (Seoul area) / 16M (other regions) per year.
  - D-4-1: KRW 10M / 8M.
  - Both need at least 6 months of history and a certificate issued within 30 days.
- **Fee and time:** USD 60, about 30 days.
- **Open issue:** how education documents must be legalized is unclear. The embassy asks for a notarised translation, while MOJ requires apostille or consular confirmation.

| Route | Status |
|---|---|
| D-2-2, D-2-3, D-4-1 | PARTIAL |

### Vietnam

- **Apostille:** in force since **2026-09-11**. The embassy study-visa lists still describe consular confirmation, so this is flagged as a transition.
- **Jurisdiction** (by registered residence):
  - Hanoi (Quang Tri and northward), through KVAC.
  - HCMC (Gia Lai and southward), through KVAC.
  - Da Nang (Hue, Quang Nam, Quang Ngai), through g4k booking.
- **Method:** MIXED, depending on the post.
- **Finance:**
  - D-2: KRW 20M / 16M, deposited for at least 3 months (6 months for "consulting" universities; no holding period for D-2-4). Certificate issued within 10 days.
  - D-4-1: KRW 10M / 8M, deposited for at least 6 months.
  - A deposit-hold account is required (MOJ). Balances lent by agencies ("service accounts") get strict screening.
- **Fees:** ambiguous across the three posts.

| Route | Status |
|---|---|
| D-2-2, D-2-3, D-4-1 | PARTIAL |

### Uzbekistan

- **Apostille:** since 2012-04-15.
- **Jurisdiction:** Embassy in Tashkent.
- **Method:** VISA_CENTER. Applications go only through embassy-accredited agencies (agency fee 250,000 UZS).
- **Key documents:** proof of language ability (the embassy says applications without it are refused). CCVI is required for D-4-1 at general or lower-tier universities.
- **Finance** (bank certificate in the student's own name at **KDB Bank Uzbekistan**):
  - D-2: USD 15,500 (Seoul area) / 12,500 (other regions), held at least 1 month.
  - D-4-1: USD 7,800 / 6,300, held at least 3 months.
  - Lower-tier universities: held at least 6 months.
- **Fee and time:** not stated.

| Route | Status |
|---|---|
| D-2-2, D-2-3, D-4-1 | PARTIAL |

### Mongolia

- **Apostille:** since 2009-12-31.
- **Jurisdiction:** Embassy in Ulaanbaatar.
- **Method:** VISA_CENTER. Apply at KVAC or one of 13 accredited agencies.
- **Key documents:** criminal record for first-time applicants aged 18 or over.
- **Finance:**
  - D-2: KRW 20M / 16M. D-4-1: KRW 10M / 8M.
  - Held at least 30 days (6 months for lower-tier universities). Certificate issued within 2 weeks.
- **Fee and time:** USD 60. Study visas take 20 days.
- **CCVI:** D-4-1 at general or lower-tier universities is CCVI only.

| Route | Status |
|---|---|
| D-2-2, D-2-3 | VERIFIED |
| D-4-1 | PARTIAL |

### China

- **Apostille:** since 2023-11-07. Chinese education is proven with CHSI/CDGDC reports.
- **Jurisdiction:** 9 posts, decided by **hukou**. D-2/D-4-1 students may also use the post covering their current school.
- **Method:** VISA_CENTER. Beijing and Guangzhou take applications through KVAC.
- **Finance:**
  - D-2: KRW 20M / 16M per year.
  - Certificate issued within 30 days. Funds frozen at least 3 months (6 months at consulting or restricted universities).
  - Students at excellent-certified universities are exempt from the finance documents.
- **Fee and time:** CNY 420 plus the centre fee. About 10 working days.
- **Open issue (D-4-1):** the embassy PDF shows KRW 10M / 8M under a "1-year" heading, but MOJ says language programmes prove 6 months of funds. Confirm before showing.

| Route | Status |
|---|---|
| D-2-2, D-2-3 (D-2-4 same list), D-4-1 | VERIFIED |

### India

- **Apostille:** since 2005-07-14.
- **Jurisdiction:** decided by the passport's place of issue:
  - New Delhi, through VFS (Delhi or Kolkata).
  - Mumbai, through **designated travel agencies only from 2026-10-01**.
  - Chennai, through VFS (Chennai or Bengaluru).
- **Method:** MIXED, depending on the post.
- **Key documents:** 6 months of bank statements and 2 years of tax returns.
- **Finance:** no minimum amount is stated by any Indian post.
- **Apostille wording differs by post:** Delhi and Chennai say apostille; Mumbai's D-2 checklist does not.
- **Fees:** only Chennai's fees are verified.

| Route | Status |
|---|---|
| D-2-2, D-2-3, D-4-1 | PARTIAL |

### Bangladesh

- **Apostille:** since 2025-03-30.
- **Jurisdiction:** Embassy in Dhaka.
- **Method:** IN_PERSON, after filling the visa.go.kr e-Form.
- **Key documents:** police clearance and family-relation certificate (each issued within 3 months), TB test from PRAAVA (within 3 months), IELTS/TOEFL, parents' no-objection letter.
- **Finance:** no amount is stated.
- **Fee:** USD 60.
- **Open issue:** the embassy asks for "MoE + MoFA attestation" and never says apostille.

| Route | Status |
|---|---|
| D-2-2, D-2-3, D-4-1 | PARTIAL |

### Pakistan

- **Apostille:** since 2023-03-09. The embassy ended consular legalization on 2024-10-24.
- **Jurisdiction:** Islamabad covers everywhere except Sindh; Karachi covers Sindh.
- **Method:** IN_PERSON only.
- **Key documents:** IELTS or TOEFL (TOEIC is not accepted). A polio certificate is required at Karachi.
- **Finance:** enough to cover the costs on the admission certificate. Funds held at least 1 month; statement issued no more than 2 weeks before applying.
- **Conflicts:** fee (Rs 18,000 vs USD 60) and processing time.
- **D-4-1:** no official list was found.

| Route | Status |
|---|---|
| D-2-2, D-2-3 | PARTIAL |
| D-4-1 | **NEEDS_REVIEW** |

### Indonesia

- **Apostille:** since 2022-06-04.
- **Jurisdiction:** Embassy in Jakarta.
- **Method:** VISA_CENTER (KVAC Jakarta).
- **Finance:**
  - D-2: KRW 20M / 16M. D-4-1: KRW 10M / 8M.
  - 3 months of bank history (6 months for "certain universities").
  - Students invited by one of the embassy's "43 universities" are exempt from finance documents.
- **Fee and time:** Rp 1,260,000 in total. Collect on day 10.
- **Note:** the embassy guide is hosted on Google Sites. It is linked from the official embassy post but shows no page date.

| Route | Status |
|---|---|
| D-2-2, D-2-3, D-2-4, D-4-1 | VERIFIED |

### Thailand

- **Apostille:** joined 2026-06-30, **in force only from 2027-02-28**. Until then, use consular confirmation.
- **Jurisdiction:** Embassy in Bangkok.
- **Method:** IN_PERSON, or through a designated agency.
- **Finance:** no amount is stated. 6 months of history; document issued within 2 weeks.
- **Time:** 10–14 working days.
- **Open issue:** the fee exemption for Thai nationals needs a visual re-check of the PDF.

| Route | Status |
|---|---|
| D-2, D-4-1 | PARTIAL |

### Philippines

- **Apostille:** since 2019-05-14.
- **Jurisdiction:** Embassy in Manila, through KVAC (PHP 1,000). Consulate in Cebu. The regional split between the two was **not verified**.
- **Method:** VISA_CENTER.
- **Finance:** Manila says the amount "may differ depending on the school". Cebu says USD 20,000 (D-2) / 9,000 (D-4).
- **Staleness:** the Manila list is dated 2019.

| Route | Status |
|---|---|
| D-2, D-4-1 | PARTIAL |

### Kazakhstan

- **Apostille:** since 2001-01-30.
- **Jurisdiction:** Almaty covers the south; Astana covers the rest.
- **Method:** IN_PERSON, walk-in.
- **Posts disagree on the diploma:** Astana requires an apostille; Almaty says it is not mandatory.
- **Finance:** USD 20,000 (Seoul, Gyeonggi, Incheon) / 18,000 (other regions); D-4-1 USD 9,000. Certificate issued within 2 weeks, plus a 6-month statement.
- **Fee and time:** USD 60, at least 14 working days.

| Route | Status |
|---|---|
| D-2-2, D-2-3, D-2-4, D-4-1 | VERIFIED |

### Kyrgyzstan

- **Apostille:** since 2011-07-31.
- **Jurisdiction:** Embassy in Bishkek.
- **Method:** MIXED. Students walk in on Tuesdays and Thursdays.
- **Key documents:** apostilled diploma, and TOPIK or TOEFL/IELTS.
- **Finance:** two official sources conflict. D-2: USD 20,000 vs 18,000. D-4-1: USD 10,000 vs 9,000. TB certificate validity also conflicts (6 vs 3 months).
- **Fee and time:** USD 70. Processing time is not stated.

| Route | Status |
|---|---|
| D-2, D-4-1 | PARTIAL |

**Totals:**

| Status | Routes |
|---|---|
| VERIFIED | 15 of 41 (CN, ID, KZ, and NP/MN degree routes) |
| PARTIAL | 25 |
| NEEDS_REVIEW | 1 (PK D-4-1) |

Where an embassy publishes one combined list for several levels (e.g. BD, TH, KG), the route repeats it; the notes say so.

## 4. "Easiest valid route" principles

"Easiest" means **the fewest valid steps for this student**. Never a way around a rule.

1. **Choose the route by the university's certification tier first, then by nationality.**
   - At an excellent-certified university (any D-2), or a certified university (D-2-3/D-2-4), the university can file an **e-visa on visa.go.kr**. There is no embassy visit, and the TB certificate is submitted at alien registration instead.
   - Otherwise, check whether a **CCVI** (visa issuance confirmation, filed by the university) is mandatory, e.g. CN/VN/MN/UZ at D-4-1. A CCVI is often faster at the embassy (e.g. 3 days in Beijing, 7 in Ulaanbaatar).
   - Otherwise, a standard embassy or KVAC application at the **correct post** (by residence or hukou or passport place of issue, per country).
2. **Start the slow items early.** These are apostille or consular confirmation, the TB test at a designated clinic, a criminal record where required, and the bank-balance holding period. Holding periods of 1–6 months must be met *before* the certificate is issued.
3. **Collect time-limited documents last.** Bank certificates are valid for 30 days (10 days in Vietnam, 2 weeks in Mongolia, Kazakhstan, Thailand and Pakistan). Police and family certificates in Bangladesh are valid for 3 months.
4. **Use official channels only.** That means the embassy, the KVAC/VFS it names, and the embassy-accredited agencies it lists (UZ, MN, TH, Mumbai).
5. **If the embassy page and the MOJ rule differ, show the stricter one** and flag the difference. If two official pages conflict, show both with "confirm with the embassy".

## 5. Never present as a shortcut

- Borrowed, lent or agency-provided bank balances ("service accounts", short-term deposits made only for the certificate). The Vietnam embassy explicitly screens for these, and they can lead to refusal or a ban.
- Applying at a post that does not cover the student (wrong hukou, residence or passport place of issue).
- Entering on a visa-free or short-term visa and "switching to D-2 later" as a way to skip the embassy.
- Unofficial "fast-track" agents, fake or bought TB, police, bank or education certificates, or agents who promise approval.
- Working before part-time work is permitted (penalties: up to 3 years' imprisonment or KRW 30M fine, and deportation).
- Choosing a university only because it is "easy for visas". Language programmes at consulting or restricted universities have stricter rules. The Bangladesh embassy warned about a bankrupt university on 2026-07-24.

## 6. How the product uses this data (data contract)

- **Keys:**
  - A route is identified by `(country, visa_type)`.
  - `visa_type` is a D-2 sub-type (`D-2-2`, `D-2-3`, `D-2-4`), plain `D-2` where the embassy does not split levels (TH, PH, KG), or `D-4-1`.
  - `degree_levels[]` lists the levels a route covers.
- **`verification_status` controls what is shown:**
  - `VERIFIED`: show as guidance, with source links.
  - `PARTIAL`: show it, with a visible "some details unconfirmed — check with the embassy" note, and surface the relevant `reviewer_notes` in plain language.
  - `NEEDS_REVIEW`: do not show as a checklist. Show only "we have not verified this route; contact the embassy" plus the jurisdiction link.
- **`jurisdiction[]`:** several posts means the product must pick the post from the student's region, hukou or passport place of issue (`covers_regions`). Never merge two posts' rules.
- **`e_visa_available` + `e_visa_condition`:**
  - D-2 routes are `true` **only in combination with the university tier** described in `e_visa_condition`.
  - D-4-1 routes are `false`.
  - The product needs the university's certification tier (excellent-certified / certified / general / consulting / restricted) to resolve this. That tier is not in this dataset; take it from the yearly MOJ/MOE certification results.
- **`documents[]`:**
  - `key` is stable snake_case. `other_*` keys are embassy-specific extras.
  - `required` is `true`, `false` or `"conditional"`, with a `condition`.
  - `validity` is free text such as "issued within 30 days"; UIs may parse it into reminders.
  - `legalization` is `APOSTILLE`, `CONSULAR`, `NONE` or `null` (unknown).
  - `provided_by` says who produces the document, which drives who the task is assigned to.
- **`financial`:** show `amount` exactly as stored (currency and wording included). Never convert or round in a way that looks official. `null` means the embassy states no amount; say so rather than filling in the national figure.
- **Time-based facts** (apostille effective dates, fee changes, agency-only intake from a given date) are stored as text with dates. Engineers should model them as effective-from fields; the existing `Country.apostille_effective_from` pattern fits.
- **`sources[]`:** every screen that shows a route should link to at least the primary embassy source, with its `verified_at` date. Re-verify any route whose `verified_at` is more than 90 days old before an intake season.
- **Post-arrival facts** (`post-arrival-official.json`) are the same for every country. Each fact has its own `status`; hide `NEEDS_REVIEW` facts, e.g. the D-4-1 part-time hour cap.

## 7. Open items for a human reviewer

- **PK D-4-1:** no official list found.
- **Conflicts to settle:**
  - PK fee and processing time.
  - KG amounts and TB validity.
  - KZ Almaty vs Astana apostille requirement.
  - Mumbai vs Delhi/Chennai apostille wording.
- **Legalization wording to confirm:** Bangladesh and Myanmar. Vietnam also needs updated embassy lists after the 2026-09-11 apostille date.
- **Missing figures:**
  - Fees: UZ, Delhi and Mumbai.
  - Processing time: UZ, KG.
  - PH Manila/Cebu jurisdiction split.
  - TH Thai-national fee exemption.
- **CN D-4-1:** 6-month vs 1-year funds.
- **Stale page:** Manila's 2019 list.
- **Post-arrival:** confirm the NHIS 2026 premium on an NHIS page (current source is a university notice), and the D-4-1 part-time hour cap.
- **Re-check dates:** Thailand after the apostille takes effect on 2027-02-28. The UWAY/JinhakApply links for the 2027 cycle before each intake.

---

## 8. Implementation (V5 visa concierge, 2026-09-29)

Owner: visaroute workstream. Log: `docs/qa/v5/logs/v5-visaroute.md`.

### Data
- Migration **`f5e1a2b3c454`**: tables `visa_routes` (versioned playbook per `(country, visa_type, version)`, `is_current`, `content_hash`, research `verification_status`, `verified_at` = latest source check, sources, jurisdiction, method, fees, finance, notes), `visa_route_documents` (key, research name, REQUIRED/CONDITIONAL/OPTIONAL + condition, validity text + parsed `validity_days`, legalization, translation, provided_by, dossier category, source), `visa_route_answers` (the one jurisdiction answer + sponsor), `visa_case_tracks` (1:1 with `visa_cases`: route/post/method snapshot, preparation form, linked documents, university-paper marks, appointment, hand-off, submission evidence, decision, visa document, pack review, support case), `visa_embassy_requests`; column `universities.visa_certification` (EXCELLENT | CERTIFIED | GENERAL | UNKNOWN) + `visa_certification_verified_at`.
- Loader `services/visa_routes.load_playbooks()` — idempotent; changed content → new current version, old kept. Seeded by `seed/extra_54_visa.py` (research data, not demo). All universities seeded **UNKNOWN** tier (no verified MOJ/MOE result stored); Hangyul staff set it with `PUT /visa-route/universities/{id}/certification` (date required).
- `VisaCase.status / submitted_on / issued_on` stay canonical (concierge `home_stage` reads `ISSUED`). The legacy `VisaRequirement` checklist is kept as the fallback where no route exists; `GET /visa` now returns the route checklist when a route resolves (mobile + agency card), plus a `route` summary.

### Resolver rules (`resolve()`)
1. Nationality + visa type from the programme (LANGUAGE → D-4-1, BACHELOR/TRANSFER → D-2-2, MASTER → D-2-3, DOCTORATE → D-2-4). A route is found only for the **same country** (exact type, or the same embassy list covering the level, e.g. NP D-2-3 for doctoral). No route → `NO_ROUTE` ("We haven't verified the rules for {country} yet — your counselor confirms them"), never inferred.
2. `NEEDS_REVIEW` routes (PK D-4-1) → `NOT_VERIFIED`: no checklist, embassy links only. `PARTIAL` → visible caveat + curated conflicts (MM/BD legalization wording, VN apostille transition, KZ posts, Mumbai wording, KG amounts/TB validity, PK fee, PH split/stale list, TH fee exemption, CN D-4-1 funds, UZ fees) + the English reviewer note in a disclosure.
3. Living outside the nationality country → `OTHER_RESIDENCE`; in Korea / current Korean visa → `IN_KOREA` (change of status, not an embassy route). Both go to a person.
4. Jurisdiction: single post; embassy + visa centre (NP); regional split asks **one** question — VN residence area (3 posts), CN hukou province (9 posts incl. Dalian), IN passport place of issue, PK Sindh vs rest, KZ region. PH Manila/Cebu split is unverified → caveat, counselor confirms.
5. Method (MOJ national rules, `national_method()`): e-visa filed by the university only for EXCELLENT (any D-2) or CERTIFIED (D-2-3/D-2-4); never D-4-1; excluded nationalities CU/SY/MK/XK. CCVI required for D-4-1 CN/VN/MN/UZ at GENERAL tier. UNKNOWN tier unlocks nothing → caveat "if your university is certified, it can file an e-visa". Otherwise the post's method (IN_PERSON / VISA_CENTRE / APPOINTMENT / AGENCY) with a translatable method note (waiting number, intake windows, g4k booking, accredited agencies…).
6. Documents: conditions evaluated where the data allows (parents sponsor, scholarship, age 18+, minors, excellent-certified waivers, lower-tier, post-specific checklists); otherwise "maybe — your counselor confirms". Reuse status per document comes from the dossier hook `applicability_for_requirement()` with the route's freshness (`validity_days`) judged on the **appointment date**, legalization (national rule for education documents) and translation. Visa statuses: READY, IN_REVIEW, NEW_FOR_VISA ("issued within N days"), GET_LATER ("get it on or after {date} so it's valid on {appointment}"), WAITING_UNIVERSITY, MISSING, FORM, AT_REGISTRATION (TB with e-visa), NOT_NEEDED, plus the dossier's NEEDS_FIX / NEEDS_LEGALIZATION / NEEDS_TRANSLATION / EXPIRED.
7. Steps in order with a why: choose post → slow items (legalization, TB, police) → university papers → reuse/add → form → (university e-visa / CCVI) → book → time-limited papers last → apply + record → decision.

### Preparation and tracking
- Preparation form: sections personal, passport, address, school, sponsor, stay prefilled from profile / passport / application; the **student** confirms each (staff cannot); corrections are stored in the form only (profile never overwritten); `declarations: false`; nothing is submitted anywhere.
- Pack check → `DOCUMENT_PREPARATION ↔ READY_TO_APPLY` automatically (all required documents ready and valid on the appointment date + form confirmed).
- Appointment (planned/booked, reference), official hand-off (the embassy/visa-portal link; the opening is recorded), submission **only with a receipt number or uploaded receipt** (application → VISA_SUBMITTED), embassy request (note + due → student task `visaroute:req:<id>` + VISA_SUPPORT case; "I sent it" closes the task), decision (refusal → URGENT VISA_SUPPORT case), issued **only with the visa / grant notice uploaded** (`VisaCase.ISSUED`, `issued_on`, application → VISA_ISSUED → concierge home stage READY_TO_COME).
- Student statuses (en/ko/my): Preparing · Ready to apply · Submitted · Embassy requested something · Approved · Issued · Needs attention.

### Help and escalation
- Help block: what happened · what is needed · who acts · when · source · counselor contact. `POST /me/visa-route/help` and every complex exception (refusal, embassy request, unknown route) open or update one **VISA_SUPPORT** service case (status table registered with `concierge.register_case_type`: OPEN → IN_PROGRESS / WAITING_STUDENT / WAITING_EMBASSY → RESOLVED, CANCELLED), routed to the agency or Hangyul ops by the concierge rules.

### API
Student: `GET /me/visa-route`, `PUT /me/visa-route/answers`, `POST|DELETE /me/visa-route/form/{section}`, `POST /me/visa-route/items/{key}`, `PUT /me/visa-route/appointment`, `POST /me/visa-route/handoff`, `POST /me/visa-route/submission`, `POST /me/visa-route/requests`, `POST /me/visa-route/requests/{id}/sent`, `POST /me/visa-route/decision`, `POST /me/visa-route/issued`, `POST /me/visa-route/help`. Staff: `GET /visa-route/students/{id}` and the same tracking actions under it, `POST …/pack-reviewed`, `GET /agency/visa-today`. Universities: no access (404). Document reviewers cannot change the visa record.

### Coordinator hooks
- `visa_routes.home_step(db, student_user_id)` → `None` (no visa case, or ISSUED) or `{key, title_key: "visaroute:home.<key>", params, who, link: "/visa", status_key: "visaroute:status.<DISPLAY>"}`.
- `visa_routes.today_items(db, principal)` → `[{kind: "visa", case_id, reason: appointment_soon|request_due|pack_ready, title_key: "visaroute:today.<reason>", params {student, date?}, student {id, full_name}, due_at, overdue, link: "/students/<id>?tab=visa"}]` (agency/Hangyul only; max 50).

### Manual fallbacks, security, limitations
- No embassy system is integrated or scraped; booking and submission happen on the official sites; Hangyul records the result with evidence. No stored portal credentials.
- Tenant isolation through `ensure_student_access`; documents linked to a visa item must belong to the student; university tier changes are Hangyul-only and audited; every mutation is audited (`visa_route.*`).
- Limitations: university tiers are UNKNOWN until verified, so e-visa is never offered in the demo; conditions that the data can't evaluate are "maybe"; research wording stays English inside "exact wording" disclosures; engine task titles use `task.visa.<route key>` keys that must be added to `common` (proposal: `docs/qa/v5/visaroute/common-task-keys.json`); routes need re-verification after 90 days (a caveat appears).

## V6 update (2026-10-01)

- The jurisdiction question ("where do you live?") now names each option by the consulate that serves it ("Area served by Da Nang") with the consulate's own area wording underneath, stripped of research annotations in parentheses (e.g. "per consulate FAQ; … CT07"). The full wording stays available as the option's title. Before, students read raw research notes as the choices.
- The "Research note (English)" disclosure was removed from the student visa page; route uncertainty is still stated in plain words ("Your counselor confirms a few details") with the list of items being confirmed.
- No change to the 41 researched routes, their research status, or the resolver.

## V9 revalidation (2026-10-10)

Research: `docs/research/v9-visa-revalidation.md` (218 rows re-checked across 14 countries, 46 corrections), sources `docs/research/v9-visa-sources.json` (`V9V-Sn`). Applied by `server/scripts/v9_visa_research_apply.py`, which rebuilds the JSON from the archived pre-V9 baseline (`docs/research/archive/*.v8-2026-09-29.json`) so it is repeatable. Log: `docs/qa/v9/logs/visa-data.md`.

**Provenance in the data.** Each route now has `v9_revalidation`:
- `changes[]` — correction number, JSON path, verdict, source ids + URLs, `verified_at: 2026-10-10`;
- `confirmed[]` — fields re-checked and SAME / NEWLY CONFIRMED;
- `unconfirmed[]` — fields still not confirmed (never guessed);
- `watch_items[]` — announced plans that are **not in force**.

The cited sources are appended to `sources[]` with their `id`. Sources from another country's post that the research quotes only as examples (Hanoi, Bangkok third-country lists) stay in `context_sources` and are never attached to another country's route.

**Status (honest rule: VERIFIED only when nothing is unconfirmed):** 5 VERIFIED (MN D-2-2, D-2-3, D-4-1; PK D-2-2, D-2-3), 35 PARTIAL, 1 NEEDS_REVIEW (PK D-4-1). NP D-2, CN and KZ moved from VERIFIED to PARTIAL because a field is now known to be in conflict or unchecked. PK D-2 and MN D-4-1 moved up because their conflicts were resolved.

**What changed (highlights):**
- **Bangladesh:** since 2026-09-02, intake is only at the VFS-run **KVAC Dhaka** (2F B&T Nehaleeya Tower, Plot 80, Block B, Kemal Ataturk Ave; Sun–Thu 09:00–16:00; individual appointment). The centre is a jurisdiction entry, so the resolver shows it. VFS fee BDT 2,150.
- **Mongolia:** individuals may file directly at KVAC (from 2026-09-09). There are now 12 agencies (DIDO ended 2026-09-28). Service fees: KVAC 57,000 MNT, agencies 30,000 MNT.
- **Vietnam:**
  - fee resolved: USD 50, stay of 91+ days;
  - Hanoi KVAC is walk-in with queue numbers since 2026-04-06;
  - apostille in force since 2026-09-11, with a caveat for high-school records;
  - invalid-records notice of 2026-05-28.
- **Pakistan:** fee Rs 18,000 and processing time of at least 8 weeks (both conflicts resolved).
- **India:** Delhi and Mumbai fees are INR 5,400; Delhi takes 14 working days; Mumbai takes applications through agencies only from 2026-10-01.
- **China:**
  - holding period is now per post (Beijing 3 months, Guangzhou 1 month, Shanghai and Shenyang 30 days);
  - designated banks at Guangzhou and Shenyang;
  - Shenyang KVAC moved; Shanghai processes in 5 days;
  - centre express fees added.
- **Myanmar:** new list "2026.10". Myanmar-issued documents need the original + copies + a notarised English translation only (`legalization: NONE`). NRC card and language proof are on the list.
- **Nepal:** KVAC fee NPR 2,000. Bank certificate issued within 1 month (KVAC). KVAC checklist items added (family relationship certificate, SOP, character certificates, grade 11 mark sheet). The 6-vs-3-month validity conflict is now shown.
- **Philippines:** split confirmed (Manila/KVAC: Luzon + Mindanao; Cebu: Visayas). The resolver now asks the region question instead of "post unresolved". Cebu needs a g4k booking.
- **Indonesia:** D-2-3/D-2-4 no longer tagged APOSTILLE, because the guide applies it only to high-school-level documents. 3-month refusal bar. TB certificate valid 3 months.
- **Thailand:** Thai nationals pay no visa fee (confirmed). Record of passport added. MFA stamp wording added.
- **Kazakhstan:**
  - Almaty TB notice: X-ray + PCR, in conflict with the visa page — the stricter one is shown;
  - Astana: funds must stay until entry; fraud ban;
  - apostille accession date added.
- **Kyrgyzstan:** USD 20,000 / 10,000 applies **until 2026-12-31**; the 2022 figures are superseded. The new KICB rule (USD 15,500 / 12,500 and 7,800 / 6,300; Tunduk/cadastre records; new language thresholds) is stored in `scheduled_changes` with `effective_from: 2027-01-01` and is **not applied before that date**. Apply it on or after that date by re-running `server/scripts/v9_visa_data.py` (it creates a new route version). A dated "announced, not in force" note tells students in the meantime.

**National-rule notes fixed in every route:**
- The third-country sentence now applies to E-6-2 only.
- The 30-day bank certificate is a national rule for D-4 only (D-2 routes now say "post rule").
- Korea-issued documents are valid 3 months (see §2).
- Current IEQAS names: 비자심사강화대학 = 컨설팅 + 비자정밀심사, formerly 하위 / 비자제한. 2025 results: 39 / 181 / 134 / 13 / 16. The Beijing and Jakarta posts cite 43 excellent universities; this is not reconciled.
- The MOJ plans of 2026-10-07 are a watch item only: the TOPIK 4 / KIIP 4 finance waiver, the deposit scheme and the suspension of benefits for weekend/night/online programmes.

**In the product.**
- `server/scripts/v9_visa_data.py` loaded the corrections into the dev DB as new route versions; old versions are kept with `is_current=false`.
  - First run: 41 updated. Second run: 15 updated, after a source-citation fix.
  - Every run after that is unchanged.
- The seed path loads the corrected JSON through `extra_54_visa` and `app/seed/extra_95_visa_data.py`; the second applies any scheduled change that is due.
- Checked through the API:
  - student58 (Bangladesh): the VFS centre and VISA_CENTRE are shown;
  - `student.myanmar`: the NRC card is shown;
  - MN `student.visaroute`: VERIFIED.

**Hand-off to the student workstream** (code in `services/visa_routes.py`, not edited here):
- `METHOD_NOTES[("BD", None)] = "EFORM_FIRST"` still says "then go to the embassy". Bangladesh needs a "book at the visa application centre" note.
- `KNOWN_CONFLICTS` still raises caveats that V9 resolved:
  - MM `LEGALIZATION_UNCLEAR`;
  - PK `FEE_TIME_CONFLICT`;
  - TH `FEE_EXEMPTION_UNCHECKED`;
  - KG `AMOUNTS_CONFLICT`;
  - PH `POST_SPLIT_UNVERIFIED`.

  Still valid: VN `APOSTILLE_TRANSITION`, KZ `DIPLOMA_APOSTILLE_POSTS`, KG `TB_VALIDITY_CONFLICT`, CN D-4-1 `FUNDS_PERIOD_CONFLICT` and UZ `FEES_MISSING`. New conflict without a code yet: the Almaty TB test (X-ray + PCR vs the visa-page options).
- `LEGALIZE_KEYS` forces legalization for `final_education_certificate` even where the post says `NONE` (Myanmar).
- A fee of 0 (Thai nationals) can't be shown. The UI tests `fees.amount` truthiness, so TH keeps `amount: null` with `thai_nationals: "FREE"`.
- `find_route` ignores `scheduled_changes`. A date-aware resolver would remove the need to re-run the script on 2027-01-01.

**Still unconfirmed — needs a human call or email to the post:**
1. **Pakistan D-4-1:** a document list from Islamabad or Karachi.
2. **Kyrgyzstan:** TB validity (6 or 3 months), processing time, document validity, and whether a Russian version of the 2027 rule will be issued.
3. **Uzbekistan:** visa fee, processing time, TB validity and document validity.
4. **Vietnam:**
   - whether the study lists accept an apostille alone for degrees and high-school records;
   - which post covers former Kon Tum.
5. **Bangladesh:** whether an apostille is accepted instead of MoE + MoFA attestation; also processing time and the re-apply rule since the KVAC started.
6. **Nepal:** D-4 processing time (8 or 15 days); which validity applies (Embassy 6 months or KVAC 3 months).
7. **Myanmar:** the Mar-2027 D-2 waiting-number intake date; D-4 booking windows after Dec-2026.
8. **Philippines (Manila):** consular visa fee, D-2/D-4 processing time, and whether the 2019 list is complete.
9. **Thailand, India, Bangladesh:** a minimum balance amount (none published). Pakistan's rule is the admission-certificate amount.
10. **China:**
    - processing time at Shenyang;
    - holding period at Qingdao, Chengdu, Xi'an, Wuhan and Dalian;
    - the empty KVAC Beijing notice of 2026-09-28;
    - TOPIK level for associate degrees at consulting universities (Shanghai 2급 vs Beijing 3급).
11. **Kazakhstan (Almaty):** which TB test is accepted.
12. **IEQAS:** 39 or 43 excellent-certified universities; and the actual list Jakarta applies.
13. **Mongolia:** the end-2026 change to the agency system.
14. **India:** document validity and the re-apply interval.
