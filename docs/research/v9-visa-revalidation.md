# V9 — Visa playbook re-validation (D-2 / D-4-1, 14 priority countries)

Re-validated: **2026-10-10**
Baseline: `docs/research/visa-playbooks.json` (41 routes; V5 research 2026-09-29, plus the V6 update)
Source registry: `docs/research/v9-visa-sources.json` (ids `V9V-Sn`)
Code: nothing was edited. This file reports findings and proposes data corrections only.

---

## 1. Method and limits

**What was done**
- Every baseline URL was re-fetched for the 14 countries: NP, MM, VN, UZ, MN, CN, IN, BD, PK, ID, TH, PH, KZ, KG.
- Each post's visa and notice boards (`list.do`) were scanned for posts dated after 2026-09-01, so that anything changed after the V5 cut-off (2026-09-29) would be caught.
- Attachments were downloaded and read (PDF, DOCX, HWP — including the distribution-protected HWP files, which were decrypted — ZIP, and image notices).
- National rules were checked against:
  - the MOJ manuals behind HiKorea notice 1062: 사증발급 안내매뉴얼 "2026. 9." and the 체류 매뉴얼 / revision log dated 260918 [V9V-S5];
  - the MOJ/MOE IEQAS press release of 2026-02-12 [V9V-S7];
  - the MOJ press release of 2026-10-07 [V9V-S8];
  - visa.go.kr [V9V-S9, S10];
  - the HCCH status table (last updated 30-VI-2026) and its objection pages [V9V-S1–S4].
- KVAC/VFS sites were used where a country has one.

**Verdict labels**

| Label | Meaning |
|---|---|
| SAME | The current official source says what the baseline says. |
| CHANGED | The official source now differs, or the baseline value was wrong. |
| NEWLY CONFIRMED | A gap or ambiguity in the baseline is now settled by an official source. |
| STILL UNCONFIRMED | No official source publishes it, or the source could not be read. |

**Evidence labels**

| Label | Meaning |
|---|---|
| page | The page was read in full. |
| excerpt | A quoted portion of the page or attachment was read. |
| inaccessible | The page could not be read. |

Text in "quotes" is a verbatim excerpt. Untranslated Korean, Russian and Nepali is kept as written.

**Limits**
1. Most overseas.mofa.go.kr pages sit behind a NetFunnel "waiting room". They were read by polling the queue with curl. Image-only notices (e.g. India fee tables, the Vietnam apostille notice) were read visually.
2. Some menus load through JavaScript and could not be listed: the Myanmar-language board, the Uzbekistan menus and the Pakistan Karachi menus. On those sites only boards with a fixed URL were checked.
3. Five parts of the research were done by delegated research agents, each working from the same rules:
   - NP/MM/BD;
   - VN/TH/PH;
   - UZ/MN/KZ/KG;
   - CN/IN/PK/ID, plus a cross-cutting MOJ/HCCH pass.

   The two largest changes were spot-checked directly by the lead researcher: the Bangladesh KVAC launch [V9V-S27] and the Kyrgyzstan 2026-08-14 notice [V9V-S84, title and attachment].
4. One rule held throughout: **no rule was carried from one country to another**. Where a post publishes nothing, the row says "not confirmed (not published)".
5. Nothing here is legal advice. Posts change lists without notice, so the product should keep showing "confirm with the post".

**How the playbook is shared across routes.** Routes of one country share most fields. The table below is therefore per country; where D-4-1 differs, it is called out in its own row. JSON indices refer to the top-level array of `visa-playbooks.json`:

| Country | Index → visa type |
|---|---|
| NP | 0 = D-2-2, 1 = D-2-3, 2 = D-4-1 |
| MM | 3 = D-2-2, 4 = D-2-3, 5 = D-4-1 |
| VN | 6 = D-2-2, 7 = D-2-3, 8 = D-4-1 |
| UZ | 9 = D-2-2, 10 = D-2-3, 11 = D-4-1 |
| MN | 12 = D-2-2, 13 = D-2-3, 14 = D-4-1 |
| CN | 15 = D-2-2, 16 = D-2-3, 17 = D-4-1 |
| IN | 18 = D-2-2, 19 = D-2-3, 20 = D-4-1 |
| BD | 21 = D-2-2, 22 = D-2-3, 23 = D-4-1 |
| PK | 24 = D-2-2, 25 = D-2-3, 26 = D-4-1 |
| ID | 27 = D-2-2, 28 = D-2-3, 29 = D-2-4, 30 = D-4-1 |
| TH | 31 = D-2, 32 = D-4-1 |
| PH | 33 = D-2, 34 = D-4-1 |
| KZ | 35 = D-2-2, 36 = D-2-3, 37 = D-2-4, 38 = D-4-1 |
| KG | 39 = D-2, 40 = D-4-1 |

---

## 2. Cross-cutting national rules (apply per rule, never per country by analogy)

| Rule | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Student e-visa eligibility | Excellent-certified university: all D-2. Certified: D-2-3/D-2-4 only. No e-visa for D-4-1. | Manual 2026.9: "우수 인증대학 : 모든 유학과정(D-2-1~D-2-8)"; "인증대 : 석사(D-2-3) 또는 박사(D-2-4) 과정 입학생". Cuba, Syria, Macedonia and Kosovo nationals are excluded. D-4-1 is "×" at every tier. Filed through visa.go.kr. The visa.go.kr e-visa page itself is stale ("2014.12.08 기준") and does not list D-2, so the manual is the authority. | SAME | V9V-S5, S9 |
| D-4-1 issued only through a CCVI (사증발급인정서, filed in Korea by the university) | CN, VN, UZ, MN at general or lower-tier universities | "일반대학에 입학하는 몽골, 베트남, 우즈벡, 중국의 어학연수생" and "하위대학에 입학하는 …". At consulting universities, D-4-1, D-2-6 and D-2-8 are CCVI-only for these four nationalities. At a 비자제한 university, D-2-4, D-2-5 and D-2-6 are CCVI-only for **all** nationalities. Applies only to these four of our 14 countries. | SAME | V9V-S5 |
| TB high-risk list | 35 countries; all 14 of ours are on it | "결핵 고위험국가(35개국)". All 14 are listed. Who must submit: "국내에 90일 초과하여 체류할 목적…(전자사증 대상자의 경우에는 … 외국인등록 시 제출)". | SAME | V9V-S5 |
| 21 고시국가 (MOJ-designated high-overstay countries) | All 14 are on the list. The note adds "posts in third countries generally do not accept applications from these nationals". | The list is SAME and all 14 are on it. **The third-country sentence is wrong for D-2/D-4.** The manual applies that rule only to E-6-2. For D-2/D-4 it says: "신청인의 거주국 또는 최종학교 소재지 관할 공관에서 신청 원칙". Some posts run their *own* third-country lists, e.g. Hanoi's "법무부 고시국가 (31개국)" [S40] and Bangkok's ~31-country 2-year-residence rule [S49]. These are post rules. | CHANGED (note text) | V9V-S5, S40, S49 |
| D-2 financial standard | KRW 20M (capital area) / 16M (other regions), cited to the MOJ manual | The manual itself says only "1년간 등록금 및 체재비 상당하는 금액". The 20M/16M figure is now confirmed in the MOJ 2026-10-07 strategy annex: "인증대를 제외한 유학생 2천만원(비수도권 1천6백만원) 재정입증". | NEWLY CONFIRMED (MOJ) | V9V-S5, S8 |
| D-4-1 financial standard | KRW 10M / 8M | The manual says only "1년간 (어학연수 6개월)의 재정능력". No MOJ figure. The 10M/8M amounts come only from posts (MM, VN, MN, CN, ID). | STILL UNCONFIRMED at MOJ level | V9V-S5 |
| 30-day balance certificate | Shown as a national rule for all D-2/D-4 routes (ID, TH, PH, KZ, KG notes) | National only for D-4: "잔고증명서는 30일 이내 발급한 것만 유효한 것으로 인정". **Not stated for D-2.** For D-2, use each post's own window. | CHANGED (scope) | V9V-S5 |
| Parent's balance → family proof | Required | "부․모 잔고증명서 제출 시 가족관계증명서 추가 제출 필요" | SAME | V9V-S5 |
| 지급유보 (payment-hold) certificate | Vietnam only | D-2: "베트남의 경우 … 지급유보방식의 별도 유학경비 잔고증명서". Same wording in the D-4 CCVI section. | SAME (VN only) | V9V-S5 |
| Legalisation of foreign documents | Apostille or Korean consular confirmation | "해외에서 발급된 서류는 자국 정부의 아포스티유(Apostille) 확인 또는 주재국 대한민국 공관의 영사확인". Chinese degrees use the CHSI/CDGDC report instead. | SAME | V9V-S5 |
| 3-month validity | Sometimes shown as a national rule | Manual: "국내에서 발급․제출하는 서류의 유효기간은 … 3개월". This covers **Korean-issued documents only**. There is no national rule for foreign documents, so each post's rule applies. | CHANGED (scope) | V9V-S5 |
| e-Form | Mandatory at some posts | visa.go.kr: the form may be "제17호 서식, 또는 … 전자서식". Nationally it is optional; posts can make it mandatory (e.g. BD, IN). | SAME (post rule) | V9V-S9 |
| IEQAS tiers | 우수인증 / 인증 / 일반 / 하위 (컨설팅, 비자제한) | 2025 evaluation, released 2026-02-12, valid 2026.3–2030.2: 우수 39, 인증 181 (language programmes 123), 일반 134, 컨설팅 13, 비자정밀심사 16. Current names: "비자심사강화대학(舊 하위대학)" and "비자정밀심사대학(舊. 비자제한대학)". **Conflict:** the Beijing PDF lists "우수 인증대학(43교)" and the Jakarta guide refers to "43개 대학". | NEWLY CONFIRMED (names/counts); 39 vs 43 STILL UNCONFIRMED | V9V-S7, S87, S114 |
| MOJ changes after 2026-09-01 | — | The revision log has no D-2/D-4 entry in 2026; the 9.1 and 9.18 entries cover E-7-4, F-1-D and F-5. The 2026-10-07 press release announces *plans*, none of them in force: finance waiver for TOPIK 4 / KIIP 4; a study-fund deposit scheme ("’27년 상반기" / "’28년"); suspension of certified-university benefits for weekend, night and online programmes. Treat these as watch items. | SAME (rules); NEW watch item | V9V-S5, S6, S8 |

