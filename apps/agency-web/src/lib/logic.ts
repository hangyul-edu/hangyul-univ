/**
 * Pure, framework-free helpers for the Agency Console. Everything here is unit-tested
 * (see logic.test.ts) because operational screens depend on it being exactly right.
 */
import type { EssayComment, PipelineStage, Task } from '@hangyul/types';

// ----------------------------------------------------------------------------- Kanban
export type Columns<T extends { id: string }> = Record<string, T[]>;

export function findCardStage<T extends { id: string }>(columns: Columns<T>, id: string): string | null {
  for (const [stage, cards] of Object.entries(columns)) if (cards.some((c) => c.id === id)) return stage;
  return null;
}

/**
 * Move a card to another column (immutable). The moved card is placed at the top of the target column and its
 * `pipeline_stage` is updated when present. Returns the same object when nothing changes, so callers can skip work.
 */
export function moveCard<T extends { id: string; pipeline_stage?: PipelineStage | string }>(columns: Columns<T>, id: string, to: string): Columns<T> {
  const from = findCardStage(columns, id);
  if (!from || from === to || !(to in columns)) return columns;
  const card = columns[from].find((c) => c.id === id)!;
  const moved = ('pipeline_stage' in card ? { ...card, pipeline_stage: to } : { ...card }) as T;
  return { ...columns, [from]: columns[from].filter((c) => c.id !== id), [to]: [moved, ...columns[to]] };
}

// ----------------------------------------------------------------------------- Document review
export type ReviewDecision = 'VERIFIED' | 'NEEDS_CORRECTION';
export const MIN_REASON_LENGTH = 8;

/** Returns an i18n key describing the problem, or null when the decision can be sent. */
export function validateReview(decision: ReviewDecision, reason: string | null | undefined): string | null {
  if (decision === 'VERIFIED') return null;
  const r = (reason ?? '').trim();
  if (!r) return 'review.reasonRequired';
  if (r.length < MIN_REASON_LENGTH) return 'review.reasonTooShort';
  return null;
}

/** Append a quick-reason template to a free-text reason without duplicating it. */
export function appendReason(current: string, template: string): string {
  const c = current.trim();
  if (!c) return template;
  if (c.includes(template)) return current;
  return `${c}${/[.!?]$/.test(c) ? '' : '.'} ${template}`;
}

// ----------------------------------------------------------------------------- Tasks
export type TaskBucket = 'overdue' | 'today' | 'week' | 'later' | 'noDate';
export const TASK_BUCKETS: TaskBucket[] = ['overdue', 'today', 'week', 'later', 'noDate'];

function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

export function taskBucket(t: Pick<Task, 'due_at' | 'overdue'>, now = new Date()): TaskBucket {
  if (!t.due_at) return 'noDate';
  const due = new Date(t.due_at);
  if (t.overdue || due < now) return 'overdue';
  if (due <= endOfDay(now)) return 'today';
  const week = endOfDay(new Date(now.getTime() + 6 * 86_400_000));
  if (due <= week) return 'week';
  return 'later';
}

export function bucketTasks<T extends Pick<Task, 'due_at' | 'overdue'>>(tasks: T[], now = new Date()): Record<TaskBucket, T[]> {
  const out: Record<TaskBucket, T[]> = { overdue: [], today: [], week: [], later: [], noDate: [] };
  for (const t of tasks) out[taskBucket(t, now)].push(t);
  return out;
}

// ----------------------------------------------------------------------------- SLA
export type SlaState = { state: 'none' | 'met' | 'late' | 'pending' | 'breached'; hours: number | null };

/** First-response SLA: compares the due time with the first counselor contact (or now if none yet). */
export function slaState(dueAt: string | null | undefined, respondedAt: string | null | undefined, now = new Date()): SlaState {
  if (!dueAt) return { state: 'none', hours: null };
  const due = new Date(dueAt).getTime();
  if (respondedAt) {
    const r = new Date(respondedAt).getTime();
    return { state: r <= due ? 'met' : 'late', hours: Math.round(((due - r) / 3_600_000) * 10) / 10 };
  }
  const left = (due - now.getTime()) / 3_600_000;
  return { state: left >= 0 ? 'pending' : 'breached', hours: Math.round(left * 10) / 10 };
}

