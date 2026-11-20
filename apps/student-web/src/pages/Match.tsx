/**
 * `/match` — personalised university matching and selection (261119, owner requirement 1).
 *
 * Marketing `유학 준비` → `/login?next=/match` → (no plan) `/services?gate=match&from=/match` → pay → here. The
 * route is gated in `lib/access.ts` (it is Hangyul's matching service, not public discovery); the content is the
 * Discovery "For you" view, so there is one matching screen, not two.
 */
import Explore from './Explore';

export default function Match() {
  return <Explore route="match" />;
}
