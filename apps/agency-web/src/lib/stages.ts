/**
 * V22 process strip — the ONE grouping of `PipelineStage` the agency console reasons in (REPORT §249 G1, brief §52).
 *
 * 신규 → 상담 → 서류 준비 → 지원 준비 → 제출 → 대학 심사 → 합격 → 비자 → 입국·완료. Every group is a list of server
 * stages, so a selected group becomes a repeatable `stage=` filter on `GET /agency/students` and the strip's count is
 * the same query's `total` — the two can never disagree. REJECTED / WITHDRAWN are "closed": a quiet trailing count,
 * not a step in the process.
 */
import type { PipelineStage } from '@hangyul/types';

export const STAGE_GROUP_KEYS = ['new', 'counselling', 'documents', 'ready', 'submitted', 'review', 'admitted', 'visa', 'arrived'] as const;
export type StageGroupKey = (typeof STAGE_GROUP_KEYS)[number];

export const STAGE_GROUPS: { key: StageGroupKey; stages: PipelineStage[] }[] = [
  { key: 'new', stages: ['NEW_LEAD', 'PROFILE_INCOMPLETE', 'QUALIFIED'] },
  { key: 'counselling', stages: ['SERVICE_PURCHASED', 'ASSIGNED'] },
  { key: 'documents', stages: ['DOCUMENT_PREPARATION'] },
  { key: 'ready', stages: ['READY_TO_APPLY'] },
  { key: 'submitted', stages: ['APPLIED'] },
  { key: 'review', stages: ['INTERVIEW', 'WAITLISTED'] },
  { key: 'admitted', stages: ['OFFERED', 'TUITION_PENDING', 'ENROLLED'] },
  { key: 'visa', stages: ['VISA_PREPARATION', 'VISA_ISSUED'] },
  { key: 'arrived', stages: ['ARRIVAL_PREPARATION', 'ARRIVED', 'ACTIVE_STUDENT', 'GRADUATED'] },
];

/** Closed cases — counted after the strip, never a stage. */
export const CLOSED_STAGES: PipelineStage[] = ['REJECTED', 'WITHDRAWN'];
export const CLOSED_KEY = 'closed' as const;
export type StripKey = StageGroupKey | typeof CLOSED_KEY;

const GROUP_OF: Partial<Record<PipelineStage, StripKey>> = {};
for (const g of STAGE_GROUPS) for (const s of g.stages) GROUP_OF[s] = g.key;
for (const s of CLOSED_STAGES) GROUP_OF[s] = CLOSED_KEY;

/** Which strip step a server stage belongs to. */
export function groupOf(stage: PipelineStage): StripKey {
  return GROUP_OF[stage] ?? 'new';
}

/** The `stage=` filter values for a strip selection (null = everything, including closed). */
export function stagesFor(key: StripKey | null | undefined): PipelineStage[] | undefined {
  if (!key) return undefined;
  if (key === CLOSED_KEY) return CLOSED_STAGES;
  return STAGE_GROUPS.find((g) => g.key === key)?.stages;
}

export function isStripKey(v: string | null | undefined): v is StripKey {
  return !!v && ((STAGE_GROUP_KEYS as readonly string[]).includes(v) || v === CLOSED_KEY);
}

/** Sum per-stage counts (GET /agency/stage-counts) into strip counts. */
export function stripCounts(byStage: Partial<Record<PipelineStage, number>> | undefined): Record<StripKey, number> {
  const out = Object.fromEntries([...STAGE_GROUP_KEYS, CLOSED_KEY].map((k) => [k, 0])) as Record<StripKey, number>;
  if (!byStage) return out;
  for (const [stage, n] of Object.entries(byStage) as [PipelineStage, number][]) out[groupOf(stage)] += n ?? 0;
  return out;
}
