import { localName } from '@hangyul/i18n';
import { useAuth } from '@hangyul/auth';
import { AtSign, Check, CheckCheck, Eye, Link2, ListChecks, Lock, Paperclip, Send, StickyNote, X } from '@hangyul/icons';
import type { ChatMessage, MessageAttachment } from '@hangyul/types';
import { Avatar, Button, Checkbox, EmptyState, Field, Input, Modal, Popover, QueryState, Textarea, useToast } from '@hangyul/ui';
import { cx, formatDateTime } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useChannels } from '../lib/v8';
import { useTeam } from '../lib/hooks';
import { fillTemplate, useServerTemplates } from '../lib/templates';
import { resolveMentions } from '../lib/logic';
import { StudentPicker, useT } from './bits';

/** Highlights "@Full Name" tokens for known teammates. */
function renderBody(body: string, names: string[]) {
  if (!names.length) return body;
  const esc = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length);
  const parts = body.split(new RegExp(`(@(?:${esc.join('|')}))`, 'g'));
  return parts.map((p, i) => (p.startsWith('@') && names.includes(p.slice(1)) ? <mark key={i} className="ag-mention">{p}</mark> : p));
}

function fileSize(n: number) {
  return n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;
}

/** Opens a short-lived signed link for a message attachment. */
export function AttachmentChip({ a, onRemove }: { a: MessageAttachment; onRemove?: () => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const toast = useToast();
  const open = async () => {
    try { const r = await api.messages.attachmentUrl(a.id, 'inline'); window.open(r.url, '_blank', 'noopener'); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <span className="ag-file">
      <Paperclip aria-hidden size={13} />
      <button type="button" className="ag-file__name" onClick={open} title={t('inbox.openFile')}>{a.filename}</button>
      <span className="hg-subtle">{fileSize(a.size_bytes)}</span>
      {onRemove && <button type="button" className="ag-file__x" onClick={onRemove} aria-label={t('inbox.removeFile', { name: a.filename })}><X size={12} aria-hidden /></button>}
    </span>
  );
}

export interface Delivery {
  conversation_id: string; student_locale: string | null; definition: string;
  messages: Record<string, { state: 'SENT' | 'READ' | 'FAILED'; channel: string; read_at: string | null }>;
  application: { id: string; university: string; status: string } | null;
}
/** V9 (REPORT §59 A11): per-message delivery state from real records (MessageRead), and the thread's application link. */
export function useDelivery(convId: string) {
  const { api } = useAuth();
  return useQuery({ queryKey: ['thread', convId, 'delivery'], queryFn: () => api.get<Delivery>(`/agency/conversations/${convId}/delivery`), refetchInterval: 30_000 });
}

export function MessageBubble({ m, names = [], locale = 'en', delivery }: { m: ChatMessage; names?: string[]; locale?: string; delivery?: Delivery['messages'][string] }) {
  const { t } = useT();
  return (
    <li className={cx('ag-msg', m.mine && 'ag-msg--mine', m.internal && 'ag-msg--internal')} data-internal={m.internal}>
      {!m.mine && <Avatar name={m.author?.full_name ?? '?'} size={30} />}
      <div className="ag-msg__bubble">
        {m.internal && (
          <div className="ag-msg__internal" role="note">
            <Lock aria-hidden size={12} /> {t('inbox.internalBanner')}
          </div>
        )}
        <div className="ag-msg__meta">
          <strong>{m.author?.full_name ?? t('inbox.system')}</strong>
          <time dateTime={m.at}>{formatDateTime(m.at, locale)}</time>
          {!m.internal && <span className="ag8-chan" data-channel={m.channel ?? 'IN_APP'}>{t(`v8.channel.${m.channel ?? 'IN_APP'}`)}</span>}
        </div>
        {m.body && <div className="ag-msg__body" data-user-content>{renderBody(m.body, names)}</div>}
        {(m.attachments?.length ?? 0) > 0 && <div className="ag-msg__files">{m.attachments!.map((a) => <AttachmentChip key={a.id} a={a} />)}</div>}
        {m.created_task_id && <div className="ag-msg__task"><ListChecks aria-hidden size={13} /> <Link to="/tasks">{t('inbox.taskCreated')}</Link></div>}
        {delivery && (
          <div className="ag9-dlv" data-state={delivery.state} title={delivery.read_at ? formatDateTime(delivery.read_at, locale) : undefined}>
            {delivery.state === 'READ' ? <CheckCheck aria-hidden size={13} /> : <Check aria-hidden size={13} />}{t(`v9.msg.state.${delivery.state}`)}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * One timeline, a channel per message. V12: only channels that can actually send are offered.
 *
 * V8 listed Email, WhatsApp, KakaoTalk, Zalo and SMS as disabled options beside "Not connected — needs provider
 * credentials". That was honest and it was still the wrong screen for it: a counsellor writing a message is told
 * five times about infrastructure they cannot do anything about, and the composer reads like a half-built
 * product (brief Part 17 — "Do not advertise unavailable integrations in ordinary navigation"). When a provider
 * is configured its channel appears here; until then there is one channel and no picker at all, because a
 * choice between one option is not a choice.
 */
function ChannelPicker() {
  const { t } = useT();
  const q = useChannels();
  const list = (q.data?.channels ?? [{ code: 'IN_APP' as const, label: 'In-app', status: 'ACTIVE' as const, can_send: true, requires: [] }])
    .filter((c) => c.can_send);
  if (list.length < 2) return null;
  return (
    <div className="ag8-chanpick" role="radiogroup" aria-label={t('v8.channel.sendVia')}>
      <span className="ag8-chanpick__label">{t('v8.channel.sendVia')}</span>
      {list.map((c) => (
        <span key={c.code} className="ag8-chanpick__opt" role="radio" aria-checked={c.code === 'IN_APP'}
          tabIndex={c.code === 'IN_APP' ? 0 : -1} data-on={c.code === 'IN_APP' || undefined}>
          {t(`v8.channel.${c.code}`)}
        </span>
      ))}
    </div>
  );
}

function Composer({ convId, studentName, studentLocale, focusComposer }: { convId: string; studentName?: string | null; studentLocale?: string | null; /** V26: arriving to reply (`focus=reply:`) puts the cursor here. */ focusComposer?: boolean }) {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const team = useTeam();
  const templates = useServerTemplates(undefined, studentLocale);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<MessageAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [internal, setInternal] = useState(false);
  const [createTask, setCreateTask] = useState(false);
  const [due, setDue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const members = (team.data?.members ?? []).filter((m) => m.active);
  const mentions = resolveMentions(body, members);
  const m = useMutation({
    mutationFn: () => api.messages.send(convId, {
      body: body.trim(), internal, mentions: mentions.length ? mentions : undefined, create_task: createTask || undefined,
      attachment_ids: files.length ? files.map((f) => f.id) : undefined,
      task_due_at: createTask && due ? new Date(due).toISOString() : undefined,
    }),
    onSuccess: () => {
      setBody(''); setCreateTask(false); setDue(''); setFiles([]);
      qc.invalidateQueries({ queryKey: ['thread', convId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      if (createTask) qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(internal ? t('inbox.noteSaved') : t('inbox.sent'));
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const insert = (text: string) => {
    const el = ref.current;
    const pos = el?.selectionStart ?? body.length;
    const next = body.slice(0, pos) + text + body.slice(pos);
    setBody(next);
    setTimeout(() => { el?.focus(); el?.setSelectionRange(pos + text.length, pos + text.length); }, 0);
  };
  const send = () => { if ((body.trim() || files.length) && !m.isPending && !uploading) m.mutate(); };
  useEffect(() => { if (focusComposer) ref.current?.focus({ preventScroll: true }); }, [focusComposer]);
  const attach = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(list).slice(0, 10 - files.length)) {
        const up = await api.messages.uploadAttachment(convId, f);
        setFiles((prev) => [...prev, up]);
      }
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  return (
    <div className={cx('ag-composer', internal && 'ag-composer--internal')}>
      <div className="hg-row hg-between" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="ag-composer__mode" role="radiogroup" aria-label={t('inbox.mode')}>
          <button type="button" role="radio" aria-checked={!internal} onClick={() => setInternal(false)}><Send aria-hidden size={13} />{t('inbox.modeMessage')}</button>
          <button type="button" role="radio" aria-checked={internal} onClick={() => setInternal(true)}><Lock aria-hidden size={13} />{t('inbox.internalNote')}</button>
        </div>
        <span className="ag-composer__audience" role="note">
          {internal ? <><Lock aria-hidden size={13} /> {t('inbox.audienceTeam')}</> : <><Eye aria-hidden size={13} /> {t('inbox.audienceStudent', { name: studentName ?? t('inbox.participants') })}</>}
        </span>
      </div>
      {!internal && <ChannelPicker />}
      <Textarea ref={ref} rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000}
        aria-label={internal ? t('inbox.internalNote') : t('inbox.message')}
        placeholder={internal ? t('inbox.notePh') : t('inbox.messagePh')}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} />
      {files.length > 0 && <div className="ag-msg__files">{files.map((f) => <AttachmentChip key={f.id} a={f} onRemove={() => setFiles(files.filter((x) => x.id !== f.id))} />)}</div>}
      <div className="ag-composer__bar">
        <input ref={fileRef} type="file" hidden multiple accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => attach(e.target.files)} />
        <Button size="sm" variant="ghost" icon={<Paperclip />} loading={uploading} onClick={() => fileRef.current?.click()}>{t('inbox.attach')}</Button>
        <Popover align="start" width={260} trigger={(p) => <Button size="sm" variant="ghost" icon={<AtSign />} {...p}>{t('inbox.mention')}</Button>}>
          {(close) => (
            <div role="menu" aria-label={t('inbox.mention')} style={{ maxHeight: 280, overflowY: 'auto' }}>
              {members.length === 0 && <div className="hg-subtle hg-small" style={{ padding: 10 }}>{t('states.empty')}</div>}
              {members.map((mb) => (
                <button key={mb.user_id} role="menuitem" type="button" className="hg-menu-item" onClick={() => { insert(`@${mb.full_name} `); close(); }}>
                  <Avatar name={mb.full_name} size={24} />
                  <span className="hg-grow hg-truncate">{mb.full_name}<span className="hg-subtle hg-xs" style={{ display: 'block' }}>{t(`role.${mb.role}`)}</span></span>
                </button>
              ))}
            </div>
          )}
        </Popover>
        <Popover align="start" width={320} trigger={(p) => <Button size="sm" variant="ghost" icon={<StickyNote />} {...p}>{t('nav.templates')}</Button>}>
          {(close) => (
            <div role="menu" aria-label={t('nav.templates')} style={{ maxHeight: 320, overflowY: 'auto' }}>
              {templates.items.length === 0 && <div className="hg-subtle hg-small" style={{ padding: 10 }}>{t('templatesPage.none')}</div>}
              {studentLocale && <div className="hg-subtle hg-xs" style={{ padding: '6px 10px' }}>{t('v9.tpl.studentLang', { lang: studentLocale.toUpperCase() })}</div>}
              {templates.groups.map(({ key, picked: tp, matchedStudent, variants }) => (
                <button key={key} role="menuitem" type="button" className="hg-menu-item" onClick={() => { insert(fillTemplate(tp.body, { student_name: studentName })); close(); }}>
                  <span className="hg-grow" style={{ minWidth: 0 }}>
                    <span className="hg-strong hg-small">{tp.title} <span className={matchedStudent ? 'badge bg-primary-transparent' : 'badge bg-light text-muted'}>{tp.locale.toUpperCase()}</span>
                      {variants.length > 1 && <span className="hg-subtle hg-xs"> · {t('v9.tpl.nLangs', { count: variants.length })}</span>}</span>
                    <span className="hg-subtle hg-xs hg-clamp-2" style={{ display: 'block' }} lang={tp.locale}>{tp.body}</span>
                  </span>
                </button>
              ))}
              <Link to="/templates" className="hg-menu-item hg-small" onClick={close}>{t('inbox.manageTemplates')}</Link>
            </div>
          )}
        </Popover>
        <Checkbox label={t('inbox.createTask')} checked={createTask} onChange={(e) => setCreateTask(e.target.checked)} />
        {createTask && <Input compact type="datetime-local" aria-label={t('inbox.taskDue')} value={due} onChange={(e) => setDue(e.target.value)} style={{ width: 200 }} />}
        <span className="hg-grow" />
        {mentions.length > 0 && <span className="hg-subtle hg-xs">{t('inbox.willNotify', { count: mentions.length })}</span>}
        <Button size="sm" variant={internal ? 'dark' : 'primary'} icon={internal ? <Lock /> : <Send />} disabled={!body.trim() && !files.length} loading={m.isPending} onClick={send}>
          {internal ? t('inbox.saveNote') : studentName ? t('inbox.sendTo', { name: studentName.split(' ').slice(-1)[0] }) : t('actions.send')}
        </Button>
      </div>
      {createTask && <p className="hg-subtle hg-xs">{t('inbox.taskHint')}</p>}
    </div>
  );
}

export function MessageThread({ id, focusComposer }: { id: string; focusComposer?: boolean }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const qc = useQueryClient();
  const team = useTeam();
  const q = useQuery({ queryKey: ['thread', id], queryFn: () => api.messages.thread(id), refetchInterval: 30_000 });
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    api.messages.markRead(id).then(() => qc.invalidateQueries({ queryKey: ['conversations'] })).catch(() => undefined);
  }, [id, api, qc]);
  // V28 (UX_AUDIT AG-1): scroll the thread's own list to its newest message — never the page. `scrollIntoView` moved the
  // whole workspace to wherever this panel sat, so the student's header opened off-screen.
  useEffect(() => {
    const list = endRef.current?.closest('ol');
    if (list) list.scrollTop = list.scrollHeight;
  }, [q.data?.messages.length]);
  const names = (team.data?.members ?? []).map((m) => m.full_name);
  // V9: delivery state per message + the application this thread is about (linkable from here).
  const dlv = useDelivery(id);
  const app = dlv.data?.application ?? null;
  return (
    <QueryState query={q}>
      {(conv) => (
        <div className="ag-thread">
          <header className="ag-thread__head">
            <div style={{ minWidth: 0 }}>
              <h2 className="hg-title-sm hg-truncate">{conv.student ? <Link to={`/students/${conv.student.id}`} className="ag-link-plain">{conv.student.full_name}</Link> : conv.subject}</h2>
              <div className="ag-thread__ref">
                {conv.student && !(conv.kind === 'STUDENT_SUPPORT') && <span>{conv.subject}</span>}
                {app && <Link to={`/applications/${app.id}`}>{app.university} · {t(`appStatus.${app.status}`)}</Link>}
              </div>
            </div>
            {conv.student && <LinkApplication convId={conv.id} studentId={conv.student.id} current={app?.id ?? null} />}
          </header>
          {/* Focusable so keyboard users can scroll the history. */}
          <ol className="ag-thread__list" aria-label={t('inbox.messages')} tabIndex={0}>
            {conv.messages.length === 0 && <li><EmptyState compact title={t('inbox.noMessages')} /></li>}
            {conv.messages.map((m) => <MessageBubble key={m.id} m={m} names={names} locale={locale} delivery={dlv.data?.messages[m.id]} />)}
            <li ref={endRef} aria-hidden className="ag-thread__end" />
          </ol>
          <Composer convId={conv.id} studentName={conv.student?.full_name} studentLocale={dlv.data?.student_locale} focusComposer={focusComposer} />
        </div>
      )}
    </QueryState>
  );
}

/** Tie the thread to one of the student's applications (or unlink). The list loads only when opened. */
function LinkApplication({ convId, studentId, current }: { convId: string; studentId: string; current: string | null }) {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ws = useQuery({ queryKey: ['agency', 'student', studentId], queryFn: () => api.agency.student(studentId), enabled: open });
  const m = useMutation({
    mutationFn: (application_id: string | null) => api.patch(`/agency/conversations/${convId}/application`, { application_id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['thread', convId] }); toast.success(t('actions.saved')); setOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Popover align="end" width={300} open={open} onOpenChange={setOpen}
      trigger={(p) => <Button size="sm" variant="ghost" icon={<Link2 />} {...p}>{current ? t('v9.msg.changeLink') : t('v9.msg.link')}</Button>}>
      <div role="menu" aria-label={t('v9.msg.link')} style={{ maxHeight: 300, overflowY: 'auto' }}>
        {ws.isLoading && <div className="hg-subtle hg-small" style={{ padding: 10 }}>…</div>}
        {(ws.data?.applications ?? []).map((a) => (
          <button key={a.id} role="menuitemradio" aria-checked={a.id === current} type="button" className="hg-menu-item" onClick={() => m.mutate(a.id)}>
            <span className="hg-grow hg-small">{localName(a.university)}<span className="hg-subtle hg-xs" style={{ display: 'block' }}>{localName(a.program)} · {t(`appStatus.${a.status}`)}</span></span>
          </button>
        ))}
        {ws.data && ws.data.applications.length === 0 && <div className="hg-subtle hg-small" style={{ padding: 10 }}>{t('ws.noApps')}</div>}
        {current && <button type="button" role="menuitem" className="hg-menu-item hg-small" onClick={() => m.mutate(null)}>{t('v9.msg.unlink')}</button>}
      </div>
    </Popover>
  );
}

export function NewConversationModal({ open, onClose, student }: { open: boolean; onClose: () => void; student?: { id: string; full_name: string } | null }) {
  const { api } = useAuth();
  const { t } = useT();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [who, setWho] = useState<{ id: string; full_name: string } | null>(student ?? null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  useEffect(() => { if (open) { setWho(student ?? null); setSubject(''); setBody(''); } }, [open, student]);
  const m = useMutation({
    mutationFn: () => api.messages.start({ subject: subject.trim(), body: body.trim(), student_id: who!.id }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['conversations'] }); toast.success(t('inbox.sent')); onClose(); nav(`/messages/${r.id}`); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open={open} onClose={onClose} title={t('inbox.new')} width={560}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" disabled={!who || !subject.trim() || !body.trim()} loading={m.isPending} onClick={() => m.mutate()}>{t('actions.send')}</Button></>}>
      <div className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties}>
        <Field label={t('misc.student')}><StudentPicker value={who} onChange={setWho} label={t('misc.student')} /></Field>
        <Field label={t('inbox.subject')} htmlFor="nc-subject"><Input id="nc-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} /></Field>
        <Field label={t('inbox.message')} htmlFor="nc-body" hint={t('inbox.newHint')}><Textarea id="nc-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} /></Field>
      </div>
    </Modal>
  );
}