**HCCH Apostille status.** Source: status table updated 30-VI-2026 and its objection pages [V9V-S1, S2, S3, S4, S11]. Korea did not object to any accession below. No dates changed since V5.

| Country | Party? | Type / accession | Entry into force | Verdict |
|---|---|---|---|---|
| NP | No | — | — | SAME |
| MM | No | — | — | SAME |
| VN | Yes | A**, 31-XII-2025 | **11-IX-2026 (now in force)**. Objections: DE, AT, CZ. | SAME (dates); in force since baseline |
| UZ | Yes | A**, 25-VII-2011 | 15-IV-2012 | SAME |
| MN | Yes | A**, 2-IV-2009 | 31-XII-2009 | SAME |
| CN | Yes | A** D, 8-III-2023 | 7-XI-2023. Objection: India only. | SAME |
| IN | Yes | A**, 26-X-2004 | 14-VII-2005 | SAME |
| BD | Yes | A**, 29-VII-2024 | 30-III-2025. 12 objectors, Korea not among them. | SAME |
| PK | Yes | A** D,N, 8-VII-2022 | 9-III-2023 | SAME |
| ID | Yes | A D, 5-X-2021 | 4-VI-2022 | SAME |
| TH | Yes (deposited) | A, 30-VI-2026 | **28-II-2027 (not yet in force)** | SAME |
| PH | Yes | A** D, 12-IX-2018 | 14-V-2019 | SAME |
| KZ | Yes | A D, **5-IV-2000** | 30-I-2001 | SAME (adds the accession date) |
| KG | Yes | A**, 15-XI-2010 | 31-VII-2011 | SAME |

---

## 3. Per-country re-validation

### 3.1 Nepal (NP) — routes 0–2

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | Embassy Kathmandu, whole country | Same | SAME | S12, S15 |
| Channel | KVAC Kathmandu (Pulchowk); intake windows Dec 1–Feb 15 and Jun 1–Aug 14 | Same. "외교 및 공무 여권 소지자를 제외한 모든 비자 접수 업무는 비자신청센터로 이관". KVAC is walk-in, 09:00–16:00 on working days; pickup 09:00–17:00. | SAME (+hours NEWLY CONFIRMED) | S15, S16, S18 |
| D-2 documents | Embassy list (admission letter, business registration, cover letter, study plan, education documents, TB, 6-month statement) | Embassy list unchanged (modified 2026-08-05). KVAC checklists (D-2 2026.05.08, D-4 2026.06.09) add: SOP, "11 Mark Sheet", character certificates, family relationship certificate, balance certificate, and consultancy registration + PAN when filed via an agency. | NEWLY CONFIRMED (KVAC additions) | S12, S19, S20 |
| Financial amount | None stated | None stated by the embassy or KVAC | SAME | S12, S19 |
| Holding period | 6 months of statements, Class A banks only | "은행거래내역서 신청일 기준 최근 6개월분 (제1금융권에서 발급된 것만 인정)" | SAME | S12 |
| Certificate issue window | Not stated | KVAC: "issued within one month from the date of your visa application" | NEWLY CONFIRMED | S19 |
| TB test | 4 designated hospitals | Same 4 (Patan, Civil Service, Korea Nepal Friendship/Thimi, Sukraraj). No validity period stated. | SAME | S12 |
| Family documents | Not listed | KVAC: "Family relationship certificate (Originals & photocopies)" | NEWLY CONFIRMED | S19 |
| Apostille / legalisation | Not an HCCH party; Korean embassy consular confirmation | Same. "주네팔대한민국대사관 영사확인 요함". Provisional certificate only within 1 year of graduation. | SAME | S1, S12, S14 |
| Document validity | 6 months; language scores 2 years | **Conflict.** Embassy: "발급일로부터 6개월 이내 (어학성적 2년)". KVAC: "Documents are only valid for three months from the date of issue. Verified Educational documents (6 months validity)." | CHANGED (conflict surfaced) | S12, S19 |
| Visa fee | USD 60 = Rs 9,300 | Same. Cash. | SAME | S13 |
| VAC service fee | Not stated | NPR 2,000 per application, cash. Optional: delivery NPR 1,000, form-filling NPR 1,000, VIP NPR 5,000. | NEWLY CONFIRMED | S18 |
| Processing time | D-2: 8 working days, 10 in Dec–Feb and Jun–Aug | Same for D-2. D-4 is not named (only D-2-1~D-2-4 in the 8-day group; "other general visas" 15 days). Visa valid 90 days; apply ≥40 days before travel. | SAME; D-4 STILL UNCONFIRMED | S16 |
| Interview / refusal | Interview possible; reasons not disclosed | Same. No re-apply bar published. | SAME | S12 |
| Special notes | 21-country third-country note | See §2: the third-country sentence is wrong for D-2/D-4. KVAC fraud warning 2026.02.04 (title only read). | CHANGED (note) | S5 |
| D-4-1 differences | Same list; no e-visa | KVAC D-4 list = D-2 list without the language-score line | SAME | S19 |

