# Burmese (my) leak report — student web, V5 FLOW C

Generated 2026-09-29 05:28 UTC by `node scripts/qa/leak-check.mjs my --json=docs/qa/v5/i18n/runs/final.json` (widths 390 and 1440, raw output in `runs/final.txt`).

**Result: 0 leaking text nodes on every core-workflow screen, for all 8 personas, including the visa screens.**

## Method
- Logs in each persona, forces `hg.locale=my` + `?lang=my`, visits the screens, opens every `<details>`, and collects visible text and
  placeholders/aria-labels inside `<main>` and open dialogs/drawers.
- Flags any Latin-script word that is not allowed. Allowed: university/program/city/dormitory names (catalogue, via the API/DB), person and
  organisation names (DB), TOPIK/IELTS/TOEFL/iBT/D-2/D-4/GKS/KRW/USD/₩, file types (PDF/JPG/PNG/WEBP/HEIC, KB/MB), HiKorea, T-money,
  emails, URLs, identifiers containing digits (v2, D-2-2, DEMO-AB80CD67), the brand "Hangyul Univ".
- Skipped as user content: `[data-user-content]` (essay text, comments, suggestions, version notes, reviewer correction notes, university
  request notes, application-history notes, university notes), strings stored as human-written in the DB (rejection reasons, request notes,
  comments, messages, finding notes, notification reasons, original file names) and document titles as a whole text.
- Skipped as quoted source: `[data-source-quote]` and `[lang=en]` blocks inside a `<details>` ("Official text, as published (English)" /
  "Exact wording") — research and catalogue text that exists only in English, shown behind a disclosure under a translated explanation.

## Per page
| Persona | Page | Result |
|---|---|---|
| hnin | `/` | clean |
| hnin | `/applications` | clean |
| hnin | `/applications/737acaf3-016b-4ecc-ad76-c460f4a9c252` | clean |
| hnin | `/documents` | clean |
| hnin | `/documents?upload=PASSPORT` | clean |
| hnin | `/documents?doc=166390c4-8680-412a-928c-aac969c1658c` | clean |
| hnin | `/essays` | clean |
| hnin | `/essays/29021ce1-c8f4-4290-a52e-734796552bf2` | clean |
| hnin | `/tasks` | clean |
| hnin | `/notifications` | clean |
| hnin | `/visa` | clean |
| hnin | `/housing` | clean |
| hnin | `/arrival` | clean |
| hnin | `/help` | clean |
| lan | `/` | clean |
| lan | `/applications` | clean |
| lan | `/applications/3a2f7705-2c86-4de4-a775-4dd4d9ea0874` | clean |
| lan | `/documents` | clean |
| lan | `/documents?upload=PASSPORT` | clean |
| lan | `/documents?doc=f5d21db8-7081-4b99-8d24-a65e66cf0266` | clean |
| lan | `/essays` | clean |
| lan | `/essays/0cdf019a-99aa-40a1-beb5-fc4b8f3ce5f2` | clean |
| lan | `/tasks` | clean |
| lan | `/notifications` | clean |
| lan | `/visa` | clean |
| lan | `/housing` | clean |
| lan | `/arrival` | clean |
| lan | `/help` | clean |
| dossier | `/` | clean |
| dossier | `/documents` | clean |
| dossier | `/documents?doc=c2da5de9-dc47-479b-abc3-a509e8e1b174` | clean |
| dossier | `/applications/ab80cd67-6106-4b6b-b068-e2c89d6e48df` | clean |
| offer | `/` | clean |
| offer | `/applications/5fbfaf31-72e0-450b-b0ad-b64394771ac9` | clean |
| visaroute | `/` | clean |
| visaroute | `/applications/92a9f0e3-fba6-4788-a4b5-d3d95cae9b5d` | clean |
| visaroute | `/visa` | clean |
| visaroute | `/documents` | clean |
| visaroute | `/housing` | clean |
| visaroute | `/arrival` | clean |
| visaroute | `/help` | clean |
| visa | `/` | clean |
| visa | `/applications/f05959f8-332b-4c3a-9580-e81cee53f7fe` | clean |
| visa | `/visa` | clean |
| visa | `/housing` | clean |
| visa | `/arrival` | clean |
| visa | `/help` | clean |
| arrival | `/` | clean |
| arrival | `/housing` | clean |
| arrival | `/arrival` | clean |
| arrival | `/help` | clean |
| arrived | `/` | clean |
| arrived | `/housing` | clean |
| arrived | `/arrival` | clean |
| arrived | `/help` | clean |

Personas: hnin = student.myanmar@ (Burmese, PNU, visa preparation), lan = student@ (pre-admission: workspace, documents, writing),
dossier = student.dossier@, offer = student.offer@, visaroute = student.visaroute@, visa = student.visa@, arrival = student.arrival@,
arrived = student.arrived@.

## Remaining English that is intentionally shown (not counted as leaks)
| Where | Text | Why / owner |
|---|---|---|
| Visa (`/visa`) — "Exact wording" disclosures, area picker sub-line | Embassy/MOJ research wording (documents, fees, jurisdiction areas) | Official source quoted in its language behind a disclosure; translated summaries above. Owner: visaroute research data. |
| Arrival / Help — "Official text, as published (English)" disclosure, source link names | arrival-official.json summaries/steps/documents; source titles (e.g. "HiKorea – Foreign resident registration") | Quoted official source; the translated step text (concierge namespace) is shown above. Owner: concierge research data. Real Burmese summaries per step would remove the need to open it. |
| Housing — dormitory eligibility / documents / location | University catalogue text | Quoted as source (disclosure). Owner: catalogue data (dormitories table). |
| Application workspace — "A note from <university>" | Program requirement note (e.g. "TOPIK 3 for entry follows…") | The university's own note, quoted. Owner: catalogue data. |
| Essay editor, comments, request notes, reviewer notes | Text people wrote | User content. |
| Form inputs (move-in address etc.) | Values the student typed | User content. |

## Not covered by this check
- Screens outside the core workflow (Explore, University, Compare, Budget, Messages, Profile, Settings, Services) were not audited.
  Known: Services tier names ("Free Explorer", …) and `student:messages.hint` (Enter/Shift) are Latin in Burmese; university/program
  `summary`/`description` catalogue text is English.
- Staff-only subtrees of success/dossier/writing/concierge/visaroute (agency/university apps) are not translated to Burmese (by design).
