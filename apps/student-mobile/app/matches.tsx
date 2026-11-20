import { Redirect } from 'expo-router';

import { MATCH_PATH } from '../src/access';

/** The retired matching entry point (the anonymous quick check's results) → personalised matching (`/match`), as on the web. */
export default function MatchesRedirect() {
  return <Redirect href={MATCH_PATH} />;
}
