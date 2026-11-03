import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Columns3, Download } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { downloadBlob, toCsv } from '@hangyul/utils';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Popover } from './overlays';
import { Button, Checkbox, Skeleton } from './primitives';
import { Select } from './select';

export type { ColumnDef } from '@tanstack/react-table';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    numeric?: boolean;
    /** Shown in the mobile card view (first `primary` column is the card title). */
    primary?: boolean;
    hideOnMobile?: boolean;
    exportValue?: (row: TData) => unknown;
    label?: string;
    /**
     * V8 responsive column priority: 1 = always shown; higher numbers drop first when the table's container is too
     * narrow (they move into the row's expandable details instead of making the table scroll sideways). Default 3.
     */
    priority?: number;
    /** Width the column needs to stay readable (px); used to decide what fits. Default 140. */
    minWidth?: number;
    /** V24: starts hidden; still in the column picker and the CSV export. */
    defaultHidden?: boolean;
  }
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  data: T[];
  loading?: boolean;
  empty?: ReactNode;
  getRowId?: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Server mode: parent owns pagination/sorting; pass total rows. */
  server?: { total: number; pagination: PaginationState; onPaginationChange: OnChangeFn<PaginationState>; sorting?: SortingState; onSortingChange?: OnChangeFn<SortingState> };
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
  toolbar?: ReactNode;
  exportName?: string;
  dense?: boolean;
  caption?: string;
  renderCard?: (row: T) => ReactNode;
  initialPageSize?: number;
  /** Rendered in place of the toolbar while rows are selected (Linear/Attio-style bulk bar). */
  bulkActions?: (ids: string[], clear: () => void) => ReactNode;
}

