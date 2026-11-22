import type { DocumentCategory, Dossier, DossierRow } from '@hangyul/types';

/**
 * Owner pass 261119 (req 6) — the document manager's taxonomy, on the Saramin model: documents are grouped by what
 * they ARE (academic, identity, language …), not by their state, and a group that nothing requires and nothing fills
 * takes no space at all — it is only a `+` entry in the "add" list. Pure (no DOM, no storage) so the web and native Student apps share it; unit-tested in `apps/student-web/src/lib/docGroups.test.ts`.
 *
 * Items come from the selected applications' verified requirements (the dossier rows, which the API builds from those
 * requirements); with no application a minimal base set stands in until a university is chosen.
 */
export type DocGroupId = 'academic' | 'identity' | 'language' | 'financial' | 'writing' | 'university' | 'additional';
export const GROUP_ORDER: DocGroupId[] = ['academic', 'identity', 'language', 'financial', 'writing', 'university', 'additional'];

/** Each category's home group. Legalization/translation papers are attributes of a document; a stray one is "additional". */
export const HOME_GROUP: Record<DocumentCategory, DocGroupId> = {
  TRANSCRIPT: 'academic', GRADUATION_CERTIFICATE: 'academic', EXPECTED_GRADUATION_CERTIFICATE: 'academic',
  PASSPORT: 'identity', NATIONAL_ID: 'identity', PHOTO: 'identity', PARENT_ID: 'identity', FAMILY_RELATION_CERTIFICATE: 'identity',
  BIRTH_CERTIFICATE: 'identity', RESIDENCE_CARD: 'identity', VISA: 'identity',
  TOPIK: 'language', IELTS: 'language', TOEFL: 'language', LANGUAGE_CERTIFICATE: 'language',
  BANK_STATEMENT: 'financial', SPONSOR_DOCUMENT: 'financial', EMPLOYMENT_INCOME_PROOF: 'financial',
  PERSONAL_STATEMENT: 'writing', STUDY_PLAN: 'writing', CV: 'writing', RESEARCH_PROPOSAL: 'writing',
  APPLICATION_FORM: 'university', CONSENT_FORM: 'university', ADMISSION_LETTER: 'university',
  RECOMMENDATION: 'additional', PORTFOLIO: 'additional', APOSTILLE: 'additional', NOTARIZATION: 'additional',
  CERTIFIED_TRANSLATION: 'additional', OTHER: 'additional',
};

/** Writing categories are written in the essay editor first. */
export const WRITTEN = new Set<DocumentCategory>(['PERSONAL_STATEMENT', 'STUDY_PLAN', 'CV', 'RESEARCH_PROPOSAL']);

/**
 * The group a category lands in. An "additional" kind of document (portfolio, recommendation, other) that a university
 * asks for is a university-specific requirement, so it moves to that group instead of hiding among optional extras.
 */
export function groupOf(category: DocumentCategory, askedByUniversity: boolean): DocGroupId {
  const home = HOME_GROUP[category] ?? 'additional';
  return home === 'additional' && askedByUniversity ? 'university' : home;
}

/** With no application yet: the documents almost every Korean university asks for. */
export const BASE_SET: DocumentCategory[] = ['PASSPORT', 'TRANSCRIPT', 'GRADUATION_CERTIFICATE', 'TOPIK'];

/** What a student can add (Saramin's "구분" selector): certificate · language test · award, plus our other optional kinds. */
export type AddType = 'certificate' | 'award' | 'recommendation' | 'portfolio' | 'TOPIK' | 'IELTS' | 'TOEFL' | 'other';
export const ADD_TYPES: { type: AddType; category: DocumentCategory; group: DocGroupId }[] = [
  { type: 'certificate', category: 'OTHER', group: 'additional' },
  { type: 'TOPIK', category: 'TOPIK', group: 'language' },
  { type: 'IELTS', category: 'IELTS', group: 'language' },
  { type: 'TOEFL', category: 'TOEFL', group: 'language' },
  { type: 'award', category: 'OTHER', group: 'additional' },
  { type: 'recommendation', category: 'RECOMMENDATION', group: 'additional' },
  { type: 'portfolio', category: 'PORTFOLIO', group: 'additional' },
  { type: 'other', category: 'OTHER', group: 'additional' },
];
export const addTypeOf = (type: AddType) => ADD_TYPES.find((a) => a.type === type)!;

