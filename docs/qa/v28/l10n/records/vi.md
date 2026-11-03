# V28 localization review: vi (Vietnamese)

Scope: all 354 keys in `scripts/i18n/v28/jobs/vi.json` (11 namespaces). Output: `scripts/i18n/v28/tx/vi.json`.
Register carried over from V27: *bạn* for the student, *chúng tôi* for Hangyul, warm-but-plain du học tone; consoles concise
and professional. "The Hangyul team" is *đội ngũ Hangyul* everywhere; every leftover *chuyên viên tư vấn (của bạn)* /
*tư vấn viên* in student-facing strings was replaced (the brief forbids "your counselor").

## Personas

1. **Linh, 18, Hà Nội (first-time visitor).** Finishing lớp 12, wants a Korean language institute then a bachelor's. Reads on her phone and lands on a university page from a Facebook link.
2. **Minh, 27, Đà Nẵng (comparison shopper).** Engineer comparing English-taught master's programs and Hangyul's plans against other trung tâm du học. Reads pricing and the "why this university" blocks closely.
3. **Cô Hương, 49, Linh's mother.** Pays tuition and holds the savings for the bank balance certificate. Worries about promises of admission and where money goes.
4. **Chị Thảo, agency counselor / Mr Park, university admissions officer (console users).** Need short, unambiguous labels.

## Glossary

| English | Korean | vi rendering |
|---|---|---|
| the Hangyul team | 한귤 상담팀 | đội ngũ Hangyul |
| scholarship | 장학금 | học bổng |
| Global Korea Scholarship (GKS) | 정부초청장학 | Học bổng Chính phủ Hàn Quốc (GKS) |
| admission guide | 모집요강 | hướng dẫn tuyển sinh |
| admission rules / requirements | 입학 요건 | quy định tuyển sinh / yêu cầu |
| apostille | 아포스티유 | Apostille |
| consular legalization | 영사확인 | hợp pháp hóa lãnh sự |
| legalization (doc column) | 공증·인증 | hợp pháp hóa |
| Korean language institute | 어학당 | viện ngôn ngữ |
| e-visa | 전자비자 | visa điện tử |
| residence card | 외국인등록증 | thẻ cư trú |
| proof of funds | 재정 증명 | chứng minh tài chính |
| TB test | 결핵 검사 | khám lao |
| police certificate | 범죄경력 증명 | lý lịch tư pháp |
| application fee / tuition | 전형료 / 등록금 | lệ phí xét tuyển / học phí |
| intake | 모집 학기 | kỳ tuyển sinh |
| international seats | 외국인 정원 | chỉ tiêu quốc tế |
| offer | 합격 | thư mời (nhập học) / trúng tuyển |
| enrollment | 등록·입학 | nhập học |
| waitlisted | 예비 합격 | danh sách chờ |
| documents (vault) | 서류함 | kho giấy tờ |
| Writing (section) | 글쓰기 | Bài viết |
| case stage | 진행 단계 | giai đoạn hồ sơ |
| owner (case) | 담당자 | người phụ trách |
| consulate / post | 영사관 / 공관 | lãnh sự quán / cơ quan đại diện |
| Needs more preparation (far tier) | 준비가 더 필요한 대학 | Cần chuẩn bị thêm |
| Recommended (sort) | 추천순 | Gợi ý (browsing order only) |
| student (agency / university console) | 학생 | học viên / sinh viên |

## Pass A: meaning (31 strings changed)

Current translations checked against the V28 English; 230 null keys translated from scratch.
- `common:fit.tier.UNCLEAR.title`: *Hiện vẫn còn cách khá xa* → *Cần chuẩn bị thêm* (V28 English is "Needs more preparation").
- `common:fit.tier.CHALLENGE.title`: *Đáng để tìm hiểu thêm* → *Cần cùng chúng tôi kiểm tra* (now "Needs checking with us"; old text read like a reach tier).
- `university:v22.stageHint.decision`: *quyết định vẫn thuộc về chúng ta* → *Trường vẫn chưa ra quyết định* (old text was a mistranslation).
- `visaroute:doc.other_passport_record.name`: *Hồ sơ hộ chiếu* → *Giấy xác nhận lịch sử cấp hộ chiếu (do Bộ Ngoại giao cấp)* (English now names the issuer).
- `marketing:v6.unis.title`: *Những ngôi trường xứng đáng với hành trình.* → *Các trường đại học khắp Hàn Quốc.* (English rewritten).
- Also: 21 "Hangyul team" strings (`concierge:help.route.*`, `dossier:*counselor*`, `visaroute:*`, `success:*`) moved from *chuyên viên tư vấn của bạn* to *đội ngũ Hangyul*.

