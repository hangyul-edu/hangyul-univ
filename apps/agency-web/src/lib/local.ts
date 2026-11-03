/**
 * Per-browser preferences (live updates on/off). Nothing here is sent to the server.
 * Templates moved to the server in V3 (see lib/templates.ts).
 */
import { useSyncExternalStore } from 'react';

const PREF_KEY = 'hg.agency.prefs';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode / quota */ }
}

function createStore<T>(key: string, fallback: T) {
  let cache: T = read(key, fallback);
  const subs = new Set<() => void>();
  const onStorage = (e: StorageEvent) => { if (e.key === key) { cache = read(key, fallback); subs.forEach((s) => s()); } };
  return {
    get: () => cache,
    set: (next: T) => { cache = next; write(key, next); subs.forEach((s) => s()); },
    subscribe: (cb: () => void) => {
      subs.add(cb);
      if (subs.size === 1 && typeof window !== 'undefined') window.addEventListener('storage', onStorage);
      return () => { subs.delete(cb); if (!subs.size && typeof window !== 'undefined') window.removeEventListener('storage', onStorage); };
    },
  };
}

// ----------------------------------------------------------------------------- preferences
export interface Prefs { pollNotifications: boolean }
export const DEFAULT_PREFS: Prefs = { pollNotifications: true };
const prefStore = createStore<Prefs>(PREF_KEY, DEFAULT_PREFS);

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const prefs = useSyncExternalStore(prefStore.subscribe, prefStore.get, prefStore.get);
  return [{ ...DEFAULT_PREFS, ...prefs }, (patch) => prefStore.set({ ...DEFAULT_PREFS, ...prefStore.get(), ...patch })];
}
