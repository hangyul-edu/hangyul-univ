# V31 locale review: Simplified Chinese (zh-Hans)

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`

Job `scripts/i18n/v28/jobs-v31/zh-Hans.json` → `scripts/i18n/v28/tx-v31/zh-Hans.json`; glossary `docs/qa/v31/l10n/glossary/zh-Hans.json`.
Register: mainland Simplified Chinese, the tone of a reputable 留学服务 brand: friendly 你 (never 您), plain and reassuring for
students and parents, neutral and exact for legal/privacy text. Standard mainland terms: 海牙认证, 领事认证, 公证, 成绩单,
毕业证书, 存款证明, 外国人登录证, 语学堂, 个人陈述, 学习计划书, 韩国政府奖学金（GKS）. Chinese has only the CLDR `other` plural
form, so no extra plural keys were added.

## Counts

| | keys |
|---|---|
| Reviewed | 1,729 (common 310 · marketing 384 · student 590 · concierge 181 · visaroute 164 · dossier 66 · success 33 · writing 1) |
| Kept verbatim | 1,450 (includes 45 v31-flagged keys re-translated from the new source that came out identical to `current`) |
| Rewritten | 279 |
| new source (v31 / null) | 207 (incl. the 2 keys with `current: null`) |
| terminology | 51 |
| naturalness | 16 |
| quality | 3 |
| meaning (non-v31 keys) | 2 |

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=zh-Hans` → `1729 strings valid, 0 problems`.

## Terminology decisions (one concept = one term)

- **材料** for application/visa documents everywhere (nav, vault, checklists, statuses), replacing the mixed 文件/材料. 文件 is
  kept only for the file itself (upload, file type, electronic files, forged documents in legal text).
- **Hangyul 团队** where the source says "Hangyul team"; **Hangyul Univ 团队** only where the source says "Hangyul Univ team".
- **个人陈述 / 学习计划书** (replaced 自我介绍(书) / 学业计划书); **修改** for 첨삭 editing (replaced 审阅, which reads as review only).
- **材料审核** for document review, plus **修改建议** for notes on what to fix (replaced 补充指导, which suggests Hangyul supplies content).
- **与你共同管理的申请** for managed applications (never 推荐); **推荐院校** for recommended institutions.
- **咨询后答疑期** for the support window (replaced 咨询支持期, which read as a consultation period).
- **语学堂** for 어학당 (mainland standard; replaced 语学院). **社会统合项目（KIIP）**.
- **方案** for plan (replaced 套餐); plan names stay Basic / All-in-One / Premium. Brand stays Latin "Hangyul" (replaced 韩橘).
- Em-dash connectors (——, —) in student/concierge copy replaced by Chinese punctuation; privacy rights/security lists use "：".

## Critical semantic issues found in `current` (all fixed)

| key | said | now says |
|---|---|---|
| student `v4.ws.team.final` | 最后检查，然后将你的申请发送给{{university}} (Hangyul sends the application) | 在你向{{university}}提交前做最后检查 (the student submits) |
| student `register.privacyNote` | shared only with "the counselor you choose" and universities (partner agency missing, invented choice of counselor) | shared with the Hangyul team that supports you (including its partner agency) and the universities you choose |
| common `v29.pricing.compare.scopeNote` | Premium no round limit; exclusions (new documents, translation, notarization) dropped | keeps the contract scope and states the exclusions |
| common `v29.addon.item.airport_pickup` | 接机安排 (no partner; reads as Hangyul runs pickup) | 接机服务（由合作方安排） |
| student `v15.services.scope.consultation` | 咨询时长 (consultation length, the stale V15 "minutes" idea) | 咨询 |
| common `v29.pricing.compare.row.support` | 咨询支持期 (reads as a consultation period) | 咨询后答疑期 |
| student `discover.verdict.reach`, success `group.possible` | 可能匹配 ("maybe a match") | 符合要求，待确认 (meets requirements, needs checking) |
| marketing `v11.why.s3.*` (old ko) | 最合理的费用，最好的结果 / 陪你稳稳走完留学生活 (outcome promise) | 价格公道，没有意外收费 / you see the scope before paying |
| marketing `v15.pricing.title` | 韩橘留学服务价格 (brand translated) | Hangyul 服务价格 |
| marketing `v12.privacy.collect.verification.purpose` | 防止自动注册 ("automated" sign-ups) | 防止虚假注册 (fraudulent sign-ups) |
| common `v29.pricing.premium.f4` | 签证日程重点管理 (visa documents dropped) | 签证材料和关键日期重点管理 · 宿舍申请协助 |
| student `settings.privacy.who.agency` | 仅在方案开始后 (after the plan "starts") | 仅在你购买方案之后 |
| student `writing.status.DRAFT` | 草稿 — 准备好了再写 (invented instruction) | 草稿 |
| marketing `v12.terms.universityInfo.p` | contained Hangul 대학알리미 | 韩国官方大学信息公示数据（Academy Info） |
| marketing `v15.pricing.compare.item` | 项目 (source is intentionally empty) | empty |
| marketing hero/services/why (V31 keys) | translated the old Korean hype (梦想变成现实, 100% 量身定制, 都由我们负责, 都安排好) | transcreated from the corrected source with no overpromising |

## Marketing scorecard (after rewrite; CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY)

| area | C | N | S | T | P | B | total |
|---|---|---|---|---|---|---|---|
| hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| why section (`v11.why.*`, `v29.why.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| pricing (plan cards + comparison) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| add-ons and purchase notes | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| closing CTA (`v11.cta.*`, `v20.uni.cta*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| directory/discovery copy (`v12.directory.*`, `v20/21/23/24.dir.*`, city copy) | 5 | 5 | 5 | 5 | 4 | 5 | 29 |

No area is below 26/30.

## Product scorecard (student app; ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY)

| area | AC | SA | N | C | B | notes |
|---|---|---|---|---|---|---|
| home | 5 | 5 | 5 | 5 | 5 | team name and 材料 unified |
| applications | 5 | 5 | 4 | 5 | 5 | final-check line fixed (student submits) |
| documents | 5 | 5 | 5 | 5 | 5 | 文件→材料 across vault, packages, who-can-see |
| services | 5 | 5 | 4 | 5 | 5 | 咨询时长 removed; allowance labels match pricing terms; 您→你 |
| visa/housing | 5 | 5 | 5 | 5 | 4 | sponsor documents, slow-items line, pickup partner fixed; em dashes removed |

## Unresolved ambiguity (listed, not guessed)

- marketing `v11.faq.q8.a`, `v11.why.*`, `v11.services.*`, `v11.hero.lede`: the `ko` in the job is still the older, more
  promotional Korean, while `en` is the corrected copy. Translated from `en` (the contract-safe meaning); the Korean should be
  aligned.
- concierge `step.pickup.title` ("Book your airport pickup"): kept 预约接机; whether the student books directly with the partner
  or through the Hangyul team is not stated in the source.
- visaroute `v9.funds.longer_other` ("rated 'consulting' by the government"): kept the literal 咨询类; the official Chinese label
  for the lower-tier rating is not established.
