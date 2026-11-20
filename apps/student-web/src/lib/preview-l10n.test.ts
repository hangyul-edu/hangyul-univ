import { loadPreviewBundle, previewFetch } from '@hangyul/api-client/preview';
import { i18next, loadNamespaces } from '@hangyul/i18n';
import { describe, expect, it } from 'vitest';

/** Owner pass 261119 (req 7): staff-written fixture notes follow the interface language in Design Preview. */
describe('Design Preview fixture text', () => {
  const NOTE = 'The transcript needs an apostille before it can be used.';
  const translate = (key: string, lng: string) => i18next.t(key, { lng, defaultValue: '' });

  it('localizes the reviewer note for a Korean reader and leaves English alone', async () => {
    await loadNamespaces(i18next, 'ko', ['common']);
    const f = previewFetch(await loadPreviewBundle('student'), 'paid', translate);
    const ko = await (await f('/api/v1/me/dossier', { headers: { 'Accept-Language': 'ko' } })).text();
    expect(ko).not.toContain(NOTE);
    expect(ko).toContain('아포스티유');
    const en = await (await f('/api/v1/me/dossier', { headers: { 'Accept-Language': 'en' } })).text();
    expect(en).toContain(NOTE);
  });

  it('exercises the document manager: groups, required/optional, a correction, a reused document, a request', async () => {
    const f = previewFetch(await loadPreviewBundle('student'));
    const d = await (await f('/api/v1/me/dossier')).json();
    const cats = d.rows.map((r: { category: string }) => r.category);
    expect(cats).toEqual(expect.arrayContaining(['TRANSCRIPT', 'APPLICATION_FORM', 'PASSPORT']));
    expect(d.rows.find((r: { category: string }) => r.category === 'TRANSCRIPT').document.status).toBe('NEEDS_CORRECTION');
    expect(d.rows.find((r: { category: string }) => r.category === 'PASSPORT').needed_count).toBeGreaterThan(1);
    expect(d.requests).toHaveLength(1);
    expect(d.optional.length).toBeGreaterThan(0);
  });
});
