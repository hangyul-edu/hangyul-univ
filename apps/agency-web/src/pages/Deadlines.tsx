import { useAuth } from '@hangyul/auth';
import { CalendarClock, TriangleAlert } from '@hangyul/icons';
import { Badge, Card, EmptyState, QueryState, Segmented } from '@hangyul/ui';
import { cx, formatDate, formatDateTime, formatRelative } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link } from 'react-router';

import { Person, PriorityBadge, TaskTypeBadge, useT } from '../components/bits';
import { useUrlFilters } from '../lib/hooks';
import { groupBy, weekKey, taskTitle } from '../lib/logic';

const RANGES = ['7', '14', '30', '60', '90'] as const;

/** V8: a Tasks view (/tasks?view=deadlines; /deadlines redirects here). Every dated task and application step, by week. */
export function DeadlinesView() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const f = useUrlFilters(['days'] as const);
  const days = (RANGES as readonly string[]).includes(f.values.days) ? f.values.days : '30';
  const q = useQuery({ queryKey: ['agency', 'deadlines', Number(days)], queryFn: () => api.agency.deadlines(Number(days)) });
  const { overdue, weeks } = useMemo(() => {
    const items = q.data ?? [];
    return { overdue: items.filter((d) => d.overdue), weeks: groupBy(items.filter((d) => !d.overdue), (d) => weekKey(d.due_at)) };
  }, [q.data]);
  const thisWeek = weekKey(new Date().toISOString());

  const Row = ({ d }: { d: NonNullable<typeof q.data>[number] }) => (
    <li className={cx('ag-dl-item', d.overdue && 'is-overdue')}>
      <div className="ag-dl-item__date hg-num" title={formatDateTime(d.due_at, locale)}>
        <strong>{formatDate(d.due_at, locale, { month: 'short', day: 'numeric' })}</strong>
        <span className={d.overdue ? 'ag-overdue hg-xs' : 'hg-subtle hg-xs'}>{formatRelative(d.due_at, locale)}</span>
      </div>
      <div className="hg-grow" style={{ minWidth: 0 }}>
        <div className="hg-small hg-strong">{d.link ? <Link to={d.link}>{taskTitle(t, d)}</Link> : taskTitle(t, d)}</div>
        <div className="hg-row-wrap" style={{ '--hg-gap': '6px' } as React.CSSProperties}>
          <TaskTypeBadge type={d.task_type} />
          <PriorityBadge priority={d.priority} />
          {d.student && <Link to={`/students/${d.student.id}?tab=tasks`} className="hg-xs">{d.student.full_name}</Link>}
        </div>
      </div>
      <div className="ag-dl-item__owner"><Person name={d.owner?.full_name} size={22} /></div>
    </li>
  );

  return (
    <div className="hg-stack ag8-embed">
      <div className="ag8-embed__bar">
        <p className="hg-small hg-muted mb-0">{t('deadlinesPage.sub')}</p>
        <Segmented label={t('deadlinesPage.range')} value={days} onChange={(v) => f.set({ days: v === '30' ? null : v })}
          options={RANGES.map((r) => ({ value: r, label: t('dash.days', { count: Number(r) }) }))} />
      </div>
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState icon={<CalendarClock />} title={t('deadlinesPage.empty')} text={t('deadlinesPage.emptyText')} />}>
        {() => (
          <div className="hg-stack">
            {overdue.length > 0 && (
              <Card as="section" className="ag-dl-week is-overdue" aria-labelledby="dl-over">
                <h2 id="dl-over" className="ag-dl-week__head"><TriangleAlert aria-hidden size={16} /> {t('deadlinesPage.overdue')} <Badge size="sm" tone="danger">{overdue.length}</Badge></h2>
                <ul className="ag-dl-list">{overdue.map((d) => <Row key={d.id} d={d} />)}</ul>
              </Card>
            )}
            {weeks.map(([wk, items]) => (
              <Card as="section" key={wk} className="ag-dl-week" aria-labelledby={`dl-${wk}`}>
                <h2 id={`dl-${wk}`} className="ag-dl-week__head">
                  {wk === thisWeek ? t('deadlinesPage.thisWeek') : t('deadlinesPage.weekOf', { date: formatDate(wk, locale, { month: 'short', day: 'numeric' }) })}
                  <Badge size="sm">{items.length}</Badge>
                </h2>
                <ul className="ag-dl-list">{items.map((d) => <Row key={d.id} d={d} />)}</ul>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
