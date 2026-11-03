# V29 service-contract l10n record — zh-Hant (Traditional Chinese (Taiwan usage))

Job: `scripts/i18n/v28/jobs-v29/zh-Hant.json` (158 keys, all `current: null`) → `scripts/i18n/v28/tx-v29/zh-Hant.json`.
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=zh-Hant` → 158 strings valid, 0 problems (EXIT=0). Not applied.

## Personas

- First-time visitor: 台灣高三學生 (18)，手機瀏覽
- Comparison shopper: 家長比較各方案與代辦報價
- 研究所申請者 (25)，只需要文件與簽證

## Key term decisions

- No round limit within contracted documents: “合約內文件不限修改輪數”; long form “在合約約定的申請文件與申請時程範圍內不限輪數”. Never “無限修改”.
- Up to N managed applications: “最多管理 N 所（學校）申請” (row “申請管理”) vs “推薦學校”/“最多推薦 N 所”.
- Custom quote: “另行報價”.
- Airport pickup arrangement: “接機安排”; note “由我們為你媒合合作的交通業者”.
- Plan = 方案; add-on = 加購服務 (Taiwan e-commerce usage); 첨삭 = 修改; study plan = 讀書計畫書 (existing); 合約 not 合同; 金流業者 for payment provider.

## Glossary

| Concept | Korean (canonical) | zh-Hant |
|---|---|---|
| Contracted-docs no round limit (card) | 계약 서류 안에서 횟수 제한 없음 | 合約內文件不限修改輪數 |
| Premium scope note | 계약한 지원 서류와 지원 일정 안에서 횟수 제한 없이 | Premium 的文件修改，在合約約定的申請文件與申請時程範圍內不限輪數。 |
| Premium feature f3 | 계약한 지원 서류 첨삭 · 횟수 제한 없음 | 合約內的申請文件修改，不限輪數 |
| Up to N managed applications | 대학 지원 최대 2곳 관리 | 最多管理 2 所大學的申請 |
| Applications managed (row) | 대학 지원 관리 | 申請管理 |
| Universities recommended (row) | 추천 대학·어학당 | 推薦學校 |
| Recommend up to 3 | 대학·어학당 최대 3곳 추천 | 推薦最多 3 所大學或語學堂 |
| Custom quote | 별도 견적 | 另行報價 |
| Airport pickup arrangement | 공항 픽업 연결 | 接機安排 |
| Pickup note | 제휴 운송 업체를 연결 | 接機服務由我們為你媒合合作的交通業者。 |
| Visa decision | 발급 여부는 해당 기관이 결정 | 簽證協助是幫你準備與辦理申請，是否核發由主管機關決定。 |
| Additional service | 추가 서비스 | 加購服務 |
| Mock interview | 모의 면접 | 模擬面試 |
| Statement & study-plan editing | 자기소개서·학업계획서 첨삭 | 個人陳述與讀書計畫書修改 |
| Editing round | 1회 (첨삭) | 1 輪 |
| Dormitory | 기숙사 | 宿舍 |
| Settling in | 정착 지원 | 額外安頓協助 |
| Consultation support period | 상담 지원 기간 | 諮詢支援期間 |
| Contract term | 계약 기간 | 合約期間 |
| Priority response | 우선 응대 | 優先回覆 |
| Dedicated team | 전담 팀 | 專屬團隊 · 優先回覆 |
| Responsible team follow-up | 담당 팀 후속 지원 | 負責團隊持續追蹤 |
| Agreed scope | 협의한 범위 | 依約定範圍 |
| Before you buy | 이용 안내 | 購買須知 |
| Decline add-on | 괜찮아요 | 先不用 |

Plan names stay Latin (Basic, All-in-One, Premium) as in `common.json v29.pricing.<slug>.name`; brand is “Hangyul Univ” / “Hangyul” in Latin.

## Passes

**Pass A — meaning vs Korean** — 4 strings changed during the pass.

- Draft “無限次修改” → “合約內的申請文件修改，不限輪數”
- Draft “申請 3 所大學” → “最多管理 3 所學校申請”
- Draft “接送機” → “接機安排” + partner note
- Draft visa wording → “是否核發由主管機關決定”
- s1.title “需要多少協助，就陪你走多遠” → “按你所需，從頭陪到尾” (restores start-to-finish)

**Pass B — native naturalness** — 3 strings changed during the pass.

- “合同” → “合約”
- “支付機構” → “金流業者”
- “不，謝謝” → “先不用”
- “附加服務” → “加購服務”
- “材料” → “文件”

**Pass C — UI brevity, one term per concept** — 2 strings changed during the pass.

- mobile CONTRACTED_DOCUMENTS → “合約文件不限輪數”
- mobile termToAgree → “開始時一起決定”
- 協助/支援 mixed → 支援 for the support period, 協助 for help actions
- row.dedicated → “專屬團隊 · 優先回覆”
- mockIncluded → “含 {{count}} 次”

## Marketing scorecard (30-point: clarity, trust, naturalness, brevity, CTA strength, cultural fit)

| Section | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|
| why.s1 | 5 | 4 | 5 | 5 | 4 | 5 | 28 |
| why.s3 | 5 | 5 | 5 | 4 | 4 | 5 | 28 |

## Unsure

- “加購服務” fits Taiwan; Hong Kong readers may prefer “附加服務”.
- “媒合” (match/arrange) is Taiwan-specific; “安排” is the neutral alternative.

## Counts

- Job keys: 158; strings written: 158
- Kept verbatim from `current`: 0 (none existed)
- Rewritten: 0
- Newly translated: 158

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
