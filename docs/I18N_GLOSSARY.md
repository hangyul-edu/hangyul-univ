# Hangyul Univ — canonical glossary (V32)

One concept, one term per language. Every locale expresses each row the same way everywhere it appears: in the
marketing site, the Student app, both consoles, the native apps, e-mail and SMS. Translators and review agents work
from the **meaning** column, not from the Korean grammar: the Korean is the owner's source, the meaning is what the
service actually does (docs/SERVICE_CATALOG_V29.md, docs/STATE_MAP.md), and the English is the first-quality rendering
of that meaning. A foreign-language line that is grammatical but vague is a defect.

Rules that apply to every row:

- Never promise an outcome. Hangyul prepares, submits, tracks and follows up; universities admit, governments issue visas.
- Say what we **do**, not a category: "we track the dormitory application schedule" beats "dormitory support".
- Official names stay official: universities, scholarships (GKS, 국가장학금), visa categories (D-2, D-4-1), documents
  (아포스티유 = apostille, 영사확인 = consular legalization, 표준입학허가서 = standard admission letter). Add a natural
  explanation after the official term when the reader may not know it; never invent a translated institution name.
- Operational products (Agency, University) are concise and direct; the Student app is warm and simple; marketing is
  clear, aspirational and credible. Marketing copy never appears inside the consoles.

| Concept | Korean (source) | Meaning (what it is in the service) | English (canonical) | Avoid |
|---|---|---|---|---|
| consultation | 상담 | A scheduled conversation with the Hangyul team about the student's plan (not "counseling" in the therapeutic sense) | consultation | counseling, advising, consulting |
| support period | 서비스 기간 / 이용 기간 | The months a purchased plan is active, from payment to the stated end | service period | support period, subscription |
| university recommendation | 대학 추천 | Universities the team proposes for this student, with reasons; never a promise of admission | university recommendation | suggestion, matches (in plan copy) |
| managed application | 지원 대행 / 관리 지원 | An application the Hangyul team prepares and submits with the student (counted against the plan's allowance) | managed application | application support, application assistance |
| application requirement | 지원 요건 / 제출 서류 | What the university's official guide requires for this programme and intake | application requirement | document needed (when it is a rule, not a file) |
| application deadline | 지원 마감 | The university's published closing date for the application | application deadline | due date (reserved for Hangyul tasks) |
| document review | 서류 검토 | The team checks an uploaded document against the requirement and returns it as accepted or needing a fix | document review | document check (allowed in short labels), verification (reserved for official verification) |
| revision | 수정 요청 / 재제출 | The student fixes a returned document or essay and uploads it again | revision (noun), fix and re-upload (instruction) | correction round |
| personal statement | 자기소개서 | The applicant's own introduction essay required by the university | personal statement | self-introduction, SOP, statement of purpose |
| study plan | 학업계획서 | The applicant's plan of study essay required by the university | study plan | research plan (unless the university's term) |
| scholarship | 장학금 | A published tuition reduction or stipend with its own rules; "verified" means read from the official page on a stated date | scholarship | grant, financial aid |
| mock interview | 모의 면접 | A practice interview with feedback, counted against the plan's allowance | mock interview | interview prep, interview practice |
| visa document preparation | 비자 서류 준비 | Assembling the documents the Korean embassy or consulate requires for the student visa; Hangyul never issues a visa | visa document preparation | visa support, visa assistance |
| dormitory | 기숙사 | University-run housing; "housing" is the broader topic (dormitory or private) | dormitory (university housing), housing (the topic) | dorm (except in tight native labels) |
| settlement support | 정착 지원 / 도착 준비 | The arrival checklist: residence card, bank account, phone, health insurance, with the official deadlines | arrival and settling-in help | landing, onboarding |
| apostille | 아포스티유 | Authentication of a document by the issuing country's competent authority under the Hague Convention | apostille | legalization (when the country is a Convention member) |
| consular legalization | 영사확인 | Authentication by the Korean embassy or consulate for countries outside the Convention | consular legalization | consular confirmation, consular authentication |
| notarization | 공증 | A notary's certification of a copy or translation | notarization | notarisation (en-GB spelling is not used) |
| transcript | 성적증명서 | The official record of grades issued by the school | transcript | grade sheet, mark sheet |
| admission offer | 합격 통보 / 입학 허가 | The university's decision to admit; "standard admission letter" (표준입학허가서) is the official document used for the visa | admission offer | acceptance letter (unless quoting the document), admitted (as a status: "Admitted") |
| enrollment | 등록 / 입학 | Registering at the university after paying tuition; the end of the admissions journey | enrollment | enrolment, registration (reserved for account sign-up) |
| current stage | 현재 단계 | Where the student is in the journey (Explore → Prepare → Apply → Admitted → Visa → Arrive) | current stage | status (reserved for an application's state) |
| next action | 다음 할 일 | The single most useful thing to do now, with who does it | next step (student), next action (consoles) | to-do, task (except in the task list) |
| waiting for | 기다리는 중 / 대기 | The party whose move is needed next | waiting on (consoles), waiting for (student) | pending |
| deadline | 기한 | The date a Hangyul task or request is due; a university's closing date is the application deadline | due date (tasks), application deadline (universities) | deadline alone when ambiguous |
| sign in / sign up | 로그인 / 회원가입 | Account access and account creation | sign in, sign up | log in, register (except "registration" for the sign-up flow name) |
| plan | 플랜 | One of the three purchasable packages: Basic, All-in-One, Premium | plan | package, subscription, tier |
| add-on | 추가 서비스 | A priced extra proposed by the team for a specific student, approved and paid before it starts | additional service | add-on (in code and the consoles only), extra |
| service unavailable | 서비스 연결을 준비 중 | The service cannot be reached right now (no API, network down); never "error" wording | "We're getting the service ready" / "Hangyul can't be reached right now. Please try again in a moment." | failed, error 503, server |

Per-product tone, in one line each:

- **Marketing** — one idea per sentence, concrete nouns, no superlatives, no guarantees; a headline is written for the
  market, not translated from Korean word order.
- **Student** — second person, warm, one clear next step; never CRM vocabulary (pipeline, caseload, tenant).
- **Agency** — imperative, dense, operational: who, what, by when; stage names are the shared vocabulary of
  docs/STATE_MAP.md.
- **University** — formal, precise, analytical; applicants, decisions, requirements; no selling.

Plural rule (fr, ru, uk, sr, pl, cs, ar …): a `_one` form must carry `{{count}}` or read correctly without it; a string
that says "1 application" in English must not become a bare noun in the plural languages (REPORT §433 item 3).