// ----------------------------------------------------------------------------- Dates & grouping
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local calendar day of an ISO timestamp, as YYYY-MM-DD. */
export function dayKey(iso: string): string {
  return ymd(new Date(iso));
}

/** Monday of the week containing `iso` (local time), as YYYY-MM-DD. */
export function weekKey(iso: string): string {
  const d = new Date(iso);
  const offset = (d.getDay() + 6) % 7;
  return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset));
}

export function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(it);
  }
  return [...m.entries()];
}

/** "2027-SPRING" → { year: 2027, term: 'SPRING' } */
export function parseIntake(v: string | null | undefined): { year: number; term: string } | null {
  if (!v) return null;
  const [y, term] = v.split('-');
  const year = Number(y);
  return Number.isFinite(year) && term ? { year, term } : null;
}

// ----------------------------------------------------------------------------- Mentions
/** Teammates whose "@Full Name" still appears in the message body (mentions removed while editing are dropped). */
export function resolveMentions(body: string, members: { user_id: string; full_name: string }[]): string[] {
  return members.filter((m) => body.includes(`@${m.full_name}`)).map((m) => m.user_id);
}

// ----------------------------------------------------------------------------- Essay highlighting
export interface Segment { text: string; start: number; end: number; commentIds: string[] }

/** Resolve where a comment sits in the current text: stored anchors if they still match, else the first quote occurrence. */
export function commentRange(body: string, c: Pick<EssayComment, 'anchor_start' | 'anchor_end' | 'quote'>): [number, number] | null {
  if (c.anchor_start != null && c.anchor_end != null && c.anchor_end > c.anchor_start && c.anchor_end <= body.length) {
    if (!c.quote || body.slice(c.anchor_start, c.anchor_end) === c.quote) return [c.anchor_start, c.anchor_end];
  }
  if (c.quote) {
    const i = body.indexOf(c.quote);
    if (i >= 0) return [i, i + c.quote.length];
  }
  return null;
}

/** Split the essay body into segments annotated with the comments that cover them. */
export function highlightSegments(body: string, comments: (Pick<EssayComment, 'id' | 'anchor_start' | 'anchor_end' | 'quote'>)[]): Segment[] {
  const ranges = comments.map((c) => ({ id: c.id, r: commentRange(body, c) })).filter((x): x is { id: string; r: [number, number] } => !!x.r);
  const cuts = new Set<number>([0, body.length]);
  ranges.forEach(({ r }) => { cuts.add(r[0]); cuts.add(r[1]); });
  const points = [...cuts].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [s, e] = [points[i], points[i + 1]];
    if (e <= s) continue;
    const ids = ranges.filter(({ r }) => r[0] <= s && r[1] >= e).map((x) => x.id);
    const prev = out[out.length - 1];
    if (prev && prev.commentIds.join() === ids.join()) { prev.text += body.slice(s, e); prev.end = e; }
    else out.push({ text: body.slice(s, e), start: s, end: e, commentIds: ids });
  }
  return out;
}

// ----------------------------------------------------------------------------- Money
export function sumByCurrency<T>(rows: T[], amount: (r: T) => number, currency: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[currency(r)] = (out[currency(r)] ?? 0) + amount(r);
  return out;
}

/** Human wait duration: hours below 48h, days above. */
export function waitLabel(hours: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  return hours < 48 ? t('docs.durHours', { count: Math.max(0, Math.round(hours)) }) : t('docs.durDays', { count: Math.round(hours / 24) });
}

/** Compact relative time for dense tables: "4m ago", "3h ago", "2d ago" (locale-aware, Intl "narrow" style). */
export function shortRelative(iso: string | null | undefined, locale = 'en', now = new Date()): string {
  if (!iso) return '—';
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'narrow' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(0, 'minute');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}

// ----------------------------------------------------------------------------- V4: plain language
type TFn = (k: string, o?: Record<string, unknown>) => string;

