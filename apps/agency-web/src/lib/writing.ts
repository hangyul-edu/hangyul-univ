/**
 * V5 writing review — pure helpers for the agency queue and review workspace (no React).
 * Server contract: server/app/services/writing.py (essay_block, queue, quality_gate).
 */
import { countryName } from '@hangyul/utils';
import type { AuthorKind, Essay, EssayComment, WritingBlock, WritingFinding, WritingGateItem, WritingQueueItem } from '@hangyul/types';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

/** Finding explanation in the reader's language; the quote is rendered separately. Falls back to the server's English text. */
export function findingText(t: TFn, f: Pick<WritingFinding, 'code' | 'params' | 'text'>, locale = 'en'): string {
  const p: Record<string, unknown> = { ...(f.params ?? {}) };
  // Enum-like params become words in the reader's language.
  if (typeof p.profile_level === 'string') p.level = t(`writing:level.${p.profile_level}`);
  if (f.code === 'FACT_DEGREE' && !p.profile_level) p.level = t('writing:level.NONE');
  if (f.code === 'FACT_NATIONALITY') { p.claimCountry = countryName(String(p.claim ?? ''), locale); p.profileCountry = countryName(String(p.profile ?? ''), locale); }
  // V6 cross-application consistency: "TOPIK level — this text says TOPIK 4; your study plan · Pusan National University says TOPIK 3".
  if (f.code === 'CROSS_APP_CONFLICT') {
    p.topicLabel = t(`writing:topic.${String(p.topic ?? '')}`, { defaultValue: '' });
    p.otherLabel = [p.other_type ? t(`common:essayType.${String(p.other_type)}`) : null, p.other_university].filter(Boolean).join(' · ') || t('writing:topic.otherEssay');
  }
  let key = `writing:finding.${f.code}`;
  if (f.code === 'FACT_GRAD_YEAR') key += p.profile_expected ? '_expected' : '_graduated';
  if ((f.code === 'FACT_TOPIK' || f.code === 'FACT_IELTS') && p.profile == null) key += '_none';
  const out = t(key, { ...p, defaultValue: '' });
  return out && !out.includes('{{') ? out : f.text;
}

/** Order: blockers first, then warnings, then tips; open before resolved. */
export function sortFindings<F extends Pick<WritingFinding, 'severity' | 'status'>>(list: F[]): F[] {
  const sev = { BLOCKER: 0, WARNING: 1, INFO: 2 } as const;
  const st = { OPEN: 0, DISMISSED: 1, RESOLVED: 2 } as const;
  return [...list].sort((a, b) => st[a.status] - st[b.status] || sev[a.severity] - sev[b.severity]);
}

/** "Agency reviewer · Lotus Bridge", "Hangyul reviewer", "Student text", "Automatic check". */
export function authorKindLabel(t: TFn, kind: AuthorKind | 'AUTO'): string {
  return t(`writing:kind.${kind === 'STAFF' || kind === 'UNKNOWN' ? 'STAFF' : kind}`);
}

export function authorOf(block: WritingBlock | undefined, userId: string | null | undefined): { kind: AuthorKind; name: string | null; org: string | null } {
  return (userId && block?.authors?.[userId]) || { kind: 'UNKNOWN', name: null, org: null };
}

/** Hours → "5 h" / "2 d 3 h". */
export function ageLabel(t: TFn, hours: number | null | undefined): string {
  if (hours == null) return '—';
  const h = Math.max(0, Math.round(hours));
  if (h < 24) return t('writing:time.hours', { count: h });
  return t('writing:time.daysHours', { d: Math.floor(h / 24), h: h % 24 });
}

/** Hours until a deadline (negative = overdue). */
export function hoursUntil(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  return (new Date(iso).getTime() - now) / 3_600_000;
}

export function gateItemReason(t: TFn, item: WritingGateItem): string | null {
  const r = item.reasons[0];
  if (!r) return null;
  if (r.code === 'RUBRIC_NEEDS_WORK') return t('writing:gate.reason.RUBRIC_NEEDS_WORK', { dimension: t(`writing:dim.${String(r.dimension)}`) });
  return t(`writing:gate.reason.${r.code}`, { ...r, defaultValue: '' }) || null;
}

