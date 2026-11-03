# V27 localization review: th (Thai)

Scope: all 729 strings in `scripts/i18n/v27/strings.json` (215 `new`, 514 `changed`; `changed` strings were translated again from the V27 English, not patched from the bundle).
Output: `scripts/i18n/v27/tx/th.json`.
Register: *คุณ* for the student, polite-neutral tone without gendered particles (no ครับ/ค่ะ), Thai punctuation conventions (sentences separated by a space, no full stops). Established bundle terms kept: *ทุนรัฐบาลเกาหลี (GKS)*, *อนุสัญญาอะพอสทิล*, *หนังสือตอบรับเข้าศึกษา (ฉบับมาตรฐาน)*, *หนังสือรับรองการออกวีซ่า*, *วีซ่าอิเล็กทรอนิกส์*, *บัตรประจำตัวคนต่างด้าว*, *สำนักงานตรวจคนเข้าเมือง*, *หลักฐานทางการเงิน*, *หนังสือรับรองยอดเงินในบัญชี*, *ใบรับรองผลตรวจวัณโรค*, *ที่ปรึกษา*, *ทีม Hangyul*, *เรียงความแนะนำตนเอง*, *แผนการศึกษา*. Bundle terms changed: *การรับรองโดยสถานกงสุล* → *การรับรองเอกสารโดยกงสุล* (one form everywhere), *เส้นทางของฉัน* → *ความคืบหน้าของฉัน* (V27 English "My progress").

## Personas

1. **Ploy (พลอย), 18, Bangkok.** Just finished ม.6, wants a year at a university Korean language institute and then a bachelor's. Uses the phone app, reads quickly.
2. **Ton (ต้น), 26, Chiang Mai.** Software engineer applying for a master's taught in English. Wants precise requirements, fees and the Bangkok embassy procedure.
3. **Khun Mae Wan (คุณแม่วรรณ), 50, Ploy's mother.** Pays tuition and keeps the savings for the bank balance certificate. Careful about money transfers, agents and any wording that sounds like a guarantee.

## Glossary

| English | Korean | th rendering |
|---|---|---|
| scholarship | 장학(금) | ทุนการศึกษา / ทุน |
| Global Korea Scholarship (GKS) | 정부초청장학 | ทุนรัฐบาลเกาหลี (GKS) |
| admission guide | 모집요강 | ระเบียบการรับสมัคร |
| apostille | 아포스티유 | (การรับรอง) อะพอสทิล; Apostille Convention = อนุสัญญาอะพอสทิล |
| consular legalization | 영사확인 | การรับรองเอกสารโดยกงสุล |
| notarized | 공증 | รับรองโดยโนตารี |
| Korean language institute | 어학당 | สถาบันภาษาเกาหลี (ของมหาวิทยาลัย) |
| certificate of admission | 표준입학허가서 | หนังสือตอบรับเข้าศึกษา (ฉบับมาตรฐาน) |
| CCVI | 사증발급인정서 | หนังสือรับรองการออกวีซ่า (CCVI) |
| e-visa | 전자비자 | วีซ่าอิเล็กทรอนิกส์ |
| residence card | 외국인등록증 | บัตรประจำตัวคนต่างด้าว |
| change of status | 체류자격 변경 | การเปลี่ยนสถานะวีซ่า |
| immigration office | 출입국관리사무소 | สำนักงานตรวจคนเข้าเมือง |
| proof of funds / bank balance certificate | 재정 증빙 / 잔고증명서 | หลักฐานทางการเงิน / หนังสือรับรองยอดเงินในบัญชี |
| tuition / application fee | 등록금 / 전형료 | ค่าเล่าเรียน / ค่าสมัคร |
| counselor / Hangyul team | 상담사 / 한귤 상담팀 | ที่ปรึกษา / ทีม Hangyul |
| agency | 유학원 | เอเจนซี่ |
| offer | 합격 | การตอบรับ / ข้อเสนอการรับเข้าศึกษา |
| Recommended (sort) | 추천순 | แนะนำ (never จัดอันดับ; `fit.order` says it is not a ranking) |
| Bachelor's transfer | 학사 편입 | เทียบโอนเข้าปริญญาตรี |
| Integrated master's and PhD | 석박사 통합 | หลักสูตรควบโท-เอก |
| documents store | 서류함 | คลังเอกสาร |
| test names | — | Latin names prefixed with *สอบ* in the test picker (see Unsure) |

## Pass A: meaning (6 strings changed)

- `common:uni27.schol.living`: *ค่าครองชีพ* → *เงินช่วยค่าครองชีพ*. The draft said "living costs", but the source means an allowance that is paid to you.
- `student:matches.tierText.COMPETITIVE`: *ทำให้ยังไม่แน่นอนนัก* → *ทำให้ผลยังไม่แน่นอนนัก*. Makes clear that the outcome is uncertain, without introducing a chance or percentage.
- `visaroute:doc.business_registration.why`: *ใบทะเบียน* → *ใบทะเบียนผู้ประกอบการ*. The draft dropped "business" registration.
- `marketing:agencyNet.points.measured.text`: *ให้รางวัลกับการส่งแต่เคสง่าย* → *เอื้อให้คนส่งแต่เคสง่าย*. The literal "rewards" was ambiguous in Thai.
- `common:uni27.schol.youMay`: the draft ended with a noun phrase ("scholarships you may qualify for") → *คุณอาจมีคุณสมบัติตรงตามเงื่อนไขของ*, which leads into the list as the English does.

