import type { QueryClient } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';

/**
 * V18 offline support (brief §21–22).
 *
 * The app used to hold every query in memory only: killing it on the Seoul subway and reopening it in the
 * tunnel showed spinners and then an error, for data the student had already read that morning. React Query
 * already keeps the last successful result; it simply had nowhere to put it between launches.
 *
 * Two things are wired here:
 *
 *   1. **A disk cache, by allowlist.** The last successful result of a *listed* query is written to
 *      AsyncStorage and restored on the next cold start, so Home, Applications, Documents, the message list,
 *      saved universities, recommendations, visa status and the current plan all render immediately with
 *      what we last knew.
 *   2. **Real connectivity.** `onlineManager` now follows the device instead of assuming the network is up,
 *      so React Query stops retrying into a dead radio and refetches the moment the connection returns.
 *
 * `focusManager` (foreground refetch) stays in Providers.tsx, where it already was.
 */

/**
 * What may be written to disk. Everything not listed here stays in memory and dies with the process.
 *
 * This is an allowlist rather than a denylist on purpose: a denylist silently starts persisting whatever the
 * next pass adds, and the next pass is exactly when somebody adds a query holding a payment result. Adding a
 * key here is a deliberate decision about a file on a possibly-shared, possibly-lost phone.
 *
 * AsyncStorage is app-sandboxed but not encrypted, so what is listed is scoped to what a student can already
 * see on their own home screen: statuses, titles, dates and counts. Credentials are not here — the refresh
 * token lives in the OS keychain (`createSecureTokenStore`) and the access token never leaves memory.
 */
export const OFFLINE_CACHEABLE_QUERIES: readonly string[] = [
  'home',
  'dashboard',
  'applications',
  'documents',
  'messages',
  'notifications',
  'saved',
  'matches',
  'recommendations',
  'universities',
  'visa',
  'tasks',
  'plan',
  'services',
  'profile',
];

/**
 * Never persisted, even if a key above would otherwise match as a prefix.
 *
 * - `payment*` — a payment's state is the server's to tell us. A confirmation restored from disk could show
 *   a student "paid" after a refund, or show a stale failure after a success; the web checkout and the
 *   backend state machine are the only authorities (brief §24).
 * - `document-file` / `file` — the *bodies* of documents (passport scans, bank statements, certificates).
 *   The list of documents and their statuses are cacheable; the files themselves are not, and they are
 *   served through signed, expiring URLs that would be stale on disk anyway.
 * - `upload` — in-flight uploads are mutations against the server, not a view of it.
 */
const NEVER_PERSIST = ['payment', 'checkout', 'order', 'document-file', 'file', 'download', 'upload', 'session', 'auth'];

/** Is this query key allowed on disk? The first segment of the key decides. */
export function isCacheableQueryKey(key: readonly unknown[]): boolean {
  const head = String(key?.[0] ?? '').toLowerCase();
  if (!head) return false;
  if (NEVER_PERSIST.some((p) => head.includes(p))) return false;
  return OFFLINE_CACHEABLE_QUERIES.some((p) => head === p || head.startsWith(`${p}-`) || head.startsWith(`${p}/`));
}

let wired = false;

/**
 * Follow the device's connectivity. Without this React Query assumes it is always online, which is why a
 * failed request in a tunnel used to burn its retries immediately and land on an error instead of waiting
 * for the radio to come back.
 */
export function wireConnectivity() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      // `isInternetReachable` is null while the probe is still running — treat unknown as connected rather
      // than flapping the whole app into its offline state on every network change.
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
    }),
  );
}

/**
 * Restore the allowlisted queries from disk and keep writing them back.
 *
 * `maxAge` is a week: past that the student is better served by a spinner and fresh data than by a document
 * list from last month. `buster` is the app version, so a release that changes a response shape cannot
 * rehydrate the old one into new screens.
 */
export function wireOfflineCache(queryClient: QueryClient, appVersion: string) {
  if (wired) return;
  wired = true;
  wireConnectivity();
  const persister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'hg.student.query-cache',
    throttleTime: 2_000,
  });
  persistQueryClient({
    queryClient,
    persister,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    buster: appVersion,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => query.state.status === 'success' && isCacheableQueryKey(query.queryKey),
    },
  });
}

/** Drop the disk cache. Called on sign-out so the next account never sees the previous one's data. */
export async function clearOfflineCache() {
  try {
    await AsyncStorage.removeItem('hg.student.query-cache');
  } catch {
    /* storage unavailable — the in-memory clear in Providers.tsx is what actually protects the next user */
  }
}