/** Lower-case a label for use mid-sentence, but keep acronyms ("TOPIK certificate", not "topik certificate"). */
export function lowerKeepAcronyms(label: string): string {
  return label.split(' ').map((w) => (/[A-Z].*[A-Z]|\d/.test(w) ? w : w.toLowerCase())).join(' ');
}

/** Like `localizedTitle` from @hangyul/i18n, but document types keep their acronyms ("Review TOPIK certificate"). */
export function taskTitle(t: TFn, item: { title: string; title_key?: string | null; title_params?: Record<string, unknown> | null }): string {
  if (!item.title_key) return item.title;
  const p: Record<string, unknown> = { ...(item.title_params ?? {}) };
  if (typeof p.category === 'string') p.category = lowerKeepAcronyms(t(`common:docCategory.${p.category}`));
  if (typeof p.essayType === 'string') p.essayType = lowerKeepAcronyms(t(`common:essayType.${p.essayType}`));
  if (typeof p.type === 'string' && /^[A-Z_]+$/.test(p.type)) p.type = t(`concierge:type.${p.type}`, { defaultValue: p.type });
  const out = t(`common:${item.title_key}`, { ...p, defaultValue: '' });
  return out && !out.includes('{{') ? out : item.title;
}

/** "vi" → "Vietnamese" in the reader's language; falls back to the upper-cased code. */
export function languageName(code: string | null | undefined, locale = 'en'): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

// ----------------------------------------------------------------------------- V4: waiting on (docs/STATE_MAP.md)
export type WaitingParty = 'us' | 'student' | 'university' | 'external';
type AppStatus = string;

/** STATE_MAP "Waiting on" for one application status ("us" = the agency / Hangyul team working the case). */
export function appWaitingOn(status: AppStatus | null | undefined): WaitingParty | null {
  switch (status) {
    case 'PROFILE_REVIEW': case 'READY': return 'us';
    case 'DRAFT': case 'DOCUMENT_PREPARATION': case 'ADDITIONAL_DOCUMENTS': case 'OFFERED': case 'TUITION_PENDING':
    case 'ADMISSION_CERTIFICATE_ISSUED': case 'VISA_PREPARATION': case 'VISA_ISSUED': return 'student';
    case 'SUBMITTED': case 'UNIVERSITY_REVIEW': case 'INTERVIEW': case 'WAITLISTED': case 'OFFER_ACCEPTED': case 'TUITION_PAID':
    case 'ADMISSION_CERTIFICATE_PENDING': return 'university';
    case 'VISA_SUBMITTED': return 'external';
    default: return null;
  }
}

/** Work that is ours by nature: nothing else has to happen before we can do it. */
const OUR_TASK_TYPES = new Set(['DOCUMENT_REVIEW', 'ESSAY_REVIEW', 'SLA_FOLLOW_UP', 'CONSULTATION', 'GENERAL', 'APPLICATION_SUBMIT', 'PROFILE']);

export type TaskWait = { kind: 'blocked' } | { kind: 'after'; title: string } | { kind: WaitingParty };

/**
 * Who a task is waiting on before it can move: a blocking task, the student (their own task), the university/embassy
 * (from the linked application's state) — or nobody but us ("us" = ready to act).
 */
export function taskWaitingOn(task: {
  status: string; task_type: string; visible_to_student?: boolean; application_status?: string | null;
  depends_on?: { title: string; title_key?: string | null; title_params?: Record<string, unknown> | null; done: boolean } | null;
}, title: (d: { title: string; title_key?: string | null; title_params?: Record<string, unknown> | null }) => string = (d) => d.title): TaskWait {
  if (task.status === 'BLOCKED') return { kind: 'blocked' };
  if (task.depends_on && !task.depends_on.done) return { kind: 'after', title: title(task.depends_on) };
  if (task.visible_to_student) return { kind: 'student' };
  const w = appWaitingOn(task.application_status);
  if (w && w !== 'us' && !OUR_TASK_TYPES.has(task.task_type)) return { kind: w };
  return { kind: 'us' };
}