/** An empty optional record the student added to their own list (kept in the browser; holds no file). */
export interface AddedSlot { id: string; type: AddType }

export type ItemStatus = 'missing' | 'uploaded' | 'review' | 'fix' | 'action' | 'verified' | 'expired';
/** Where an item comes from: an application requirement, the base set, a stored extra, an optional university item, or the student. */
export type ItemSource = 'requirement' | 'base' | 'stored' | 'optional' | 'added';

export interface DocItem {
  key: string; category: DocumentCategory; group: DocGroupId; required: boolean; status: ItemStatus; done: boolean;
  source: ItemSource; row: DossierRow | null; slot?: AddedSlot;
  /** Universities whose applications need it, with how many applications each. */
  universities: { name: string; name_ko?: string | null; count: number }[];
  /** Earliest application deadline among the applications that still need it. */
  deadline: string | null;
}

export interface GroupCounts { required: number; optional: number; done: number; missing: number; fix: number; action: number; expired: number; review: number }
export type GroupTone = 'danger' | 'warning' | 'info' | 'success' | 'neutral';
export interface DocGroup {
  id: DocGroupId; required: boolean; items: DocItem[]; counts: GroupCounts; tone: GroupTone;
  /** Any item holds an uploaded file (a group with files can collapse but never be hidden). */
  hasUploads: boolean;
  /** Something here waits for the student → the section starts expanded. */
  needsYou: boolean;
}

export interface Layout {
  /** Groups shown in the main column, in taxonomy order. */
  groups: DocGroup[];
  /** Groups that take no space: listed only with `+` (with the optional items a university suggests, if any). */
  addable: { id: DocGroupId; optional: number }[];
  progress: { done: number; total: number; pct: number };
  hasApplications: boolean;
}

/** One row's status for the student. */
export function itemStatus(row: DossierRow | null): ItemStatus {
  if (!row) return 'missing';
  const d = row.document;
  const uses = row.applications;
  if (!d) return row.essay && row.state === 'review' ? 'review' : 'missing';
  if (d.status === 'NEEDS_CORRECTION' || uses.some((u) => u.status === 'NEEDS_FIX')) return 'fix';
  if (d.status === 'EXPIRED' || uses.some((u) => u.status === 'EXPIRED')) return 'expired';
  if (row.state === 'todo') return 'action';
  if (d.status === 'VERIFIED') return 'verified';
  if (d.status === 'NEEDS_REVIEW' || row.state === 'review') return 'review';
  if (d.status === 'MISSING') return 'missing';
  return 'uploaded';
}

const NEEDS_YOU: ItemStatus[] = ['missing', 'fix', 'action', 'expired'];

export function counts(items: DocItem[]): GroupCounts {
  const c: GroupCounts = { required: 0, optional: 0, done: 0, missing: 0, fix: 0, action: 0, expired: 0, review: 0 };
  for (const i of items) {
    if (i.required) c.required++; else c.optional++;
    if (i.done) { c.done++; continue; }
    if (i.status === 'missing' && !i.required) continue; // an empty optional slot is not a gap
    if (i.status === 'missing') c.missing++;
    else if (i.status === 'fix') c.fix++;
    else if (i.status === 'action') c.action++;
    else if (i.status === 'expired') c.expired++;
    else if (i.status === 'review' || i.status === 'uploaded') c.review++;
  }
  return c;
}

export function toneOf(c: GroupCounts): GroupTone {
  if (c.fix) return 'danger';
  if (c.missing || c.action || c.expired) return 'warning';
  if (c.review) return 'info';
  if (c.required && c.done >= c.required) return 'success';
  return 'neutral';
}

type DossierLike = Pick<Dossier, 'rows' | 'packages'> & { optional?: { category: DocumentCategory; universities: string[]; universities_ko?: string[] }[] };

/**
 * Builds the sections. `slots` are the student's added optional records; `opened` the optional groups they opened with `+`.
 */
