# V28 localization review: th (Thai)

Scope: all 355 keys in `scripts/i18n/v28/jobs/th.json` (232 with no current translation, 123 with one). Output: `scripts/i18n/v28/tx/th.json`.
Register carried over from V27: *คุณ* for the student, polite-neutral tone with no gendered particles (no ครับ/ค่ะ), sentences separated by a space and no full stops. Consoles use short, professional noun labels.
V28 change applied everywhere: the student-facing team is now *ทีม Hangyul*. All 19 current strings that said *ที่ปรึกษา(ของคุณ)* ("your counselor") were rewritten.

## Personas

1. **Ploy (พลอย), 18, Bangkok, first-time visitor.** Just finished ม.6 and wants a university Korean language institute year, then a bachelor's degree. She lands on a university page from a search and reads on her phone.
2. **Ton (ต้น), 26, Chiang Mai, comparison shopper.** Applying for an English-taught master's. He compares Hangyul's plans against an agency and wants exact fees, requirements and what is verified.
3. **Khun Mae Wan (คุณแม่วรรณ), 50, Ploy's mother.** She pays and is wary of guarantees and agents.
4. **Khun Nok (คุณนก), agency counselor / university admissions officer (console reader).** Wants short labels and unambiguous stage names.

## Glossary

| English | Korean | th rendering |
|---|---|---|
| the Hangyul team | 한귤 팀 | ทีม Hangyul (never ที่ปรึกษาของคุณ) |
| Global Korea Scholarship (GKS) / Korean Government Scholarship Program | 정부초청장학 | ทุนรัฐบาลเกาหลี (GKS) |
| scholarship | 장학금 | ทุนการศึกษา / ทุน |
| admission guide | 모집요강 | ระเบียบการรับสมัคร |
| admission rules / requirements | 지원 기준 | เกณฑ์การรับเข้า / เกณฑ์ |
| apostille | 아포스티유 | อะพอสทิล |
| consular legalization | 영사확인 | การรับรองเอกสารโดยกงสุล |
| legalization (column) | 인증 | การรับรองเอกสาร |
| Korean language institute | 어학당 | สถาบันภาษาเกาหลี (ของมหาวิทยาลัย) |
| e-visa | 전자비자 | วีซ่าอิเล็กทรอนิกส์ |
| residence card | 외국인등록증 | บัตรประจำตัวคนต่างด้าว |
| proof of funds | 재정 증빙 | หลักฐานทางการเงิน |
| embassy / consulate / post | 대사관 / 영사관 / 공관 | สถานทูต / สถานกงสุล / สถานทูต/กงสุล |
| intake | 모집 | รอบรับเข้า |
| deadline | 마감 | กำหนดปิดรับ / กำหนดส่ง (tasks) |
| application fee / tuition | 전형료 / 등록금 | ค่าสมัคร / ค่าเล่าเรียน |
| offer / offered | 합격 | ตอบรับ / การตอบรับ |
| accepted (by student) | 등록 의사 | ยืนยันสิทธิ์ |
| enrollment | 등록 | การลงทะเบียนเรียน |
| plan (paid) | 플랜 | แพ็กเกจ |
| case owner | 담당자 | ผู้รับผิดชอบ(เคส) |
| documents vault | 서류함 | คลังเอกสาร |
| Dossier (console) | 서류 묶음 | ชุดเอกสาร |
| Needs more preparation (far tier) | 준비가 더 필요 | ต้องเตรียมตัวเพิ่ม |
| Recommended (sort) | 추천순 | แนะนำ (browsing order, not ranking) |
| international office | 국제처 | สำนักงานนักศึกษาต่างชาติ |
| IEQAS outstanding | 우수 인증 | IEQAS ระดับดีเยี่ยม |
| test names | — | Latin (TOPIK, IELTS, TOEFL iBT) |

## Pass A: meaning (24 strings changed)

