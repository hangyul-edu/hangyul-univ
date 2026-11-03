import { describe, expect, it } from 'vitest';

import { looksPlausible, toE164Preview } from './phone';

describe('E.164 preview (server remains authoritative)', () => {
  it('builds the same E.164 the server will store for the priority markets', () => {
    expect(toE164Preview('NP', '98 4123 4567')).toBe('+9779841234567');
    expect(toE164Preview('MM', '09771234567')).toBe('+959771234567');
    expect(toE164Preview('VN', '0912 345 678')).toBe('+84912345678');
    expect(toE164Preview('US', '(415) 555-2671')).toBe('+14155552671');
    expect(toE164Preview('KR', '010-1234-5678')).toBe('+821012345678');
    expect(toE164Preview('UZ', '90 123 45 67')).toBe('+998901234567');
  });
  it('accepts full international input and refuses impossible lengths', () => {
    expect(toE164Preview('VN', '+1 415 555 2671')).toBe('+14155552671');
    expect(toE164Preview('NP', '00977 9841234567')).toBe('+9779841234567');
    expect(toE164Preview('VN', '12')).toBeNull();
    expect(looksPlausible('VN', '')).toBe(false);
    expect(looksPlausible('XX', '0912345678')).toBe(false);
  });
});