### 3.2 Myanmar (MM) — routes 3–5

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | Embassy Yangon | Same | SAME | S21 |
| Channel | D-2: waiting number at the gate. D-4: online booking windows. | Same. The **Mar-2027 D-2 waiting-number notice is still not posted**; the latest is seq=91 (Sep-2026 term). Passport pickup "(월~금) 15시-16시". | SAME; Mar-2027 notice STILL UNCONFIRMED | S25, S26 |
| D-2 documents | List dated 2025-09 | **New list "2026.10", modified 2026-10-02.** No D-2/D-4 change is declared. Items not in the baseline: "NRC 카드(원본, 사본, 영문번역 공증본)"; language proof (TOPIK 3/4, KIIP or Sejong equivalents) for 컨설팅/비자제한 university admits. | CHANGED (source date; 2 items added) | S21 |
| Financial amount | D-2 KRW 20M / 16M per year | Same in the 2026.10 PDF | SAME | S21 |
| Holding period | ≥6 months of transactions | "6개월 이상 입출금 거래내역서 원본(사증 신청일 기준 30일 이내 발급본) 2부" | SAME | S21 |
| Certificate window / issuer | Within 30 days; balance-certificate date must equal the statement end date | "잔고증명서 발급일과 거래내역서 조회기간 종료일이 일치하여야 함" | SAME | S21 |
| TB test | Designated hospital, original; 3 months | List still "(2026.4)": Nine Star (Yangon) 37,000 Ks; Bawga Theiddhi (Naypyitaw) 65,000; Mandalar (Mandalay) 57,000; Sakura (Yangon) 38,000 | SAME (+hospital list NEWLY CONFIRMED) | S23 |
| Family documents | Household list, notarised English translation | Same | SAME | S21 |
| Apostille / legalisation | Not an HCCH party; post requirement unclear (PARTIAL) | **Settled.** Myanmar-issued documents need only "원본, 사본(2부) 및 영문번역공증본". Third-country documents need "아포스티유 또는 … 영사확인". | NEWLY CONFIRMED | S1, S21 |
| Document validity | 3 months unless stated | "별도로 기간이 명시되어 있지 않는 한 사증 신청일로부터 3개월 이내 발급" | SAME | S21 |
| Visa fee | USD 60, non-refundable | Same; no express option for long-term visas | SAME | S22 |
| Processing time | 30 days | "유학(D-2), 어학연수(D-4) … 30일" | SAME | S22 |
| Interview / refusal | 6-month re-apply bar | "불허일로부터 6개월 간 사증 재신청 불가" | SAME | S22 |
| Special notes | Fraud notice 2026-09-18 | Same: "관계기관에 관련 사실을 통보하고 고발 또는 수사를 요청". Third-country note must be corrected (§2). | SAME; note CHANGED | S24, S5 |
| D-4-1 differences | KRW 10M / 8M; online booking | Same. D-4 adds "연수과정 운영현황 및 연수계획(교육기관 작성)". | SAME (+1 item) | S21 |

### 3.3 Vietnam (VN) — routes 6–8

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | Hanoi: Quang Tri and north. HCMC: Gia Lai and south. Da Nang: Hue, Quang Nam, Quang Ngai. | Hanoi ("QUANG TRI성 포함한 북쪽지역", 2025-10-20) and HCMC ("Gia Lai성 이남", 2026-07-27) wording is post-merger and SAME. Da Nang's FAQ still uses pre-merger names. **Not confirmed:** which post covers former Kon Tum, now inside new Quang Ngai. | SAME (Hanoi, HCMC); Da Nang STILL UNCONFIRMED | S40, S42, S45, S48 |
| Channel | KVAC Hanoi / HCMC; Da Nang by g4k booking | **Hanoi KVAC is walk-in with queue numbers since 2026-04-06** (online booking stopped), Mon–Fri 08:00–16:30. HCMC KVAC 08:30–12:00 and 13:00–16:00. HCMC has an optional "VIP" service from 2026-10-05 for an extra fee. Da Nang study visas: "유학사증은 대리 신청 불가". | CHANGED (Hanoi booking) | S45, S46, S47 |
| D-2 documents | Hanoi 2026-06-11 and HCMC 2026-01-05 lists | Unchanged. **No post has updated its study list for apostille.** | SAME | S36, S41, S44 |
| Financial amount | KRW 20M / 16M | "(수도권) 최소 2,000만원 … (지방) 최소 1,600만원" | SAME | S36 |
| Holding period | ≥3 months; 6 for consulting universities; none for D-2-4~8 | Same | SAME | S36 |
| Certificate window / issuer | Within 10 days; 지급유보 certificate; no transferred accounts | "잔고증명서는 접수일 기준 10일 이내 발급한 것만 유효" | SAME | S36, S5 |
| TB test | Designated hospitals (8 in Hanoi); 3 months | Same | SAME | S36, S39, S44 |
| Family documents | Household register / CT07 / birth certificate | Same | SAME | S36 |
| Apostille / legalisation | Transition: apostille from 2026-09-11, but the post lists still say consular confirmation | Apostille in force since 2026-09-11 (HCCH; Korea did not object). Notice of 2026-09-14 [S37]: "베트남 외교부의 아포스티유 확인만으로 한국에 제출". Sticker apostille only; e-apostille "현재 미시행". **Caveat:** Korean posts may still consular-confirm "베트남 소재 초·중·고등학교의 재학·성적·졸업증명서", and "국내의 문서 접수처에서 … 특정 방식을 요구할 수도". The study lists (Hanoi June, HCMC Jan, Da Nang Mar) still say MOFA authentication + consular confirmation. | NEWLY CONFIRMED (in force + high-school caveat); list reconciliation STILL UNCONFIRMED | S1, S2, S3, S36, S37, S41, S44 |
| Document validity | 3 months; balance certificate 10 days; education documents consular-confirmed within 1 year | Same | SAME | S36 |
| Visa fee | Ambiguous (null) | **USD 50 at all three posts** for single entry with a stay of 91+ days (multiple USD 80). Hanoi: "장기비자(체류기간 91일 이상) 50달러 [단수]". HCMC: "체류기간 91일 이상 50달러". Da Nang: "50$ (91일 이상)". | CHANGED (resolved) | S39, S42, S44 |
| VAC service fee | 390,000 VND | Same (Hanoi and HCMC) | SAME | S46, S47 |
| Processing time | Hanoi 20 / 10 / 7 working days; HCMC 20; Da Nang 15 | Same. HCMC table 2026-01-21: D-2 and D-4 20 days. | SAME | S36, S43, S44 |
| Interview / refusal | Interview possible; re-apply after 3 months | Same. Da Nang adds: refusal for false documents means a 6-month bar, and its FAQ says "1년~3년간" restriction. | SAME (+Da Nang detail) | S36, S44, S45 |
| Special notes | Service-account screening; residence-move rule | NEW (2026-05-28): "Global International School" / St. Mary's International School (Hanoi) records are invalid even if already consular-confirmed. | NEWLY CONFIRMED (new notice) | S38 |
| D-4-1 differences | KRW 10M / 8M, 6 months; CCVI-only at general/lower tier | Same | SAME | S36, S5 |

