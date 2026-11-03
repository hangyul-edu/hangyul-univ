# Vietnamese (vi) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), review agent for `vi` (PIPELINE.md step 5 only)
- Status: NOT human-reviewed. Do not set `status` to `HUMAN_REVIEWED` on the basis of this record.
- Starting point: web manifest 100 % (3,560 keys), leak check already recorded by the coordinator. After the revisions: `v9-todo vi` → 0 missing, 0 identical, 0 stale.
- Register: friendly "bạn" for the student, with polite and complete sentences. Parents are addressed through the sponsor page ("con", "gia đình").

## Sample read

- All `student:` and `common:` keys under `dashboard.*`, `home.*`, `start.*`, `discover.*`, `documents.*`, `workspace.*`, `budget.*`,
  `visa.*`, `v4.*`, and `v9.*` (money, funds, guard, refund, family, sponsor, routes, announced, visa caveats), plus `common:v9.l10n.*`: 899 strings, read side by side with the English.
- Targeted greps across `dossier`, `success`, `writing`, `visaroute` and `concierge` for money, fees, refunds, guarantees, authorization, apostille and bank papers (about 110 strings),
  plus a check of the whole locale for admission-odds or promise wording ("cơ hội", "chắc chắn", "đảm bảo", "đừng lo") and for counselor-term drift.
- Screens: `shots/picker-vi-390.png` (language picker and settings, 390 px) and `shots/scholarships-vi-390.png` (scholarships, 390 px). I did not run a browser.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 4 / 4 / 4 / 3 / 5 | 5 / 4 / 5 / 4 / 5 |
| B. Graduate applicant 23–29 | 4 / 4 / 3 / 4 / 5 | 5 / 4 / 4 / 4 / 5 |
| C. Parent 35–49, pays tuition | 3 / 4 / 4 / 4 / 5 | 4 / 4 / 5 / 4 / 5 |
| D. Parent 50–65, low digital confidence | 3 / 4 / 4 / 4 / 5 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Scores below 4 before revisions:
- A, action clarity 3: the public eligibility quiz (`/start`) was titled "Bắt đầu nộp hồ sơ" ("Start application") and its subtitle said "Choose a program and intake". The page actually asks three questions. These strings were translations of older English.
- B, trust 3: the quiz tier "One step away" was translated "Có thể phù hợp", which is the STATE_MAP term for *Possible match* (competitive). A program that is not eligible yet was labelled as a possible match.
- C and D, comprehension 3: the same document (표준입학허가서, the visa's key paper) had two names, "Giấy xác nhận nhập học" in 8 places and "giấy báo nhập học" in 21. The university application fee also had three names ("phí nộp hồ sơ", "phí xét tuyển", "phí ứng tuyển"). A parent could think these were different papers or extra fees.

## Issues found and fixed (`scripts/i18n/v9-data/vi-review.json`, merged with `v9-merge.mjs`, 19 values)

| Key | Before → After | Why |
|---|---|---|
| `student:start.title` | Bắt đầu nộp hồ sơ → Trường đại học Hàn Quốc nào phù hợp với bạn? | Now matches the English quiz title. |
| `student:start.subtitle` | Chọn chương trình và kỳ nhập học… → Ba câu hỏi. Không cần tài khoản. Chúng tôi so sánh câu trả lời… | Now matches the English. The old text described a different dialog. |
| `student:start.tier.POSSIBLE` | Có thể phù hợp → Chỉ còn một bước | "One step away" belongs to *Not eligible yet*. It must not use the *Possible match* term. |
| `student:dashboard.recommended.subtitle` | Phù hợp cao và Cạnh tranh → Rất phù hợp và Có thể phù hợp | Uses the STATE_MAP terms that the badges show. |
| `student:dashboard.cost.fee`, `university.costs.fee`, `compare.row.fee`, `budget.line.application_fee`, `budget.beforeArrivalHint`, `v9.money.line.application_fee` | phí nộp hồ sơ / phí xét tuyển → Phí ứng tuyển | One name for the university application fee, matching the 12 submission strings in `success:`. |
| `student:applicationDetail.statusText.ADMISSION_CERTIFICATE_PENDING` / `_ISSUED`, `visa.whenText`, `visa.steps.certificate.title`, `v4.visa.phase.certificate`, `v4.visaStep.admission_certificate`, `visaroute:doc.admission_certificate.name`, `visaroute:step.university_papers.why` | Giấy xác nhận nhập học → Giấy báo nhập học (tiêu chuẩn) | One name for the standard admission letter, matching the 21 existing uses and Vietnamese study-abroad usage. |
| `student:v4.visa.phase.admission` | Nhập học → Trúng tuyển | "Nhập học" also means enrolment (`home.stage.ENROLL`). Now the visa timeline does not show "enrolment" before the visa. |

## Terminology (vi)

| English (STATE_MAP / core) | vi |
|---|---|
| Strong match | Rất phù hợp |
| Possible match | Có thể phù hợp |
| Not eligible yet (one step away) | Chưa đủ điều kiện (Chỉ còn một bước) |
| Needs your grades | Cần điểm của bạn |
| Counselor | Chuyên viên tư vấn |
| Offer | Thư mời nhập học |
| (Standard) admission letter | Giấy báo nhập học (tiêu chuẩn) |
| Application fee / tuition | Phí ứng tuyển / học phí |
| Money you must show (not pay) | Số tiền cần chứng minh (không phải trả) |
| Bank balance certificate | Giấy xác nhận số dư tài khoản |
| Apostille / legalization | chứng nhận Apostille / hợp pháp hóa (lãnh sự) |
| Residence card | Thẻ cư trú (người nước ngoài) |

## Residual risks (what a native reviewer should check first)

1. The English source key `student:start.title` / `start.subtitle` is used by two screens: the public quiz (`pages/Start.tsx`) and the "start application" dialog (`components/StartApplication.tsx`). The dialog now shows the quiz title in every locale. This is an English or feature-owner bug, and it has been reported here, not fixed.
2. "học sinh" and "sinh viên" are both used for the student (16 and 29 times). Money and refund rules say "học sinh". Check whether parents read both as the same person.
3. Capitalisation of document names is mixed ("Apostille" vs "apostille", "Giấy báo nhập học" vs "giấy báo nhập học").
4. `home.docAction.IN_REVIEW` is "Đang duyệt", but elsewhere "in review" is "Đang xem xét". These are minor.
5. Screenshots are older than the current strings. `settingsV3.translation.SYNTHETIC_REVIEWED` shows as a raw key in `picker-vi-390.png`. The key now exists in vi, so a fresh leak-check run should confirm the fix.
6. Visa-route texts (`visaroute:*`), arrival texts (`concierge:*`) and writing texts (`writing:*`) were only sampled. A human should read the Vietnam route itself: apostille from 11 Sep 2026 versus consular legalization.