/** Queue keyboard: next/previous id in the visible list. */
export function neighbour(items: Pick<WritingQueueItem, 'id'>[], id: string, dir: 1 | -1): string | null {
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return items[0]?.id ?? null;
  return items[i + dir]?.id ?? null;
}

/** Character ranges of open findings (for inline highlights), clipped to the text. */
export function findingRanges(body: string, findings: WritingFinding[]): { start: number; end: number; id: string; severity: string }[] {
  return findings
    .filter((f) => f.status === 'OPEN' && f.anchor_start != null && f.anchor_end != null && f.quote && body.slice(f.anchor_start, f.anchor_end) === f.quote)
    .map((f) => ({ start: f.anchor_start as number, end: f.anchor_end as number, id: f.id, severity: f.severity }));
}

// ============================================================================ V6 review workspace
// Contract additions (server/app/services/writing.py V6 + api/v1/writing.py). The shared @hangyul/types and
// @hangyul/api-client don't carry these yet, so the typed extensions and calls live here (see docs/WRITING_REVIEW.md V6).

export type SuggestionState = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
export interface V6Comment extends EssayComment {
  resolved_at?: string | null; suggestion_state?: SuggestionState | null; decided_at?: string | null; decision_note?: string | null; decision_version?: number | null;
}
export interface V6Attestation { version: number; attested_at: string; statement_code: string; locale: string | null }
export interface V6UsedBy { application_id: string; university: string | null; program: string | null; application_status: string; approved_version: number | null; newer_draft: boolean }
export interface V6Writing extends WritingBlock {
  attestations?: Record<string, V6Attestation>; used_by?: V6UsedBy[]; ai?: { provider: string; label: 'AI_SUGGESTION' } | null;
}
export type V6Essay = Omit<Essay, 'comments' | 'writing'> & { comments: V6Comment[]; writing?: V6Writing };
export type RubricGroup = 'QUALITY' | 'ACCURACY';
export interface V6QueueItem extends WritingQueueItem { escalated?: boolean; escalated_to?: string | null }

interface ApiLike {
  get: <R>(path: string, query?: Record<string, string | number | boolean | undefined | null>) => Promise<R>;
  post: <R>(path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined | null>) => Promise<R>;
}

/** V6 endpoints (typed here until the shared client carries them). */
export function writingV6(api: ApiLike) {
  return {
    next: (essayId: string, view?: string | null, pos?: number | null) =>
      api.get<{ id: string | null }>(`/writing/essays/${essayId}/next`, { view: view ?? undefined, pos: pos ?? undefined }),
  };
}

