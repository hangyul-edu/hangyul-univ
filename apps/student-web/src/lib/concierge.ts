/** V5 concierge — pure helpers for the arrival, housing and help screens (unit-tested in concierge.test.ts). */
import type { ServiceCase } from '@hangyul/types';

/** Flights land in Korea: every flight time is entered and shown in Korea time (UTC+9, no daylight saving). */
export function toSeoulInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}T${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}

export function fromSeoulInput(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  return `${v}:00+09:00`;
}

export const SEOUL_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' };

/** The pickup states a student sees, in order. Delays and "driver waiting" are shown in place of the step they interrupt. */
export const PICKUP_STEPS = ['REQUESTED', 'CONFIRMED', 'DRIVER_ASSIGNED', 'PICKED_UP', 'COMPLETED'] as const;

export function pickupStepIndex(status: string | null | undefined): number {
  if (!status) return -1;
  if (status === 'FLIGHT_DELAYED' || status === 'DRIVER_WAITING') return 2;
  if (status === 'NO_SHOW') return 2;
  return PICKUP_STEPS.indexOf(status as (typeof PICKUP_STEPS)[number]);
}

/** Minutes the (manually entered) estimated arrival is later than scheduled; null when unknown. */
export function delayMinutes(scheduled: string | null | undefined, estimated: string | null | undefined): number | null {
  if (!scheduled || !estimated) return null;
  const d = (new Date(estimated).getTime() - new Date(scheduled).getTime()) / 60000;
  return Number.isFinite(d) ? Math.round(d) : null;
}

export const DORM_FLOW = ['PLANNING', 'APPLIED', 'ASSIGNED', 'CONFIRMED', 'MOVED_IN'] as const;
export const SEARCH_FLOW = ['INTERESTED', 'VIEWING', 'CONTRACT_REVIEW', 'DEPOSIT', 'CONFIRMED', 'MOVED_IN'] as const;
export const RESIDENCE_FLOW = ['PREPARING', 'APPOINTMENT_BOOKED', 'SUBMITTED', 'READY', 'COLLECTED'] as const;

export function flowIndex(flow: readonly string[], status: string | null | undefined): number {
  if (!status) return -1;
  if (status === 'GROUP_FILING') return 1;
  if (status === 'NOT_ASSIGNED') return 1;
  return flow.indexOf(status);
}

/** What the student may record themselves next (mirrors STUDENT_MOVES on the server). */
export function studentNextMove(c: Pick<ServiceCase, 'type' | 'status'> | null | undefined): string | null {
  if (!c) return null;
  const m: Record<string, Record<string, string>> = {
    DORMITORY: { PLANNING: 'APPLIED', ASSIGNED: 'CONFIRMED', CONFIRMED: 'MOVED_IN' },
    HOUSING_SEARCH: { DEPOSIT: 'CONFIRMED', CONFIRMED: 'MOVED_IN' },
    RESIDENCE_CARD: { PREPARING: 'APPOINTMENT_BOOKED', APPOINTMENT_BOOKED: 'SUBMITTED', GROUP_FILING: 'SUBMITTED', SUBMITTED: 'READY', READY: 'COLLECTED' },
    TEMPORARY_HOUSING: { BOOKED: 'CHECKED_IN', CHECKED_IN: 'COMPLETED' },
  };
  return m[c.type]?.[c.status] ?? null;
}

/** Days until a date (negative when passed), in whole days. */
export function daysUntil(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}
