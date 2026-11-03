# V5 workstream log — dossier (universal dossier)

Doc: `docs/DOCUMENT_AUTOMATION.md` (rules, sources, integration, fallbacks, security, limitations).
Migration: **`f5d055e1a001`** (`alembic/versions/f5d055e1a001_v5_dossier.py`, down_revision `a5e7c1d2b901`), applied to the dev DB; single head afterwards.

## Changes (file — what — why, in user terms)
Backend
- `server/app/models/v5_dossier.py` — `DocumentAnalysis`, `DocumentFinding`, `ExtractedField`, `DossierDocumentState`, `DossierReuseEvent`. Stores what the automatic check found, values read from files (as suggestions), staff decisions, reuse decisions.
- `server/app/services/extraction.py` (new) — pdftotext/pdfinfo (prlimit-capped child process), PNG/JPEG/WEBP pixel size from headers, ICAO TD3 MRZ parsing with check digits, labelled-line and filename extraction, document-type detection. No OCR, no AI, no new dependencies.
- `server/app/services/dossier.py` (new) — applicability engine (max_age_days, time-versioned apostille / consular routes, translation, expiry, near-expiry, passport margin), findings (compute + sync, sticky staff decisions), suggestions + `apply_confirmation` (only write path), package builder, reuse check, send-existing, visa hook, metrics, Today/Home hooks.
- `server/app/api/v1/dossier.py` — `GET /me/dossier`, `GET /agency/students/{id}/dossier`, `GET /applications/{id}/package` (university: shared verified docs only), `GET /me/dossier/reuse`, `POST /me/dossier/reuse-decisions`, `POST /dossier/requests/{id}/send-existing`, `POST /dossier/extractions/{id}/confirm|reject`, `POST /dossier/findings/{id}/resolve|dismiss|reopen`, `POST /dossier/documents/{id}/translation`, `POST /dossier/documents/{id}/analyze`, `GET /dossier/metrics`.
- `server/app/seed/extra_51_dossier.py` — Lan's passport (valid MRZ), transcript (GPA 8.6/10 vs profile 8.4) and bank certificate get a text layer; the real extractor runs in the seed → "We found this information" shows GPA to check + 6 matching details. New persona `student.dossier@demo.hangyul.kr` (Trần Minh Thư, VN, Lotus Bridge): Pusan application under review (all docs verified), Kyungpook in preparation, bank certificate 50 days old → "Can be used for Pusan National University. Kyungpook National University needs a certificate issued within the last 30 days". FLOW B starts here. (The persona helper shares documents for every application; the seed un-shares them for the unsubmitted Kyungpook application.)
- Tests: `server/tests/test_v5_dossier.py` (14), `server/tests/test_v5_dossier_flow.py` (FLOW B backend).

Frontend (student)
- `apps/student-web/src/pages/Documents.tsx` — rewritten as the dossier: university requests ("Send your existing …" / "Upload a newer …"), one-line summary, Needs you / Being checked, "We found this information. Please check it." (Confirm / Edit / Not right, matching values collapsed), Ready folded into one line while anything needs the student, kept-for-later collapsed, per-application packages with the list on demand, honest method line. Removed the V4 progress bar/summary block.
- `components/dossier/DossierParts.tsx` (new), `lib/dossier.ts` (+ `dossier.test.ts`, 6 vitest), `src/dossier.css` (new).
- `components/UploadModal.tsx` — duplicate minimisation (Keep using it / Replace it / Add a different version with the reason), request mode (send existing, or replace with a newer copy + issue date), records reuse decisions.
- `components/DocumentDrawer.tsx` — "Where it can be used" per application with reasons, automatic-check notes, suggestions for this file (replaces "Used in applications").
- `pages/ApplicationDetail.tsx` (small edit) — compact package line above the lanes; upload modal for a request gets `requestId/applicationId` so it can offer the existing copy.

Frontend (agency)
- `apps/agency-web/src/components/DossierPanel.tsx` + `src/dossier.css` (new) — package line per application, open findings with Resolved / Not a problem, translation included/needed.
- `pages/StudentWorkspace.tsx` (one-line edit) — panel at the top of the Documents tab.

Shared (append-only)
- `packages/api-client/src/index.ts` — `dossier` section.
- `packages/types/src/index.ts` — Dossier* types.
- `packages/i18n/locales/{en,ko,my}/dossier.json` — en + ko all keys; my = machine draft of student-facing keys (agency keys not in my).

## Hook functions for the coordinator (server/app/services/dossier.py)
- `applicability_for_requirement(db, student, requirement_like, *, today=None, window_end=None) -> dict` — visa workstream.
- `dossier_metrics(db, scope) -> dict` — scope keys: student_ids, organization_id, university_id, since, until. Duplicate uploads avoided (SENT_EXISTING + KEPT_EXISTING events; plus implicit reuse), first-pass acceptance (n, withheld n<5), documents requested per application (withheld n<5).
- `today_items(db, principal) -> list[dict]` — agency Today: open NAME/DOB/DATE mismatch, WRONG_TYPE, POOR_SCAN, UNREADABLE, DUPLICATE, MISSING_PAGES findings; title_key `dossier:finding.*` + params.
- `home_items(db, student_user_id) -> list[dict]` — student Home: `dossier:home.checkDetails`, `dossier:home.NEW_ISSUE_NEEDED|EXPIRED`.
- Existing endpoint used for FLOW B upload path: `POST /document-requests/{id}/fulfill` (already takes document_id; no change).

## Tests run
- `pytest tests/test_v5_dossier.py tests/test_v5_dossier_flow.py tests/test_seed_invariants.py` → 20 passed.
- Full `pytest tests` → all pass except `test_v4_student.py::test_home_names_the_program_when_two_applications_share_a_university` (Lan's engine task "Upload your family relationship certificate for Pusan National University" lacks the program name — tasks_engine / dashboard, not touched by this workstream; appeared before my seed changes affected anything task-related).
- vitest `src/lib/dossier.test.ts` → 6 passed. `tsc` student-web: only error is in `components.test.tsx` (MatchReason.points, another workstream); agency-web clean. ruff: my files clean (2 errors in writing workstream files).
- E2E `e2e/v5-dossier.spec.ts` written, NOT run (coordinator). The modal/request flows were exercised with a one-off Playwright script against the dev stack (screenshots below; the temporary requests were cancelled and the application returned to review).

## Screenshots (docs/qa/v5/dossier/)
stu-lan_documents-390/1440, stu-thu_documents-390/1440, stu-thu application 390/1440, stu-thu-requests-390, stu-thu-upload-newer-390, ag-thu documents tab 1440/390.

## Dev DB note
My seed was applied additively to the dev DB (persona Thư + Lan's text-layer files/analysis). A `db:reset` reproduces it from scratch.

## Could not do / limitations
- No OCR (tesseract absent) → scans/photos give no suggestions; stated in UI and doc.
- Findings are computed when a dossier is read, not on upload (documents.py upload is V4 code); agency Today sees findings as of the last dossier read.
- Page-count checks only when requirement notes state "N pages" (none in the catalogue).
- Burmese for agency keys not added (agency app is not Burmese-facing).
