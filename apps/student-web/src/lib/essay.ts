import type { EssayStatus } from '@hangyul/types';

/** Statuses in which the student cannot edit (the API rejects saves while a reviewer has the draft). */
export const LOCKED: EssayStatus[] = ['SUBMITTED', 'AI_PRECHECK', 'AGENCY_REVIEW', 'FINAL_REVIEW'];

export interface Segment { text: string; commentId?: string }

/** Split an essay into plain and highlighted segments for each comment quote (first match, no overlaps). */
export function highlightSegments(body: string, quotes: { id: string; quote: string | null; start?: number | null }[]): Segment[] {
  const ranges: { s: number; e: number; id: string }[] = [];
  for (const q of quotes) {
    if (!q.quote) continue;
    const s = q.start !== null && q.start !== undefined && body.slice(q.start, q.start + q.quote.length) === q.quote ? q.start : body.indexOf(q.quote);
    if (s < 0) continue;
    const e = s + q.quote.length;
    if (ranges.some((r) => s < r.e && e > r.s)) continue;
    ranges.push({ s, e, id: q.id });
  }
  ranges.sort((a, b) => a.s - b.s);
  const out: Segment[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.s > pos) out.push({ text: body.slice(pos, r.s) });
    out.push({ text: body.slice(r.s, r.e), commentId: r.id });
    pos = r.e;
  }
  if (pos < body.length) out.push({ text: body.slice(pos) });
  return out;
}

export function findQuote(body: string, quote: string | null, start?: number | null): [number, number] | null {
  if (!quote) return null;
  const s = start !== null && start !== undefined && body.slice(start, start + quote.length) === quote ? start : body.indexOf(quote);
  return s < 0 ? null : [s, s + quote.length];
}