All 19 *ที่ปรึกษา* → *ทีม Hangyul* changes, plus:
- `common:fit.tier.UNCLEAR.title`: *ตอนนี้ยังห่างอีกมาก* → *ต้องเตรียมตัวเพิ่ม*. The English is now "Needs more preparation". This uses the brief's wording and no distance or chance word.
- `common:fit.tier.CHALLENGE.title`: *น่าพิจารณาให้ละเอียดขึ้น* → *ต้องตรวจสอบร่วมกับเรา*. The new English means "needs checking with us", not "worth a closer look".
- `common:fit.tier.MEETS.lede`: dropped the extra second sentence ("this is not an admission result"). The disclaimer now has its own key (`fit.summary.basis`).
- `marketing:v6.unis.title`: *มหาวิทยาลัยที่คุ้มค่าแก่การเดินทาง* → *มหาวิทยาลัยทั่วเกาหลี*. The English was rewritten to "Universities across Korea".
- `student:v9.announced.rule.STUDY_DEPOSIT_SCHEME`: *ยังไม่มีความรู้ภาษาเกาหลี* ("no Korean knowledge") → *ไม่มีผลสอบภาษาเกาหลี* ("no Korean test result").
- Other examples (from the 24): `concierge:help.route.MEDICAL` *ที่ปรึกษาของคุณ (เร่งด่วน)* → *ทีม Hangyul (เร่งด่วน)*; `visaroute:help.askHint` → *…ส่งถึงทีม Hangyul และผู้เชี่ยวชาญด้านวีซ่าของทีม*.

## Pass B: native naturalness (11 strings changed)

- `marketing:v20.uni.ctaTitle`: *พร้อมจะพิจารณาอย่างจริงจังหรือยัง* → *สนใจสมัครที่นี่ใช่ไหม*. Natural Thai CTA question matching the new English.
- `marketing:v15.pricing.lede`: the noun-list opening → *เลือกได้ว่าอยากให้เราช่วยแค่ไหน ตั้งแต่…ไปจนถึง…*. Reads as a Thai sentence.
- `agency:v25.today.student_silent`: *นักศึกษาที่เงียบหาย* (slangy "vanished") → *นักศึกษาที่ไม่ตอบกลับ*.
- `concierge:pickup.handle`: *ไอดีหรือเบอร์ของคุณ* → *ชื่อผู้ใช้หรือเบอร์โทรของคุณในแอปนั้น* (restores "on that app").
- `marketing:v20.uni.whyTitle`: *มหาวิทยาลัยนี้เป็นอย่างไร* → *จุดเด่นของที่นี่*.

## Pass C: UI context, brevity, one term per concept (14 strings changed)

- `marketing:v15.pricing.compare.row.dormitory`, `student:v15.services.scope.dormitory_support`: *ช่วยเรื่องหอพัก* → *หอพัก*. The English row label became "Dormitory".
- `university:v22.in.byProgram`: *อัตราข้อเสนอ* → *อัตราการตอบรับ*. Offer = *ตอบรับ* across the pipeline (`v28.pipe.step.OFFERED`, `v22.in.chain`).
- `university:v22.in.chain`: *ข้อเสนอ → ตอบรับ → ลงทะเบียนเรียน* → *ตอบรับ → ยืนยันสิทธิ์ → ลงทะเบียนเรียน*. Matches the pipeline step labels.
- `agency:docs.sc.checks`: *ติ๊กรายการตรวจ / เลือกเหตุผล* → *ติ๊กรายการตรวจหรือเลือกเหตุผล*.
- `visaroute:form.source.missing`: *ไม่มีใน Hangyul* → *ไม่มีข้อมูลในระบบ*.

## Final: source ↔ target comparison (8 strings changed)

Every string was compared against the en and ko versions for meaning, numbers, placeholders/tags, Latin test names, and the no-guarantee / no-ranking rule.
- `visaroute:caveat.APOSTILLE_TRANSITION`: *การรับรองโดยกงสุล* → *การรับรองเอกสารโดยกงสุล*, the glossary form.
- `university:kpi.insufficientDetail`: em dash removed. It now reads *อิงจาก {{n}} รายการ จะแสดงเมื่อมีครบ {{min}} รายการ*.
- `university:v22.stageHint.decision`: *เรายังต้องตัดสิน* → *ยังรอผลการตัดสิน*. The English no longer says "we".
- `visaroute:step.apply.title`: *บันทึกไว้* → *บันทึกใบรับ* (the "receipt" was missing).
- `common:task.visa.other_passport_record`: *ประวัติหนังสือเดินทาง* → *ประวัติการออกหนังสือเดินทาง* ("issuance record").

No string implies admission probability or a guarantee. *แนะนำ* is not used as a ranking.
Validator: `node scripts/i18n/v28/validate.mjs --only=th` reports 355 strings valid, 0 problems.

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA strength, cultural fit)

| Section | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|
| seo.home + journey.eyebrow | 5 | 5 | 4 | 4 | 4 | 5 | 27 |
| v15.pricing (lede, compare, premium) | 5 | 5 | 4 | 5 | 4 | 4 | 27 |
| v20.city (Busan, Gyeonggi, Seoul, Gyeongnam) | 5 | 4 | 4 | 4 | 4 | 5 | 26 |
| v20/v24/v28 uni page (why*, cta*, office, philosophy) | 5 | 5 | 4 | 4 | 5 | 4 | 27 |
| v6.unis.title, v9.faq.languagesA, v23.footer, v10.housing | 5 | 5 | 4 | 4 | 4 | 4 | 26 |

