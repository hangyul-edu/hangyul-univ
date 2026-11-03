import type { Tone } from '@hangyul/utils';
import { daysUntil } from '@hangyul/utils';

/** Mirrors the server's linear GPA normalization (services/matching.py normalize_gpa). */
export function normalizeGpa(value: number, scaleMin: number, scaleMax: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(scaleMax) || scaleMax <= scaleMin) return null;
  const pct = ((value - scaleMin) / (scaleMax - scaleMin)) * 100;
  return Math.round(Math.max(0, Math.min(100, pct)) * 10) / 10;
}

export function wordCount(text: string): number {
  const s = text.trim();
  return s ? s.split(/\s+/).length : 0;
}

export function deadlineTone(days: number | null): Tone {
  if (days === null) return 'neutral';
  if (days < 0) return 'danger';
  if (days <= 7) return 'danger';
  if (days <= 21) return 'warning';
  return 'neutral';
}

export type TaskBucket = 'overdue' | 'week' | 'later';
export function taskBucket(dueAt: string | null, now = new Date()): TaskBucket {
  if (!dueAt) return 'later';
  const d = daysUntil(dueAt, now);
  if (d === null) return 'later';
  if (new Date(dueAt).getTime() < now.getTime()) return 'overdue';
  return d <= 7 ? 'week' : 'later';
}

export function parseNum(v: string | number | null | undefined): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** Opens a short-lived signed URL in a new tab without tripping popup blockers. */
export async function openSigned(getUrl: () => Promise<{ url: string }>): Promise<void> {
  const w = window.open('', '_blank');
  try {
    const { url } = await getUrl();
    if (w) w.location.href = url;
    else window.location.assign(url);
  } catch (e) {
    w?.close();
    throw e;
  }
}

/** Statuses where the application deadline no longer matters to the student. */
export const SUBMITTED_OR_LATER: ReadonlySet<string> = new Set(['SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW', 'OFFERED', 'WAITLISTED', 'REJECTED', 'OFFER_ACCEPTED', 'TUITION_PENDING', 'TUITION_PAID', 'ADMISSION_CERTIFICATE_PENDING', 'ADMISSION_CERTIFICATE_ISSUED', 'VISA_PREPARATION', 'VISA_SUBMITTED', 'VISA_ISSUED', 'ENROLLED']);

export const isPreSubmit = (status: string) => !SUBMITTED_OR_LATER.has(status) && status !== 'WITHDRAWN';

/** Review target for a document's first check — the same 48 h the agency review queue uses (server readiness.REVIEW_TARGET_HOURS). */
export const REVIEW_TARGET_HOURS = 48;
export function reviewIsLate(since: string | null | undefined, now = Date.now()): boolean {
  if (!since) return false;
  const t = new Date(since).getTime();
  return Number.isFinite(t) && now - t > REVIEW_TARGET_HOURS * 3600_000;
}
