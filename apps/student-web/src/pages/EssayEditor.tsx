/**
 * V6 student writing page: a calm sheet to write on, the university's question above it, reviewer comments in the
 * margin (in text order) with suggestions the student accepts or keeps one by one, which version is approved and which
 * application uses it, and an authorship statement on submit ("These are my own words and facts").
 * Tangerine is only the primary action (Submit). Nothing here writes content for the student.
 */
import { useApi } from '@hangyul/auth';
import { AlertCircle, CheckCircle2, Check, ChevronDown, CircleDashed, GitCompare, History, Lock, RefreshCw, Save, Send, ShieldCheck, TriangleAlert, Undo2 } from '@hangyul/icons';
import type { WritingFinding } from '@hangyul/types';
import { Avatar, Badge, Button, Callout, Card, EmptyState, Modal, QueryState, FilterSelect, Skeleton, SkeletonCard, Textarea, useToast } from '@hangyul/ui';
import { cx, essayTone, formatDate, formatDateTime, formatRelative } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUpgradeOnRefusal } from '../lib/upgrade';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';

import { DaysLeft } from '../components/bits';
import { findQuote, highlightSegments } from '../lib/essay';
import { wordCount } from '../lib/format';
import { essayTitle, useT } from '../lib/i18n';
import {
  authorRole, canDecide, findingText, marginOrder, pendingSuggestions, statusSentence, studentFindings, suggestionApplies, usedByLine, writingV6,
  type V6Comment, type V6Essay,
} from '../lib/writing';
import './writing.css';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/** The university's question: linked prompt, the student's pasted copy, or an honest "not yet". */
function UniversityQuestion({ essay }: { essay: V6Essay }) {
  const { t } = useT();
  const [open, setOpen] = useState(true);
  const w = essay.writing;
  const text = w?.prompt?.text ?? essay.prompt;
  const limit = w?.limits.word_limit ?? essay.word_limit;
  if (!text) return <Callout tone="info" title={t('writing:student.question')}>{t('writing:prompt.unknownStudent')}</Callout>;
  return (
    <section className={cx('sw-q', !open && 'is-collapsed')}>
      <button type="button" className="sw-q__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronDown size={14} aria-hidden className="sw-q__chev" /> {t('writing:student.question')}
        {limit ? <span className="sw-q__limit">{t('writing:prompt.words', { count: limit })}</span> : null}
      </button>
      {open && <>
        <p className="sw-q__text" data-user-content>{text}</p>
        <p className="sw-q__note">{w?.prompt?.verification_status === 'VERIFIED' ? t('writing:prompt.checkedStudent') : t('writing:student6.checkGuide')}</p>
      </>}
    </section>
  );
}

function FindingItem({ f, onShow }: { f: WritingFinding; onShow: () => void }) {
  const { t, locale } = useT();
  return (
    <li data-sev={f.severity}>
      {f.severity === 'BLOCKER' ? <AlertCircle aria-hidden /> : f.severity === 'WARNING' ? <TriangleAlert aria-hidden /> : <CircleDashed aria-hidden />}
      <div className="hg-grow" style={{ minWidth: 0 }}>
        {f.kind === 'FACT' && <div className="hg-xs hg-medium">{t('writing:student.checkSentence')}</div>}
        {f.quote && <button type="button" className="st-comment__quote" onClick={onShow} data-user-content>“{f.quote}”</button>}
        <p className="hg-small">{findingText(t, f, locale)}</p>
      </div>
    </li>
  );
}

