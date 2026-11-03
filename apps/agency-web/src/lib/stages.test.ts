import { PIPELINE_STAGES } from '@hangyul/types';
import { describe, expect, it } from 'vitest';

import { CLOSED_STAGES, groupOf, STAGE_GROUP_KEYS, STAGE_GROUPS, stagesFor, stripCounts } from './stages';

describe('V22 stage groups', () => {
  it('cover every pipeline stage exactly once (nine steps + closed)', () => {
    const all = [...STAGE_GROUPS.flatMap((g) => g.stages), ...CLOSED_STAGES];
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...PIPELINE_STAGES].sort());
    expect(STAGE_GROUP_KEYS).toHaveLength(9);
  });
  it('map stages to the group the brief names', () => {
    expect(groupOf('NEW_LEAD')).toBe('new');
    expect(groupOf('QUALIFIED')).toBe('new');
    expect(groupOf('ASSIGNED')).toBe('counselling');
    expect(groupOf('WAITLISTED')).toBe('review');
    expect(groupOf('TUITION_PENDING')).toBe('admitted');
    expect(groupOf('GRADUATED')).toBe('arrived');
    expect(groupOf('WITHDRAWN')).toBe('closed');
    expect(stagesFor('closed')).toEqual(['REJECTED', 'WITHDRAWN']);
    expect(stagesFor(null)).toBeUndefined();
  });
  it('sum per-stage counts into strip counts', () => {
    const c = stripCounts({ NEW_LEAD: 2, PROFILE_INCOMPLETE: 3, OFFERED: 1, ENROLLED: 4, REJECTED: 1 });
    expect(c.new).toBe(5);
    expect(c.admitted).toBe(5);
    expect(c.closed).toBe(1);
    expect(c.visa).toBe(0);
  });
});
