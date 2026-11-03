# V9 visa / arrival data — log (2026-10-10)

Scope: apply `docs/research/v9-visa-revalidation.md` (46 corrections) and `docs/research/v9-arrival-revalidation.md` (10 corrections) to the research JSON, load them into the running product, test, and document them. Rules followed: WORKSTREAM_RULES 2–4, 6, 11–12.

## Changes → why → files → test

1. **Research JSON corrected with provenance.** All 46 visa corrections and all 10 arrival corrections are applied, plus the per-country NEWLY CONFIRMED rows (hours, guides, notices).
   - Files:
     - `server/scripts/v9_visa_research_apply.py` (new). It rebuilds the files deterministically from `docs/research/archive/*.v8-2026-09-29.json`, the untouched baselines copied once.
     - `docs/research/visa-playbooks.json`, `arrival-official.json`, `post-arrival-official.json`.
   - Provenance per route or topic is in `v9_revalidation`:
     - `changes[]`: correction number, path, verdict, source id + URL, `verified_at` 2026-10-10;
     - `confirmed[]`;
     - `unconfirmed[]`;
     - `watch_items[]`.
   - Cited sources are appended to `sources[]` with their `id`.
   - Other posts that are quoted only as examples (Hanoi, Bangkok) are kept as `context_sources` and not attached to other countries' routes. The first run attached them, and the leak test caught it.
   - The script asserts that:
     - no old third-country, 30-day or tier wording is left;
     - no VERIFIED route has unconfirmed fields;
     - every route has a 2026-10-10 source.
   - Test: `test_corrected_visa_values_are_in_the_research_file`, `test_national_rule_notes_are_fixed`, `test_every_change_has_provenance_from_the_registry`, `test_arrival_corrections_and_concierge_reads_them`.
2. **Honest status.** VERIFIED only when nothing is unconfirmed, giving 5 VERIFIED, 35 PARTIAL and 1 NEEDS_REVIEW.
   - Moved down: NP D-2-2/D-2-3 (validity conflict), CN ×3 (Shenyang time, unchecked consulates), ID ×4 ("43 universities" list), KZ ×4 (Almaty TB conflict).
   - Moved up: PK D-2-2/D-2-3 (fee and time resolved), MN D-4-1 (service fees confirmed).
   - Arrival `residence_card_registration` moved VERIFIED → PARTIAL (payment method and processing time unconfirmed).
   - Test: `test_unconfirmed_fields_keep_the_route_partial`, `test_unconfirmed_arrival_facts_are_not_verified`.
3. **Time-versioned rules.**
   - Kyrgyzstan's 2027-01-01 KICB rule (amounts, holding period, sponsor records, language thresholds) is stored in `scheduled_changes` with `effective_from` and is **not applied** to current values. The current amount is USD 20,000 / 10,000 until 2026-12-31.
   - `materialize(routes, today)` in `server/app/seed/extra_95_visa_data.py` applies a change only on or after its date.
   - The MOJ 2026-10-07 plans are `watch_items` with `in_force: false`, plus a "WATCH … NOT in force" reviewer note. They never appear in special notes, finance or documents.
   - Test: `test_kyrgyz_2027_rule_is_stored_but_not_applied_before_its_date` (2026-12-31 gives no change; 2027-01-01 applies it; the live DB has only USD 20,000), `test_announced_moj_plans_are_watch_items_not_rules`.
4. **Into the running product.**
   - How data is loaded:
     - Visa routes: the DB tables `visa_routes` and `visa_route_documents` are versioned by `visa_routes.load_playbooks` (content hash).
     - Arrival facts: no DB step. `concierge.official_facts` reads the JSON at request time, with an mtime-keyed cache.
   - New files:
     - `server/scripts/v9_visa_data.py`, the idempotent live loader. It has `--dry-run`; `--as-of` is allowed only with dry-run.
     - `server/app/seed/extra_95_visa_data.py`, the seed path. It runs after `extra_54_visa` and loads the materialized corrected JSON.
   - No services code was edited. The loader worked unchanged; extra top-level JSON keys are hashed but ignored.
   - Runs on the dev DB (inside `hg-migrate.lock`):
     - run 1: `updated 41`;
     - run 2: `updated 15`, after the context-source fix;
     - run 3: `unchanged 41`.
   - History is kept: MM/MN/NP/UZ/VN are at v3 and the others at v2, with older versions `is_current=false`.
   - API checks with `/tmp/claude-0/api.sh`:
     - `student58` (BD): route BD D-2-2 v2. The centre is "Korea Visa Application Center Dhaka (KVAC, operated by VFS Global)", the method is VISA_CENTRE, and the fee details include BDT 2,150.
     - `student.myanmar`: "NRC card (original, copy, notarised English translation)" is listed, and final education shows `legalization NONE`.
     - `student.visaroute` (MN): VERIFIED.
     - `student.arrival` `/me/arrival-journey`: the corrected arrival texts.
   - Test: `test_corrected_routes_are_live_in_the_db_as_new_versions`, `test_bangladeshi_student_sees_the_vfs_centre`, `test_myanmar_persona_shows_the_nrc_card`, `test_no_country_rule_leaks_into_another_country`, `test_resolver_never_uses_another_countrys_route`.
5. **Docs.** `docs/VISA_ROUTES.md` §2 national-rules table corrected:
   - 30-day rule is D-4 only;
   - Korea-issued documents are valid 3 months;
   - third-country rule is E-6-2 only;
   - funds source.

   Both `docs/VISA_ROUTES.md` and `docs/ARRIVAL_SERVICES.md` have a new "V9 revalidation (2026-10-10)" section with the changes and the still-unconfirmed list.

## Existing tests updated on purpose

`tests/test_v5_visa.py`:
- MM `verified_at` is now 2026-10-10, not 2026-09-29.
- The Nepal D-2-2 route is now PARTIAL, not VERIFIED, because of the Embassy-vs-KVAC validity conflict.

## Test results

`pytest tests/test_v5_visa.py tests/test_v5_visa_flow.py tests/test_visa_preview.py tests/test_v5_concierge.py tests/test_v9_visa_data.py tests/test_seed_invariants.py`: all pass (14 new tests in `test_v9_visa_data.py`).

## Not done / hand-offs

- **Student workstream** (`services/visa_routes.py`, not edited, because no loader bug blocked the work). Stale hard-coded content:
  - `METHOD_NOTES` BD `EFORM_FIRST` says "then go to the embassy" (wrong since 2026-09-02).
  - `KNOWN_CONFLICTS` still raises resolved caveats: MM `LEGALIZATION_UNCLEAR`, PK `FEE_TIME_CONFLICT`, TH `FEE_EXEMPTION_UNCHECKED`, KG `AMOUNTS_CONFLICT`, PH `POST_SPLIT_UNVERIFIED`.
  - The Almaty TB conflict has no caveat code.
  - `LEGALIZE_KEYS` forces legalization even where the post says `NONE` (MM).
  - The UI can't show a fee of 0 (TH Thai nationals), so `amount` stays null and `thai_nationals: "FREE"` holds the fact.
  - The resolver doesn't read `scheduled_changes`. **Re-run `scripts/v9_visa_data.py` on or after 2027-01-01**, or make the resolver date-aware.
- E2E template DB not rebuilt (`node scripts/qa/e2e-db.mjs template`). It still holds v1 routes; a fresh seed loads the corrected JSON.
- No screenshots: no UI change in this workstream.
- Still-unconfirmed items (need a human call or email to the post) are listed in VISA_ROUTES.md and ARRIVAL_SERVICES.md under "V9 revalidation".
