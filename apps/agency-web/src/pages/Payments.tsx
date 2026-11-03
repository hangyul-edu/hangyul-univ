import type { ApiClient } from '@hangyul/api-client';
import { useAuth } from '@hangyul/auth';
import { FlaskConical } from '@hangyul/icons';
import { Callout, DataTable, EmptyState, Metrics, PageHeader, QueryState, Section, FilterSelect, StatusText, type ColumnDef } from '@hangyul/ui';
import { formatDateTime, formatMoney, formatNumber } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { Person, useT, kvCard } from '../components/bits';
import { useUrlFilters } from '../lib/hooks';
import { sumByCurrency } from '../lib/logic';

type Order = Awaited<ReturnType<ApiClient['agency']['orders']>>[number];
const statusTone = (s: string) => (s === 'PAID' ? 'success' : s === 'PENDING' ? 'warning' : s === 'REFUNDED' ? 'info' : s === 'FAILED' || s === 'CANCELLED' ? 'danger' : 'neutral');

export default function Payments() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const fs = useUrlFilters(['status'] as const);
  const status = fs.values.status;
  const setStatus = (v: string) => fs.set({ status: v || null });
  const q = useQuery({ queryKey: ['agency', 'orders'], queryFn: () => api.agency.orders() });
  const rows = useMemo(() => (q.data ?? []).filter((o) => !status || o.status === status), [q.data, status]);
  const statuses = useMemo(() => [...new Set((q.data ?? []).map((o) => o.status))], [q.data]);
  const byProduct = useMemo(() => {
    const m = new Map<string, { name: string; count: number; totals: Record<string, number> }>();
    for (const o of rows.filter((x) => x.status === 'PAID')) {
      const cur = m.get(o.product_code) ?? { name: o.product_name, count: 0, totals: {} };
      cur.count += 1;
      cur.totals[o.currency] = (cur.totals[o.currency] ?? 0) + o.amount_minor;
      m.set(o.product_code, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [rows]);
  const paidTotals = sumByCurrency(rows.filter((o) => o.status === 'PAID'), (o) => o.amount_minor, (o) => o.currency);
  const demoCount = rows.filter((o) => o.is_demo_payment).length;
  const money = (amount: number, cur: string) => formatMoney(amount, cur, locale, { minor: true });

  const cols: ColumnDef<Order>[] = [
    { id: 'student', accessorFn: (r) => r.student.full_name, header: t('misc.student'), meta: { primary: true, label: t('misc.student') }, cell: ({ row }) => <Person name={row.original.student.full_name} size={24} to={`/students/${row.original.student.id}`} /> },
    { id: 'product', accessorKey: 'product_name', header: t('payments.product'), meta: { label: t('payments.product') } },
    { id: 'amount', accessorFn: (r) => r.amount_minor, header: t('payments.amount'), meta: { numeric: true, label: t('payments.amount'), exportValue: (r) => money(r.amount_minor, r.currency) },
      cell: ({ row }) => <span className="hg-num">{money(row.original.amount_minor, row.original.currency)}</span> },
    { id: 'status', accessorKey: 'status', header: t('apps.col.status'), meta: { label: t('apps.col.status') },
      cell: ({ row }) => <span className="hg-row" style={{ gap: 8 }}><StatusText tone={statusTone(row.original.status)}>{t(`payments.status.${row.original.status}`, { defaultValue: row.original.status })}</StatusText></span> },
    { id: 'provider', accessorFn: (r) => r.provider ?? '', header: t('payments.provider'), meta: { label: t('payments.provider'), hideOnMobile: true } },
    { id: 'paid', accessorFn: (r) => r.paid_at ?? '', header: t('payments.paidAt'), meta: { label: t('payments.paidAt') }, cell: ({ row }) => <span className="hg-small">{formatDateTime(row.original.paid_at, locale)}</span> },
    { id: 'created', accessorKey: 'created_at', header: t('payments.created'), meta: { label: t('payments.created'), hideOnMobile: true }, cell: ({ getValue }) => <span className="hg-subtle hg-small">{formatDateTime(getValue<string>(), locale)}</span> },
  ];

  return (
    <div className="hg-stack ag-page">
      <PageHeader title={t('nav.payments')} subtitle={t('payments.sub')} />
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t('payments.empty')} />}>
        {() => (
          <>
            {demoCount > 0 && <Callout tone="warning" icon={<FlaskConical aria-hidden />} title={t('payments.demoTitle')}>{t('payments.demoText', { count: demoCount })}</Callout>}
            <Metrics items={[
              { label: t('payments.paidTotal'), value: Object.keys(paidTotals).length === 0 ? '—' : Object.entries(paidTotals).map(([cur, v]) => money(v, cur)).join(' + '),
                foot: t('payments.ordersN', { count: rows.filter((o) => o.status === 'PAID').length }) },
              ...byProduct.map(([, p]) => ({ label: p.name, value: formatNumber(p.count, locale), foot: Object.entries(p.totals).map(([c, v]) => money(v, c)).join(' + ') })),
            ]} />
            <Section title={t('payments.orders')}>
            <div className="hg-panel">
              <div className="ag-card-toolbar">
                <div className="ag-filterbar">
                  <FilterSelect size="sm" label={t('apps.col.status')} value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 200 }}>
                    <option value="">{t('apps.allStatuses')}</option>
                    {statuses.map((s) => <option key={s} value={s}>{t(`payments.status.${s}`, { defaultValue: s })}</option>)}
                  </FilterSelect>
                </div>
              </div>
              <DataTable dense columns={cols} data={rows} getRowId={(r) => r.id} exportName="payments" caption={t('nav.payments')} renderCard={kvCard((r: Order) => <Person name={r.student.full_name} size={24} to={`/students/${r.student.id}`} />, [
                [t('payments.product'), (r) => r.product_name], [t('payments.amount'), (r) => money(r.amount_minor, r.currency)],
                [t('apps.col.status'), (r) => <>{t(`payments.status.${r.status}`, { defaultValue: r.status })}</>],
                [t('payments.paidAt'), (r) => formatDateTime(r.paid_at, locale)]])} />
            </div>
            </Section>
            <p className="hg-subtle hg-xs">{t('payments.note')}</p>
          </>
        )}
      </QueryState>
    </div>
  );
}
