# V26 — checkpoint (final stub)

The pass is complete (2026-10-28 07:10). The working log that lived here during the pass was folded into REPORT §341 (what was
built), §349 (every run, red and flake with its cause, environment events) and `GATE_CHANGES.md`; the resume instructions it
carried are no longer needed. What a later engineer needs is in `docs/qa/v26/README.md`.

Two facts worth keeping where a resuming session looks first:

- Every long step is resumable on its own: `scripts/qa/v26/final.sh [step]` (skips steps whose `*-final.log` ends in
  `EXIT=0`; `FORCE=1` re-runs), `scripts/qa/v26/android-phase.sh build|scan|smoke|all` (skips apps already green),
  `node scripts/qa/v26/capture.mjs after` (skips existing captures), `perf.mjs measure <label>` (per route).
- This VM restarted six times during the pass and `/tmp` does not survive it; keep drafts in the repository and never
  rewrite a running shell script in place.
