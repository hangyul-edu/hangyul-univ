# V28 l10n review — zh-Hans (Simplified Chinese, mainland China)

Scope: all 354 keys of `scripts/i18n/v28/jobs/zh-Hans.json` (230 with no current translation, 124 with one). Output: `scripts/i18n/v28/tx/zh-Hans.json`. Glossary and personas carried over from `docs/qa/v27/l10n/zh-Hans.md`; register 你 for students, concise 书面 labels for agency/university consoles. Brand stays "Hangyul Univ" / "Hangyul 团队" in Latin script (the old 韩橘 in `student:v16.pay.chooseSubtitle` was removed). The student-facing team is always Hangyul 团队; every 你的顾问 in the job was replaced.

## Personas

| Persona | Profile | What they read for |
|---|---|---|
| 小雨 (first-time visitor) | 18, Qingdao, gaokao graduate, lands on a university page from Xiaohongshu. Wants a 语学堂 year first. | Friendly mainland web register (你). Plain visa words. No 中介 sales tone. |
| 王磊 (comparison shopper) | 27, Hangzhou, engineer, compares Hangyul pricing with two agencies for a 硕士 with IELTS. | Precise terms (招生简章, 申请资格, 录取), honest pricing copy, nothing that promises admission. |
| 李老师 (console user) | 35, counselor at a partner agency in Shenyang, uses the agency console daily. | Short, unambiguous labels; one term per concept (负责人, 案例, 材料, 截止). |

## Glossary

| English | zh-Hans |
|---|---|
| the Hangyul team | Hangyul 团队 (never 你的顾问) |
| Hangyul Univ | Hangyul Univ (Latin) |
| scholarship | 奖学金 |
| Global Korea Scholarship (GKS) | 韩国政府奖学金（GKS） |
| admission guide | 招生简章 |
| apostille | 海牙认证 |
| consular legalization (영사확인) | 领事认证 |
| legalization (generic column) | 认证 |
| Korean language institute (어학당) | 语学堂 |
| Korean language program | 韩语研修课程 |
| certificate of enrollment (재학증명서) | 在读证明 |
| residence card | 外国人登录证 |
| D-2 / D-4 visa | D-2 签证 / D-4 签证 |
| embassy or consulate / post | 使领馆 |
| program | 专业 |
| intake | 招生批次 |
| deadline / due | 截止日期 / 截止 |
| offer / admitted | 录取 |
| enrollment | 入学 / 入学注册 |
| document(s) | 材料 |
| case / case owner | 案例 / 案例负责人 |
| plan (pricing) | 方案 |
| Writing (app section) | 写作 |
| proof of funds | 资金证明 |
| international office | 国际处 |
| Needs more preparation (far tier) | 还需要更多准备 |
| Needs checking with us (unverified tier) | 需要和我们一起确认 |

## Pass A — meaning (31 strings changed)

1. `common:fit.tier.CHALLENGE.title`: 值得进一步了解 → 需要和我们一起确认. The V28 English says the requirements are unverified, not "worth exploring".
2. `common:fit.tier.UNCLEAR.title`: 目前差距还比较大 → 还需要更多准备. Matches the brief's "needs more preparation" wording for the far tier.
3. `concierge:help.route.*`, `dossier:*`, `visaroute:*`, `success:*` (20 strings): 你的顾问 → Hangyul 团队.
4. `visaroute:help.askHint`: 你的问题会发送给你的顾问（或 Hangyul 签证团队） → 你的问题会发送给 Hangyul 团队及其签证专员。
5. `student:v9.announced.rule.STUDY_DEPOSIT_SCHEME`: 不会韩语的学生…每学期解冻一次 → 没有韩语考试成绩的学生…每学期分批发放. The source is about a test result, not about speaking Korean.

