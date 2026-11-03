# Japanese (ja) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `ja`
- Status: NOT human-reviewed. Do not set `status` to `HUMAN_REVIEWED` on the basis of this record.
- Leak check (step 4): not run by this agent. The coordinator runs it.
- Register: polite です／ます throughout. Short UI labels and buttons use plain noun or dictionary forms (「アップロード」, 「書類を開く」), as Japanese apps usually do.

## Scope

- Merged: `scripts/i18n/v9-data/ja-1.json` … `ja-7.json` (2,555 todo keys: common 93, student 597, dossier 180, writing 117,
  success 288, visaroute 484, concierge 460, mobile 336), plus `ja-8.json` (7 revisions from this review).
- New namespace files: `ja/dossier.json`, `writing.json`, `success.json`, `visaroute.json`, `concierge.json`.
- Result: `v9-todo ja` → web 3,560 keys, 0 missing, 0 identical, 0 stale. `--native` → 4,054 keys, 0 missing.
- Values that stay the same as English are only allowed tokens: placeholders, `$t()` nesting, brand and app names
  (Hangyul, LINE, WhatsApp, Telegram, Zalo), test names (TOPIK, IELTS, TOEFL iBT), GPA, NHIS, HiKorea, visa.go.kr, airport codes.
  No `_identical_ok` entries were needed.

## Sample read

I read every todo key with its screen in mind. I spent the most time on:

- Money and payment safety: `student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `success:submission.fee.*`,
  `mobile:v3.offer.tuitionDirect`. Parents (C and D) read these screens.
- Family link and sponsor page: `student:v9.family.*`, `v9.sponsor.*`.
- Visa route (`visaroute:*`): methods, caveats, document names, when to get time-limited papers, and posts (在○○韓国大使館／総領事館).
- Legalization: `student:legalFlow.*`, `dossier:*` (apostille vs. consular legalization, notarization, certified translation).
- Submission authorization: `success:submission.authorize.*` (who submits, consent, withdrawal, never sharing a portal password).
- Arrival: `concierge:*` (residence card 90-day rule, NHIS, lease check disclaimer, emergency numbers 119 and 112).
- Verdict strings (`student:verdict.*`, `start.tier.*`, `success:group.*`, `mobile:v3.match.*`, `v3.quick.tier.*`), checked against
  docs/STATE_MAP.md and the existing ja strings (`discover.verdict.*`, `matches.tierText.*`).

I took no screenshots, because browsers are off for translator agents. The coordinator's leak-check run is the screen-level check.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 4 / 5 / 4 / 5 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 5 / 4 / 5 / 5 / 5 | 5 / 4 / 5 / 5 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 4 / 3 / 5 | 5 / 4 / 5 / 4 / 5 |
| D. Parent 50–65, low digital confidence | 3 / 4 / 4 / 4 / 5 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Scores below 4 before revisions:
- C, action clarity 3: the Hangyul fee status "Due" was 「未払い。」. That reads as an overdue debt, not "payment is due now".
- D, comprehension 3: the tuition filter 「最大 ₩{{amount}}M」 uses "M" for millions, which older Japanese readers do not use.
  The tab name 「書類作成」 for *Writing* was also easy to confuse with 「書類」 (*Documents*).

## Issues found and fixed (`ja-8.json`)

| Key | Before → After | Why |
|---|---|---|
| `student:writing.title` | 書類作成 → エッセイ | Was easy to confuse with the Documents tab (書類). Now matches the existing `essays.title`. |
| `dossier:reason.ESSAY_TO_WRITE` | まず「書類作成」で… → まず「エッセイ」で… | Follows the renamed tab. |
| `student:v9.money.note.HANGYUL_FEE_DUE` | 未払い。 → お支払いが必要です。 | "Due" means payment is needed now. 未払い read as overdue. |
| `mobile:v3.discover.upTo` | 最大 ₩{{amount}}M → 最大 {{amount}}百万ウォン | "M" is not a Japanese unit. Kept exact (millions of won). |
| `mobile:v3.journey.of` | · {{total}} 中 {{n}} → · {{n}}/{{total}} | The old string was an awkward literal translation. A fraction is clearer in a compact progress line. |
| `visaroute:track.dateSaved` | {{date}} に{{status}} → {{status}}：{{date}} | Reads correctly with both status values (予約済み／予定). |
| `concierge:pickup.handle` | ID または番号 → ID または電話番号 | Says clearly which contact detail is meant. |

## Terminology (reused from existing ja strings)

| English | ja |
|---|---|
| Strong match | 高い適合 |
| Possible match | 可能性あり |
| Not eligible yet (incl. one step away) | まだ出願資格なし（あと少し） |
| Needs your grades | 成績の入力が必要 |
| Your counselor | 担当カウンセラー |
| Offer / accept the offer | 合格（通知） / 合格を承諾する |
| (Standard) admission letter | （標準）入学許可書 |
| Tuition / application fee | 学費 / 出願料 |
| Apostille / consular legalization / consular confirmation | アポスティーユ / 領事認証 / 領事確認 |
| Notarization / certified translation | 公証 / 認証翻訳 |
| Bank balance certificate / bank statement | 預金残高証明書 / 銀行取引明細書 |
| Family relationship certificate | 家族関係証明書 |
| Residence card | 外国人登録証 |
| Immigration office | 出入国管理事務所 |
| Visa issuance certificate (CCVI) | 査証発給認定書 |
| e-visa | 電子ビザ |
| Sponsor | 経費支弁者（保護者） |
| Agency | エージェント（代行業者 for embassy-accredited visa agencies） |
| Personal statement / study plan | 自己紹介書 / 学業計画書 |
| Waitlisted | 補欠（ウェイティングリスト） |
| Deposit (housing) | 保証金 |

## Residual risks (what a native reviewer should check first)

1. **Korean administrative terms**: 査証発給認定書 (CCVI), the 「優秀」／「認証」／「コンサルティング」 university certification tiers,
   大学の事業者登録証, and 一括申請 for group residence-card filing. These follow Japanese renderings of Korean immigration terms. Check them
   against what Japanese-language Korean embassy pages use.
2. **Money sentences**: `v9.funds.*` (money that must be held vs. statement history, and whose name the account is in), `v9.money.note.NHIS_*`
   and `v9.guard.text`. I checked each one against the English. A parent reviewer should still confirm none of them can be misread.
3. **Word vs. character limits** (`writing:finding.OVER_LIMIT`, `UNDER_LENGTH`, `LONG_SENTENCE`, `prompt.words`): these keep 「語」 (words),
   as the English rule does. Japanese text has no spaces, so the word counter may not suit Japanese essays. This is a product question.
4. **Sentence-embedded placeholders**: Japanese word order puts {{label}}, {{doc}} and {{category}} inside sentences (「{{university}} 用の{{label}}を…」).
   Values that come from other namespaces (document category labels) must also be in Japanese, or the sentences will mix languages.
5. **City and airport names**: Chinese cities use kanji (北京, 青島, 瀋陽…). Others use standard katakana (ラリトプル, ビシュケク).
6. **Staff-voice strings** in student namespaces (`writing:finding.SIMILAR_TEXT`, `common:task.writingEscalation`, `mobile:devAccess.*`)
   are correct, but I scored them less closely.
