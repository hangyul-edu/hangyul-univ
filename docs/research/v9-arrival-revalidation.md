# V9 — Arrival, housing, insurance, pickup, SIM and bank re-validation

Re-validated: **2026-10-10**

**Baseline files**
- `docs/research/arrival-official.json` (14 items)
- `docs/research/post-arrival-official.json` (generated 2026-09-29)
- `docs/ARRIVAL_SERVICES.md`

**Sources**: ids `V9V-Sn` in `docs/research/v9-visa-sources.json`. Arrival sources are S118–S167.

No code or data files were edited.

---

## 1. Method and limits

**Method**
- Each official fact in the two JSON files was re-fetched at its baseline source, or at the nearest official page: MOJ/KIS, HiKorea, NHIS, FSC, the Incheon Airport Corporation, KTO and Seoul City.
- University pages are used only as corroboration, and always labelled as such.
- Commercial providers were read on their own public pages. Prices are as displayed on 2026-10-10 and will change.

**Limits**
1. Several pages could not be read:

   | Page | Problem |
   |---|---|
   | Carrier pages (SKT, KT, LG U+) | Redirect loop, JavaScript-only, or 404 |
   | Klook product pages | 403 |
   | Sogang notice | TLS error |
   | law.go.kr | Did not render |

   For statutes, a mirror (CaseNote) was used, and it is labelled as a mirror.
2. **No partnership with any provider exists or is implied.** §4 lists what an agreement would need. It does not describe any agreement.
3. Labels used:
   - Verdicts: SAME, CHANGED, NEWLY CONFIRMED, STILL UNCONFIRMED. These have the same meaning as in `v9-visa-revalidation.md`.
   - Evidence: page, excerpt, inaccessible.

---

## 2. Official facts — re-verification

### 2.1 Residence card (외국인등록증)

| Fact | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Who and when | Stay of more than 90 days: register within 90 days of entry | "대한민국에 입국한날부터 90일을 초과하여 체류하려는 외국인 … 입국일부터 90일이내". English page: "within 90 days of arrival". | SAME | S118, S119 |
| Fee | KRW 35,000 since 2025-01-01 | "(현행) 3만 원 ➟ (인상 후) 3만 5천 원", effective 2025-01-01. KHU: "35,000원 (2025.01.01 부터 인상)". The HiKorea KR info page (last modified 2021) still shows 3만원 and must not be used for the fee. | SAME | S120, S121, S118 |
| Payment method | "Some offices say cash only" | Only the outdated 2021 HiKorea page says "현금 수납만가능". No current official statement found. | STILL UNCONFIRMED | S118 |
| HiKorea visit booking | Required at most offices | No national "booking required" rule was found; the requirement is set per office. New evidence: the Sejongno branch suspended walk-in student registration "2026. 3. 13.(금) ~ 2026. 4. 3.(금)". | SAME (rule is per office); new supporting example | S122 |
| Processing time | About 1–2 weeks (KHU) to 6–8 weeks (Mason Korea) | KHU: "1~2주일 이상 소요". No official MOJ figure. | STILL UNCONFIRMED (official) | S121 |
| Change reports (address, passport, lost card) | arrival-official.json says **14 days**; post-arrival-official.json says **15 days** (PARTIAL) | Yeongdeungpo-gu, citing 출입국관리법 제36조: registered foreigners must report "체류지(거소)를 이전한 날부터 15일 이내". The 14-day figure is for 외국국적동포 (거소 reports) and is wrong for D-2/D-4. The law.go.kr text itself did not render. | CHANGED (arrival-official 14 → 15 days); NEWLY CONFIRMED for post-arrival | S166 |

### 2.2 National Health Insurance (NHIS)

