# V28 l10n review — ja (Japanese)

Scope: all 354 keys of `scripts/i18n/v28/jobs/ja.json` (231 with no current translation, 123 with an existing one). The English is the source, the Korean was used to settle ambiguity, and the V27 glossary (`docs/qa/v27/l10n/ja.md`) was reused.
Output: `scripts/i18n/v28/tx/ja.json`. There are no `fit.test.*` keys in this job.

## Personas

| Persona | Profile | What they read for |
|---|---|---|
| 美咲 (Misaki), first-time visitor | 18, Fukuoka, high-school senior, lands on a university page from search | plain です・ます, short buttons, no unexplained D-2/D-4 jargon, a clear next step |
| 健太 (Kenta), comparison shopper | 27, Osaka, engineer comparing Hangyul with agencies for a master's | precise admissions terms (募集要項, 出願条件, 合否), no promise of admission, pricing he can compare |
| 佐藤さん, agency counselor / university admissions staff | uses the agency and university consoles daily | concise labels, one term per concept, standard Japanese business UI wording |

## Glossary (V27 terms reused; V28 additions marked +)

| English | Japanese |
|---|---|
| Hangyul Univ / Hangyul | Hangyul Univ / Hangyul (Latin, never ハンギュル) |
| the Hangyul team | Hangyul チーム (never 担当カウンセラー) |
| admission guide | 募集要項 |
| requirement / entry requirements | 出願条件 (university console: 入学要件) |
| minimum (published) | 最低条件 |
| application / to apply | 出願 / 出願する (visa, residence card: 申請) |
| admission decision | 合否 |
| offer | 合格 / 合格通知 |
| enrollment | 入学 / 入学手続き |
| intake (+) | 募集学期 |
| international seats (+) | 留学生定員 |
| application fee (+) | 選考料 |
| apostille | アポスティーユ |
| consular legalization | 領事認証 |
| legalization (document column, +) | 認証（アポスティーユ・領事認証） |
| Korean language program | 韓国語研修課程 |
| Global Korea Scholarship (GKS) | 韓国政府招へい奨学金（GKS） |
| scholarship | 奨学金 |
| residence card | 外国人登録証 |
| international office | 国際交流担当部署 |
| proof of funds | 資金証明 |
| dormitory | 寮 |
| task (+) | タスク |
| consultation / meeting record (+) | 相談 / 面談記録 |
| post (diplomatic, +) | 公館 |
| Writing (section) | ライティング |
| Needs more preparation (far tier) | もう少し準備が必要な大学 (never 挑戦校 or a probability word) |
| Recommended (sort) | おすすめ順 (browsing order only) |
| pipeline (+) | 選考状況 |

## Pass A — meaning (19 strings changed)

