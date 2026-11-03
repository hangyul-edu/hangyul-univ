# V8 blind screenshot test

17 pairs (`pair-NN.png`). Each pair shows the same view and persona before (V7) and after (V8) the V8 pass, placed left/right at random and labelled only **A** and **B**. Screens are cropped to the first 1800 px.

- **Answer key:** kept outside the repository docs (`/root/hangyul-univ-snapshots/v8-blind-key.json`), so reviewers cannot see it.
- **Question per pair:** "Which screen makes it easier for this user to understand where they stand and what to do next? A / B / no difference. Why, in one sentence?"
- **Human round: NOT RUN.** No human participants have judged these pairs. Recruit per `docs/research/v8-*.md`: students for student/marketing pairs, counselors for agency pairs, admissions staff for university pairs.
- **Synthetic round:** one AI reviewer that had no access to the key or to the code judged every pair. Its results and the scoring against the key are in `synthetic-results.md`. It is an AI judgement, not user evidence.