/** Live counts against the question's limits. */
export function lengthStats(body: string, limits: { word_limit: number | null; char_limit: number | null } | undefined) {
  const words = (body.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;
  const chars = body.length;
  const wl = limits?.word_limit ?? null;
  const cl = limits?.char_limit ?? null;
  return { words, chars, wordLimit: wl, charLimit: cl, overWords: wl != null && words > wl ? words - wl : 0, overChars: cl != null && chars > cl ? chars - cl : 0,
    ratio: wl ? words / wl : cl ? chars / cl : null };
}

/** Comments in reading order: located ones by their position in the text, then general ones by time. */
export function commentOrder(body: string, comments: Pick<EssayComment, 'id' | 'anchor_start' | 'anchor_end' | 'quote' | 'at'>[],
  locate: (body: string, c: Pick<EssayComment, 'anchor_start' | 'anchor_end' | 'quote'>) => [number, number] | null): string[] {
  return comments
    .map((c) => ({ id: c.id, at: c.at, pos: locate(body, c)?.[0] ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.pos - b.pos || a.at.localeCompare(b.at))
    .map((c) => c.id);
}

/** N / P: the next or previous id in a list, wrapping; from nothing, N starts at the first and P at the last. */
export function step(ids: string[], current: string | null, dir: 1 | -1): string | null {
  if (!ids.length) return null;
  const i = current ? ids.indexOf(current) : -1;
  if (i < 0) return dir === 1 ? ids[0] : ids[ids.length - 1];
  return ids[(i + dir + ids.length) % ids.length];
}

/** Single-key shortcuts never fire while the reviewer is typing or a dialog is open. */
export function isTypingTarget(el: EventTarget | null): boolean {
  const e = el as HTMLElement | null;
  if (!e || typeof e.closest !== 'function') return false;
  return !!e.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], [role="combobox"]');
}

export type ShortcutAction = 'comment' | 'approve' | 'changes' | 'nextComment' | 'prevComment' | 'nextEssay' | 'prevEssay' | 'help'
  | 'tabComments' | 'tabChecks' | 'tabRubric' | 'tabVersions' | 'compare';
export const SHORTCUTS: { keys: string[]; action: ShortcutAction }[] = [
  { keys: ['c'], action: 'comment' }, { keys: ['a'], action: 'approve' }, { keys: ['r'], action: 'changes' },
  { keys: ['n', 'j'], action: 'nextComment' }, { keys: ['p', 'k'], action: 'prevComment' },
  { keys: [']'], action: 'nextEssay' }, { keys: ['['], action: 'prevEssay' }, { keys: ['d'], action: 'compare' },
  { keys: ['1'], action: 'tabComments' }, { keys: ['2'], action: 'tabChecks' }, { keys: ['3'], action: 'tabRubric' }, { keys: ['4'], action: 'tabVersions' },
  { keys: ['?'], action: 'help' },
];
export function shortcutFor(ev: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'target'>): ShortcutAction | null {
  if (ev.metaKey || ev.ctrlKey || ev.altKey || isTypingTarget(ev.target)) return null;
  return SHORTCUTS.find((s) => s.keys.includes(ev.key))?.action ?? null;
}

/** Queue memory (per user, this browser): the view the reviewer works in, the order they saw, where they are. */
export interface QueueMemory { view: string; ids: string[]; at: string | null; savedAt: number }
const memKey = (userId: string) => `hg.writing.queue.${userId || 'anon'}`;
export function loadQueueMemory(userId: string, storage: Pick<Storage, 'getItem'> | null = safeStorage()): QueueMemory | null {
  try {
    const raw = storage?.getItem(memKey(userId));
    if (!raw) return null;
    const m = JSON.parse(raw) as QueueMemory;
    return m && typeof m.view === 'string' && Array.isArray(m.ids) ? m : null;
  } catch { return null; }
}
export function saveQueueMemory(userId: string, patch: Partial<QueueMemory>, storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): QueueMemory {
  const prev = loadQueueMemory(userId, storage) ?? { view: 'first', ids: [], at: null, savedAt: 0 };
  const next = { ...prev, ...patch, savedAt: Date.now() };
  try { storage?.setItem(memKey(userId), JSON.stringify(next)); } catch { /* private mode: keep going without memory */ }
  return next;
}
function safeStorage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}
/** Position of an essay in the remembered queue order (for "next" after it leaves the view), or null. */
export function queuePosition(m: QueueMemory | null, id: string): number | null {
  if (!m) return null;
  const i = m.ids.indexOf(id);
  return i < 0 ? null : i;
}
/** Previous essay in the remembered order ("[" key). */
export function previousInQueue(m: QueueMemory | null, id: string): string | null {
  const i = queuePosition(m, id);
  return i != null && i > 0 ? m!.ids[i - 1] : null;
}

/** Rubric dimensions grouped Quality → Accuracy, keeping the rubric's order inside each group. */
export function groupDimensions<D extends { key: string; group?: string | null }>(dims: D[]): { group: RubricGroup; dims: D[] }[] {
  const out: { group: RubricGroup; dims: D[] }[] = [{ group: 'QUALITY', dims: [] }, { group: 'ACCURACY', dims: [] }];
  for (const d of dims) out[d.group === 'ACCURACY' ? 1 : 0].dims.push(d);
  return out.filter((g) => g.dims.length > 0);
}

/** Severity class for a finding's inline annotation (blockers outrank warnings outrank tips on overlap). */
export function annotationSeverity(severities: string[]): 'blocker' | 'warning' | 'info' | null {
  if (severities.includes('BLOCKER')) return 'blocker';
  if (severities.includes('WARNING')) return 'warning';
  return severities.length ? 'info' : null;
}

/** Which version to compare by default: the previous one → the current one (null when there is only one). */
export function defaultCompare(versions: { version: number }[]): [number, number] | null {
  if (versions.length < 2) return null;
  return [versions[versions.length - 2].version, versions[versions.length - 1].version];
}