The first draft of the uni-page CTA (*คิดจะสมัครที่นี่อยู่หรือเปล่า*) scored 23 and was transcreated to *สนใจสมัครที่นี่ใช่ไหม*.

## Unsure

- `university:v28.pipe.step.ACCEPTED` *ยืนยันสิทธิ์* ("student confirms their place"): Thai universities also use *ยืนยันการเข้าศึกษา*. I chose the shorter form for the pipeline.
- `marketing:v28.uni.why.gks` *เข้าร่วมโครงการ GKS*: the body uses *ทุนรัฐบาลเกาหลี (GKS)*, but the short chip keeps only the acronym.
- `visaroute:staff.post` *สถานทูต/กงสุล* for 공관 (diplomatic post). The slash form is a compromise.
- `university:v4.req.education` *จบ{{level}}* depends on `{{level}}` being a bare noun (e.g. มัธยมปลาย).
- `marketing:v20.city.Seoul.line` "research universities" → *มหาวิทยาลัยวิจัย*. This is a recognized term in Thai, but less common than in English.
- Years stay in CE (2026), not BE (2569), as in V27.

## Counts

- Job keys: 355
- Kept verbatim: 34
- Rewritten: 89
- Newly translated: 232

The passes changed 57 strings. The other 32 rewrites are small alignments with the V28 English: em dashes and slashes removed, and wording updated where the English changed slightly.

## Second pass (jobs2)

Leak families the V28 crawl missed (waiting lines, blockers, ledes, empty states, queue/submission, workspace, outcomes). Same personas, glossary and method as above; all terms identical to the first-pass glossary (ทีม Hangyul, ระเบียบการรับสมัคร, การรับรองเอกสารโดยกงสุล, อะพอสทิล, ค่าสมัคร, รอบรับเข้า, ผู้รับผิดชอบ, คลังเอกสาร, ชุดเอกสาร).

- Pass A meaning: 14 strings changed (e.g. "Retained" = ยังศึกษาอยู่, not "kept"; "Fixture" = ข้อมูลทดสอบ; far-tier/probability words avoided; consular legalization never "confirmation").
- Pass B naturalness: 21 strings changed (English word order dropped in ledes and empty states; polite-friendly student register, concise consoles).
- Pass C UI/brevity/one term: 18 strings changed (em dashes in agency chips → " · "; "deadline" = กำหนดปิดรับ everywhere; "authorise" = มอบอำนาจ throughout the queue).

| Source | Target |
|---|---|
| {{label}} — consular legalization pending | {{label}} · รอการรับรองเอกสารโดยกงสุล |
| Nothing right now. Watch for requests for extra documents or an interview. | ตอนนี้ยังไม่มีอะไรต้องทำ คอยดูคำขอเอกสารเพิ่มเติมหรือการนัดสัมภาษณ์ |
| The student withdrew consent on {{date}}. Do not submit. | นักเรียนถอนความยินยอมเมื่อ {{date}} ห้ามยื่น |
| Based on the previous round's guide; the new guide is being checked | อ้างอิงระเบียบการรอบก่อน กำลังตรวจระเบียบการฉบับใหม่ |
| University fee. Not the Hangyul service fee or tuition. | ค่าสมัครของมหาวิทยาลัย ไม่ใช่ค่าบริการ Hangyul หรือค่าเล่าเรียน |

Marketing (2 keys, university international-office lines): 26/30 (clarity 5, trust 5, naturalness 4, brevity 4, CTA 4, cultural fit 4).

Unsure:
- dossier upload.status.NEEDS_REVIEW / UPLOADED / NEEDS_CORRECTION: English is empty (status deliberately silent); Thai needs a non-empty word to fit "{{doc}}ที่{{status}}", so รอตรวจ / อัปโหลดแล้ว / ต้องแก้ไข were used. Confirm the product wants a visible status here.
- queue.term.* seasons (ภาคฤดูใบไม้ผลิ etc.): Thai universities say ภาคการศึกษาที่ 1/2; seasonal names kept to match Korean semesters.
- ws.by.* inserted after "มอบหมายโดย{{by}}" without a space; reads naturally in Thai but depends on the fragment.
- outcomes.retention อัตราคงอยู่ is the education-statistics term, but may read abstract to some staff.

Counts (second pass): job keys 532 · kept verbatim 0 · rewritten 0 · newly translated 532.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
