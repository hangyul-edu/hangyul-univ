# V27 localization review: vi (Vietnamese)

Scope: all 729 strings in `scripts/i18n/v27/strings.json` (215 `new`, 514 `changed`; `changed` strings were translated again from the V27 English, not patched from the bundle).
Output: `scripts/i18n/v27/tx/vi.json`.
Register: *bạn* for the student everywhere, *chúng tôi* for Hangyul, warm-but-plain tone of Vietnamese du học sites; CTAs as Vietnamese sites write them (*Xem…*, *Tải lên…*, *Hãy…*). Established bundle terms kept: *hợp pháp hóa lãnh sự*, *Học bổng Chính phủ Hàn Quốc (GKS)*, *Giấy báo nhập học (tiêu chuẩn)*, *thẻ cư trú người nước ngoài*, *visa điện tử*, *tư vấn viên*, *chứng minh tài chính*, *giấy xác nhận số dư tài khoản*, *bài luận cá nhân*, *kế hoạch học tập*. Bundle terms fixed in this output: *Hành trình* / *Đề xuất* (see glossary), *đội ngũ Hangyul Univ* → *đội ngũ Hangyul* where the V27 English says "the Hangyul team".

## Personas

1. **Linh, 18, Hà Nội.** Finishing lớp 12, plans to start at a university's Korean language institute (D-4-1) and then move to a bachelor's. Reads on her phone, knows the community words *hệ tiếng*, *viện ngôn ngữ*, *Apostille*.
2. **Minh, 27, Đà Nẵng.** Mechanical engineer applying for a master's taught in English. Wants exact requirements, deadlines and visa paperwork for the Korean Embassy in Hanoi.
3. **Cô Hương, 49, Linh's mother.** Pays tuition and holds the savings for the bank balance certificate. Worries about where money goes, refunds and anything that sounds like a promise of admission.

## Glossary

| English | Korean | vi rendering |
|---|---|---|
| scholarship | 장학(금) | học bổng |
| Global Korea Scholarship (GKS) | 정부초청장학 | Học bổng Chính phủ Hàn Quốc (GKS) |
| admission guide | 모집요강 | hướng dẫn tuyển sinh |
| apostille | 아포스티유 | (chứng nhận) Apostille; Apostille Convention = Công ước Apostille |
| consular legalization | 영사확인 | hợp pháp hóa lãnh sự |
| Korean language institute | 어학당 | viện ngôn ngữ (of the university); language students = học viên hệ tiếng |
| Korean language program | 어학연수 | chương trình / khóa học tiếng Hàn |
| certificate of admission / standard admission letter | 표준입학허가서 | giấy báo nhập học (tiêu chuẩn) |
| CCVI | 사증발급인정서 | Giấy chứng nhận cấp visa (CCVI) |
| e-visa | 전자비자 | visa điện tử |
| change of status | 체류자격 변경 | đổi tư cách lưu trú |
| residence card | 외국인등록증 | thẻ cư trú (người nước ngoài) |
| immigration office | 출입국관리사무소 | văn phòng xuất nhập cảnh |
| proof of funds / bank balance certificate | 재정 증빙 / 잔고증명서 | chứng minh tài chính / giấy xác nhận số dư (tài khoản) |
| TB certificate | 결핵 진단서 | giấy khám lao |
| tuition / application fee | 등록금 / 전형료 | học phí / lệ phí xét tuyển |
| counselor / the Hangyul team | 상담사 / 한귤 상담팀 | tư vấn viên / đội ngũ Hangyul |
| agency | 유학원 | trung tâm (tư vấn du học) |
| Recommended (sort) | 추천순 | Gợi ý (never *xếp hạng*; `fit.order` says it is not a ranking) |
| My progress / Your progress | 나의 유학 여정 | Tiến trình của tôi / của bạn (bundle *Hành trình* replaced, following the V27 English) |
| offer | 합격 | thư mời nhập học |
| Integrated master's and PhD | 석박사 통합 | Thạc sĩ – Tiến sĩ liên thông |
| Bachelor's transfer | 학사 편입 | Liên thông đại học |
| documents (store) | 서류함 | kho giấy tờ |

## Pass A: meaning (8 strings changed)

- `common:fit.lede`: *ngành bậc bạn muốn học* → *bậc học bạn muốn theo*. The draft mixed "major" and "level"; the question is about the level (어떤 과정).
- `common:uni27.service.COUNSELING`: *Tư vấn tâm lý* → *Hỗ trợ tư vấn*. 상담 지원 is general counseling; the draft narrowed it to psychological counseling.
- `student:matches.tierText.COMPETITIVE`: *khiến khả năng kém chắc chắn hơn* → *khiến kết quả khó nói trước hơn*. *Khả năng* reads as "admission chance", which the brief forbids.
- `common:uni27.schol.automatic`: *Tự động xét khi trúng tuyển* → *Tự động nhận khi trúng tuyển*. "Awarded" means you receive it, not that it is reviewed.
- `common:fit.tier.CHALLENGE.lede`: *loại bạn ra* → *khiến bạn bị loại*. Same meaning, but the draft could be read as "we rule you out".