### 3.4 Uzbekistan (UZ) — routes 9–11

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | Embassy Tashkent | Same | SAME | S61 |
| Channel | Accredited agencies only (list 2026-04-01); fee 250,000 UZS | Same: 13 Tashkent + 2 Samarkand agencies. "대행기관은 외교·공무·결혼 사증을 제외한 모든 사증의 접수와 교부". | SAME | S62, S65 |
| D-2 documents | 2024 list + 2026-06-12 finance and language rules | Same. Language proof is mandatory even at excellent-certified universities. IELTS Online and the Uzbek MoE English test are not accepted. | SAME | S61, S63 |
| Financial amount | D-2 USD 15,500 / 12,500 (or UZS) | "15,500$ 혹은 190,650,000SUM / 12,500$ 혹은 153,750,000SUM". Under 6 months: tuition + "780$(9,594,000sum)×체류개월수". | SAME | S61 |
| Holding period | ≥1 month (consulting: 6 months) | Same; SKA is not accepted at consulting universities | SAME | S61 |
| Certificate window / issuer | KDB certificate within 30 days | "KDB 잔고증명서는 신청일 기준 30일 이내 발급된 증명서만 인정하며, 시차를 두어 잔고 보유 여부를 재확인". Parents' certificates are supplementary and must be QR-verifiable; property must have been held 3+ months. | SAME (+QR/property detail) | S61 |
| TB test | TIC or K Mediwell | Same (USD 30 each). No validity stated. | SAME; validity STILL UNCONFIRMED | S63, S64 |
| Family documents | Birth certificate + parents' finance documents (my.gov.uz, davreestr.uz) | Same | SAME | S61, S63 |
| Apostille / legalisation | Apostilled original of final education certificate | Same | SAME | S1, S63 |
| Document validity | Not stated | Not stated | STILL UNCONFIRMED | — |
| Visa fee | Not stated | Not stated on any current page. The only figure ("$70(90일 이상)") is in an obsolete 2013 post and must not be used. | STILL UNCONFIRMED | S66 |
| Processing time | Not stated | Not stated (2013's "10일" is obsolete) | STILL UNCONFIRMED | S66 |
| Interview / refusal | — | "어학능력을 입증하는 서류를 제출하지 못한 학생은 면담 없이 불허". The study plan must be written by the applicant. No re-apply bar published. | NEWLY CONFIRMED | S61 |
| Special notes | Fraud notice 2025-04-17 | Still listed. No study notice after 2026-06-11. | SAME | S67 |
| D-4-1 differences | USD 7,800 / 6,300, 3 months; CCVI-only at general/lower tier | "(수도권) 외화 7,800$ … (비수도권) 6,300$" | SAME | S61, S5 |

### 3.5 Mongolia (MN) — routes 12–14

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | Embassy Ulaanbaatar | Same | SAME | S68 |
| Channel | KVAC or one of 13 accredited agencies | **Changed.** (a) 2026-09-09: individuals may file directly at KVAC without an agency. (b) Agency J (DIDO LLC) stopped on 2026-09-28, leaving **12 agencies**. (c) The agency system changes at the end of 2026; a briefing was held on 2026-10-08. KVAC hours: individuals 08:30–16:00, agencies 08:30–11:00. | CHANGED | S72, S73, S74, S75 |
| D-2 documents | Visa Finder 2026-05-18 | Same source (still the latest). Items not in the baseline: "범죄경력증명서(만 18세 이상, 최초 신청자에 한함)", "혼인관계증명서" / birth registration for minors, self-introduction on the embassy form, school business registration ≤6 months old. | NEWLY CONFIRMED (items) | S68 |
| Financial amount | KRW 20M / 16M | "2,000만원 이상(수도권), 1,600만원 이상(비수도권) 상당액을 반드시 30일 이상 유지" | SAME | S68 |
| Holding period | ≥30 days (lower tier 6 months), kept during screening | Same. USD converted at the quarterly base-date rate. | SAME | S68 |
| Certificate window / issuer | Within 2 weeks + 3 months of transactions | Same | SAME | S68 |
| TB test | Designated institution; 3 months | "결핵진단서 유효기간: 사증신청일 기준 3개월 이내". Six hospitals listed. | SAME | S68 |
| Family documents | Birth certificate | Same, plus marriage certificate (see documents) | SAME | S68 |
| Apostille / legalisation | Apostille, consular confirmation or CHESICC | Same | SAME | S1, S68 |
| Document validity | 3 months unless stated; E-Mongolia printouts | Same | SAME | S68 |
| Visa fee | USD 60; GKS exempt | Same | SAME | S68 |
| VAC / agency service fee | Not parsed | KVAC 57,000 MNT. Agencies 30,000 MNT (Keybridge 50,000). Optional: form-filling 17,000; translation 6,000/page. | NEWLY CONFIRMED | S71, S75 |
| Processing time | Study 20 days; CCVI 7 days | Same; also stated on the KVAC D-2 page | SAME | S69, S75 |
| Interview / refusal | Interview possible; re-apply after 3 months (from 2025-12-15) | Same. Undue pressure or deception: 6 months to 3 years ban. | SAME | S68, S70 |
| D-4-1 differences | KRW 10M / 8M; CCVI-only at general/lower tier | Same | SAME | S68, S5 |

### 3.6 China (CN) — routes 15–17

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | 9 posts by hukou; may also apply where the school is | Same. Shanghai adds: "사증발급인정서 소지자는 호구지에 관계없이 당관에 신청 가능". | SAME | S87, S92 |
| Channel | KVAC Beijing / Guangzhou; designated agencies | Same. Hours: Beijing agencies 09:00–12:00, individuals 09:00–16:00. **Shenyang KVAC moved on 2026-09-04** (灵浠中心 A座15层; visaforkorea-shenyang.com). Shenyang general visas go only through the KVAC and designated agencies. Shanghai KVAC: 长宁区仙霞路99号31层. | CHANGED (Shenyang VAC address) | S88, S92, S93 |
| D-2 documents | Beijing PDF (file 260819) | Beijing unchanged. **New guides at Guangzhou (260930) and Shanghai (2026.09.30).** Guangzhou waives final-education proof for excellent-certified and certified universities. | NEWLY CONFIRMED (consulate guides) | S87, S91, S92 |
| Financial amount | KRW 20M / 16M (D-2), 10M / 8M (D-4-1); Beijing CNY at rate 220.41 | KRW SAME at all posts. CNY equivalents differ: Guangzhou 99,384 / 79,507 / 49,692 / 39,754; Shanghai (rate 185.27) 107,957 / 86,360 / 53,975 / 43,180. Shanghai: "1년간(어학연수 6개월)". | SAME (KRW); post-specific CNY NEWLY CONFIRMED | S87, S91, S92 |
| Holding period | ≥3 months (Beijing); 6 months for consulting / visa-restricted universities | **Post-specific.** Beijing: 3 months. Guangzhou: "동결기간 … 1개월이상" (consulting and below: 6 months). Shanghai: "최소 30일 이상" remaining. Shenyang: "30일 이상" (lower tier: 6 months). | CHANGED (must be per post) | S87, S91, S92, S94 |
| Certificate window / issuer | Within 30 days | Same everywhere. **Designated banks:** Guangzhou: ICBC, BOC, Minsheng, Hana, CCB (other banks need an explanation letter and proof of the freeze). Shenyang: ICBC, BOC, Minsheng, CCB. | NEWLY CONFIRMED (banks) | S91, S94 |
| TB test | Designated hospital; 3 months; under-6s and pregnant women exempt | Same. Guangzhou rejects certificates missing the hospital phone, doctor's name or stamp. | SAME | S87, S91, S94 |
| Family documents | Required when funds are in a parent's name | Same | SAME | S87 |
| Apostille / CHSI | CHSI only for Chinese degrees | Same. Guangzhou and Shanghai also accept CSCSE for HK/Macau/Taiwan/foreign degrees. | SAME | S87, S91, S92 |
| Document validity | Korean public documents 3 months | Same | SAME | S87 |
| Visa fee | CNY 420 (+140 express) | Same at all posts | SAME | S88, S90, S92, S93 |
| VAC fee | Beijing CNY 120; Guangzhou 110 (express 190) | Same. Beijing express CNY 200. Shenyang 120 (+80 express). | SAME (+express NEWLY CONFIRMED) | S93, S95 |
| Processing time | Beijing and Guangzhou 10 days | Same. **Shanghai: "5일 이내" for D-2/D-4**, counted from the day after receipt. Shenyang not stated. | NEWLY CONFIRMED (Shanghai) | S88, S90, S92 |
| Interview / refusal | Re-apply after 2 months at the same post | Same. Guangzhou may hold phone interviews. | SAME | S88, S91 |
| Special notes | Monthly agency sanctions | Latest 2026-09-23 (covers 26.09.28–10.22). A KVAC Beijing notice of 2026-09-28 has an empty body (content unconfirmed). TOPIK level for associate degrees at consulting universities: Shanghai 2급 vs Beijing 3급. | SAME; conflict flagged | S89, S95 |
| D-4-1 differences | Post visa only for certified universities and government scholars; otherwise CCVI | Same. Shanghai: consulting universities "D-4-1, D-2-6, D-2-8 사증발급인정서로만". | SAME | S87, S92, S5 |

### 3.7 India (IN) — routes 18–20

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | Delhi (north) / Mumbai (central) / Chennai (south), by passport place of issue or address | Same | SAME | S96 |
| Channel | Delhi: VFS. Chennai: KVAC-VFS. Mumbai: agencies from 2026-10-01. | **Mumbai confirmed:** "From October 1, 2026, applicants must apply … through a designated travel agency … direct (walk-in) applications … will no longer be accepted". 14 agencies listed (27.07.2026); the list may change. Delhi VAC hours 09:00–13:00 (Kolkata 10:00–13:00). Delhi VAC enlarged 2026-09-15, with Friday collection until 21:00. | NEWLY CONFIRMED | S96, S98, S99 |
| D-2 documents | Per-post checklists | Same, plus Delhi now lists "Health Condition Report" and "Declaration Form". Mumbai checklist w.e.f. 24.08.2026 (no apostille wording for D-2). | NEWLY CONFIRMED (Delhi items) | S96, S100 |
| Financial amount | Not stated | Not stated by any post | STILL UNCONFIRMED | S96, S100, S102 |
| Holding period | 6 months of statements | Same | SAME | S96, S100 |
| Certificate window | Not stated | Not stated by the posts (the national rule is D-4 only, §2) | STILL UNCONFIRMED | — |
| TB test | Designated labs per post | Same | SAME | S96 |
| Family documents | Mumbai sponsor set | Same | SAME | S100 |
| Apostille / legalisation | Delhi and Chennai: apostille. Mumbai D-2: original only. | Same. Mumbai D-4-1: "Original Apostilled academic document". | SAME | S96, S100, S102 |
| Document validity | Not stated | Not stated | STILL UNCONFIRMED | — |
| Visa fee | Chennai Rs 5,400; Delhi/Mumbai Aug-2026 revision not verified | **Delhi: INR 5,400** (single >90 days, from 2026-08-01; ≤90 days 3,600; multiple 8,100). **Mumbai: 5,400 regular / 8,100 express** from 2026-08-03 (was 5,100 / 7,650). Chennai Rs 5,400. | NEWLY CONFIRMED | S97, S101, S102 |
| VAC fee | VFS Rs 1,380 | Same; Chennai courier Rs 550 | SAME | S96, S102 |
| Processing time | Delhi not stated; Mumbai ~10 days; Chennai ≥25 / 27 working days | **Delhi: "신청일 + 14 근무일" (Kolkata +2–3 days); express "잠정중단".** Mumbai and Chennai unchanged. | NEWLY CONFIRMED (Delhi) | S96, S99, S102 |
| Interview / refusal | — | Mumbai warns genuine applicants may be refused for missing documents. No re-apply interval published. | STILL UNCONFIRMED (interval) | S99 |
| D-4-1 differences | Mumbai separate checklist (training plan) | Same | SAME | S100 |

### 3.8 Bangladesh (BD) — routes 21–23

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | Embassy Dhaka | Same | SAME | S27 |
| Channel | IN_PERSON at the embassy consular section, Sun–Thu 9:00–15:30 | **Changed.** Since 2026-09-02, a VFS-run KVAC handles intake: "general visas will be handled exclusively through the Visa Application Center". 2F B&T Nehaleeya Tower, Plot 80, Block B, Kemal Ataturk Ave, Dhaka 1213. Sun–Thu 09:00–16:00. "Each visa applicant must make an individual appointment". The embassy keeps the decision and diplomatic/official visas. The embassy's student page still says "visit … Consular section" and is stale. | CHANGED | S27, S28, S29, S34 |
| D-2 documents | Combined D-2/D-4 list | Same page. Items not in the baseline: University Payment Certificate; "Police Clearance Certificate … (within 3 months)"; English score (TOEFL/IELTS, within 2 years); air-ticket booking; cover letter; passport valid ≥6 months. | NEWLY CONFIRMED (items) | S29 |
| Financial amount | Not stated | Not stated | STILL UNCONFIRMED | S29 |
| Holding period | 6-month statement + solvency certificate | Same | SAME | S29 |
| Certificate window | National 30-day rule cited | The post states none. The 30-day rule is national for D-4 only (§2). | STILL UNCONFIRMED (D-2) | S29, S5 |
| TB test | PRAAVA Health, Banani; 3 months | Same | SAME | S30 |
| Family documents | City Corporation / Union certificate (3 months); parents' NOC | Same | SAME | S29 |
| Apostille / legalisation | MoE + MoFA attestation; HCCH party since 2025-03-30 | Post page unchanged: "attested by Ministry of Education and Ministry of Foreign Affairs … (within 3 months) … don't need to attest the documents from Korean Embassy". No mention of apostille for visas. Korea did not object to BD's accession, so an apostille is legally valid between the two states. The same embassy already asks for e-Apostille for **GKS** (2026-02-02). | SAME (post rule); legal context NEWLY CONFIRMED | S1, S11, S29, S33 |
| Document validity | 3 months for attestation, family and TB documents | Same | SAME | S29 |
| Visa fee | USD 60 (BDT at USD 1 = 125) | Same | SAME | S27, S31 |
| VAC fee | n/a | **BDT 2,150** per application (cash for the first ~2 weeks, then online in advance). Optional services price list on the VFS site. | NEWLY CONFIRMED | S34 |
| Processing time | Not stated | Not stated | STILL UNCONFIRMED | — |
| Interview / refusal | — | Not published | STILL UNCONFIRMED | — |
| Special notes | Shin Gyeongju University warning (2026-07-24) | Same, plus 2026-07-28 bankruptcy-claims notice (Daegu court; the embassy "has no authority to intervene"). | SAME (+1 notice) | S32, S35 |
| D-4-1 differences | Same combined list | Same | SAME | S29 |

### 3.9 Pakistan (PK) — routes 24–26

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | Islamabad (all but Sindh) / Karachi (Sindh) | Same | SAME | S104, S108 |
| Channel | In person; Islamabad 9:30–11:30, Karachi 9:00–12:00 | Same. No visa sticker (2026-03-27). | SAME | S104, S109, S111 |
| D-2 documents | Official list | Items not in the baseline: English certificate (Islamabad: "IELTS, TOEFL ibt preferred, TOEIC is not accepted"; Karachi: IELTS); Karachi: "IMMUNIZATION CERTIFICATE FOR POLIO VACCINATION". | NEWLY CONFIRMED (items) | S104, S109 |
| Financial amount | Whole cost of stay per admission certificate | Same | SAME | S104 |
| Holding period / window | ≥1 month; statement ≤2 weeks old | "held in Account for 1 Month at least … not … more than 2 weeks before" | SAME | S104 |
| TB test | Designated centres | Same | SAME | S104 |
| Family documents | Birth / family certificate for a parent sponsor | Same | SAME | S104 |
| Apostille / legalisation | Pakistan MOFA apostille; consular legalisation ended 2024-10-23 | Same. The visa page still says "Attested by HEC or Related Educational Board". | SAME | S1, S107 |
| Visa fee | Conflict: Rs 18,000 vs USD 60 | **Resolved: Rs 18,000.** Fee notice (2026-03-02), Karachi notice (2026-02-24) and the Korean guide all say Rs 18,000. USD 60 appears only on the stale static requirement pages. | CHANGED (resolved) | S105, S109, S110 |
| Processing time | Islamabad 8 weeks; Karachi 3 vs 8 weeks | **Resolved: minimum 8 weeks at both posts.** The 3-week figure is only on Karachi's stale static page. | CHANGED (resolved) | S106, S108, S109 |
| Interview / refusal | Re-apply after 3 months | Same | SAME | S109 |
| D-4-1 (route 26) | NEEDS_REVIEW: no list | **Still no D-4-1 list** on any Pakistan post. "D-4" appears only in an F-3 eligibility line. | STILL UNCONFIRMED | S104, S106, S108, S110 |

### 3.10 Indonesia (ID) — routes 27–30

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | Embassy Jakarta | Same | SAME | S112 |
| Channel | KVAC Jakarta | Same. Intake 09:00–15:00; collection 12:00–17:00. | SAME (+hours NEWLY CONFIRMED) | S117 |
| D-2 documents | Google Sites guide | Same | SAME | S114 |
| Financial amount | KRW 20M / 16M | Same | SAME | S114 |
| Holding period | 3 months of transactions (6 months for certain universities) | Same | SAME | S114 |
| Certificate window | National 30-day rule cited | Not stated for D-2 by the post; national rule is D-4 only (§2) | CHANGED (note scope) | S5, S114 |
| TB test | New form from 2026-06-11 | Same. "발급일 이후 3개월간 유효". 115 designated hospitals. | SAME (+validity, count NEWLY CONFIRMED) | S113 |
| Family documents | Kartu Keluarga (3 months) | Same | SAME | S116 |
| Apostille / legalisation | APOSTILLE tag on all D-2 routes | The guide places "고등학교 이하인 경우 … 공증 또는 아포스티유" **only under D-2-1, D-2-2 and D-4-1**. D-2-3 and D-2-4 carry no such note. | CHANGED (D-2-3 / D-2-4 tag) | S114 |
| Document validity | Education documents 6 months | Same. Admission certificate and scholarship certificate valid 3 months. | SAME (+NEWLY CONFIRMED) | S114, S116 |
| Visa fee + VAC fee | Rp 1,020,000 + 240,000 | Same (cashless) | SAME | S117 |
| Processing time | 10th day | Same | SAME | S114 |
| Interview / refusal | — | "불허일로부터 3개월 간 비자신청이 제한"; fraud: up to 3 years | NEWLY CONFIRMED | S116 |
| Special notes | "43 universities" list not captured | The list is still not published by Jakarta. The count matches the Beijing PDF's "우수 인증대학(43교)", but that is inference only — do not display it as Jakarta's list. | STILL UNCONFIRMED | S87, S114 |
| D-4-1 differences | KRW 10M / 8M; no visa at visa-restricted universities | Same | SAME | S115 |

### 3.11 Thailand (TH) — routes 31–32

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | Embassy Bangkok; third-country nationals need 2+ years' residence | Same | SAME | S49 |
| Channel | In person or designated agency; parent may file for a child | Same. Agency list valid 2026.6.30–12.31. Main page: "대리 신청은 지정 대행사를 통해서만". The parent-for-child exception is still live. | SAME | S49, S50, S51 |
| D-2 documents | Shared D-2/D-4 list (modified 2026-09-14) | Page now modified **2026-09-30**. Adds "여권 발급 기록조회서 (Record of passport, 태국 국적자에 한함, 태국 외교부 발급)". | CHANGED (+1 document) | S49 |
| Financial amount | Not stated | Not stated | STILL UNCONFIRMED | S49 |
| Holding period / window | ≥6 months of history; issued within 2 weeks | Same | SAME | S49 |
| TB test | Designated hospital | Same (list "22.6.16") | SAME | S49 |
| Family documents | English birth certificate | Same | SAME | S49 |
| Apostille / legalisation | Thai MFA certification; HCCH in force 2027-02-28 | Same. NEW (2026-04-22): the MFA stamp should read "Certified Genuine Signature(s)" / "Certified True Copy"; "Seen at the Ministry …" may trigger requests for more documents. | SAME (+NEWLY CONFIRMED detail) | S1, S4, S49, S52 |
| Document validity | 3 months | Same | SAME | S49 |
| Visa fee | THB 2,040 general; Thai "FREE" (to re-check) | **Thai nationals FREE**, checked visually on the 2023.03.29 table | NEWLY CONFIRMED | S49 |
| Processing time | 10–14 working days | Same | SAME | S49 |
| Interview / refusal | Explanation form if re-applying within 6 months | Same | SAME | S49 |
| D-4-1 differences | Same list | Same | SAME | S49 |

### 3.12 Philippines (PH) — routes 33–34

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | Manila / Cebu boundary not found | **Settled.** Cebu covers the Visayas ("16 provinces of the Visayas region"). "루손지역(Luzon) 및 민다나오(Mindanao) 거주자의 비자 접수는 마닐라소재 비자신청센터(KVAC)로". | NEWLY CONFIRMED | S55, S56 |
| Channel | KVAC Manila "9F–10F"; Cebu counter | KVAC address is "9/F (zone2) Brittany Hotel" (BGC). Individuals 08:30–16:00; release 13:00–17:00. Embassy designated 55 agencies from 2026-10-01. Cebu requires a g4k booking; the study slot is 11:00–12:00. | CHANGED (address detail, Cebu booking) | S55, S58, S60 |
| D-2 documents | Manila list 2019-04-01 | Still the live list; no newer one exists | SAME | S53 |
| Financial amount | Manila: per admission certificate. Cebu: USD 20,000. | Same. Cebu's English text says "master or PhD", which contradicts its Korean text (전문학사 이상). | SAME (+inconsistency flagged) | S53, S54 |
| Holding period / window | Within 30 days; no holding period | Same | SAME | S53 |
| TB test | Designated hospitals (list 09.23) | Same | SAME | S53 |
| Family documents | PSA birth certificate + parents' marriage certificate | Same | SAME | S53 |
| Apostille / legalisation | Party since 2019; post states nothing | Same | SAME | S1, S53 |
| Visa fee | Manila not stated; Cebu Php 3,000 | Same | SAME; Manila STILL UNCONFIRMED | S54 |
| VAC fee | PHP 1,000 from 2026-08-25 | Same | SAME | S60 |
| Processing time | Not verified for D-2 | Cebu: "최소 10일 근무일 … (통상 2주 이상)", which covers study. Manila D-2 not stated. Manila C-3 is 12 days from 2026-10-01 (does not apply to D-2). | NEWLY CONFIRMED (Cebu); Manila STILL UNCONFIRMED | S54, S57 |
| Special notes | 2026 financial-proof exemption | Same | SAME | S59 |
| D-4-1 differences | Cebu USD 9,000 | Same | SAME | S54 |

### 3.13 Kazakhstan (KZ) — routes 35–38

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | Astana / Almaty split | Same | SAME | S79, S76 |
| Channel | Walk-in; Astana Mon–Fri, Almaty Tue/Thu | Same | SAME | S77, S81 |
| D-2 documents | Per-post lists | Items not in the baseline: eGov address certificate (Astana: "не менее 6 месяцев" of registration; Almaty: "как минимум 3 месяца"). Almaty also requires a language certificate (TOPIK/IELTS/TOEFL). | NEWLY CONFIRMED (items) | S76, S81 |
| Financial amount | USD 20,000 / 18,000 | Same | SAME | S76, S81 |
| Holding / window | Certificate within 2 weeks + 6-month statement | Same. Astana (2025-09-23): funds must stay "вплоть до даты въезда" (until entry); the embassy may re-request the certificate. | SAME (+NEWLY CONFIRMED) | S76, S78 |
| TB test | Fluorography / PCR / skin test; 3 months | Visa pages same. **Conflict at Almaty:** its TB notice (modified 2026-08-25) requires "흉부 X-ray, 객담검사(PCR)" at designated hospitals. | CHANGED (conflict surfaced) | S80, S81 |
| Family documents | Birth certificate + English translation | Same | SAME | S76 |
| Apostille / legalisation | Astana: required. Almaty: not mandatory. | Same | SAME | S76, S81 |
| Document validity | Not stated beyond the items | Same | SAME | — |
| Visa fee | USD 60 (Almaty 40 / 60) | Same | SAME | S76, S81 |
| Processing time | ≥14 working days, up to 1 month | Same | SAME | S77, S81 |
| Interview / refusal | Astana: 3-month bar | Same. Astana fraud ban: "на 1 год … на 3 года", agencies included. | SAME (+NEWLY CONFIRMED) | S77, S78 |
| D-4-1 differences | USD 9,000 | Same | SAME | S76, S81 |

### 3.14 Kyrgyzstan (KG) — routes 39–40

| Field | V5/V6 value | 2026-10-10 finding | Verdict | Sources |
|---|---|---|---|---|
| Jurisdiction | Embassy Bishkek | Same | SAME | S82 |
| Channel | Tue/Thu walk-in for students | Same | SAME | S83 |
| D-2 documents | Russian page + 2022 attachment | Same until 2026-12-31. **New embassy notice (posted 2026-08-24, HWP dated 2026-08-14), effective 2027-01-01:** KICB balance certificate; parents' finance documents from Tunduk / cadastre.kg; language thresholds (D-4-1 TOPIK 1 / SKA 150; associate TOPIK 2; bachelor 3; master's+ 4; lower-tier universities 4; IELTS 5.5 / TOEFL iBT 71). | CHANGED (from 2027-01-01) | S84 |
| Financial amount | Conflict: USD 20,000 vs 18,000 | **Until 2026-12-31: USD 20,000** (current Russian page); the 2022 figure of 18,000 is superseded. **From 2027-01-01: USD 15,500 (capital area) / 12,500 (other regions)**, KICB, deposited 1+ month. | CHANGED (resolved + new rule) | S82, S84, S85 |
| Holding period | 3-month statement | Same until 2026-12-31. From 2027-01-01: 1+ month (D-2), 3+ months (D-4-1). | CHANGED (from 2027) | S84 |
| Certificate issuer | Any bank | From 2027-01-01: KICB, applicant or parent; QR-verifiable; a bank certificate alone is not enough for parents | CHANGED (from 2027) | S84 |
| TB test | 6 vs 3 months conflict | Russian page still says 6 months; the 2022 notice said 3 months; the 2026 notice is silent | STILL UNCONFIRMED | S82, S85 |
| Family documents | Birth certificate copy | Same | SAME | S82 |
| Apostille / legalisation | Apostilled diploma + insert | Same. Re-issued documents need a KG MoJ apostille. | SAME | S1, S82 |
| Document validity | Not stated | Not stated | STILL UNCONFIRMED | — |
| Visa fee | USD 70 | Same (card, QR or KICB cash) | SAME | S82, S85 |
| Processing time | Not stated | Not stated | STILL UNCONFIRMED | S83 |
| Interview / refusal | — | "При отказе причина отказа не сообщается" | SAME | S82 |
| D-4-1 differences | Conflict: USD 10,000 vs 9,000 | **USD 10,000 until 2026-12-31**; **from 2027-01-01 USD 7,800 / 6,300**, deposited 3+ months | CHANGED (resolved + new rule) | S82, S84 |

