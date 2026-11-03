# Thai (th) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `th`
- Status: NOT human-reviewed. `status` must not be set to `HUMAN_REVIEWED` on the basis of this record.
- Leak check (step 4): not run by this agent — the coordinator runs it.

## Scope

- Merged: `scripts/i18n/v9-data/th-1.json` … `th-10.json` (3,633 native todo keys, a superset of the 3,217 web keys),
  `th-11.json` (7 keys added by other agents during the run), `th-12.json` (2 STATE_MAP terminology fixes),
  `th-13.json` + `th-14.json` (13 revisions from this review).
- New namespace files created by the merge: `student`, `dossier`, `success`, `writing`, `visaroute`, `concierge`, `mobile`.
- Result: `v9-todo th` → web 3,563 keys, 0 missing / identical / stale; `--native` → 4,057 keys, 0 missing.
- Identical to English on purpose (`_identical_ok`): placeholder-only strings (`common:notify.serviceCase`, `common:task.concierge.handle`,
  `student:v4.home.housingStatus`, `student:v9.funds.amount.ANY`, `dossier:summary.S_BLOCKED`, `dossier:v9.who.sentItem`,
  `writing:student.reviewerAgency`, `writing:student.reviewerHangyul`, `visaroute:form.value.empty`, `visaroute:route.oneLine`,
  `mobile:v3.university.dormRange`), brand/test names (`mobile:app.student`, `mobile:devAccess.group.hangyul`, `mobile:v3.application.hangyul`,
  `mobile:v3.quick.lang.IELTS`, `mobile:v3.quick.lang.TOPIK`) and messenger names (`concierge:contact.KAKAOTALK/LINE/TELEGRAM/WHATSAPP/ZALO`).

## Sample read

Every todo key was written and then re-read by namespace; the review pass focused on:

