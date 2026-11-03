/**
 * V6 writing review workspace (agency). The manuscript dominates: a compact context header, the university question
 * above the text, the student's text in a reading column, and ONE switchable rail (Comments · Checks · Rubric ·
 * Versions) that becomes a bottom sheet on narrow screens. Review loop: comment on a selection (C), approve (A) or
 * request changes (R) → the next essay of the same queue view opens. Nothing here edits the student's text.
 */
import { useAuth } from '@hangyul/auth';
import {
  ArrowLeft, Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, CircleDashed, ClipboardCheck, Eye, FileClock, GitCompare, Keyboard,
  ListChecks, Lock, MessageSquarePlus, MessagesSquare, RefreshCw, Send, ShieldCheck, Sparkles, TriangleAlert, Undo2, UserCog, X,
} from '@hangyul/icons';
import type { EssayStatus, RubricRating, WritingCandidate, WritingFinding, WritingGateItem } from '@hangyul/types';
import { Button, Drawer, EmptyState, Field, Input, Modal, QueryState, FilterSelect, Skeleton, Textarea, useToast } from '@hangyul/ui';
import { countryName, cx, formatDate, formatDateTime } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { EssayStatusBadge, useT } from '../components/bits';
import { EssayAllowance } from '../components/Plan';
import { usePerms } from '../lib/hooks';
import { commentRange, highlightSegments, languageName } from '../lib/logic';
import {
  ageLabel, annotationSeverity, authorKindLabel, authorOf, commentOrder, defaultCompare, findingText, gateItemReason, groupDimensions, hoursUntil,
  lengthStats, loadQueueMemory, previousInQueue, queuePosition, saveQueueMemory, shortcutFor, SHORTCUTS, sortFindings, step, writingV6,
  type ShortcutAction, type V6Comment, type V6Essay,
} from '../lib/writing';
import { YAvatar } from '../components/ynex';
import './writing.css';

interface Draft { quote: string; start: number; end: number }
type RailTab = 'comments' | 'checks' | 'rubric' | 'versions';
const REVIEW_STATES: EssayStatus[] = ['SUBMITTED', 'AI_PRECHECK', 'AGENCY_REVIEW', 'FINAL_REVIEW'];

