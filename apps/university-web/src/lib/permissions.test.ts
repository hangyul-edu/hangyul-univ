import { decisionActions, FULL_PERMISSIONS, permissionsFor } from './permissions';

describe('V22 one permission per university', () => {
  it('gives every university member the full console', () => {
    expect(permissionsFor(['UNIVERSITY_ADMIN'])).toEqual(FULL_PERMISSIONS);
    // Legacy role values are migration aliases: the server reports them as UNIVERSITY_ADMIN, but a stale token must not lose anything.
    expect(permissionsFor(['UNIVERSITY_ANALYST'])).toEqual(FULL_PERMISSIONS);
    expect(permissionsFor(['UNIVERSITY_REVIEWER']).canExport).toBe(true);
  });

  it('keeps Hangyul staff on their own rules', () => {
    const ops = permissionsFor(['HANGYUL_OPERATIONS']);
    expect(ops.canDecide).toBe(true);
    expect(ops.canAward).toBe(false);
    const finance = permissionsFor(['HANGYUL_FINANCE']);
    expect(finance.canAward).toBe(true);
    expect(finance.canDecide).toBe(false);
    expect(finance.readOnly).toBe(true);
    const counselor = permissionsFor(['HANGYUL_COUNSELOR']);
    expect(counselor.canExport).toBe(true);
    expect(counselor.canDecide).toBe(false);
    expect(permissionsFor([]).readOnly).toBe(true);
  });

  it('offers only university decisions from the allowed transitions', () => {
    const allowed = ['OFFER_ACCEPTED', 'OFFERED', 'WITHDRAWN', 'REJECTED', 'VISA_PREPARATION'] as const;
    expect(decisionActions([...allowed], { canDecide: true })).toEqual(['OFFERED', 'REJECTED']);
    expect(decisionActions([...allowed], { canDecide: false })).toEqual([]);
  });
});
