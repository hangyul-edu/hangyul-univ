/**
 * Owner pass 261119 (req 7): the synthetic bundles hold a few free-text notes "written by staff" (a reviewer's note,
 * a counselor's comment, a university's request). In the product those are a person's own words; in Design Preview
 * they are ours, so they follow the interface language like every other string. Each English sentence below maps to
 * an i18n key (`common:previewFixture.*`); `previewFetch` swaps it for the reader's language (from Accept-Language).
 */
export const FIXTURE_TEXT: [english: string, key: string][] = [
  ['The transcript needs an apostille before it can be used. The copy uploaded is not authenticated.', 'common:previewFixture.transcriptApostille'],
  ["Drafted by Hangyul — not the university's official wording. Confirm the real question before approval.", 'common:previewFixture.draftedByHangyul'],
  ['Profile checked. Documents are next — start with the apostille for your transcript, it takes the longest.', 'common:previewFixture.profileChecked'],
  ['Finish the Kyungpook documents first — its deadline is the closest.', 'common:previewFixture.kyungpookFirst'],
  ['Please send an expected graduation certificate issued after 1 November 2026.', 'common:previewFixture.expectedGraduationNote'],
  ['Added the school project', 'common:previewFixture.schoolProject'],
  ['Apostille required', 'common:previewFixture.apostilleRequired'],
  ['Application strategy & scholarship plan', 'common:previewFixture.subjectStrategy'],
  ['Upload the second draft of your study plan', 'common:previewFixture.secondDraftTask'],
  ["TOPIK 3 for entry follows the Ministry of Education recommended standard; the university's own rule prevails.", 'common:previewFixture.topik3Standard'],
  // Staff consoles (Operations / University) — sample notes, tasks and thread subjects.
  ['File is readable; issue date found on page 1.', 'common:previewFixture.precheckReadable'],
  ['Transcript shows a different date of birth from the passport. Confirm before the committee meets.', 'common:previewFixture.dobMismatch'],
  ['Send the study plan feedback summary', 'common:previewFixture.feedbackTask'],
  ['Q4 intake planning — Hangyul Univ Operations', 'common:previewFixture.subjectIntake'],
  ['Students who answered "this was helpful".', 'common:previewFixture.helpfulDef'],
];

/** `translate(key, lng)` returns the localized text, or '' / the key when it has none (then the English stays). */
export type FixtureTranslate = (key: string, lng: string) => string;

/** Replaces the fixture sentences inside a JSON text (string-safe: both sides are JSON-escaped). */
export function localizeFixtureJson(json: string, lng: string | null | undefined, translate?: FixtureTranslate): string {
  if (!translate || !lng || lng === 'en' || lng.startsWith('en-')) return json;
  let out = json;
  for (const [en, key] of FIXTURE_TEXT) {
    const tr = translate(key, lng);
    if (!tr || tr === key || tr === en) continue;
    const from = JSON.stringify(en).slice(1, -1);
    if (out.includes(from)) out = out.split(from).join(JSON.stringify(tr).slice(1, -1));
  }
  return out;
}