export function buildLayout(d: DossierLike, slots: AddedSlot[] = [], opened: Iterable<DocGroupId> = []): Layout {
  const hasApplications = d.packages.length > 0;
  const deadlines = new Map(d.packages.map((p) => [p.application.id, p.application.deadline]));
  const items: DocItem[] = [];
  const seen = new Set<DocumentCategory>();

  for (const row of d.rows) {
    const required = row.needed_count > 0 || (!hasApplications && BASE_SET.includes(row.category));
    const status = itemStatus(row);
    const done = row.state === 'ready' || (row.state === 'extra' && status === 'verified');
    const byUni = new Map<string, { ko: string | null; count: number }>();
    for (const u of row.applications) {
      const ko = (u as { university_ko?: string | null }).university_ko ?? null;
      const prev = byUni.get(u.university);
      byUni.set(u.university, { ko: prev?.ko ?? ko, count: (prev?.count ?? 0) + 1 });
    }
    const pending = row.applications.filter((u) => u.status !== 'READY' && u.status !== 'NEAR_EXPIRY').map((u) => deadlines.get(u.application_id)).filter(Boolean) as string[];
    items.push({
      key: row.category, category: row.category, group: groupOf(row.category, row.needed_count > 0), required, status, done,
      source: row.needed_count > 0 ? 'requirement' : required ? 'base' : 'stored', row,
      universities: [...byUni].map(([name, v]) => ({ name, name_ko: v.ko, count: v.count })), deadline: done ? null : pending.sort()[0] ?? null,
    });
    seen.add(row.category);
  }
  if (!hasApplications) {
    for (const c of BASE_SET) {
      if (seen.has(c)) continue;
      items.push({ key: c, category: c, group: HOME_GROUP[c], required: true, status: 'missing', done: false, source: 'base', row: null, universities: [], deadline: null });
      seen.add(c);
    }
  }
  const optionalByGroup = new Map<DocGroupId, number>();
  for (const o of d.optional ?? []) {
    if (seen.has(o.category)) continue;
    const g = groupOf(o.category, true);
    optionalByGroup.set(g, (optionalByGroup.get(g) ?? 0) + 1);
    items.push({ key: `opt:${o.category}`, category: o.category, group: g, required: false, status: 'missing', done: false, source: 'optional', row: null,
      universities: o.universities.map((name, i) => ({ name, name_ko: o.universities_ko?.[i] ?? null, count: 1 })), deadline: null });
    seen.add(o.category);
  }
  for (const s of slots) {
    const a = ADD_TYPES.find((x) => x.type === s.type);
    // A typed slot (e.g. IELTS) is answered by that category's row once a file exists; OTHER-kind slots stay their own record.
    if (!a || (a.category !== 'OTHER' && seen.has(a.category) && items.some((i) => i.category === a.category && i.row))) continue;
    items.push({ key: `slot:${s.id}`, category: a.category, group: a.group, required: false, status: 'missing', done: false, source: 'added', row: null, slot: s, universities: [], deadline: null });
  }

  const open = new Set(opened);
  const groups: DocGroup[] = [];
  const addable: Layout['addable'] = [];
  for (const id of GROUP_ORDER) {
    const all = items.filter((i) => i.group === id);
    const required = all.some((i) => i.required);
    const hasUploads = all.some((i) => !!i.row?.document);
    const hasEssay = all.some((i) => !!i.row?.essay);
    const visible = required || hasUploads || hasEssay || all.some((i) => i.source === 'added') || open.has(id);
    if (!visible) { addable.push({ id, optional: optionalByGroup.get(id) ?? 0 }); continue; }
    // Suggested optional items show only once the student opens their group — they never take space by themselves.
    const shown = all.filter((i) => i.source !== 'optional' || open.has(id) || required || hasUploads);
    const c = counts(shown);
    groups.push({ id, required, items: sortItems(shown), counts: c, tone: toneOf(c), hasUploads, needsYou: shown.some((i) => !i.done && NEEDS_YOU.includes(i.status) && (i.required || !!i.row)) });
  }
  const req = items.filter((i) => i.required);
  const done = req.filter((i) => i.done).length;
  return { groups, addable, progress: { done, total: req.length, pct: req.length ? Math.round((done / req.length) * 100) : 0 }, hasApplications };
}

const STATUS_RANK: Record<ItemStatus, number> = { fix: 0, expired: 1, missing: 2, action: 3, review: 4, uploaded: 5, verified: 6 };
/** Required before optional; within each, what needs the student first. */
function sortItems(items: DocItem[]): DocItem[] {
  return [...items].sort((a, b) => Number(b.required) - Number(a.required) || Number(a.done) - Number(b.done) || STATUS_RANK[a.status] - STATUS_RANK[b.status]);
}

/** A section starts expanded when it waits for the student; complete or waiting-on-Hangyul sections start collapsed. */
export const defaultExpanded = (g: DocGroup) => g.needsYou;

