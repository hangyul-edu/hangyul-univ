// V8 audit log — read as sentences ("Đinh Thị Hoa opened Trần Minh Thư's bank balance certificate"), grouped by day,
// filterable by person, student and kind of action. Names and readable targets are resolved server-side (GET /audit);
// no raw JSON, action keys or record ids are shown.
import { useAuth } from '@hangyul/auth';
import { Button, EmptyState, ErrorState, FilterSelect, Skeleton } from '@hangyul/ui';
import { PageHeader, YCard } from '@hangyul/ynex-ui';
import { formatDate, formatNumber } from '@hangyul/utils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { FilterBar, useT } from '../components/bits';
import { usePerms, useUrlFilters } from '../lib/hooks';
import { groupBy, lowerKeepAcronyms } from '../lib/logic';

const PREFIXES = ['student', 'document', 'application', 'essay', 'message', 'assignment', 'visa', 'submission', 'saved_view', 'source', 'freshness', 'auth'];
const PAGE = 50;

interface AuditRow {
  id: string; action: string; entity_type: string; entity_id: string | null; actor: string; actor_id: string | null;
  subject_user_id: string | null; subject_name: string | null; ip: string | null; at: string;
  target: null | { type: string; category?: string; label?: string; university?: string; status?: string; essay_type?: string; kind?: string; case_type?: string };
  facts: Record<string, string | number | boolean>;
}

type TFn = (k: string, o?: Record<string, unknown>) => string;

function targetText(t: TFn, r: AuditRow): string {
  const g = r.target;
  if (!g) return '';
  switch (g.type) {
    case 'document': return g.category ? lowerKeepAcronyms(t(`docCategory.${g.category}`)) : g.label ?? '';
    case 'application': return g.university ?? '';
    case 'essay': return g.essay_type ? lowerKeepAcronyms(t(`essayType.${g.essay_type}`)) : g.label ?? '';
    case 'appointment': return g.kind ? lowerKeepAcronyms(t(`consult.kind.${g.kind}`, { defaultValue: g.kind })) : '';
    case 'service_case': return g.case_type ? t(`concierge:type.${g.case_type}`, { defaultValue: '' }) : '';
    default: return g.label ?? '';
  }
}

/** One sentence per entry. Unknown actions fall back to their label (or "made a change"), never to the raw key. */
export function auditSentence(t: TFn, r: AuditRow): string {
  const student = r.subject_name ?? t('v8.audit.aStudent');
  const target = targetText(t, r);
  const f = r.facts;
  const status = (v: unknown, ns: string) => (typeof v === 'string' ? t(`${ns}.${v}`, { defaultValue: t('v8.audit.anotherState') }) : '');
  const params = {
    actor: r.actor === 'system' ? t('v8.audit.system') : r.actor, student, target,
    from: r.action === 'student.stage' ? status(f.from, 'pipeline') : status(f.from, 'appStatus'),
    to: r.action === 'student.stage' ? status(f.to, 'pipeline') : status(f.to, 'appStatus'),
    decision: typeof f.decision === 'string' ? lowerKeepAcronyms(t(`docStatus.${f.decision}`, { defaultValue: '' })) : '',
    name: typeof f.name === 'string' ? f.name : target,
    count: typeof f.count === 'number' ? f.count : 1,
  };
  const key = `v8.audit.s.${r.action.replace(/\./g, '_')}`;
  const s = t(key, { ...params, defaultValue: '' });
  if (s) return s;
  const what = t(`audit.action.${r.action}`, { defaultValue: '' }) || t('v8.audit.someChange');
  return t(r.subject_name ? 'v8.audit.genericStudent' : 'v8.audit.generic', { ...params, what });
}

/** Consecutive identical sentences (the same person reopening the same record) read as one line "· 3 times". */
function collapse(rows: AuditRow[], text: (r: AuditRow) => string) {
  const out: { r: AuditRow; text: string; n: number }[] = [];
  for (const r of rows) {
    const s = text(r);
    const last = out[out.length - 1];
    if (last && last.text === s) last.n += 1;
    else out.push({ r, text: s, n: 1 });
  }
  return out;
}

