# Document automation — the universal dossier (V5)

**Goal:** the student prepares each fact and document once; Hangyul works out where it can be reused, what is wrong with it,
and what each application still needs.

Owner: dossier workstream. Code: `server/app/services/dossier.py`, `server/app/services/extraction.py`,
`server/app/api/v1/dossier.py`, models `server/app/models/v5_dossier.py` (migration `f5d055e1a001`), seed
`server/app/seed/extra_51_dossier.py`, student UI `apps/student-web/src/pages/Documents.tsx` +
`components/dossier/DossierParts.tsx` + `components/UploadModal.tsx` + `components/DocumentDrawer.tsx`, agency UI
`apps/agency-web/src/components/DossierPanel.tsx`, i18n namespace `dossier` (en, ko; my machine draft for student keys).

## 1. Current implementation

| Piece | What it does | Where |
|---|---|---|
| Universal dossier | `GET /me/dossier` (student) and `GET /agency/students/{id}/dossier` (assigned agency / Hangyul): profile facts, one row per document category (canonical copy + legitimately different copies + superseded), applicability per application requirement, open findings, extraction suggestions, per-application packages, open university requests with a reuse suggestion | `build_dossier` |
| Applicability | For each document × requirement: `READY` · `NEAR_EXPIRY` · `IN_REVIEW` · `NEEDS_FIX` · `NEEDS_NEW_VERSION` · `NEEDS_LEGALIZATION` · `NEEDS_TRANSLATION` · `EXPIRED` · `MISSING`, each with a reason `{code, params, text}` | `evaluate` |
| Document intelligence | Findings with `{code, severity, explanation, action}` stored in `document_findings`; staff resolve / dismiss / reopen | `compute_findings`, `sync_findings`, `POST /dossier/findings/{id}/{resolve\|dismiss\|reopen}` |
| Extraction suggestions | Values read from files, stored as `SUGGESTED`; written to the profile only on explicit Confirm (optionally edited); Not right → `REJECTED` | `extraction.py`, `apply_confirmation`, `POST /dossier/extractions/{id}/{confirm\|reject}` |
| Package builder | Per application: requirements + university requests → buckets ready / waiting for the student / waiting for the counselor / asked for by the university; "Your application documents are ready." when complete | `GET /applications/{id}/package`, `package_items` |
| Duplicate minimisation | Before an upload: "You already have a verified transcript used by 2 applications — replace it or add a different version?" with the reason a new copy might be needed; for a university request: "Send your existing …" or "Upload a newer …" (replaces in place) | `GET /me/dossier/reuse`, `POST /me/dossier/reuse-decisions`, `POST /dossier/requests/{id}/send-existing` |
| Metrics | duplicate uploads avoided, first-pass acceptance (n, period, withheld n<5), documents requested per application | `dossier_metrics(db, scope)`, `GET /dossier/metrics` |

## 2. Rules

### Applicability (first matching rule wins)
1. No document of the category → `MISSING`.
2. `status = EXPIRED` or `expires_on` before the reference date → `EXPIRED` ("you need a newly issued copy").
3. `DocumentRequirement.max_age_days` and the document is older than that at the reference date → `NEEDS_NEW_VERSION`
   ("Pusan National University needs a certificate issued within the last 30 days (yours is from …)").
   *Reference date* = today while preparing; the **submission date** for an application already sent (a certificate that
   was fresh when Pusan received it stays valid for Pusan).
4. `NEEDS_CORRECTION` → `NEEDS_FIX` with the counselor's reason.
5. Requirement needs legalization and the document was issued outside Korea → route from `route_for`:
   a `LegalizationRule` for the issuing country wins (Nepal, Myanmar, Sri Lanka, Cambodia → consular); otherwise the
   Country's time-versioned Hague Apostille membership **on the reference date** (Viet Nam: consular before 2026-09-11,
   apostille from that date; Thailand from 2027-02-28). Not completed, or completed on the wrong route → `NEEDS_LEGALIZATION`.
   A consular legalization completed before a country joined the Convention is accepted.