| Fact | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| D-2 enrolment timing | From entry, or from registration if that is later | NHIS: "입국일 즉시 취득" for "유학(D-2), 일반연수 초중고생(D-4-3)"; exception "외국인등록일이 입국일보다 늦을 경우, 외국인등록일로 취득" | SAME | S124, S127 |
| D-4 (language) timing | After 6 months | NHIS applies the 6-month rule to statuses "입국일 즉시 취득 대상이 아닌", which covers general D-4 by inference. SeoulTech: "입국일로부터 6개월이 경과한 날". | SAME | S124, S127 |
| Student reduction | 50% since March 2023 | NHIS: "유학(D-2), 일반연수(D-4)… : 50%". The floor is the previous November's average premium. | SAME | S125 |
| 2026 monthly premium | About KRW 79,320 (one university notice) | Now backed by three universities: Sungshin ("월 보험료: 79,320원"), SeoulTech ("월 79,320원 (2026년 기준)") and Sogang (excerpt; one version reads 79,310). KU gives KRW 76,390 for 2025 and states it is the amount after the 50% reduction. **No NHIS page states the 2026 amount.** | STILL UNCONFIRMED (NHIS); stronger university support | S126, S127, S128, S129 |
| Payment | By the 25th, paid in advance | Sungshin: "매월 25일까지 납부"; auto-debit, virtual account, bank, ATM, convenience store. NHIS itself says only "보험료 1개월분 선납". | SAME (25th is a university source) | S126, S129, S124 |
| Arrears | Can restrict visa extension | SeoulTech: late fee up to 5%, "restrictions on visa extensions", benefits suspended | SAME | S127 |

### 2.3 Bank, transport and SIM

| Fact | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Restricted account limits | KRW 3M branch / 1M ATM / 1M online | FSC (2024-05-02): "▴인터넷뱅킹 100만원 ▴ATM 100만원 ▴창구거래 300만원" | SAME (now regulator-confirmed) | S132, S133 |
| Account before the residence card | Passport + Korean address proof, at the branch's discretion | InvestKorea: before the card, ID is the passport plus address proof, because "the customer's address … cannot be confirmed with the passport" | SAME | S133, S134 |
| T-money | KRW 3,000–5,000; reload up to KRW 500,000 | KTO: "3,000 won-5,000 won"; "Reload amount limited to 500,000 won max" | SAME | S137 |
| WOWPASS | KRW 5,000 | Same | SAME | S137 |
| Climate Card (기후동행카드) | Cash or Korean card only | The 30-day pass was "discontinued effective October 1, 2026". The card is "limited to use within Seoul starting October 1, 2026". Seoul City: "단기권은 계속 운영할 예정이며, 서울시에서만 이용"; the replacement benefit is for 서울 시민만 (Seoul citizens only). | CHANGED | S137, S138 |
| ICN T1 telecom counters | 24h counters near Arrival Hall F | 24h KT, SKT and LG U+ counters near Arrival Hall F (west, 1F). Further counters near Hall A, 06:00–22:00. | SAME | S135 |
| ICN T2 telecom counters | Not verified | 24h KT and LG U+ near Exit 4 (1F); SKT near Exit 7 (1F); LG U+ also near Exit 7, 06:00–22:00 | NEWLY CONFIRMED | S136 |
| Carrier tourist eSIM products and prices | SKT foreigner eSIM, under 90 days | The official carrier pages could not be read. Third-party price tiers were not used as fact. | STILL UNCONFIRMED | S152, S153, S154, S155 |
| Postpaid needs the residence card | Commercial guides only | Not re-verified | STILL UNCONFIRMED | — |
| AREX T2 → Seoul Station, all-stop KRW 5,350 | As stated | The official AREX site needs JavaScript. One third-party source agrees. | STILL UNCONFIRMED (official) | — |

### 2.4 Emergency and helplines

| Number | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| 1345 Immigration Contact Center | Weekdays 09:00–22:00; only KR/EN/ZH after 18:00; +82-1345 | "09:00 to 22:00 on weekday"; after 18:00 "Korean, English, and Chinese"; "+82-1345" (footer also gives +82-2-1345) | SAME | S123 |
| 1330 Korea Travel Hotline | +82-2-1330; chat | "1330 (in Korea), +82-2-1330 (from Overseas)". Chat via KakaoTalk, Line, WhatsApp and Facebook; free online call. | SAME (+channels) | S139 |
| 112 police | 24/7 English and Chinese interpretation | "is now run 24 hours a day" (2024-03-19). Japanese and Vietnamese were only "planned"; their launch is not confirmed. | SAME | S140 |
| 119 fire and ambulance | Number | The number is correct. No official page on its interpretation service was found. | STILL UNCONFIRMED (interpretation) | — |

