# V26 — User-friction map

Every step below was observed on the running stack (BEFORE captures in `docs/qa/v26/visual/before/` and live walks), using
the seeded personas:
- student: `student@demo` (Lan — preparing, 3 applications)
- agency: `counselor@lotus` (19 students)
- university: `admin@pusan` (11 applicants)

A click count means the number of pointer activations from the starting screen to the moment the user can **do** the work
(type the reply, see the requirement, take the decision). Typing does not count. "After" figures are measured by
`qa:v26` (§349) where a check exists, and otherwise by the same walk on the AFTER build. No UX score is invented.

## Student

| Workflow | Step | Screen | Decision | Click | Wait | Confusion risk | Dead end / recovery | Unnecessary work | Before → After |
|---|---|---|---|---|---|---|---|---|---|
| Find programmes that fit me | 1 | `/explore` from the nav | — | 1 | skeleton (rows) | **Opens "전체 프로그램", not "나에게 맞는"** whenever the link carries `?lang=` (every localized link) | Must notice the tabs and switch | Scanning 66 programme rows; one university repeated 7×; the same degree-mismatch sentence on 5 of 12 rows | 2 clicks + scan → **1 click** (For you opens; the full list is grouped by university) |
| | 2 | the fit groups | which group | 1 | — | Group names are the honest tiers (STATE_MAP) | — | — | unchanged |
| Fix a returned document | 1 | home next action "고치는 방법 보기" | — | 1 | — | — | — | — | 1 |
| | 2 | task list "다른 할 일 11개" → a document task | — | 2 | — | The task opens `/documents`, not the document | Find the row on a long page | Scroll and scan | **3 → 1** (the task opens the requirement, highlighted / the document drawer) |
| Know what my plan covers *now* | 1 | `/services` | — | 1 (menu) | skeleton | "지원 학교 관리 2 / 2 · 모두 사용했습니다" with 3 applications on home | The student has to work out that the draft does not count | Cross-checking applications by hand | → the services page lists **which** applications are managed, what each service is doing, who handles it and what comes next |
| Answer a university request | 1 | home / documents "요청" row | send the existing copy or upload a new one | 1 | toast | — | — | — | already 1 (V5: "보낸 서류 그대로 보내기" is primary when a valid copy exists) |
| Application status | 1 | `/applications/:id` | — | 1 | skeleton | "Open the draft" in English; "상담팀님이 자기소개서을(를)" | — | — | copy fixed; latest change added |

## Agency

| Workflow | Step | Screen | Decision | Click | Wait | Confusion risk | Dead end / recovery | Unnecessary work | Before → After |
|---|---|---|---|---|---|---|---|---|---|
| Morning triage: reply to students waiting on us | 1 | Today → TODAY "우리 답변을 기다리는 중 6" | — | 1 | table keeps the old rows while refetching (V25 gate waits on `data-work-total`) | — | — | — | 1 |
| | 2 | row → `/students/:id` | — | 1 | — | **"처리 필요: 기다리는 일이 없습니다" next to "다음 할 일: 학생에게 답장하기"** | The counsellor must scan the "최근 대화" card on the right | Deciding which thread; "메시지" opens a *new* conversation | — |
| | 3 | find the thread, put the cursor in the composer | which thread | 1–2 | — | With several threads only the latest is shown inline | Details → 소통 tab → pick a chip | — | **3–4 → 1** (the row opens the exact thread with the composer focused) |
| A university asked for a document | 1 | TODAY "대학 요청 2" | — | 1 | — | — | — | — | 1 |
| | 2 | row → workspace | — | 1 | — | "처리 필요" says "대학 요청 (Pusan National…)" → opens the *applications section* | Expand Details, find the application, find the request | — | **4 → 1** (the row opens the request, highlighted) |
| Review a document | 1 | rail 지원·서류 → queue → document → 승인/보완 | approve or return | 3 | PDF load | Filled tangerine segmented control competes with the primary action | — | — | 3 (already a one-page queue, V11) |
| Deadline in 7 days | 1 | TODAY "7일 안에 마감 5" → row | — | 2 | — | Opens the student, not the application | Find the application in Details | — | **3 → 2** (the row opens the application, highlighted) |

## University

| Workflow | Step | Screen | Decision | Click | Wait | Confusion risk | Dead end / recovery | Unnecessary work | Before → After |
|---|---|---|---|---|---|---|---|---|---|
| Decide on waiting applicants | 1 | home headline "결정이 필요한 지원자 6" | — | 1 | count query | — | — | — | 1 |
| | 2 | row → applicant | decide | 1 | — | — | "open next" after a decision (V13) | — | 2 |
| Default list | — | home table | — | 0 | — | **Sorted by submission date; the 6 decisions are mixed with enrolled students** | — | Scanning | → decision rows first by default |
| Same on the phone | 1 | native 지원자 tab | — | 1 | — | No headline: nothing says what changed this week | — | — | → native headline (4 figures, each opens its rows) |
| Drill a metric | 1 | 통계 → a funnel step / country bar / trend month | — | 2 | — | — | — | — | 2 (V23/V25; `qa:v26` re-proves metric = rows) |

## Duplicate entry and back-tracking found

- **Agency reply:** the counsellor sees the reply in one card and the action in another, then opens a *new conversation*
  dialog. This is replaced by focusing the existing thread's composer.
- **Student documents:** the dossier already stores each document once and reuses it across applications. Duplicate
  uploads come only from the generic "서류 올리기" button, which asks "already have it?" inside the dialog. That behaviour is
  kept.
- **University:** none found.

## Competing primary actions found

- Agency workspace: "메시지" (filled) and "할 일" (peach, which reads as a second primary). After: one primary, which is
  the next action; "할 일" becomes the neutral secondary.
- Review queue: the filled tangerine segmented control and the filled-looking selected row compete with 승인. After: an
  ink selected state.
