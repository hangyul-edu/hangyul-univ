# Traditional Chinese (zh-Hant) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `zh-Hant`
- Status: NOT human-reviewed. `status` must not be set to `HUMAN_REVIEWED` on the basis of this record.
- Leak check (step 4): not run by this agent. The coordinator runs it.
- Register: Traditional characters, Taiwan/HK-neutral wording, the same as the existing zh-Hant files (你, not 您; 學程, 個人檔案, 顧問, 代辦, 入學梯次, 文件庫).

## Scope

- Merged: `scripts/i18n/v9-data/zh-Hant-1.json` … `zh-Hant-5.json` (2,610 todo keys: common 93, student 652, dossier 180, success 288,
  writing 117, visaroute 484, concierge 460, mobile 336). `zh-Hant-6.json` adds 4 keys that entered the manifest during the run.
  `zh-Hant-7.json` fixes 3 existing strings (see below).
- New namespace files: `zh-Hant/dossier.json`, `success.json`, `writing.json`, `visaroute.json`, `concierge.json`.
- Result: `v9-todo zh-Hant` → web 3,560 keys, 0 missing / identical / stale. `--native` → 4,054 keys, 0 missing.
- Identical to English on purpose (`_identical_ok`): placeholder-only values (`{{reason}}`, `{{amount}}`, `{{min}}–{{max}}`, `{{post}} · {{method}}`, `—`),
  `$t()` nesting (`common:notify.serviceCase`), test names (TOPIK, IELTS, TOEFL iBT, GPA), app names (KakaoTalk, LINE, Telegram, WhatsApp, Zalo), Hangyul.

Method: the first draft came from the reviewed zh-Hans strings (same English source hashes), converted with OpenCC `s2twp`. A post-pass then aligned the
draft with existing zh-Hant terms. After that, every one of the 2,610 strings was read against its English source and corrected where needed: about 170 per-key
rewrites and about 60 systematic term replacements.

## Sample read

All 2,610 todo keys were read against the English, with extra attention on:

- Verdict and tier terms (`student:verdict.*`, `start.tier.*`, `mobile:v3.quick.tier.*`, `v3.match.*`, `success:group.*`, `universityV2.verdictLine.*`), checked against docs/STATE_MAP.md.
- Money and payment safety (`student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `success:submission.fee.*`, `budget.*`). Parents C and D read these.
- Family link and sponsor page (`student:v9.family.*`, `v9.sponsor.*`).
- Visa route (`visaroute:*`): methods, caveats, document names, timing of time-limited papers, CCVI / e-visa wording.
- Legalization (`student:legalFlow.*`, `dossier:*`): apostille vs. consular legalization, notarization, certified translation.
- Submission authorization (`success:submission.authorize.*`): who submits, consent, withdrawal, portal passwords.
- Arrival (`concierge:*`): residence card 90-day rule, NHIS, lease-check disclaimer, emergency numbers.
- Application status notifications (`common:notify.application.*`), aligned with the existing `common:appStatus.*` labels.

No screenshots: browsers are off for translator agents. The coordinator's leak-check screenshots are the screen-level check.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions (converted draft) | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 3 / 4 / 4 / 4 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 4 / 3 / 3 / 4 / 4 | 5 / 4 / 5 / 5 / 5 |
| C. Parent 35–49, pays tuition | 4 / 3 / 3 / 4 / 4 | 5 / 4 / 5 / 5 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 2 / 3 / 4 / 4 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Why the first scores were below 4:
- Naturalness (A–D): the converted draft read as Mainland Chinese in Traditional characters. Examples: 合同, 網上預約, 賬號, 電子郵箱, 流量/套餐, 公交, 航站樓, 示例,
  反饋, 跟進, 工作日, 計劃, 身份, 銀行流水, 中介, 僱主, 本科, 專業 (for "program"). D also found conversion artifacts: 簡簡訊件, 學生髮, 標明瞭, 上傳併傳送, 外國人登入證, 官線上, 學程人士, 全域性, 籤一份合同, 型別.
- Trust (B–D): the verdict bug. `student:start.tier.POSSIBLE` and `mobile:v3.quick.tier.POSSIBLE` (English "One step away" = STATE_MAP REACH, not eligible yet)
  came through as 可能符合, the *Possible match* term. That overstates the result. Writing statuses (`student:writing.status.*`) also carried old meanings
  (e.g. APPROVED "Ready" as 已核准, DRAFT as "草稿 — 準備好了再寫").

## Issues found and fixed (selection)

| Key | Before → After | Why |
|---|---|---|
| `student:start.tier.POSSIBLE`, `mobile:v3.quick.tier.POSSIBLE` | 可能符合 → 只差一步 | English "One step away" = REACH, which STATE_MAP groups under *Not eligible yet*. 可能符合 is the *Possible match* term. |
| `student:verdict.COMPETITIVE` / `.REACH` / `.NOT_ELIGIBLE` / `.STRONG` | (new) 可能符合 / 尚未符合資格 / 尚未符合資格 / 高度符合 | Checked against STATE_MAP and existing `discover.verdict.*`. COMPETITIVE never uses the Strong term, and REACH never uses the Possible term. |
| `mobile:student.matches.tierShort.STRONG` (existing) | 穩當 → 高度符合 | 穩當 means "safe/secure", which is admission-odds wording (forbidden). |
| `student:matches.emptyText.STRONG`, `dashboard.recommended.subtitle` (existing) | 穩當的配對 → 高度符合的學程 / 高度符合與具競爭力的配對 | Same reason. |
| `student:writing.status.*` | 結構檢查 / 已核准 / 草稿 — 準備好了再寫 / 你的修改稿 … → 已提交 / 已完成 / 草稿 / 需要修改 … | Follow the current English, not older meanings. |
| `common:notify.application.*` | 簽證已簽發, 候補, 資料審核中 … → existing `appStatus` labels (簽證已核發, 備取, 個人檔案審核 …) | One status, one label across the app. |
| `common:task.concierge.RESIDENCE_CARD.*`, all residence-card strings | 外國人登入證 → 外國人登錄證 | Conversion artifact. 登入 = log in. |
| `concierge:lease.disclaimer` | 有執照的學程人士 → 有執照的專業人士 | A blanket 專業→學程 replacement had changed "professional" to "program". |
| `visaroute:doc.other_cover_letter.why` | 簡簡訊件 → 簡短信件 | Conversion artifact (短信 → 簡訊). |
| `student:v9.sponsor.goneText` | 請讓學生髮一個新連結 → 請學生再傳一個新連結給你 | Conversion artifact (发 → 髮). |
| `student:v4.ws.you.uploadApproved` | 已核准審核的 → 已通過審核的 | Wording fix. |
| `concierge:emergency.police`, `step.emergency_info.sub` | 報警 → 警察 | A label, not a verb. Matches the existing `arrival.emergency.*`. |
| `concierge:lease.agent`, `lease.flag.MISSING_LANDLORD` | 代辦 → 房仲 | Here "agent" means a real-estate agent, not a study agency. |
| `dossier:v9.who.kept*` | 儲存 → 保存; 等待批准 → 等待核准 | "Retention" (legal keeping), not "saving a file". |
| `success:fit.FIELD_MATCH`, `item.FIELD_DIFFERENT.title` | 學程方向 → 領域 | "Field of study". Matches the existing `matches.factor.field` (就讀領域). |
| `mobile:student.nextAction.PROFILE_UNLOCK.*` | 查看 {{count}} 個專案 → 即可核查 {{count}} 個學程 | 專案 = "project". "Check" means verify eligibility, not "view". |
| `visaroute:degree.COMBINED` | 碩博連讀 → 碩博士一貫學程 | Taiwan term. |
| `visaroute:doc.tb_test.why` | 你的國籍停留超過 90 天時需要 → 依你的國籍，停留超過 90 天就需要 | Ungrammatical subject. |
| `student:supportV3.*` | 請求 / 工單 → 需求 / 客服單 | Matches the existing `support.new.button` (新需求). |

Systematic replacements (applied to every string and then re-read): 合同→合約, 網上→線上, 賬→帳, 電子郵箱→電子郵件, 流量→行動數據, 套餐→方案, 公交→公車,
航站樓→航廈, 雙人間→雙人房, 前臺→櫃檯, 示例→範例, 反饋→回饋, 工作日→工作天, 計劃→計畫, 身份→身分, 銀行流水→銀行對帳單, 中介→代辦, 僱主→雇主,
批次→梯次, 層次→級別, 只讀→唯讀, 推送→推播, 列表→清單, 原件/影印件→正本/影本, 掃描件→掃描檔, 畫素→像素, 平臺→平台, 紙質→紙本, 實時→即時,
晚點→延誤, 候補→備取, 已簽發→已核發 (admission letter / visa), 「」 quotes, spaced em dash " — " (as in existing zh-Hant).

## Terminology (reused from existing zh-Hant strings)

| Concept | zh-Hant |
|---|---|
| Strong match (STRONG / eligible) | 高度符合 |
| Possible match (COMPETITIVE) | 可能符合 |
| Not eligible yet (REACH, NOT_ELIGIBLE) | 尚未符合資格 |
| One step away (REACH sub-label) | 只差一步 |
| Needs your grades | 需要你的成績 |
| Program | 學程 |
| Profile | 個人檔案 |
| Counselor / agency | 顧問 / 代辦 |
| Intake | 入學梯次 |
| Standard admission letter | 標準入學許可書 |
| Apostille / consular legalization | 海牙認證 / 領事認證 |
| Residence card | 外國人登錄證 |
| Immigration office | 出入境管理事務所 |
| Visa issuance certificate (CCVI) | 簽證簽發認定書 |
| Document vault | 文件庫 |
| Essay / study plan | 文書 / 學習計畫書 |
| Waitlisted | 備取 |

## Residual risks (what a native human reviewer should check first)

1. Visa-route official terms: 簽證簽發認定書 (사증발급인정서) and 出入境外國人綜合諮詢中心 (1345). Confirm the forms that Taiwanese/HK readers expect.
2. Status-label pairs that coexist in the app: existing `common:tier.REACH` = 衝刺 and `mobile:student.matches.tierShort.REACH` = 衝刺 follow the English "Reach".
   They are not my todo keys, but a reviewer should decide whether "衝刺" fits STATE_MAP's "not eligible yet — one step away" (I left them).
3. Hong Kong readers: wording is Taiwan-leaning (計畫, 資訊, 視訊, 房仲, 行動數據). A HK reviewer may prefer 計劃, 地產代理, 流動數據, etc.
4. Money strings: `v9.funds.*` (金額, 期間, 名下) and `v9.guard.text` are precise to the English, but a parent-reader check is still worth doing.
5. The first draft came from zh-Hans. Any meaning error zh-Hans still carries could have been inherited where I did not catch it. Note: zh-Hans
   itself still has `student:start.tier.POSSIBLE` and `mobile:v3.quick.tier.POSSIBLE` = 可能匹配 (the *Possible match* term for English "One step away").
   That is the same verdict bug, reported to the coordinator, not fixed here (other locale).