- Verdicts and eligibility (`student:verdict.*`, `discover.verdict.*`, `start.tier.*`, `success:group.*`, `mobile:v3.match.*`, `v3.quick.tier.*`, `common:tier.*`) against docs/STATE_MAP.md.
- Money (`student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `budget.*`, `offers.*`, `v4.offer.*`, `ws3.tuition.*`, `success:submission.fee.*`).
- Family link and sponsor page (`student:v9.family.*`, `v9.sponsor.*`) — parents are the readers.
- Visa route (`visaroute:*`: caveats, methods, document reasons, tracking), legalization flow (`student:legalFlow.*`).
- Submission authorization (`success:submission.authorize.*`), document vault (`dossier:*`), essays (`writing:*`), arrival (`concierge:*`), native app (`mobile:*`).

No screenshots: browsers are off for translator agents. The coordinator's leak-check screenshots are the screen-level check.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 4 / 4 / 5 / 5 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 5 / 4 / 4 / 4 / 5 | 5 / 4 / 5 / 5 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 3 / 4 / 4 | 5 / 4 / 5 / 5 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 3 / 3 / 4 / 4 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Why the first scores were below 4: trust was 3 for C and D because two existing `common:tier.*` labels used odds wording
("มีโอกาสแข่งขัน" = competitive chance, "ท้าทาย" = challenging) where STATE_MAP says *Possible match* / *Not eligible yet*, and one
partner benefit read as "urgent" review (a promise the English does not make). D's naturalness was 3 because of a few calques
("มุมมองครอบครัว" for "Family view", "ถึง {{when}}" for "Landing", "ผลสอบขั้นต่ำที่ใกล้ที่สุด" for "Smallest test step").

## Issues found and fixed

| Key | Before → After | Why |
|---|---|---|
| `common:tier.COMPETITIVE` | มีโอกาสแข่งขัน → อาจเหมาะสม | STATE_MAP *Possible match*; the old label implied admission odds. |
| `common:tier.REACH` | ท้าทาย → ยังไม่มีคุณสมบัติ | English is "Not eligible yet"; same term as every other *Not eligible yet* string. |
| `student:university.partner.benefit.PRIORITY_REVIEW_SUPPORT` | ตรวจเอกสารแบบเร่งด่วน → การตรวจเอกสารแบบได้รับลำดับก่อน | "Urgent" overstated "priority". |
| `student:dashboard.nextAction.COMPARE_OFFERS.text` | "…ต้องแจ้งมหาวิทยาลัยอื่นด้วย" → "…เป็นการตัดสินใจที่ต้องแจ้งให้มหาวิทยาลัยอื่นทราบด้วย" | The first draft turned the sentence into a bare obligation; now it keeps the English meaning (accepting one = a decision you tell the others). |
| `student:phase.state.todo` | ขั้นตอนถัดไป → ภายหลัง | English is "Coming later", not "Next step". |
| `common:legalization.APOSTILLE`, `common:docCategory.APOSTILLE` | Apostille / Apostille (การรับรองเอกสาร) → การรับรองอะพอสทิล / อะพอสทิล (การรับรองเอกสาร) | One Thai term everywhere; no bare Latin word on student screens. |
| `common:essayType.CV`, `common:docCategory.CV` | CV / CV / ประวัติย่อ → ประวัติย่อ | Plain Thai, no Latin abbreviation. |
| `student:v9.family.nav`, `.title` | มุมมองครอบครัว → หน้าสำหรับครอบครัว | "มุมมอง" (perspective) reads oddly to older parents; "หน้า" (page) is plain. |
| `student:v9.routes.step.title` | ผลสอบขั้นต่ำที่ใกล้ที่สุด → เป้าหมายผลสอบที่ใกล้ที่สุด | "Nearest test goal" is what the card shows. |
| `student:v9.sponsor.landing`, `dashboard.arrival.landing` | ถึง {{when}} → เครื่องลงจอด: {{when}} | A bare "ถึง" was ambiguous without "flight". |
| `student:v9.refund.status.WAITING_STUDENT`, `concierge:status.REFUND.WAITING_STUDENT` | รอคุณ → รอคุณดำเนินการ | Says the student must act. |
| `visaroute`/`student` funds: `v9.funds.longer_other` | (กลุ่ม 'ต้องปรับปรุง') → (กลุ่ม 'ต้องรับคำปรึกษาปรับปรุง') | Matches the Korean "consulting" university tier more precisely. |

## Terminology (reused from existing th strings or fixed here)

| Concept | Thai |
|---|---|
| Strong match | เหมาะสมมาก (existing `common:tier.STRONG`) |
| Possible match | อาจเหมาะสม |
| Not eligible yet / one step away | ยังไม่มีคุณสมบัติ / อีกเพียงขั้นเดียว |
| Needs your grades (we need your grades to check) | ต้องใช้ผลการเรียนของคุณ (…เพื่อตรวจสอบ) |
| Counselor / agency | ที่ปรึกษา / เอเจนซี (existing) |
| Offer / admission letter | ข้อเสนอการรับเข้า / หนังสือตอบรับเข้าศึกษา (existing `appStatus.*`) |
| Tuition / deposit / proof of money | ค่าเล่าเรียน / เงินมัดจำ / หลักฐานทางการเงิน |
| Apostille / consular legalization | การรับรองอะพอสทิล / การรับรองโดยสถานกงสุล |
| Residence card | บัตรประจำตัวคนต่างด้าว (existing `docCategory.RESIDENCE_CARD`) |
| Bank balance certificate | หนังสือรับรองยอดเงินในบัญชี (existing) |
| Personal statement / study plan | เรียงความแนะนำตนเอง / แผนการศึกษา (existing) |
| e-visa / visa issuance certificate | วีซ่าอิเล็กทรอนิกส์ / หนังสือรับรองการออกวีซ่า |
| Service plans | สำรวจฟรี / ช่วยเตรียมการสมัคร / พรีเมียม ดูแลสู่การตอบรับ (existing marketing names) |

Kept as is (official names / allowed tokens): Hangyul, TOPIK, IELTS, TOEFL iBT, KIIP, D-2, D-4, D-4-1, NHIS, HiKorea, T-money, visa.go.kr,
g4k.go.kr, VFS Global, CHSI / CDGDC, NRC, OECD.

## Residual risks (what a native reviewer should check first)

1. Money and visa sentences (`student:v9.money.*`, `v9.funds.*`, `v9.guard.text`, `visaroute:caveat.*`, `methodNote.*`): precise but long; a
   native reviewer should confirm the legal tone of "ผิดกฎหมาย" in `v9.funds.genuine` and the refund wording.
2. Loanwords that older parents may not know: พอร์ทัล (portal), เช็กลิสต์, อะพอสทิล, เซสชัน, eSIM. They are standard Thai UI words but D-profile
   comprehension is the weakest score (4).
3. Korean place names follow the existing Thai region names; airport names (ชองจู, กิมโป, กิมแฮ) and foreign city names should be spot-checked.
4. `submission.authorize.check` uses the formal "ข้าพเจ้า" because it is a declaration; check it reads right inside the checkbox.
5. Plural-free Thai: count strings were written once (`_other`) — check sentences where English also has a non-suffixed base key
   (e.g. `dossier:check.matching`, `page.needYou`) read naturally with 1.
6. Mixed register: most UI is neutral; a few labels use "ฉัน" (first person) where English uses "I/my" buttons — intended, but a reviewer may
   prefer neutral phrasing.
