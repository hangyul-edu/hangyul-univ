# V28 l10n review — zh-Hant (Traditional Chinese, Taiwan)

Scope: all 926 keys of `scripts/i18n/v28/jobs/zh-Hant.json` → `scripts/i18n/v28/tx/zh-Hant.json`.
Every string was written directly in Taiwan-standard Traditional Chinese from EN (+KO for ambiguity). Nothing was converted
from zh-Hans; zh-Hans was not used. Register: 你 for students and the public site; 您／貴校 in the agency and university consoles.
Glossary carried over from `docs/qa/v27/l10n/zh-Hant.md`.
Validator: `node scripts/i18n/v28/validate.mjs --only=zh-Hant` → **926 valid, 0 problems**.

## Personas

| Persona | Profile | Reads for |
|---|---|---|
| 怡君, 18, Taichung | First-time visitor from a search ad; senior high, wants a 語學堂 year then a 學士 | Warm, plain Taiwan web tone; no mainland words (信息, 本科, 視頻) |
| 家豪, 27, Hsinchu | Comparison shopper: has two agency quotes open in other tabs, looking at the pricing table | Exact plan scope (次, 所, 天), no overpromising, clear CTAs |
| 怡君's father, 50s | Sponsor, reads privacy, terms and refunds before paying | Legal/bank register: 個人資料, 退款, 撤回, 帳戶 |
| 陳顧問, agency counselor | Uses the Agency Console all day | Short, consistent console labels: 待審清單, 核可, 要求補件, 指派 |

## Glossary