---

## 4. Tally

- **Rows re-checked:** 218. That is 204 country-field rows in §3 plus 14 cross-cutting rule rows in §2. The 14-row HCCH table is not counted separately; each country's apostille row in §3 already covers it.
- **Verdicts:** counted mechanically from the tables. A row with a split verdict appears under more than one label, so the counts add up to more than 218.

| Verdict | Rows |
|---|---|
| SAME (any part) | 149 |
| NEWLY CONFIRMED (any part) | 38 |
| STILL UNCONFIRMED (any part) | 26 |
| CHANGED (any part) | 25 |

---

## 5. Data corrections to apply to `visa-playbooks.json`

`[i]` is the top-level array index. `[i,j]` means apply the change to each listed index. "doc:key" means the `documents[]` entry with that `key`.

**Application method**

| # | JSON path | New value | Source |
|---|---|---|---|
| 1 | `[21,22,23].application_method` | `kind: "VISA_CENTER"`. Details: VFS-run KVAC Dhaka since 2026-09-02, 2F B&T Nehaleeya Tower, Plot 80, Block B, Kemal Ataturk Ave; Sun–Thu 09:00–16:00; individual appointment at visaforkorea-bd.com; the embassy decides. Also replace the "visit Consular section" wording. | V9V-S27, S28, S34 |
| 2 | `[21,22,23].fees` | Add `center_fee: "VFS service fee BDT 2,150 per application"` | V9V-S34 |
| 3 | `[12,13,14].application_method.details` | Individuals may file directly at KVAC (from 2026-09-09). 12 accredited agencies (DIDO/J ended 2026-09-28). Agency system changes end-2026. KVAC hours: individuals 08:30–16:00, agencies 08:30–11:00. | V9V-S72, S73, S74, S75 |
| 4 | `[12,13,14].fees` | Add `center_fee: "KVAC 57,000 MNT; accredited agencies 30,000 MNT (Keybridge 50,000)"` | V9V-S71, S75 |
| 5 | `[6,7,8].application_method.details` | Hanoi KVAC: walk-in with queue numbers since 2026-04-06, Mon–Fri 08:00–16:30. HCMC KVAC: 08:30–12:00 / 13:00–16:00; optional VIP service from 2026-10-05 at extra cost. | V9V-S46, S47 |
| 6 | `[18,19,20].application_method.details` | Mumbai: agency-only from 2026-10-01 (14 designated agencies, list 27.07.2026, subject to change). Delhi VAC hours 09:00–13:00 (Kolkata 10:00–13:00). | V9V-S96, S99 |
| 7 | `[15,16,17].jurisdiction[Shenyang]` and `application_method.details` | Shenyang KVAC moved 2026-09-04 to 灵浠中心 A座15层 (visaforkorea-shenyang.com); general visas only via the KVAC or designated agencies | V9V-S93 |
| 8 | `[33,34].jurisdiction` (`covers_regions`) | Manila/KVAC: Luzon and Mindanao. Cebu: Visayas (16 provinces). Cebu requires a g4k booking (study slot 11:00–12:00). KVAC address "9/F (zone2) Brittany Hotel, 6 McKinley Parkway, BGC". | V9V-S55, S56, S60 |

