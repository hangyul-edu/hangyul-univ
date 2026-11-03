# V27 l10n review — zh-Hant (Traditional Chinese, Taiwan / Hong Kong readers)

Scope: all 729 strings of `scripts/i18n/v27/strings.json` (215 new, 514 changed). I wrote every string directly in Taiwan-standard Traditional Chinese from the EN and KO sources. Nothing was produced by converting the zh-Hans text: vocabulary and phrasing were chosen separately (see the glossary).
Established product terms come from `packages/i18n/locales/zh-Hant/`: 獎學金, 海牙認證, 領事認證, 學程, 文書, 我的配對, 代辦, 個人檔案, 已儲存, 待辦事項, 顧問, 匯出. The register is 你, as in the existing bundle.
Output: `scripts/i18n/v27/tx/zh-Hant.json`.

## Personas

| Persona | Profile | What they read for |
|---|---|---|
| 怡君 | 18, Taichung. Senior high student who likes K-dramas. Plans a 語學堂 year, then a 學士. | Casual Taiwan web tone (吧, 喔-free but warm). No mainland words such as 信息 or 本科. |
| 家豪 | 27, Hsinchu, semiconductor engineer. Applying for a 碩士 with 多益/IELTS. | Precise application terms: 招生簡章, 申請資格, 錄取, 學制, 財力證明. |
| 怡君的爸爸 | 50s, pays tuition | Money and fraud-safety copy: 匯款, 帳戶, 代辦, 退款. Should read like a bank or school notice, not like an agency's sales copy. |

## Glossary

| English | zh-Hant (Taiwan) | not used (mainland / literal) |
|---|---|---|
| scholarship | 獎學金 | |
| Global Korea Scholarship (GKS) | 韓國政府獎學金（GKS） | 政府邀請獎學金 |
| admission guide | 招生簡章 | 招生说明 |
| intake / round | 梯次 | 批次 |
| apostille / Apostille Convention | 海牙認證 / 海牙公約 | |
| consular legalization | 領事認證 | 領事確認 |
| Korean language institute | 語學堂 (first use: 語學堂（韓語教育中心）) | |
| program / level of study | 學程 / 學制 | 專業 / 課程層次 |
| associate / bachelor / transfer / integrated | 副學士 / 學士 / 學士插班 / 碩博一貫 | 專科 / 本科 / 碩博連讀 |
| international student | 外籍生 | 留學生 (in uni pages) |
| certificate of admission | 標準入學許可書 | |
| CCVI (사증발급인정서) | 簽證核發認定書（CCVI） | 簽證發放認定書 |
| visa issued | 核發 | 簽發 |
| residence card | 外國人登錄證 | |
| immigration office / change of status | 出入境管理事務所 / 變更居留身分 | |
| embassy or consulate (generic) | 大使館或領事館 / 館處 | 使領館 |
| proof of funds / bank balance certificate | 財力證明 / 存款證明 | 資金證明 |
| bank transfer / account | 匯款 / 帳戶 | 轉賬 / 賬戶 |
| agency | 代辦 | 中介 / 留學機構 |
| counselor / the Hangyul team | 顧問 / Hangyul 團隊 | |
| SMS / email / upload / file | 簡訊 / 電子郵件 / 上傳 / 檔案 | 短信 / 郵箱 |
| profile / save / export | 個人檔案 / 儲存 / 匯出 | 個人資料 / 收藏 / 導出 |
| TOPIK / TOEIC | 韓國語文能力測驗 / 多益 | 韓國語能力考試 / 托業 |
| personal statement | 自傳 | 個人陳述 |
| health insurance | 健保 | 醫保 |
| Recommended (sort) | 推薦順序 (a browsing order; `fit.order` says it is not a ranking) | |
| application fee | 報名費 | 申請費 |

## Pass A — meaning (4 strings changed)

1. `common:uni27.schol.strongest`: 金額最高的新生獎學金 → 最優渥的新生獎學金. "Largest" can be a tuition-waiver percentage, not only an amount.
2. `common:uni27.schol.strongestFor`: same fix.
3. `visaroute:caveat.EVISA_TIER_UNKNOWN`: 學校可以改由學校替你申請電子簽證 → 學校就能替你申請電子簽證. The draft repeated the subject and was garbled.
4. `student:budget.scholarshipAlternative`: 二擇一，不重複計算。 → 兩者擇一，不重複計入。 The draft could be read as "not counted twice in the total", which blurs what the source means.