## Pass B: native naturalness (9 strings changed)

Each string was read as Ploy, Ton and Khun Mae Wan.
- `student:login.aside.title`: *รวมไว้ในที่เดียวอย่างเป็นระบบ* → *รวมไว้ในที่เดียว ไม่ต้องวุ่นวาย*. This brings back the "calm" of the source in natural Thai.
- `common:fit.tier.CHALLENGE.title`: *น่าลองดูให้ละเอียด* → *น่าพิจารณาให้ละเอียดขึ้น*. *ลองดู* reads as "give it a try", which hints at applying on a chance.
- `common:fit.level.TRANSFER`: *โอนย้ายเข้าปริญญาตรี* → *เทียบโอนเข้าปริญญาตรี*, the term Thai universities use for credit transfer admission.
- `marketing:v20.city.Gyeonggi.line`: *เขียวกว่า* → *มีพื้นที่สีเขียวมากกว่า*. The literal "greener" sounds odd in Thai.
- `student:onboarding.steps.passport.subtitle`: *เราไม่เคยขอ* → *เราจะไม่ขอ*. A promise reads more natural than "we have never asked".

## Pass C: UI context and brevity (5 strings changed)

- `common:fit.tier.CHALLENGE.short`: *น่าลองดู* → *น่าพิจารณา*, which matches the title.
- `common:legalization.CONSULAR_LEGALIZATION`: *การรับรองเอกสารโดยสถานกงสุล* → *การรับรองเอกสารโดยกงสุล*, the same term used in every other string.
- `common:uni27.link.kli`: *สถาบันภาษาเกาหลี* → *สถาบันภาษาเกาหลีของมหาวิทยาลัย*, consistent with `visa.typeText.D-4-1`.
- `student:home.docAction.RENEW`: *ต่ออายุเอกสาร* → *ต่ออายุ*. Shorter action label.
- `common:uni27.schol.renewal`: *เงื่อนไขการรับทุนต่อ* → *หากต้องการรับทุนต่อ*. A label heading for a condition list, like the English "To keep it".

## Final: source ↔ target comparison (3 strings changed)

The whole set was compared with the English and Korean for meaning, numbers, test and code names, placeholders/tags and the no-guarantee / no-ranking rule (a script also checked numbers and Latin test/code names).
- `dossier:upload.sendText`, `visaroute:reason.VISA_ONLY`, `visaroute:docs.readyCount`: *เอกสารของคุณ* → *คลังเอกสาร(ของคุณ)* when the English means the documents store, so it is not confused with "your documents" in general.

The `{{track}}` reason strings use the *{{track}}: …* pattern so the chip label is not inflected mid-sentence. No string implies admission probability or a guarantee. All placeholders and the `<em>` tag are preserved. The Hangul 대학알리미 in the English `v20.uni.why.breadthBody` was dropped, keeping *Academy Info* (no Hangul outside ko). Every string contains Thai script, which the validator requires.
Validator: `node scripts/i18n/v27/validate.mjs --only=th` reports 729 strings valid, 0 problems.

## Unsure

- `fit.test.*` (*สอบ TOPIK*, *สอบ IELTS Academic* …): the validator requires Thai script in every string, so the bare test names were prefixed with *สอบ* ("test"). A Thai designer might prefer the bare Latin names in the picker.
- Years are kept as CE (2026). Thai official writing often uses BE (พ.ศ. 2569). CE is normal in international study contexts, but some parents may expect BE.
- `v9.funds.longer_*`: 컨설팅 tier rendered *'ต้องรับคำปรึกษา'*. No established Thai term exists for this government audit tier.
- `fit.level.COMBINED` *หลักสูตรควบโท-เอก*: Thai universities also say *หลักสูตรต่อเนื่องโท-เอก*.
- `uni27.service.INTL_STUDENT_LOUNGE` *ห้องรับรองนักศึกษาต่างชาติ*: *ห้องรับรอง* can sound formal. *เลานจ์นักศึกษาต่างชาติ* is also used.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → ไม่ต้องใช้คะแนนภาษาในการสมัคร แต่หลังได้รับการตอบรับเข้าเรียนแล้ว ต้องมี {{tests}} ขึ้นไป
- `fit.reason.far` → ต้องมี {{options}} ขึ้นไป ซึ่งสูงกว่าคะแนนปัจจุบันของคุณค่อนข้างมาก
- `fit.tier.UNCLEAR.title` → ตอนนี้ยังห่างอีกมาก
- `fit.tier.UNCLEAR.short` → ต้องเตรียมตัวเพิ่ม
- `fit.tier.UNCLEAR.lede` → คะแนนปัจจุบันของคุณยังต่ำกว่าเกณฑ์ที่ประกาศไว้ค่อนข้างมาก เผื่อเวลาเตรียมตัวให้มากขึ้น แล้วค่อยตรวจสอบอีกครั้ง

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
