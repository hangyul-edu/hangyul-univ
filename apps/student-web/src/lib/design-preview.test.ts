import { createApiClient } from '@hangyul/api-client';
import { loadPreviewBundle, previewFetch } from '@hangyul/api-client/preview';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Design Preview isolation, at the transport: a client built on `previewFetch` can sign nobody in, write nothing and
 * reach no network. The browser-level proof (zero `/api` requests on every screen) is scripts/qa/launch-final/preview.mjs.
 */
describe('design preview transport', () => {
  const realFetch = globalThis.fetch;
  const network = vi.fn(() => Promise.reject(new Error('network must not be used in preview')));
  beforeEach(() => { globalThis.fetch = network as unknown as typeof fetch; network.mockClear(); });
  afterEach(() => { globalThis.fetch = realFetch; });

  const client = async (variant: 'paid' | 'unpaid') =>
    createApiClient({ baseUrl: '', client: 'student', fetchImpl: previewFetch(await loadPreviewBundle('student'), variant) });

  it('restores a synthetic persona without a credential or a refresh token', async () => {
    const api = await client('paid');
    expect(await api.auth.restore()).toBe(true);
    expect(api.session?.user.email).toMatch(/@preview\.invalid$/);
    expect(network).not.toHaveBeenCalled();
  });

  it('refuses a real sign-in and every write, in-process', async () => {
    const api = await client('paid');
    await expect(api.auth.login('someone@example.com', 'a-real-password')).rejects.toMatchObject({ status: 503 });
    await expect(api.me.checkout('ALL_IN_ONE')).rejects.toMatchObject({ status: 503 });
    await expect(api.me.updateProfile({})).rejects.toMatchObject({ status: 503 });
    expect(network).not.toHaveBeenCalled();
  });

  it('paid shows an entitled plan; unpaid shows none — from the same synthetic bundle, with no order created', async () => {
    const paid = await (await client('paid')).me.services();
    const unpaid = await (await client('unpaid')).me.services();
    expect(paid.plan).toBeTruthy();
    expect(unpaid.plan).toBeNull();
    expect(unpaid.products.length).toBe(paid.products.length);
    expect(network).not.toHaveBeenCalled();
  });

  it('answers an unknown read with 404 rather than reaching for the API', async () => {
    const api = await client('paid');
    await expect(api.get('/no-such-endpoint')).rejects.toMatchObject({ status: 404 });
    expect(network).not.toHaveBeenCalled();
  });
});
