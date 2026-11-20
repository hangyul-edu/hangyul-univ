import { Redirect } from 'expo-router';

/** `/login` deep link. Signed out, the root shows sign-in for it (AuthEntry); signed in there is nothing to do here. */
export default function LoginRoute() {
  return <Redirect href="/" />;
}
