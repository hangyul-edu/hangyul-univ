import { prefs } from '@hangyul/mobile-ui';

import { PERSIST_TTL_MS, persistable, type SignupState } from './state';

const KEY = 'signup.draft';

export async function saveDraft(s: SignupState): Promise<void> {
  if (s.step === 'done') { await prefs.set(KEY, null); return; }
  await prefs.set(KEY, JSON.stringify(persistable(s)));
}

export async function loadDraft(): Promise<ReturnType<typeof persistable> | null> {
  const raw = await prefs.get(KEY);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as ReturnType<typeof persistable>;
    if (!d.savedAt || Date.now() - d.savedAt > PERSIST_TTL_MS) { await prefs.set(KEY, null); return null; }
    return d;
  } catch { return null; }
}

export const clearDraft = () => prefs.set(KEY, null);
