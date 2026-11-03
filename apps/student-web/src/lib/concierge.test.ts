import { describe, expect, it } from 'vitest';

import { delayMinutes, flowIndex, fromSeoulInput, pickupStepIndex, RESIDENCE_FLOW, studentNextMove, toSeoulInput } from './concierge';

describe('concierge helpers', () => {
  it('round-trips Korea time regardless of the browser time zone', () => {
    expect(toSeoulInput('2027-02-20T05:35:00Z')).toBe('2027-02-20T14:35');
    expect(fromSeoulInput('2027-02-20T14:35')).toBe('2027-02-20T14:35:00+09:00');
    expect(fromSeoulInput('nope')).toBeNull();
  });
  it('places delays on the driver step, not as a new step', () => {
    expect(pickupStepIndex('REQUESTED')).toBe(0);
    expect(pickupStepIndex('FLIGHT_DELAYED')).toBe(2);
    expect(pickupStepIndex('COMPLETED')).toBe(4);
    expect(pickupStepIndex(null)).toBe(-1);
  });
  it('computes delay from manual estimates only', () => {
    expect(delayMinutes('2027-02-20T14:35:00+09:00', '2027-02-20T16:05:00+09:00')).toBe(90);
    expect(delayMinutes('2027-02-20T14:35:00+09:00', null)).toBeNull();
  });
  it('knows which step the student records next', () => {
    expect(studentNextMove({ type: 'RESIDENCE_CARD', status: 'PREPARING' })).toBe('APPOINTMENT_BOOKED');
    expect(studentNextMove({ type: 'DORMITORY', status: 'APPLIED' })).toBeNull();
    expect(flowIndex(RESIDENCE_FLOW, 'GROUP_FILING')).toBe(1);
  });
});