**Fees and processing time**

| # | JSON path | New value | Source |
|---|---|---|---|
| 9 | `[6,7,8].fees` | `amount: 50, currency: "USD"`. Details: single entry, stay 91+ days, at Hanoi, HCMC and Da Nang (multiple USD 80), plus KVAC 390,000 VND (Hanoi/HCMC). | V9V-S39, S42, S44 |
| 10 | `[24,25].fees.visa_fee` | `"Single entry > 91 days: Rs 18,000"`. Remove the USD 60 conflict note (static page stale). | V9V-S105, S109, S110 |
| 11 | `[24,25].processing_time` | `"Minimum 8 weeks (Islamabad and Karachi)"` | V9V-S106, S109 |
| 12 | `[18,19,20].fees` | Delhi: INR 5,400 (single >90 days, from 2026-08-01). Mumbai: INR 5,400 regular / 8,100 express (from 2026-08-03). Chennai: Rs 5,400 + VFS 1,380 + courier 550. | V9V-S97, S101, S102 |
| 13 | `[18,19,20].processing_time` | Prepend "New Delhi: application day + 14 working days (Kolkata +2–3 days); express suspended." | V9V-S96 |
| 14 | `[15,16,17].processing_time` | Add "Shanghai: D-2/D-4 within 5 days, excluding the day of receipt." | V9V-S92 |
| 15 | `[15,16,17].fees.center_fee` | Add Beijing express CNY 200 and Shenyang 120 (+80 express) | V9V-S93, S95 |
| 16 | `[0,1,2].fees.details` | Add "KVAC service fee NPR 2,000 per application (cash)" | V9V-S18 |
| 17 | `[31,32].fees` | Thai nationals: FREE (confirmed). Remove the "re-check" caveat. | V9V-S49 |