export function DataTable<T>({
  columns, data, loading, empty, getRowId, onRowClick, server, selectable, onSelectionChange, toolbar, exportName, dense, caption, renderCard, initialPageSize = 20, bulkActions,
}: DataTableProps<T>) {
  const { t } = useLocale('common');
  const [sorting, setSorting] = useState<SortingState>([]);
  // V24: a column can start hidden (`meta.defaultHidden`) and still be offered in the column picker and the CSV.
  const [visibility, setVisibility] = useState<VisibilityState>(() => Object.fromEntries(
    columns.filter((c) => c.meta?.defaultHidden).map((c) => [(c.id ?? (c as { accessorKey?: string }).accessorKey ?? '') as string, false]),
  ));
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: initialPageSize });
  // V8: measure the table's container and drop low-priority columns into row details instead of scrolling sideways.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapWidth, setWrapWidth] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWrapWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const colKey = (c: ColumnDef<T>) => (c.id ?? (c as { accessorKey?: string }).accessorKey ?? '') as string;
  // First guess from declared widths, then measured: if the rendered table is still wider than its container, the
  // lowest-priority visible column folds into the details row, one at a time, until it fits (priority 1 never folds).
  const estimate = useMemo(() => {
    if (!wrapWidth) return new Set<string>();
    const candidates = columns.map((c, i) => ({ id: colKey(c), i, pr: c.meta?.priority ?? (i === 0 ? 1 : 3), w: c.meta?.minWidth ?? 140 }))
      .filter((c) => c.id && visibility[c.id] !== false);
    let used = (selectable ? 44 : 0) + 48;
    const keep = new Set<string>();
    for (const c of [...candidates].sort((a, b) => a.pr - b.pr || a.i - b.i)) {
      if (c.pr <= 1 || used + c.w <= wrapWidth) { keep.add(c.id); used += c.w; }
    }
    return new Set(candidates.filter((c) => !keep.has(c.id)).map((c) => c.id));
  }, [columns, visibility, wrapWidth, selectable]); // eslint-disable-line react-hooks/exhaustive-deps
  const [autoHidden, setAutoHidden] = useState<Set<string>>(new Set());
  useEffect(() => { setAutoHidden(estimate); }, [estimate]);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const tableEl = wrap?.querySelector('table');
    if (!wrap || !tableEl || !wrapWidth || loading) return;
    if (tableEl.scrollWidth <= wrap.clientWidth + 2) return;
    const droppable = columns.map((c, i) => ({ id: colKey(c), i, pr: c.meta?.priority ?? (i === 0 ? 1 : 3) }))
      .filter((c) => c.id && c.pr > 1 && visibility[c.id] !== false && !autoHidden.has(c.id))
      .sort((a, b) => b.pr - a.pr || b.i - a.i);
    if (droppable.length) setAutoHidden((prev) => new Set([...prev, droppable[0].id]));
  });
  const effectiveVisibility = useMemo(() => {
    const v: VisibilityState = { ...visibility };
    autoHidden.forEach((id) => { v[id] = false; });
    return v;
  }, [visibility, autoHidden]);

  const selectCol: ColumnDef<T> = {
    id: '_select',
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <input type="checkbox" aria-label={t('table.selectAll')} checked={table.getIsAllPageRowsSelected()} onChange={table.getToggleAllPageRowsSelectedHandler()} onClick={(e) => e.stopPropagation()} />
    ),
    cell: ({ row }) => <input type="checkbox" aria-label={t('table.selectRow')} checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} onClick={(e) => e.stopPropagation()} />,
  };

  const table = useReactTable({
    data,
    columns: selectable ? [selectCol, ...columns] : columns,
    getRowId: getRowId as never,
    state: {
      sorting: server?.sorting ?? sorting,
      columnVisibility: effectiveVisibility,
      rowSelection: selection,
      pagination: server?.pagination ?? pagination,
    },
    onSortingChange: server?.onSortingChange ?? setSorting,
    onColumnVisibilityChange: (u) => setVisibility((prev) => (typeof u === 'function' ? u(prev) : u)),
    onRowSelectionChange: (u) => {
      const next = typeof u === 'function' ? u(selection) : u;
      setSelection(next);
      onSelectionChange?.(Object.keys(next).filter((k) => next[k]));
    },
    onPaginationChange: server?.onPaginationChange ?? setPagination,
    manualPagination: !!server,
    manualSorting: !!server?.onSortingChange,
    rowCount: server?.total,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: server ? undefined : getPaginationRowModel(),
    enableRowSelection: !!selectable,
  });

  const rows = table.getRowModel().rows;
  const total = server?.total ?? data.length;
  const pageCount = Math.max(1, table.getPageCount());
  const { pageIndex, pageSize } = table.getState().pagination;

  const exportCsv = () => {
    const cols = columns.filter((c) => c.id !== '_select');
    const out = data.map((row) => {
      const rec: Record<string, unknown> = {};
      cols.forEach((c) => {
        const key = (c.meta?.label ?? (typeof c.header === 'string' ? c.header : c.id ?? (c as { accessorKey?: string }).accessorKey)) as string;
        const accessor = (c as { accessorKey?: keyof T }).accessorKey;
        rec[key] = c.meta?.exportValue ? c.meta.exportValue(row) : accessor ? row[accessor] : (c as { accessorFn?: (r: T) => unknown }).accessorFn?.(row) ?? '';
      });
      return rec;
    });
    downloadBlob(new Blob([`﻿${toCsv(out)}`], { type: 'text/csv;charset=utf-8' }), `${exportName ?? 'export'}.csv`);
  };

  const selectedIds = Object.keys(selection).filter((k) => selection[k]);
  const clearSelection = () => { setSelection({}); onSelectionChange?.([]); };
  /** j/k or ↓/↑ move between clickable rows; Enter opens. */
  const rowKeys = (e: React.KeyboardEvent<HTMLTableRowElement>, open: () => void) => {
    const tr = e.currentTarget;
    if (e.key === 'Enter') { open(); return; }
    const next = e.key === 'ArrowDown' || e.key === 'j' ? tr.nextElementSibling : e.key === 'ArrowUp' || e.key === 'k' ? tr.previousElementSibling : null;
    if (next instanceof HTMLElement) { e.preventDefault(); next.focus(); }
  };

  const primaryCols = table.getVisibleLeafColumns().filter((c) => c.id !== '_select');
  const titleCol = primaryCols.find((c) => c.columnDef.meta?.primary) ?? primaryCols[0];

  return (
    <div>
      {bulkActions && selectedIds.length > 0 ? (
        <div className="hg-table-toolbar hg-table-bulk" role="toolbar" aria-label={t('table.selected', { count: selectedIds.length })}>
          <span className="hg-medium">{t('table.selected', { count: selectedIds.length })}</span>
          <div className="hg-row-wrap hg-grow">{bulkActions(selectedIds, clearSelection)}</div>
          <Button size="sm" variant="ghost" onClick={clearSelection}>{t('table.clearSelection')}</Button>
        </div>
      ) : (toolbar || exportName) && (
        <div className="hg-table-toolbar">
          <div className="hg-row-wrap hg-grow">{toolbar}</div>
          <Popover
            width={220}
            trigger={(p) => <Button size="sm" variant="ghost" icon={<Columns3 />} aria-label={t('table.columns')} {...p}><span className="hg-desktop-only">{t('table.columns')}</span></Button>}
          >
            <div style={{ padding: 8 }} className="hg-stack">
              {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
                <Checkbox key={c.id} label={(c.columnDef.meta?.label ?? (typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id)) as string}
                  checked={visibility[c.id] !== false} onChange={() => setVisibility((v) => ({ ...v, [c.id]: v[c.id] === false }))} />
              ))}
            </div>
          </Popover>
          {exportName && <Button size="sm" variant="ghost" icon={<Download />} aria-label={t('actions.exportCsv')} onClick={exportCsv}><span className="hg-desktop-only">{t('actions.exportCsv')}</span></Button>}
        </div>
      )}
      <div ref={wrapRef} className="hg-table-wrap" data-cards={renderCard || titleCol ? 'true' : 'false'}>
        <table className={`hg-table${dense ? ' hg-table--dense' : ''}`}>
          {caption && <caption className="hg-sr-only">{caption}</caption>}
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  return (
                    <th key={h.id} className={h.column.columnDef.meta?.numeric ? 'hg-table__num' : undefined} aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined} style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}>
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === 'asc' ? <ArrowUp size={13} /> : sorted === 'desc' ? <ArrowDown size={13} /> : <ArrowUpDown size={13} style={{ opacity: 0.35 }} />}
                        </button>
                      ) : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  );
                })}
                {autoHidden.size > 0 && <th className="hg-table__toggle"><span className="hg-sr-only">{t('table.details')}</span></th>}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{table.getVisibleLeafColumns().map((c) => <td key={c.id}><Skeleton h={14} w={c.id === '_select' ? 16 : '70%'} /></td>)}{autoHidden.size > 0 && <td />}</tr>
                ))
              : rows.map((row) => {
                  const open = !!expanded[row.id];
                  const hiddenCells = autoHidden.size ? row.getAllCells().filter((c) => autoHidden.has(c.column.id)) : [];
                  return (
                    <Fragment key={row.id}>
                      <tr data-clickable={!!onRowClick} data-selected={row.getIsSelected()} data-expanded={open || undefined} onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                        onKeyDown={onRowClick ? (e) => rowKeys(e, () => onRowClick(row.original)) : undefined} tabIndex={onRowClick ? 0 : undefined}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className={cell.column.columnDef.meta?.numeric ? 'hg-table__num' : undefined}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                        ))}
                        {autoHidden.size > 0 && (
                          <td className="hg-table__toggle">
                            <button type="button" className="hg-table__expand" aria-expanded={open} aria-label={open ? t('table.hideDetails') : t('table.showDetails')}
                              onClick={(e) => { e.stopPropagation(); setExpanded((x) => ({ ...x, [row.id]: !open })); }} onKeyDown={(e) => e.stopPropagation()}>
                              <ChevronDown aria-hidden />
                            </button>
                          </td>
                        )}
                      </tr>
                      {open && hiddenCells.length > 0 && (
                        <tr className="hg-table__details">
                          <td colSpan={row.getVisibleCells().length + 1}>
                            <dl>
                              {hiddenCells.map((cell) => (
                                <div key={cell.id}>
                                  <dt>{(cell.column.columnDef.meta?.label ?? (typeof cell.column.columnDef.header === 'string' ? cell.column.columnDef.header : cell.column.id)) as string}</dt>
                                  <dd>{flexRender(cell.column.columnDef.cell, cell.getContext())}</dd>
                                </div>
                              ))}
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
          </tbody>
        </table>
      </div>
      {/* Mobile: tables transform into cards */}
      <div className="hg-rows" data-cards={renderCard || titleCol ? 'true' : 'false'}>
        {!loading && rows.map((row) => (
          renderCard ? (
            <div key={row.id} onClick={onRowClick ? () => onRowClick(row.original) : undefined} tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row.original); } } : undefined}
              className="hg-rowcard">
              {renderCard(row.original)}
            </div>
          ) : (
            // The card holds links and buttons of its own, so it is a focusable container, not role="button" (nested-interactive).
            <div key={row.id} className="hg-rowcard" tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row.original); } } : undefined}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
              {row.getVisibleCells().filter((c) => c.column.id !== '_select' && !c.column.columnDef.meta?.hideOnMobile).map((cell, i) => (
                cell.column.id === titleCol?.id || i === 0 ? (
                  <div key={cell.id} className="hg-strong">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                ) : (
                  <div key={cell.id} className="hg-rowcard__kv">
                    <span>{(cell.column.columnDef.meta?.label ?? (typeof cell.column.columnDef.header === 'string' ? cell.column.columnDef.header : '')) as string}</span>
                    <span>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
                  </div>
                )
              ))}
            </div>
          )
        ))}
      </div>
      {!loading && rows.length === 0 && (empty ?? <div className="hg-state hg-state--compact"><div className="hg-state__title">{t('states.noResults')}</div></div>)}
      {total > Math.min(pageSize, 10) && (
        <div className="hg-table-foot">
          <span>{t('table.results', { count: total })}</span>
          <div className="hg-row" style={{ gap: 8 }}>
            <Select compact aria-label={t('table.rowsPerPage')} value={pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))} style={{ width: 84 }}>
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
            <span className="hg-num">{t('table.pageOf', { page: pageIndex + 1, pages: pageCount })}</span>
            <Button size="sm" iconOnly variant="ghost" icon={<ChevronLeft className="hg-flip-rtl" />} onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label={t('table.previous')} />
            <Button size="sm" iconOnly variant="ghost" icon={<ChevronRight className="hg-flip-rtl" />} onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label={t('table.next')} />
          </div>
        </div>
      )}
    </div>
  );
}
