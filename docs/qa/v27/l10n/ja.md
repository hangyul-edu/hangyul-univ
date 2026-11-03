# V27 l10n review — ja (Japanese)

Scope: all 729 strings of `scripts/i18n/v27/strings.json` (215 new, 514 changed). The changed strings were translated again from the new English (with the Korean used to settle ambiguity). The old bundle text was not patched. Established product terms were taken from `packages/i18n/locales/ja/` (奨学金, アポスティーユ, 領事認証, 語学堂, プログラム, マッチング結果, エッセイ, 出願, Hangyul Univ チーム).
Output: `scripts/i18n/v27/tx/ja.json`.

## Personas

| Persona | Profile | What they read for |
|---|---|---|
| 美咲（Misaki） | 18, Fukuoka, high-school senior, K-pop fan, applying for a bachelor's after a year at a 語学堂 | plain です・ます that isn't stiff, short buttons, no jargon about D-4/D-2 without explanation |
| 健太（Kenta） | 27, Osaka, mechanical engineer, applying for a master's with TOEIC/TOEFL scores | precise admissions wording (募集要項, 出願資格, 合否), no promise of admission |
| 美咲の母 | 50s, pays tuition and living costs | money and safety copy: 授業料の支払い先, 返金, 残高証明書, 手数料; reassurance without hype |

## Glossary

| English | Japanese |
|---|---|
| scholarship | 奨学金 |
| Global Korea Scholarship (GKS) | 韓国政府招へい奨学金（GKS） |
| admission guide | 募集要項 |
| apostille | アポスティーユ |
| consular legalization (영사확인) | 領事認証 |
| Korean language institute | 語学堂（first use: 語学堂（韓国語教育機関）） |
| Korean language program | 韓国語研修（課程） |
| certificate of admission (표준입학허가서) | 標準入学許可書 |
| CCVI (사증발급인정서) | 査証発給認定書（CCVI） |
| residence card (외국인등록증) | 外国人登録証 |
| immigration office | 出入国管理事務所 |
| embassy or consulate | 大使館・領事館（在外公館 where both are meant generically） |
| D-2 / D-4 visa | D-2 ビザ / D-4 ビザ（D-4-1） |
| application / to apply | 出願 / 出願する (visa: 申請) |
| requirement / eligible | 出願条件 / 出願資格 |
| admission decision | 合否 |
| offer | 合格通知 |
| tuition | 授業料 |
| proof of funds / bank balance certificate | 資金証明 / 残高証明書 |
| counselor / the Hangyul team | 担当カウンセラー / Hangyul チーム |
| program | プログラム (degree-level sense: 課程) |
| Recommended (sort) | おすすめ順 (browsing order, explicitly not a ranking) |
| upload | アップロード |
| Writing (app section) | ライティング |
| My progress / Your progress | 進捗状況 / あなたの進捗 |

## Pass A — meaning (7 strings changed)

Checked every string against EN and KO. Fixed additions and losses:

