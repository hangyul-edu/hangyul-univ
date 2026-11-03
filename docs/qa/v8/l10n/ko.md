# Korean (ko) — V8 synthetic review record

> **Synthetic review by an AI model — not a human review.** No native-speaker or professional linguist has signed off on
> this locale. The status `SYNTHETIC_REVIEWED` means only what is written below.

| | |
|---|---|
| Date | 2026-10-09 |
| Reviewer | AI model (Claude), V8 localization workstream |
| Status after review | `SYNTHETIC_REVIEWED` |
| Personas | **Ji-hye** — a Korean admissions officer at a regional national university (checks admissions terminology, accuracy of requirements, nothing that over-promises); **Minh** — a Vietnamese applicant who studied Korean to TOPIK 4 and uses the app in Korean (checks clarity, tone, whether a learner understands it) |
| Method | Every string in scope printed side by side with English (`node scripts/i18n/v8-data/_review-sample.mjs ko`) and read in full against the rubric below. Brand and term frequency checked across all ko namespaces with grep; canonical brand checked against Hangyul's live Korean copy (`/root/hangyul-web/messages/ko.json`, read-only). |
| Scope (sample) | **416 / 416** strings: common (actions, states, nav, degree, tier, eligibility, matchReason, docStatus, time, i18n banner, no-guarantee footer), student discover / budget / compare / nav / V8 keys, marketing hero / quick check / `v8`. Plus a repo-wide brand-name sweep over all 11 ko namespaces. |

## Rubric

1. **Accuracy** — same meaning as English; numbers, placeholders and conditions intact.
2. **Naturalness** — reads as written Korean, not translated English.
3. **Terminology** — one term per concept; eligibility words follow `docs/STATE_MAP.md` "Eligibility vocabulary" (Strong / Possible / Needs your grades / Not eligible yet; missing information is never shown as ineligibility).
4. **Tone** — polite, calm and direct; no pressure.
5. **Truncation risk** — chips, tabs and buttons stay short.
6. **Honesty** — no stronger claim than English (admission, guarantees, verification, fees).

## Issues found and fixed

| # | Rubric | Where | Problem | Fix |
|---|---|---|---|---|
| 1 | Terminology (brand) | 226 strings across all 11 ko namespaces + `scripts/i18n/{v7-marketing,v8-marketing,v8-student}.mjs` | The brand appeared as **한귤** (common, mobile, most of marketing) and **한결** (student, agency, university, success, concierge, visaroute, writing, dossier, V8 marketing). "Hangyul" romanizes 한귤 (*gyul*), and Hangyul's own Korean product copy uses only 한귤 (18×, 0× 한결). 한결 is also an ordinary adverb, so it reads as a different word. No adverbial use of 한결 existed, so the replacement is safe; the particles do not change because both words end in ㄹ. | All 한결 → 한귤 in ko JSON and in the three generator scripts, so re-running them does not bring it back. |
| 2 | Terminology (eligibility) | `student:discover.verdict.reach` | "Possible match" was rendered **확인 필요** ("needs checking"). That collides with the V8 "Needs your grades" group (성적 필요), the very thing STATE_MAP keeps separate: missing information vs. a real result. | → **가능성 있음** |
| 3 | Terminology | `student:discover.verdict.eligible`, `marketing:quick.tier.STRONG`, `common:tier.STRONG` | "Strong match" had three renderings: 적합 / 요건 충족 / 적합도 높음. | Unified to **적합도 높음**. |
| 4 | Terminology | 7 student V8 keys (`discover.emptyVerdict.check`, `otherDegree_*`, `confirmEducation.title_*`, `more.hint.universities`, `v8.compare.open`, `v8.compare.budget_other`, `v4.verdictText.check`) | "Program" rendered as 과정, while the rest of the student app uses 프로그램 (118× vs 33×, and 과정 there mostly means *degree course*, e.g. 학사 과정). | → 프로그램 (in `scripts/i18n/v8-student.mjs`, then re-run). |
| 5 | Terminology (admissions) | `student:budget.line.application_fee`, `budget.beforeArrivalHint` | "Application fee" = 지원비 here but 전형료 in compare. Ji-hye: 전형료 is the term universities print in their admission guides. | → 전형료 in both. |

## Checked and kept (no change)

- Admissions terms used correctly: 표준입학허가서 (standard admission letter), 아포스티유 / 영사확인, 편입, 석박사 통합, 한국어 연수과정, 전문학사.
- Honesty: `footer.noGuarantee` ("제휴 프로그램의 서면 조건이 없는 한 … 합격을 보장하지 않습니다"), `quick.disclaimer` ("합격 가능성 예측이 아닙니다"), `budget.tuitionNote` and the V8 service-fee lines all say exactly what English says — not more.
- V8 "Needs your grades" copy (`confirmEducation.text`: "지원 자격이 없다는 뜻이 아닙니다") correctly says missing data is not a verdict.
- Placeholders and plural keys: `validate-locale.mjs ko` passes.

## Residual risks

- **Register mix.** Student copy mixes 해요체 (compare, v4) and 합니다체 (discover, budget, V8). Both are polite and natural in product UI, but a single register would read more consistently. Not changed: it touches several hundred strings that other workstreams own.
- `marketing:quick.unlock_*` keeps the 을(를) particle fallback because `{{level}}` is inserted at runtime. It is correct but mechanical.
- `common:tier.COMPETITIVE` (경쟁 가능) is still used by the consoles. The student surfaces now say 가능성 있음, which matches STATE_MAP.
- Strings outside the 416 sampled here (agency, university, success, concierge, writing, visaroute, dossier) were only swept for the brand name, not reviewed against the rubric.
- **A human Korean reviewer is still needed** before this locale could ever be marked `HUMAN_REVIEWED`.
