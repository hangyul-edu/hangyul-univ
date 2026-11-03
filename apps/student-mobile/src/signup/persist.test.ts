import { describe, expect, it } from 'vitest';

import { clearDraft, loadDraft, saveDraft } from './persist';
import { initialState, reduce } from './state';

describe('draft persistence', () => {
  it('restores typed values but never a secret, and forgets a finished sign-up', async () => {
    let s = reduce(initialState('VN'), { type: 'account', patch: { fullName: 'Lan', email: 'lan@example.com', phoneLocal: '0912345678', password: 'hunter2hunter2', passwordConfirm: 'hunter2hunter2' } });
    s = reduce(s, { type: 'session', token: 'SESSION', expiresIn: 1800 });
    await saveDraft(s);
    const d = await loadDraft();
    expect(d?.account.email).toBe('lan@example.com');
    expect(JSON.stringify(d)).not.toMatch(/hunter2|SESSION/);
    await saveDraft({ ...s, step: 'done' });
    expect(await loadDraft()).toBeNull();
    await clearDraft();
  });
});
