/**
 * Caseload arithmetic (Operations design pass, 2026-11) — the rule is "a count opens exactly the rows it counts".
 *
 * Three small, pure pieces:
 *
 *   · `matchesFilters` — the list filters that are plain equalities on a row's own fields (stage, nationality, intake,
 *     degree, waiting party). The server applies them; the table applies them again to what came back, so a row that
 *     contradicts the active filter is never drawn and never counted. Against the API this drops nothing.
 *   · `LANES` — the attention cuts across the pipeline ("who needs us now"): act now (tier 1 of the ranked Today queue),
 *     our turn, waiting on the student, waiting on the university. Each is a predicate over a row, so a lane's count is
 *     the length of the very array the table renders when the lane is picked.
 *   · `stageTone` — what a stage of the pipeline rail should look like: urgent when one of its students is tier 1,
 *     waiting when every one of them waits on somebody outside the team, otherwise normal.
 */
import type { AgencyStudentRow, PipelineStage } from '@hangyul/types';

import { groupOf, type StripKey } from './stages';

export const LANE_KEYS = ['act', 'ours', 'student', 'university'] as const;
export type LaneKey = (typeof LANE_KEYS)[number];
export function isLaneKey(v: string | null | undefined): v is LaneKey {
  return !!v && (LANE_KEYS as readonly string[]).includes(v);
}

type Row = Pick<AgencyStudentRow, 'id' | 'pipeline_stage' | 'nationality' | 'target_intake' | 'target_degree' | 'waiting_on'>;

const OURS = new Set(['counselor', 'agency', 'hangyul']);
/** `waiting=` values → the row parties they accept (`us` is the legacy counselor-or-team alias; server waiting.ALIASES). */
const PARTY_FILTER: Record<string, (p: string | null | undefined) => boolean> = {
  us: (p) => p === 'counselor' || p === 'agency',
  counselor: (p) => p === 'counselor', agency: (p) => p === 'agency', hangyul: (p) => p === 'hangyul',
  student: (p) => p === 'student', university: (p) => p === 'university', external: (p) => p === 'external',
};
/** Built-in views that are exactly a waiting-party filter (server caseload.pred_view). */
const VIEW_PARTY: Record<string, string> = {
  waiting_us: 'us', waiting_counselor: 'counselor', waiting_agency: 'agency', waiting_hangyul: 'hangyul',
  waiting_student: 'student', university: 'university', waiting_external: 'external',
};

export interface RowFilters {
  stages?: PipelineStage[]; nationality?: string; intake?: string; degree?: string; waiting?: string; view?: string;
}

/** True when the row agrees with every field-equality filter that is set. */
export function matchesFilters(r: Row, f: RowFilters): boolean {
  if (f.stages && !f.stages.includes(r.pipeline_stage)) return false;
  if (f.nationality && r.nationality !== f.nationality) return false;
  if (f.intake && r.target_intake !== f.intake) return false;
  if (f.degree && r.target_degree !== f.degree) return false;
  const party = f.waiting || (f.view ? VIEW_PARTY[f.view] : undefined);
  if (party && PARTY_FILTER[party] && !PARTY_FILTER[party](r.waiting_on)) return false;
  return true;
}

/** `tiers` = student id → best (lowest) tier in the ranked Today queue. */
export function inLane(r: Row, lane: LaneKey, tiers: ReadonlyMap<string, number>): boolean {
  switch (lane) {
    case 'act': return (tiers.get(r.id) ?? 99) <= 1;
    case 'ours': return OURS.has(r.waiting_on ?? '');
    case 'student': return r.waiting_on === 'student';
    case 'university': return r.waiting_on === 'university';
  }
}

export function laneCounts(rows: readonly Row[], tiers: ReadonlyMap<string, number>): Record<LaneKey, number> {
  const out = { act: 0, ours: 0, student: 0, university: 0 } as Record<LaneKey, number>;
  for (const r of rows) for (const k of LANE_KEYS) if (inLane(r, k, tiers)) out[k] += 1;
  return out;
}

/** Rows per strip step — the client count used when every matching student is already on the page. */
export function countByStep(rows: readonly Row[], keys: readonly StripKey[]): Record<StripKey, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<StripKey, number>;
  for (const r of rows) { const g = groupOf(r.pipeline_stage); if (g in out) out[g] += 1; }
  return out;
}

export type StageTone = 'urgent' | 'waiting' | 'normal';
/**
 * `complete` = every student of the caseload is in `rows`. "Waiting" claims something about *all* of a stage's
 * students, so it is only said when they are all here; "urgent" needs just one, so it holds for a partial set too.
 */
export function stageTones(rows: readonly Row[], tiers: ReadonlyMap<string, number>, complete: boolean): Partial<Record<StripKey, StageTone>> {
  const by = new Map<StripKey, Row[]>();
  for (const r of rows) { const g = groupOf(r.pipeline_stage); by.set(g, [...(by.get(g) ?? []), r]); }
  const out: Partial<Record<StripKey, StageTone>> = {};
  for (const [k, list] of by) {
    if (list.some((r) => inLane(r, 'act', tiers))) out[k] = 'urgent';
    else if (complete && list.length > 0 && list.every((r) => r.waiting_on === 'student' || r.waiting_on === 'university' || r.waiting_on === 'external')) out[k] = 'waiting';
    else out[k] = 'normal';
  }
  return out;
}
