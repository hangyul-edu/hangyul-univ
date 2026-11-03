/**
 * V26 exact-action links (REPORT §341, RC-01).
 *
 * A queue row knows *why* a student needs us (`waiting_reason.code`, or the TODAY view the counsellor picked). Before V26 every
 * row opened `/students/:id` and the counsellor hunted for the request, the thread or the document. The server now returns
 * `targets` — the record ids behind the work — and this decides which one a row opens, as a `focus=<kind>:<id>` the workspace
 * understands (open the right tab, scroll, highlight, open the drawer or put the cursor in the reply box).
 */
import type { AgencyStudentRow } from '@hangyul/types';

/** `compose` = there is no thread yet: open a new conversation to this student (the id is the student's). */
export type FocusKind = 'request' | 'reply' | 'thread' | 'doc' | 'essay' | 'app' | 'task' | 'compose';
export interface Focus { kind: FocusKind; id: string }

/** `kind:id` ⇄ Focus. Unknown or malformed values are ignored (the workspace then opens as before). */
export function parseFocus(v: string | null | undefined): Focus | null {
  const m = /^(request|reply|thread|doc|essay|app|task|compose):([0-9a-f-]{8,})$/.exec(v ?? '');
  return m ? { kind: m[1] as FocusKind, id: m[2] } : null;
}

/** Which TODAY view asks for which record first. */
const VIEW_FIRST: Record<string, string[]> = {
  requested: ['request'],
  // "Waiting on the university": the application under review is the record (there is nothing of ours to open).
  university: ['app'],
  waiting_counselor: ['reply', 'review', 'essay', 'task'],
  // A silent student is contacted: the last thread, or — when there is none — a new conversation.
  student_silent: ['thread', 'compose'],
  deadline7: ['deadline'],
  docs: ['doc'],
};

/** Which reason (STATE_MAP "Waiting on") asks for which record. */
const REASON_FIRST: Record<string, string[]> = {
  reply_owed: ['reply'], first_contact: ['thread', 'compose'],
  review: ['review'], review_unassigned: ['review'],
  essay_review: ['essay'], essay_unassigned: ['essay'],
  university_request: ['request'], fix: ['fix'],
  task: ['task'], task_unassigned: ['task'],
  submit: ['app'], final_check: ['app'], profile_check: ['app'], app: ['app'], app_university: ['app'], submit_on_portal: ['app'], rail_confirmation: ['app'],
};

/** The exact record a row should open, or null when the student page itself is the right destination. */
export function rowFocus(row: Pick<AgencyStudentRow, 'id' | 'targets' | 'waiting_reason'>, view?: string | null): Focus | null {
  const t = row.targets ?? {};
  const pick = (k: string): Focus | null => {
    switch (k) {
      case 'request': return t.request ? (t.request.id ? { kind: 'request', id: t.request.id } : { kind: 'app', id: t.request.application_id }) : null;
      case 'reply': return t.reply_thread ? { kind: 'reply', id: t.reply_thread } : null;
      case 'thread': return t.thread ? { kind: 'thread', id: t.thread } : null;
      case 'review': return t.review_doc ? { kind: 'doc', id: t.review_doc } : null;
      case 'fix': return t.fix_doc ? { kind: 'doc', id: t.fix_doc } : null;
      case 'doc': return t.review_doc ? { kind: 'doc', id: t.review_doc } : t.fix_doc ? { kind: 'doc', id: t.fix_doc } : null;
      case 'essay': return t.essay ? { kind: 'essay', id: t.essay } : null;
      case 'task': return t.task ? { kind: 'task', id: t.task } : null;
      case 'deadline': return t.deadline_app ? { kind: 'app', id: t.deadline_app } : null;
      case 'app': return t.app ? { kind: 'app', id: t.app } : null;
      case 'compose': return { kind: 'compose', id: row.id };
      default: return null;
    }
  };
  const order = [...((view && VIEW_FIRST[view]) ?? []), ...(REASON_FIRST[row.waiting_reason?.code ?? ''] ?? [])];
  for (const k of order) { const f = pick(k); if (f) return f; }
  return null;
}

/** Where a row goes: the essay editor for an essay, otherwise the workspace focused on the record. */
export function rowHref(row: Pick<AgencyStudentRow, 'id' | 'targets' | 'waiting_reason'>, view?: string | null): string {
  const f = rowFocus(row, view);
  if (!f) return `/students/${row.id}`;
  if (f.kind === 'essay') return `/essays/${f.id}`;
  return `/students/${row.id}?focus=${f.kind}:${f.id}`;
}