### 2.5 Pickup, insurance and orientation (official or university)

| Fact | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| KU ISC 2026 shuttle | "Free or low-cost"; hourly 11:00–19:00 from T1 Gate F, check-in day only | Confirmed (posted 2026-05-07; up to 40 per trip; no check-out service). **The cost is not stated**, so "free" is unsupported. | CHANGED (remove "free") | S141 |
| KU winter programme shuttle | — | A similar shuttle runs on check-in day | NEWLY CONFIRMED (example) | S142 |
| Private insurance before NHIS | Universities recommend it | **No immigration rule requiring proof of insurance for D-2/D-4 was found.** D-2 examples: KU calls private insurance "*Optional" and says "private insurance cannot replace NHIS"; SeoulTech provides free group insurance. D-4 examples: Dankook makes group insurance mandatory for 6 months ("58,000원", conflicting with a 70,000 snippet); Yonsei KLI enrols students in a group policy. | SAME (recommendation); no legal requirement found | S127, S129, S130, S131 |
| Orientation / arrival report examples | KU GSIS Spring 2026 etc. | Not re-fetched; these are past, institution-specific examples | STILL UNCONFIRMED (no re-check) | — |
| Mobile residence card; extension fee KRW 60,000 | — | Not re-checked in this pass | STILL UNCONFIRMED (no re-check) | — |

**Tally:** 31 official facts re-checked.

| Verdict | Facts |
|---|---|
| SAME | 17 |
| CHANGED | 3 (change-report days, Climate Card, "free" pickup) |
| NEWLY CONFIRMED | 2 (ICN T2 counters, KU winter shuttle) |
| STILL UNCONFIRMED | 9 (incl. not re-checked) |

The post-arrival change-report row counts once, as CHANGED.

---

## 3. Commercial landscape (current, 2026-10-10)

> No provider below is a Hangyul Univ partner. Prices are what the provider displayed on the date accessed. Show them to students only as "indicative, check the provider".

### 3.1 Airport pickup

| Provider | What is offered | Price indication | B2B / partner channel | Sources |
|---|---|---|---|---|
| Trazy — "Private Van Transfer for International Students: Incheon Airport ↔ Universities in Seoul" | Van for about 4 people, one way, ICN to named Seoul universities ("Other Universities" also possible). Includes a sign greeting, tolls and parking, and 90 minutes' free waiting. | **KRW 106,200 per van**; night surcharge (22:00–05:00) KRW 12,500. The overtime fee conflicts on the page itself. Refunds: "2 days before … 100% refund", 1 day before non-refundable; no-show after 1.5 hours means no refund. The **operator is not named**. | trazy.com/partner is a supplier sign-in portal; no public affiliate terms | S143, S144 |
| Klook — transfers | Airport transfers | Product pages blocked (403); prices not verified | affiliate.klook.com exists; commission terms not verified (third-party figures only) | S145, S146 |
| KKday | Transfers (not checked) | — | Affiliate via networks (unverified); Rezio supplier platform | S147, S167 |
| University shuttles | Korea University summer and winter programmes, check-in day only | Cost not stated | n/a | S141, S142 |

### 3.2 Temporary housing

