/**
 * Client-side E.164 preview (brief §6). The server (`phonenumbers`) is the authority; this only shapes what the
 * user sees next to the field and refuses obviously impossible input before a network call.
 */
import { dialCode } from '@hangyul/utils';

export function localDigits(local: string): string {
  return local.replace(/[^\d]/g, '');
}

/** Drop a trunk prefix the way most national plans write mobiles (`010…`, `09…`, `0912…`, `(415)…`). */
export function toE164Preview(country: string, local: string): string | null {
  const dial = dialCode(country);
  if (!dial) return null;
  let digits = localDigits(local);
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (local.trim().startsWith('+')) return `+${digits}`;
  // NANP numbers never carry a trunk zero; most other plans do.
  if (dial !== '1' && digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  if (digits.length < 6 || digits.length > 14) return null;
  return `+${dial}${digits}`;
}

export function looksPlausible(country: string, local: string): boolean {
  return toE164Preview(country, local) !== null;
}