function DiffView({ essay }: { essay: V6Essay }) {
  const { t } = useT();
  const api = useApi();
  const versions = essay.versions.map((v) => v.version);
  const [a, setA] = useState(versions.length > 1 ? versions[versions.length - 2] : versions[0]);
  const [b, setB] = useState(versions[versions.length - 1]);
  const q = useQuery({ queryKey: ['essay', essay.id, 'diff', a, b], queryFn: () => api.essays.diff(essay.id, a, b), enabled: !!a && !!b && a !== b });
  if (versions.length < 2) return <p className="hg-muted hg-small">{t('essay.diff.one')}</p>;
  return (
    <div className="hg-stack" style={{ '--hg-gap': '10px' } as React.CSSProperties}>
      <div className="hg-row" style={{ '--hg-gap': '8px' } as React.CSSProperties}>
        <GitCompare size={16} aria-hidden />
        <FilterSelect size="sm" label={t('essay.diff.from')} value={a} onChange={(e) => setA(Number(e.target.value))}>{versions.map((v) => <option key={v} value={v}>v{v}</option>)}</FilterSelect>
        <span aria-hidden>→</span>
        <FilterSelect size="sm" label={t('essay.diff.to')} value={b} onChange={(e) => setB(Number(e.target.value))}>{versions.map((v) => <option key={v} value={v}>v{v}</option>)}</FilterSelect>
      </div>
      {a === b ? <p className="hg-muted hg-small">{t('essay.diff.same')}</p> : q.isLoading ? <Skeleton h={80} /> : q.data ? (
        <div className="st-diff sw-diff" data-user-content aria-label={t('essay.diff.label', { a, b })}>
          {q.data.ops.map((o, i) => o.op === 'insert' ? <ins key={i}>{o.text}</ins> : o.op === 'delete' ? <del key={i}>{o.text}</del> : <span key={i}>{o.text}</span>)}
        </div>
      ) : null}
      <p className="hg-subtle hg-xs">{t('essay.diff.legend')}</p>
    </div>
  );
}

/** One reviewer comment in the margin. A suggestion is decided one by one: accept (your text changes, as a new version
 *  you made) or keep your wording. */
function MarginComment({ c, essay, body, active, onShow, editable, busy, onDecide, onResolve }: {
  c: V6Comment; essay: V6Essay; body: string; active: boolean; onShow: () => void; editable: boolean; busy: boolean;
  onDecide: (d: 'ACCEPT' | 'REJECT') => void; onResolve: () => void;
}) {
  const { t, locale } = useT();
  const who = c.author ? essay.writing?.authors?.[c.author.id] : undefined;
  const role = authorRole(who?.kind);
  const state = c.suggestion != null ? (c.suggestion_state ?? 'PENDING') : null;
  const applies = suggestionApplies(body, c);
  return (
    <li className={cx('sw-cmt', active && 'is-active', c.resolved && 'is-resolved')} id={`cmt-${c.id}`}>
      <div className="sw-cmt__who">
        <Avatar name={c.author?.full_name ?? '?'} size={26} />
        <div className="hg-grow" style={{ minWidth: 0 }}>
          <div className="hg-small hg-strong hg-truncate">{c.author?.full_name ?? t('essay.comments.reviewer')}</div>
          <div className="hg-subtle hg-xs">{t(`writing:student.role.${role}`, { org: who?.org ?? '' })} · {formatRelative(c.at, locale)}</div>
        </div>
      </div>
      {c.quote && <button type="button" className="sw-cmt__quote" onClick={onShow} title={t('essay.comments.show')} data-user-content>“{c.quote}”</button>}
      <p className="sw-cmt__body" data-user-content>{c.body}</p>
      {c.suggestion != null && (
        <div className="sw-sugg" data-user-content>
          <span className="sw-sugg__label">{t('writing:student6.suggested')}</span>
          <div className="sw-sugg__diff">{c.quote && <del>{c.quote}</del>} <ins>{c.suggestion}</ins></div>
          {state === 'PENDING' && !c.resolved && (editable ? (
            applies ? (
              <div className="sw-sugg__actions">
                <Button size="sm" variant="soft" icon={<Check />} loading={busy} onClick={() => onDecide('ACCEPT')}>{t('writing:student6.accept')}</Button>
                <Button size="sm" variant="ghost" icon={<Undo2 />} disabled={busy} onClick={() => onDecide('REJECT')}>{t('writing:student6.keepMine')}</Button>
              </div>
            ) : <p className="hg-xs hg-subtle">{t('writing:student6.quoteChanged')} <button type="button" className="sw-link" onClick={() => onDecide('REJECT')}>{t('writing:student6.keepMine')}</button></p>
          ) : <p className="hg-xs hg-subtle">{t('writing:student6.decideLater')}</p>)}
          {state === 'ACCEPTED' && <p className="sw-sugg__state is-ok"><Check size={12} aria-hidden /> {t('writing:student6.accepted', { version: c.decision_version ?? '' })}</p>}
          {state === 'REJECTED' && <p className="sw-sugg__state"><Undo2 size={12} aria-hidden /> {t('writing:student6.kept')}</p>}
        </div>
      )}
      {c.suggestion == null && !c.resolved && editable && (
        <Button size="sm" variant="ghost" icon={<Check />} disabled={busy} onClick={onResolve}>{t('writing:student6.done')}</Button>
      )}
      {c.resolved && c.suggestion == null && <span className="hg-xs hg-subtle"><Check size={12} aria-hidden /> {t('essay.comments.resolved')}</span>}
    </li>
  );
}

