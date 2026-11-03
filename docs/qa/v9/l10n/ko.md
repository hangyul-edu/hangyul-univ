# Korean (ko) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), review agent for `ko` (PIPELINE.md step 5 only)
- Status: NOT human-reviewed. Do not set `status` to `HUMAN_REVIEWED` on the basis of this record.
- Starting point: web manifest 100 % (3,560 keys), leak check already recorded. After the revisions: `v9-todo ko` → 0 missing, 0 identical, 0 stale.
- Brand: 한귤 (never 한결). No 한결 is found anywhere in `ko/*`.
- How the fixes were applied: `v9-merge.mjs` refuses ko edits, and `--ko-add-missing` only adds keys that are absent. So the fixes were written directly into `packages/i18n/locales/ko/student.json`
  with a small script. The script re-read the file right before writing and changed a value only if the current value was exactly the one reviewed. It checked that placeholders were the same and that 한결 was not used, and it kept the existing 2-space JSON format. No other values or files were touched.

## Sample read

- All `student:` and `common:` keys under `dashboard.*`, `home.*`, `start.*`, `discover.*`, `documents.*`, `workspace.*`, `budget.*`,
  `visa.*`, `v4.*`, and `v9.*` (money, funds, guard, refund, family, sponsor, routes, announced, visa caveats), plus `common:v9.l10n.*`: 923 strings, read side by side with the English.
- Verdict vocabulary across the locale (`verdict.*`, `discover.verdict.*`, `common:tier.*`, `start.tier.*`).
- Targeted greps across `success`, `visaroute`, `concierge` and `dossier` for fees, refunds and guarantees, plus a scan of the whole locale for Latin fragments of 2 or more words and for the brand.
- Screens: `shots/picker-ko-1440.png` (language picker and settings) and `shots/scholarships-ko-1440.png` (scholarships). I did not run a browser.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 3 / 4 / 4 / 4 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 4 / 4 / 3 / 4 / 5 | 5 / 4 / 5 / 4 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 3 / 3 / 5 | 5 / 4 / 4 / 4 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 4 / 4 / 4 / 4 | 5 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Scores below 4 before revisions:
- A, naturalness 3: the home "next step" card and the home widgets switched between 해요체 and 합니다체 from one card to the next. The greeting and most cards used 해요체, but the PROFILE_UNLOCK, FINISH_APPLICATION, COMPARE_OFFERS and APPLICATION_ITEM texts and five `home.*` sub-lines used 합니다체.
- B, trust 3: *Possible match* had two names. It was `verdict.COMPETITIVE` = 「확인 필요」 (which reads as "needs checking" and is easy to confuse with 「성적 필요」 *Needs your grades*), but `discover.verdict.reach` = 「가능성 있음」. *Strong match* was 「적합」 in the program badges and 「적합도 높음」 in Discover.
- C, trust 3: `home.scholarships_*` said 「받을 수 있는 장학금」 ("scholarships you can get"), but the English says "you **may** qualify".
- C, action clarity 3: the Hangyul fee status "Due" was 「납부 예정」. This reads as "scheduled", not as "payment is needed now".

## Issues found and fixed (36 values in `ko/student.json`)

| Key | Before → After | Why |
|---|---|---|
| `student:verdict.COMPETITIVE` | 확인 필요 → 가능성 있음 | Same STATE_MAP term as Discover. It is no longer confused with *Needs your grades*. |
| `student:verdict.STRONG`, `student:start.tier.STRONG` | 적합 → 적합도 높음 | Same term as `discover.verdict.eligible` and `common:tier.STRONG`. |
| `student:dashboard.recommended.subtitle` | 잘 맞거나 경쟁력 있는 프로그램… → 적합도가 높거나 가능성 있는 프로그램… | Follows the badge terms. |
| `student:v9.money.note.HANGYUL_FEE_DUE` | 납부 예정. → 지금 납부해야 해요. | "Due" means payment is needed now. |
| `student:home.scholarships_one/_other` | 받을 수 있는 장학금 → 받을 가능성이 있는 장학금 | Does not promise more than the English ("may qualify"). |
| `student:home.scholarshipsMeta_one/_other` | 추가 정보가 필요합니다 → 추가 정보가 있어야 확인할 수 있어요 | Register, and the meaning is clearer (we cannot confirm yet). |
| `student:workspace.team` | 담당 상담 → 담당 상담사 | The word was cut off. |
| `student:settingsV3.translation.SOURCE_APPROVED` | 영어는 Hangyul Univ의… → 영어는 한귤의… | Korean brand rule (한귤). |
| `student:dashboard.nextAction.PROFILE_UNLOCK.{education,language,gpa,budget}.{title,text}` (8) | 합니다체 → 해요체 | Same register as the rest of the card. `gpa.text` also restores the dropped "tell you honestly which ones are out of reach" (「지금은 어려운 곳도 솔직하게 알려 드릴게요」). |
| `student:dashboard.nextAction.FINISH_APPLICATION.text(_one/_other)`, `COMPARE_OFFERS.text` | 합니다체 → 해요체 | Register. |
| `student:dashboard.nextAction.APPLICATION_ITEM.{REQUEST,FIX,REVISE_ESSAY,LEGALIZE,RENEW,TOO_OLD,UPLOAD,WRITE_ESSAY}.text` (8) | 합니다체 (LEGALIZE mixed both in one string) → 해요체 | Register. |
| `student:home.documentsSub_one/_other`, `home.profileMeta`, `home.recommendedSub`, `home.closestSub` | 합니다체 → 해요체 | Register on the home page. |

## Terminology (ko)

| English (STATE_MAP / core) | ko |
|---|---|
| Strong match | 적합도 높음 |
| Possible match | 가능성 있음 |
| Not eligible yet (one step away) | 아직 지원 불가 (한 단계 남음) |
| Needs your grades | 성적 필요 |
| Counselor | (담당) 상담사 |
| Offer / accept | 합격 제안 / 합격 수락 |
| Standard admission letter | 표준입학허가서 |
| Application fee / tuition | 전형료 / 등록금 |
| Money you must show (not pay) | 보여 줘야 하는 돈 (내는 돈 아님) |
| Bank balance certificate | 은행 잔고 증명서 |
| Apostille / consular confirmation | 아포스티유 / 영사확인 |
| Residence card | 외국인등록증 |

## Residual risks (what a native reviewer should check first)

1. Register is still mixed by section. Discover, budget and workspace use 합니다체, while home, dashboard, documents and v4 use 해요체. I only aligned the home and dashboard cards. A native writer should choose one register for each screen.
2. `common:tier.COMPETITIVE` = 「경쟁 가능」 and `common:tier.REACH` = 「도전」 are older tier names, not the STATE_MAP terms. Check where they are still shown (agency or legacy screens).
3. Server data in English shows on the ko scholarships screen: provider 「Hangyul Univ (partnership-funded)」 from `server/app/seed/run.py`, and English scholarship names. This should be reported to the catalogue/seed owner. It is not an i18n key.
4. `settingsV3.translation.SYNTHETIC_REVIEWED` shows as a raw key in `picker-ko-1440.png`. The key now exists in ko, so the screenshot is probably older than the strings. A fresh leak-check run should confirm this.
5. The English key `student:start.title` / `start.subtitle` is shared by the public quiz and the start-application dialog. The dialog shows the quiz title, and this needs a fix by the en or feature owner.
6. Feature agents own `ko/*`. A later edit of en+ko by a feature agent could bring back the old wording, so they should be told about the verdict terms and the 해요체 choice for home cards.