## Pass B — Taiwan naturalness (6 strings changed)

1. `marketing:seo.home.description`: …一站搞定。 → …在同一個地方一次完成。 搞定 is too slangy for a parent-facing meta description.
2. `marketing:v7.why.text`: …五個網站和一個群組… → …五個網站和一個聊天群組… Also smoothed to 得自己搞懂….
3. `marketing:agencyNet.points.measured.text`: …那只會獎勵專挑簡單案件的做法。 → …那只會鼓勵專挑簡單案件。 獎勵…做法 was a calque of "reward".
4. `student:essay.precheck.code.OVERCLAIM`: 避免絕對的說法，改用具體事證來說明。 → 避免過於絕對的說法，改用具體事證說明。
5. `marketing:v6.journey.lede`: 一份清楚你走到哪裡、下一步是什麼的計畫。 → 一份計畫，清楚知道你走到哪裡、下一步是什麼。 The draft stacked modifiers in English order.

Others: `dashboard.nextAction.TASK.text.APPLICATION_SUBMIT`.

## Pass C — UI context and brevity (4 strings changed)

1. `marketing:v20.city.Gyeonggi.line`: 同一張捷運路線圖 → 同一張地鐵路線圖. Taiwanese writing about Seoul says 首爾地鐵. This now matches the Seoul and Chungnam texts.
2. `visaroute:v5.formDone`: 所有部分都已確認，請再檢查一次 → 所有部分都已確認，點此再次檢視. It is a tappable row, so it needs a clear action.
3. `common:task.applicationCloses`: {{university}}・{{program}} → {{university}}／{{program}}. ・ is a Japanese separator.
4. `common:task.deadlinePassed`: same separator fix.

I also scanned for leftover Simplified characters (a 100-character blocklist) and mainland vocabulary (信息, 視頻, 短信, 賬號, 專業, 本科, 簽發, 鏈接, 點擊, 材料 …). Neither scan found anything.
Labels are short: `fit.level.*` 2–4 characters, `fit.sort.*` 2–4, `fit.tier.*.short` ≤ 6.

## Final comparison

I compared the whole set again (EN + KO ↔ zh-Hant):
- No promise of admission, probability or guarantee. 推薦順序 is described as a browsing order.
- Placeholders and `<em>` are intact. Plural pairs work for any count. The city texts keep their line breaks.
- No Hangul: 대학알리미 is rendered as 大學資訊公開（Academy Info）.
- Validator: `node scripts/i18n/v27/validate.mjs --only=zh-Hant` → 729 valid, 0 problems.

## Strings I'm unsure of

- **`common:fit.test.*` (10 strings).** The brief says test names stay in Latin script, but the validator fails a zh-Hant string with no Han characters. I therefore kept the Latin name and added the Taiwan name in parentheses, e.g. TOEIC（多益）, TOEFL iBT（托福）, IELTS Academic（雅思學術組）. These labels are also interpolated into sentences ("{{test}} 達到 {{min}} 以上"). Recommendation: exempt these keys from the script check.
- `v9.funds.longer_*`: 「輔導」等級. I chose this for the Korean "컨설팅" tier because Taiwan's university evaluation uses 輔導 for schools under remediation. It is an interpretation, not an official term.
- `fit.level.ASSOCIATE` 副學士: this is the Hong Kong and Taiwan degree name, but Taiwan readers may know 二專/五專 better. `fit.level.COMBINED` 碩博一貫: Taiwan universities call this 學碩/碩博一貫修讀.
- Hong Kong readers would say 升學顧問/中介 rather than 代辦, and 地鐵 is natural for them. I kept Taiwan usage as instructed.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → 申請時不需要語言成績。入學後需達到 {{tests}} 以上。
- `fit.reason.far` → 需要 {{options}} 以上，和你目前的成績差距較大。
- `fit.tier.UNCLEAR.title` → 目前差距還比較大
- `fit.tier.UNCLEAR.short` → 還需準備
- `fit.tier.UNCLEAR.lede` → 你目前的成績和公布的條件差距較大。建議多預留一些準備時間，之後再來查查看。

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
