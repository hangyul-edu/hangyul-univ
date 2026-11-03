# V27 evidence (REPORT §353–§371)

| What | Where |
|---|---|
| Research contract, Study in Korea / GKS / IEQAS / rankings research | `research/BRIEF.md`, `research/STUDY_IN_KOREA.md` |
| Research evidence (loaded into the DB) | `server/app/data/research/v27/{facts,guides,reference.json,discovery.json,quarantine}` |
| Coverage after V27 | `coverage-after.json` (before figures in REPORT §353/§362) |
| User simulations (10 personas + legalization) | `SIMULATIONS.md` — `cd server && .venv/bin/python ../scripts/qa/v27/simulations.py` (dev API on 8001) |
| Source copy reviews | `COPY_REVIEW_KO.md`, `COPY_REVIEW_EN.md` |
| Localization brief, per-locale review records, status | `l10n/BRIEF.md`, `l10n/<locale>.md`, `l10n/STATUS.json` |
| Button census before / after | `buttons-before.json`, `buttons-final.json` |
| Screenshots | `shots/` |
| Final gate logs (each ends in `EXIT=`) | `completion/logs/*-final.log` |

Re-run, one heavy step at a time: `scripts/qa/v27/final-chain.sh` (resumable — skips steps whose log ends in `EXIT=0`;
needs the dev stack on 3100–3102 + 8001 for the button and marquee gates). Refresh research in a live DB:
`cd server && .venv/bin/python -m scripts.v27_load_research`. Live provider check: `npm run qa:identity-live` (needs
SendGrid/Twilio values and `QA_EMAIL_TARGET` / `QA_SMS_TARGET` in `server/.env`).