## Pass B: native naturalness (13 strings changed)

Each string was read as Linh, Minh and Cô Hương.
- `student:login.aside.title`: *Một nơi duy nhất, nhẹ nhàng, cho mọi bước…* → *Mọi bước vào đại học Hàn Quốc, gọn gàng ở cùng một nơi.* English word order removed.
- `student:documentsV2.group.todoSub`: *Mỗi giấy tờ đang làm một hồ sơ bị dừng lại* → *Mỗi giấy tờ này đang khiến một hồ sơ chưa thể đi tiếp.*
- `marketing:v10.services.title`: *có chúng tôi cùng làm* → *<em>chúng tôi làm cùng bạn.</em>*
- `common:uni27.service.KOREAN_TUTORING`: *Kèm tiếng Hàn* → *Phụ đạo tiếng Hàn*. *Kèm* sounds like private home tutoring; universities say *phụ đạo*.
- `marketing:agencyNet.title`: *Những người thật, được chọn lựa kỹ lưỡng và có trách nhiệm* → *Con người thật, được chọn kỹ và chịu trách nhiệm.*

## Pass C: UI context and brevity (8 strings changed)

- `common:fit.level.TRANSFER`: *Liên thông/chuyển tiếp đại học* → *Liên thông đại học*. Short label, and the term students use for 편입.
- `common:fit.tier.MEETS.title`: *đạt điều kiện tối thiểu* → *đạt mức tối thiểu*, consistent with the chip *Đạt tối thiểu*.
- `common:fit.tier.UNCLEAR.short`: *Khó xác nhận* → *Chưa xác nhận được*, which matches the title.
- `student:compare.legalCount_one/_other`: *cần Apostille* → *cần chứng nhận Apostille*, one term for apostille across document strings.
- `common:uni27.link.kli`: *Viện ngôn ngữ (hệ tiếng Hàn)* → *Viện ngôn ngữ tiếng Hàn*. Shorter link label.

## Final: source ↔ target comparison (4 strings changed)

The whole set was compared with the English and Korean for meaning, numbers, test names, placeholders/tags and the no-guarantee / no-ranking rule (a script also checked that every number and every test or code name in the English is present).
- `fit.track.KOREAN/ENGLISH` → *Giảng dạy bằng tiếng Hàn / tiếng Anh*, and `fit.reason.met_track` / `needed_track` rebuilt as *{{track}}: bạn đạt yêu cầu…* / *{{track}}: cần … trở lên.* The draft put a capitalised chip label mid-sentence (*cho chương trình Học bằng tiếng Hàn*).

No string implies admission probability or a guarantee; *Gợi ý* is always a browsing order. All placeholders and the `<em>` tag are preserved. The Hangul 대학알리미 in the English `v20.uni.why.breadthBody` was dropped, keeping the official English name *Academy Info* (no Hangul outside ko). Dates in Vietnam-specific copy use the Vietnamese format (*11/9/2026*, *1/10/2026*); 1,500 won → *1.500 won*.
Validator: `node scripts/i18n/v27/validate.mjs --only=vi` reports 729 strings valid, 0 problems.

## Unsure

- `fit.level.ASSOCIATE` *Cao đẳng*: the usual Vietnamese equivalent of 전문학사, but a Vietnamese *cao đẳng* is not identical to a Korean associate degree.
- `v9.funds.longer_*`: the government tier 컨설팅 is rendered *xếp loại "tư vấn"*. The Vietnamese community also says *trường bị hạn chế visa* / *trường top 3%*, which are not exact.
- `visaroute:doc.business_registration.why` *Giấy đăng ký kinh doanh của trường*: this is what Vietnamese applicants call the 사업자등록증 copy, but it can sound strange for a university.
- `fit.gpa.placeholder` *VD: 3.6*: Vietnamese uses a decimal comma. The dot was kept until it is confirmed that the field accepts commas.
- `uni27.service.BUDDY` *Chương trình bạn đồng hành*: some schools just say *Buddy*.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Không yêu cầu chứng chỉ ngoại ngữ khi nộp hồ sơ. Sau khi trúng tuyển, bạn cần có {{tests}} trở lên.
- `fit.reason.far` → Cần {{options}} trở lên, cao hơn nhiều so với kết quả hiện tại của bạn.
- `fit.tier.UNCLEAR.title` → Hiện vẫn còn cách khá xa
- `fit.tier.UNCLEAR.short` → Cần chuẩn bị thêm
- `fit.tier.UNCLEAR.lede` → Kết quả hiện tại của bạn còn thấp hơn nhiều so với yêu cầu đã công bố. Hãy dành thêm thời gian chuẩn bị rồi kiểm tra lại nhé.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
