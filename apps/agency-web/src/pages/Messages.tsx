import { useAuth } from '@hangyul/auth';
import { ChevronLeft, Lock, MessagesSquare, Plus } from '@hangyul/icons';
import type { ConversationSummary } from '@hangyul/types';
import { Button, Card, EmptyState, ErrorState, Skeleton } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import { cx } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { SearchBox, useT } from '../components/bits';
import { MessageThread, NewConversationModal } from '../components/MessageThread';
import { shortRelative } from '../lib/logic';
import { YAvatar } from '../components/ynex';

type Filter = 'all' | 'unread' | 'reply';

/** The standing support thread with a student is "the" conversation — its subject adds nothing on every row. */
export function isSupportThread(c: Pick<ConversationSummary, 'kind' | 'student'>) {
  return c.kind === 'STUDENT_SUPPORT' && !!c.student;
}

export default function Messages() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const { id } = useParams();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState('');
  const filter: Filter = (['unread', 'reply'] as const).find((f) => f === sp.get('filter')) ?? 'all';
  const setFilter = (f: Filter) => setSp((prev) => { const n = new URLSearchParams(prev); if (f === 'all') n.delete('filter'); else n.set('filter', f); return n; }, { replace: true });
  const [creating, setCreating] = useState(false);
  const convs = useQuery({ queryKey: ['conversations'], queryFn: () => api.messages.conversations(), refetchInterval: 30_000 });
  // "Waiting for your reply" is the same set Today counts: conversations about your own students where the student wrote last.
  const replyQ = useQuery({ queryKey: ['conversations', { needs_reply: true }], queryFn: () => api.messages.conversations(undefined, { needs_reply: true }), refetchInterval: 30_000 });
  const source = filter === 'reply' ? replyQ : convs;
  // A conversation stays in the "Unread" list while you read it (like an inbox), so the list Today linked to doesn't shrink under you.
  const seenUnread = useRef(new Set<string>());
  (convs.data ?? []).forEach((c) => { if (c.unread > 0) seenUnread.current.add(c.id); });
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (source.data ?? []).filter((c) => (filter !== 'unread' || c.unread > 0 || seenUnread.current.has(c.id))
      && (!n || c.subject.toLowerCase().includes(n) || (c.student?.full_name ?? '').toLowerCase().includes(n) || (c.application?.university ?? '').toLowerCase().includes(n)));
  }, [source.data, q, filter]);
  const unreadConvs = (convs.data ?? []).filter((c) => c.unread > 0).length;
  const replyCount = replyQ.data?.length ?? 0;

  // Desktop: open the most recent unread conversation (else the most recent) instead of an empty "pick one" pane.
  useEffect(() => {
    if (id || !list.length || !window.matchMedia('(min-width: 1024px)').matches) return;
    const first = list.find((c) => c.unread > 0) ?? list[0];
    nav(`/messages/${first.id}${sp.toString() ? `?${sp}` : ''}`, { replace: true });
  }, [id, list]); // eslint-disable-line react-hooks/exhaustive-deps

  const chip = (f: Filter, label: string, count?: number) => (
    <button type="button" className="btn btn-sm btn-light ag26-filterchip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
      {label}{count ? <span className="badge rounded-pill ms-1 ag26-count">{count}</span> : null}
    </button>
  );

  return (
    <div className="ag7 ag7-inbox">
      <PageHeader title={t('nav.messages')} sub={replyCount ? t('inbox.subReply', { count: replyCount }) : t('inbox.subUnread', { count: unreadConvs })}
        actions={<Button size="sm" variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>{t('inbox.new')}</Button>} />
      <div className="ag-split ag-split--inbox" data-has-selection={!!id}>
        <Card className="ag-split__list card custom-card" as="section" aria-label={t('inbox.inbox')}>
          <div className="card-header justify-content-between">
            <h2 className="card-title">{t('inbox.inbox')}{unreadConvs > 0 && <span className="badge bg-primary-transparent rounded ms-1 fs-12 align-middle yx-count">{unreadConvs}</span>}</h2>
          </div>
          <div className="ag-split__listhead ag-split__listhead--stack">
            <SearchBox value={q} onChange={setQ} placeholder={t('inbox.searchPh')} label={t('actions.search')} />
            <div className="btn-group ag7-seg" role="group" aria-label={t('inbox.inbox')}>
              {chip('all', t('inbox.all'))}
              {chip('reply', t('inbox.needsReply'), replyCount)}
              {chip('unread', t('inbox.unread'), unreadConvs)}
            </div>
          </div>
          {source.isLoading ? <div className="hg-stack" style={{ padding: 12 }}>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={56} r={10} />)}</div>
            : source.isError ? <ErrorState compact error={source.error} onRetry={() => source.refetch()} />
              : list.length === 0 ? <EmptyState compact icon={<MessagesSquare />} title={t(filter === 'reply' ? 'inbox.emptyReply' : 'inbox.empty')} action={filter === 'all' ? <Button size="sm" onClick={() => setCreating(true)}>{t('inbox.new')}</Button> : undefined} />
                : (
                  <ul className="ag-convs">
                    {list.map((c) => {
                      const name = c.student?.full_name ?? c.subject;
                      const ref = c.application?.university ?? (isSupportThread(c) || !c.student ? null : c.subject);
                      const last = c.last_message;
                      const lastAuthor = last?.author?.full_name && last.author.id !== c.student?.id ? `${last.author.full_name.split(' ').slice(-1)[0]}: ` : '';
                      return (
                        <li key={c.id}>
                          <Link to={`/messages/${c.id}${sp.toString() ? `?${sp}` : ''}`} className={cx('ag-conv', c.id === id && 'is-active', c.unread > 0 && 'is-unread')} aria-current={c.id === id ? 'page' : undefined}>
                            <YAvatar name={name} size="md" />
                            <span className="ag-conv__main">
                              <span className="ag-conv__row">
                                <span className="hg-truncate hg-strong hg-small">{name}</span>
                                <span className="hg-subtle hg-xs" style={{ flex: 'none' }}>{shortRelative(c.last_message_at, locale)}</span>
                              </span>
                              {(ref || c.awaiting_reply) && (
                                <span className="hg-truncate hg-xs">
                                  {c.awaiting_reply && <span className="ag-conv__reply">{t('inbox.needsReplyShort')}</span>}
                                  {c.awaiting_reply && ref ? ' · ' : ''}
                                  {ref && <span className="ag-conv__ref">{ref}</span>}
                                </span>
                              )}
                              {last && (
                                <span className={cx('ag-conv__last hg-xs hg-truncate', last.internal && 'is-internal')}>
                                  {last.internal && <><Lock size={11} aria-hidden /> <span className="hg-sr-only">{t('misc.internalTag')}</span></>}{lastAuthor}<span data-user-content>{last.body}</span>
                                </span>
                              )}
                            </span>
                            {c.unread > 0 && <span className="ag-unread-dot" aria-label={t('inbox.unreadN', { count: c.unread })} />}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
        </Card>
        <Card className="ag-split__detail ag-split__detail--thread card custom-card" as="section" aria-label={t('inbox.thread')}>
          {id ? (
            <>
              <div className="ag-split__back"><Button size="sm" variant="ghost" icon={<ChevronLeft className="hg-flip-rtl" />} onClick={() => nav(`/messages${sp.toString() ? `?${sp}` : ''}`)}>{t('inbox.inbox')}</Button></div>
              <MessageThread key={id} id={id} />
            </>
          ) : <EmptyState icon={<MessagesSquare />} title={t('inbox.pick')} text={t('inbox.pickText')} />}
        </Card>
      </div>
      <NewConversationModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
