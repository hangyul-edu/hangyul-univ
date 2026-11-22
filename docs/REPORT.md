# Hangyul Univ — Launch Report

> **Current as of 2026-11-22, product-excellence pass** (on top of the exhaustive pass `94641a8d` and owner pass 261119, `docs/owner/개선사항_261119.pdf`). Earlier baselines: owner pass `1a02e262`, final product pass `1e2fba85`, launch pass `e3f0e0f4`. Evidence: [`qa/launch-final/excellence/`](qa/launch-final/excellence/README.md) and [`qa/launch-final/exhaustive/`](qa/launch-final/exhaustive/). This is the current-state launch report. It replaces the
> 20,000-line version-by-version record (V1–V32), which remains in git history
> (`git log -- docs/REPORT.md`; last full version at commit `fd2f4ba7`). Everything in this file is meant to be true
> today; when something changes, edit the statement instead of appending a dated section.
> Document map: [README.md](README.md).

## 1. Current product state

**What it is.** Hangyul Univ helps an international student prepare a stronger application to the Korean university
they want and looks after the whole process, from the first question to arrival.

**Service model.** Student → Hangyul Univ → Korean university. Hangyul Univ **directly operates** consultation,
university recommendation, application preparation, document review, application management, essay review,
visa-document preparation and arrival/settlement support. There is no external study-abroad agency in the service.
The **university makes the final admission decision**; the immigration authority decides the visa.

**One-paragraph verdict.** The four web products are deployed and reachable, the API answers through a tunnel to a
non-production host that now serves the one catalogue (425 universities, 469 programmes, `READY`), and the product code
passed an exhaustive rendered audit on 2026-11-21 (§5, §8). It is **not ready for a public launch**: there is no durable
production API host, **no live payment method is verified and no production payment host exists** (the
billing-key rail is built and tested, but cannot charge real money yet), legal identity fields and counsel review are
open, no language has been reviewed by a human, and iOS is not built. See §9.

| Product | Domain | Code | State |
|---|---|---|---|
| Marketing | `https://univ.talkhangyul.com` | `apps/marketing-web` | Live; discovery works without the API |
| Student | `https://app.univ.talkhangyul.com` | `apps/student-web` | Live; API reachable |
| Hangyul internal Operations/Admin | `https://admin.univ.talkhangyul.com` | `apps/agency-web` | Live; API reachable |
| University console | `https://partner.univ.talkhangyul.com` | `apps/university-web` | Live; API reachable |
| Student native | — | `apps/student-mobile` | Android to be rebuilt from current source; iOS not built |
| Operations/Admin native | — | `apps/agency-mobile` | same |
| University native | — | `apps/university-mobile` | same |
| API | same-origin `/api/v1` on each domain; health `/healthz` | `server/` (FastAPI) | Connected through a tunnel to a non-production host |

`agency-*` names in code (`apps/agency-web`, `@hangyul/agency-web`, `AGENCY_*` roles and models, `/agency/...` API
prefix) are historical internal names for the Operations/Admin product and are not being renamed
([ARCHITECTURE.md](ARCHITECTURE.md)).

## 2. Production architecture

```
Browser ─▶ Vercel (4 projects, one per web app; static dist, CSP/HSTS, /build-info.json)
             │ same-origin /api/:path*  (rewrite in apps/<app>/vercel.json)
             ▼
        ngrok tunnel https://enclosure-cork-purifier.ngrok-free.dev  (policy: only /api/* and /healthz)
             ▼
        FastAPI on the owner's machine ─▶ PostgreSQL 16 · Redis · local storage

Marketing discovery: live public catalogue API /api/v1/directory/* (same database as Student);
                    DB-generated snapshot /data/public/*.json only for prerender/SEO and as the offline fallback
```