export default function Audit() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const perms = usePerms();
  const f = useUrlFilters(['action', 'actor', 'student', 'page'] as const);
  const page = Math.max(1, Number(f.values.page || 1));
  const query = { action: f.values.action || undefined, actor_id: f.values.actor || undefined, subject_id: f.values.student || undefined, page, page_size: PAGE };
  const q = useQuery({ queryKey: ['audit', 'v8', query], queryFn: () => api.get<{ items: AuditRow[]; total: number }>('/audit', query), placeholderData: keepPreviousData });
  const people = useQuery({ queryKey: ['audit', 'people'], queryFn: () => api.get<{ actors: { id: string; name: string }[]; students: { id: string; name: string }[] }>('/audit/people'), staleTime: 5 * 60_000 });
  const days = groupBy(q.data?.items ?? [], (r) => r.at.slice(0, 10));
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const time = (iso: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const active = [f.values.action, f.values.actor, f.values.student].filter(Boolean).length;
  return (
    <div className="ag7 ag8-audit">
      <PageHeader title={t('nav.audit')} sub={perms.isHangyul ? t('audit.subHq') : t('audit.sub')} />
      <YCard flush title={t('v8.audit.title')} count={q.data ? formatNumber(total, locale) : undefined}>
        <div className="ag-card-toolbar">
          <FilterBar active={active} onClear={() => f.set({ action: null, actor: null, student: null, page: null })}>
            <FilterSelect size="sm" label={t('v8.audit.who')} value={f.values.actor} onChange={(e) => f.set({ actor: e.target.value, page: null })}>
              <option value="">{t('v8.audit.anyone')}</option>
              {(people.data?.actors ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </FilterSelect>
            <FilterSelect size="sm" label={t('misc.student')} value={f.values.student} onChange={(e) => f.set({ student: e.target.value, page: null })}>
              <option value="">{t('v8.audit.anyStudent')}</option>
              {(people.data?.students ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </FilterSelect>
            <FilterSelect size="sm" label={t('audit.actionCol')} value={f.values.action} onChange={(e) => f.set({ action: e.target.value, page: null })}>
              <option value="">{t('audit.allActions')}</option>
              {PREFIXES.map((p) => <option key={p} value={p}>{t(`v8.audit.prefix.${p}`, { defaultValue: t(`audit.prefix.${p}`, { defaultValue: p }) })}</option>)}
            </FilterSelect>
          </FilterBar>
        </div>
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isLoading ? <div className="p-3"><Skeleton h={240} /></div> : total === 0 ? (
          <EmptyState compact title={t('v8.audit.empty')} />
        ) : (
          <div className="ag8-audit__days">
            {days.map(([day, rows]) => (
              <section key={day} aria-labelledby={`au-${day}`}>
                <h2 id={`au-${day}`} className="ag8-audit__day">{formatDate(day, locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
                <ul className="ag8-audit__list">
                  {collapse(rows, (r) => auditSentence(t, r)).map(({ r, text, n }) => (
                    <li key={r.id}>
                      <time dateTime={r.at} className="ag8-audit__time hg-num">{time(r.at)}</time>
                      <span className="ag8-audit__s">{text}{n > 1 && <span className="ag8-audit__x"> · {t('v8.audit.times', { count: n })}</span>}</span>
                      {r.subject_user_id && <Link className="ag8-audit__open" to={`/students/${r.subject_user_id}?tab=history`}>{t('audit.open')}</Link>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {pages > 1 && (
          <nav className="ag8-audit__pager" aria-label={t('v8.audit.pageOf', { page, pages })}>
            <Button size="sm" disabled={page <= 1} onClick={() => f.set({ page: page - 1 > 1 ? String(page - 1) : null })}>{t('v8.audit.newer')}</Button>
            <span className="hg-small hg-muted">{t('v8.audit.pageOf', { page, pages })}</span>
            <Button size="sm" disabled={page >= pages} onClick={() => f.set({ page: String(page + 1) })}>{t('v8.audit.older')}</Button>
          </nav>
        )}
      </YCard>
      <p className="hg-subtle hg-xs mt-2">{t('audit.note')}</p>
    </div>
  );
}
