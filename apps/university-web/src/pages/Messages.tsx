import { useAuth } from '@hangyul/auth';
import { ArrowLeft, Lock, MessageSquare, Send } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { Avatar, Badge, Button, Card, Checkbox, EmptyState, ErrorState, QueryState, SkeletonCard, Textarea, useToast } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import { cx, formatDateTime, formatRelative } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { useUniversity } from '../lib/university';

function Thread({ id }: { id: string }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const { perms } = useUniversity();
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const q = useQuery({ queryKey: ['thread', id], queryFn: () => api.messages.thread(id), refetchInterval: 20_000 });
  useEffect(() => {
    if (q.data) api.messages.markRead(id).then(() => qc.invalidateQueries({ queryKey: ['conversations'] })).catch(() => undefined);
  }, [q.data?.messages.length, id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }); }, [q.data?.messages.length]);
  const send = useMutation({
    mutationFn: () => api.messages.send(id, { body: body.trim(), internal }),
    onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['thread', id] }); qc.invalidateQueries({ queryKey: ['conversations'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (q.isLoading) return <SkeletonCard lines={5} />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data;
  return (
    <div className="uc-thread">
      <div className="uc-thread__head">
        <Link to="/messages" className="uc-back uc-only-compact"><ArrowLeft size={14} aria-hidden className="hg-flip-rtl" /> {t('common:nav.messages')}</Link>
        <h2 className="hg-title-sm">{c.subject}</h2>
        <div className="hg-row-wrap hg-xs hg-subtle" style={{ gap: 8 }}>
          <Badge size="sm">{t(`university:messages.kind.${c.kind}`, { defaultValue: c.kind })}</Badge>
          {c.student && <span>{c.student.full_name}</span>}
          {c.application_id && <Link to={`/applications/${c.application_id}`}>{t('university:messages.openApplication')}</Link>}
        </div>
      </div>
      <div className="uc-thread__body" aria-live="polite">
        {c.messages.length === 0 && <p className="hg-subtle hg-small">{t('university:messages.noMessages')}</p>}
        {c.messages.map((m) => (
          <div key={m.id} className={cx('uc-msg', m.mine && 'uc-msg--mine', m.internal && 'uc-msg--internal')}>
            {!m.mine && <Avatar name={m.author?.full_name ?? '?'} size={28} />}
            <div className="uc-msg__bubble">
              <div className="uc-msg__meta">
                <strong>{m.author?.full_name ?? t('university:messages.system')}</strong>
                <span title={formatDateTime(m.at, locale)}>{formatRelative(m.at, locale)}</span>
                {m.internal && <Badge size="sm" tone="warning" icon={<Lock aria-hidden />}>{t('university:messages.internal')}</Badge>}
              </div>
              <div className="uc-msg__text">{m.body}</div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {perms.readOnly ? <p className="hg-subtle hg-small uc-thread__compose">{t('university:messages.readOnly')}</p> : (
        <form className="uc-thread__compose" onSubmit={(e) => { e.preventDefault(); if (body.trim()) send.mutate(); }}>
          <label className="hg-sr-only" htmlFor="compose">{t('university:messages.compose')}</label>
          <Textarea id="compose" rows={3} value={body} maxLength={8000} placeholder={t('university:messages.compose')} onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body.trim()) send.mutate(); }} />
          <div className="hg-row hg-between" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Checkbox label={t('university:messages.internalToggle')} checked={internal} onChange={(e) => setInternal(e.target.checked)} />
            <Button type="submit" variant="primary" icon={<Send />} loading={send.isPending} disabled={!body.trim()}>{t('common:actions.send')}</Button>
          </div>
        </form>
      )}
    </div>
  );
}

type Tab = 'all' | 'applications' | 'unread';

/** V8: inbox tied to applications — every thread shows the applicant and the application it is about; a real empty state. */
export default function Messages() {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const appFilter = sp.get('application');
  const tab = (['applications', 'unread'].includes(sp.get('tab') ?? '') ? sp.get('tab') : 'all') as Tab;
  const q = useQuery({ queryKey: ['conversations'], queryFn: () => api.messages.conversations(), refetchInterval: 30_000 });
  const setTab = (v: Tab) => { const n = new URLSearchParams(sp); if (v === 'all') n.delete('tab'); else n.set('tab', v); setSp(n, { replace: true }); };
  const keep = sp.toString() ? `?${sp.toString()}` : '';
  const list = q.data ?? [];
  if (!q.isLoading && !q.isError && list.length === 0) {
    return (
      <div className="hg-stack uc-page uv7">
        <PageHeader title={t('common:nav.messages')} sub={t('university:v8.msg.subtitle')} />
        <Card className="uv8-msgempty">
          <EmptyState icon={<MessageSquare />} title={t('university:v8.msg.emptyTitle')} text={t('university:v8.msg.emptyText')}
            action={<Link to={appFilter ? `/applications/${appFilter}` : '/applicants'} className="btn btn-primary uv7-btn">{appFilter ? t('university:messages.openApplication') : t('university:v8.msg.openApplicants')}</Link>} />
          <ol className="uv8-msgempty__how">
            <li>{t('university:v8.msg.how1')}</li>
            <li>{t('university:v8.msg.how2')}</li>
            <li>{t('university:v8.msg.how3')}</li>
          </ol>
        </Card>
      </div>
    );
  }
  const items = list
    .filter((c) => !appFilter || c.application_id === appFilter)
    .filter((c) => tab === 'all' || (tab === 'applications' ? !!c.application_id : c.unread > 0));
  const counts = { all: list.length, applications: list.filter((c) => c.application_id).length, unread: list.filter((c) => c.unread > 0).length };
  return (
    <div className="hg-stack uc-page uv7">
      <PageHeader title={t('common:nav.messages')} sub={t('university:v8.msg.subtitle')} />
      <div className="uc-inbox" data-open={id ? 'thread' : 'list'}>
        <Card className="uc-inbox__list">
          <div className="uv8-msgtabs" role="group" aria-label={t('university:v8.msg.show')}>
            {(['all', 'applications', 'unread'] as Tab[]).map((k) => (
              <button key={k} type="button" className={cx('uv8-msgtab', tab === k && 'is-on')} aria-pressed={tab === k} onClick={() => setTab(k)}>
                {t(`university:v8.msg.tab.${k}`)} <span className="uv7-num">{counts[k]}</span>
              </button>
            ))}
          </div>
          <QueryState query={q} skeleton={<SkeletonCard lines={4} />}>
            {() => (
              <ul aria-label={t('common:nav.messages')}>
                {appFilter && <li className="uc-inbox__filter hg-xs">{t('university:messages.filtered')} <Link to="/messages">{t('common:actions.clearFilters')}</Link></li>}
                {items.length === 0 && (
                  <li className="hg-subtle hg-small" style={{ padding: 16 }}>
                    {appFilter ? <>{t('university:messages.noneForApp')} <Link to={`/applications/${appFilter}`}>{t('university:v8.msg.startFromApp')}</Link></> : t('university:v8.msg.noneInTab')}
                  </li>
                )}
                {items.map((c) => (
                  <li key={c.id}>
                    <Link to={`/messages/${c.id}${keep}`} className="uc-conv" aria-current={c.id === id ? 'page' : undefined}>
                      <div className="hg-row hg-between" style={{ gap: 8 }}>
                        <span className={cx('hg-truncate hg-small', c.unread > 0 && 'hg-strong')}>{c.student?.full_name ?? c.subject}</span>
                        {c.unread > 0 && <span className="hg-navlink__badge" aria-label={t('university:messages.unread', { count: c.unread })}>{c.unread}</span>}
                      </div>
                      <div className="hg-xs hg-truncate">
                        {c.application_id
                          ? <>{t('university:v8.msg.about')} <span className="hg-medium">{c.subject}</span>{c.application?.status ? <> · {t(`common:appStatus.${c.application.status}`)}</> : null}</>
                          : <span className="hg-subtle">{t(`university:messages.kind.${c.kind}`, { defaultValue: c.kind })} · {c.subject}</span>}
                      </div>
                      <div className="hg-xs hg-subtle hg-truncate">{c.last_message?.internal ? `🔒 ` : ''}{c.last_message?.author?.full_name ? `${c.last_message.author.full_name}: ` : ''}{c.last_message?.body ?? ''}</div>
                      <div className="hg-xs hg-subtle">{formatRelative(c.last_message_at, locale)}{c.awaiting_reply ? ` · ${t('university:v8.msg.awaiting')}` : ''}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </Card>
        <Card className="uc-inbox__thread">
          {id ? <Thread key={id} id={id} /> : (
            <EmptyState icon={<MessageSquare />} title={t('university:messages.pick')}
              text={counts.unread ? t('university:v8.msg.pickUnread', { count: counts.unread }) : t('university:messages.pickText')} />
          )}
        </Card>
      </div>
    </div>
  );
}
