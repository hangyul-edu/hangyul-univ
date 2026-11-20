/** 261119 req 6: the native document manager uses the shared grouping (`@hangyul/utils`) — same sections as the web. */
import { buildLayout, canHide, canRemove, groupSummary, sanitizeDocPrefs } from '@hangyul/utils';
import { describe, expect, it } from 'vitest';

const empty = { rows: [], packages: [], optional: [] };
const t = (k: string, o?: Record<string, unknown>) => (o && 'count' in o ? `${k}:${o.count}` : k);

describe('shared document groups on native', () => {
  it('shows the base set as required, protected sections when there is no application yet', () => {
    const l = buildLayout(empty);
    expect(l.hasApplications).toBe(false);
    expect(l.groups.map((g) => g.id)).toEqual(['academic', 'identity', 'language']);
    expect(l.groups.every((g) => g.required && !canHide(g))).toBe(true);
    expect(l.groups.flatMap((g) => g.items).some(canRemove)).toBe(false);
    expect(l.progress).toEqual({ done: 0, total: 4, pct: 0 });
    expect(l.addable.map((a) => a.id)).toEqual(['financial', 'writing', 'university', 'additional']);
  });
  it('an added optional record opens its section and is removable while empty', () => {
    const l = buildLayout(empty, [{ id: 'award-1', type: 'award' }]);
    const extra = l.groups.find((g) => g.id === 'additional')!;
    expect(extra.required).toBe(false);
    expect(canHide(extra)).toBe(true);
    expect(extra.items.filter(canRemove)).toHaveLength(1);
    expect(groupSummary(t, extra.counts)).toBe('dossier:groups.summary.optional:1');
  });
  it('sanitizes stored preferences', () => {
    expect(sanitizeDocPrefs(null)).toEqual({ opened: [], slots: [] });
    expect(sanitizeDocPrefs({ opened: ['language', 'bogus'], slots: [{ id: 'a', type: 'award' }, { id: 'b', type: 'nope' }, null] }))
      .toEqual({ opened: ['language'], slots: [{ id: 'a', type: 'award' }] });
  });
});