6. Requirement needs translation and staff marked the translation as needed → `NEEDS_TRANSLATION`.
7. Not verified yet → `IN_REVIEW`.
8. Verified, but expires / becomes too old before the application deadline → `NEAR_EXPIRY` (still usable, warned). Passport
   expiring within 6 months after the semester start → `NEAR_EXPIRY` (*Hangyul rule*, not an official one: many embassies
   ask for ≥ 6 months of validity).
9. Otherwise `READY`.

Best copy per requirement: the copy with the best status (then the newest issue date). For an application already sent,
the copy linked at submission (`ApplicationDocument`) is used.

### Translation status
`NOT_NEEDED` (Korean/English) · `PROVIDED` (verified by Hangyul — verification includes checking the translation — or set by
staff) · `NEEDED` (set by staff) · `CHECK` (foreign-language, not verified yet: the student sees "Include a certified
translation; if it's already in the file, nothing to do") · `UNKNOWN` (language not given). Staff set it in the agency
workspace (`POST /dossier/documents/{id}/translation`).

### Findings
| Code | Severity | Computed from |
|---|---|---|
| EXPIRED | blocker | `expires_on` / status |
| NEAR_EXPIRY | warning | expiry before a deadline / passport margin |
| NEW_ISSUE_NEEDED | warning | any application needs a newer copy (`max_age_days`) |
| LEGALIZATION_NEEDED | warning | route rule above |
| TRANSLATION_NEEDED / TRANSLATION_CHECK | warning / info | translation status |
| POOR_SCAN | warning | image < 1000 px long side or < 600 px short side, or image file < 25 KB |
| UNREADABLE | blocker | PDF with no text layer and < 15 KB |
| WRONG_TYPE | warning | detected type (passport MRZ, keywords in the text, file name) differs from the category (compatible groups excepted) |
| MISSING_PAGES | warning | page count < "N pages" stated in the requirement notes (only when a requirement states it — none in the seeded catalogue yet) |
| NAME_MISMATCH | warning | extracted name (identity/education documents only) vs account name, accent- and order-insensitive |
| DOB_MISMATCH / DATE_MISMATCH | warning | extracted date of birth / graduation year vs profile |
| DUPLICATE / POSSIBLE_DUPLICATE | info | same SHA-256 as another document / same size in the same category |

Findings are recomputed on every dossier read. One that no longer applies is auto-resolved (and may reopen); a staff
resolution or dismissal is sticky for that file version. A new version starts fresh.

### Extraction (suggestions only)
* PDFs with a text layer: `pdftotext` / `pdfinfo` (poppler) run in a child process capped with `prlimit`
  (512 MB address space, 8 s CPU) and an 8 s timeout. First 6 pages only.
* Passport MRZ (ICAO 9303 TD3) parsed from the text; all three check digits valid → confidence **high**, otherwise medium.
* Labelled lines ("Date of birth:", "Date of issue:", "Cumulative GPA: 8.6 / 10", "TOPIK … Level 4", "School:") → medium.
* File name dates → low.
* **No OCR**: tesseract is not installed, so photos and scanned (image-only) PDFs yield no fields — the UI says so
  ("It can't read photos or scanned images"). Image files only get their pixel size (header parsing, no image library).
* **No AI**: `HG_AI_PROVIDER` is not used here; everything is labelled "Automatic check".
* Passport and document numbers are stored masked (`mask()`: last 3 / 4 characters). Full text is never stored — only
  its length.
* Students only see suggestions that have a target (date of birth, passport expiry/number, issue/expiry date, graduation
  year, GPA, school, test score); values that already match the profile collapse to "6 details match your profile".
  Name / nationality / document number suggestions are staff-only (name differences become a finding).
* **Confirm** writes exactly one target (listed on the card: "Confirming updates: your GPA"); **Edit** validates the value;
  **Not right** writes nothing. Every decision is audited (`dossier.extraction_confirmed|rejected`).

## 3. Sources
* Apostille membership and effective dates: `countries.apostille_*` (HCCH status table, per `docs/research`), legalization
  rules: `legalization_rules` (seeded, with verification status). Date-dependent: rules are evaluated on the reference date.
* University freshness requirements: `document_requirements.max_age_days` (DEMO catalogue values). A university request
  that says "issued within the last N days" overrides it for that request.
* MRZ format: ICAO Doc 9303 Part 4 (TD3 passports).

## 4. Integration capability
* Visa workstream hook: `applicability_for_requirement(db, student, requirement_like, *, today=None, window_end=None) -> dict`
  — same statuses as the application dossier; `window_end` (e.g. embassy appointment) is used for expiry / freshness.
* Coordinator hooks: `dossier_metrics(db, scope)`, `today_items(db, principal)` (agency Today: open staff-relevant findings),
  `home_items(db, student_user_id)` (student Home: "We found N details — please check them", "a university needs a newer …").
* University: `GET /applications/{id}/package` returns only verified documents shared with it (same visibility rule as
  `university_visible_document_ids`).

## 5. Manual fallbacks
* Anything the automatic check cannot read (photos, scans) is reviewed by the counselor as before (V4 review queue).
* Staff can dismiss any finding ("Not a problem") or mark it resolved; set translation status; re-run the check
  (`POST /dossier/documents/{id}/analyze`).
* Students can always upload a different file instead of sending the existing one.

## 6. Security considerations
* Tenant isolation uses the existing helpers (`ensure_student_access`, `get_application_for`, `scope_student_ids`);
  denials are 404. Any agency administrator sees the agency's own students (one role per tenant, V22); universities never see a dossier.
* Untrusted PDFs are parsed only by poppler in a resource-limited child process; files were already magic-byte checked.
* No document text, full passport numbers or full document numbers are persisted.
* Extraction never writes the profile without an explicit confirmation by the student or their assigned staff (audited).

## 7. Known limitations
* No OCR → scanned documents give no suggestions and no name/date checks.
* Name comparison is token-based (accents and order ignored); legitimate name variants (e.g. a married name) produce a
  finding the counselor must dismiss.
* Page-count requirements exist only if requirement notes state "N pages" (none do in the seeded catalogue).
* The duplicate check is exact (hash) or size-based; visually identical re-scans are not detected.
* Findings are recomputed when the dossier is opened (not in a background job), so the agency Today hook sees findings
  as of the last dossier read.
* University lists in English reasons are joined with "and"; the Korean UI shows them inside a translated sentence.

## V9 (2026-10-14)

- **"Who can see this"**: `/me/dossier` returns `visibility` (you · counselor + agency with the consent date · Hangyul reviewers · universities — only what was sent · retention "pending legal approval" · what can be withdrawn) and per-row `sent_to` (university + date). Shown in the document drawer and row lines.
- **Visa reuse** is judged on the appointment date (e.g. a new bank certificate is required on/after a date); route data now carries per-field validity from the 2026-10-10 revalidation (e.g. Myanmar certificate ≤ 30 days; not applied to other countries).
- Findings remain *suggestions until verified*; no silent alteration. Fraud flags are reasons + a human decision, never auto-reject (research §9 #13).
- OCR remains unconfigured (text PDFs and MRZ only) — dependency in REPORT §64.

## V27 — checklists from verified official guides (REPORT §357)

- A checklist is built **only** from the requirements of the latest VERIFIED `admission_guides` row for the university × level ×
  applicant type (`services/guides.py`, `readiness.requirements_for`). Seeded DEMO rows never build one.
- Each requirement carries the guide's Korean name, condition (`applies_to`: nationality, nationality_not, education country,
  residence), original/copy, submission method, translation, notarization, legalization rule, issuance age, source page and
  the quoted evidence.
- `readiness.treatment` decides per item, on the server: legalization NONE / APOSTILLE / CONSULAR / CHINA_CHSI / STAFF_REVIEW /
  UNSPECIFIED (issuing country, else nationality — `country_basis` says which), translation, notarization.
- `LANGUAGE_CERTIFICATE` is met by the student's TOPIK / IELTS / TOEFL document. Conditional items that cannot be decided from
  the profile are shown once as "해당할 때만 내는 서류".
- Test and e2e databases wrap the sample rows in labelled TEST FIXTURE guides (`server/scripts/v27_test_fixture_guides.py`).
