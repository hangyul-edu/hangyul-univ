import { ApiError } from '@hangyul/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { liveFirst, resetLiveState } from '../lib/queries';
import { startRedirect } from '../routes';

/**
 * Owner requirement 3 (2026-11-19): the Marketing catalogue is the database, read live; the build's DB snapshot is
 * only the fallback for an unreachable API — never a second opinion over an answer the API gave on purpose.
 */
describe('liveFirst', () => {
  beforeEach(() => resetLiveState());

  it('uses the live answer when the API answers', async () => {
    const snapshot = vi.fn(async () => 'snapshot');
    await expect(liveFirst(async () => 'live', snapshot)).resolves.toBe('live');
    expect(snapshot).not.toHaveBeenCalled();
  });

  it('falls back to the snapshot when the service is unreachable (network, timeout, gateway, HTML where the API should be)', async () => {
    for (const e of [new ApiError(0, 'x', undefined, true), new ApiError(408, 'x', undefined, true), new ApiError(502, 'x'), new ApiError(404, 'x', '<html>', true)]) {
      resetLiveState();
      await expect(liveFirst(async () => { throw e; }, async () => 'snapshot')).resolves.toBe('snapshot');
    }
  });

  it('keeps a real 404 from the API: no such university is not papered over with a snapshot row', async () => {
    const snapshot = vi.fn(async () => 'snapshot');
    await expect(liveFirst(async () => { throw new ApiError(404, 'Not found', { detail: 'Not found' }); }, snapshot)).rejects.toMatchObject({ status: 404 });
    expect(snapshot).not.toHaveBeenCalled();
  });

  it('reports the live error when the snapshot cannot be loaded either (an error state, never "0 institutions")', async () => {
    const live = new ApiError(503, 'down', undefined, true);
    await expect(liveFirst(async () => { throw live; }, async () => { throw new ApiError(503, 'DATA_UNAVAILABLE'); })).rejects.toBe(live);
  });

  it('stops waiting on a dead API for a while once it proved unreachable', async () => {
    await liveFirst(async () => { throw new ApiError(0, 'x', undefined, true); }, async () => 'snapshot');
    const live = vi.fn(async () => 'live');
    await expect(liveFirst(live, async () => 'snapshot')).resolves.toBe('snapshot');
    expect(live).not.toHaveBeenCalled();
  });
});

describe('/start (retired quick check)', () => {
  const target = (url: string) => {
    const res = startRedirect({ request: new Request(url) }) as Response;
    expect(res.status).toBeGreaterThanOrEqual(300);
    return res.headers.get('Location');
  };

  it('redirects to the Student login with next=/match, keeping the language', () => {
    expect(target('http://localhost:3100/start?lang=ko')).toBe('http://localhost:3101/login?next=%2Fmatch&lang=ko');
    expect(target('http://localhost:3100/start?lang=zh-CN&plan=basic')).toBe('http://localhost:3101/login?next=%2Fmatch&lang=zh-Hans');
  });
});