## Pass B: native naturalness (14 strings changed)

- `concierge:emergency.note`: *hãy gọi trước — sau đó báo…* → *hãy gọi điện trước. Sau đó báo cho đội ngũ Hangyul.* (dash chain removed).
- `student:v9.announced.rule.STUDY_DEPOSIT_SCHEME`: *Học sinh chưa biết tiếng Hàn…* → *Học viên từ một số quốc gia chưa có kết quả thi tiếng Hàn…* (meaning is "no test result", not "doesn't know Korean").
- `marketing:v20.uni.whyTitle`: *Trường này là trường như thế nào* → *Điểm khác biệt của trường*.
- `marketing:v20.uni.ctaTitle`: *Sẵn sàng tìm hiểu nghiêm túc?* → *Bạn đang nghĩ đến trường này?*
- `marketing:v15.pricing.lede`: fragment list → *Chọn mức hỗ trợ bạn cần: đánh giá ban đầu, nộp hồ sơ, hay ổn định cuộc sống sau khi sang Hàn.*

## Pass C: UI context, brevity, one term per concept (24 strings changed)

- `mobile:v3.uni.decisionNow`: *QUYẾT ĐỊNH* → *Quyết định* (casing comes from CSS).
- `agency:v25.today.student_silent`, `agency:inbox.pickText`: *học sinh / sinh viên* → *học viên* (one term in the agency console).
- `dossier:reason.ESSAY_TO_WRITE`: *mục Bài luận* → *mục Bài viết*, matching the tab label `ws.tab.essays` "Writing".
- `marketing:v15.pricing.compare.row.dormitory`, `student:v15.services.scope.dormitory_support`: *Hỗ trợ ký túc xá* → *Ký túc xá* (English shortened to "Dormitory").
- `visaroute:step.slow_items.title`: *Bắt đầu với giấy tờ lâu có* → *…lâu có nhất* (incomplete superlative).

## Final: source ↔ target comparison (6 strings changed)

All 354 strings re-read against EN and KO for numbers, test names, placeholders and the no-guarantee / no-ranking rule.
- `university:kpi.insufficientDetail`: *hiển thị từ {{min}}* → *Hiển thị khi có từ {{min}} hồ sơ.*
- `university:v25.in.yield`: *Nhập học trên số trúng tuyển* → *Thư mời dẫn đến nhập học*.
- `visaroute:step.apply.title`: *Nộp hồ sơ và ghi lại* → *Nộp hồ sơ và ghi lại biên nhận*.
- `visaroute:form.source.missing`: *Không có trong Hangyul* → *Chưa có thông tin*.
- `student:scholarships.empty`: second sentence added (*Hãy hoàn thiện hồ sơ cá nhân để xem học bổng nào phù hợp với bạn.*).

No string implies admission probability; the far tier is *Cần chuẩn bị thêm*; `fit.summary.basis` states it is not a prediction.
Validator: `node scripts/i18n/v28/validate.mjs --only=vi` → 354 strings valid, 0 problems.

## Marketing scorecard (30 points: clarity / trust / naturalness / brevity / CTA / cultural fit)

| Section | Score | Notes |
|---|---|---|
| seo.home + journey eyebrow | 5/5/5/4/4/5 = 28 | *lo visa và ngày sang Hàn* is the community phrasing |
| v15 pricing (lede, compare, premium.f5) | 5/5/5/5/4/4 = 28 | first draft (fragment list) scored 22; rewritten |
| v20 city bodies (Busan, Gyeonggi, Seoul, Gyeongnam) | 5/5/5/4/4/5 = 28 | kept; `Seoul.line` new |
| v20 university page (cta, why.*, office, philosophy) | 5/5/5/5/5/4 = 29 | *Bạn đang nghĩ đến trường này?* replaced a pushy CTA title (scored 21) |
| v28 why blocks (English degrees, GKS, scholarships) | 5/5/5/5/4/5 = 29 | GKS spelled as the established *Học bổng Chính phủ Hàn Quốc (GKS)* |
| v6 / v9 FAQ languages, footer | 5/5/4/4/4/5 = 27 | FAQ answer is long by nature |

