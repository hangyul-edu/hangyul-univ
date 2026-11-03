# V5 build brief (read fully before starting)

Project: /root/hangyul-univ — Hangyul Univ (marketing :3100, student :3101, agency :3102, university :3103, FastAPI :8000, PostgreSQL). Not a git repo. Read first: docs/REPORT.md §23–30 (V4 state + V5 audit/plan), docs/STATE_MAP.md, docs/FRONTEND_CONVENTIONS.md. Look at the current UI before changing it (screenshots in docs/qa/v4/after/, or capture: `OUT=<dir> node scripts/qa/v4-capture.mjs <filter>`).

## Product standard (from the V5 request — non-negotiable)
- Goal: MAXIMIZE ADMISSION SUCCESS + MINIMIZE STUDENT EFFORT + CONTINUE SUPPORT AFTER ARRIVAL. One journey, one obvious next action per stage; the student leaves Hangyul only when an external action is genuinely necessary (government portal, embassy, bank, university payment/portal) — and then Hangyul explains before, preserves state during, and records the result after.
- NEVER: admission probabilities, fabricated acceptance rates, "100%"/"guaranteed" (unless a stored PartnerContract guarantee applies), causal claims from small samples; fake providers/partners/listings/testimonials; pretend-live flight data; portal scraping, CAPTCHA bypass, stored portal passwords; automatic declarations on official forms; AI-written personal statements or invented experiences/awards/jobs/research; silently overwriting student data with extracted values; claiming an external submission happened without evidence.
- Historical outcomes only with cohort, n, program, intake, population, period; n<5 withheld.
- Explain with actionable reasons, never one mysterious score or a new arbitrary percentage.
- Student copy: warm + clear, 15–16 px, phone-first (390 px primary). Agency: short + operational, dense. University: formal + precise. Follow V4 design rules (rows over boxes, zeros collapse, tangerine = primary action/current position only, no badge soup, no enums in UI).
- Distinguish Hangyul service fee vs university application fee vs tuition vs external cost everywhere money appears.
- AI: this machine has NO LLM API key. Build a provider abstraction (`HG_AI_PROVIDER=none|anthropic`, default none). With `none`, deterministic rule-based checks run and are labelled honestly as "Automatic check" (never "AI"). If you implement an Anthropic adapter, load the `claude-api` skill first (Skill tool) and keep it off by default; it must never be required for tests.

## Machine rules (~5 GB RAM; the VM rebooted once under pressure)
- The dev stack is RUNNING (Vite HMR + uvicorn --reload). Do not start/stop/restart it or kill node/python processes. Never use `pkill -f`/`pgrep -f` with patterns that could match your own shell.
- Serialize heavy commands:
  - typecheck/vitest/build: `flock /tmp/claude-0/hg-build.lock npm run typecheck -w @hangyul/<app>` (vitest: `cd apps/<app> && flock /tmp/claude-0/hg-build.lock npx vitest run`)
  - pytest: `cd server && flock /tmp/claude-0/hg-pytest.lock .venv/bin/python -m pytest -q -p no:warnings tests/<your files>` (shared test DB — always under the lock; the test DB is rebuilt + seeded per session, so your seed must work from scratch)
  - ruff: `cd server && .venv/bin/python -m ruff check .`
- Do NOT run Playwright E2E suites or `npm run db:reset` (coordinator does). You MAY write your E2E spec file (e2e/v5-<name>.spec.ts) — the coordinator runs it. Small Playwright screenshot scripts (one chromium) are fine.
- DB: `PGPASSWORD=hangyul_dev psql -h localhost -U hangyul -d hangyul_univ`.

## Migrations (exactly this procedure — several workstreams add tables concurrently)
Write your Alembic revision BY HAND (no --autogenerate: it would pick up other workstreams' unmigrated models). Inside ONE locked critical section: read the current single head, create your revision file with that down_revision, and upgrade the dev DB:
```
cd /root/hangyul-univ/server && flock /tmp/claude-0/hg-migrate.lock bash -c '
  H=$(.venv/bin/alembic heads | awk "{print \$1}"); echo "head=$H"
  # write alembic/versions/<new_id>_v5_<name>.py with down_revision = "$H" (use python/heredoc here, inside the lock)
  .venv/bin/alembic upgrade head && .venv/bin/alembic heads'
```
Afterwards `alembic heads` must show exactly ONE head. Prefer ONE migration per workstream (add later columns in a second revision only if needed, same procedure). Enums are VARCHAR (see existing models). New tables: UUID PK (IdMixin), timestamps, `is_demo` where seeded.

## Ownership (to avoid edit collisions)
- Pre-created for you (edit freely): `server/app/api/v1/<yours>.py` (router already registered in main.py), `server/app/models/v5_<yours>.py` (already imported by app/models/__init__.py — export classes via `__all__`), i18n namespace `packages/i18n/locales/{en,ko,my}/<yours>.json` (already registered in all apps; use `t('<ns>:key')`). Add en + ko for every key (natural Korean). Burmese (`my`): add a machine-draft translation for STUDENT-FACING keys you add (the coordinator will verify; mark nothing else).
- Your own new files: `server/app/services/<yours>.py`, `server/app/seed/extra_5N_<yours>.py` (seed add-on: `seed(db, ctx)`, runs after the core dataset — see extras.py and extra_10_personas.py), `server/tests/test_v5_<yours>*.py`, new page/component files in apps, `e2e/v5-<yours>.spec.ts`, docs you own.
- Shared files — small in-place edits with the Edit tool only (never rewrite whole files; re-read right before editing): apps' router files (`apps/*/src/router.tsx` / App routes), nav/shell config, `packages/types`, `packages/api-client` (append-only additions), `server/app/api/common.py` serializers (additive). Do NOT edit: `server/app/api/v1/student.py` dashboard, `server/app/api/v1/agency.py` `/agency/today`, `apps/student-web/src/pages/Dashboard.tsx`, `apps/agency-web/src/pages/Dashboard.tsx` — the coordinator integrates Home/Today. Instead expose a function the coordinator can call, e.g. `def today_items(db, principal) -> list[dict]` / `def home_stage(db, student) -> dict|None`, and describe it in your log.
- Don't edit other workstreams' files, `common.json`, or existing namespaces except where your brief says so.
- Tasks: create/close engine tasks through the existing Task model/tasks engine conventions (dedupe_key, title + title_key + title_params so titles are translatable; visible_to_student as appropriate).

## Deliverable
- Code + tests (pytest for backend rules and tenant isolation; vitest for pure UI logic where useful) + your E2E spec (not run).
- Your doc(s) under docs/ (named in your brief): current implementation, rules, sources, integration capability, manual fallbacks, security considerations, known limitations.
- Log: /tmp/claude-0/-root-hangyul-univ/68a77e38-9db6-4e41-a745-4977e6ec70c7/scratchpad/v5-<name>.md AND a copy at /root/hangyul-univ/docs/qa/v5/logs/v5-<name>.md (the scratchpad can be wiped): every change (file, what, why in user terms), backend/migration ids, tests run + results, hook functions for the coordinator, what you could NOT do.
- After screenshots: `OUT=docs/qa/v5/<name> node scripts/qa/v4-capture.mjs <filter>` or your own script; LOOK at them at 390 and 1440 and fix what looks wrong.
- Final message: short summary + log path + hook functions + migration id.
