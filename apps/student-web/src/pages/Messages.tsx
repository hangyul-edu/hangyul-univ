import { useApi } from '@hangyul/auth';
import { ArrowLeft, MessageCircle, Paperclip, Plus, Send, Video, X } from '@hangyul/icons';
import type { ConversationDetail, MessageAttachment } from '@hangyul/types';
import { Avatar, Button, EmptyState, Field, Input, Modal, QueryState, Skeleton, Textarea, useToast } from '@hangyul/ui';
import { cx, formatDateTime, formatRelative } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { PageIntro } from '../components/bits';
import { TeamAvatar } from '../components/TeamAvatar';
import { useT } from '../lib/i18n';
import { displayName, isTeam } from '../lib/team';
import { useConversations } from '../lib/queries';

/** The default support thread is created by the server with an English subject; show it in the reader's language (V9 l10n). */
const SUPPORT_SUBJECT = 'Your study-in-Korea team';
const subjectText = (t: ReturnType<typeof useT>['t'], subject: string) => (subject === SUPPORT_SUBJECT ? t('common:v9.l10n.supportConversation') : subject);

function NewConversation({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const m = useMutation({
    mutationFn: () => api.messages.start({ subject: subject.trim(), body: body.trim() }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['conversations'] }); onClose(); nav(`/messages/${r.id}`); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open onClose={onClose} title={t('messages.new.title')} description={t('messages.new.subtitle')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common:actions.cancel')}</Button><Button variant="primary" icon={<Send />} disabled={!subject.trim() || !body.trim()} loading={m.isPending} onClick={() => m.mutate()}>{t('common:actions.send')}</Button></>}>
      <div className="hg-stack">
        <Field label={t('messages.new.subject')} htmlFor="conv-subject"><Input id="conv-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} /></Field>
        <Field label={t('messages.new.body')} htmlFor="conv-body"><Textarea id="conv-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function Thread({ id }: { id: string }) {
  const { t, locale } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<MessageAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const attach = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(list).slice(0, 5)) {
        const a = await api.messages.uploadAttachment(id, f);
        setFiles((x) => [...x, a]);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const openFile = async (a: MessageAttachment) => {
    try { const r = await api.messages.attachmentUrl(a.id, 'inline'); window.open(r.url, '_blank', 'noopener'); } catch (e) { toast.error((e as Error).message); }
  };
  const q = useQuery({ queryKey: ['thread', id], queryFn: () => api.messages.thread(id), refetchInterval: 15_000 });
  const count = q.data?.messages.length ?? 0;
  const loaded = !!q.data;

  useEffect(() => {
    if (!loaded) return;
    api.messages.markRead(id).then(() => qc.invalidateQueries({ queryKey: ['conversations'] })).catch(() => undefined);
  }, [id, count, api, qc, loaded]);
  // V28 (UX_AUDIT AG-1, same pattern): scroll the thread's own list, never the page.
  useEffect(() => {
    const list = end.current?.parentElement;
    if (list) list.scrollTop = list.scrollHeight;
  }, [count]);

  const send = useMutation({
    mutationFn: (body: string) => api.messages.send(id, { body, attachment_ids: files.map((f) => f.id) }),
    onMutate: (body) => {
      const prev = qc.getQueryData<ConversationDetail>(['thread', id]);
      qc.setQueryData<ConversationDetail>(['thread', id], (d) => d ? { ...d, messages: [...d.messages, { id: `tmp-${Date.now()}`, body, internal: false, at: new Date().toISOString(), author: null, mine: true, mentions: [], created_task_id: null, attachment_document_id: null }] } : d);
      setText('');
      setFiles([]);
      return { prev, body };
    },
    onError: (e, _b, ctx) => { if (ctx?.prev) qc.setQueryData(['thread', id], ctx.prev); setText(ctx?.body ?? ''); toast.error((e as Error).message); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['thread', id] }); qc.invalidateQueries({ queryKey: ['conversations'] }); },
  });
  const submit = () => { const b = text.trim() || (files.length ? t('messagesV3.sentFiles', { count: files.length }) : ''); if (b && !send.isPending && !uploading) send.mutate(b); };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };

  return (
    <QueryState query={q} skeleton={<div className="st-thread"><Skeleton h={60} /><Skeleton h={60} /></div>}>
      {(d) => (
        <div className="st-thread">
          <header className="st-thread__head">
            <Link to="/messages" className="hg-btn hg-btn--ghost hg-btn--icon st-thread__back" aria-label={t('common:actions.back')}><ArrowLeft className="hg-flip-rtl" /></Link>
            <div className="hg-grow" style={{ minWidth: 0 }}>
              <h2 className="hg-title-sm hg-truncate">{subjectText(t, d.subject)}</h2>
              <div className="hg-subtle hg-xs">{t('messages.visibility')}</div>
            </div>
          </header>
          <div className="st-thread__body" role="log" aria-live="polite" aria-label={subjectText(t, d.subject)}>
            {d.messages.filter((m) => !m.internal).map((m) => (
              <div key={m.id} className={cx('st-msg', m.mine && 'st-msg--mine')}>
                {/* V22 (REPORT §246 A3): a staff author is the Hangyul team — brand mark, team name, one identity for the whole thread. */}
                {!m.mine && (isTeam(m.author) ? <TeamAvatar size={30} /> : <Avatar name={m.author?.full_name ?? '?'} size={30} />)}
                <div className="st-msg__bubble">
                  {!m.mine && <div className="st-msg__author">{displayName(t, m.author)}</div>}
                  <div className="st-msg__text" data-user-content>{m.body}</div>
                  {(m.attachments ?? []).length > 0 && (
                    <ul className="ms-files">
                      {(m.attachments ?? []).map((a) => (
                        <li key={a.id}><button type="button" onClick={() => openFile(a)}><Paperclip aria-hidden /> <span className="hg-truncate">{a.filename}</span></button></li>
                      ))}
                    </ul>
                  )}
                  <time className="st-msg__time" dateTime={m.at} title={formatDateTime(m.at, locale)}>{formatRelative(m.at, locale)}</time>
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          {files.length > 0 && (
            <ul className="ms-pending" aria-label={t('messagesV3.attached')}>
              {files.map((f) => (
                <li key={f.id}><Paperclip aria-hidden /> <span className="hg-truncate">{f.filename}</span>
                  <button type="button" aria-label={t('messagesV3.remove', { name: f.filename })} onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))}><X aria-hidden /></button></li>
              ))}
            </ul>
          )}
          <form className="st-composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <input ref={fileInput} type="file" hidden accept="application/pdf,image/png,image/jpeg,image/webp" multiple onChange={(e) => attach(e.target.files)} />
            <Button variant="ghost" iconOnly icon={<Paperclip />} aria-label={t('messagesV3.attach')} loading={uploading} onClick={() => fileInput.current?.click()} />
            <Textarea aria-label={t('messages.composer')} placeholder={t('messages.composer')} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} className="st-composer__input" />
            <Button type="submit" variant="primary" iconOnly icon={<Send className="hg-flip-rtl" />} aria-label={t('common:actions.send')} disabled={(!text.trim() && files.length === 0) || uploading} loading={send.isPending} />
          </form>
          <p className="st-composer__hint hg-subtle hg-xs">{t('messages.hint')}</p>
        </div>
      )}
    </QueryState>
  );
}