1. `common:fit.tier.CHALLENGE.title` — 検討してみる価値がある大学 → Hangyul との確認が必要な大学 (the old text suggested "worth a shot", but the source means "not verified, needs checking")
2. `common:fit.tier.CHALLENGE.lede` — 分かっている範囲で出願できない理由はありません… → この課程の出願条件を Hangyul がまだ確認できていない大学です。一緒に確認します。 (the English was rewritten in V28)
3. `common:fit.tier.UNCLEAR.title` — 今の成績では距離がある大学 → もう少し準備が必要な大学 (follows the brief's "needs more preparation")
4. `student:scholarships.empty` — 表示できる奨学金はまだありません。 → …プロフィールを入力すると、自分に合う奨学金を確認できます。 (the second sentence was missing)
5. `student:v9.money.note.RESIDENCE_CARD_90_DAYS` — 90日を超えて滞在するすべての人が… → 90日を超えて滞在する場合。到着から90日以内に申請します。 (now matches the current English)

Others: `fit.tier.MEETS.lede` and `ONE_STEP.lede` (dropped clauses the English no longer has), `UNCLEAR.lede`, `task.visa.other_passport_record` (記録 → 発給記録), `doc.other_passport_record.name`, `pickup.handle` (on that app), `v22.stageHint.decision` (こちらの → 合否の), `kpi.insufficientDetail`, `v22.manage.teamManage` (departing, not departed), `v25.in.yield`, `v26.now.owner.STUDENT`, `success:group.possible`, `v9.announced.rule.STUDY_DEPOSIT_SCHEME` (韓国語能力のない → 韓国語試験の成績がない), `v15.pricing.premium.f5` (removed an online orientation the source doesn't mention).

## Pass B — native naturalness (16 strings changed)

1. `student:v16.pay.chooseSubtitle` — ハンギュルにどこまで一緒にやってほしいか… → Hangyul にどこまでサポートしてほしいかで… (the brand stays Latin, and the wording is less colloquial)
2. `concierge:housing.honest` — 物件情報を作り上げることはありません → 架空の物件を載せることはありません (作り上げる is a calque of "invent")
3. `marketing:v20.city.Busan.body` — 小さなソウルのようには感じられません → 「小さなソウル」とはまったく違う街です (removed an English-style negation)
4. `marketing:v20.uni.ctaTitle` — 本格的に検討してみませんか？ → この大学への出願を考えていますか？ (matches the English question and page context)
5. `marketing:v6.unis.title` — 旅をする価値のある大学。 → 韓国全土の大学から。 (the English changed, and the old line was a calque)

Others: `seo.home.description`, `housing.p2`, `pricing.lede`, `Gyeonggi.body`, `Seoul.body`, `intlTitle`, `whyTitle` (この大学の特色), `dormitoryBody`, `ieqasBody`, `journey.eyebrow`, `profileV3.why.goals`.

## Pass C — UI context, brevity, one term per concept (46 strings changed)

1. `concierge:help.route.*` (5), `success:owner.counselor`, `visaroute:help.contact` — 担当カウンセラー → Hangyul チーム (the team identity rule)
2. `dossier:reason.ESSAY_TO_WRITE` — まず「エッセイ」で書いてください → まず「ライティング」で書いてください (the section name)
3. `visaroute:form.source.missing` — Hangyul にはありません → 未登録 (a short status label)
4. `marketing:v15.pricing.compare.row.dormitory` / `student:v15.services.scope.dormitory_support` — 寮のサポート → 寮 (the English is now just "Dormitory")
5. `visaroute:step.apply.title` — 申請して記録する → 申請して受付番号を記録する (says what is recorded)

Others: every remaining カウンセラー string in dossier, visaroute and concierge (→ Hangyul チーム), `caveat.title` (now a heading rather than a sentence), `help.who` (担当), `slow_items.*`, `university_papers.title`, `academicTitle` (学科 → プログラム), `why.language`, `review.verifyHint`, `catalogHint` (要件 → 出願条件), `discover.why`, `settings.language.note`, `NHIS_D2`, `visaToEnrol` (取得 → 発給), `popEnrol`, `sponsor_documents.why`, `other_training_plan.name`, `residence.useGroup`, `check.title`, `step.apply.why`.
New strings use these terms throughout: 出願 for applications, 申請 for visas, タスク, 募集学期, 留学生定員, 課程 (university console), プログラム (student side).

## Final comparison

I compared every string source to target (EN + KO ↔ ja) after Pass C:
- No string implies a chance of admission. `fit.summary.basis` says 合否の予測ではありません.
- 領事認証 and アポスティーユ are used consistently. "Consular confirmation" never appears.
- GKS is 韓国政府招へい奨学金（GKS）.
- Placeholders are intact, and the city bodies keep their line breaks.
- Validator: `node scripts/i18n/v28/validate.mjs --only=ja` → 354 valid, 0 problems.

## Marketing scorecard (30 points: clarity / trust / naturalness / brevity / CTA strength / cultural fit)

| Section | Before | After |
|---|---|---|
| seo.home | 4/4/3/3/3/4 = 21 | 5/5/5/4/4/5 = 28 |
| v15.pricing (lede, compare, premium.f5) | 4/3/4/4/4/4 = 23 | 5/5/5/5/4/5 = 29 |
| v20.city (Busan, Gyeonggi, Seoul, Gyeongnam) | 4/4/3/3/4/4 = 22 | 5/5/5/4/4/5 = 28 |
| v20.uni (cta, why.*, intl, philosophy, office) | 4/4/3/4/3/4 = 22 | 5/5/5/5/5/5 = 30 |
| v28.uni.why (english, gks, scholarships) | new | 5/5/5/5/4/5 = 29 |
| v6.unis / journey / v12 / v23 / v24 / v10 | 3/4/3/5/3/4 = 22 | 5/5/5/5/4/5 = 29 |
| v9.faq.languagesA | new | 5/5/4/4/4/5 = 27 |

## Strings I'm unsure of

- `university:documents.legalization` is 認証（アポスティーユ・領事認証）. The Korean 공증·인증 covers notarization too, so the gloss may be too narrow for a column header.
- `university:v28.pipe.title` and `label` use 選考状況と結果 for "Pipeline". Admissions offices might prefer the katakana パイプライン.
- `agency:v9.ops.slaRisk_other` keeps "SLA" in Latin, which agency staff may or may not use.
- `marketing:v20.city.Seoul.line` says 主要な研究大学 for "research universities". The figure itself was not checked.
- `marketing:v20.uni.why.ieqasExcellent` is IEQAS 優秀認証. No official Japanese name exists.

## Counts

| Job keys | Kept verbatim | Rewritten | Newly translated |
|---|---|---|---|
| 354 | 42 | 81 | 231 |

## Second pass (jobs2)

Input `scripts/i18n/v28/jobs2/ja.json` (leak families: student workspace waiting lines, success blockers and submission queue,
dossier facts/upload, agency workspace and readiness blockers, university outcomes and empty states). Output
`scripts/i18n/v28/tx2/ja.json`. Same personas and glossary as above (Hangyul チーム, 募集要項, 出願, 選考料, 募集学期, 領事認証,
アポスティーユ, タスク, 選考状況). New terms: 委任 (student authorization for agency submission), 受付番号 (reference /
confirmation no.), 受付票 (receipt), 書類一式 (package), 標準入学許可書 (standard admission letter), 書類保管庫 (vault).

- Pass A meaning: 14 strings changed (e.g. HANDED_OFF, "Stopped", fixture rows, "We act" kept as agency-side 当社).
- Pass B naturalness: 22 strings changed (passive/English-order lines recast; です/ます for student strings).
- Pass C UI/brevity/one term: 31 strings changed (status chips shortened; 審査 vs 確認 split: university/document review = 審査,
  portfolio/guide check = 確認; 提出待ち used for every "Ready to submit" queue label).
- Marketing scorecard (`v20.uni.intl.*`, 2 keys): clarity 5, trust 5, naturalness 4, brevity 4, CTA 4, cultural fit 5 = 27/30.

Examples (source → target):
1. `student:workspace.next.review` Your application is with the university → 大学が出願書類を審査しています
2. `success:status.HANDED_OFF` On the portal, no confirmation yet → ポータルで手続き中・未確認
3. `success:agencyItem.DOC_LEGALIZE` {{label}} — consular legalization pending → {{label}}：領事認証待ち
4. `agency:v15.readiness.blocker.document_legalization` {{detail}} needs an apostille or consular legalization → {{detail}}にアポスティーユまたは領事認証が必要
5. `university:outcomes.step.RETAINED` Retained → 在籍継続

Unsure:
- `dossier:upload.status.NEEDS_REVIEW/UPLOADED/NEEDS_CORRECTION`: English is empty (status word deliberately omitted); ja needs a
  word because `{{status}}の{{doc}}` would otherwise start with a bare の. Used 確認待ち / アップロード済み / 修正が必要.
- `success:queue.fixture` "Fixture" → テスト用 (Korean says 개발용); staff-only label.
- `agency:v27.party.agency` "We act" → 当社が対応; an agency may prefer 担当者が対応.
- `success:method.AUTHORIZED_AGENCY` → 委任を受けたエージェンシー; English uses British "Authorised".
- Validator reports `success:agency.questions.too_few` as "plural form without too_other": the key name ends in `_few`, so the
  EXTRA-plural check misfires on a real job key. Translation is present and valid; not fixable from the tx side.

| Job keys | Kept verbatim | Rewritten | Newly translated |
|---|---|---|---|
| 532 | 0 | 0 | 532 |

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
