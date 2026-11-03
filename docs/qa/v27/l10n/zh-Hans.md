# V27 l10n review — zh-Hans (Simplified Chinese, mainland China)

Scope: all 729 strings of `scripts/i18n/v27/strings.json` (215 new, 514 changed). The changed strings were translated again from the new English, with the Korean used to settle ambiguity. They were not patched from the old bundle.
Established product terms come from `packages/i18n/locales/zh-Hans/`: 奖学金, 海牙认证, 领事认证, 语学堂, 专业, 文书, 我的匹配, Hangyul Univ 团队, 合作留学机构, 插班. The register is 你, as in the existing bundle.
Output: `scripts/i18n/v27/tx/zh-Hans.json`.

## Personas

| Persona | Profile | What they read for |
|---|---|---|
| 小雨 | 18, Qingdao, gaokao graduate. Wants a 语学堂 year first, then a bachelor's. | Friendly mainland web register (你, 吧). No stiff 书面语. Clear visa terms. |
| 王磊 | 27, Hangzhou, software engineer. Applying for a 硕士 with IELTS. | Precise terms: 招生简章, 申请资格, 录取, 学信网认证. Nothing that sounds like a guarantee from an agency. |
| 小雨的妈妈 | 50s, pays tuition | Money safety copy: 学费直接付给大学, 退款, 存款证明, 中介. Nothing that resembles 中介 sales talk. |

## Glossary

| English | zh-Hans |
|---|---|
| scholarship | 奖学金 |
| Global Korea Scholarship (GKS) | 韩国政府奖学金（GKS） |
| admission guide | 招生简章 |
| apostille | 海牙认证 |
| Apostille Convention | 《海牙公约》 |
| consular legalization (영사확인) | 领事认证 |
| Korean language institute | 语学堂 (first use: 语学堂（韩语教育机构）) |
| Korean language program | 韩语研修课程 |
| CHSI / CDGDC | 学信网（CHSI） / 学位网（CDGDC） |
| certificate of admission (표준입학허가서) | 标准入学许可书 |
| CCVI (사증발급인정서) | 签证发放认定书（CCVI） |
| residence card | 外国人登录证 |
| immigration office | 出入境管理事务所 |
| embassy or consulate (generic) | 大使馆或领事馆 / 使领馆 |
| D-2 / D-4 visa | D-2 签证 / D-4 签证 |
| apply / application | 申请 |
| requirement / eligibility | 申请要求 / 申请资格 |
| admission / offer | 录取 / 录取通知 |
| tuition | 学费 |
| proof of funds / bank balance certificate | 资金证明 / 存款证明 |
| counselor / the Hangyul team | 顾问 / Hangyul 团队 |
| agency | 留学机构 (中介 only in the money warning) |
| program | 专业 (level sense: 课程 / 课程层次) |
| Recommended (sort) | 推荐顺序 (a browsing order; `fit.order` says it is not a ranking) |
| associate / bachelor / transfer / integrated | 专科 / 本科 / 本科插班 / 硕博连读 |
| Writing (app section) | “写作” |

## Pass A — meaning (6 strings changed)

1. `visaroute:why.POST_BY_REGION`: 韩国驻{{city}}大使馆或领事馆 → 韩国驻{{city}}使领馆. "驻<city>大使馆" is wrong when the post is a consulate-general.
2. `visaroute:why.POST_FOR_COUNTRY`: same fix.
3. `common:uni27.service.COUNSELING`: 心理咨询 → 咨询服务. The source (상담 지원) does not say "psychological".
4. `student:budget.possible_other`: 未计入（{{count}} 项）：… → 未计入的奖学金（{{count}} 项）：… Restored "scholarships", which the KO makes explicit. The `_one` form got the same fix.
5. `visaroute:reason.GET_LATER`: 以确保在{{appointment}}时仍然有效 → 以确保到{{appointment}}那天仍然有效. The appointment is a date.

## Pass B — native naturalness (8 strings changed)

1. `marketing:agencyNet.title`: 真实的人，精心挑选，对结果负责。 → 精心挑选、认真负责的真人团队。 (The draft followed English word order.)
2. `marketing:v6.product.lede`: …统统换成一份了解你进度的计划 → …里零散的信息，汇总成一份了解你现状的计划。
3. `marketing:matching.p1`: …给出确切的理由，而不是空洞的承诺 → …并给出确切理由，而非空头承诺
4. `student:support.emptyText`: 再小的问题也不算小。 → 再小的问题都可以问。 (The draft was a calque of "No question is too small".)
5. `common:uni27.service.ORIENTATION`: 新生说明会 → 入学指导

Others: `v8.work.text`, `agencyNet.points.measured.text`, `flow.university.text`.

## Pass C — UI context and brevity (3 strings changed)

1. `common:fit.sort.name`: 按名称 → 名称. Matches the sibling sort labels (推荐顺序 / 奖学金 / 地区).
2. `mobile:v3.profile.unlockTitle`: 完善个人资料后，你可以 → 完善个人资料的好处. A heading must not end on a dangling clause.
3. `mobile:v3.quick.open`: 免注册，查看你能申请哪些学校 → 查看可申请的学校（免注册）. The verb now comes first, as in a CTA.

Consistency checks:
- One term each is used for 奖学金, 招生简章, 海牙认证, 领事认证, 语学堂, 顾问 and Hangyul 团队.
- Labels are short: `fit.level.*` 2–4 characters, `fit.tier.*.short` ≤ 6.
- The 10 `fit.test.*` names already had their native gloss in the draft (see "Unsure"), so Pass C did not change them.

## Final comparison

I compared the whole set again (EN + KO ↔ zh-Hans):
- Nothing implies admission probability or a guarantee. 推荐顺序 is explained as a browsing order.
- Placeholders and `<em>` are preserved. Plural pairs read correctly for any count. The city texts keep their line breaks.
- No Hangul: 대학알리미 is rendered as 大学信息公示（Academy Info）.
- Validator: `node scripts/i18n/v27/validate.mjs --only=zh-Hans` → 729 valid, 0 problems.

## Strings I'm unsure of

- **`common:fit.test.*` (10 strings).** The brief says test names stay in Latin script. The validator fails a zh-Hans string with no Han characters. I therefore kept the official Latin name and added the established Chinese name in parentheses, e.g. TOEFL iBT（托福）, IELTS Academic（雅思学术类）, TOEIC（托业）, Duolingo English Test（多邻国英语测试）. These labels are also put into sentences ("{{test}} 达到 {{min}} 及以上"), where the gloss adds length. Recommendation: let these keys bypass the script check and use the bare Latin names.
- `v9.funds.longer_*`: “咨询”类. This is a literal rendering of the Korean "컨설팅" university tier. There is no settled Chinese term.
- `fit.level.ASSOCIATE` 专科 (전문학사) and `fit.level.COMBINED` 硕博连读 are the nearest mainland equivalents, not exact ones.
- `uni27.cat.GKS`: 韩国政府奖学金（GKS） is the name used by Chinese applicants and NIIED's Chinese pages. The literal 政府邀请奖学金 was avoided.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → 申请时不要求语言成绩。入学后需要达到 {{tests}} 及以上。
- `fit.reason.far` → 需要 {{options}} 及以上，与你目前的成绩差距较大。
- `fit.tier.UNCLEAR.title` → 目前差距还比较大
- `fit.tier.UNCLEAR.short` → 还需准备
- `fit.tier.UNCLEAR.lede` → 你目前的成绩与公布的要求差距较大。建议预留更充足的准备时间，之后再来查看。

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