Others: `fit.tier.MEETS/ONE_STEP/UNCLEAR/CHALLENGE.lede` (shortened to the new English), `student:scholarships.empty` (added the second sentence), `university:v22.stageHint.decision` (the university decides, not 我方), `student:v26.now.owner.STUDENT`, `marketing:v15.pricing.premium.f5` (removed the pre-departure session the English no longer mentions), `visaroute:form.source.missing`, `common:task.visa.other_passport_record`, `visaroute:doc.other_passport_record.name` (护照签发记录).

## Pass B — native naturalness (34 strings changed)

1. `marketing:seo.home.description`: 从选择合适的韩国大学…一站式完成 → 选大学、备材料、办签证到抵达韩国，一站搞定。
2. `marketing:v15.pricing.lede`: 只做诊断、全程申请，还是…？选择你需要的支持程度。 → 你需要多少帮助，由你决定：初步评估、申请全程，或是抵达后的安顿。
3. `student:v16.pay.chooseSubtitle`: 选择你希望韩橘陪你走多远的方案 → 根据你希望 Hangyul 提供多少帮助来选择方案。
4. `marketing:v10.services.housing.p2`: 押金和月租实际上指什么 → 押金和月租到底是怎么回事
5. `concierge:emergency.note`: 请先打电话——然后告诉你的顾问 → 请先打电话，然后再告诉 Hangyul 团队。 (no dash chain)

Others: `concierge:housing.honest` (dash removed), `marketing:v20.uni.ieqasBody`, `v20.city.Gyeongnam.line`, `v20.uni.why.dormitoryBody`, `university:kpi.insufficientDetail`, `university:v25.in.yield`, plus new-string drafts rephrased away from English word order.

## Pass C — UI context, brevity, one term per concept (21 strings changed)

1. `marketing:v15.pricing.compare.row.dormitory`: 宿舍支持 → 宿舍 (row label, English is "Dormitory").
2. `student:v15.services.scope.dormitory_support`: 宿舍支持 → 宿舍.
3. `dossier:reason.ESSAY_TO_WRITE`: 请先在“文书”中撰写 → 请先在“写作”中完成 (section name is 写作, matching `agency:ws.tab.essays`).
4. `agency:v8.view.docs`: 需补正文件 → 需补正的材料 (one term: 材料).
5. `agency:v11.manage.org`: 组织 → 机构.

Others: `agency:docs.sc.checks` (slash removed), `agency:v9.ops.unpaid.q` (案例负责人), `marketing:v20.uni.ctaBody` (项目/文件 → 专业/材料), `university:v22.stage.enrolment` (入学注册), `university:v22.in.byProgramFoot` (已出结果), `visaroute:step.*` titles, `mobile:v3.uni.decisionNow` (结果).

## Final source ↔ target comparison

All 354 strings checked against EN and KO. No string implies admission probability or a guarantee; the far tier never uses 冲刺/挑战/概率. "Recommended" is not in this job. Placeholders are unchanged and city texts keep their line breaks. No Hangul. 领事认证 and 海牙认证 used consistently. Validator: `node scripts/i18n/v28/validate.mjs --only=zh-Hans` → 354 strings valid, 0 problems.

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA, cultural fit)

| Section | C | T | N | B | CTA | Fit | Total |
|---|---|---|---|---|---|---|---|
| seo.home | 5 | 5 | 5 | 4 | 4 | 5 | 28 |
| journey / v6.unis | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| v10.services.housing | 5 | 5 | 5 | 5 | 4 | 5 | 29 |
| v15.pricing | 5 | 5 | 4 | 4 | 4 | 5 | 27 |
| v20.city (Seoul, Busan, Gyeonggi, Gyeongnam) | 5 | 5 | 4 | 4 | 3 | 5 | 26 |
| v20/v24/v28.uni (university page) | 5 | 5 | 5 | 4 | 5 | 5 | 29 |
| v23.footer | 5 | 5 | 5 | 5 | 3 | 5 | 28 |
| v9.faq.languagesA | 5 | 5 | 4 | 4 | 3 | 5 | 26 |