1. `student:dashboard.stageText.VISA` — 合格おめでとうございます。次は学生ビザです。 → 合格が決まりました。次は学生ビザです。 (removed a congratulation the source doesn't have)
2. `student:essay.statusDone.STUDENT_REVISION` — 再び編集できるようになりました → 再オープンしました。もう一度編集できます (restored "Reopened")
3. `student:budget.scholarshipAlternative` — 選択肢の一つで、重複して差し引いてはいません。 → どちらか一方として計算しています（上乗せはしていません）。 (the old wording was unclear about what is not stacked)
4. `dossier:reason.NEAR_EXPIRY_DATE` — {{date}} に有効期限が切れ、{{university}}の締切に間に合いません。 → {{university}}の締切より前の {{date}} に有効期限が切れます。 (the draft wrongly said it "won't make the deadline")
5. `common:i18n.machine` — …{{percent}}% をカバーしているため… → 翻訳済みはアプリの {{percent}}% のため… (the draft gave a false cause)

Others: `more.subtitle`, `v4.ws.idle.prep`.

## Pass B — native naturalness (15 strings changed)

1. `student:login.subtitle` — …があなたを待っています。 → …はそのまま残っています。 (removed the English-style "are waiting for you")
2. `marketing:home.trust.points.honest.text` — 合格の可能性をでっち上げることは決してしません → 根拠のない合格可能性を示すことは決してありません (too colloquial for the parent persona)
3. `marketing:agenciesPage.valueLede` — 追いかける手間を減らし… → 催促や確認の手間を減らして… ("follow-up work" as Japanese agencies say it)
4. `marketing:v20.city.Gyeonggi.line` — ソウルを囲む道。 → ソウルを取り囲む京畿道。 (a bare 道 reads as "road")
5. `student:v8.compare.noWinner` — 勝者を決めるのではなく… → どれが一番かを決めるのではなく… (勝者 is a calque)

Others: `login.aside.title`, `onboarding.steps.goals.subtitle`, `matches.emptyText.NOT_ELIGIBLE`, `dashboard.nextAction.TASK.text.APPLICATION_SUBMIT`, `fit.lede`, `proof.match.text`, `v6.product.match.text`, `v20.city.Gangwon.line`, `v20.city.Chungnam.body`, `agencyNet.title`.

## Pass C — UI context and brevity (18 strings changed)

1. `common:fit.submit` — 大学を表示する → 自分に合う大学を見る (CTA as Japanese sites write it: 〜を見る)
2. `common:fit.chooseTest` — 試験を選択 → 試験を選択してください (select placeholder convention; same for `fit.gpa.chooseScale`, `fit.chooseLevel`)
3. `common:task.reviewEssay` — …を確認する → …を添削する (matches the established エッセイ添削)
4. `common:nav.journey` — 進捗 → 進捗状況 (same as `student:v7.home.journey`; 「あなたの進捗」 is used for "Your progress")
5. `common:fit.test.TOEFL_IBT` — TOEFL iBT → TOEFL iBT（トーフル） (see "Unsure", the validator's script check)

Others: `fit.levelLabel` (級 → 取得級) and the remaining 9 `fit.test.*` names.
Consistency check: one term each for 奨学金, 募集要項, アポスティーユ, 領事認証, 語学堂, Hangyul チーム, 担当カウンセラー. Labels (`fit.level.*`, `fit.sort.*`, `fit.tier.*.short`) are 2 to 9 characters.

## Final comparison

I compared the full set source to target (EN + KO ↔ ja) after Pass C:
- No string adds a promise of admission or a probability. おすすめ順 is described as a browsing order (`fit.order`).
- Placeholders and `<em>` are intact.
- Plural `_one`/`_other` pairs work for any count.
- The 4 multi-line city texts keep their line break.
- Validator: `node scripts/i18n/v27/validate.mjs --only=ja` → 729 valid, 0 problems.

## Strings I'm unsure of

- **`common:fit.test.*` (10 strings).** The brief says test names stay in Latin script. The validator rejects a ja string that has no kana or kanji. To pass, I kept the official Latin name and added a short gloss in parentheses, e.g. TOEFL iBT（トーフル）, TOEIC（トーイック）, Cambridge English（ケンブリッジ英検）. These labels are also put into sentences such as `fit.unlock` ("TOEFL iBT（トーフル） 80 以上なら…"), where the gloss is clutter. **Recommendation:** allow these keys through the validator and use the bare Latin names.
- `v9.funds.longer_*`: 「コンサルティング」対象. This is a literal rendering of the Ministry of Justice tier label. No established Japanese term exists.
- `v20.uni.why.breadthBody`: 大学アルリミ（Academy Info）. Hangul isn't allowed, so the service name is transliterated.
- `fit.level.ASSOCIATE` 専門学士 and `fit.level.COMBINED` 修士・博士統合. These are Korean degree types with no exact Japanese equivalent.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → 出願時に語学成績は必要ありません。入学後に {{tests}} 以上を取得する必要があります。
- `fit.reason.far` → {{options}} 以上が必要です。今の成績とは大きな差があります。
- `fit.tier.UNCLEAR.title` → 今の成績では距離がある大学
- `fit.tier.UNCLEAR.short` → 準備が必要
- `fit.tier.UNCLEAR.lede` → 今の成績と公表された条件の差が大きいです。準備期間を十分にとって、もう一度確認してみてください。

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
