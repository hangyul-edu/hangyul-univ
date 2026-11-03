import { useAuth } from '@hangyul/auth';
import { Download, ExternalLink, FileText, Lock } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { DOCUMENT_CATEGORIES, type VaultDocument } from '@hangyul/types';
import { Badge, Button, Callout, Card, DataTable, DescriptionList, Drawer, EmptyState, ErrorState, FilterSelect, Skeleton, useToast, type ColumnDef } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import { countryName, documentTone, formatDate, formatNumber } from '@hangyul/utils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { useUniversity } from '../lib/university';

function formatBytes(n: number | undefined, locale: string) {
  if (!n) return '—';
  if (n < 1024) return `${formatNumber(n, locale)} B`;
  if (n < 1024 * 1024) return `${formatNumber(Math.round(n / 102.4) / 10, locale)} KB`;
  return `${formatNumber(Math.round(n / 104857.6) / 10, locale)} MB`;
}

function Preview({ doc, onClose }: { doc: VaultDocument; onClose: () => void }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const { perms } = useUniversity();
  const toast = useToast();
  const url = useQuery({ queryKey: ['document', doc.id, 'inline-url'], queryFn: () => api.documents.downloadUrl(doc.id, 'inline'), staleTime: 240_000 });
  const detail = useQuery({ queryKey: ['document', doc.id], queryFn: () => api.documents.get(doc.id) });
  const download = async () => {
    try {
      const r = await api.documents.downloadUrl(doc.id, 'attachment');
      window.location.assign(r.url);
    } catch (e) { toast.error((e as Error).message); }
  };
  const isImage = doc.latest_file?.mime_type.startsWith('image/');
  return (
    <Drawer open onClose={onClose} title={doc.title} width={640}
      footer={<>
        {url.data && <a className="hg-btn" href={url.data.url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden /> {t('university:documents.openTab')}</a>}
        {perms.canDownloadDocs && <Button icon={<Download />} onClick={download}>{t('common:actions.download')}</Button>}
      </>}>
      <div className="hg-stack">
        <div className="uc-preview">
          {url.isLoading ? <Skeleton h={360} /> : url.isError ? <ErrorState compact error={url.error} /> : isImage
            ? <img src={url.data!.url} alt={doc.title} />
            : <iframe title={doc.title} src={url.data!.url} />}
        </div>
        <DescriptionList items={[
          { label: t('university:documents.student'), value: doc.owner_name ?? '—' },
          { label: t('university:documents.category'), value: t(`common:docCategory.${doc.category}`) },
          { label: t('university:documents.status'), value: <Badge size="sm" tone={documentTone[doc.status]}>{t(`common:docStatus.${doc.status}`)}</Badge> },
          { label: t('university:documents.issuing'), value: doc.issuing_country ? countryName(doc.issuing_country, locale) : '—' },
          { label: t('university:documents.issued'), value: formatDate(doc.issue_date, locale) },
          { label: t('university:documents.expires'), value: formatDate(doc.expires_on, locale) },
          { label: t('university:documents.legalization'), value: `${t(`common:legalization.${doc.legalization_path}`)} · ${t(`common:legalization.status.${doc.legalization_status}`)}` },
          { label: t('university:documents.file'), value: doc.latest_file ? `${doc.latest_file.filename} · ${formatBytes(doc.latest_file.size_bytes, locale)} · v${doc.current_version}` : '—' },
        ]} />
        {detail.data?.used_in_applications?.length ? (
          <div>
            <h3 className="uc-h3">{t('university:documents.usedIn')}</h3>
            <ul className="uc-list">
              {detail.data.used_in_applications.map((u) => (
                <li key={u.application_id}><Link to={`/applications/${u.application_id}`}>{t('university:documents.openApplication')}</Link></li>
              ))}
            </ul>
          </div>
        ) : null}
        {!perms.canDownloadDocs && <Callout tone="info" icon={<Lock aria-hidden />}>{t('university:documents.analystNote')}</Callout>}
      </div>
    </Drawer>
  );
}

export default function Documents() {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const { isHangyul, needsPick } = useUniversity();
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 20 });
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<VaultDocument | null>(null);
  const query = { page: page.pageIndex + 1, page_size: page.pageSize, category: category || undefined, status: status || undefined };
  const q = useQuery({ queryKey: ['documents', query], queryFn: () => api.documents.list(query), enabled: !isHangyul && !needsPick, placeholderData: keepPreviousData });

  const columns = useMemo<ColumnDef<VaultDocument, unknown>[]>(() => [
    { id: 'title', header: t('university:documents.document'), enableSorting: false, enableHiding: false, meta: { primary: true, label: t('university:documents.document') },
      cell: ({ row }) => <span className="hg-row" style={{ gap: 8 }}><FileText size={16} aria-hidden className="hg-subtle" /><span><span className="hg-strong" style={{ display: 'block' }}>{row.original.title}</span><span className="hg-xs hg-subtle">{t(`common:docCategory.${row.original.category}`)}</span></span></span> },
    { id: 'student', header: t('university:documents.student'), enableSorting: false, meta: { label: t('university:documents.student') }, cell: ({ row }) => row.original.owner_name ?? '—' },
    { id: 'country', header: t('university:documents.issuing'), enableSorting: false, meta: { label: t('university:documents.issuing'), hideOnMobile: true }, cell: ({ row }) => (row.original.issuing_country ? countryName(row.original.issuing_country, locale) : '—') },
    { id: 'status', header: t('university:documents.status'), enableSorting: false, meta: { label: t('university:documents.status') }, cell: ({ row }) => <Badge size="sm" tone={documentTone[row.original.status]}>{t(`common:docStatus.${row.original.status}`)}</Badge> },
    { id: 'legal', header: t('university:documents.legalization'), enableSorting: false, meta: { label: t('university:documents.legalization'), hideOnMobile: true }, cell: ({ row }) => t(`common:legalization.status.${row.original.legalization_status}`) },
    { id: 'updated', header: t('university:documents.updated'), enableSorting: false, meta: { label: t('university:documents.updated') }, cell: ({ row }) => <span>{formatDate(row.original.updated_at, locale)}</span> },
  ], [t, locale]);

  if (isHangyul) {
    return (
      <div className="hg-stack uc-page uv7">
        <PageHeader title={t('common:nav.documents')} sub={t('university:documents.subtitle')} />
        <Callout tone="info" title={t('university:documents.hangyulTitle')}>{t('university:documents.hangyulBody')}</Callout>
      </div>
    );
  }

  return (
    <div className="hg-stack uc-page uv7">
      <PageHeader title={t('common:nav.documents')} sub={t('university:documents.subtitle')} />
      <Callout tone="info" icon={<Lock aria-hidden />}>{t('university:documents.sharingRule')}</Callout>
      <Card>
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
          <DataTable<VaultDocument>
            columns={columns}
            data={q.data?.items ?? []}
            loading={q.isLoading}
            getRowId={(r) => r.id}
            onRowClick={setOpen}
            caption={t('common:nav.documents')}
            toolbar={<>
              <FilterSelect size="sm" label={t('university:documents.category')} value={category} onChange={(e) => { setCategory(e.target.value); setPage({ ...page, pageIndex: 0 }); }} style={{ inlineSize: 'auto' }}>
                <option value="">{t('university:documents.allCategories')}</option>
                {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`common:docCategory.${c}`)}</option>)}
              </FilterSelect>
              <FilterSelect size="sm" label={t('university:documents.status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage({ ...page, pageIndex: 0 }); }} style={{ inlineSize: 'auto' }}>
                <option value="">{t('university:documents.allStatuses')}</option>
                {['VERIFIED', 'NEEDS_REVIEW', 'UPLOADED', 'NEEDS_CORRECTION', 'EXPIRED'].map((s) => <option key={s} value={s}>{t(`common:docStatus.${s}`)}</option>)}
              </FilterSelect>
            </>}
            server={{ total: q.data?.total ?? 0, pagination: page, onPaginationChange: (u) => setPage(typeof u === 'function' ? u(page) : u) }}
            empty={<EmptyState compact icon={<FileText />} title={category || status ? t('common:states.noResults') : t('university:documents.empty')} text={t('university:documents.emptyText')} />}
          />
        )}
      </Card>
      {open && <Preview doc={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