| English | zh-Hant (Taiwan) | not used |
|---|---|---|
| sign up / register | 註冊 | 注册 / 報名 |
| information | 資訊 / 資料 (personal data) | 信息 |
| visa / visa issued | 簽證 / 核發 | 簽發 |
| scholarship | 獎學金 | |
| Global Korea Scholarship (GKS) | 韓國政府獎學金（GKS） | 政府邀請獎學金 |
| admission guide | 招生簡章 | 招生說明 |
| intake / round | 梯次 | 批次 |
| apostille | 海牙認證 | |
| consular legalization | 領事認證 | 領事確認 |
| Korean language institute | 語學堂 | 語言學校 |
| program / level of study | 學程 / 學制 | 專業 |
| enrollment (uni console) | 註冊 | 入讀 |
| offer / offered | 錄取 | 錄用 |
| residence card | 外國人登錄證 | 居留卡 |
| proof of funds | 財力證明 | 資金證明 |
| the Hangyul team | Hangyul 團隊 | 你的顧問 (student-facing) |
| agency / partner agency | 代辦 / 合作代辦 | 中介 |
| personal statement | 自傳 | 個人陳述 |
| document vault | 文件庫 | |
| review / verify / request changes | 審閱 / 核可 / 要求補件 | 審核通過 |
| queue | 待審清單 | 隊列 |
| task / to-do | 待辦 | 任務 |
| upload / file / email / SMS | 上傳 / 檔案 / 電子郵件 / 簡訊 | 文件(file) / 郵箱 / 短信 |
| privacy policy / terms of service | 隱私權政策 / 服務條款 | 隱私政策 |
| Personal Information Protection Act (Korea) | 韓國《個人資訊保護法》 | 個人資料保護法 (that is Taiwan's law) |
| needs more preparation (far fit tier) | 需要再多準備 | 衝刺 / 挑戰 / 夢幻校 |
| Recommended (plan badge / sort) | 推薦 (an order, not a rank) | 最佳 |
| software / app | 軟體 / App | 軟件 / 應用 |

## Pass A — meaning (9 strings changed)

1. `common:fit.tier.UNCLEAR.title` 目前差距還比較大 → 需要再多準備 (EN now "Needs more preparation"; the far tier must not sound like a probability).
2. `common:fit.tier.CHALLENGE.title` 值得進一步了解 → 需要和我們一起確認 (V28 meaning: requirements not verified yet).
3. `marketing:v11.why.s3.text` draft …並保證你的留學生活成功 → …全力支持你順利展開留學生活 (EN says "guarantees"; Hangyul must not promise outcomes — see Unsure).
4. `marketing:v6.unis.title` 值得遠行的大學。 → 遍布全韓國的大學。 (EN rewritten to "Universities across Korea.").
5. `student:scholarships.empty` 目前沒有可顯示的獎學金。 → …完成個人檔案，看看哪些適合你。 (EN gained a second sentence).
Others: `fit.tier.*.lede` (shorter V28 EN), `visaroute:doc.other_passport_record.name` (issuance record).

## Pass B — Taiwan naturalness (6 strings changed)

1. `marketing:v11.services.s3.text` …都能在同一個地方搞清楚 → …都能在同一個地方處理 (搞清楚 too casual for parents).
2. `concierge:housing.honest` …每條都有標註 → …每一筆都有標示 (筆 is the Taiwan counter for listings; dropped the dash).
3. `visaroute:step.slow_items.why` 無犯罪紀錄證明 → 良民證 (what Taiwanese applicants call it).
4. `student:v9.family.scope.family_documents` 需要家人提供的材料 → 家人需提供的文件 (材料 reads mainland).
5. `marketing:v11.hero.title` draft 韓國留學很簡單！ → 韓國留學，其實不難！ (transcreated; "easy" read as a claim).
Also `marketing:v11.services.lede` 一路陪在 → 始終陪在.

## Pass C — UI context, brevity, one term per concept (all student-facing "counselor" strings + 4 others)

1. All 22 student-facing strings that said 你的顧問／顧問 (concierge, dossier, success, visaroute) → `Hangyul 團隊` per brief.
2. `marketing:v15.pricing.compare.value.unlimited` draft 隨時可詢問顧問 → 隨時可詢問 Hangyul 團隊.
3. `visaroute:money.title` 資金證明 → 財力證明 (glossary term).
4. `agency:docs.sc.verify` / `review.verify` / `docs.bulkVerify`: one verb 核可 everywhere (no 審核通過/驗證 mix).
5. `marketing:v12.seo.university.title` {{name}} — … → {{name}}｜韓國大學 (Taiwan title separator, no dash).
Labels: plan names Basic / All-in-One / Premium kept Latin as on the price page; pipeline steps ≤ 5 characters.

## Final source↔target comparison

Re-read all 926 EN/KO ↔ zh-Hant pairs: placeholders and tags (`<br>`, `<span>`, `<h2>`, `<settings>`, `<privacy>`) intact,
line breaks kept in `v20.city.*.body`, no Hangul (대학알리미 → 大學資訊公開（Academy Info）), no Simplified characters or
mainland vocabulary (scan of 信息/視頻/短信/賬/專業/本科/簽發/鏈接/點擊 and common simplified glyphs: 0 hits), no admission
promise or probability wording, "Recommended" never phrased as a ranking.

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA, cultural fit)

| Section | C | T | N | B | CTA | Fit | Total |
|---|---|---|---|---|---|---|---|
| v11 hero / CTA | 5 | 4 | 5 | 5 | 5 | 4 | 28 |
| v11 services + why | 5 | 4 | 4 | 4 | 4 | 5 | 26 |
| v11 FAQ | 5 | 5 | 4 | 4 | 4 | 5 | 27 |
| v12 directory / map / uni page | 5 | 5 | 5 | 5 | 4 | 5 | 29 |
| v12 privacy + terms | 5 | 5 | 4 | 4 | – (5) | 5 | 28 |
| v15 pricing | 5 | 5 | 5 | 5 | 5 | 4 | 29 |
| v20 cities / uni "why" | 5 | 5 | 5 | 4 | 4 | 5 | 28 |
| v28 uni why (English, GKS, scholarships) | 5 | 5 | 5 | 5 | 4 | 5 | 29 |

First drafts of "v11 services + why" scored 23 (literal "guarantee", 搞清楚, English-order 100% clause); rewritten to 26.

## Strings I am unsure of

