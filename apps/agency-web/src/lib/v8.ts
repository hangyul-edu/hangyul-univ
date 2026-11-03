// V8 agency data: ranked Today queue, case movement, manager Operations, HQ failures, readiness, channels.
// Types mirror server/app/services/{priority,agency_ops}.py and api/v1/{agency_ops,readiness,channels_api,hq_ops}.py.
import { useAuth } from '@hangyul/auth';
import type { PlanCode } from '@hangyul/types';
import type { AgencyIdentity, AgencyNextAction, AgencyWaitingOwner, AgencyWaitingParty, AgencyWaitingReason } from '@hangyul/types';
import { useQuery } from '@tanstack/react-query';

export type ReasonCode =
  | 'first_reply_late' | 'deadline_missing' | 'reply_waiting' | 'review_late' | 'essay_late' | 'university_request'
  | 'deadline_soon' | 'task_overdue' | 'reply_new' | 'first_reply_due' | 'review_waiting' | 'student_silent'
  /** V9 */ | 'submission_issue' | 'confirmation_missing' | 'submit_authorized' | 'ready_to_submit' | 'final_review'
  | 'visa_overdue' | 'visa_action' | 'service_late' | 'service_action' | 'essay_due' | 'document_check';
/** V9 work types (Today's filter chips) — one per reason (server priority.TYPE_OF). */
export const WORK_TYPES = ['documents', 'writing', 'applications', 'messages', 'university_requests', 'visa', 'services', 'deadlines', 'tasks'] as const;
export type WorkType = (typeof WORK_TYPES)[number];
/**
 * V13 — the operational states Today's chips offer (brief Part 10). `urgent` is a severity cut *across* the
 * other three, so these counts do not sum to the total and the UI must not imply that they do.
 * Mirrors `priority.STATES` on the server; `other` (external / nothing open) has no chip.
 */
export const QUEUE_STATES = ['urgent', 'our_work', 'waiting_student', 'waiting_university'] as const;
export type QueueState = (typeof QUEUE_STATES)[number];
export interface Reason { code: ReasonCode; tier: number; at: string | null; params: Record<string, string | number | null>; link?: string }
export interface QueueItem {
  position: number;
  student: { id: string; name: string | null };
  stage: string | null;
  counselor: { id: string; name: string | null } | null;
  reasons: Reason[];
  action: { kind: 'reply' | 'prepare' | 'review' | 'essay' | 'request' | 'task' | 'nudge' | 'submit' | 'confirm' | 'handoff' | 'check' | 'visa' | 'service'; link: string };
  rank: { tier: number; reasons_at_tier: number; clock: string | null };
  /** V9: the chips this row counts under, who owns the top reason, and the row's deadline. */
  types?: WorkType[]; owner?: { kind: 'person' | 'agency' | 'hangyul'; id?: string; name: string | null }; deadline?: string | null;
  /**
   * V15: the plan this student bought. On the row because it changes what the counselor may promise —
   * **not** because it changes priority. The queue still ranks by operational risk alone (REPORT §119).
   */
  plan?: PlanCode | null;
}
export interface TodayQueue {
  generated_at: string; rule: string[]; total: number; by_tier: Record<string, number>; items: QueueItem[]; scope: 'mine' | 'team';
  /** V9 */ all_total?: number; by_type?: Record<WorkType, number>; type?: WorkType | null;
  /** V13 */ by_state?: Record<string, number>; state?: QueueState | null;
}

export interface MovementNext {
  kind: 'task' | 'meeting' | 'deadline'; title?: string; title_key?: string | null; title_params?: Record<string, unknown> | null;
  due_at: string | null; overdue: boolean; student_side?: boolean; meeting_kind?: string; channel?: string; university?: string; days?: number; link: string;
}
export interface Movement {
  student_id: string; stage: string; last_moved_at: string | null; days_since_moved: number | null;
  waiting_on: AgencyWaitingParty | null; waiting_reason: AgencyWaitingReason | null;
  reasons: Reason[]; next: MovementNext[]; definition: string;
  /** V9 header: owner · next action · deadline · identity */
  owner?: AgencyWaitingOwner | null; next_action?: AgencyNextAction | null; deadline?: { date: string; university: string; university_ko?: string | null } | null;
  counselor?: { id: string; full_name: string } | null; agency_identity?: AgencyIdentity | null;
}

