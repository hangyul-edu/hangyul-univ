# V29 service-contract l10n record — zh-Hans (Simplified Chinese)

Job: `scripts/i18n/v28/jobs-v29/zh-Hans.json` (158 keys, all `current: null`) → `scripts/i18n/v28/tx-v29/zh-Hans.json`.
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=zh-Hans` → 158 strings valid, 0 problems (EXIT=0). Not applied.

## Personas

- First-time visitor: 国内高三学生 (18)，手机浏览
- Comparison shopper: 家长对比各方案与中介报价
- 考研/读研申请人 (25)，只需材料与签证

## Key term decisions

- No round limit within contracted documents: “合同约定材料内不限轮数”; long form “在合同约定的申请材料和申请日程范围内不限轮数”. Never “无限修改”.
- Up to N managed applications: “最多管理 N 所（院校）申请” (row “申请管理”) vs “推荐院校”/“最多推荐 N 所”.
- Custom quote: “另行报价”.
- Airport pickup arrangement: “接机安排”; note “由我们为你对接合作的交通服务商”.
- Plan = 方案; 첨삭 = 修改; 어학당 = 语学堂 (existing); study plan = 学习计划书; add-on = 附加服务; notify uses 提议 (not 推荐) to keep 推荐 for university recommendations.

## Glossary

| Concept | Korean (canonical) | zh-Hans |
|---|---|---|
| Contracted-docs no round limit (card) | 계약 서류 안에서 횟수 제한 없음 | 合同约定材料内不限轮数 |
| Premium scope note | 계약한 지원 서류와 지원 일정 안에서 횟수 제한 없이 | Premium 的文书修改在合同约定的申请材料和申请日程范围内不限轮数。 |
| Premium feature f3 | 계약한 지원 서류 첨삭 · 횟수 제한 없음 | 合同约定的申请材料修改，不限轮数 |
| Up to N managed applications | 대학 지원 최대 2곳 관리 | 最多管理 2 所大学的申请 |
| Applications managed (row) | 대학 지원 관리 | 申请管理 |
| Universities recommended (row) | 추천 대학·어학당 | 推荐院校 |
| Recommend up to 3 | 대학·어학당 최대 3곳 추천 | 推荐最多 3 所大学或语学堂 |
| Custom quote | 별도 견적 | 另行报价 |
| Airport pickup arrangement | 공항 픽업 연결 | 接机安排 |
| Pickup note | 제휴 운송 업체를 연결 | 接机服务由我们为你对接合作的交通服务商。 |
| Visa decision | 발급 여부는 해당 기관이 결정 | 签证支持是协助你准备和办理申请，是否签发由相关机构决定。 |
| Additional service | 추가 서비스 | 附加服务 |
| Mock interview | 모의 면접 | 模拟面试 |
| Statement & study-plan editing | 자기소개서·학업계획서 첨삭 | 个人陈述与学习计划书修改 |
| Editing round | 1회 (첨삭) | 1 轮 |
| Dormitory | 기숙사 | 宿舍 |
| Settling in | 정착 지원 | 额外安顿支持 |
| Consultation support period | 상담 지원 기간 | 咨询支持期 |
| Contract term | 계약 기간 | 合同期限 |
| Priority response | 우선 응대 | 优先回复 |
| Dedicated team | 전담 팀 | 专属团队 · 优先回复 |
| Responsible team follow-up | 담당 팀 후속 지원 | 负责团队持续跟进 |
| Agreed scope | 협의한 범위 | 按约定范围 |
| Before you buy | 이용 안내 | 购买须知 |
| Decline add-on | 괜찮아요 | 暂不需要 |

Plan names stay Latin (Basic, All-in-One, Premium) as in `common.json v29.pricing.<slug>.name`; brand is “Hangyul Univ” / “Hangyul” in Latin.

## Passes

**Pass A — meaning vs Korean** — 4 strings changed during the pass.

- Draft “无限次修改” → “合同约定的申请材料修改，不限轮数”
- Draft “申请 3 所大学” → “最多管理 3 所院校申请”
- Draft “接送机服务” → “接机安排” + partner note
- Draft “协助拿到签证” → “是否签发由相关机构决定”
- notify “为你推荐了一项附加服务” → “为你提议了一项附加服务”

**Pass B — native naturalness** — 3 strings changed during the pass.

- “不，谢谢” → “暂不需要”
- “说不不会改变任何事” → “不选择也没关系，你现在的方案会照常继续”
- “公平的价格” → “合理的价格”
- “处理失败” → “没能处理成功，请稍后再试”
- “使用前须知” → “购买须知”

**Pass C — UI brevity, one term per concept** — 2 strings changed during the pass.

- mobile CONTRACTED_DOCUMENTS → “合同材料内不限轮数”
- mobile termToAgree → “开始时一起确定”
- 材料/文件/资料 mixed → 材料 throughout
- row.dedicated → “专属团队 · 优先回复”
- mockIncluded → “含 {{count}} 次”

## Marketing scorecard (30-point: clarity, trust, naturalness, brevity, CTA strength, cultural fit)

| Section | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|
| why.s1 | 5 | 4 | 5 | 5 | 4 | 5 | 28 |
| why.s3 | 5 | 5 | 5 | 4 | 4 | 5 | 28 |

## Unsure

- v15.pricing.title uses 韩橘留学; V29 strings follow the brief and keep “Hangyul Univ” in Latin — flag for brand consistency.
- “语学堂” is colloquial but the established term; “韩语研修机构” is the formal alternative.

## Counts

- Job keys: 158; strings written: 158
- Kept verbatim from `current`: 0 (none existed)
- Rewritten: 0
- Newly translated: 158

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
