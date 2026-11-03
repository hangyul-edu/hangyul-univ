# V31 locale review: Japanese (ja)

Reviewer: synthetic native-quality reviewer (ja), following `docs/qa/v31/l10n/BRIEF.md`, `GLOSSARY.md` and
`docs/SERVICE_CATALOG_V29.md`. Register: polite です・ます of a Japanese 留学サポート service.
Output: `scripts/i18n/v28/tx-v31/ja.json` (1,729 keys) · glossary `docs/qa/v31/l10n/glossary/ja.json`.

## Counts

| | Keys |
|---|---|
| Reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,464 (incl. 90 V31-flagged keys whose existing Japanese already matched the new source after re-translation) |
| Rewritten | 265 |
| · meaning | 24 |
| · naturalness | 64 |
| · quality / UI role | 8 |
| · terminology | 30 |
| · new V31 source | 139 |

`current` was null for 2 keys (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`); both written new.
No extra CLDR plural forms are needed for Japanese (`_other` only).

### Terminology decisions applied across all keys
- 자기소개서 = **自己紹介書** everywhere (pricing used 志望理由書, documents used 自己紹介書; unified). 학업계획서 = 学業計画書.
- Document review = **書類チェック** (not 審査, which implies an official assessment; not 修正, which implies Hangyul edits).
  Output of a review = 修正点のご案内.
- Recommended institutions = **おすすめの大学・語学堂** (never 推薦, which reads as an admission recommendation).
  Managed application = **一緒に管理する出願** (出願管理).
- Support window = **相談後のお問い合わせ期間**; consultation = 相談 (カウンセリング/通話 removed; no "time" wording).
- Student-facing team = **Hangyul チーム** where the source says "Hangyul team"; "Hangyul Univ チーム" only where the source says so.
  Brand always Latin (ハンギュル removed).
- Settlement = 生活立ち上げサポート (定住 removed); sponsor = 経費支弁者 (スポンサー removed); 영사확인 = 領事認証.
- "あなた/あなたの" translationese reduced to ご自身・ご本人 or dropped.

## Critical semantic issues found in `current`

| Key | Said | Now says |
|---|---|---|
| `common:v29.pricing.all_in_one.f5` | ビザ書類の準備 · 寮の申込期限を管理 | ビザ申請書類の準備サポート · 寮の申込日程を管理 |
| `common:v29.pricing.compare.row.support` | 相談サポート期間 | 相談後のお問い合わせ期間 |
| `common:v29.pricing.compare.scopeNote` | Premium の添削は、契約した出願書類と出願スケジュールの範囲内で回数制限なくご利用いただけます。 | Premium の添削は、契約した出願書類とスケジュールの範囲内で回数制限がありません。新しい書類の作成、翻訳、公証は含まれません。 |
| `common:v29.pricing.compare.value.documents.INTENSIVE` | 集中チェック・修正 | 徹底した書類チェックと修正点のご案内 |
| `common:v29.pricing.compare.value.supportTerm` | 契約期間中いつでも | 契約期間中 |
| `common:v29.pricing.compare.value.visa.GUIDANCE` | 手続きのご案内 | 国籍別の手続きのご案内 |
| `common:v29.pricing.notes.visaDecision` | ビザサポートは準備と申請手続きのお手伝いです。発給の可否は担当機関が判断します。 | ビザについては、書類の準備と申請手続きをお手伝いします。発給の可否は出入国管理当局が判断します。 |
| `common:v29.pricing.premium.f4` | ビザ日程の集中管理 · 寮の申込サポート | ビザ書類と主要日程を集中管理 · 寮の申込サポート |
| `common:v29.pricing.premium.position` | 出願からビザ、入国、韓国での最初の数週間まで任せたい方に | 出願からビザ、入国、韓国での最初の数週間までサポートを受けたい方に |
| `concierge:step.pickup.sub` | 到着ロビーでお出迎えします | 提携先の送迎担当者が到着ロビーでお出迎えします |
| `marketing:v11.faq.q4.q` | 韓国語がわからなくても準備できますか？ | 韓国語が話せなくても出願できますか？ |
| `marketing:v11.faq.q6.a` | どの大学も外国人留学生向けの奨学金を用意していますが、金額と採用条件はそれぞれ異なります。 | 多くの大学が用意していますが、金額や条件は大学によって異なります。 |
| `marketing:v11.services.s1.text` | あなたの力と目標にぴったり合う大学と語学堂をご提案します。1対1の個別相談で奨学金制度まで丁寧にご案内し、出願書類の準備から大学とのやり取りまで、すべての過程を私たちが担います。 | 成績や目標に合った大学と語学堂をご提案します。1対1の相談では応募できる奨学金も一緒に確認し、書類の準備や大学とのやり取りもサポートします。 |
| `marketing:v11.why.s3.text` | 費用の心配をせずに韓国留学を始めてください！Hangyul は無理のない価格で質の高いサービスを提供し、充実した留学生活をお約束します。コストパフォーマンスの高さで、これまでとは違う留学サポートを体験してください。 | 費用の心配をせずに韓国留学を始められます。Hangyul は手頃な価格で丁寧なサポートを提供し、お支払い前にプランの内容を正確にご確認いただけます。 |
| `marketing:v12.privacy.collect.counselling.purpose` | 留学相談、書類・文章の添削、出願の進行管理、カスタマーサポート | 留学相談、書類チェック、出願の進行管理、カスタマーサポート |
| `marketing:v12.terms.refunds.stage.RECOMMENDATION_DONE` | 大学推薦完了 | おすすめ大学のご提案完了 |
| `marketing:v12.terms.refunds.stage.RECOMMENDATION_STARTED` | 大学推薦作業開始 | おすすめ大学の選定開始 |
| `marketing:v12.terms.services.documents` | 出願書類の準備と審査 | 出願書類の準備サポートと書類チェック |
| `marketing:v20.uni.intl.admissionsLine` | 留学生の入試は、国内入試とは別のページで案内しています。 | 留学生向けの入試を国内入試とは別に設けています。 |
| `student:phase.prepare.text` | 書類をそろえて確認を受け、Hangyul Univ チームと一緒に自己紹介書と学業計画書を作成します。 | 書類をそろえてチェックを受け、Hangyul チームのフィードバックを受けながら自己紹介書と学業計画書を書きます。 |
| `student:register.privacyNote` | 書類や個人情報は、あなたが選んだカウンセラーと大学にのみ共有されます。データはいつでもエクスポート・削除できます。 | 書類や個人情報は、担当の Hangyul チーム（提携エージェントを含む）と、ご自身が選んだ大学にのみ共有されます。データはいつでもエクスポート・削除できます。 |
| `student:v15.services.scope.consultation` | カウンセリング時間 | 相談 |
| `student:v4.ws.team.final` | 最終確認のあと、{{university}} に出願を送ります | {{university}} に提出する前の最終確認（提出はご自身で行います） |
| `visaroute:rail.admission` | 入学 | 合格 |

Also corrected while re-translating V31 sources (old text contradicted the new source):
- `marketing:v11.why.s3.text`: promised a successful study life (充実した留学生活をお約束します) → scope shown before payment, no promise.
- `marketing:v11.services.s1.text`: "すべての過程を私たちが担います" (we take charge of everything) → we suggest, help prepare.
- `marketing:v11.faq.q6.a`: "どの大学も…用意しています" (every university) → 多くの大学.
- `dossier:page.summary`: added a claim not in the source (ready for every application) → {{ready}} of {{total}} ready.
- `student:v15.services.allowance.key.max_recommended_institutions` / `max_managed_applications`: 提案する学校 / 出願校の管理 → おすすめの大学 / 一緒に管理する出願 (kept the two fields distinct).
- `student:v15.services.allowance.unlimited`: "いつでも相談" without scope → サービス期間中は.
- `marketing:v12.terms.universityInfo.p`: contained Hangul (대학알리미) → 大学情報公示サイト（大学アルリミ）.
- `student:v15.services.scope.consultation`: カウンセリング時間 (V15 minutes semantics) → 相談.

## Marketing scorecard (after rewrite)

CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY, each /5.

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Services rows (`v11.services.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Pricing: plan cards + comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (`v29.addon.*`, `v29.pricing.notes.*`, `v31.pricing.notes.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`, `v20.uni.cta*`) | 5 | 5 | 4 | 5 | 5 | 5 | 29 |
| Directory / discovery (`v12.directory.*`, `v20/v21/v24.dir.*`, `v20.uni.*`, city copy) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |

All areas ≥ 26/30. Pricing naturalness held at 4 because comparison cells stay terse noun phrases by design.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | AC | SA | N | C | B | Fixes |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 5 | 5 | 4 | あなたの○○ → 出願一覧/進捗状況; team name unified |
| Applications | 5 | 5 | 4 | 5 | 4 | final-check row no longer says Hangyul submits; 出願状況 label |
| Documents | 5 | 5 | 5 | 5 | 4 | summary meaning; 保管中 count; ご確認いただくまで |
| Services | 5 | 5 | 4 | 5 | 4 | recommended vs managed fields; support term scope; no "time" |
| Visa / housing | 5 | 5 | 5 | 5 | 4 | apostille + 領事認証 named; pickup partner; 経費支弁者 |

## Unresolved ambiguity (source unclear, not guessed)

- `marketing:v11.faq.q1.a` item 4: "If a parent has no passport, a copy of their ID card, translated into English and notarized" (KO says 외국 여권). Translated as "passport", following EN.
- `common:fit.tier.CHALLENGE.short` "Worth a look" vs KO 도전 가능 ("can challenge"): kept 検討の価値あり (EN), avoiding the forbidden reach/ambitious sense.
- `marketing:v12.terms.refunds.stage.ESSAY_REVIEW_DELIVERED` "Essay or study plan" (KO 에세이·학업계획서): rendered as 自己紹介書・学業計画書, assuming "essay" = personal statement.
- `common:fit.level.ASSOCIATE` 전문학사: 準学士 chosen; Korean "専門学士" is also seen in Japanese sources.

## Validator

`JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=ja` → `V28 l10n (1 locales): 1729 strings valid, 0 problems` (exit 0). Not applied.

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`
