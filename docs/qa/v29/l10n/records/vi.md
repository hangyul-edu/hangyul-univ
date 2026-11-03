# V29 service-contract l10n record — vi (Vietnamese)

Job: `scripts/i18n/v28/jobs-v29/vi.json` (158 keys, all `current: null`) → `scripts/i18n/v28/tx-v29/vi.json`.
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=vi` → 158 strings valid, 0 problems (EXIT=0). Not applied.

## Personas

- First-time visitor: học sinh lớp 12 ở Hà Nội (18), mobile
- Comparison shopper: phụ huynh so sánh các gói và chi phí phát sinh
- Ứng viên thạc sĩ (25) chỉ cần hồ sơ và visa

## Key term decisions

- No round limit within contracted documents: “Không giới hạn lượt với hồ sơ trong hợp đồng”; long form “không giới hạn số lượt, trong phạm vi hồ sơ ứng tuyển và lịch nộp đã ký trong hợp đồng”. Never “chỉnh sửa không giới hạn” on its own.
- Up to N managed applications: “Quản lý tối đa N hồ sơ (ứng tuyển)” (row “Hồ sơ được quản lý”) vs “Gợi ý tối đa N trường” (row “Trường được gợi ý”).
- Custom quote: “Báo giá riêng”.
- Airport pickup arrangement: “Sắp xếp xe đón sân bay” via “đơn vị vận chuyển đối tác”.
- Plan = gói (v15.pricing); 첨삭 = chỉnh sửa; round = lượt; team = đội ngũ Hangyul Univ / đội phụ trách.

## Glossary

| Concept | Korean (canonical) | vi |
|---|---|---|
| Contracted-docs no round limit (card) | 계약 서류 안에서 횟수 제한 없음 | Không giới hạn lượt với hồ sơ trong hợp đồng |
| Premium scope note | 계약한 지원 서류와 지원 일정 안에서 횟수 제한 없이 | Gói Premium chỉnh sửa không giới hạn số lượt, trong phạm vi hồ sơ ứng tuyển và lịch nộp đã ký trong hợp đồng. |
| Premium feature f3 | 계약한 지원 서류 첨삭 · 횟수 제한 없음 | Chỉnh sửa hồ sơ ứng tuyển trong hợp đồng, không giới hạn số lượt |
| Up to N managed applications | 대학 지원 최대 2곳 관리 | Quản lý tối đa 2 hồ sơ ứng tuyển |
| Applications managed (row) | 대학 지원 관리 | Hồ sơ được quản lý |
| Universities recommended (row) | 추천 대학·어학당 | Trường được gợi ý |
| Recommend up to 3 | 대학·어학당 최대 3곳 추천 | Gợi ý tối đa 3 trường đại học hoặc viện ngôn ngữ |
| Custom quote | 별도 견적 | Báo giá riêng |
| Airport pickup arrangement | 공항 픽업 연결 | Sắp xếp xe đón sân bay |
| Pickup note | 제휴 운송 업체를 연결 | Dịch vụ đón sân bay được sắp xếp thông qua đơn vị vận chuyển đối tác. |
| Visa decision | 발급 여부는 해당 기관이 결정 | Hỗ trợ visa là giúp bạn chuẩn bị và nộp hồ sơ; quyết định cấp visa thuộc về cơ quan có thẩm quyền. |
| Additional service | 추가 서비스 | Dịch vụ bổ sung |
| Mock interview | 모의 면접 | Phỏng vấn thử |
| Statement & study-plan editing | 자기소개서·학업계획서 첨삭 | Chỉnh sửa bài luận & kế hoạch học tập |
| Editing round | 1회 (첨삭) | 1 lượt |
| Dormitory | 기숙사 | Ký túc xá |
| Settling in | 정착 지원 | Hỗ trợ ổn định thêm |
| Consultation support period | 상담 지원 기간 | Thời gian tư vấn |
| Contract term | 계약 기간 | Thời hạn hợp đồng |
| Priority response | 우선 응대 | Phản hồi ưu tiên |
| Dedicated team | 전담 팀 | Đội ngũ riêng · ưu tiên |
| Responsible team follow-up | 담당 팀 후속 지원 | Đội phụ trách theo sát |
| Agreed scope | 협의한 범위 | Phạm vi đã thỏa thuận |
| Before you buy | 이용 안내 | Trước khi mua |
| Decline add-on | 괜찮아요 | Không, cảm ơn |

Plan names stay Latin (Basic, All-in-One, Premium) as in `common.json v29.pricing.<slug>.name`; brand is “Hangyul Univ” / “Hangyul” in Latin.

## Passes

**Pass A — meaning vs Korean** — 4 strings changed during the pass.

- Draft “Chỉnh sửa không giới hạn” → “…trong hợp đồng, không giới hạn số lượt”
- Draft “Nộp hồ sơ vào 3 trường” → “Quản lý tối đa 3 hồ sơ”
- Draft “Đưa đón sân bay” → “Sắp xếp xe đón sân bay”
- Draft “Đảm bảo visa” tone → “quyết định cấp visa thuộc về cơ quan có thẩm quyền”
- basic.f2 “Đề xuất 3 trường” → “Gợi ý tối đa 3 trường…” (keeps ‘up to’)

**Pass B — native naturalness** — 3 strings changed during the pass.

- “Nói không không thay đổi gì” → “Từ chối cũng không sao, gói hiện tại vẫn tiếp tục như cũ”
- “Giá công bằng” → “Chi phí hợp lý”
- “Nâng cấp từ {{from}} đến {{to}}” → “Thay đổi khi nâng từ {{from}} lên {{to}}”
- “Đã thất bại” → “Chưa xử lý được”
- “Nhóm phụ trách” → “Đội phụ trách”

**Pass C — UI brevity, one term per concept** — 2 strings changed during the pass.

- mobile CONTRACTED_DOCUMENTS long → “Không giới hạn lượt, hồ sơ theo hợp đồng”
- mobile supportDays → “{{count}} ngày từ buổi tư vấn đầu”
- gợi ý/đề xuất/khuyên dùng mixed → gợi ý for recommendations (khuyên dùng stays the v15 badge)
- row.dedicated → “Đội ngũ riêng · ưu tiên”
- mockIncluded “{{count}} được bao gồm” → “Bao gồm {{count}} buổi”

## Marketing scorecard (30-point: clarity, trust, naturalness, brevity, CTA strength, cultural fit)

| Section | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|
| why.s1 | 5 | 4 | 5 | 4 | 4 | 5 | 27 |
| why.s3 | 5 | 5 | 5 | 4 | 4 | 5 | 28 |

## Unsure

- “Bài luận” for 자기소개서 follows existing docCategory; some agencies say “bài tự giới thiệu”.
- “đề xuất” would also fit notify.addonOffered; kept “đã đề xuất” there because it is an offer, not a university recommendation.

## Counts

- Job keys: 158; strings written: 158
- Kept verbatim from `current`: 0 (none existed)
- Rewritten: 0
- Newly translated: 158

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