## Unsure

- `university:v28.pipe.*` *Tiến trình* for "Pipeline": Vietnamese admissions staff may simply say *pipeline*.
- `agency:misc.breadcrumb` *Đường dẫn trang*: screen-reader label; *breadcrumb* is also used in Vietnamese UI.
- `visaroute:staff.post` *Cơ quan đại diện*: formally correct for 공관; staff may prefer *đại sứ quán/lãnh sự quán*.
- `marketing:v20.city.Seoul.line` "research universities" → *đại học nghiên cứu*: a term not every reader knows.
- Student noun split: *học viên* in agency/student strings, *sinh viên* in the university console. Deliberate, but worth a native check.

## Counts

- Job keys: 354
- Kept verbatim: 49
- Rewritten: 75
- Newly translated: 230

## Second pass (jobs2)

Leak families from conditional states (agency workspace blockers and waiting lines, submission queue, success items, dossier
ledes, university outcomes). Same personas, same glossary as above (đội ngũ Hangyul, hợp pháp hóa lãnh sự, Apostille,
hướng dẫn tuyển sinh, lệ phí xét tuyển, kỳ tuyển sinh, học viên in agency console / sinh viên in university console).
Agency (에이전시) rendered *đơn vị tư vấn* in prose; the "Fixture" chip kept in English to match the test-data label.

- Pass A meaning: 9 changed (e.g. DOC_TOO_OLD "too old" → issued outside the window; ELIG_NATIONALITY reworded so it does not read as a ban).
- Pass B naturalness: 14 changed (dropped em-dash label patterns in favour of "{{label}}: …").
- Pass C UI/brevity/one term: 11 changed (upload.status.* shortened to fit "{{doc}} {{status}}"; "Ready to submit" unified as *Sẵn sàng nộp*).

Examples (source → target):

1. `success:agencyItem.DOC_LEGALIZE` "{{label}} — consular legalization pending" → "{{label}}: chờ hợp pháp hóa lãnh sự"
2. `success:queue.detail.mechanismText` "…Hangyul never stores portal passwords and submits nothing itself." → "…Hangyul không lưu mật khẩu cổng và không tự nộp bất cứ thứ gì."
3. `agency:v15.readiness.blocker.document_too_old` "{{detail}} was issued outside the university's window" → "{{detail}} được cấp ngoài khoảng thời gian trường chấp nhận"
4. `agency:v27.guide.missingBody` "…It appears once Hangyul operations verifies the guide." → "…Danh sách sẽ xuất hiện khi bộ phận vận hành Hangyul xác minh hướng dẫn."
5. `university:outcomes.untracked` "Not tracked: these students enrolled before Hangyul managed their application." → "Không theo dõi: các sinh viên này nhập học trước khi Hangyul quản lý hồ sơ của họ."

Marketing scorecard (2 keys, `v20.uni.intl.*`): clarity 5, trust 5, naturalness 4, brevity 4, CTA 4, cultural fit 4 = 26/30.

Unsure:
- `dossier:upload.status.NEEDS_REVIEW/UPLOADED/NEEDS_CORRECTION`: English is empty (status word deliberately omitted); the
  validator requires a value, so short status words (*chờ xem xét*, *đã tải lên*, *cần sửa*) were used. Product may prefer them blank.
- `agency:ws.v11.tab.application` *Hồ sơ* also renders "application" elsewhere; fine as a tab, but overlaps *Hồ sơ cá nhân* (profile).
- `agency:ws.factor.workload` *Năng lực tiếp nhận* (capacity) — may read as "competence".
- `university:outcomes.step.RETAINED` / `outcomes.retention` *Tiếp tục theo học* / *Tỷ lệ duy trì*.

Counts (second pass): job keys 467 · kept verbatim 0 · rewritten 0 · newly translated 467.
Validator (`JOBS=jobs2 TX=tx2`): 467 strings valid, 1 problem — `success:agency.questions.too_few` is a real job key that the
plural-extra check misreads as a `_few` form (validator false positive; cannot be cleared from the translation side).

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