First-draft `v20.uni.ctaTitle` 准备认真了解了吗？ scored 21 (vague CTA). It was transcreated to 想申请这所大学？ (27). The first-draft `v6.unis.title` 值得远道而来的大学 no longer matches the English and was replaced.

## Strings I'm unsure of

- `agency:v25.today.student_silent` 名学生未回应: assumes a count is printed before the label (KO 학생 응답 없음 has none). If it is a standalone label, 学生未回应 (the old value) is better.
- `agency:v15.plan.PREMIUM` kept as Latin "Premium" since it is a plan name; 高级方案 if plans are meant to be localized.
- `university:v28.pipe.label` 申请进展与结果，打开数据分析: an aria label; "Analytics" is assumed to be the 数据分析 page name.
- `marketing:v20.uni.why.ieqasExcellent` IEQAS 优秀认证: the official Chinese term for the top IEQAS grade is not settled.
- `visaroute:staff.post` 使领馆 and `staff.pack` 材料包 are console jargon taken from KO 공관 / 서류 묶음.

## Counts

- Job keys: 354
- Kept verbatim: 38
- Rewritten: 86
- Newly translated: 230

## Second pass (jobs2): leak families the crawl missed

Same personas and glossary as above (Hangyul 团队, 领事认证, 海牙认证, 招生简章, 材料, 录取, 专业, 招生批次, 申请费). Console strings use concise professional register (学生/顾问/机构); student strings use 你.
Added for this pass: submission method/status labels (门户网站, 申请代理平台, 受托机构提交), 申请组合 (portfolio), 测试数据 (fixture), 学信网（CHSI）认证, 材料库 (vault).

- Pass A meaning: 9 strings changed (e.g. `HANDED_OFF` changed from "已提交" to 已转至门户网站，尚未确认; `DOC_TOO_OLD` changed to 开具时间过早, which describes when the document was issued, not that it expired).
- Pass B naturalness: 14 strings changed (e.g. dropped 的 chains and calqued "needs you" phrasing).
- Pass C UI/brevity/one term: 21 strings changed (one term per concept: 材料 = the document set, 文件 = a file; 申请费, not 报名费 or 手续费; 门户网站 everywhere).

Examples (source → target):
1. `success:agencyItem.DOC_LEGALIZE` {{label}} — consular legalization pending → {{label}}：领事认证待办
2. `agency:v27.guide.missingBody` The current official guide … hasn't been verified … → 该大学和学历层次的现行官方招生简章尚未核实，因此不显示材料清单。Hangyul 运营团队核实简章后即会显示。
3. `success:queue.detail.mechanismText` … Hangyul never stores portal passwords … → … Hangyul 从不保存门户密码，也不会自行提交任何内容。
4. `success:item.ESSAY_WRONG_NAME.why` An essay addressed to another university … → 文书写给了另一所大学，是最常见、也最容易避免的落选原因。
5. `university:v22.empty.decision` No one is on the waitlist. → 候补名单上没有学生。

Marketing (2 keys, intl office lines): clarity 5, trust 5, naturalness 4, brevity 4, CTA 4, cultural fit 4 = 26/30.

Unsure:
- `dossier:page.privacy`: the English names "your counselor". We render it as 只有你和 Hangyul 团队 to follow the team rule, so the counselor is folded into the team.
- `dossier:upload.status.NEEDS_REVIEW/UPLOADED/NEEDS_CORRECTION`: the English value is empty. We wrote 待审核 / 已上传 / 需修改 because the validator rejects empty strings and "{{status}}的{{doc}}" would otherwise render a bare 的.
- `success:queue.fixture` 测试数据: the note sentence then repeats the term (“测试数据”的条目为测试数据).
- `university:outcomes.step.RETAINED` 在读保留 / `retention` 保留率: these are higher-education terms and may read as technical.
- The validator flags `success:agency.questions.too_few` as "plural form without …too_other". This is a false positive: the key name ends in `_few`. It cannot be fixed in tx2.

Counts: job keys 493 · kept verbatim 0 · rewritten 0 · newly translated 493.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