export interface OpsCase { student_id: string; student: string | null; stage: string; phase: string; days: number; bucket: string; since: string | null; counselor: { id: string; name: string | null } | null; link: string }
export interface UnpaidRow { student_id: string; student: string | null; paid_at: string | null; days: number; product: string | null; missing: 'no_agency' | 'no_counselor'; link: string }
export interface Ops {
  generated_at: string; agency_id: string | null; min_n: number; definitions: Record<string, string>;
  backlog: { weeks: { week_end: string; tasks: number; documents: number; essays: number; total: number }[]; change: number; links: Record<string, string> };
  ageing: { phases: { phase: string; stages: string[]; total: number; buckets: Record<string, number> }[]; buckets: string[]; students: OpsCase[]; oldest: OpsCase | null };
  load: null | { capacity_total: number | null; capacity_per_counselor: number | null; active_total: number; unassigned: number;
    counselors: { user_id: string; name: string; role: string; active_cases: number; open_tasks: number; overdue_tasks: number; capacity: number | null; load: number | null; share: number | null;
      /** V9 weighted load */ points?: number; overloaded?: boolean; sla_risk?: number; available?: boolean; on_leave_until?: string | null; work?: Record<string, number> }[];
    weights?: Record<string, number>; overloaded?: string[] };
  /** V9 (REPORT §59 A9): the six manager questions, oldest blocked case and unassigned paid cases, first-class. */
  questions?: {
    oldest_blocked: { count: number; top: (OpsCase & { waiting_on: string; reason: string | null }) | null; link: string };
    overloaded: { count: number | null; top: { user_id: string; name: string; points?: number; capacity: number | null; load: number | null } | null; link: string };
    sla_breaches: { count: number; link: string };
    deadline_risk: { count: number; top: { student: string | null; university: string; days_left: number; link: string } | null; link: string };
    slowest_stage: { top: { status: string; median_days: number | null; n: number } | null; link: string };
    unassigned_paid: { count: number; top: UnpaidRow | null; link: string };
  };
  blocked?: { count: number; days: number; items: (OpsCase & { waiting_on: string; reason: string | null })[] };
  unassigned_paid?: { count: number; items: UnpaidRow[] };
  sla: Record<'first_response' | 'document_review' | 'essay_review', { count: number; link: string; sla_hours?: number;
    items: { student_id: string; student: string | null; since: string | null; hours: number | null; link: string; category?: string; essay_type?: string; university?: string | null; reviewer?: string | null }[] }>;
  deadlines: { count: number; days: number; items: { application_id: string; student_id: string; student: string | null; university: string; program: string; deadline: string; days_left: number; items_remaining: number; status: string; counselor: { id: string; name: string | null } | null; link: string }[] };
  stages: { status: string; median_days: number | null; n: number; insufficient_data: boolean; current: number; link: string }[];
}

export type IntegrationStatus = 'ACTIVE' | 'DEVELOPMENT_ONLY' | 'NEEDS_AGREEMENT' | 'NOT_CONFIGURED';
export interface ReadinessItem { key: string; group: string; required: boolean; status: IntegrationStatus; requires: string[]; setting: string | null; fallback: string | null; note: string | null }
export interface Readiness { generated_at: string; environment: string; ready_for_production: boolean; blocking: string[]; counts: Record<IntegrationStatus, number>; items: ReadinessItem[] }

export interface ChannelStatus { code: 'IN_APP' | 'EMAIL' | 'WHATSAPP' | 'KAKAO' | 'SMS'; label: string; status: IntegrationStatus; can_send: boolean; requires: string[] }

