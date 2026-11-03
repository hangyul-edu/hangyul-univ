/**
 * V9 S2 — one money plan (server: services/money.py). Types for `GET /me/money-plan`, `/me/budget` (`items[].plan`,
 * `funds_to_show`, `guard`, `announced`), `/me/offers` (`items[].money`) and the visa plan (`funds`).
 */
export type Payee = 'UNIVERSITY' | 'APPLICATION_RAIL' | 'HANGYUL' | 'EMBASSY' | 'IMMIGRATION' | 'INSURER' | 'LANDLORD' | 'DORMITORY' | 'EVERYDAY';
export type When = 'APPLICATION' | 'OFFER' | 'TUITION_DEADLINE' | 'BEFORE_VISA' | 'BEFORE_ARRIVAL' | 'ON_ARRIVAL' | 'MONTHLY';
export type Refundable = 'YES' | 'NO' | 'UNIVERSITY_RULE' | 'UNKNOWN';
export type Basis = 'OFFICIAL' | 'ESTIMATE' | 'SAMPLE' | 'UNKNOWN';

export interface MoneyLine {
  key: string; amount_min: number | null; amount_max: number | null; currency: string; period: 'YEAR' | 'ONCE' | 'SEMESTER' | 'MONTH';
  payee: Payee; when: When; refundable: Refundable; basis: Basis; source_url: string | null; source_label: string | null;
  verified_at: string | null; note_code: string | null; published_en: string | null; guard: boolean; payer: string;
}
export interface WhenGroup { when: When; krw_min: number; krw_max: number; other: { currency: string; amount: number; key: string }[]; unknown: number }
export interface ProgramPlan {
  program_id: string; program_name: string; university_name: string; university_slug: string; region: string; visa_type: string | null;
  lines: MoneyLine[]; by_when: WhenGroup[]; first_year_gross_min: number | null; first_year_gross_max: number | null; range_basis: string;
}
export interface FundsAmount { currency: string; amount: number; area: 'CAPITAL' | 'OTHER' | 'ANY' }
export interface ParsedFunds {
  kind: 'FIXED' | 'PER_ADMISSION_CERTIFICATE' | 'NOT_STATED';
  amounts: FundsAmount[];
  period: { months?: number; days?: number; kind: 'HELD' | 'HISTORY' } | null;
  longer_months_lower_tier: number | null;
  certificate_max_age_days: number | null;
  whose: 'OWN_NAME' | 'STUDENT_OR_PARENT' | 'UNKNOWN';
  waived_if_excellent: boolean;
  published_en: string[];
  source_url: string | null;
}
export interface Announced { code: string; announced_on: string; target: string; source_url: string; source_label: string }
export interface FundsToShow {
  status: 'RESOLVED' | 'NO_ROUTE' | 'NEEDS_PROFILE';
  nationality: string | null; visa_type: string | null; route_visa_type?: string; region: string | null; region_kind: 'CAPITAL' | 'OTHER' | null;
  university: string | null; verification?: string; verified_at?: string | null;
  funds?: ParsedFunds; amount?: FundsAmount | null; waived_here?: boolean;
  genuine: { code: string; source_url: string; source_label: string };
  announced: Announced[];
  /** Embassy rules announced with a future date (e.g. Kyrgyzstan 2027-01-01) — never applied before that date. */
  scheduled?: { effective_from: string; source_url: string | null }[];
}
export interface RefundSummary {
  case_id: string; status: string; waiting_on: string; closed: boolean; trigger: 'VISA_REFUSED' | 'WITHDRAWN_AFTER_TUITION'; university: string | null;
  amount_paid_krw: number | null; rule: { known: boolean; code: string }; own_account: true; since: string; elapsed_days: number;
  application_id: string | null; announced: Announced;
}
export interface MoneyPlan {
  program: ProgramPlan | null; funds_to_show: FundsToShow; guard: { codes: string[]; source_url: string; source_label: string };
  announced: Announced[]; refund: RefundSummary | null; as_of: string;
}

export const WHEN_ORDER: When[] = ['APPLICATION', 'OFFER', 'TUITION_DEADLINE', 'BEFORE_VISA', 'BEFORE_ARRIVAL', 'ON_ARRIVAL', 'MONTHLY'];

/** Lines grouped by the moment they are paid, in journey order (empty moments dropped). */
export function groupByWhen(lines: MoneyLine[]): { when: When; lines: MoneyLine[] }[] {
  return WHEN_ORDER.map((w) => ({ when: w, lines: lines.filter((l) => l.when === w) })).filter((g) => g.lines.length > 0);
}

/** The visa funds amount for the student's university region; null when the region is unknown and the areas differ. */
export function fundsAmountFor(f: ParsedFunds | undefined, regionKind: 'CAPITAL' | 'OTHER' | null): FundsAmount | null {
  if (!f || !f.amounts.length) return null;
  if (f.amounts.length === 1) return f.amounts[0];
  if (!regionKind) return null;
  return f.amounts.find((a) => a.area === regionKind) ?? f.amounts.find((a) => a.area === 'ANY') ?? null;
}

/** Lines the first-year range (`first_year_gross_*`, budget service) adds up — everything else is paid separately. */
export const IN_FIRST_YEAR = ['tuition', 'application_fee', 'dormitory', 'living'];

/**
 * What the first-year range includes and what is separate, from the SAME plan lines (never a second cost model):
 * included = range lines with a figure; separate = other lines with a figure (own currency / period);
 * noFigure = only lines the money plan itself has no figure for. Hangyul's own fee is listed by Budget separately.
 */
export function planCoverage(lines: MoneyLine[]): { included: MoneyLine[]; separate: MoneyLine[]; noFigure: MoneyLine[] } {
  const ls = lines.filter((l) => l.key !== 'hangyul_fee');
  return {
    included: ls.filter((l) => IN_FIRST_YEAR.includes(l.key) && l.amount_min != null),
    separate: ls.filter((l) => !IN_FIRST_YEAR.includes(l.key) && l.amount_min != null),
    noFigure: ls.filter((l) => l.amount_min == null),
  };
}