function selectionIn(container: HTMLElement | null): (Draft & { rect: DOMRect }) | null {
  const sel = window.getSelection();
  if (!container || !sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  if (!container.contains(r.commonAncestorContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(container);
  pre.setEnd(r.startContainer, r.startOffset);
  const start = pre.toString().length;
  const quote = r.toString();
  if (!quote.trim()) return null;
  return { quote, start, end: start + quote.length, rect: r.getBoundingClientRect() };
}

function useEssayMutation<V>(essayId: string, fn: (v: V) => Promise<unknown>, ok?: string, after?: () => void) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (e) => {
      if (e && typeof e === 'object' && 'id' in e && 'body' in e) qc.setQueryData(['essay', essayId], e);
      else qc.invalidateQueries({ queryKey: ['essay', essayId] });
      qc.invalidateQueries({ queryKey: ['writing', 'queue'] });
      if (ok) toast.success(ok);
      after?.();
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

/** Who wrote this: Student text · Agency reviewer (name + agency) · Hangyul reviewer. */
function AuthorTag({ e, userId }: { e: V6Essay; userId?: string | null }) {
  const { t } = useT();
  const a = authorOf(e.writing, userId);
  return (
    <span className={cx('wr-author', `wr-author--${a.kind.toLowerCase()}`)}>
      <strong>{a.name ?? '—'}</strong>
      <span className="wr-author__kind">{authorKindLabel(t, a.kind)}{a.kind === 'AGENCY' && a.org ? ` · ${a.org}` : ''}</span>
    </span>
  );
}

// ------------------------------------------------------------------ compact context header
function ContextHeader({ e, onReassign, onApprove, onChanges, onMove, onNext, nextId, onHelp, blockers }: {
  e: V6Essay; onReassign: () => void; onApprove: () => void; onChanges: () => void; onMove: (s: EssayStatus) => void; onNext: () => void;
  nextId: string | null | undefined; onHelp: () => void; blockers: number;
}) {
  const { t, locale } = useT();
  const w = e.writing!;
  const left = hoursUntil(w.review.expected_review_by);
  const inReview = REVIEW_STATES.includes(e.status);
  const intake = w.context.intake ? `${t(`term.${w.context.intake.term}`)} ${w.context.intake.year}` : null;
  const canApprove = e.allowed_transitions.includes('APPROVED');
  const canChanges = e.allowed_transitions.includes('CHANGES_REQUESTED');
  const otherMoves = e.allowed_transitions.filter((s) => s !== 'APPROVED' && s !== 'CHANGES_REQUESTED');
  const reviewer = e.reviewer ? authorOf(w, e.reviewer.id) : null;
  return (
    <header className="wr-head card custom-card">
      <div className="wr-head__row">
        <Link to="/essays" className="wr-head__back" aria-label={t('nav.essayReviews')}><ArrowLeft size={16} aria-hidden className="hg-flip-rtl" /></Link>
        <YAvatar name={e.owner_name ?? '?'} size="md" className="wr-head__av" />
        <h1 className="wr-head__title">
          <Link to={`/students/${e.owner_user_id}?tab=essays`}>{e.owner_name}</Link>
          <span className="wr-head__sep" aria-hidden>·</span>
          <span>{w.context.university?.name ?? '—'}</span>
          {w.context.program && <><span className="wr-head__sep" aria-hidden>·</span><span className="wr-head__soft">{w.context.program.name}</span></>}
          {intake && <><span className="wr-head__sep" aria-hidden>·</span><span className="wr-head__soft">{intake}</span></>}
        </h1>
        <div className="wr-head__actions">
          {otherMoves.map((s) => <Button key={s} size="sm" variant="ghost" onClick={() => onMove(s)}>{t(`editor.action.${s}`, { defaultValue: t(`essayStatus.${s}`) })}</Button>)}
          {canChanges && <Button size="sm" icon={<Undo2 />} onClick={onChanges} title={t('writing:v6.keyHint', { key: 'R' })}>{t('writing:v6.requestChanges')}</Button>}
          {canApprove && (
            <Button size="sm" variant={blockers ? 'secondary' : 'primary'} icon={<ShieldCheck />} onClick={onApprove} title={t('writing:v6.keyHint', { key: 'A' })}>
              {blockers ? t('writing:gate.approveBlocked', { count: blockers }) : t('writing:v6.approve')}
            </Button>
          )}
          <Button size="sm" variant="ghost" iconOnly icon={<ChevronRight className="hg-flip-rtl" />} disabled={!nextId} onClick={onNext}
            aria-label={t('writing:v6.nextEssay')} title={`${t('writing:v6.nextEssay')} (])`} />
          <Button size="sm" variant="ghost" iconOnly icon={<Keyboard />} onClick={onHelp} aria-label={t('writing:v6.shortcuts')} title={`${t('writing:v6.shortcuts')} (?)`} />
        </div>
      </div>
      <dl className="wr-head__meta">
        <div><dt className="hg-sr-only">{t('writing:ws.type')}</dt><dd>{t(`essayType.${e.essay_type}`)} · v{e.current_version}{w.review.round > 1 && <span className="wr-head__soft"> · {t('writing:queue.round', { n: w.review.round })}</span>}</dd></div>
        <div><dt>{t('writing:ws.status')}</dt><dd><EssayStatusBadge status={e.status} /></dd></div>
        {/*
          V15, brief Part 12: 첨삭 is a counted, priced promise (Basic 0, All-in-One 1, Premium 2), and this
          is where a reviewer decides whether to ask for another revision. The workspace panel shows the
          same number, but a reviewer working the queue never opens it — the allowance has to be where the
          decision is made or it is not operational.
        */}
        <EssayAllowance studentId={e.owner_user_id} />
        <div><dt>{t('writing:v6.deadline')}</dt><dd className="hg-num">{e.due_date ? formatDate(e.due_date, locale, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</dd></div>
        <div><dt>{t('writing:ws.reviewer')}</dt><dd>
          {reviewer ? <span title={reviewer.org ?? undefined}>{reviewer.name}{reviewer.kind === 'HANGYUL' && <span className="wr-head__soft"> · {t('writing:kind.HANGYUL')}</span>}</span> : <span className="wr-head__soft">{t('misc.unassigned')}</span>}
          {<button type="button" className="wr-linkbtn" onClick={onReassign}><UserCog size={13} aria-hidden /> {t('writing:ws.reassign')}</button>}
        </dd></div>
        <div><dt>{t('writing:v6.reviewDue')}</dt><dd className={cx('hg-num', w.review.overdue && 'wr-late')}>
          {inReview && w.review.expected_review_by ? <>
            <span title={formatDateTime(w.review.expected_review_by, locale)}>{w.review.overdue ? t('writing:queue.late', { age: ageLabel(t, -(left ?? 0)) }) : t('writing:queue.left', { age: ageLabel(t, left) })}</span>
            {w.review.escalated && <span className="wr-escalated">{t('writing:v6.escalatedTo', { name: w.review.escalated_to ?? t('writing:v6.manager') })}</span>}
          </> : <span className="wr-head__soft">{t('writing:ws.noSla')}</span>}
        </dd></div>
      </dl>
    </header>
  );
}

// ------------------------------------------------------------------ university question (collapsible, above the text)
function Question({ e, onAttach }: { e: V6Essay; onAttach: () => void }) {
  const { t } = useT();
  const w = e.writing!;
  const [open, setOpen] = useState(true);
  const text = w.prompt?.text ?? e.prompt;
  const verified = w.prompt?.verification_status === 'VERIFIED';
  return (
    <section className={cx('wr-q', !open && 'is-collapsed')} aria-label={t('writing:prompt.title')}>
      <div className="wr-q__head">
        <button type="button" className="wr-q__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <ChevronDown size={14} aria-hidden className="wr-q__chev" /> {t('writing:prompt.title')}
        </button>
        <span className="wr-q__meta">
          {w.limits.word_limit && <span>{t('writing:prompt.words', { count: w.limits.word_limit })}</span>}
          {w.limits.char_limit && <span>{t('writing:prompt.chars', { count: w.limits.char_limit })}</span>}
          {w.prompt?.source_url && <a href={w.prompt.source_url} target="_blank" rel="noreferrer">{t('writing:prompt.source')}</a>}
        </span>
        <button type="button" className="wr-linkbtn" onClick={onAttach}>{text ? t('writing:prompt.change') : t('writing:prompt.attach')}</button>
      </div>
      {open && (text ? <>
        <p className="wr-q__text">{text}</p>
        {!verified && <p className="wr-q__note">{w.prompt ? t('writing:v6.unverified') : t('writing:v6.studentPasted')}</p>}
      </> : <p className="wr-q__note">{t('writing:prompt.unknownStaff')}</p>)}
    </section>
  );
}

// ------------------------------------------------------------------ prompt attach / enter (V5, kept)
function PromptModal({ e, onClose }: { e: V6Essay; onClose: () => void }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const w = e.writing!;
  const uni = w.context.university;
  const known = useQuery({ queryKey: ['writing', 'prompts', uni?.id, e.essay_type], enabled: !!uni,
    queryFn: () => api.writing.prompts({ university_id: uni!.id, essay_type: e.essay_type }) });
  const [mode, setMode] = useState<'pick' | 'new'>('pick');
  const [pick, setPick] = useState('');
  const [text, setText] = useState('');
  const [limit, setLimit] = useState('');
  const [source, setSource] = useState('');
  const m = useEssayMutation(e.id, () => api.writing.attachPrompt(e.id, mode === 'pick' ? { prompt_id: pick } : {
    prompt: { university_id: uni!.id, program_id: w.context.program?.id, essay_type: e.essay_type, prompt_text: text.trim(), word_limit: Number(limit) || undefined,
      source_url: source.trim() || undefined, intake_year: w.context.intake?.year, intake_term: w.context.intake?.term, prompt_language: 'en' },
  }), t('writing:prompt.saved'), onClose);
  const list = known.data?.items ?? [];
  const valid = mode === 'pick' ? !!pick : text.trim().length >= 10;
  return (
    <Modal open onClose={onClose} title={t('writing:prompt.modalTitle')} description={uni ? `${uni.name} · ${t(`essayType.${e.essay_type}`)}` : undefined} width={640}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" disabled={!valid || !uni} loading={m.isPending} onClick={() => m.mutate(undefined)}>{t('writing:prompt.save')}</Button></>}>
      <div className="hg-stack" style={{ '--hg-gap': '12px' } as React.CSSProperties}>
        <div className="hg-seg" role="group" aria-label={t('writing:prompt.modalTitle')}>
          <button type="button" aria-pressed={mode === 'pick'} onClick={() => setMode('pick')}>{t('writing:prompt.pick', { count: list.length })}</button>
          <button type="button" aria-pressed={mode === 'new'} onClick={() => setMode('new')}>{t('writing:prompt.enter')}</button>
        </div>
        {mode === 'pick' ? (list.length === 0 ? <p className="hg-subtle hg-small">{t('writing:prompt.noneKnown')}</p> : (
          <ul className="hg-list" role="radiogroup" aria-label={t('writing:prompt.pick', { count: list.length })}>
            {list.map((p) => (
              <li key={p.id} className="wr-pick">
                <label className="hg-check" style={{ alignItems: 'flex-start' }}>
                  <input type="radio" name="prompt" checked={pick === p.id} onChange={() => setPick(p.id)} />
                  <span>
                    <span className="hg-small">{p.text}</span>
                    <span className="hg-xs hg-subtle" style={{ display: 'block' }}>
                      {t(`writing:prompt.status.${p.verification_status}`)} · {t('writing:prompt.version', { version: p.version })}
                      {p.effective_from && <> · {t('writing:prompt.from', { term: t(`term.${p.effective_from.term}`), year: p.effective_from.year })}</>}
                      {p.verified_at && <> · {t('writing:prompt.verifiedOn', { date: formatDate(p.verified_at, locale) })}</>}
                      {p.entered_by_org && <> · {t('writing:prompt.enteredBy', { org: p.entered_by_org })}</>}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )) : (
          <>
            <Field label={t('writing:prompt.textLabel')} htmlFor="pr-text" hint={t('writing:prompt.textHint')}>
              <Textarea id="pr-text" rows={4} value={text} onChange={(ev) => setText(ev.target.value)} maxLength={4000} />
            </Field>
            <div className="hg-row-wrap" style={{ '--hg-gap': '12px' } as React.CSSProperties}>
              <Field label={t('writing:prompt.limitLabel')} htmlFor="pr-limit" optional><Input id="pr-limit" inputMode="numeric" value={limit} onChange={(ev) => setLimit(ev.target.value.replace(/\D/g, ''))} style={{ maxWidth: 140 }} /></Field>
              <Field label={t('writing:prompt.sourceLabel')} htmlFor="pr-src" optional className="hg-grow"><Input id="pr-src" type="url" value={source} onChange={(ev) => setSource(ev.target.value)} placeholder="https://" /></Field>
            </div>
            <p className="hg-xs hg-subtle">{t('writing:prompt.enteredNote', { intake: w.context.intake ? `${t(`term.${w.context.intake.term}`)} ${w.context.intake.year}` : '—' })}</p>
          </>
        )}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ reviewer matching / reassign (V5, kept)
function ReassignModal({ e, onClose }: { e: V6Essay; onClose: () => void }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const q = useQuery({ queryKey: ['writing', 'candidates', e.id], queryFn: () => api.writing.candidates(e.id) });
  const [pick, setPick] = useState('');
  const [reason, setReason] = useState('');
  const m = useEssayMutation(e.id, () => api.writing.assign(e.id, pick, reason.trim()), t('writing:match.done'), onClose);
  const readable = (r: WritingCandidate['reasons'][number]) => {
    const v = String(r.value ?? '');
    if (r.code === 'LANGUAGE' || r.code === 'ESSAY_LANGUAGE_MISSING') return languageName(v, locale) ?? v;
    if (r.code === 'DEGREE') return t(`degree.${v}`);
    if (r.code === 'FIELD') return t(`field.${v}`, { defaultValue: v.replace(/_/g, ' ') });
    if (r.code === 'COUNTRY') return countryName(v, locale);
    return v;
  };
  const reasonText = (r: WritingCandidate['reasons'][number]) => t(`writing:match.reason.${r.code}`, { value: readable(r), defaultValue: r.code });
  return (
    <Modal open onClose={onClose} title={t('writing:match.title')} description={t('writing:match.sub')} width={640}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" disabled={!pick || reason.trim().length < 5} loading={m.isPending} onClick={() => m.mutate(undefined)}>{t('writing:match.assign')}</Button></>}>
      <QueryState query={q} skeleton={<Skeleton h={160} />}>
        {(d) => (
          <div className="hg-stack" style={{ '--hg-gap': '12px' } as React.CSSProperties}>
            <ul className="hg-list" role="radiogroup" aria-label={t('writing:match.title')}>
              {d.items.map((c, i) => (
                <li key={c.user.id} className="wr-pick">
                  <label className="hg-check" style={{ alignItems: 'flex-start' }}>
                    <input type="radio" name="reviewer" checked={pick === c.user.id} disabled={c.user.id === d.current} onChange={() => setPick(c.user.id)} />
                    <span>
                      <span className="hg-small hg-medium">{c.user.full_name}</span>
                      <span className="hg-xs hg-subtle"> · {c.organization.type === 'HANGYUL' ? t('writing:kind.HANGYUL') : c.organization.name}
                        {c.user.id === d.current && <> · {t('writing:match.current')}</>}{i === 0 && c.user.id !== d.current && <> · {t('writing:match.best')}</>}</span>
                      <span className="hg-xs" style={{ display: 'block' }}>{c.reasons.filter((r) => r.points > 0).map(reasonText).join(' · ') || t('writing:match.noReasons')}</span>
                      <span className={cx('hg-xs', c.at_capacity ? 'wr-late' : 'hg-subtle')} style={{ display: 'block' }}>
                        {t('writing:match.load', { open: c.open_reviews, capacity: c.capacity })}{c.reasons.filter((r) => r.points < 0).map((r) => ` · ${reasonText(r)}`).join('')}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <Field label={t('writing:match.reason')} htmlFor="ra-reason" hint={t('writing:match.reasonHint')}>
              <Textarea id="ra-reason" rows={2} value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={500} />
            </Field>
          </div>
        )}
      </QueryState>
    </Modal>
  );
}

// ------------------------------------------------------------------ comments: to the student vs internal note (two explicit modes)
function Composer({ e, draft, onDone }: { e: V6Essay; draft: Draft | null; onDone: () => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [internal, setInternal] = useState(false);
  const m = useMutation({
    mutationFn: () => api.essays.comment(e.id, {
      body: body.trim(), internal, quote: draft?.quote, anchor_start: draft?.start, anchor_end: draft?.end, suggestion: draft && suggestion.trim() && !internal ? suggestion : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['essay', e.id] }); toast.success(internal ? t('editor.noteAdded') : t('editor.commentAdded')); onDone(); },
    onError: (err) => toast.error((err as Error).message),
  });
  const submit = () => { if (body.trim() && !m.isPending) m.mutate(); };
  return (
    <div className={cx('wr-composer', internal ? 'wr-composer--internal' : 'wr-composer--student')}>
      <div className="wr-mode" role="radiogroup" aria-label={t('writing:ws.commentMode')}>
        <button type="button" role="radio" aria-checked={!internal} onClick={() => setInternal(false)}><Eye aria-hidden size={13} />{t('writing:ws.toStudent')}</button>
        <button type="button" role="radio" aria-checked={internal} onClick={() => setInternal(true)}><Lock aria-hidden size={13} />{t('writing:ws.internalNote')}</button>
      </div>
      <p className={cx('wr-audience', internal && 'wr-audience--internal')} role="note">
        {internal ? <><Lock size={12} aria-hidden /> {t('writing:ws.audienceTeam')}</> : <><Eye size={12} aria-hidden /> {t('writing:ws.audienceStudent', { name: e.owner_name ?? '' })}</>}
      </p>
      {draft ? <blockquote className="wr-quote">“{draft.quote}”</blockquote> : <p className="hg-subtle hg-xs">{t('editor.generalComment')}</p>}
      <Field label={internal ? t('writing:ws.internalNote') : t('editor.comment')} htmlFor="c-body">
        <Textarea id="c-body" rows={3} value={body} onChange={(ev) => setBody(ev.target.value)} maxLength={4000} placeholder={internal ? t('writing:ws.notePh') : t('writing:v6.commentPh')} autoFocus
          onKeyDown={(ev) => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) submit(); if (ev.key === 'Escape') onDone(); }} />
      </Field>
      {draft && !internal && (
        <Field label={t('writing:v6.suggestLabel')} htmlFor="c-sugg" optional hint={t('writing:v6.suggestHint')}>
          <Textarea id="c-sugg" rows={2} value={suggestion} onChange={(ev) => setSuggestion(ev.target.value)} maxLength={4000} placeholder={draft.quote}
            onKeyDown={(ev) => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) submit(); }} />
        </Field>
      )}
      <div className="wr-composer__foot">
        <span className="hg-xs hg-subtle">{t('writing:v6.sendKey')}</span>
        <Button size="sm" variant="ghost" onClick={onDone}>{t('actions.cancel')}</Button>
        <Button size="sm" variant={internal ? 'dark' : 'primary'} disabled={!body.trim()} loading={m.isPending} onClick={submit} icon={internal ? <Lock /> : <Send />}>
          {internal ? t('editor.addNote') : t('writing:ws.sendToStudent')}
        </Button>
      </div>
    </div>
  );
}

function SuggestionState({ c }: { c: V6Comment }) {
  const { t, locale } = useT();
  const s = c.suggestion_state ?? 'PENDING';
  const when = c.decided_at ? formatDate(c.decided_at, locale, { month: 'short', day: 'numeric' }) : '';
  return (
    <span className={cx('wr-sstate', `wr-sstate--${s.toLowerCase()}`)}>
      {s === 'ACCEPTED' ? <Check size={12} aria-hidden /> : s === 'REJECTED' ? <X size={12} aria-hidden /> : <CircleDashed size={12} aria-hidden />}
      {t(`writing:v6.sstate.${s}`, { date: when, version: c.decision_version ?? '' })}
    </span>
  );
}

function CommentCard({ c, e, active, onFocus }: { c: V6Comment; e: V6Essay; active: boolean; onFocus: () => void }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const m = useEssayMutation(e.id, () => api.essays.resolve(e.id, c.id, false), t('editor.resolved'));
  const internal = c.visibility === 'INTERNAL';
  const located = !!commentRange(e.body, c);
  return (
    <li className={cx('wr-cmt', internal ? 'wr-cmt--internal' : 'wr-cmt--student', active && 'is-active', c.resolved && 'is-resolved')} id={`cm-${c.id}`} data-comment={c.id}>
      <div className="wr-cmt__aud">
        {internal ? <><Lock size={12} aria-hidden /> {t('writing:v6.internalTag')}</> : <><Eye size={12} aria-hidden /> {t('writing:v6.studentTag')}</>}
        <span className="wr-cmt__when">v{c.version} · {formatDateTime(c.at, locale)}</span>
      </div>
      <AuthorTag e={e} userId={c.author?.id} />
      {c.quote && (
        <button type="button" className="wr-quote wr-quote--btn" onClick={onFocus} disabled={!located} title={located ? t('editor.showInText') : undefined}>
          “{c.quote}”{!located && <span className="hg-subtle hg-xs"> — {t('editor.quoteChanged')}</span>}
        </button>
      )}
      <p className="wr-cmt__body">{c.body}</p>
      {c.suggestion != null && (
        <div className="wr-sugg" aria-label={t('writing:v6.suggestLabel')}>
          <div className="wr-sugg__head"><span>{t('writing:v6.suggestLabel')}</span><SuggestionState c={c} /></div>
          <div className="wr-sugg__diff">{c.quote && <del>{c.quote}</del>} <ins>{c.suggestion}</ins></div>
          {c.decision_note && <p className="hg-xs hg-subtle">{t('writing:v6.studentSaid', { note: c.decision_note })}</p>}
        </div>
      )}
      {!c.resolved ? <Button size="sm" variant="ghost" icon={<Check />} loading={m.isPending} onClick={() => m.mutate(undefined)}>{t('editor.resolve')}</Button>
        : <span className="hg-subtle hg-xs"><CircleCheck size={12} aria-hidden /> {t('editor.resolvedLabel')}</span>}
    </li>
  );
}

function CommentsPanel({ e, composing, draft, onDone, active, onFocus, onCompose }: {
  e: V6Essay; composing: boolean; draft: Draft | null; onDone: () => void; active: string | null; onFocus: (id: string) => void; onCompose: () => void;
}) {
  const { t } = useT();
  const [showResolved, setShowResolved] = useState(false);
  const ordered = useMemo(() => {
    const order = commentOrder(e.body, e.comments, commentRange);
    return [...e.comments].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }, [e]);
  const open = ordered.filter((c) => !c.resolved);
  const resolved = ordered.filter((c) => c.resolved);
  return (
    <div className="wr-panel">
      {composing ? <Composer key={draft ? `${draft.start}-${draft.end}` : 'general'} e={e} draft={draft} onDone={onDone} /> : (
        <div className="wr-panel__intro">
          <p className="hg-xs hg-subtle">{t('writing:v6.selectHint')}</p>
          <Button size="sm" variant="ghost" icon={<MessageSquarePlus />} onClick={onCompose}>{t('editor.addComment')}</Button>
        </div>
      )}
      {open.length === 0 ? <p className="hg-subtle hg-small">{t('writing:v6.noOpenComments')}</p> : (
        <ul className="wr-cmts">{open.map((c) => <CommentCard key={c.id} c={c} e={e} active={active === c.id} onFocus={() => onFocus(c.id)} />)}</ul>
      )}
      {resolved.length > 0 && (
        <div className="wr-resolved">
          <button type="button" className="wr-linkbtn" aria-expanded={showResolved} onClick={() => setShowResolved(!showResolved)}>
            {showResolved ? t('writing:v6.hideResolved') : t('writing:v6.showResolved', { count: resolved.length })}
          </button>
          {showResolved && <ul className="wr-cmts">{resolved.map((c) => <CommentCard key={c.id} c={c} e={e} active={active === c.id} onFocus={() => onFocus(c.id)} />)}</ul>}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ automatic checks (annotations) + gate summary
function FindingRow({ f, e, active, onShow }: { f: WritingFinding; e: V6Essay; active: boolean; onShow: () => void }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const m = useEssayMutation(e.id, () => api.writing.dismissFinding(e.id, f.id, note.trim()), t('writing:checks.dismissed'));
  return (
    <li className={cx('wr-finding', `wr-finding--${f.severity.toLowerCase()}`, f.status !== 'OPEN' && 'is-closed', active && 'is-active')} data-finding={f.id}>
      <div className="wr-finding__head">
        {f.severity === 'BLOCKER' ? <CircleAlert size={14} aria-hidden /> : f.severity === 'WARNING' ? <TriangleAlert size={14} aria-hidden /> : <CircleDashed size={14} aria-hidden />}
        <span>{t(`writing:sev.${f.severity}`)} · {t(`writing:v6.kind.${f.kind}`, { defaultValue: t('writing:auto.label') })}</span>
        {(f.source as string) === 'AI_SUGGESTION' && <span className="wr-ai"><Sparkles size={11} aria-hidden /> {t('writing:v6.aiSuggestion')}</span>}
        {f.staff_only && <span className="wr-tag">{t('writing:checks.staffOnly')}</span>}
        {f.status !== 'OPEN' && <span className="hg-subtle">· {t(`writing:checks.status.${f.auto_resolved ? 'AUTO' : f.status}`)}</span>}
      </div>
      {f.quote && <button type="button" className="wr-quote wr-quote--btn" onClick={onShow} title={t('editor.showInText')}>“{f.quote}”</button>}
      <p className="hg-small">{findingText(t, f, locale)}</p>
      {f.resolved_note && <p className="hg-xs hg-subtle">{t('writing:checks.note', { note: f.resolved_note })}</p>}
      {f.status === 'OPEN' && f.severity !== 'INFO' && (open ? (
        <div className="hg-stack" style={{ '--hg-gap': '6px' } as React.CSSProperties}>
          <Field label={t('writing:checks.dismissWhy')} htmlFor={`dn-${f.id}`}><Input id={`dn-${f.id}`} value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={1000} /></Field>
          <div className="hg-row" style={{ gap: 6 }}>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t('actions.cancel')}</Button>
            <Button size="sm" disabled={note.trim().length < 3} loading={m.isPending} onClick={() => m.mutate(undefined)}>{t('writing:checks.dismiss')}</Button>
          </div>
        </div>
      ) : <button type="button" className="wr-linkbtn" onClick={() => setOpen(true)}>{t('writing:checks.notApplicable')}</button>)}
    </li>
  );
}

function GateList({ items }: { items: WritingGateItem[] }) {
  const { t } = useT();
  return (
    <ul className="wr-gate">
      {items.map((i) => (
        <li key={i.key} data-state={i.state}>
          {i.state === 'PASSED' ? <CircleCheck aria-hidden /> : i.state === 'BLOCKER' ? <CircleAlert aria-hidden /> : <CircleDashed aria-hidden />}
          <span className="hg-grow">
            <span className="hg-small hg-medium">{t(`writing:gate.item.${i.key}`)}</span>
            {gateItemReason(t, i) && <span className="hg-xs hg-subtle" style={{ display: 'block' }}>{gateItemReason(t, i)}</span>}
          </span>
          <span className="hg-xs wr-gate__state">{t(`writing:gate.state.${i.state}`)}</span>
        </li>
      ))}
    </ul>
  );
}

function ChecksPanel({ e, active, onShow }: { e: V6Essay; active: string | null; onShow: (f: WritingFinding) => void }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const [showClosed, setShowClosed] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const run = useEssayMutation(e.id, () => api.writing.runChecks(e.id), t('writing:checks.ran'));
  const all = sortFindings(e.writing?.findings ?? []);
  const openList = all.filter((f) => f.status === 'OPEN');
  const closed = all.filter((f) => f.status !== 'OPEN');
  const gate = e.writing?.gate;
  const checks = e.writing?.checks;
  return (
    <div className="wr-panel">
      {gate && (
        <section className={cx('wr-gatebox', gate.blockers.length ? 'has-blockers' : 'is-clear')} aria-label={t('writing:v6.gateTitle')}>
          <button type="button" className="wr-gatebox__head" aria-expanded={showGate} onClick={() => setShowGate(!showGate)}>
            {gate.blockers.length ? <CircleAlert size={15} aria-hidden /> : <CircleCheck size={15} aria-hidden />}
            <span className="hg-grow">{gate.blockers.length ? t('writing:v6.gateBlocked', { count: gate.blockers.length }) : t('writing:v6.gateClear')}</span>
            <ChevronDown size={14} aria-hidden className={cx('wr-chev', showGate && 'is-open')} />
          </button>
          {showGate && <GateList items={gate.items} />}
        </section>
      )}
      <div className="wr-checks-head">
        <span className="hg-xs hg-subtle">{checks?.at ? t('writing:checks.ranOn', { version: checks.version, at: formatDateTime(checks.at, locale) }) : t('writing:checks.never')}</span>
        <Button size="sm" variant="ghost" icon={<RefreshCw />} loading={run.isPending} onClick={() => run.mutate(undefined)}>{t('writing:checks.run')}</Button>
      </div>
      {openList.length === 0 ? <p className="hg-small hg-subtle"><CircleCheck size={13} aria-hidden /> {t('writing:v6.noFindings')}</p>
        : <ul className="wr-findings">{openList.map((f) => <FindingRow key={f.id} f={f} e={e} active={active === `f:${f.id}`} onShow={() => onShow(f)} />)}</ul>}
      {closed.length > 0 && (
        <div className="wr-resolved">
          <button type="button" className="wr-linkbtn" aria-expanded={showClosed} onClick={() => setShowClosed(!showClosed)}>
            {showClosed ? t('writing:v6.hideResolved') : t('writing:checks.showClosed', { count: closed.length })}
          </button>
          {showClosed && <ul className="wr-findings">{closed.map((f) => <FindingRow key={f.id} f={f} e={e} active={false} onShow={() => onShow(f)} />)}</ul>}
        </div>
      )}
      <p className="hg-xs hg-subtle wr-auto-foot">{t('writing:v6.autoNote')}</p>
    </div>
  );
}

// ------------------------------------------------------------------ rubric (categorical, grouped, no total)
function RubricRow({ e, dim }: { e: V6Essay; dim: { key: string; label: string | null } }) {
  const { api } = useAuth();
  const { t } = useT();
  const score = e.writing?.rubric?.scores[dim.key];
  const [note, setNote] = useState(score?.note ?? '');
  const m = useEssayMutation(e.id, (v: { rating: RubricRating; note?: string }) => api.writing.rate(e.id, dim.key, v.rating, v.note));
  const rating = score?.rating ?? 'NOT_ASSESSED';
  const label = dim.label ?? t(`writing:v6.dim.${dim.key}`, { defaultValue: t(`writing:dim.${dim.key}`) });
  const help = t(`writing:v6.dimAsk.${dim.key}`, { defaultValue: '' });
  return (
    <li className="wr-rubric" data-rating={rating}>
      <div className="wr-rubric__row">
        <span className="wr-rubric__label">{label}</span>
        <div className="hg-seg wr-seg" role="group" aria-label={label}>
          {(['MEETS', 'NEEDS_WORK', 'NOT_ASSESSED'] as RubricRating[]).map((r) => (
            <button key={r} type="button" aria-pressed={rating === r} onClick={() => m.mutate({ rating: r, note: note.trim() || undefined })}>{t(`writing:rating.${r}`)}</button>
          ))}
        </div>
      </div>
      {help && <p className="hg-xs hg-subtle">{help}</p>}
      {(rating === 'NEEDS_WORK' || note) && (
        <Input aria-label={t('writing:rubric.note', { dimension: label })} placeholder={t('writing:rubric.notePh')} value={note} onChange={(ev) => setNote(ev.target.value)}
          onBlur={() => { if ((score?.note ?? '') !== note) m.mutate({ rating, note: note.trim() || undefined }); }} maxLength={2000} />
      )}
      {score?.by && <span className="hg-xs hg-subtle">{t('writing:rubric.by', { name: score.by, version: score.version })}</span>}
    </li>
  );
}

function RubricPanel({ e }: { e: V6Essay }) {
  const { t } = useT();
  const groups = groupDimensions((e.writing?.rubric?.dimensions ?? []) as { key: string; label: string | null; group?: string }[]);
  return (
    <div className="wr-panel">
      <p className="hg-xs hg-subtle">{t('writing:v6.rubricIntro')}</p>
      {groups.map((g) => (
        <section key={g.group} aria-labelledby={`rg-${g.group}`}>
          <h3 id={`rg-${g.group}`} className="wr-h">{t(`writing:v6.group.${g.group}`)}</h3>
          <ul className="wr-rubric-list">{g.dims.map((d) => <RubricRow key={d.key} e={e} dim={d} />)}</ul>
        </section>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ versions: history, authorship statement, application use, compare
function VersionsPanel({ e, compare, onCompare }: { e: V6Essay; compare: [number, number] | null; onCompare: (pair: [number, number] | null) => void }) {
  const { t, locale } = useT();
  const w = e.writing;
  const vs = e.versions;
  const approved = w?.approved_version;
  const usedBy = w?.used_by ?? [];
  return (
    <div className="wr-panel">
      {usedBy.length > 0 && (
        <div className="wr-usedby">
          {usedBy.map((u) => (
            <p key={u.application_id} className="hg-small">
              <ClipboardCheck size={14} aria-hidden /> {u.approved_version
                ? t('writing:v6.usedBy', { version: u.approved_version, university: u.university ?? '—' })
                : t('writing:v6.notYetUsed', { university: u.university ?? '—' })}
              {u.newer_draft && <span className="hg-subtle"> · {t('writing:v6.newerDraft')}</span>}
            </p>
          ))}
        </div>
      )}
      {vs.length > 1 && (
        <div className="wr-compare">
          <GitCompare size={15} aria-hidden />
          <FilterSelect size="sm" label={t('editor.from')} value={compare?.[0] ?? vs[vs.length - 2].version} onChange={(ev) => onCompare([Number(ev.target.value), compare?.[1] ?? e.current_version])}>
            {vs.map((v) => <option key={v.version} value={v.version}>v{v.version}</option>)}
          </FilterSelect>
          <span aria-hidden>→</span>
          <FilterSelect size="sm" label={t('editor.to')} value={compare?.[1] ?? e.current_version} onChange={(ev) => onCompare([compare?.[0] ?? vs[vs.length - 2].version, Number(ev.target.value)])}>
            {vs.map((v) => <option key={v.version} value={v.version}>v{v.version}</option>)}
          </FilterSelect>
          {compare ? <Button size="sm" variant="ghost" onClick={() => onCompare(null)}>{t('writing:v6.showText')}</Button>
            : <Button size="sm" variant="ghost" onClick={() => onCompare(defaultCompare(vs))}>{t('writing:v6.showChanges')}</Button>}
        </div>
      )}
      <ol className="wr-versions" reversed>
        {[...vs].reverse().map((v) => {
          const att = w?.attestations?.[String(v.version)];
          const a = authorOf(w, v.author?.id);
          return (
            <li key={v.version} className={cx(v.version === e.current_version && 'is-current')}>
              <div className="wr-versions__top">
                <strong>v{v.version}</strong>
                <span className="hg-subtle hg-xs">{formatDate(v.at, locale, { month: 'short', day: 'numeric' })} · {t('editor.words', { count: v.word_count })}</span>
                {approved === v.version && <span className="wr-tag wr-tag--ok">{t('writing:v6.approvedTag')}</span>}
              </div>
              <div className="hg-xs">
                {a.kind === 'STUDENT' ? t('writing:v6.byStudent') : <AuthorTag e={e} userId={v.author?.id} />}
                {v.note && <span className="hg-subtle"> — {v.note === 'Accepted reviewer suggestion' ? t('writing:v6.acceptedNote') : v.note}</span>}
              </div>
              <div className={cx('hg-xs', att ? 'wr-attested' : 'hg-subtle')}>
                {att ? <><ShieldCheck size={12} aria-hidden /> {t('writing:v6.attested', { date: formatDateTime(att.attested_at, locale) })}</> : t('writing:v6.notAttested')}
              </div>
              {v.version !== e.current_version && (
                <button type="button" className="wr-linkbtn" onClick={() => onCompare([v.version, e.current_version])}>{t('writing:v6.compareWithCurrent', { version: v.version })}</button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ------------------------------------------------------------------ manuscript: reading column with annotations, or inline diff
function Manuscript({ e, textRef, compare, onSelect, active, onMark, pending, onCommentPending }: {
  e: V6Essay; textRef: React.RefObject<HTMLDivElement | null>; compare: [number, number] | null; onSelect: () => void; active: string | null;
  onMark: (id: string) => void; pending: (Draft & { rect: DOMRect }) | null; onCommentPending: () => void;
}) {
  const { api } = useAuth();
  const { t } = useT();
  const openComments = useMemo(() => e.comments.filter((c) => !c.resolved), [e]);
  const findings = useMemo(() => (e.writing?.findings ?? []).filter((f) => f.status === 'OPEN' && f.quote && f.anchor_start != null), [e]);
  const segments = useMemo(() => highlightSegments(e.body, [...openComments, ...findings.map((f) => ({ ...f, id: `f:${f.id}` }))]), [e, openComments, findings]);
  const diff = useQuery({ queryKey: ['essay', e.id, 'diff', compare?.[0], compare?.[1]], queryFn: () => api.essays.diff(e.id, compare![0], compare![1]), enabled: !!compare && compare[0] !== compare[1] });
  const wrapRef = useRef<HTMLDivElement>(null);
  const pos = pending && wrapRef.current ? (() => {
    const box = wrapRef.current!.getBoundingClientRect();
    return { top: pending.rect.top - box.top - 40, left: Math.min(Math.max(pending.rect.left - box.left + pending.rect.width / 2 - 70, 0), box.width - 150) };
  })() : null;

  if (compare) {
    return (
      <div className="wr-paper" aria-label={t('writing:v6.changesLabel', { a: compare[0], b: compare[1] })}>
        <p className="wr-diffnote"><GitCompare size={14} aria-hidden /> {t('writing:v6.changesLabel', { a: compare[0], b: compare[1] })} <span className="wr-legend"><ins>{t('writing:v6.added')}</ins> <del>{t('writing:v6.removed')}</del></span></p>
        {compare[0] === compare[1] ? <p className="hg-subtle hg-small">{t('editor.sameVersion')}</p> : diff.isLoading ? <Skeleton h={240} /> : (
          <div className="wr-text wr-text--diff">
            {diff.data?.ops.map((o, i) => o.op === 'equal' ? <span key={i}>{o.text}</span> : o.op === 'insert' ? <ins key={i}>{o.text}</ins> : <del key={i}>{o.text}</del>)}
          </div>
        )}
      </div>
    );
  }
  if (!e.body.trim()) return <div className="wr-paper"><EmptyState compact title={t('editor.emptyText')} /></div>;
  return (
    <div className="wr-paper" ref={wrapRef}>
      <div ref={textRef} className="wr-text" onMouseUp={onSelect} onKeyUp={onSelect} tabIndex={0} aria-label={t('editor.studentText')}>
        {segments.map((s, i) => {
          if (!s.commentIds.length) return <span key={i}>{s.text}</span>;
          const commentIds = s.commentIds.filter((x) => !x.startsWith('f:'));
          const sevs = s.commentIds.filter((x) => x.startsWith('f:')).map((x) => findings.find((f) => `f:${f.id}` === x)?.severity ?? 'INFO');
          const internalOnly = commentIds.length > 0 && commentIds.every((cid) => openComments.find((c) => c.id === cid)?.visibility === 'INTERNAL');
          const sev = annotationSeverity(sevs);
          return (
            <mark key={i} data-c={s.commentIds.join(' ')}
              className={cx(commentIds.length ? (internalOnly ? 'wr-hl wr-hl--internal' : 'wr-hl wr-hl--student') : 'wr-hl-auto', sev && `wr-hl-auto--${sev}`, s.commentIds.includes(active ?? '') && 'is-active')}
              title={!commentIds.length ? t('writing:auto.label') : undefined}
              onClick={() => onMark(commentIds[0] ?? s.commentIds[0])}>
              {s.text}
            </mark>
          );
        })}
      </div>
      {pending && pos && (
        <button type="button" className="wr-float" style={{ top: pos.top, insetInlineStart: pos.left }} onMouseDown={(ev) => ev.preventDefault()} onClick={onCommentPending}>
          <MessageSquarePlus size={14} aria-hidden /> {t('writing:v6.commentHere')} <kbd>C</kbd>
        </button>
      )}
    </div>
  );
}

function LengthBar({ e }: { e: V6Essay }) {
  const { t } = useT();
  const s = lengthStats(e.body, e.writing?.limits);
  const over = s.overWords > 0 || s.overChars > 0;
  return (
    <div className={cx('wr-len', over && 'is-over')} aria-live="polite">
      <span className="hg-num">{s.wordLimit ? t('writing:v6.wordsOf', { count: s.words, limit: s.wordLimit }) : t('editor.words', { count: s.words })}</span>
      <span className="hg-num wr-len__soft">{s.charLimit ? t('writing:v6.charsOf', { count: s.chars, limit: s.charLimit }) : t('writing:v6.chars', { count: s.chars })}</span>
      {s.ratio != null && <span className="wr-len__meter" aria-hidden><span style={{ inlineSize: `${Math.min(100, s.ratio * 100)}%` }} /></span>}
      {over && <span className="wr-len__over">{s.overWords ? t('writing:v6.overWords', { count: s.overWords }) : t('writing:v6.overChars', { count: s.overChars })}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ decisions
function ApproveModal({ e, onClose, onDone }: { e: V6Essay; onClose: () => void; onDone: () => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const gate = e.writing?.gate;
  const blocked = !!gate && !gate.can_approve;
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const m = useEssayMutation(e.id, () => api.writing.approve(e.id, blocked ? reason.trim() : undefined, note.trim() || undefined), t('writing:gate.approvedToast'), onDone);
  // V22: any administrator may approve past a gate, with a written reason (REPORT §246 A2).
  const can = !blocked || reason.trim().length >= 10;
  const go = () => { if (can && !m.isPending) m.mutate(undefined); };
  return (
    <Modal open onClose={onClose} title={blocked ? t('writing:gate.overrideTitle') : t('writing:gate.approveTitle')} width={560}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button>
        {<Button variant={blocked ? 'danger' : 'primary'} disabled={!can} loading={m.isPending} onClick={go}>{blocked ? t('writing:gate.approveAnyway') : t('writing:v6.approveAndNext')}</Button>}</>}>
      <div className="hg-stack" style={{ '--hg-gap': '12px' } as React.CSSProperties} onKeyDown={(ev) => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) go(); }}>
        {gate && <GateList items={gate.items.filter((i) => i.key !== 'REVIEWER_APPROVAL')} />}
        {blocked && (
          <Field label={t('writing:gate.overrideReason')} htmlFor="ov-reason" hint={t('writing:gate.overrideHint')}>
            <Textarea id="ov-reason" rows={3} value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={1000} />
          </Field>
        )}
        {!blocked && <p className="hg-small">{t('writing:gate.approveExplain', { version: e.current_version })}</p>}
        <Field label={t('editor.noteToStudent')} htmlFor="ap-note" optional><Textarea id="ap-note" rows={2} value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={1000} autoFocus={!blocked} /></Field>
        <p className="hg-xs hg-subtle">{t('writing:v6.confirmKey')}</p>
      </div>
    </Modal>
  );
}

function MoveModal({ e, to, onClose, onDone }: { e: V6Essay; to: EssayStatus; onClose: () => void; onDone: () => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const [note, setNote] = useState('');
  const m = useEssayMutation(e.id, () => api.essays.setStatus(e.id, to, note.trim() || undefined), undefined, onDone);
  const open = e.comments.filter((c) => !c.resolved && c.visibility === 'PARTICIPANTS').length;
  const pendingSugg = e.comments.filter((c) => c.suggestion_state === 'PENDING').length;
  const go = () => { if (!m.isPending) m.mutate(undefined); };
  const title = to === 'CHANGES_REQUESTED' ? t('writing:v6.requestChanges') : t(`editor.action.${to}`, { defaultValue: t(`essayStatus.${to}`) });
  return (
    <Modal open onClose={onClose} title={title} width={520}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={go}>{to === 'CHANGES_REQUESTED' ? t('writing:v6.sendAndNext') : t('actions.confirm')}</Button></>}>
      <div className="hg-stack" style={{ '--hg-gap': '12px' } as React.CSSProperties} onKeyDown={(ev) => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) go(); }}>
        {to === 'CHANGES_REQUESTED' && <p className="hg-small">{t('writing:v6.changesSummary', { count: open, suggestions: pendingSugg })}</p>}
        {to === 'FINAL_REVIEW' && <p className="hg-small hg-muted">{t('writing:ws.finalHint')}</p>}
        <Field label={t('editor.noteToStudent')} htmlFor="st-note" optional hint={t('editor.noteHint')}>
          <Textarea id="st-note" rows={3} value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={1000} autoFocus />
        </Field>
        <p className="hg-xs hg-subtle">{t('writing:v6.confirmKey')}</p>
      </div>
    </Modal>
  );
}

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  return (
    <Modal open onClose={onClose} title={t('writing:v6.shortcuts')} width={460} footer={<Button onClick={onClose}>{t('actions.close')}</Button>}>
      <dl className="wr-keys">
        {SHORTCUTS.map((s) => (
          <div key={s.action}><dt>{s.keys.map((k) => <kbd key={k}>{k.toUpperCase()}</kbd>)}</dt><dd>{t(`writing:v6.key.${s.action}`)}</dd></div>
        ))}
        <div><dt><kbd>Ctrl</kbd>+<kbd>Enter</kbd></dt><dd>{t('writing:v6.key.send')}</dd></div>
      </dl>
      <p className="hg-xs hg-subtle">{t('writing:v6.keysNote')}</p>
    </Modal>
  );
}

// ------------------------------------------------------------------ page
export default function EssayEditor() {
  const { id = '' } = useParams();
  const { api } = useAuth();
  const { t } = useT();
  const perms = usePerms();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const v6 = useMemo(() => writingV6(api), [api]);
  const memory = useMemo(() => loadQueueMemory(perms.userId), [perms.userId, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const view = memory?.view ?? null;
  const q = useQuery({ queryKey: ['essay', id], queryFn: () => api.essays.get(id) as unknown as Promise<V6Essay> });
  const next = useQuery({ queryKey: ['writing', 'next', id, view], queryFn: () => v6.next(id, view, queuePosition(memory, id)), staleTime: 30_000 });
  const textRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<(Draft & { rect: DOMRect }) | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [composing, setComposing] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [tab, setTab] = useState<RailTab>('comments');
  const [sheet, setSheet] = useState(false);
  const [compare, setCompare] = useState<[number, number] | null>(null);
  const [modal, setModal] = useState<'prompt' | 'reassign' | 'approve' | 'help' | null>(null);
  const [move, setMove] = useState<EssayStatus | null>(null);
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1099px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1099px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  // Remember where the reviewer is in their queue (survives reload).
  useEffect(() => { if (perms.userId) saveQueueMemory(perms.userId, { at: id }); }, [perms.userId, id]);
  // New essay → fresh workspace state.
  useEffect(() => { setCompare(null); setActive(null); setComposing(false); setDraft(null); setPending(null); setMove(null); setModal(null); }, [id]);

  const essay = q.data;
  const openTab = useCallback((v: RailTab) => { setTab(v); if (narrow) setSheet(true); }, [narrow]);
  const focusMark = useCallback((cid: string) => {
    setActive(cid);
    setCompare(null);
    requestAnimationFrame(() => document.querySelector(`[data-c~="${CSS.escape(cid)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }, []);
  const startComment = useCallback((d: Draft | null) => {
    setDraft(d); setComposing(true); openTab('comments'); setPending(null); window.getSelection()?.removeAllRanges();
  }, [openTab]);
  const goNext = useCallback(async (afterDecision: boolean) => {
    let target = next.data?.id ?? null;
    if (afterDecision) {
      // The decided essay has left the view: ask again from its former position.
      qc.invalidateQueries({ queryKey: ['writing', 'queue'] });
      try { target = (await v6.next(id, view, queuePosition(memory, id))).id; } catch { /* keep the earlier answer */ }
    }
    if (target) nav(`/essays/${target}`);
    else { toast.success(t('writing:v6.queueClear')); nav(view ? `/essays?view=${view}` : '/essays'); }
  }, [next.data, qc, v6, id, view, memory, nav, toast, t]);

  const openIds = useMemo(() => (essay ? commentOrder(essay.body, essay.comments.filter((c) => !c.resolved), commentRange) : []), [essay]);
  const runShortcut = useCallback((a: ShortcutAction) => {
    if (!essay) return;
    switch (a) {
      case 'comment': startComment(pending ? { quote: pending.quote, start: pending.start, end: pending.end } : null); break;
      case 'approve': if (essay.allowed_transitions.includes('APPROVED')) setModal('approve'); break;
      case 'changes': if (essay.allowed_transitions.includes('CHANGES_REQUESTED')) setMove('CHANGES_REQUESTED'); break;
      case 'nextComment': case 'prevComment': {
        const nid = step(openIds, active, a === 'nextComment' ? 1 : -1);
        if (nid) { focusMark(nid); setTab('comments'); requestAnimationFrame(() => document.getElementById(`cm-${nid}`)?.scrollIntoView({ block: 'nearest' })); }
        break;
      }
      case 'nextEssay': goNext(false); break;
      case 'prevEssay': { const p = previousInQueue(memory, id); if (p) nav(`/essays/${p}`); break; }
      case 'compare': setCompare(compare ? null : defaultCompare(essay.versions)); break;
      case 'tabComments': openTab('comments'); break;
      case 'tabChecks': openTab('checks'); break;
      case 'tabRubric': openTab('rubric'); break;
      case 'tabVersions': openTab('versions'); break;
      case 'help': setModal('help'); break;
    }
  }, [essay, pending, startComment, openIds, active, focusMark, goNext, memory, id, nav, compare, openTab]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (modal || move) return;
      const a = shortcutFor(ev);
      if (!a) return;
      ev.preventDefault();
      runShortcut(a);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runShortcut, modal, move]);

  const onSelect = () => setPending(selectionIn(textRef.current));
  const onMark = (cid: string) => { setActive(cid); openTab(cid.startsWith('f:') ? 'checks' : 'comments');
    requestAnimationFrame(() => document.querySelector(cid.startsWith('f:') ? `[data-finding="${cid.slice(2)}"]` : `#cm-${CSS.escape(cid)}`)?.scrollIntoView({ block: 'nearest' })); };

  return (
    <QueryState query={q} skeleton={<Skeleton h={400} r={16} />}>
      {(e) => {
        const w = e.writing;
        const blockers = w?.gate?.blockers.length ?? 0;
        const openFindings = (w?.findings ?? []).filter((f) => f.status === 'OPEN' && f.severity !== 'INFO').length;
        const tabs: { value: RailTab; label: string; icon: React.ReactNode; count?: number }[] = [
          { value: 'comments', label: t('editor.tabComments'), icon: <MessagesSquare size={15} aria-hidden />, count: e.comments.filter((c) => !c.resolved).length },
          { value: 'checks', label: t('writing:ws.tabChecks'), icon: <ListChecks size={15} aria-hidden />, count: openFindings },
          { value: 'rubric', label: t('writing:ws.tabRubric'), icon: <ClipboardCheck size={15} aria-hidden /> },
          { value: 'versions', label: t('editor.tabVersions'), icon: <FileClock size={15} aria-hidden />, count: e.versions.length },
        ];
        const panel = (
          <>
            {tab === 'comments' && <CommentsPanel e={e} composing={composing} draft={draft} active={active} onFocus={focusMark} onCompose={() => startComment(null)}
              onDone={() => { setComposing(false); setDraft(null); }} />}
            {tab === 'checks' && <ChecksPanel e={e} active={active} onShow={(f) => focusMark(`f:${f.id}`)} />}
            {tab === 'rubric' && <RubricPanel e={e} />}
            {tab === 'versions' && <VersionsPanel e={e} compare={compare} onCompare={setCompare} />}
          </>
        );
        return (
          <div className="wr-ws ag7-wr">
            {w && <ContextHeader e={e} blockers={blockers} nextId={next.data?.id} onReassign={() => setModal('reassign')} onApprove={() => setModal('approve')}
              onChanges={() => setMove('CHANGES_REQUESTED')} onMove={setMove} onNext={() => goNext(false)} onHelp={() => setModal('help')} />}
            <div className="wr-ws__body">
              <main className="wr-ms" aria-label={t('editor.studentText')}>
                {w && <Question e={e} onAttach={() => setModal('prompt')} />}
                <div className="wr-ms__bar card custom-card">
                  <LengthBar e={e} />
                  <div className="wr-ms__tools">
                    {e.versions.length > 1 && (
                      <Button size="sm" variant={compare ? 'primary' : 'ghost'} icon={<GitCompare />} onClick={() => setCompare(compare ? null : defaultCompare(e.versions))} title="D">
                        {compare ? t('writing:v6.showText') : t('writing:v6.changesSince', { version: e.versions[e.versions.length - 2].version })}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" icon={<MessageSquarePlus />} onClick={() => startComment(pending ? { quote: pending.quote, start: pending.start, end: pending.end } : null)}>
                      {pending ? t('editor.commentSelection') : t('editor.addComment')}
                    </Button>
                  </div>
                </div>
                <Manuscript e={e} textRef={textRef} compare={compare} onSelect={onSelect} active={active} onMark={onMark} pending={pending}
                  onCommentPending={() => pending && startComment({ quote: pending.quote, start: pending.start, end: pending.end })} />
                <p className="wr-ms__foot"><Lock size={12} aria-hidden /> {t('writing:v6.readOnly')}</p>
              </main>
              {!narrow && (
                <aside className="wr-rail card custom-card" aria-label={t('editor.review')}>
                  <div className="wr-rail__tabs" role="tablist" aria-label={t('editor.review')}>
                    {tabs.map((x) => (
                      <button key={x.value} type="button" role="tab" aria-selected={tab === x.value} onClick={() => setTab(x.value)}>
                        {x.label}{x.count ? <span className="wr-count">{x.count}</span> : null}
                      </button>
                    ))}
                  </div>
                  <div className="wr-rail__body" role="tabpanel">{panel}</div>
                </aside>
              )}
            </div>
            {narrow && (
              <nav className="wr-dock" aria-label={t('editor.review')}>
                {tabs.map((x) => (
                  <button key={x.value} type="button" aria-pressed={sheet && tab === x.value} onClick={() => { setTab(x.value); setSheet(true); }}>
                    {x.icon}<span>{x.label}</span>{x.count ? <span className="wr-count">{x.count}</span> : null}
                  </button>
                ))}
              </nav>
            )}
            {narrow && sheet && (
              <Drawer open onClose={() => setSheet(false)} title={tabs.find((x) => x.value === tab)?.label ?? ''} sheet width={480}>
                <div className="wr-sheet-tabs" role="tablist">
                  {tabs.map((x) => <button key={x.value} type="button" role="tab" aria-selected={tab === x.value} onClick={() => setTab(x.value)}>{x.label}</button>)}
                </div>
                {panel}
              </Drawer>
            )}
            {modal === 'prompt' && <PromptModal e={e} onClose={() => setModal(null)} />}
            {modal === 'reassign' && <ReassignModal e={e} onClose={() => setModal(null)} />}
            {modal === 'approve' && <ApproveModal e={e} onClose={() => setModal(null)} onDone={() => { setModal(null); goNext(true); }} />}
            {modal === 'help' && <ShortcutSheet onClose={() => setModal(null)} />}
            {move && <MoveModal e={e} to={move} onClose={() => setMove(null)} onDone={() => { const m = move; setMove(null); if (m === 'CHANGES_REQUESTED') goNext(true); }} />}
          </div>
        );
      }}
    </QueryState>
  );
}