| Option | Facts found | Price indication | Partner channel | Sources |
|---|---|---|---|---|
| Gosiwon (고시원) | 5,180 gosiwon in Seoul (2026 figure from Seoul City, via Asia Economy). Studio-type premium rooms are growing. | Premium rooms KRW 650,000 (Incheon); Gangnam 900,000–1,000,000 (2026-09-07). No official average. | — | S156 |
| Share house (university benchmark) | Yonsei OIA guidance | KRW 350,000–550,000 a month. Studios: deposit 5M–30M, rent 400,000–1,500,000. (©2022, may be dated.) | — | S157 |
| Enkostay | No deposit; "Your payment is held safely by Enkostay and is only released to the host after you've moved in"; problems can be reported within 24 hours. Registered 통신판매업 (mail-order business) 2023-서울종로-1113. | No prices shown | "Become a partner" link; "Universities we've worked with" section | S158 |
| Borderless House Korea | "4 HOUSES 58 ROOMS IN SEOUL", furnished, "no hidden fees" | No official prices | "Affiliated organization" link | S159 |
| Woozoo (우주) | Share-house platform; deposit returned after move-out inspection | "50만원 이하" (under KRW 500,000) filter exists | 제휴문의 (partnership inquiry) link | S160 |
| Kozaza (now redirects to Wehome) | Nightly home-sharing, not student housing | About KRW 97,100–189,400 a night (Seoul) | — | S161 |
| "Zippy" (named in the brief) | Could not be identified. The nearest match is Ziptoss (집토스), a real-estate agency; not verified. | — | — | — |

### 3.3 Student insurance before NHIS

| Point | Finding | Sources |
|---|---|---|
| Legal requirement for D-2/D-4 | None found. Do not claim one. | — |
| D-2 practice | NHIS cover starts at registration, so there is a gap between arrival and registration. Universities recommend private or travel cover. Some (SeoulTech) provide free group insurance; at KU it is optional. | S124, S127, S129 |
| D-4 practice | Language institutes often make group insurance mandatory for the first 6 months, before NHIS starts. Dankook: mandatory, KRW 58,000 for 6 months (conflicting snippet says 70,000). Yonsei KLI: automatic group policy. | S130, S131 |
| Product guidance | Hangyul should show "check your university's insurance rule". It should not sell or recommend a specific insurer. Selling insurance needs an insurance agency registration under the 보험업법 (Insurance Business Act); this was not researched here. | — |

### 3.4 eSIM

| Provider | Offer | Price indication | Partner channel | Sources |
|---|---|---|---|---|
| Airalo | South Korea eSIM, unlimited data | 3 days $12; 5 days $20; 7 days $29; 10 days $35; 15 days $49; 30 days $69. The network and whether a phone number is included are not stated. | Partner programmes for business, reseller, co-branding, affiliate and API. Affiliate: "standard commission rate is 10% on the final sale value"; payout threshold $15. | S149, S150, S151 |
| KT / SKT / LG U+ tourist eSIM | Counters at ICN T1/T2 (§2.3); online products | Official pages inaccessible; prices STILL UNCONFIRMED | — | S152, S153, S154 |
| Klook eSIM | KT eSIM listing | Page blocked (403) | Klook affiliate (above) | S148 |

---

## 4. What a real agreement with any of these providers would need

This section is a checklist for business and legal staff. It does not describe any existing deal.

**1. A signed written agreement on file before any "partner" label is shown.** This follows the existing Hangyul partner-contract rule. Until then, providers appear only as "options students can book themselves". If an affiliate link is used, disclose that a commission may be paid.

**2. Transport licensing (pickup).**
- Paid passenger transport needs a licensed operator: a 전세버스 (charter bus), taxi, or rental car with driver where the law allows it.
- 여객자동차 운수사업법 (Passenger Transport Service Act) Art. 81 bans paid carriage in private (non-business) vehicles and the arranging of it. This is an excerpt only; the full text was not read [S165].
- The contract should require:
  - the operator's business licence number;
  - commercial vehicle registration;
  - passenger insurance (공제/보험) certificates;
  - driver vetting;
  - the named operator. The Trazy listing does not name one.

**3. Travel business registration.**
- 관광진흥법 (Tourism Promotion Act) Art. 3 defines 여행업 (travel business) as arranging transport, accommodation and related services for travellers.
- Art. 4 requires registration with the 시·군·구 (city, county or district) office [S164, mirror].
- If Hangyul resells or bundles pickup or housing, it probably needs this registration, plus the guarantee insurance attached to it (not verified).
- Online sales need a 통신판매업 신고 (mail-order business report).

**4. Personal data (PIPA, 개인정보 보호법).**
- Art. 26: data-processing outsourcing must be in a written document that limits the purpose and sets technical and administrative safeguards. The outsourcing must be disclosed, and the processor must be supervised and trained [S162, version in force 2026-09-11].
- Art. 28-8: transferring student data abroad needs a legal basis, such as separate consent or disclosure where the transfer is needed to perform the contract [S163]. This matters for Klook (HK), KKday (TW), Airalo and Borderless House, because students' flight, passport and address data would go to them.

