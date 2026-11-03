import type { DossierFinding, DossierPackageSummary, DossierReason, DossierRow, DossierUse } from '@hangyul/types';

/** V5 dossier helpers (pure; unit-tested in dossier.test.ts). */
export type TFn = (key: string, opts?: Record<string, unknown>) => string;
type DateFmt = (iso: string) => string;

const DATE_PARAMS = new Set(['date', 'issued', 'until', 'when', 'found_date']);

function tx(t: TFn, key: string, fallback: string, params: Record<string, unknown>): string {
  const s = t(key, { ...params, defaultValue: '' });
  return s && !s.includes('{{') ? s : fallback;
}

/** Dates in params are ISO strings from the API — format them for the reader's locale. */
export function fmtParams(params: Record<string, unknown>, fmt: DateFmt): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    out[k] = DATE_PARAMS.has(k) && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? fmt(v) : v;
  }
  return out;
}

/** A reason `{code, params, text}` in the reader's language (falls back to the API's English). */
export function reasonText(t: TFn, r: DossierReason | null | undefined, fmt: DateFmt): string {
  if (!r) return '';
  const p = fmtParams(r.params, fmt);
  if (typeof p.path === 'string' && ['APOSTILLE', 'CONSULAR_LEGALIZATION'].includes(p.path_code as string)) p.path = t(`dossier:path.${p.path_code}`, { defaultValue: p.path });
  // V28: a reviewer's free-text note is the reviewer's own words; isolate it (bidi-safe, and marked as user content).
  if (r.code === 'NEEDS_FIX' && typeof p.reason === 'string' && p.reason) p.reason = `\u2068${p.reason}\u2069`;
  return tx(t, `dossier:reason.${r.code}`, r.text, p);
}

/** Row summary: "Ready for 3 of 3 applications" / "Can be used for A. B needs …". */
export function summaryText(t: TFn, s: DossierReason, fmt: DateFmt): string {
  const p = fmtParams(s.params, fmt);
  if (s.code === 'S_PARTIAL' || s.code === 'S_BLOCKED') {
    const inner = reasonText(t, { code: String(p.reason_code ?? ''), params: (p.reason_params as Record<string, unknown>) ?? {}, text: String(p.reason ?? '') }, fmt);
    return tx(t, `dossier:summary.${s.code}`, s.text, { ...p, reason: inner });
  }
  return tx(t, `dossier:summary.${s.code}`, s.text, p);
}

export function findingText(t: TFn, f: DossierFinding, fmt: DateFmt): string {
  const p = fmtParams(f.params, fmt);
  if (p.detected_code) p.detected = t(`common:docCategory.${p.detected_code}`, { defaultValue: p.detected }).toLowerCase();
  if (p.category_code) p.category = t(`common:docCategory.${p.category_code}`, { defaultValue: p.category }).toLowerCase();
  if (p.other_code) p.other = t(`common:docCategory.${p.other_code}`, { defaultValue: p.other }).toLowerCase();
  if (p.path_code) p.path = t(`dossier:path.${p.path_code}`, { defaultValue: p.path });
  return tx(t, `dossier:finding.${f.text_code}`, f.explanation, p);
}

export type RowAction = 'upload' | 'uploadNewer' | 'fix' | 'steps' | 'addTranslation' | 'write' | 'view';

/** The one action a dossier row offers, from the most pressing application use. */
export function rowAction(row: DossierRow): RowAction {
  if (row.state !== 'todo') return 'view';
  const order: DossierUse['status'][] = ['NEEDS_FIX', 'EXPIRED', 'NEEDS_NEW_VERSION', 'NEEDS_LEGALIZATION', 'NEEDS_TRANSLATION', 'MISSING'];
  const top = order.find((s) => row.applications.some((u) => u.status === s));
  if (!row.document) return row.essay ? 'write' : 'upload';
  switch (top) {
    case 'NEEDS_FIX': return 'fix';
    case 'EXPIRED':
    case 'NEEDS_NEW_VERSION': return 'uploadNewer';
    case 'NEEDS_LEGALIZATION': return 'steps';
    case 'NEEDS_TRANSLATION': return 'addTranslation';
    case 'MISSING': return row.essay ? 'write' : 'upload';
    default: return 'view';
  }
}

/** "12 requirements · 10 ready · 1 waiting for you · 1 waiting for your counselor" (zeros collapse). */
export function packageLine(t: TFn, s: DossierPackageSummary): string {
  if (s.complete) return t('dossier:package.complete');
  const parts = [t('dossier:package.line', { total: s.total, ready: s.ready })];
  if (s.request) parts.push(t('dossier:package.request', { count: s.request }));
  if (s.student) parts.push(t('dossier:package.student', { count: s.student }));
  if (s.counselor) parts.push(t('dossier:package.counselor', { count: s.counselor }));
  return parts.join(' · ');
}

/** Suggestions that need the student (not already matching the profile). */
export function needsCheck<T extends { status: string; matches_profile: boolean }>(list: T[]): T[] {
  return list.filter((s) => s.status === 'SUGGESTED' && !s.matches_profile);
}