function Upcoming() {
  const { t, locale } = useT();
  const api = useApi();
  const q = useQuery({ queryKey: ['appointments'], queryFn: () => api.me.appointments() });
  const next = (q.data ?? []).filter((a) => a.status === 'SCHEDULED' && new Date(a.starts_at).getTime() > Date.now());
  if (!next.length) return null;
  return (
    <div className="st-appt st-appt--list">
      <Video size={16} aria-hidden />
      <div className="hg-grow">
        {next.slice(0, 2).map((a) => (
          <div key={a.id} className="hg-small"><strong>{t('messages.call', { when: formatDateTime(a.starts_at, locale) })}</strong>{a.host ? ` · ${displayName(t, a.host)}` : ''}{a.notes ? <div className="hg-xs hg-muted">{a.notes}</div> : null}</div>
        ))}
      </div>
    </div>
  );
}

export default function Messages() {
  const { t, locale } = useT();
  const { id } = useParams();
  const q = useConversations(20_000);
  const [creating, setCreating] = useState(false);
  return (
    <div className="st-page">
      <div className={cx('st-inbox-intro', id && 'st-hide-mobile')}>
        <PageIntro title={t('messages.title')} subtitle={t('messages.subtitle')} actions={<Button icon={<Plus />} onClick={() => setCreating(true)}>{t('messages.new.button')}</Button>} />
      </div>
      <div className={cx('st-inbox', id && 'st-inbox--thread')}>
        <div className="st-inbox__list">
          <Upcoming />
          <QueryState query={q} skeleton={<div className="hg-stack"><Skeleton h={64} /><Skeleton h={64} /></div>} isEmpty={(d) => d.length === 0}
            empty={<EmptyState compact icon={<MessageCircle />} title={t('messages.empty')} text={t('messages.emptyText')} action={<Button size="sm" variant="soft" onClick={() => setCreating(true)}>{t('messages.new.button')}</Button>} />}>
            {(list) => (
              <ul className="st-conv-list">
                {list.map((c) => (
                  <li key={c.id}>
                    <Link to={`/messages/${c.id}`} className={cx('st-conv', c.id === id && 'st-conv--active')} aria-current={c.id === id ? 'page' : undefined}>
                      {isTeam(c.last_message?.author) || c.last_message?.author?.id === c.student?.id ? <TeamAvatar size={40} /> : <Avatar name={c.last_message?.author?.full_name ?? c.subject} size={40} />}
                      <span className="hg-grow" style={{ minWidth: 0 }}>
                        <span className="hg-row hg-between" style={{ '--hg-gap': '8px' } as React.CSSProperties}>
                          <span className={cx('hg-truncate', c.unread > 0 ? 'hg-strong' : undefined)}>{subjectText(t, c.subject)}</span>
                          <span className="hg-subtle hg-xs" style={{ flex: 'none' }}>{formatRelative(c.last_message_at, locale)}</span>
                        </span>
                        <span className="hg-row hg-between" style={{ '--hg-gap': '8px' } as React.CSSProperties}>
                          <span className="hg-muted hg-small hg-truncate" data-user-content>{c.last_message?.body ?? ''}</span>
                          {c.unread > 0 && <span className="st-unread" aria-label={t('messages.unread', { count: c.unread })}>{c.unread}</span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </div>
        <div className="st-inbox__thread">
          {id ? <Thread key={id} id={id} /> : <EmptyState icon={<MessageCircle />} title={t('messages.pick')} text={t('messages.pickText')} />}
        </div>
      </div>
      {creating && <NewConversation onClose={() => setCreating(false)} />}
    </div>
  );
}
