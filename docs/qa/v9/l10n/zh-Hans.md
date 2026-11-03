# Simplified Chinese (zh-Hans) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `zh-Hans`
- Status: NOT human-reviewed. `status` must not be set to `HUMAN_REVIEWED` on the basis of this record.
- Leak check (step 4): not run by this agent. The coordinator runs it.

## Scope

- Merged: `scripts/i18n/v9-data/zh-Hans-1.json` … `zh-Hans-9.json` (1,996 todo keys: common 91, mobile 57, student 319, dossier 180,
  writing 117, success 288, visaroute 484, concierge 460), and `zh-Hans-10.json` (9 revisions from this review, 2 of them fixes to existing verdict strings).
- New namespace files: `zh-Hans/dossier.json`, `writing.json`, `success.json`, `visaroute.json`, `concierge.json`.
- Result: `v9-todo zh-Hans` → web 3,556 keys, 0 missing / identical / stale. `--native` → 4,050 keys, 0 missing.
- Identical to English on purpose (`_identical_ok`): `common:notify.serviceCase` (only `$t()` nesting and placeholders).
  Brand names, app names (KakaoTalk, LINE, WhatsApp, Zalo, Telegram) and placeholder-only values are allowed tokens.

## Sample read

All 1,996 todo keys were read in screen context, with extra attention on:

- Money and payment safety (`student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `success:submission.fee.*`). Parents C and D read these.
- Family link and sponsor page (`student:v9.family.*`, `v9.sponsor.*`).
- Visa route (`visaroute:*`): embassy and consulate methods, caveats, document names, the timing of time-limited papers.
- Document legalization (`student:legalFlow.*`, `dossier:*`): apostille vs. consular legalization, notarization, certified translation.
- Submission authorization (`success:submission.authorize.*`): who submits, consent, withdrawal, never sharing a portal password.
- Arrival (`concierge:*`): residence card 90-day rule, NHIS, lease check disclaimer, emergency numbers.
- Existing verdict strings (`student:verdict.*`, `discover.verdict.*`), checked against docs/STATE_MAP.md.

No screenshots: browsers are off for translator agents. The coordinator's leak-check screenshots are the screen-level check.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 4 / 4 / 5 / 5 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 5 / 4 / 3 / 4 / 5 | 5 / 4 / 5 / 5 / 5 |
| C. Parent 35–49, pays tuition | 5 / 4 / 3 / 4 / 5 | 5 / 4 / 5 / 5 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 3 / 3 / 4 / 5 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Why some first scores were below 4: B, C and D gave trust a 3 because two existing verdict strings were mislabelled. `verdict.COMPETITIVE`
used the *Strong match* term and `verdict.REACH` used *Possible match*, which overstates the result to the person who pays.
D gave naturalness a 3 because of a few literal calques: "家人视图" (family *view*), "最小的考试目标" (smallest test step) and "私人换汇者".

## Issues found and fixed

| Key | Before → After | Why |
|---|---|---|
| `student:verdict.COMPETITIVE` | 高度匹配 → 可能匹配 | English and STATE_MAP say *Possible match*. The old string used the *Strong match* term. |
| `student:verdict.REACH` | 可能匹配 → 暂不符合条件 | English is "Not eligible yet" (STATE_MAP: one step away). The old string read as "possible match". |
| `student:v9.family.nav`, `.title` | 家人视图 → 家人查看页 | "视图" is software jargon. Older parents read "查看页" (a page to look at) more easily. |
| `student:v9.routes.step.title` | 最小的考试目标 → 离你最近的考试目标 | The literal "smallest" made no sense in Chinese. |
| `student:v9.guard.text`, `v9.refund.noAgents` | 私人换汇者 → 私人换汇商 | The usual term for informal money changers. |
| `student:v4.unlock.ielts`, `.topik` | …即可申请 → …即可满足这项要求 | "即可申请" sounded like a promise that the student could apply. The English only says the score would meet that one requirement. |

## Terminology (reused from existing zh-Hans strings)

| English | zh-Hans |
|---|---|
| Strong match | 高度匹配 |
| Possible match | 可能匹配 |
| Not eligible yet (incl. one step away) | 暂不符合条件 |
| Needs your grades | 需要你的成绩 |
| Your counselor | 你的顾问 |
| Tuition / application fee | 学费 / 申请费 |
| (Standard) admission letter / certificate of admission | （标准）入学许可书 |
| Apostille / consular legalization | 海牙认证（附加证明书） / 领事认证 |
| Notarization / certified translation | 公证 / 认证翻译 |
| Bank balance certificate / bank statement | 存款证明 / 银行流水 |
| Family relationship certificate | 亲属关系证明 |
| Residence card | 外国人登录证 |
| Immigration office | 出入境管理事务所 |
| Embassy / consulate / post | 大使馆 / 领事馆 / 使领馆 |
| Visa issuance certificate (CCVI) | 签证签发认定书 |
| e-visa | 电子签证 |
| Sponsor | 担保人 |
| Agency | 中介机构 |
| Plan (Hangyul service) | 方案 |
| Essays / Writing | 文书 |
| Program | 专业 |
| Application statuses | identical to `common:appStatus.*` |

## Residual risks (what a native reviewer should check first)

1. **Visa and legal terms**: 签证签发认定书 (CCVI), "优秀"/"咨询"/"认证" university certification tiers, 事业者登记证 (business registration),
   and 统一代办 for group residence-card filing. These are close renderings of Korean administrative terms. Check them against the wording
   Chinese applicants see on Korean embassy and university notices.
2. **Money sentences**: `v9.funds.*` (held vs. history periods, whose name the account is in) and `v9.money.note.NHIS_*`. Each was checked
   against the English, but a parent-reviewer should confirm they read as unambiguous.
3. **Word vs. character limits** (`writing:finding.OVER_LIMIT`, `UNDER_LENGTH`, `LONG_SENTENCE`): kept as "词" (words) to match the English
   rule. For essays written in Chinese this may confuse; this is a product question, not only a translation one.
4. **City and airport names** (`visaroute:city.*`, `concierge:airport.*`): standard mainland transliterations (e.g. 帕坦（拉利特布尔）for Lalitpur).
5. **Dash style**: new strings use "——" (full-width); some older strings use " — ". Both read fine, but a style pass could unify them.
6. Reviewer-facing strings in the student namespaces (`writing:finding.SIMILAR_TEXT`, `common:task.writingEscalation`) use staff voice. They are correct but were scored less closely.