**5. Consumer terms.**
- Refund and cancellation terms must be at least as good as the provider's public terms. Trazy, for example, refunds 100% two or more days before and nothing after.
- Flight-delay rules and service levels.
- Liability and indemnity for no-shows, delays and luggage.
- The provider's own liability insurance certificate.
- A complaint channel in the student's language.

**6. Housing specifics.**
- Escrow or holding of payments, as Enkostay describes.
- Deposit-return terms and inspection rules.
- Proof that the host or landlord has the right to let the room.
- A building safety check for gosiwon (fire-safety compliance). The legal source for this was not researched here.
- No promise of a residence-registration address unless the provider confirms in writing that registration is allowed.

**7. Insurance.** Hangyul must not sell, broker or bundle insurance without an insurance agency registration. It may only point students to their university's rule.

**8. Data in the product.** Every provider claim shown to students needs a dated source line, like every other fact in Hangyul data. Price snapshots older than 90 days should be flagged.

---

## 5. Corrections to apply

| # | File / JSON path | New value | Source |
|---|---|---|---|
| 1 | `arrival-official.json` → item `residence_report_changes` `.summary` | "within **15** days" (registered foreigners, 출입국관리법 제36조). Drop "14 days". | S166 |
| 2 | `post-arrival-official.json` → `items[address_change_report].facts[0].status` | `VERIFIED`; add source S166 (district office citing Art. 36) | S166 |
| 3 | `arrival-official.json` → `transport_card_tmoney` `.summary` | Add: "From 1 Oct 2026 the Climate Card 30-day pass ended and the card works only within Seoul; short-term passes continue (Seoul only)." | S137, S138 |
| 4 | `arrival-official.json` → `sim_esim_arrival` `.summary` | Add the T2 counters: 24h KT and LG U+ near Exit 4, SKT near Exit 7 (1F) | S136 |
| 5 | `arrival-official.json` → `university_airport_pickup` `.summary` | Replace "free or low-cost" with "some universities run shuttles on specific check-in days (cost varies; KU's 2026 notice does not state a price)". Add the KU winter example. | S141, S142 |
| 6 | `arrival-official.json` → `nhis_student_premium` | Keep "about KRW 79,320/month (2026)". Cite Sungshin + SeoulTech (+ Sogang excerpt). Keep the label "not stated by NHIS". | S126, S127, S128 |
| 7 | `arrival-official.json` → `bank_account_opening` | Cite FSC for the restricted-account limits | S132 |
| 8 | `arrival-official.json` → `residence_card_registration` `.steps[0]` | Keep "book on HiKorea". Add an example of an office suspending walk-ins (Sejongno, 2026-03-13 to 04-03). | S122 |
| 9 | `arrival-official.json` → `private_insurance_bridge` | Add "No immigration rule requires private insurance for D-2/D-4. Several language institutes require 6-month group insurance for D-4." | S129, S130, S131 |
| 10 | `arrival-official.json` → `emergency_and_helplines` | Add the 1330 chat channels (KakaoTalk, Line, WhatsApp, Facebook; online call) | S139 |

## 6. Still needs a human

1. The NHIS 2026 student premium figure from NHIS itself (call 033-811-2000 or the foreigner line).
2. Whether the residence card fee can be paid by card at the offices Hangyul targets.
3. Carrier tourist eSIM and SIM prices, and whether they include a phone number. Check at the carrier counter or by phone, since the web pages are inaccessible.
4. The AREX fare on the official AREX site.
5. Whether 119 offers interpretation and in which languages.
6. For any provider Hangyul wants to work with: the named transport operator and its licence (Trazy van), housing price lists (Enkostay, Borderless, Woozoo), and Klook/KKday transfer pricing and affiliate terms. All need written confirmation from the provider.
7. The legal opinion on whether Hangyul's planned bundling needs 여행업 (travel business) registration or insurance agency registration.
