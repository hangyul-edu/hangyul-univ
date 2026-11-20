import { Redirect } from 'expo-router';

import { MATCH_PATH } from '../src/access';

/**
 * `/register` deep link. Signed out, the root opens sign-up on the first frame for it (AuthEntry, req 2); once signed in
 * the next step is personalised matching (which shows the plan first when there is none — req 1).
 */
export default function RegisterRoute() {
  return <Redirect href={MATCH_PATH} />;
}