**Financial proof**

| # | JSON path | New value | Source |
|---|---|---|---|
| 18 | `[15,16,17].financial.holding_period` | Make it per post. Beijing ≥3 months. Guangzhou freeze ≥1 month. Shanghai ≥30 days remaining. Shenyang ≥30 days. Consulting / lower tier ≥6 months everywhere. Add designated-bank rules for Guangzhou (ICBC, BOC, Minsheng, Hana, CCB) and Shenyang (ICBC, BOC, Minsheng, CCB). | V9V-S87, S91, S92, S94 |
| 19 | `[39].financial` | `amount: "USD 20,000 (applications to 2026-12-31). From 2027-01-01: USD 15,500 (Seoul/Gyeonggi/Incheon) / 12,500 (other), KICB certificate in applicant's or parent's name, deposited ≥1 month"` | V9V-S82, S84 |
| 20 | `[40].financial` | `amount: "USD 10,000 (to 2026-12-31). From 2027-01-01: USD 7,800 / 6,300, KICB, deposited ≥3 months"` | V9V-S82, S84 |
| 21 | `[39,40].documents` doc:sponsor_documents | Add a 2027-01-01 rule: business, salary (Tunduk) and property (Tunduk/cadastre.kg) records; QR-verifiable; property held ≥3 months | V9V-S84 |
| 22 | `[39,40].reviewer_notes` | Replace the "show both 20,000 / 18,000" advice with the dated rule above. Keep the TB 3-vs-6-month conflict open. | V9V-S82, S84, S85 |
| 23 | `[0,1,2]` doc:bank_balance_certificate `.validity` | "Issued within 1 month of application (KVAC)" | V9V-S19 |

