import { decisionSchema } from './decision';
import { permissionsFor } from './permissions';

describe('V3 university rules', () => {
  it('requires a reason for pausing or stopping an application', () => {
    for (const to of ['ADDITIONAL_DOCUMENTS', 'REJECTED', 'WAITLISTED']) {
      expect(decisionSchema.safeParse({ to }).success).toBe(false);
      expect(decisionSchema.safeParse({ to, note: '  ' }).success).toBe(false);
      expect(decisionSchema.safeParse({ to, note: 'TOPIK 3 required' }).success).toBe(true);
    }
    expect(decisionSchema.safeParse({ to: 'OFFERED' }).success).toBe(true);
  });

  it('lets any university member propose and publish admission-rule changes (V22: one permission)', () => {
    const member = permissionsFor(['UNIVERSITY_ADMIN']);
    expect(member.canPublishRules).toBe(true);
    expect(member.canEditRules).toBe(true);
    // Hangyul finance may read the console but does not publish a university's rules.
    expect(permissionsFor(['HANGYUL_FINANCE']).canPublishRules).toBe(false);
  });
});
