import { Navigate } from 'react-router';

import { TASKS_REDIRECT } from '../lib/nav';

/**
 * V22 (REPORT §248 S4): `/tasks` duplicated the home's next-action list, so it is no longer a destination. The
 * route stays — every old link, bookmark and notification deep link still resolves — and lands on the home with
 * the full list revealed. The list itself lives in `components/TaskList.tsx`.
 */
export default function Tasks() {
  return <Navigate to={TASKS_REDIRECT} replace />;
}