Verified live on 2026-11-21 (before this pass's deploy; the deployed commit after it is in §8):

| Check | Result |
|---|---|
| `/build-info.json` on all four domains | commit `152aff47` at the start of the pass |
| `GET https://app.univ.talkhangyul.com/api/v1/auth/me` | 401 `{"detail":"Not authenticated"}` — API reached, auth enforced |
| `GET /api/v1/public/plans` | 200 with plan data |
| `GET /api/v1/public/catalog/status` | 200 `{"state":"READY","universities_total":425,"programs_total":469}` — the connected host runs the 261119 catalogue |
| `GET /api/v1/universities`, `/programs` | 200 with rows (same database as Marketing's live directory) |
| Transport | responses still carry `ngrok-agent-ips`: tunnel to the owner's machine |
| `https://api.univ.talkhangyul.com` | resolves to Vercel IPs; TLS fails — no dedicated production API host |

**Truthful status of the API:** connected through a tunnel to a non-production host; a durable production API host
and a seeded catalogue are open launch blockers. It is not "unavailable" and not "fully live in production".

Stack: React 19 + Vite 7 (web), Expo SDK 57 / React Native 0.86 / expo-router (native), FastAPI + SQLAlchemy 2 +
Alembic on PostgreSQL 16, Redis, npm workspaces. Per-app `vercel.json` is generated from `infra/csp.json`
(`scripts/ops/gen-vercel.mjs`). The intended production stack (HTTPS origin, private S3 with SSE, ClamAV, worker,
secret files, backups) is implemented and tested in code but not provisioned. Operations: [DEPLOYMENT.md](DEPLOYMENT.md).

When the API cannot be reached, the three signed-in apps and the native apps show the localized
service-unavailable state with Retry — never fabricated data or a transport error.

## 3. Current service model

**Plans** (one-time, USD, never a subscription; catalogue `2026-10-30.v29`; source of truth
`packages/types/src/plans.ts` → `shared/plans.json`; contract in [SERVICE_CATALOG.md](SERVICE_CATALOG.md)):

| | Basic $179 | All-in-One $349 (core) | Premium $599 |
|---|---|---|---|
| Consultation support window | 1 day | 3 days | contracted term |
| Universities recommended | up to 3 | up to 5 | up to 7 |
| Applications managed | — | up to 2 | up to 3 |
| Document review | checklist | review + correction guidance | intensive |
| Essay editing | — | 2 rounds | no round limit within the contracted documents and schedule |
| Visa | procedure guidance | document preparation | documents + key dates |
| Arrival | — | basic living information | D-30 pre-arrival to 30 days after arrival |

- Free without purchase: public directory search and saved universities. Personalised matching (`/match`) needs a plan
  (owner decision 261119): Marketing `유학 준비` → Student login → checkout if unpaid → `/match`. Quick Fit is retired.
- Additional services (extra managed application, extra edit round, mock interview, dormitory application support,
  airport pickup, extra settlement support) are proposed by the team at an exact price, approved by the student and
  **paid before anything is granted**. Upgrades are refused until the owner sets a pricing rule.
- Every purchase snapshots its catalogue into a `ServiceEngagement`; usage is derived from work records; "no limit"
  is always scoped by document type, managed application and term.
- **Admission language:** the goal is to maximise the student's chance through stronger strategy and preparation.
  The product never promises admission and shows no probabilities, percentages or scores. Fit results are four
  groups with reasons ([ADMISSIONS.md](ADMISSIONS.md)).
- **Hangyul never collects tuition** — the student pays the university in their own name.
- Students see one identity, "한귤 유니브 상담팀 / Hangyul Univ team"; the real author stays on every row for audit.
- Student UX rule: the next action comes before the internal stage.

**Payments — billing key only (owner decision).** Every purchase is a **one-time** payment: the student chooses a
saved payment method or registers one on Toss's hosted page (Hangyul never sees card data), the server issues and
AES-256-GCM-seals the billing key (**this charges and activates nothing**), the student confirms "Pay $349 · one-time
payment", and the server charges that key **once** for the server-priced order. No subscription, no renewal, no
scheduler, no ordinary-payment fallback — the old 결제창 and key-in routes were removed. Exactly-once is enforced by an
order row lock, a durable CHARGING state before the call, per-attempt idempotency keys and a provider lookup before any
retry; webhooks only trigger a lookup. Refunds are executed by Operations for an amount a person decides (no refund
schedule is approved); students cannot refund themselves. Upgrades stay refused until an upgrade price rule exists.
**Live state:** no live credentials are installed on any host, there is no production payment host, and no method has a
verified live capability, so nothing can be charged today. Detail, gates and per-method results:
[`payments/BILLING.md`](payments/BILLING.md).

## 4. Current data coverage

| Data | Verified / present | Incomplete |
|---|---|---|
| Institution directory | **425** institutions (대학알리미, Study in Korea, Wikidata), every field sourced; 425 public detail pages | — |
| Admission guides → checklists | **8** universities with a document checklist built from an official guide (bachelor's, 2027 Spring); **39 / 425** link a verified official guide on their public page | Others show "not yet verified" with the official source link |
| Language rules | 963 rule rows; **43** institutions with verified rules | **176** institutions "needs checking" |
| Scholarships | **461** schemes for 24 universities, as published | Other universities: not researched, shown as unknown (never "none") |
| GKS participation | 98 institutions (NIIED lists) | — |
| Visa routes | 41 routes, 14 countries × visa type, sourced | Per-route open items for a human reviewer |
| University photographs | **166 / 425** with an own campus photograph (462 photos, full rights metadata) | **259** use a designed identity composition |
| Official films | **165 / 425** with a verified official video (24 of them international-student / English / campus-tour films) | — |
| Programme catalogue (programmes, fees, deadlines) | **469** admission units of 8 universities from official 2027 guides, with intakes, language minimums, fees/tuition only where printed | Other universities: none (never generic rows); connected DB gets them on the first start of the new API |
| Members | 0 users in the reference seed; synthetic fixtures only in test/e2e databases | — |

Public detail-page coverage, measured by `node scripts/qa/university-coverage.mjs` (425 records): own campus photo
166 · servable official logo 63 · official website 348 · international office link 123 (37 from verified research) ·
international admissions page 207 (46 verified) · verified guide 39 · verified language rule 43 · structured
scholarships 24 · GKS (NIIED list) 98 · IEQAS 173 · dormitory verified 28 · official video 165. **Not in the public data
at all (0 / 425): tuition, application fee, intakes/application periods, required documents, legalization rule,
degree levels offered, street address** — the detail page shows these as "not yet verified" with the official source,
never as "none". Unverified data presented as fact: 0.

**One authoritative catalogue (owner requirement 3, implemented 261119).** Every active `Institution` has exactly one
`University` row with the same slug; Marketing reads `/api/v1/directory/*` live and Student reads `/universities` and
`/programs` — the same rows (`npm run qa:catalog-parity`: 26/26 against the local API). Programmes come only from official
guides (`server/app/data/research/v33/programmes/`, 469 units of 8 universities; Kyungpook and Sungkyunkwan guides could not
be fetched). An empty catalogue bootstraps itself when the API starts (advisory-locked, durable marker, never re-runs on
restart); a staged refresh (fetch → stage → compare → provenance → one-transaction publish; robots.txt, ≥2 s per host,
bounded retries; a failed source keeps its previous values) runs **every Monday 09:00 Asia/Seoul** from the worker and from
an in-process scheduler in the API. Health: `GET /api/v1/ops/catalog/health` (Operations, HQ › Sources) and
`GET /api/v1/public/catalog/status`. Measured on a local database after migrate + reference seed + first API start:
425 universities · 469 programmes · 593 intakes (68 open) · 408 admission requirements · 241 document requirements ·
461 scholarships · 0 dormitories · 11 official guides · 165 official videos; first full refresh SUCCEEDED (1,135 polite
requests, 0 source failures, 74 broken / 107 erroring / 60 robots-disallowed official links recorded, 2 guides REVIEW_DUE);
next refresh 2026-11-23 09:00 +09:00. **The connected database now serves it** (2026-11-21: `catalog/status` READY, 425
universities, 469 programmes). Sources without a parser yet (Study in
Korea, NIIED/GKS, other government) are recorded as SKIPPED on every run. ~30% of institutions publish no English name:
`name_en` then holds the official Korean name and `name_en_recorded` is false.
Public rule: a public surface renders only what can be verified; unverified fields are blank.

## 5. Current UI/UX state

**Product-excellence pass (2026-11-22).** The question was "should the user need to see this at all?". Nothing was
added for its own sake; six screens lost or folded secondary content and the rest of the changes remove repetition.
Task map and before/after counts: [`qa/launch-final/excellence/TASKS.md`](qa/launch-final/excellence/TASKS.md).

- **Student home** leads with the next action: the six-stage journey is one line (six segments, "6단계 중 2단계 · 준비",
  "전체 여정 보기"), so the action panel starts at y=243 px at 390 (was ≈340) and its button is above the fold; documents
  that need *changing* keep their own rows, documents not uploaded yet are one line; the team card no longer says the
  team's name twice. The fifth tab is "더보기" on every width (it was "내 여정" on phones, "더보기" on desktop).
- **Documents** open on **해야 할 일 N** (검토 중 · 완료 · 전체 one tap away): 3,493 → 2,590 px at 390, only the items that
  need the student.
- **Match** rows say why on the row: up to three published requirements met (✓) and one thing to check (△) — no click,
  no probability.
- **Messages** read as a conversation: date lines, runs of consecutive messages with one name and mark, clock times,
  quiet bubbles; a message that carries a document or created a task links to it; the thread links to its application.
- **Application** says its status once; no "나" owner label; no internal organisation name in the team lane.
- **Profile** reads as three chapters — 지원 준비 · 유학 목표 · 나에 대해 — over the same seven sections.
- **Team identity:** the "who can see my documents" panel named a staff member and the organisation ("{{org}}의 담당
  상담사 {{name}}"); it now names the Hangyul team. Stale Korean and Burmese plural forms that still said "상담사" were removed.
- **Operations Today** is a work queue: lanes (act now · our turn · waiting on student / university) and "14일 내 마감"
  first; the eleven-cell stage matrix is "단계별 보기" (remembered per browser). The ranked order is drawn once (at 1,071
  students the table used to re-sort under the cursor ~2.5 s after first paint). Keyboard shortcuts are discoverable
  ("키보드 단축키 ?", `?` anywhere). The case header is two columns on a phone and no longer shifts (CLS 0.18 → 0.001).
- **University home** is a review inbox (결정 필요 · 보완 서류 · 새로 접수 · 다가오는 일정); outcome rates, source
  countries and the monthly trend live on 통계 only. The first applicant rows are above the fold at 1440. Decisions name
  the applicant, programme and intake, warn when required evidence is unverified, label the button with the decision
  and ignore a second submit.
- **Trust under failure:** a stalled API now ends in an error with Retry at the 20 s deadline on the Student home (was ≈42 s
  of skeleton); University Retry brings back the whole page; a recorded visa receipt can no longer be overwritten on
  screen by an older background response.
- **WCAG 2.2:** focus is never hidden under sticky bars (global focus keeper; the consoles' skip link rendered under the
  header and now sits above it); login identifiers are `username` with a show/hide password toggle on all three logins.

**Exhaustive product-quality pass (2026-11-21).** Every route of the four web products was rendered from the code's own
route inventory (Design Preview for signed-in screens; real builds; real API for end-to-end), screenshots were opened and
read, and 29 product defects were found and fixed (full list with root causes:
[`qa/launch-final/exhaustive/DEFECTS.md`](qa/launch-final/exhaustive/DEFECTS.md)). What changed for users:

- **One language per screen.** University names, document names, essay titles, team and organisation names now follow
  the reader's language wherever the server sends a flat English label (Student home, essay editor, University review,
  Operations thread/catalogue/templates, University partnership cohorts and definitions). 75 error messages that
  showed the server's raw English `detail` now use the localized `errorText`.
- **One team, no person.** 86 student strings that said "your counselor / 상담사 / カウンセラー / консультант" now name the
  Hangyul team in all 21 Student languages; the team card no longer shows the internal organisation; zh-Hant's team name
  was "你的團隊" and is now the brand.
- **Nothing is lost on failure.** A failed message keeps its text *and* attachments and says so under the composer (it
  dropped attachments before); "mark all read", notification opening and saved-view deletion no longer throw on failure.
- **Student home** names the university and the task in one line, with the programme underneath; the thread opens at the
  newest message on phones and fits the window on desktop; essay diffs and comments no longer scroll in boxes.
- **Phones.** 12 px type floor everywhere (tab labels were 10.5–11.5 px); every control a 44 px target and every text link
  ≥ 24 px on touch (password toggle, switches, task checkboxes, journey steps, disclosures, Operations queue checkboxes,
  chips, matrix cells, source links); statuses never split mid-word; Korean wraps between words; a shared keyboard
  safeguard keeps the focused field in view when the viewport shrinks.
- **No jumping pages.** The University overview and analytics no longer shift after first paint (CLS 0.65 / 0.48 → 0 / 0.018 at 390 px).
- **Honesty fixes.** "NaN명" dormitory capacity on the public SNU page; a raw `NOT_STARTED` visa status; a machine-
  translation notice that contradicted itself at 100 % coverage (fixed in 56 locales).
- **QA harness.** `/match`, the purchase gate, saved universities and the seven HQ routes were missing from the route
  inventory; the new audit's touch/typography checks first passed vacuously on every signed-in screen (fixed); see the
  harness section of DEFECTS.md.

Still not done by a person: usability sessions with students, a human screen-reader walk-through, native-speaker review
(the rewritten strings are AI-drafted like the rest of each bundle), and a native run on an emulator or device.

**Owner-improvement pass 261119** (seven requirements from `docs/owner/개선사항_261119.pdf`):

1. `유학 준비` → Student login (`next=/match`) → checkout if unpaid → `/match` (matching and university selection); `/start`
   redirects to the login; Quick Fit and its Vercel function removed (web and native).
2. Login/sign-up decide before the first committed render (`AuthEntryGate`; `PlanGate` navigates during render):
   `e2e/auth-entry-flash.spec.ts` records every animation frame — 13/13 cases, 0 wrong-form frames (cold load, reload,
   in-app navigation, back/forward, 390 px, slow 3G + 6× CPU, signed-in entry, unsafe `next`).
3. One DB catalogue (§4); Explore distinguishes "being prepared" (catalogue empty) from "no match" (filters); within a
   filter group OR, across groups AND (server tests + UI note).
4. One `FileDrop` primitive (`@hangyul/ui`) on all 7 web uploaders (Student documents, messages, housing; Operations
   messages, upload-on-behalf, service proof, submission evidence): picker + drag & drop with drag-valid/invalid, drop,
   validating, uploading, success and error states; one validation path (`@hangyul/validation`); University web has no
   uploader. Native keeps document/photo pickers with the same validation and no drag text.
5. Scrolling root causes fixed (one counted body-scroll lock, `min-height: 0` in modal/drawer bodies, auto-growing essay
   editor, tab-bar + safe-area padding, `interactive-widget=resizes-content`): `e2e/student-scroll.spec.ts` 130/130
   (32 routes × 320/390/768/1440). Native: one keyboard/safe-area rule in `@hangyul/mobile-ui`.
6. Documents rebuilt on the Saramin interaction model: category bands (academic, identity & family, language,
   financial, writing, university-specific, additional) with 필수/선택 chips and one-line summaries ("필수 2개 · 완료 1개 ·
   수정 필요 1개"), `+`/`−` disclosure (`aria-expanded`), a sticky "서류 완성도" navigator on desktop, a 구분 type sheet on
   phones, required items never removable, empty optional records removable, rows driven by the applications' verified
   requirements, "used by N applications". Grouping logic shared with native (`@hangyul/utils` `docGroups`).
7. No English leakage: `npm run qa:lang-leak` — 0 leaks on 415 pages (20 Student locales × 16 routes at 390, + 1440 for
   ko/ar/ja/vi; Marketing 5 locales; Operations and University in ko). University names follow the reader's language
   (`university_ko` alongside every English name), team identity 한귤 유니브 상담팀, server errors localized by code.

Final product pass (2026-11-19). Every change below was judged from real screenshots at 320–1920 (Design Preview,
synthetic data), not from automated passes alone; screenshots were captured for every major route at 10 widths.

- **Shared foundation:** the YNEX skin that re-pointed tokens to cool blue-grey was removed; white canvas, one warm
  paper surface (`--hg-bg-paper`), `--hg-selected-*` orange for current/selected state everywhere (tabs, chips,
  segmented, rows, nav), all seven status tones restored (six had rendered grey since the first commit), one type face,
  larger console type, 10/14/20 px radii, white table headers, quieter modals and drawers.
- **Marketing:** unchanged except the university detail page, rebuilt as a decision page: identity hero (badges only
  where data supports them) → decision summary (study options · admissions · cost · student life · support, confirmed
  facts only, "not yet verified" with the official source otherwise) → admissions with source and checked date →
  scholarships grouped by type with eligibility, benefit, period, source → campus and student life (own photographs
  only; otherwise an identity board with logo, region map and regional photo labelled as the region) → official video
  → one closing action.
- **Student:** home answers where am I → one next step (with deadline) → what Hangyul is doing → what the university is
  doing → coming up → applications → documents. A calm "nothing to do right now" state names the university reviewing
  and keeps the next dates visible. Applications, application detail and documents use hairline rows and one primary
  action; checkout reads summary → included → payment method → "Pay $349" → one-time consent; saved payment methods
  can be added, set default and removed.
- **Operations/Admin:** Today leads with "who needs attention now" lanes (act now · our turn · waiting on student ·
  waiting on university) and a stage rail (orange selected, red where someone needs action, amber where all are
  waiting); 54 of 54 count clicks open exactly the rows counted. The work queue shows student, situation, next action,
  waiting on, due, university and activity without clipping; SVG flags replace emoji. The student workspace is one
  case; Insights uses sections and denominators; Payments shows state, receipts and refunds with a typed-amount refund.
- **University:** the overview answers attention, pipeline, missing documents, offers, post-admission outcomes,
  countries and monthly trend above the fold at 1440; Insights is rebuilt on lightweight charts (step funnel,
  country bars, month trend, cohort matrix) with "n of N" everywhere and the n<5 rule unchanged; the applicant review
  has one primary decision with its lock reason visible.
- **Brand:** marketing light header = orange horizontal logo; dark surfaces = ivory; product shells on light = black
  horizontal; app icons and favicons = orange symbol on ivory; OG card `hangyul-univ-og-v1.jpg` in static HTML
  ([BRAND_AND_MEDIA.md](BRAND_AND_MEDIA.md)).
- **Design Preview mode (added in this pass):** build flag `VITE_ENABLE_DESIGN_PREVIEW`; "Preview without signing
  in" under the Student / Operations / University logins and "Preview without paying" under paywalls; synthetic
  fixtures only, read-only, no auth session, no private API calls, a small "Design Preview" indicator. Must be off
  before public launch; a release gate checks it.
- **Native:** all three apps were updated in code in this pass (student home with the calm waiting state and one
  primary action; Operations queue-first Today; University decision-first queue and one primary decision). **None of
  these changes were run on an emulator or device** — no Android/iOS toolchain was available. All three apps were
  rendered through Expo's web target at phone sizes against a seeded API and reviewed from screenshots (§8); device-only
  aspects (native fonts, safe areas, keyboard, pickers, tab-label auto-shrink) remain unverified. Native payment hands off to the web checkout (one backend payment model).
- **Follow-up pass (2026-11-19):** Student Explore, Profile and More rebuilt as sections; plural copy fixed in 21
  locales; Visa/Arrival accent bars removed; Operations Manage, Review (390), Tasks tabs, essay editor and secondary
  pages brought to the same standard; University Programs, Documents, Scholarships, Messages, Manage and Exports
  redone. Shared: `FilterSelect` no longer looks selected on its neutral value; breadcrumb divider fixed; header
  button spacing fixed; the Design Preview indicator never covers content; sidebar marks the current section on every
  sub-page (32/32 routes); compact controls are 44 px on phones; small inline targets get ≥24 px hit areas.
- **Visual issues at 2026-11-20:** "none known" was recorded here; the 2026-11-21 pass found 29 (above). The 2026-11-20 fixes: the four Operations HQ
  pages and HQ › Sources open in Design Preview through a second "HQ" preview entry and were restyled; the University
  rule edit form and Notifications page were restyled; Compare/Budget render in preview (POST `/compare` answered
  in-process); the in-app university page shows its licensed photos in preview; checkboxes are 22 px with 44 px rows on
  touch; the programme degree label no longer wraps under a long name. Sample free text written in English inside the
  synthetic fixtures (message bodies, some rule-history quotes) stays English by design — it stands for what a person
  typed and is marked `data-user-content`.
- **Not done:** usability sessions with real students; a human screen-reader walk-through.

Lab figures 2026-11-21 (final builds, local static server, 4× CPU throttle, cold load): LCP 1.4–3.3 s, CLS ≤ 0.065 on every
measured page (University overview and analytics fixed from 0.65 / 0.48). Operations Today at 1,071 students (0.3–0.6 s) was
last measured in V26–V31 and not re-measured — no seeded scale database on this machine.

## 6. Current security

Implemented and tested in the repository ([SECURITY.md](SECURITY.md)):

- Argon2id passwords; 15-minute in-memory access tokens; hashed, rotating refresh tokens with family revocation on
  reuse; httpOnly first-party cookie via the same-origin `/api` rewrite.
- Four-step verified registration (e-mail code + SMS code + Turnstile + granular consents); Redis rate limits;
  progressive login throttling.
- One role per tenant (`AGENCY_ADMIN` = Hangyul operations, `UNIVERSITY_ADMIN`); server-side tenant isolation with a
  404 policy; universities see only applications submitted to them and documents shared for those.
- Uploads: MIME sniffing, size limit, clamd scan before review, private storage, signed 5-minute URLs, audit on
  every access. Staff TOTP MFA. Secrets via `*_FILE`. CSP/HSTS generated from one source. Retention engine,
  backup/restore drill, monitoring events.
- `HG_ENV` defaults to production and fails closed.
- Test sign-in and the paid-state bypass were removed in V32 (commit `dd552834`): no test sign-in, persona picker,
  bypass endpoint or build switch exists; the leak gate scans source, current docs and production bundles.
- Design Preview is client-side only and has no server counterpart.

Not true of the currently connected environment: the API behind the tunnel runs a **development configuration on a
personal machine**, so production-only enforcement (real secrets, S3, ClamAV, mandatory staff MFA, TLS at the API
origin) is not in force there. Open: production host, independent penetration test, retention periods from counsel,
off-host backups. Internal threat model and evidence: `docs/qa/v29/security/`.

## 7. Current localization

Detail and glossary: [LOCALIZATION.md](LOCALIZATION.md).

| Question | Answer |
|---|---|
| Bundles in the repository | 56 |
| Selectable on Marketing | the 33 market locales |
| Selectable in the Student app (web and native) | English + 20: ar, bn, fil, hi, id, ja, kk, ko, ky, mn, my, ne, ru, th, tr, ur, uz, vi, zh-Hans, zh-Hant |
| Selectable in the Operations/Admin and University consoles | ko, en (per the committed `console-locales.ts`) |
| Machine / synthetic review | every market locale: machine translation plus a synthetic (AI-model) native-level review, V32 status `SYNTHETIC_NATIVE_REVIEWED_V32` |
| Human native review | **none, for any locale** (the 86 team-identity strings rewritten on 2026-11-21 in 21 locales are AI-drafted like the rest) |
| Unintended English (owner req. 7) | `npm run qa:lang-leak`, 2026-11-21 (final builds of the exhaustive pass): **0 leaks** on 415 rendered pages; all 20 Student locales at 100 % of the Student manifest (no locale hidden); allow-list limited to brand/test names, acronyms, currencies, file types and data-origin names ([`qa/launch-final/l10n/summary.md`](qa/launch-final/l10n/summary.md)). Scholarship conditions copied from university sources are marked `data-no-l10n` and remain in their source language until a catalogue translation pipeline exists |

V32 measured 9,126 active keys of 13,556; 3,668 customer-critical; 48,606 strings changed in 34 locales. Record:
`docs/qa/v32/l10n/LANGUAGE_SIGNOFF.md`. `console-locales.ts` was regenerated on 2026-11-20: consoles stay ko + en (other
locales' console namespaces are 17–35 % complete).

## 8. Final launch QA

### Product-excellence pass (2026-11-22)

Evidence: [`qa/launch-final/excellence/`](qa/launch-final/excellence/README.md) (task map and counts, scorecard, screens,
JSON results, human translation queue). Signed-in screens in Design Preview on the production builds; scale and failure
conditions against the real API.

| Area | Result |
|---|---|
| Task efficiency | 11 representative tasks walked before/after ([`TASKS.md`](qa/launch-final/excellence/TASKS.md)): match reasons 1 click → 0; team message → its document ≥ 3 clicks → 1; Student next action panel y≈340 → 243 px at 390; Documents 3,493 → 2,590 px opening on the 5 to-do items; University's first applicant rows above the fold at 1440 |
| WCAG 2.2 (`wcag22.mjs`) | **2.4.11 Focus Not Obscured:** 42 screens × 390/1440, 2,520 real Tab / Shift+Tab presses, **0 obscured** (first run: 22 — the consoles' skip link under the header, controls under sticky bars; fixed by a global focus keeper and a fixed skip link). **3.3.8** 5/5 auth forms (username / current-password / new-password / one-time-code, no paste block, no puzzle). **2.5.7** every drop zone has a picker button; no draggable lists. **3.2.6** help (Messages, 더보기) in the same place on every Student route. **3.3.7** sign-up data reused (nationality → profile and residence; name/e-mail never asked again) |
| axe (WCAG 2.0/2.1/**2.2** A/AA, 390 + 1280) | **260 scans, 0 serious/critical** — the new 2.2 rules first found `target-size` on 3 Operations pages (deadline list, Insights links overlapping by the shared hit-area rule's negative margin): fixed |
| Rendered audit (`audit.mjs`, all four products, 320/390/768/1440) | 520 pages: no new finding; every listed item is in the reviewed categories (chat panes, URL-opened drawers, HQ readiness variable names, the HQ picker list) — the University message *list* scrolled inside a box at 320 px and is now the page on phones |
| Overlays / body lock | Student 70 route runs, Operations 104, University 54: **0 problems** |
| Responsive (12 widths 320–1920) | **1,560 loads, 0 page-level overflow** |
| Language leak | **0 leaks on 415 pages** (21 new strings × 21 Student locales) |
| Design Preview isolation (strict) | 3 apps, **0 failures** |
| Core Web Vitals (lab, 4× CPU, cold, median of 3; final builds) | LCP (390 / 1440): Marketing home 2.48 / **2.90** s (2.36 / 2.46 in the previous run — the hero headline waits for the client bundle), directory 2.24 / 2.14, university 2.31 / 2.34; Student home 1.62 / 1.68, Match 1.36 / 1.34, application 1.75 / 1.70, documents 1.40 / 1.96, thread 1.57 / 1.70; Operations Today 1.39 / 1.47, review 1.16 / 2.08, case 1.90 / **2.58**; University home 2.32 / 2.50, review 1.88 / 1.91 s. Two rows over 2.5 s. **CLS ≤ 0.06 everywhere** (University home 0.68 → 0.012 at 390, Operations case 0.18 → 0.001). Scripted interactions **≤ 200 ms** (Today stage view 264 → 200 ms at 1440; Match 112 ms; message typing 104 ms). Before (exhaustive pass, same method): LCP 1.4–3.3 s, University overview 3.26 s at 390 — [`results/vitals.json`](qa/launch-final/excellence/results/vitals.json) |
| Operations at scale (`ops-scale.mjs`; real API, isolated DB: 1,071 students, 3,722 tasks, 1,011 University applications; dropped afterwards) | Today first ranked row **1.18 s**; lane filter 85 ms; stage view 165 ms; Students first row 1.28 s; search 0.71 s; sort 78 ms; next page 94 ms; open a row → case 1.04 s; deadline-7 view 1.44 s. Every count settles in ≈5–6 s on one development API process (`GET /agency/today/queue` ≈1.05 s alone) — production needs several workers ([ROADMAP](ROADMAP.md) §3) |
| Failure conditions (`e2e/failure-conditions.spec.ts`, real API) | Student home / documents / applications, Operations Today, University home × slow 1 s, slow 3 s, offline, 500: no raw transport text, no blank page, Retry recovers; a stalled request becomes an error with Retry; an expired session returns to sign-in — **7/7**. Fixed on the way: the Student home waited ≈42 s on a stalled API (the plan gate re-mounted a failed dashboard query for a second 20 s wait) and now errors at the 20 s client deadline; the University home's Retry now refetches everything that failed with the table, and an unreadable programme list shows the next date as unknown instead of "no dates set" |
| End-to-end, isolated real stack | **62/62** (critical + journeys + failure conditions; final run on the final code). A race found by repetition: on the Student visa page, opening the official site records a hand-off in the background; recording the receipt right after could be overwritten on screen by the older hand-off response (1 run in 3). Plan updates are now newest-request-wins; 6/6 consecutive passes after the fix |
| Student scroll gate | **130/130** |
| Unit tests | Student 195, Operations 64, University 72, Marketing 90 (+22 skipped), Student native 23 — PASS |
| Static gates | Typecheck (7 workspaces), i18n check, docs links (215, 0 broken), source/bundle leak scan (2,045 files), Design Preview gate (bundles on, owner-review state): PASS; security scan 0 unauthorized occurrences (Redis not running here: skipped, not counted). The rendered wording scan (`qa:leak`) needs the development stack with demo sign-ins and was not run. API: no server change in this pass; pytest not re-run |
| Native | Not run: no `/dev/kvm`, no CPU virtualisation exposed in this WSL VM, no device — an Android emulator cannot start here; iOS needs macOS. Source inspection: safe areas through the shared `Screen` (`useSafeAreaInsets`), keyboard avoidance in the shared `Keyboard`/`Screen`/messages composer and sign-up, pickers as sheets, deep-link scheme `hangyul-student` and the web-checkout return by deep link; no universal links / associated domains configured (iOS external verification) |

### Exhaustive product-quality pass (2026-11-21)

Evidence: [`qa/launch-final/exhaustive/`](qa/launch-final/exhaustive/README.md) (routes, defects, JSON results, before/after
screens). Signed-in screens in Design Preview on the four production builds; journeys on the isolated real stack.

| Area | Result |
|---|---|
| Route inventory | Code-derived from the three routers: Student 37, Operations 46, University 27 router paths + Marketing 6 public routes; 130 route entries in the gate list (was 115: `/match`, the purchase gate, saved universities, Operations document review and seven HQ routes added) — [`ROUTES.md`](qa/launch-final/exhaustive/ROUTES.md) |
| Defects | 29 product defects found, 29 fixed; 3 QA-harness defects that hid product defects, fixed — [`DEFECTS.md`](qa/launch-final/exhaustive/DEFECTS.md) |
| Rendered audit (`audit.mjs`: scroll oracle top → middle → bottom, page overflow, 12 px floor, touch targets with the WCAG 2.5.8 spacing exception, native selects, leaked enum tokens, page errors) | Student 156 pages (320/390/768/1440), Operations + University 255 (390/768/1440), Marketing 24 (320–1440): **0 page-level horizontal overflow, 0 unreachable page bottoms, 0 native selects, 0 page errors**. Remaining flags are reviewed exceptions (chat panes, URL-opened drawers, HQ readiness env names) |
| Overlays (`overlays.mjs`: every popup/select/menu/dialog opened → Escape → lock released; resize while open; Back/Forward) | Student 140 route runs, University 54: 0 problems. Operations 106: 0 product problems (2 harness false positives — URL-opened drawer, always-visible picker list — fixed in the script). All-buttons mode (every button in `<main>`, dialogs included): Student 343 pressed / 64 overlays, consoles 1440: no leak; the one finding (unhandled failure on "mark all read") was fixed |
| Student scroll gate (`e2e/student-scroll.spec.ts`, 32 routes × 320/390/768/1440 + drawers) | **130/130** on the final Student build (the spec now starts every page at the top: a chat thread opens at its newest message) |
| Responsive (`matrix.mjs`, 12 widths 320–1920) | 1,560 page loads, all four products: 5 overflowing loads, all one row (University team roster, "Inactive" status at 320–393 px) — fixed and re-run on the final builds (below) |
| Zoom 125 / 150 / 200 % (768/1280/1440 windows) | 390 loads each: 0 / 0 / 1 overflow (the same roster row at 768 @ 200 %) — fixed |
| Languages ko · vi · ja · zh-Hans · ru · ar (Marketing + Student, 320/390/1440) | 135 loads each, **0 overflow**; Arabic `dir="rtl"`; Korean `keep-all` wrapping overflow-free |
| Dark-mode device | 260 loads, `color-scheme` stays light everywhere; 1 overflow = the roster row — fixed |
| Accessibility (axe WCAG 2.1 A/AA, 390 and 1280, every gate route) | **260 scans, 0 serious/critical** on the final builds |
| Design Preview isolation (strict) | 3 apps, 0 failures: 0 `/api` requests, no fixture miss (an HQ fixture was added), indicator present, writes refused |
| Language leak (`qa:lang-leak`) | **0 leaks on 415 pages** on the final builds (one regression from this pass — an untranslated team-card line in 9 locales — was caught and fixed first) |
| Performance (lab, 4× CPU, cold load) | LCP 1.4–3.3 s; **CLS ≤ 0.065 everywhere** — the University overview (0.65 at 390 px) and analytics (0.48) shifted after first paint and now hold their final geometry while loading ([`results/perf.tsv`](qa/launch-final/exhaustive/results/perf.tsv)) |
| URL-opened drawers (Student document, Operations application, submission) | 12/12 at 320/390/768/1440: body scrolls to its last item, close stays visible, Escape closes, URL updates, page unlocks |
| API (PostgreSQL 14 + Redis 6) | ruff PASS; pytest **690 passed, 13 skipped, 0 failed** |
| End-to-end, isolated real stack | Critical set **30/30** (lifecycle, tenancy, contract, Student/Operations/University journeys, redesign) incl. the new `student-ops-message.spec.ts`: register → buy → assigned to Operations → student writes in the Student UI → Operations sees it and replies → the student sees it signed "Hangyul Univ team", no staff name. Journey set **22/22** (dossier, writing, visa, arrival, submission, Myanmar, Nepal, selects). 14 tests in 12 spec files had gone stale with the 261119 owner changes (Quick Fit retired, `/match` paid, Saramin document manager, `FileDrop`, custom Select) and were brought to current behaviour — none removed |
| Web unit tests | Student 195 (+2), Operations 64, University 72, Marketing 90 (+22 skipped), Student native 23 — PASS |
| Typecheck · i18n · tokens · docs links · leak (source + bundles) · Design Preview gate (bundles on) | PASS |
| Security scan (tracked tree, runtime capture, database, Redis) | 0 unauthorized occurrences |
| Production (Vercel, 2026-11-21) | Commits `7c7824d6` (the pass) and `79635819` (names found on the live site after the first deploy) built and served on all four domains; `scripts/qa/launch-final/smoke.mjs`: **0 failures** (commit marker, no page error or failed request, no overflow at 390/1440, same-origin `/api/v1/auth/me` → 401, security headers, preview entry). Live check: Pretendard loads, "NaN명" gone from the SNU page, Operations Today and Student home show Korean university names, no console errors |
| Connected API (2026-11-21) | `catalog/status` READY · 425 universities · 469 programmes; `auth/me` 401; still behind the ngrok tunnel |
| Native | Three apps typecheck; Student native 23 tests. **Not run on an emulator or device** — no KVM, Android SDK or Xcode on this machine |

### Owner-improvement pass 261119 (2026-11-20)

| Area | Result |
|---|---|
| API (PostgreSQL 14 + Redis 6 + poppler on the QA host) | `scripts/qa/launch-final/api.sh`: ruff PASS; full pytest **0 failures** (~703 tests, 13 skipped). The 8 failures carried as "pre-existing" were fixed: poppler is now found on PATH (`HG_PDFTOTEXT` override), the fixture-guide builder moves document links to its copies (order-dependent `test_tenant_isolation`), and the submission tests create a throwaway open intake once the fixed fixture dates pass |
| Migration `v34catalog0001` | upgrade on a fresh DB, on a seeded DB at `v33billing0001`, downgrade → upgrade: PASS (`tests/test_v34_catalog.py`, isolated databases) |
| Catalogue | bootstrap of an empty catalogue, Monday 09:00 KST window, advisory lock, partial source failure, provenance kept, OR-within/AND-across filters, flat query count, ETag/304, parity of `/directory` and `/universities`: tests PASS; `npm run qa:catalog-parity` 26/26 against a local API |
| Typecheck / web unit / builds | 7 workspaces PASS · 442 web unit tests PASS (Student 193, Operations 64, University 72, Marketing 90 + 22 skipped, Student native 23) · four production builds PASS (Marketing prerenders 425 pages from the DB-generated snapshot) |
| Owner req. 2 | `e2e/auth-entry-flash.spec.ts` 13/13 on the final production build — 0 wrong-form frames ([`after/e2e/auth-entry-flash.txt`](qa/launch-final/after/e2e/auth-entry-flash.txt)) |
| Owner req. 5 | `e2e/student-scroll.spec.ts` 130/130 (32 routes × 4 widths + drawers) on the final preview build ([`after/e2e/student-scroll.txt`](qa/launch-final/after/e2e/student-scroll.txt)) |
| Owner req. 7 | `npm run qa:lang-leak` 0 leaks on 415 pages |
| Owner req. 6 | Documents screenshots at 320/390/768/1440 (Design Preview) reviewed against the PDF p3–p4 reference |
| Launch chain (`npm run qa:launch`, ledger `qa/launch-final/after/logs/ledger.txt`) | **21/21 steps PASS** (steps re-run one by one after the host reclaimed memory mid-chain): docs gates, leak scans (source + bundles), i18n, tokens, typecheck, web unit, builds with preview on and off + both preview gates, preview isolation (0 `/api` calls), sign-up walks ko/ar, responsive 1,428 loads at 12 widths **0 overflow** (the run first found the Operations student header overflowing at 320/360 — fixed with `minmax(0, 1fr)` on `.ops-case`), zoom 125/150/200 %, languages ko/vi/ja/zh-Hans/ru/ar (126 loads each, `dir=rtl` for ar), dark device 238 loads, axe WCAG 2.1 A/AA 238 scans **0 serious/critical** |
| Native | three apps typecheck; Student native 23 tests; `expo export --platform android` PASS. **Not run on a device or emulator** |

### Final product pass (2026-11-19)

| Area | Result |
|---|---|
| API tests (local PostgreSQL 16 + Redis stand-in) | 44 new billing-key tests PASS. Full suite: all pass except **8** in `test_v5_dossier`, `test_v5_success`, `test_v6_submission`, `test_v9_adversarial` — every one also fails on an untouched checkout of the previous HEAD (9 there), so they are pre-existing |
| API lint (ruff, whole server tree) | PASS |
| Migration `v33billing0001` | upgrade → downgrade → upgrade PASS on a fresh database |
| Typecheck | PASS, 7 workspaces |
| Web unit tests | PASS — agency 64, marketing 78 (+22 skipped), student-mobile 14, student 129, university 72 |
| Production builds | PASS, 4 web apps; marketing prerenders 425 university pages |
| i18n check | PASS (pre-existing ko `_one` plural warnings) |
| Security scan (tracked tree + database) | 0 unauthorized occurrences |
| Payment release gate | **FAIL, as expected**: no live merchant configured, live payment disabled, no verified capability. Bundle scan inside the gate: no secret and no non-billing payment call in any of the four built bundles |
| Responsive (320–1920, 10 widths, every major route of Student / Operations / University / university detail) | 0 horizontal overflow |
| Accessibility (axe WCAG 2.1 A/AA, 390 and 1280) | 0 serious/critical — Student 17 screens, Operations 98 scans, University 28 routes, university detail 3 pages (en, ar) |
| Operations counts = rows | 54 of 54 clicks |
| End-to-end on an isolated stack (real API, seeded PostgreSQL, four production builds) | **28 / 28 PASS** — purchase contract and add-on, tenancy, full student lifecycle (purchase → assignment → documents → essay → university decision → offer → visa), Student / Operations / University core journeys, Today rail counts. 7 tests had been failing before this pass (stale selectors for the V32 custom select and older copy); they were repaired, not skipped |
| Native apps, rendered through Expo web (react-native-web) at 360 / 390 / 430 against a seeded API | 12 defects found and fixed (language list as a bottom sheet, duplicate version line, API address hidden outside development, plan selection, tappable blocked items ≥44 pt, broken campus images hidden, doubled "Overdue", Korean step names…). **Not a device check:** native fonts, safe areas, keyboard and pickers are unverified |

Not run in this pass: real-account journeys against the production API (the tunnelled API was down), native builds on a
device or emulator (no KVM/Android toolchain on this machine), any live Toss request, production smoke of the payment
backend (none exists).

<!-- LAUNCH-QA:START -->

Launch-readiness pass of 2026-11-18. Gate chain: `npm run qa:launch` (`scripts/qa/launch-final/chain.sh`); ledger and
logs in `docs/qa/launch-final/after/logs/`. Everything below ran against the four production builds served locally;
the signed-in screens ran in Design Preview (synthetic fixtures), sign-up with the identity API mocked at the network
layer. **What this pass did not run is listed under the table and is not covered by any PASS here.**

| Area | Result | Evidence |
|---|---|---|
| Route inventory | 120 routes (12 public + 108 signed-in) across the four web products | [`ROUTE_INVENTORY.md`](qa/launch-final/ROUTE_INVENTORY.md) |
| Visual defects | 25 found, 25 fixed (most in shared tokens/primitives); 2 left open for a person | [`VISUAL_DEFECT_MATRIX.md`](qa/launch-final/VISUAL_DEFECT_MATRIX.md) |
| Responsive, 12 viewports 320–1920 | PASS — 1,440 page loads, 0 page-level horizontal overflow | `after/matrix.json` |
| Zoom 125 / 150 / 200 % | PASS — 360 loads each, 0 overflow | `after/matrix-z125.json`, `-z150`, `-z200` |
| Languages ko · vi · ja · zh-Hans · ru · ar (Marketing + Student, 320 / 390 / 1440) | PASS — 129 loads each, 0 overflow; Arabic renders `dir="rtl"` | `after/matrix-<lang>.json` |
| Dark-mode device | PASS — 240 loads; `color-scheme` stays light on every page | `after/matrix-dark.json` |
| Accessibility (axe WCAG 2.1 A/AA, 390 and 1280) | PASS — 240 page scans, 0 serious or critical violations | `after/a11y.json` |
| Sign-up walk (account → verification pending / wrong code / verified → consent), 12 viewports, ko and ar | PASS — no overflow; code field and Verify stack on phones; controls ≥ 44 px | `after/signup/` |
| Design Preview isolation | PASS — Student, Operations, University: 0 network requests to `/api` on any of 108 preview screens; unpaid → paywall → "preview without paying" → entitled; Exit clears state | `after/preview-isolation.json` |
| Design Preview release gate | PASS — one switch, no network code in the transport, fixture hygiene; bundles built with the flag off contain no preview code | `after/logs/08-…`, `21-…` |
| Static gates | PASS — docs gates and links, leak scan (source and bundles), i18n, tokens current, typecheck (7 workspaces), 332 web/package unit tests, four production builds | `after/logs/ledger.txt` |
| Production smoke (4 real domains, commit `e3f0e0f4`) | PASS — all four serve the commit; `/api/v1/auth/me` → 401 JSON and five private endpoints closed to anonymous access on every domain; security headers present; no page error, failed request, dev-origin URL or overflow at 390 / 1440; preview entry present on Student, Operations, University. Live route sweep: 240 loads (every route at 390 and 1440), 0 overflow, 0 errors. Live preview: 0 requests to `/api` | `after/production-smoke.json`, `after/production/` |

**Not run in this pass (no PASS is claimed for these):**

- **API test suite, API lint and seeded end-to-end tests** (`npm run qa:v32` steps 05, 06, 10–14): the QA machine had no
  Python ≥ 3.11, PostgreSQL or Docker. The last recorded full run is the V32 one below.
- **Real-account journeys against the connected API** (student login → application → documents → messages; staff and
  university logins): no credentials were available, and a real sign-up sends live e-mail and SMS codes. The connected
  API was verified only from outside: it answers, and it refuses anonymous access to private endpoints.
- **Native apps**: no Android/iOS toolchain. The shared changes that reach them (sign-up progress indicator, app name
  "Hangyul Operations", translated strings) typecheck and pass the student-mobile unit tests; nothing was built or run
  on a device.
- **Human review**: no native-speaker review of the 1,820 strings rewritten in 53 locales (machine-translated, like
  the rest of each bundle); no human screen-reader walk-through.

<!-- LAUNCH-QA:END -->

Last full gate run on record (V32, 2026-11-04, `QA_V32_NATIVE=1 npm run qa:v32`): all 17 steps PASS — leak (source
and bundles), data-clean, i18n over 56 bundles, typecheck (7 workspaces), API lint, 619 API tests, web unit suites,
four production builds, marketing serverless 23/23, selects 7/7, crawl of every route at 1440 and 390 with 0
findings, axe WCAG 2.1 AA with 0 serious/critical, critical E2E 9/9, native sign-up against the e2e API, teardown,
three Expo production exports. `npm run release:check` (2026-10-31): PASS 38 · FAIL_LOCAL 0 · BLOCKED_EXTERNAL 18 →
NOT_READY_FOR_PRODUCTION. Neither has been re-run on the current tree for this report.

## 9. Current known blockers

Full list with owners: [ROADMAP.md](ROADMAP.md).

| # | Blocker | Type |
|---|---|---|
| 1 | No durable production API host (tunnel to a personal machine; `api.` subdomain fails TLS) | Infrastructure |
| 3 | Design Preview flag is ON for owner review (`build.env` in three `vercel.json`); must be removed before public launch (`npm run release:preview-gate -- --launch --bundles off`) | Release |
| 4 | Live payments: billing-key rail built and tested, but no live Toss credentials installed, no production payment host, no live capability verified (easy-pay billing undocumented by Toss; overseas-card billing unconfirmed; KRW merchants vs USD-only catalogue); refund schedule and upgrade rule undecided — [`payments/BILLING.md`](payments/BILLING.md) §6–7 | Owner / Toss |
| 5 | Production SendGrid / Twilio / Turnstile credentials and live delivery check | Owner |
| 6 | Legal: ten company identity fields, counsel review, retention periods | Owner / counsel |
| 7 | Independent penetration test | Owner |
| 8 | iOS not built; Android to be rebuilt with the Play upload key | Owner |
| 9 | No human native-speaker review of any language; no usability sessions | People |
| 11 | Privacy policy and terms still describe a "partner agency" receiving data (10 keys under `marketing.v12.privacy.*` / `v12.terms.*`, all locales) — legal text was not edited; needs counsel sign-off to match the direct-operation model | Owner / counsel |
| 12 | Real-account journeys against the **connected** API were not run (no staff/student credentials for the owner's database; a real sign-up sends live e-mail and SMS) — the same journeys pass on the isolated stack (§8). Native apps were not run on an emulator or device: this machine has no KVM, Android SDK or Xcode | Owner (host) / device |
| 10 | 176 institutions without verified rules; 259 without an own photograph; no recorded university agreement | Data / partnerships |

Could not be verified from this workspace: whether SendGrid/Twilio credentials are now configured on the connected
host (the last two commits add production message copy and the Twilio SDK; the last recorded live check was BLOCKED);
current Android build state.

## 10. Changelog summary

One line per pass; detail is in git history (`git log`, and earlier versions of this file).

| Version | Date | Summary |
|---|---|---|
| V1–V2 | 2026-09-28 | First audit of all web products; redesign strategy and design system v2 |
| V3 | 2026-09-29 | Independent audit; university SSO (OIDC); stakeholder review |
| V4 | 2026-09-29 | Product excellence pass; one application state map for all products |
| V5 | 2026-09-29 | Admission success: strategy, dossier, writing review, submission, visa routes, arrival |
| V6 | 2026-10-01 | Visual and product pass; connector completion; wider locale set |
| V7 | 2026-10 | Template-first rebuild: Eduan (marketing), YNEX (consoles) |
| V8 | 2026-10-09 | Simplification; translation status taxonomy; RTL QA |
| V9 | 2026-10-14 | Service operating system: waiting-on model, student-app locale gate, visa/arrival revalidation |
| V10 | 2026-10-16 | Koreanasha-based marketing site; public site student-only, Login as the account action |
| V11 | 2026-10 | Complexity reduction; owner copy fidelity pinned |
| V12 | 2026-10-17 | Production-likeness: generated legal pages, 425-institution directory, nothing unverifiable on public pages |
| V13 | 2026-10 | Visual hierarchy; country simulations; scale simulations |
| V14 | 2026-10-18 | Media licence audit (two-tier rule, `/credits` retired); 32-market localization; language URLs |
| V15 | 2026-10-19 | Commercial model with one source of truth; entitlements; pricing UX |
| V16–V17 | 2026-10 | Student journey gates; plans priced in USD; university enrichment |
| V18 | 2026-10 | Local API port moved to 8001; Myanmar market; honest locale coverage measurement |
| V19 | 2026-10-20 | Navigation correctness and zero-defect pass; error matrix, click map |
| V20 | 2026-10 | Region photography; button matrix; university content audit |
| V21 | 2026-10-21 | Toss foreign-card key-in checkout on Hangyul's own card form |
| V22 | 2026-10-23 | Verified four-step registration; one role per tenant; white consoles; legal research |
| V23 | 2026-10 | Server fails closed; social footer; 425/425 intentional directory visuals; priority-surface localization |
| V24 | 2026-10 | University media coverage and photo review |
| V25 | 2026-10-27 | Photo-first directory (166/425 own photographs); one action shape; Android builds for three apps |
| V26 | 2026-10-28 | Forensic root-cause pass (29 causes, each gated); deep links; scale and performance; repository cleanup |
| V27 | 2026-10-29 | Quick Fit in four honest groups; verified scholarships and language rules; checklists only from verified guides |
| V28 | 2026-10-29 | Polish; names follow the reader's language; A/B keys complete in all offered locales |
| V29 | 2026-10-30 | Owner service contract ($179 / $349 / $599), engagements, add-ons; MFA, clamd, S3, retention, backups; `release:check` |
| V30 | 2026-11-01 | Visual integrity: marquee hitboxes, `FilterSelect`, route-inventory crawl |
| V31 | 2026-11-01 | Design-system neutral ramp, pipeline rail, pricing tail, language quality pass |
| P0 hotfix | 2026-11-03 | Public discovery without the API: static export + Vercel fit function (`78d61c8b`, `df215089`, `b6f3c834`) |
| V32 | 2026-11-04 | Release candidate: test access removed, seed split, one select, service-unavailable state, every locale re-reviewed (`dd552834`) |
| post-V32 | 2026-11-04 | Mobile hero and header polish (`65989b12`, `18a49ee8`, `0925764c`) |
| post-V32 | 2026-11-09 | English marketing copy and FAQ (`61259db6`) |
| post-V32 | 2026-11-17 | Final Hangyul Univ branding and social metadata; orange branding on web and Android (`bc6be153`, `50e4f14c`) |
| post-V32 | 2026-11-18 | Local stack reachable through ngrok; Vercel `/api` routed to the tunnel (`9a306bee`, `72cfca1c`) |
| post-V32 | 2026-11-18 | Twilio SDK declared; production copy for verification e-mail and SMS (`47c8fec5`, `fd2f4ba7`) |
| Final product pass | 2026-11-19 | Billing-key-only payments (registration → sealed key → one charge; old rails removed), payment methods UI, Operations refunds; shared design foundation de-greyed; Student, Operations, University and university detail redesigned |
| Owner pass 261119 | 2026-11-20 | `유학 준비` → login → payment → `/match`; Quick Fit retired; no auth-form flash; one DB catalogue with self-bootstrap and Monday 09:00 KST refresh (469 official-guide programmes); drag & drop on every web uploader; scroll root causes fixed; Saramin-model document manager; 0 English leaks in 20 locales; HQ/University preview fixes; API suite fully green |
| Product-excellence pass | 2026-11-22 | Smaller-feeling product: Student journey folded under one next action, Documents open on to-do, match reasons on the row, messages as a conversation with deep links, profile in three chapters; Operations Today as a work queue with shortcut discovery; University home as a review inbox and safer decisions; WCAG 2.2 gate (focus not obscured, auth, target size) and Core Web Vitals / scale / failure-condition tests |
| Exhaustive pass | 2026-11-21 | Rendered audit of every route (scroll oracle, overlays, touch targets, 12 px floor); 29 defects fixed: one language per screen, team identity in 21 locales, failed sends keep attachments, localized errors (75 sites), phone targets and type floor, Korean word wrapping; student → Operations message proven end to end; 14 stale E2E tests (12 spec files) brought to the owner flows |
| Launch pass (`e3f0e0f4`) | 2026-11-18 | Shared gutter/container tokens and control states; sign-up verification and footer rebuilt; 25 visual defects fixed; Design Preview mode; direct-operation copy in every locale; docs consolidated to 19 root files; historical QA output removed; this report rewritten |
