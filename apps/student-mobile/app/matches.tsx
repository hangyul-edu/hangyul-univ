import { Redirect } from 'expo-router';

/** Matches now live in Universities › For you. Kept so old deep links and notifications still land correctly. */
export default function MatchesRedirect() {
  return <Redirect href="/explore" />;
}