- `marketing:v11.why.s3.text`: EN says Hangyul "guarantees a successful life as a student abroad"; softened to 全力支持. Source owner should drop "guarantees" in EN too.
- `marketing:v14.legal.brn` 營利事業登記號碼 / `v14.legal.ecommerce` 通訊銷售業申報號碼: Korean registration concepts with no exact Taiwan equivalent.
- `marketing:v12.type.GRADUATE_UNIVERSITY` 研究所大學 and `JUNIOR_COLLEGE` 專科大學: literal Korean institution types; readable but not Taiwan categories.
- `agency:shell.product` 代辦管理後台: "Agency Console" — 後台 is natural, but product naming may want to stay Latin.
- `university:v28.pipe.rate` 前一階段的 {{pct}}%（{{den}}）: bare denominator in parentheses mirrors EN; may need 分母 for clarity.

## Counts

| Job keys | Kept verbatim | Rewritten | Newly translated |
|---|---|---|---|
| 926 | 11 | 65 | 850 |

## Second pass (jobs2)

Scope: `scripts/i18n/v28/jobs2/zh-Hant.json` → `scripts/i18n/v28/tx2/zh-Hant.json`, 613 job keys (agency 225, success 212,
university 97, student 41, dossier 36, marketing 2): conditional states the crawl never recorded (waiting lines, blockers,
ledes, empty states, submission queue, outcomes/insights). All 613 were missing or English, so every one is newly
translated (kept verbatim 0, rewritten 0). Same personas and the first-pass glossary unchanged (領事認證, 海牙認證, 招生簡章,
梯次, 代辦, 審閱/核可/要求補件, 檔案, 文件庫, 文書, Hangyul 團隊, 待辦, 註冊). New console terms: 遞件 (submit/submission),
登錄 (record), 申請組合 (portfolio), 申請文件包 (package), 學信網（CHSI）認證, 正本/影本, 公證, 媒合分數, 在學率.

Passes: A meaning 613 drafted from EN with KO for ambiguity; B naturalness 14 changed (e.g. 開立日期過久 for "too old",
卡關事項 for "Blockers", 由{{payer}}支付 so payer nouns read without articles); C UI/brevity 9 shortened (status chips,
queue columns, v25 headline fragments that follow a number: 位申請者等待決定 / 件本週新申請). Final source↔target check:
placeholders identical, full-width punctuation, Taiwan forms only (no 信息/文件 for file/短信).

| Key | Before | After |
|---|---|---|
| `success:item.ESSAY_WRONG_NAME.why` | English: An essay addressed to another university is the most common avoidable rejection. | 文書寫成給另一所大學，是最常見、也最容易避免的不錄取原因。 |
| `agency:v15.readiness.blocker.document_legalization` | English: {{detail}} needs an apostille or consular legalization | {{detail}} 需要海牙認證或領事認證 |
| `success:queue.detail.mechanismText` | English: Open the official portal in your own browser… | 請在你自己的瀏覽器開啟官方入口網站，並以貴代辦的帳號遞件。Hangyul 絕不儲存入口網站密碼，也不會自行遞交任何資料。 |
| `student:workspace.owner.done.team` | English: Still here if you need help with student life. | 留學生活上需要幫忙時，我們都在。 |
| `university:v22.empty.enrolment` | English: Nobody is between offer and enrolment right now. | 目前沒有介於錄取與註冊之間的學生。 |