/** Required items can collapse but never be removed; only an empty record the student added can be. */
export const canRemove = (i: DocItem) => i.source === 'added' && !i.row;

/** `−` hides a whole optional section only when it holds no file and nothing required; otherwise it just collapses. */
export const canHide = (g: Pick<DocGroup, 'required' | 'hasUploads' | 'items'>) => !g.required && !g.hasUploads && !g.items.some((i) => !!i.row?.essay);

type TFn = (key: string, opts?: Record<string, unknown>) => string;

/** The one-line collapsed summary: "3 required · 2 complete · 1 needs correction" (zeros dropped). */
export function groupSummary(t: TFn, c: GroupCounts): string {
  const p: string[] = [];
  if (c.required) p.push(t('dossier:groups.summary.required', { count: c.required }));
  if (c.optional) p.push(t('dossier:groups.summary.optional', { count: c.optional }));
  if (c.required && c.done >= c.required && !c.fix && !c.missing && !c.action && !c.expired && !c.review) {
    p.push(t('dossier:groups.summary.allDone'));
    return p.join(' · ');
  }
  if (c.done) p.push(t('dossier:groups.summary.done', { count: c.done }));
  if (c.fix) p.push(t('dossier:groups.summary.fix', { count: c.fix }));
  if (c.expired) p.push(t('dossier:groups.summary.expired', { count: c.expired }));
  if (c.missing) p.push(t('dossier:groups.summary.missing', { count: c.missing }));
  if (c.action) p.push(t('dossier:groups.summary.action', { count: c.action }));
  if (c.review) p.push(t('dossier:groups.summary.review', { count: c.review }));
  return p.join(' · ');
}

// ------------------------------------------------------------------ per-viewer preferences (storage lives in each app)
/** What a viewer opened with `+` and the optional records they added. Web keeps it in localStorage, native in AsyncStorage. */
export interface DocPrefs { opened: DocGroupId[]; slots: AddedSlot[] }
export const DOC_PREFS_KEY = 'hg.documents.sections.v1';
/** Validates a stored value (anything) into prefs, dropping unknown groups/types. */
export function sanitizeDocPrefs(v: unknown): DocPrefs {
  const p = v as DocPrefs | null;
  if (p && Array.isArray(p.opened) && Array.isArray(p.slots)) {
    return {
      opened: p.opened.filter((g) => GROUP_ORDER.includes(g)),
      slots: p.slots.filter((s) => !!s && typeof s.id === 'string' && ADD_TYPES.some((a) => a.type === s.type)),
    };
  }
  return { opened: [], slots: [] };
}

/**
 * Product-excellence pass (2026-11-22): the Documents page opens on what is left to do.
 *
 * Every item belongs to exactly one view: `todo` (the student must upload, fix, renew or act — an empty *optional*
 * slot is not a gap), `review` (uploaded, being checked), `done` (ready). `all` shows everything, as before. The counts
 * on the switch are the number of items each view lists; university requests always count as `todo`.
 */
export type DocView = 'todo' | 'review' | 'done' | 'all';
export const DOC_VIEWS: DocView[] = ['todo', 'review', 'done', 'all'];

export function viewOf(i: DocItem): Exclude<DocView, 'all'> | null {
  if (i.done) return 'done';
  if (NEEDS_YOU.includes(i.status)) return i.required || !!i.row ? 'todo' : null;
  if (i.status === 'review' || i.status === 'uploaded') return 'review';
  return i.status === 'verified' ? 'done' : null;
}

export function viewCounts(layout: Pick<Layout, 'groups'>, requests = 0): Record<DocView, number> {
  const c: Record<DocView, number> = { todo: requests, review: 0, done: 0, all: requests };
  for (const g of layout.groups) for (const i of g.items) {
    const v = viewOf(i);
    if (v) c[v]++;
    if (v || i.row) c.all++;
  }
  return c;
}

/** The groups a view shows: only the items in that view, and only groups that still have one. `all` is unchanged. */
export function filterGroups<G extends Pick<DocGroup, 'items'>>(groups: G[], view: DocView): G[] {
  if (view === 'all') return groups;
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => viewOf(i) === view) })).filter((g) => g.items.length > 0);
}

/** The view a student lands on: their to-do list while there is one, otherwise everything. */
export const defaultView = (c: Record<DocView, number>): DocView => (c.todo > 0 ? 'todo' : 'all');