function SubmitModal({ onClose, onSubmit, busy, pending }: { onClose: () => void; onSubmit: () => void; busy: boolean; pending: number }) {
  const { t } = useT();
  const [ok, setOk] = useState(false);
  return (
    <Modal open onClose={onClose} title={t('writing:student6.submitTitle')} width={520}
      footer={<><Button onClick={onClose}>{t('common:actions.cancel')}</Button>
        <Button variant="primary" icon={<Send />} disabled={!ok} loading={busy} onClick={onSubmit}>{t('writing:student6.send')}</Button></>}>
      <div className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties}>
        <p className="hg-small hg-muted">{t('writing:student6.submitText')}</p>
        {pending > 0 && <Callout tone="info">{t('writing:student6.pendingNote', { count: pending })}</Callout>}
        <label className="sw-attest">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>
            <strong>{t('writing:student6.attestTitle')}</strong>
            <span className="hg-small hg-muted" style={{ display: 'block' }}>{t('writing:student6.attestText')}</span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

function Editor({ essay }: { essay: V6Essay }) {
  const { t, locale } = useT();
  const api = useApi();
  const v6 = useMemo(() => writingV6(api), [api]);
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState(essay.body);
  const [save, setSave] = useState<SaveState>('idle');
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const editable = canDecide(essay.status);
  const readOnly = !editable;
  const words = wordCount(body);
  const limit = essay.writing?.limits.word_limit ?? essay.word_limit;
  const setEssay = useCallback((e: V6Essay) => {
    qc.setQueryData(['essay', essay.id], e);
    qc.invalidateQueries({ queryKey: ['essays'] });
  }, [qc, essay.id]);

  const persist = useCallback(async (newVersion: boolean) => {
    setSave('saving');
    try {
      const e = (await api.essays.save(essay.id, bodyRef.current, { new_version: newVersion })) as unknown as V6Essay;
      setEssay(e);
      setSave('saved');
      return e;
    } catch (err) {
      setSave('error');
      throw err;
    }
  }, [api, essay.id, setEssay]);

  useEffect(() => {
    if (save !== 'dirty' || readOnly) return;
    const h = setTimeout(() => { persist(false).catch(() => undefined); }, 1200);
    return () => clearTimeout(h);
  }, [body, save, readOnly, persist]);

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => { if (save === 'dirty' || save === 'saving') e.preventDefault(); };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [save]);

  const upgrade = useUpgradeOnRefusal();
  const version = useMutation({
    mutationFn: () => persist(true),
    onSuccess: (e) => toast.success(t('essay.versionSaved', { version: e.current_version })),
    onError: (e) => toast.error((e as Error).message),
  });
  const reopen = useMutation({
    mutationFn: () => api.essays.setStatus(essay.id, 'STUDENT_REVISION'),
    onSuccess: (e) => { setEssay(e as unknown as V6Essay); setBody(e.body); toast.success(t('essay.statusDone.STUDENT_REVISION')); },
    onError: (e) => toast.error((e as Error).message),
  });
  const submit = useMutation({
    mutationFn: async () => { if (save === 'dirty') await persist(false); return v6.submit(essay.id, locale); },
    onSuccess: (e) => { setEssay(e); setBody(e.body); setSubmitting(false); toast.success(t('essay.statusDone.SUBMITTED')); },
    // V17: 첨삭 rounds are a counted part of the plan (Basic 0 · All-in-One 1 · Premium 2) and the server
    // refuses the one past the limit. A Basic student asking for their first review has not hit an error,
    // so the upgrade sheet answers instead of the toast. `setSubmitting(false)` either way — the editor
    // must come back out of its submitting state whichever surface explains the refusal.
    onError: (e) => { setSubmitting(false); if (!upgrade.catchRefusal(e)) toast.error((e as Error).message); },
  });
  const decide = useMutation({
    mutationFn: async ({ cid, d }: { cid: string; d: 'ACCEPT' | 'REJECT' }) => { if (save === 'dirty') await persist(false); return v6.decide(essay.id, cid, d); },
    onSuccess: (e, v) => { setEssay(e); setBody(e.body); setSave('saved'); toast.success(v.d === 'ACCEPT' ? t('writing:student6.acceptedToast') : t('writing:student6.keptToast')); },
    onError: (e) => toast.error((e as Error).message),
  });
  const resolve = useMutation({
    mutationFn: (cid: string) => api.essays.resolve(essay.id, cid, false),
    onSuccess: (e) => { setEssay(e as unknown as V6Essay); toast.success(t('essay.comments.resolvedToast')); },
    onError: (e) => toast.error((e as Error).message),
  });
  const checks = useMutation({
    // Check exactly what is on screen: save first whenever the text differs from the stored version or a save is pending
    // (an autosave already in flight left the state at "saving", and the check used to run on the previous version).
    mutationFn: async () => {
      if (!readOnly && (save === 'dirty' || save === 'saving' || bodyRef.current !== essay.body)) await persist(false);
      return api.writing.runChecks(essay.id) as unknown as Promise<V6Essay>;
    },
    onSuccess: (e) => { setEssay(e); toast.success(t('writing:student.checked')); },
    onError: (e) => toast.error((e as Error).message),
  });

  const visible = essay.comments.filter((c) => c.visibility !== 'INTERNAL');
  // Suggestions decided during this revision stay in view (with their state) until the essay is sent again.
  const since = essay.writing?.review.submitted_at ?? '';
  const decidedNow = (c: V6Comment) => editable && !!c.decided_at && c.decided_at > since;
  const open = marginOrder(body, visible.filter((c) => !c.resolved || decidedNow(c)));
  const resolved = marginOrder(body, visible.filter((c) => c.resolved && !decidedNow(c)));
  const waiting = visible.filter((c) => !c.resolved).length;
  const pending = pendingSuggestions(visible);
  const segments = highlightSegments(body, open.map((c) => ({ id: c.id, quote: c.quote, start: c.anchor_start })));
  const w = essay.writing;
  const sl = statusSentence(t, w?.status_line, (iso) => formatDateTime(iso, locale));
  const { facts, other } = studentFindings(w?.findings);
  const canSubmit = essay.allowed_transitions.includes('SUBMITTED');
  const canRevise = essay.allowed_transitions.includes('STUDENT_REVISION');
  const usedBy = w?.used_by ?? [];
  const approved = w?.approved_version ?? null;

  const select = (quote: string | null, start?: number | null) => {
    const r = findQuote(body, quote, start);
    if (r && ta.current) { ta.current.focus(); ta.current.setSelectionRange(r[0], r[1]); }
  };
  const showInText = (c: V6Comment) => {
    setActiveComment(c.id);
    if (readOnly) document.getElementById(`quote-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else select(c.quote, c.anchor_start);
  };

  return (
    <div className="st-page sw-page">
      <nav className="hg-crumbs" aria-label={t('essay.crumbs')}><Link to="/essays">{t('common:nav.essays')}</Link><span aria-hidden>/</span><span className="hg-truncate">{essayTitle(t, essay, locale)}</span></nav>
      <header className="st-intro">
        <div className="hg-grow">
          <div className="hg-row-wrap" style={{ marginBottom: 8, '--hg-gap': '6px' } as React.CSSProperties}>
            <Badge tone={essayTone[essay.status]}>{t(`writing.status.${essay.status}`)}</Badge>
            <Badge tone="neutral" outline>{t(`common:essayType.${essay.essay_type}`)}</Badge>
            {essay.due_date && <DaysLeft date={essay.due_date} size="sm" />}
          </div>
          <h1 className="st-intro__title">{essayTitle(t, essay, locale)}</h1>
          {w?.context.university && <p className="st-intro__sub">{w.context.university.name}{w.context.program ? ` · ${w.context.program.name}` : ''}{essay.due_date ? ` · ${t('common:time.due', { date: formatDate(essay.due_date, locale) })}` : ''}</p>}
        </div>
      </header>

      {usedBy.length > 0 && approved != null && (
        <div className="sw-used" role="status">
          <ShieldCheck size={18} aria-hidden />
          <div>{usedBy.map((u) => <p key={u.application_id}>{usedByLine(t, u)}</p>)}</div>
        </div>
      )}
      {readOnly && (
        <Callout tone={essay.status === 'APPROVED' ? 'success' : sl?.tone === 'warning' ? 'warning' : 'info'} icon={essay.status === 'APPROVED' ? <CheckCircle2 aria-hidden /> : <Lock aria-hidden />}
          title={t(essay.status === 'APPROVED' ? 'essay.locked.approvedTitle' : 'essay.locked.title')}
          action={canRevise ? <Button size="sm" variant="soft" loading={reopen.isPending} onClick={() => reopen.mutate()}>{t('essay.reopen')}</Button> : undefined}>
          {sl && <span className="st-wr-status">{sl.text}</span>}{' '}
          {t(essay.status === 'APPROVED' ? 'essay.locked.approvedText' : 'essay.locked.text')}
        </Callout>
      )}
      {(essay.status === 'CHANGES_REQUESTED' || (essay.status === 'STUDENT_REVISION' && waiting > 0)) && (
        <Callout tone="warning" title={t('essay.changes.title')}>
          {sl && essay.status === 'CHANGES_REQUESTED' && <span className="st-wr-status">{sl.text} </span>}
          {pending.length ? t('writing:student6.changesText', { count: waiting, suggestions: pending.length }) : t('essay.changes.text', { count: waiting })}
        </Callout>
      )}

      <div className="sw-layout">
        <div className="sw-main">
          <UniversityQuestion essay={essay} />
          {facts.length > 0 && (
            <Card pad className="st-wr-facts">
              <div className="hg-eyebrow" style={{ marginBottom: 4 }}>{t('writing:student.factsTitle')}</div>
              <p className="hg-small hg-muted" style={{ marginBottom: 10 }}>{t('writing:student.factsSub')}</p>
              <ul className="st-wr-findings">{facts.map((f) => <FindingItem key={f.id} f={f} onShow={() => select(f.quote, f.anchor_start)} />)}</ul>
            </Card>
          )}
          <section className="sw-sheet" aria-label={t('essay.text')}>
            {readOnly ? (
              <div className="sw-text sw-text--read" aria-label={t('essay.text')} data-user-content>
                {body ? segments.map((s, i) => s.commentId
                  ? <mark key={i} id={`quote-${s.commentId}`} className={cx(activeComment === s.commentId && 'is-active')} onClick={() => {
                    setActiveComment(s.commentId ?? null); document.getElementById(`cmt-${s.commentId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                  }}>{s.text}</mark>
                  : <span key={i}>{s.text}</span>) : <span className="hg-subtle">{t('essay.emptyBody')}</span>}
              </div>
            ) : (
              <Textarea ref={ta} className="sw-text sw-text--edit" aria-label={t('essay.text')} value={body} placeholder={t('essay.placeholder')}
                onChange={(e) => { setBody(e.target.value); setSave('dirty'); }}
                onBlur={() => { if (save === 'dirty') persist(false).catch(() => undefined); }} />
            )}
            <div className="sw-bar">
              <div className="sw-count">
                <span className={cx('hg-small hg-num', !!limit && words > limit && 'st-over')}>{limit ? t('essays.words', { count: words, limit }) : t('essay.wordsOnly', { count: words })}</span>
                {limit ? <span className="sw-meter" aria-hidden><span style={{ inlineSize: `${Math.min(100, (words / limit) * 100)}%` }} className={cx(words > limit && 'is-over')} /></span> : null}
              </div>
              <span className="hg-xs hg-subtle sw-state" aria-live="polite">
                {save === 'saving' ? t('common:states.saving') : save === 'saved' ? t('essay.saved') : save === 'dirty' ? t('essay.unsaved') : save === 'error' ? t('essay.saveError') : t('essay.version', { version: essay.current_version })}
              </span>
              {!readOnly && (
                <div className="sw-actions">
                  <Button size="sm" variant="ghost" icon={<Save />} loading={version.isPending} onClick={() => version.mutate()}>{t('essay.saveVersion')}</Button>
                  {canSubmit && <Button size="sm" variant="primary" icon={<Send />} disabled={!body.trim()} onClick={() => setSubmitting(true)}>{t('essay.submit')}</Button>}
                </div>
              )}
            </div>
            {limit && words > limit ? <div className="st-editor__warn"><TriangleAlert size={14} aria-hidden /> {t('essay.overLimit', { over: words - limit })}</div> : null}
          </section>
          <p className="hg-subtle hg-xs">{t('essay.ownWords')}</p>
        </div>

        <aside className="sw-margin" aria-label={t('essay.comments.title')}>
          <div className="sw-margin__head">
            <h2>{t('essay.comments.title')}</h2>
            <span className="hg-xs hg-subtle">{waiting ? t('writing:student6.openCount', { count: waiting }) : t('essay.comments.none')}</span>
          </div>
          {open.length === 0 && resolved.length === 0 ? <EmptyState compact title={t('writing:student6.noComments')} /> : (
            <ul className="sw-cmts">
              {open.map((c) => (
                <MarginComment key={c.id} c={c} essay={essay} body={body} active={activeComment === c.id} onShow={() => showInText(c)} editable={editable}
                  busy={(decide.isPending && decide.variables?.cid === c.id) || (resolve.isPending && resolve.variables === c.id)}
                  onDecide={(d) => decide.mutate({ cid: c.id, d })} onResolve={() => resolve.mutate(c.id)} />
              ))}
            </ul>
          )}
          {resolved.length > 0 && (
            <div>
              <button type="button" className="sw-link" aria-expanded={showResolved} onClick={() => setShowResolved(!showResolved)}>
                {showResolved ? t('essay.comments.hideResolved') : t('essay.comments.showResolved', { count: resolved.length })}
              </button>
              {showResolved && <ul className="sw-cmts" style={{ marginTop: 10 }}>{resolved.map((c) => (
                <MarginComment key={c.id} c={c} essay={essay} body={body} active={false} onShow={() => showInText(c)} editable={false} busy={false} onDecide={() => undefined} onResolve={() => undefined} />
              ))}</ul>}
            </div>
          )}

          {w?.gate && (
            <section className="sw-box">
              <h3>{t('writing:student.gateTitle')}</h3>
              <p className="hg-xs hg-subtle">{t('writing:student.gateSub')}</p>
              <ul className="st-wr-gate">
                {w.gate.items.map((i) => (
                  <li key={i.key} data-state={i.state}>
                    {i.state === 'PASSED' ? <CheckCircle2 aria-hidden /> : i.state === 'BLOCKER' ? <AlertCircle aria-hidden /> : <CircleDashed aria-hidden />}
                    <span className="hg-grow">{t(`writing:gate.studentItem.${i.key}`)}</span>
                    <span className="hg-xs hg-subtle">{t(`writing:gate.studentState.${i.state}`)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="sw-box">
            <div className="sw-box__head">
              <h3>{t('writing:auto.label')}</h3>
              {!readOnly && <Button size="sm" variant="ghost" icon={<RefreshCw />} loading={checks.isPending} onClick={() => checks.mutate()}>{t('writing:student.checkDraft')}</Button>}
            </div>
            <p className="hg-xs hg-subtle">{t('writing:auto.studentNote')}</p>
            {other.length === 0 ? <p className="hg-muted hg-small">{w?.checks?.at ? t('writing:student.noFindings') : t('essay.precheck.none')}</p> : (
              <ul className="st-wr-findings">{other.map((f) => <FindingItem key={f.id} f={f} onShow={() => select(f.quote, f.anchor_start)} />)}</ul>
            )}
          </section>
          <section className="sw-box">
            <div className="sw-box__head"><h3>{t('essay.history.title')}</h3><History size={16} className="hg-subtle" aria-hidden /></div>
            <ul className="st-versions">
              {[...essay.versions].reverse().map((v) => (
                <li key={v.version}>
                  <Badge size="sm" tone={v.version === approved ? 'success' : 'neutral'}>v{v.version}</Badge>
                  <div className="hg-grow">
                    <div className="hg-small">
                      {v.version === approved ? t('writing:student6.approvedVersion') : v.note === 'Accepted reviewer suggestion' ? t('writing:student6.acceptedVersion') : v.note ?? t('essay.history.noNote')}
                    </div>
                    <div className="hg-subtle hg-xs">{formatDateTime(v.at, locale)} · {t('essay.wordsOnly', { count: v.word_count })}
                      {w?.attestations?.[String(v.version)] && <> · {t('writing:student6.confirmed')}</>}</div>
                  </div>
                </li>
              ))}
            </ul>
            <hr className="hg-divider" style={{ margin: '14px 0' }} />
            <DiffView essay={essay} />
          </section>
        </aside>
      </div>
      {submitting && <SubmitModal onClose={() => setSubmitting(false)} onSubmit={() => submit.mutate()} busy={submit.isPending} pending={pending.length} />}
      {upgrade.sheet}
    </div>
  );
}

export default function EssayEditor() {
  const api = useApi();
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['essay', id], queryFn: () => api.essays.get(id) as unknown as Promise<V6Essay>, refetchOnWindowFocus: false });
  return (
    <QueryState query={q} skeleton={<div className="st-page"><SkeletonCard lines={2} /><SkeletonCard lines={10} /></div>}>
      {(e) => <Editor key={e.id} essay={e} />}
    </QueryState>
  );
}
