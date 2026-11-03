# V31 service terminology glossary (canonical)

Source of meaning: `docs/SERVICE_CATALOG_V29.md` and `packages/types/src/plans.ts`. Korean and English below are the
canonical renderings used in the product after the V31 source pass. Each market locale's chosen term for every row is
recorded in `glossary/<locale>.json` by that locale's review (same ids). **One concept = one term per locale.**

| id | 한국어 | English | Meaning — and what it must NOT be confused with |
|---|---|---|---|
| consultation | 유학 상담 | consultation | A conversation with the Hangyul team about the student's plans. |
| diagnostic | 맞춤 유학 진단 상담 | personal diagnostic consultation | The FIRST consultation (one per plan). Not the support window. |
| support_window | 상담 후 문의 가능 기간 | support window | How long after the consultation the student can keep asking questions (1 day / 3 days / contract term). **Not a number of sessions, not minutes.** |
| follow_up | 후속 상담 / 후속 지원 | follow-up (consultation) | A later consultation (Basic: 1) or the team following up (All-in-One) or priority replies (Premium). |
| recommended | 추천 대학·어학당 | recommended universities (and language institutes) | Institutions Hangyul SUGGESTS (3/5/7). **Not applications.** |
| managed_application | 지원 관리 대학 / 대학 지원 관리 | managed application ("applications we manage with you") | An application Hangyul tracks and prepares with the student (0/2/3). **Not a recommendation; Hangyul does not submit on the student's behalf** (Korean law: applicants submit personally, except a recorded authorised basis). |
| admission_requirement | 입학 요건 / 지원 자격 | entry requirement | What the university requires (published by the university). |
| checklist | 서류 체크리스트 | document checklist | A list of what to prepare. Basic's document level. |
| document_review | 서류 검토 | document review | Hangyul READS documents the student prepared and says what to fix. **Not document preparation / writing.** |
| correction_notes | 보완할 점 안내 | notes on what to fix | The output of a review. Not editing the document for the student. |
| personal_statement | 자기소개서 | personal statement | An essay type. |
| study_plan | 학업계획서 | study plan | An essay type (document, not "learning plan"). |
| editing_round | 첨삭 1회 | editing round | One review of an essay with comments/edits. **Editing ≠ writing the essay for the student.** |
| premium_scope | 계약한 지원 서류와 일정 안에서 | within the application documents and schedule in your contract | The boundary of Premium's "no round limit". Must stay attached to "no limit". |
| mock_interview | 모의 면접 | mock interview | A practice interview session. |
| visa_support | 비자 준비 지원 | help preparing your visa (documents) | Guidance / help preparing / documents + key dates managed. **The visa DECISION is made by the immigration authorities, never by Hangyul.** |
| dormitory_info | 기숙사 정보 안내 | dormitory information | Basic's level. |
| dormitory_schedule | 기숙사 신청 일정 관리 | we track the dormitory application dates | All-in-One. Not applying for the student. |
| dormitory_application | 기숙사 신청 지원 | help with the dormitory application | Premium / add-on: help completing the application. **Not guaranteed placement.** |
| alt_housing | 다른 숙소 안내 | other housing options | Information about alternatives, not booking. |
| pre_arrival | 입국 전 지원 (D-30) | help before you arrive (from 30 days before) | Premium. |
| settlement | 정착 지원 | help settling in (30 days after arrival) | Premium / add-on. |
| priority | 우선 응대 | priority replies | Premium. |
| dedicated_team | 전담 팀 | dedicated team | Premium. Outwardly still "the Hangyul Univ team". |
| add_on | 추가 서비스 | additional service (add-on) | Bought separately; exact price agreed BEFORE payment. **A price range is not a charge.** |
| custom_quote | 별도 견적 | custom quote | Priced per case with a written scope. |
| airport_pickup | 공항 픽업 연결 | airport pickup, arranged with a partner | Hangyul ARRANGES a partner transport provider; **Hangyul does not operate transport.** |
| apostille | 아포스티유 | apostille | Official term; never paraphrase. |
| consular_legalization | 영사확인 | consular legalization | **Never "consular confirmation".** |
| notarization | 공증 | notarization | |
| transcript | 성적증명서 | (academic) transcript | |
| graduation_certificate | 졸업증명서 | graduation certificate | |
| enrollment_certificate | 재학증명서 | certificate of enrollment | |
| deadline | 지원 마감일 | application deadline | |
| university_review | 대학 심사 | university review | The university evaluating the application. |
| offer | 합격 | admission offer | "Accepted/admitted" only when the university has decided. |
| enrollment | 등록 / 입학 | enrollment | |
| language_institute | 어학당 | Korean language institute | Never "language school" in formal copy. |
| plan names | 베이직 / 올인원 / 프리미엄 | Basic / All-in-One / Premium | Product names; keep Latin in every locale unless the locale's market copy already localizes them consistently. |
| brand | 한귤 / 한귤 유니브 | Hangyul / Hangyul Univ | Latin "Hangyul" in every non-Korean locale. |

## Forbidden / stale terms (gate `qa:v31-l10n`)

- "consular confirmation" (→ consular legalization) · "visa issuance" as something Hangyul does · "guarantee(d) admission /
  success" · "unlimited" without the contract scope beside it · V15 plan wording ("minutes", "1:1 sessions per month") ·
  "ambitious"/"reach" for the far Quick-fit tier · "Responsible-team" · "Applications managed" as a passive count label.