export function useTodayQueue(scope?: 'mine' | 'team', type?: WorkType | null, limit = 40, state?: QueueState | null) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ['agency', 'today', 'queue', scope ?? 'default', type ?? 'all', state ?? 'all', limit],
    queryFn: () => api.get<TodayQueue>('/agency/today/queue', {
      ...(scope ? { scope } : {}), ...(type ? { type } : {}), ...(state ? { state } : {}), limit,
    }),
    refetchInterval: 60_000,
  });
}
export function useMovement(studentId: string) {
  const { api } = useAuth();
  return useQuery({ queryKey: ['agency', 'movement', studentId], queryFn: () => api.get<Movement>(`/agency/students/${studentId}/movement`) });
}
export function useOps(agencyId?: string, enabled = true) {
  const { api } = useAuth();
  return useQuery({ queryKey: ['agency', 'ops', agencyId ?? null], queryFn: () => api.get<Ops>('/agency/ops', agencyId ? { agency_id: agencyId } : undefined), enabled });
}
export function useChannels() {
  const { api } = useAuth();
  return useQuery({ queryKey: ['channels'], queryFn: () => api.get<{ default: string; channels: ChannelStatus[] }>('/channels'), staleTime: 5 * 60_000 });
}

/** One plain sentence per reason ("Waiting for our reply for 3 days"). */
type TFn = (k: string, o?: Record<string, unknown>) => string;

export function reasonText(t: TFn, r: Reason): string {
  const p = r.params;
  switch (r.code) {
    case 'deadline_missing':
    case 'deadline_soon':
      return t(`v8.reason.${r.code}`, { count: Number(p.days ?? 0), university: p.university ?? '', items: Number(p.items ?? 0) });
    case 'essay_late':
      return t('v8.reason.essay_late', { essay: t(`essayType.${p.essay_type}`, { defaultValue: t('v8.reason.essay') }) });
    case 'university_request':
      return t('v8.reason.university_request', { university: p.university ?? '' });
    case 'reply_waiting':
    case 'student_silent':
      return p.days == null ? t(`v8.reason.${r.code}_unknown`) : t(`v8.reason.${r.code}`, { count: Number(p.days) });
    case 'submission_issue': case 'submit_authorized': case 'ready_to_submit': case 'final_review':
      return t(`v9.reason.${r.code}`, { university: p.university ?? '' });
    case 'confirmation_missing':
      return t('v9.reason.confirmation_missing', { count: Number(p.days ?? 0), university: p.university ?? '' });
    case 'visa_overdue': case 'visa_action':
      return t(`v9.reason.visa.${p.what ?? 'other'}`, { date: p.date ?? '', defaultValue: t('v9.reason.visa.other') });
    case 'service_late': case 'service_action':
      return t(`v9.reason.service.${r.code === 'service_late' ? 'overdue' : p.what ?? 'other'}`, { type: t(`concierge:type.${p.type}`, { defaultValue: String(p.type ?? '') }), defaultValue: t('v9.reason.service.other', { type: '' }) });
    case 'essay_due':
      return t('v9.reason.essay_due', { essay: t(`essayType.${p.essay_type}`, { defaultValue: t('v8.reason.essay') }) });
    case 'document_check':
      return t('v9.reason.document_check', { doc: t(`docCategory.${p.category}`, { defaultValue: '' }) });
    default: {
      const h = Number(p.hours ?? 0);
      const wait = h >= 48 ? t('v8.wait.days', { count: Math.floor(h / 24) }) : t('v8.wait.hours', { count: h });
      return t(`v8.reason.${r.code}`, { count: Number(p.count ?? p.hours ?? 0), hours: h, wait, late: Number(p.late ?? 0) });
    }
  }
}

export const TIER_TONE: Record<number, 'danger' | 'warning' | 'primary' | 'info' | 'secondary'> = { 1: 'danger', 2: 'warning', 3: 'primary', 4: 'info', 5: 'secondary' };