Marketing scorecard (2 keys, `v20.uni.intl.*`): clarity 5 · trust 5 · naturalness 5 · brevity 4 · CTA 4 · cultural fit 5 = 28.

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=zh-Hant` → **613 strings valid, 0 problems**
(after the validator fix for job keys ending in `_few`, e.g. 學程太少？, and empty-English keys).

### Second pass: unsure

- `dossier:upload.status.NEEDS_REVIEW / UPLOADED / NEEDS_CORRECTION`: EN/KO are intentionally empty (no adjective in `upload.haveTitle`); the updated validator requires an empty value, so they are left empty.
- `dossier:page.privacy`: EN "you, your counselor and Hangyul" rendered as 你和 Hangyul 團隊 (team identity rule; same choice in ru/fa/ur). Confirm the product intends the team, not agency staff.
- `university:v25.head.*`: fragments assume the number is rendered before them (位/項/件 classifiers chosen per noun).
- `success:agency.ownerShort.counselor` 顧問 and `agency:v9.waiting.on.us` 等待我方: console-only, agency staff.
- `agency:v27.issue.CHINA_CHSI` 學信網（CHSI）認證: mainland term; Taiwan readers know 學信網 but a human should confirm.

## Third pass (jobs3)

Scope: `scripts/i18n/v28/jobs3/zh-Hant.json` → `scripts/i18n/v28/tx3/zh-Hant.json`, 302 job keys (university 194, student 50,
writing 20, marketing 19, visaroute 16, concierge 2, common 1): the remaining customer-critical keys (sign-up, password reset,
consent texts, "what your plan is doing now", directory filters, privacy retention) and operational console keys (University
Console applicants/programs/cohorts/messages, visa staff panel, writing queue). All 302 had `current: null`, so every one is
newly translated (kept verbatim 0, rewritten 0). No empty-English keys in this job. Same personas; first-pass glossary
unchanged (錄取, 註冊, 學程, 梯次, 代辦, 審閱/核可/要求補件, 文書, Hangyul 團隊, 簡訊, 隱私權政策, 帳戶). New console terms:
駐外館處 (visa post), 文件包 (pack), 在學率 (retention), 備取 (waitlisted), 稽核軌跡 (audit trail), 大學後台 (University Console).

Passes: A meaning 302 drafted from EN with KO for ambiguity (e.g. `documents.legalization` 認證, not 公證; `staff.appointment`
預約); B naturalness 6 changed (驗證碼 not 認證碼 for one-time code; 輪到你了 for "Your turn"; 拿到錄取後就會馬上開始);
C UI/brevity 5 shortened (filter chips 篩選/全部清除, status chips 已截止/受理中, 待決定者優先). Final source↔target check:
placeholders identical, full-width punctuation, Taiwan forms only (簡訊, 帳戶, 檔案/文件 per glossary, no 信息/短信/賬號).

| Key | Before | After |
|---|---|---|
| `student:register.consent.CROSS_BORDER_VERIFICATION.label` | missing | 我了解我的電子郵件與手機號碼將在境外處理以進行驗證 |
| `student:v26.now.empty.max_recommended_institutions` | missing | 諮詢後，Hangyul Univ 團隊會為你推薦大學。 |
| `marketing:v23.privacy.retention.twilio_sms` | missing | 簡訊紀錄預設保存 13 個月（400 天）；Hangyul 已要求將簡訊內容去識別化。 |
| `university:v4.status.OFFERED` | missing | 已錄取，等待回覆 |
| `university:af.foot` | missing | 每件申請都會計入它已到達的每個階段。少於 {{min}} 筆紀錄時不顯示比率。已結案：未錄取 {{rejected}} 件、撤回 {{withdrawn}} 件。 |

Marketing scorecard (19 keys: directory filters `v21/v23/v24.dir.*`, campus `v21/v23.uni.*`, privacy retention, footer):
clarity 5 · trust 5 · naturalness 5 · brevity 5 · CTA 4 · cultural fit 5 = 29. `v24.dir.title` transcreated as 找到最適合你的韓國大學.

Validator: `JOBS=jobs3 TX=tx3 node scripts/i18n/v28/validate.mjs --only=zh-Hant` → **302 strings valid, 0 problems**.

### Third pass: unsure

- `university:documents.legalization` 認證: KO 공증·인증 covers notarisation and apostille/legalization; a column header, kept generic.
- `visaroute:staff.post` 駐外館處: Taiwan term for embassy/consulate posts; the KO 공관 is the same concept.
- `university:cohorts.flags` 警示 / `cohorts.atRisk` 需關注 / `nav.earlyWarnings` 早期預警: three related labels, consistent but a human should check the console wording.
- `student:v22.home.withAgency` 與{{org}}合作: reads as "working with {{org}}"; depends on surrounding layout.
- `university:product` 大學後台 (console): 後台 is common in Taiwan SaaS; alternative 大學管理平台.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
