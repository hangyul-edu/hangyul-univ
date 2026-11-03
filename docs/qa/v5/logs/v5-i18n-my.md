# V5 workstream log — i18n-my (Burmese, FLOW C)

Goal: a Myanmar student using student-web in Burmese goes through Home → application workspace → Documents → Writing → Visa →
Housing/Arrival/Help with no English leakage. Result: `scripts/qa/leak-check.mjs` reports **0 leaks** on all core screens for 8 personas
at 390 and 1440 (report: docs/qa/v5/i18n/leak-report.md; raw: docs/qa/v5/i18n/runs/final.{txt,json}; screenshots: docs/qa/v5/i18n/shots/).

## 1. Burmese keys (packages/i18n/locales/my)
- Added machine-draft Burmese for every missing student-facing key: student.json (181: dashboard.nextAction.APPLICATION_ITEM.*, v4.*),
  common.json (7 notify/task keys), mobile.json (54 v4.* keys), writing.json (finding.SIMILAR_TEXT), concierge.json (type.* — used by task titles).
  Burmese has only the `other` plural category, so `_one` keys are intentionally absent. Staff/agency subtrees (success.agency*, dossier.agency,
  writing gate/queue/insights…, concierge staff/vendors/metrics, visaroute staff/today) were left untranslated (identified by usage in apps/agency-web).
- Removed English words inside existing Burmese strings: GPA → ပျမ်းမျှအမှတ်, Apostille → အပိုစတီးလ် (အသိအမှတ်ပြုချက်), Demo → နမူနာ,
  scan, pixel, SIM/eSIM, NHIS, "(Transcript)", "(Bachelor)", degree short names (မဟာ/ပါရဂူ…), CV, ARC, "(Standard Admission Letter)",
  session, band, limousine, check-in, virtual, ticket, "Writing", portfolio, Documents.
- New keys (en + ko + my, genuine bugs = English-only server text): common `task.applicationCloses`; student `legalFlow.step.<key>.title`,
  `legalFlow.note.{JOINS,JOINED,UNVERIFIED}`; concierge `official.sourceText`; visaroute `question.servedBy`.
- Bug fixed in en: visaroute `question.hukou` contained Burmese script ("ဟူခိုး") → "(hukou)".
- Validation: `node packages/i18n/scripts/validate-locale.mjs my common student mobile visaroute` OK; `npm run i18n:check` OK
  (validator also reports 7 "empty value" for dossier upload.status.* / concierge step.*.text — these are intentionally empty in en too).

## 2. Server-generated English → codes/params (additive, English kept as fallback)
- server/app/services/readiness.py: checklist items get `action_params` ({university, reason, path_code, country, days, issued});
  `workspace_next()` items carry `category`; `legalization_for()` returns `note_code` + `note_params` (JOINS/JOINED/UNVERIFIED).
- server/app/api/v1/student.py (dashboard, 2 one-line additive edits): APPLICATION_ITEM next-action params gain `category`/`essay_type`;
  APPLICATION deadlines gain `title_key: task.applicationCloses` + `title_params`. (Coordinator-owned file — minimal, please keep.)
- server/app/services/strategy.py: DOC_FIX params `reviewer_note`; DOC_TOO_OLD params `days`, `issued`.
- Notifications: `category` added to documentVerified/NeedsCorrection (api/v1/documents.py) and documentRequest (services/document_requests.py);
  `essay_type` to essaySubmitted/essayComment (api/v1/collab.py); seed/run.py seeded notifications likewise (dev DB rows updated in place).

## 3. UI (student-web + shared packages)
- packages/utils: `formatDate`/`formatRelative`/`countryName` fall back to CLDR data (new `src/intl-fallback.ts`, generated from Node full ICU)
  when the runtime Intl lacks the locale. **Chromium ships reduced ICU without Burmese** — every date, "yesterday" and country name was English
  for Chrome users. Other Chrome-missing locales (ne, km, lo, si, mn, ky, tg) can be added to the same table.
- packages/i18n: `docLabel()` / `essayLabel()` — outside English a requirement/request label is shown as the translated document category.
- packages/types: `ChecklistItem.action_params`, `LegalizationInfo.note_code/note_params` (additive).
- lib/i18n.ts: `tr()` localizes label params; `essayTitle()` (generated "<type> — <university>" titles); `notifyParams()`.
- lib/workspace.ts: labels via docLabel; `checklistDetail()` explains FIX/TOO_OLD/RENEW/LEGALIZE from codes (reviewer note quoted).
- lib/success.ts: DOC_TOO_OLD/DOC_FIX why from params; `QUOTED_WHY` marks university/reviewer words.
- Dashboard.tsx (2 small edits): dossier nudge `{{category}}` showed the raw enum ("BANK_STATEMENT") in every language — now translated;
  "Next: <item>" uses docLabel.
- DossierParts, ChecklistRow, University, ApplicationDetail (request history note), DocumentDrawer (legalization step titles + note),
  Essays/EssayEditor (titles), Notifications, Strategy: translated labels; human text marked `data-user-content`.
- ConciergeBits: `SourceQuote` — outside English, English-only research text (official facts, dorm eligibility/documents/location) sits behind
  "Official text, as published (English)"; Housing uses it; concierge.css +3 rules.
- Visa.tsx (after the visa workstream finished): area options name the consulate city in the reader's language with the jurisdiction quoted.

## 4. QA tooling
- scripts/qa/leak-check.mjs: `node scripts/qa/leak-check.mjs [lang=my] [personaFilter] [--widths=390,1440] [--json=f] [--shots=dir]`.
  Allow rules and skip markers are documented at the top of the script and in the leak report.

## Tests
- student-web typecheck OK; vitest 56/56 (new src/lib/i18n-my.test.ts: docLabel/essayTitle/notifyParams/checklistDetail + Burmese Intl fallback
  with Chromium-like ICU mocked).
- pytest (under lock): test_rules, test_flows, test_v3_student_home, test_v4_coherence, test_v4_student, test_v5_success, test_v5_dossier,
  test_v3_university — 57 passed; new tests/test_v5_i18n.py 1 passed. ruff: all checks passed.
- No migration.

## Could not do / notes for the coordinator
- Screens outside FLOW C not audited (Explore/University/Compare/Budget/Messages/Profile/Settings/Services); Services tier names are Latin.
- Research/catalogue text (visa playbooks, arrival-official.json, dormitories, program notes) has no Burmese version — it is quoted behind
  disclosures with translated explanations above. Real translated summaries would be a content task.
- agency-web typecheck OK after the shared package changes; university-web not re-typechecked (additive types only).
- The VM rebooted mid-session; the scratchpad backups were lost (repo edits intact, verified).
