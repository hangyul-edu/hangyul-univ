/**
 * V5 writing — pure helpers for the student's Writing pages (server contract: server/app/services/writing.py).
 * Status lines are truthful: "flagged" only appears when the server says the late review was escalated.
 */
import { countryName } from '@hangyul/utils';
import type { AuthorKind, Essay, EssayComment, EssayStatus, WritingBlock, WritingFinding, WritingStatusLine } from '@hangyul/types';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Who the reviewer is, in the student's words.
 *
 * V22 (REPORT §246 A3): the server serves a student `{ name: 'Hangyul Univ Team', display: 'team', org }` for any
 * staff reviewer, never a person. That renders as the localised team name — "한귤 유니브 상담팀 (Lotus Bridge
 * Education)" — and a Hangyul-side team reviewer is just the team name (the "(Hangyul)" suffix would repeat it).
 */
export function reviewerName(t: TFn, r: WritingStatusLine['reviewer']): string {
  if (!r) return t('writing:student.aReviewer');
  const team = (r as { display?: string }).display === 'team' || r.name === 'Hangyul Univ Team';
  const name = team ? t('student:messages.team') : r.name;
  if (r.kind === 'HANGYUL') return team ? name : t('writing:student.reviewerHangyul', { name });
  if (r.kind === 'AGENCY' && r.org) return t('writing:student.reviewerAgency', { name, org: r.org });
  return name ?? t('writing:student.aReviewer');
}

/** One sentence for the student's review status, or null when there is nothing to say (draft). */
export function statusSentence(t: TFn, s: WritingStatusLine | undefined, fmt: (iso: string) => string): { text: string; tone: 'info' | 'warning' | 'success' | 'neutral' } | null {
  if (!s) return null;
  const name = reviewerName(t, s.reviewer);
  const submitted = s.submitted_at ? fmt(s.submitted_at) : '';
  const expected = s.expected_by ? fmt(s.expected_by) : '';
  switch (s.code) {
    case 'REVIEWING':
      return { text: t('writing:sl.REVIEWING', { name, submitted, expected }), tone: 'info' };
    case 'FINAL':
      return { text: t('writing:sl.FINAL', { name, expected }), tone: 'info' };
    case 'LATE_FLAGGED':
      return { text: s.flagged_to_kind === 'HANGYUL' ? t('writing:sl.LATE_FLAGGED_HANGYUL') : t('writing:sl.LATE_FLAGGED', { org: s.flagged_to ?? '' }), tone: 'warning' };
    case 'LATE':
      return { text: t('writing:sl.LATE', { name }), tone: 'warning' };
    case 'WAITING_REVIEWER':
      return { text: t('writing:sl.WAITING_REVIEWER', { submitted }), tone: 'info' };
    case 'CHANGES':
      return { text: t('writing:sl.CHANGES', { name }), tone: 'warning' };
    case 'READY':
      return { text: t('writing:sl.READY', { version: s.approved_version ?? '' }), tone: 'success' };
    default:
      return null;
  }
}

/** Finding explanation in the student's language; the quote is shown separately. */
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

/** Findings the student sees: open, never staff-only; fact checks first, then must-fix, then the rest. */
export function studentFindings(list: WritingFinding[] | undefined): { facts: WritingFinding[]; other: WritingFinding[] } {
  const open = (list ?? []).filter((f) => f.status === 'OPEN' && !f.staff_only);
  const sev = { BLOCKER: 0, WARNING: 1, INFO: 2 } as const;
  const sorted = [...open].sort((a, b) => sev[a.severity] - sev[b.severity]);
  return { facts: sorted.filter((f) => f.kind === 'FACT'), other: sorted.filter((f) => f.kind !== 'FACT') };
}

export function authorRole(kind: AuthorKind | undefined): 'you' | 'agency' | 'hangyul' | 'reviewer' {
  if (kind === 'STUDENT') return 'you';
  if (kind === 'AGENCY') return 'agency';
  if (kind === 'HANGYUL') return 'hangyul';
  return 'reviewer';
}

// ============================================================================ V6 (server: services/writing.py V6)
// Typed here until the shared @hangyul/types / api-client carry the V6 fields and endpoints.
export type SuggestionState = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
export interface V6Comment extends EssayComment {
  suggestion_state?: SuggestionState | null; decided_at?: string | null; decision_note?: string | null; decision_version?: number | null;
}
export interface V6UsedBy { application_id: string; university: string | null; program: string | null; application_status: string; approved_version: number | null; newer_draft: boolean }
export type V6Essay = Omit<Essay, 'comments' | 'writing'> & {
  comments: V6Comment[];
  writing?: WritingBlock & { attestations?: Record<string, { version: number; attested_at: string }>; used_by?: V6UsedBy[]; ai?: unknown };
};

/** The student decides on suggestions (and edits) only while the text is with them. */
export const STUDENT_EDITABLE: EssayStatus[] = ['DRAFT', 'CHANGES_REQUESTED', 'STUDENT_REVISION'];
export function canDecide(status: EssayStatus): boolean {
  return STUDENT_EDITABLE.includes(status);
}

/** Comments in the order of the text (unlocated ones last), so the margin reads top to bottom with the essay. */
export function marginOrder<C extends Pick<EssayComment, 'id' | 'quote' | 'anchor_start' | 'at'>>(body: string, comments: C[]): C[] {
  const pos = (c: C) => {
    if (!c.quote) return Number.POSITIVE_INFINITY;
    if (c.anchor_start != null && body.slice(c.anchor_start, c.anchor_start + c.quote.length) === c.quote) return c.anchor_start;
    const i = body.indexOf(c.quote);
    return i < 0 ? Number.POSITIVE_INFINITY : i;
  };
  return [...comments].sort((a, b) => pos(a) - pos(b) || a.at.localeCompare(b.at));
}

/** Pending suggestions still waiting for the student's decision. */
export function pendingSuggestions(comments: V6Comment[]): V6Comment[] {
  return comments.filter((c) => c.suggestion != null && !c.resolved && (c.suggestion_state ?? 'PENDING') === 'PENDING');
}

/** Whether the quoted text is still in the essay exactly once-or-more (accepting replaces the first match only). */
export function suggestionApplies(body: string, c: Pick<EssayComment, 'quote' | 'suggestion'>): boolean {
  return !!c.quote && c.suggestion != null && body.includes(c.quote);
}

/** "Which version does my application use?" — one line per application. */
export function usedByLine(t: TFn, u: V6UsedBy): string {
  if (!u.approved_version) return t('writing:student6.notApprovedYet', { university: u.university ?? '' });
  return t(u.newer_draft ? 'writing:student6.usedByNewer' : 'writing:student6.usedBy', { version: u.approved_version, university: u.university ?? '' });
}

interface PostApi { post: <R>(path: string, body?: unknown) => Promise<R> }
export const writingV6 = (api: PostApi) => ({
  decide: (essayId: string, commentId: string, decision: 'ACCEPT' | 'REJECT', note?: string) =>
    api.post<V6Essay>(`/writing/essays/${essayId}/suggestions/${commentId}/decision`, { decision, note }),
  /** Submit with the authorship statement recorded on the submitted version. */
  submit: (essayId: string, locale: string) => api.post<V6Essay>(`/essays/${essayId}/status`, { status: 'SUBMITTED', attest: true, locale }),
});
