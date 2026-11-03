# V29 l10n record — ja (Japanese)

Job: `scripts/i18n/v28/jobs-v29/ja.json` (158 keys, 0 existing) → `scripts/i18n/v28/tx-v29/ja.json`.
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=ja` → 158 valid, 0 problems. Not applied.

## Personas
| Persona | Profile | Reads for |
|---|---|---|
| 美咲 (Misaki), 18, Fukuoka (first-time visitor) | high-school senior | plain です・ます, short buttons, clear next step |
| 健太 (Kenta), 27, Osaka (comparison shopper) | comparing Hangyul with 留学エージェント | exact scope: 何校まで, 何回まで, 別途費用 |
| 美咲's parent (payer) | pays in USD | no 合格保証 / ビザ保証 wording, 一括払い clarity |

## Glossary (consistent with the V28 ja glossary)
| English | Japanese | Note |
|---|---|---|
| Basic / All-in-One / Premium | Basic / All-in-One / Premium | Latin |
| the Hangyul Univ team | Hangyul Univ チーム | never 担当カウンセラー |
| your team | 担当チーム | |
| consultation | 相談 / カウンセリング | 留学診断カウンセリング for the diagnostic |
| follow-up | フォローアップ | |
| recommended universities | ご提案する大学・語学堂 / 最大N校をご提案 | |
| managed applications | 出願管理 / 最大N校の出願を管理 | distinct from ご提案 |
| apply / application | 出願 (visa: 申請) | V28 term |
| editing (첨삭) | 添削 | |
| round | 回 | |
| no round limit within contracted documents | 契約した出願書類の添削は回数制限なし / 契約書類の範囲内で回数制限なし | never 無制限 |
| statement / study plan | 志望理由書 / 学業計画書 | |
| mock interview | 模擬面接 | |
| dormitory | 寮 | V28 term |
| alternative accommodation | 代わりの住まい | |
| airport pickup arrangement | 空港送迎の手配 | 提携する送迎会社の手配 |
| custom quote | 個別見積もり | |
| additional service | 追加サービス | |
| settling in | 生活立ち上げ | |
| Korean language institute | 語学堂 | as in common.json kli |
| contract term | 契約期間 | |
| service period | サービス期間 | |
| priority response | 優先対応 | |
| dedicated team | 専任チーム | |
| application fee | 選考料 | V28 term |
| tuition | 授業料 / 学費 | 学費 on cards, 授業料 in fee list |

## Pass A — meaning vs Korean (6 changed)
- premium.f3: "添削無制限" → "契約した出願書類の添削は回数制限なし".
- premium.f2: "3校に出願" → "最大3校の出願を管理".
- addon.item.airport_pickup: "空港送迎" → "空港送迎の手配"; pickupNote: "送迎します" → "提携する送迎会社の手配をお手伝いするサービスです".
- notes.visaDecision: "ビザ取得をサポート" → "準備と申請手続きのお手伝いです。発給の可否は担当機関が判断します".
- compare.value.settlement: "到着前後{{count}}日" → "入国{{before}}日前から入国後{{count}}日まで" (both bounds).
- addon.item.extra_application: "追加出願" → "出願管理の追加（1校）" (관리 kept).

## Pass B — naturalness (5 changed)
- addOn.decline: "いいえ、結構です" → "今回は見送る" (softer, common on JP sites).
- addOn.noPressure: dash removed → "お断りいただいても、現在のプランはそのまま続きます。".
- why.s3.title: "公正な価格" → "納得の料金".
- basic.position: "〜したい学生向け" → "〜したい方に".
- addOn.failed: "失敗しました" → "処理できませんでした。少し時間をおいて、もう一度お試しください。".

## Pass C — UI brevity (4 changed)
- compare.value.mockIncluded: "{{count}}回が含まれます" → "{{count}}回込み".
- mobile unrationed.CONTRACTED_DOCUMENTS shortened to "契約書類内で回数制限なし".
- compare.value.places: "最大{{count}}校" (unit added, as Korean 곳).
- "宿舎/寮" unified to 寮.

## Marketing scorecard
| Section | Score |
|---|---|
| v29.why.s1 | 5+5+5+4+4+5 = 28 |
| v29.why.s3 | 5+5+4+4+4+5 = 27 |

## Unsure
- 生活立ち上げ vs 生活スタート/定着支援; chose 生活立ち上げ (common in 留学 services).
- "1校" unit for UNIVERSITY when the item is a language institute.

## Counts
Job keys 158 · kept verbatim 0 · rewritten 0 · newly translated 158 · extra plural forms 0 (ja has only other; `_one` given the same text).

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