**Documents and validity**

| # | JSON path | New value | Source |
|---|---|---|---|
| 24 | `[0,1,2].special_notes` (document-validity note) | Embassy: 6 months. KVAC: 3 months for general documents, 6 months for verified education documents. Advise the stricter value. | V9V-S12, S19 |
| 25 | `[0,1,2].documents` | Add family_relation_certificate, SOP, character certificate, 11 mark sheet (KVAC list) | V9V-S19, S20 |
| 26 | `[3,4,5].documents` doc:final_education_certificate `.legalization` | `"NONE (post)"`. Notes: "Myanmar-issued: original + 2 copies + notarised English translation; third-country documents: apostille or Korean consular confirmation." Add an NRC card document. Add language proof for 컨설팅/비자제한 admits. | V9V-S21 |
| 27 | `[3,4,5].sources[0].page_date` | `"modified 2026-10-02 (list dated 2026.10)"` | V9V-S21 |
| 28 | `[5].documents` | Add "연수과정 운영현황 및 연수계획(교육기관 작성)" | V9V-S21 |
| 29 | `[21,22,23].documents` | Add police clearance (3 months), English score (2 years), air-ticket booking, university payment certificate | V9V-S29 |
| 30 | `[12,13,14].documents` | Add 범죄경력증명서 (18+, first-time applicants), 혼인관계증명서 / birth registration for minors | V9V-S68 |
| 31 | `[24,25].documents` | Add English certificate (Islamabad: IELTS / TOEFL iBT, TOEIC not accepted; Karachi: IELTS) and the polio immunization certificate (Karachi) | V9V-S104, S109 |
| 32 | `[18,19,20].documents` | Add Health Condition Report and Declaration Form (New Delhi) | V9V-S96 |
| 33 | `[35–38].documents` | Add the eGov address certificate (Astana ≥6 months, Almaty ≥3 months of registration). Add a language certificate (Almaty). | V9V-S76, S81 |
| 34 | `[35–38]` doc:tb_test `.notes` | Almaty notice (2026-08-25): chest X-ray + sputum PCR at designated hospitals. This conflicts with the visa page; show the stricter requirement. | V9V-S80 |
| 35 | `[35–38].special_notes` | Add the Astana rules: funds must remain until entry; fraud ban 1 year, then 3 years (agencies included) | V9V-S78 |
| 36 | `[31,32].documents` | Add "Record of passport (Thai nationals; Thai MFA)". Source page_date → 2026-09-30. Add the MFA stamp-wording note. | V9V-S49, S52 |
| 37 | `[28,29]` doc:final_education_certificate `.legalization` | `null`. The guide applies apostille only to high-school-level schools (D-2-1, D-2-2, D-4-1). | V9V-S114 |
| 38 | `[27–30].special_notes` | Add the 3-month refusal bar. TB certificate valid 3 months; 115 hospitals. | V9V-S113, S116 |

**Vietnam-specific notes**

| # | JSON path | New value | Source |
|---|---|---|---|
| 39 | `[6,7,8].special_notes` (apostille note) | Add "In force since 2026-09-11 (Korea did not object). Posts may still consular-confirm Vietnamese high-school records, and the receiving body may require one method. The study lists have not yet been updated." | V9V-S2, S37 |
| 40 | `[6,7,8].special_notes` | Add the 2026-05-28 invalid-records notice (Global International School / St. Mary's) and the Da Nang false-document bar (6 months; FAQ 1–3 years) | V9V-S38, S44, S45 |
| 41 | `[6,7,8].jurisdiction[Da Nang].covers_regions` | Add "Pre-merger names; the former Kon Tum area (now Quang Ngai) is unconfirmed" | V9V-S45, S48 |

**Corrections that apply across all routes**

| # | JSON path | New value | Source |
|---|---|---|---|
| 42 | All routes with the note "Posts in third countries generally do not accept applications…" (NP, MM, VN, UZ, MN) | Replace with "MOJ: apply at the post covering your country of residence or your last school. Some posts (e.g. Hanoi, Bangkok) apply their own third-country restrictions." | V9V-S5, S40, S49 |
| 43 | All routes with "[MOJ national rule] Bank balance certificates are valid only if issued within 30 days" (ID, TH, PH, KZ, KG; IN/BD `sponsor_rules`) | For D-4-1 routes, keep it as the MOJ rule. For D-2 routes, change to "post rule applies; the MOJ manual states 30 days only for D-4". | V9V-S5 |
| 44 | All `e_visa_condition` / tier wording using "lower-tier" or "visa-restricted" | Use the current names: 비자심사강화대학 (컨설팅대학 + 비자정밀심사대학; formerly 하위 / 비자제한). Cite the 2025 IEQAS results (39 / 181 / 134 / 13 / 16; valid 2026.3–2030.2). | V9V-S7 |
| 45 | `[35–38].special_notes` (apostille) | Add the accession date 5-IV-2000 | V9V-S1 |
| 46 | New top-level watch note (or `reviewer_notes` on all routes) | The MOJ 2026-10-07 plans (TOPIK 4 finance waiver; deposit scheme '27–'28; certified-university weekend/night/online benefit suspension) are **not in force**. Do not show them as rules. | V9V-S8 |

**Status changes this supports**
- VN routes 6–8 can stay PARTIAL: the list is not reconciled with apostille, although the fee is now resolved.
- PK routes 24/25 can move to VERIFIED: the fee and processing-time conflicts are resolved.
- PK route 26 stays NEEDS_REVIEW.
- KG routes 39/40 stay PARTIAL: TB validity and processing time are open.
- BD routes 21–23 must be updated before display, because the channel is wrong.

---

## 6. Still needs a human (phone or email to the post)

1. **Pakistan D-4-1:** a document list from the Embassy Islamabad / Karachi Office. None is published.
2. **Kyrgyzstan:** TB certificate validity (6 vs 3 months) and processing time. Also, whether a Russian version of the 2027 KICB rule will be issued.
3. **Uzbekistan:** current visa fee and processing time. Only an obsolete 2013 post exists. Also TB validity.
4. **Vietnam:**
   - (a) Will the Hanoi, HCMC and Da Nang study lists accept an apostille alone for university degrees and high-school records, or still ask for consular confirmation of high-school records?
   - (b) Which post covers the former Kon Tum area after the merger?
5. **Bangladesh:** whether a Bangladesh MoFA (e-)Apostille is accepted instead of MoE + MoFA attestation for visa files. Also processing time and the re-apply rule now that the KVAC runs intake.
6. **Nepal:** D-4 processing time (8 or 15 days?) and which validity applies (embassy 6 months vs KVAC 3 months).
7. **Myanmar:** the date of the Mar-2027 D-2 waiting-number intake.
8. **Philippines (Manila):** consular visa fee and processing time for D-2/D-4. Also whether the 2019 list is still complete.
9. **Thailand, India, Bangladesh, Pakistan:** a minimum balance amount. None is published; the admission certificate amount applies.
10. **China:** contents of the KVAC Beijing notice dated 2026-09-28 (empty body). Also the TOPIK level for associate degrees at consulting universities (Shanghai 2급 vs Beijing 3급).
11. **Kazakhstan (Almaty):** which TB test is accepted — the visa-page options or the notice's X-ray + PCR.
12. **IEQAS:** whether the excellent-certified count is 39 (MOJ press release) or 43 (Beijing PDF / Jakarta guide). Also obtain the actual list Jakarta applies.
13. **Mongolia:** what the end-2026 agency-system change will be (briefing held 2026-10-08; outcome not published).
