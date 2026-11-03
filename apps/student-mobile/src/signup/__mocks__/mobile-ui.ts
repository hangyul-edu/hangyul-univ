/** Test double for the SecureStore-backed preference store used by the draft persistence. */
const mem = new Map<string, string>();
export const prefs = {
  async get(key: string) { return mem.get(key) ?? null; },
  async set(key: string, value: string | null) { if (value === null) mem.delete(key); else mem.set(key, value); },
};
