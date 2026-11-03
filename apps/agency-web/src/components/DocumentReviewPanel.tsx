import { useAuth } from '@hangyul/auth';
import { Check, CheckCircle2, ExternalLink, FileText, RotateCcw, Stamp, X } from '@hangyul/icons';
import type { VaultDocument } from '@hangyul/types';
import { Badge, Button, Callout, DescriptionList, Field, QueryState, Skeleton, Textarea, useToast } from '@hangyul/ui';
import { formatDate, formatDateTime, formatNumber } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { useHotkeys } from '../lib/hooks';
import { fillTemplate, langOfCountry, useServerTemplates } from '../lib/templates';
import { appendReason, languageName, validateReview, type ReviewDecision } from '../lib/logic';
import { DocStatusBadge, Flag, Kbd, useT } from './bits';

/** Browsers without a built-in PDF viewer (many phones, locked-down desktops, headless) render a PDF frame blank. */
function canShowPdfInline() {
  if (typeof navigator === 'undefined') return true;
  const n = navigator as Navigator & { pdfViewerEnabled?: boolean };
  return n.pdfViewerEnabled !== false;
}

function Preview({ doc }: { doc: VaultDocument }) {
  const { api } = useAuth();
  const { t } = useT();
  const q = useQuery({
    queryKey: ['document', doc.id, 'url', doc.current_version],
    queryFn: () => api.documents.downloadUrl(doc.id, 'inline'),
    enabled: !!doc.latest_file,
    staleTime: 4 * 60_000,
    gcTime: 4 * 60_000,
  });
  if (!doc.latest_file) return <div className="ag-preview ag-preview--empty"><FileText aria-hidden /><span>{t('review.noFile')}</span></div>;
  if (q.isLoading) return <div className="ag-preview"><Skeleton h="100%" r={10} /></div>;
  if (q.isError || !q.data) return <div className="ag-preview ag-preview--empty"><span>{t('review.previewError')}</span><Button size="sm" onClick={() => q.refetch()}>{t('actions.retry')}</Button></div>;
  const { url, mime_type, filename } = q.data;
  const size = `${formatNumber(Math.max(1, Math.round((doc.latest_file.size_bytes ?? 0) / 1024)))} KB`;
  const inline = mime_type.startsWith('image/') ? 'image' : mime_type === 'application/pdf' && canShowPdfInline() ? 'pdf' : null;
  return (
    <div className="ag-preview-wrap">
      <div className="ag-preview">
        {inline === 'image' ? <img src={url} alt={t('review.previewAlt', { name: filename })} />
          : inline === 'pdf' ? <iframe src={`${url}#view=FitH`} title={t('review.previewAlt', { name: filename })} />
            : (
              <div className="ag-preview__fallback">
                <FileText aria-hidden className="ag-preview__icon" />
                <span className="ag-preview__file">{filename}</span>
                <span>{mime_type === 'application/pdf' ? t('review.noPdfViewer') : t('review.noInline')}</span>
                <div className="hg-row">
                  <Button size="sm" variant="secondary" icon={<ExternalLink />} onClick={() => window.open(url, '_blank', 'noopener')}>{t('review.openTab')}</Button>
                </div>
              </div>
            )}
      </div>
      <div className="ag-preview-meta" title={t('review.secureNote')}>
        <span className="hg-truncate">{filename} · v{doc.current_version} · {size}</span>
        {inline && <a href={url} target="_blank" rel="noreferrer noopener">{t('review.openTab')}<ExternalLink size={12} aria-hidden /></a>}
      </div>
    </div>
  );
}

function Legalization({ doc }: { doc: VaultDocument }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const info = doc.legalization;
  const m = useMutation({
    mutationFn: (progress: string[]) => api.documents.update(doc.id, { legalization_progress: progress }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['document', doc.id] }); toast.success(t('actions.saved')); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (doc.legalization_path === 'NONE' && !info) return null;
  const done = new Set(doc.legalization_progress);
  return (
    <div className="hg-stack" style={{ '--hg-gap': '8px' } as React.CSSProperties}>
      <div className="hg-row-wrap">
        <Badge size="sm" tone="warning" icon={<Stamp aria-hidden />}>{t(`legalization.${info?.path ?? doc.legalization_path}`)}</Badge>
        <Badge size="sm" tone={doc.legalization_status === 'COMPLETED' ? 'success' : 'neutral'}>{t(`legalization.status.${doc.legalization_status}`)}</Badge>
        {info?.verified_at && <span className="hg-subtle hg-xs">{t('freshness.verified', { date: formatDate(info.verified_at, locale) })}</span>}
      </div>
      {info?.steps?.length ? (
        <ul className="hg-list">
          {info.steps.map((s) => (
            <li key={s.key} className="hg-check-item" data-done={done.has(s.key)}>
              <button type="button" className="hg-check-item__box" role="checkbox" aria-checked={done.has(s.key)} aria-label={s.title} disabled={m.isPending}
                onClick={() => { const next = new Set(done); if (next.has(s.key)) next.delete(s.key); else next.add(s.key); m.mutate([...next]); }}>
                {done.has(s.key) && <Check aria-hidden />}
              </button>
              <span className="hg-grow"><span className="hg-small hg-strong">{s.title}</span>{s.detail && <span className="hg-subtle hg-xs" style={{ display: 'block' }}>{s.detail}</span>}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {info?.note && <p className="hg-subtle hg-xs">{info.note}</p>}
      {info?.source_url && <a href={info.source_url} target="_blank" rel="noreferrer noopener" className="hg-xs">{t('freshness.officialSource')}</a>}
    </div>
  );
}

const MAX_QUICK_REASONS = 6;

function checklistItems(doc: VaultDocument) {
  return ['legible', 'name', 'issuer', 'dates', ...(doc.legalization_path !== 'NONE' ? ['legalization'] : []), ...(doc.translation_required ? ['translation'] : [])];
}

/**
 * Checklist, then the decision. Verify is the primary action only once every check is ticked; before that it asks for an
 * explicit override (recorded with the review). Keys: 1–6 tick checks, V verify, C request changes, 1–6 pick a reason.
 */
function Decision({ doc, onDecided, hotkeys }: { doc: VaultDocument; onDecided?: (d: VaultDocument) => void; hotkeys?: boolean }) {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  // V9: correction texts in the student's language when a version exists (nationality → language).
  const templates = useServerTemplates(['DOCUMENT_CORRECTION', 'APOSTILLE'], langOfCountry((doc as { owner_nationality?: string | null }).owner_nationality));
  const items = checklistItems(doc);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ReviewDecision | 'OVERRIDE' | null>(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setDone(new Set()); setMode(null); setReason(''); setTouched(false); }, [doc.id]);
  const allChecked = done.size === items.length;
  const err = mode === 'NEEDS_CORRECTION' ? validateReview('NEEDS_CORRECTION', reason) : null;
  const toggle = (k: string) => setDone((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const m = useMutation({
    mutationFn: (d: ReviewDecision) => api.documents.review(doc.id, d, d === 'NEEDS_CORRECTION' ? reason.trim() : undefined,
      [...items.map((k) => ({ key: k, ok: done.has(k) })), ...(d === 'VERIFIED' && !allChecked ? [{ key: 'override', ok: true }] : [])]),
    onSuccess: (res, d) => {
      toast.success(d === 'VERIFIED' ? t('review.verified', { title: t(`docCategory.${doc.category}`) }) : t('review.returned', { title: t(`docCategory.${doc.category}`) }));
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document', doc.id] });
      qc.invalidateQueries({ queryKey: ['agency', 'student'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setMode(null); setReason(''); setTouched(false);
      onDecided?.(res);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const quick = templates.items.slice(0, MAX_QUICK_REASONS).map((tp) => ({ ...tp, text: fillTemplate(tp.body, { student_name: doc.owner_name, document: t(`docCategory.${doc.category}`), university: doc.used_in_applications?.length === 1 ? doc.used_in_applications[0].university : null }) }));
  const verify = () => { if (m.isPending) return; if (allChecked || mode === 'OVERRIDE') m.mutate('VERIFIED'); else setMode('OVERRIDE'); };
  const startCorrection = () => { setMode('NEEDS_CORRECTION'); setTimeout(() => ref.current?.focus(), 0); };
  const sendCorrection = () => { setTouched(true); if (!validateReview('NEEDS_CORRECTION', reason)) m.mutate('NEEDS_CORRECTION'); };
  const digit = (i: number) => () => {
    if (mode === 'NEEDS_CORRECTION') { const q = quick[i]; if (q) setReason((r) => appendReason(r, q.text)); } else if (items[i]) toggle(items[i]);
  };
  useHotkeys({ v: verify, c: startCorrection, 1: digit(0), 2: digit(1), 3: digit(2), 4: digit(3), 5: digit(4), 6: digit(5) }, !!hotkeys);

  const decided = doc.status === 'VERIFIED' || doc.status === 'NEEDS_CORRECTION';
  return (
    <div className="ag-decision">
      {decided && <Callout tone={doc.status === 'VERIFIED' ? 'success' : 'warning'} title={t(`docStatus.${doc.status}`)}>{doc.rejection_reason ?? t('review.alreadyDecided')}</Callout>}
      <section className="ag-verify" aria-labelledby={`vc-${doc.id}`}>
        <div className="hg-row hg-between">
          <h3 className="ag-h3" id={`vc-${doc.id}`} style={{ margin: 0 }}>{t('review.checklist')}</h3>
          <span className={allChecked ? 'hg-xs hg-num' : 'hg-subtle hg-xs hg-num'}>{t('review.checked', { n: done.size, total: items.length })}</span>
        </div>
        <ul className="ag-verify__list">
          {items.map((k, i) => (
            <li key={k}>
              <label className="ag-verify__item">
                <input type="checkbox" checked={done.has(k)} onChange={() => toggle(k)} />
                <span>{t(`review.check.${k}`, { path: t(`legalization.${doc.legalization_path}`) })}</span>
                {hotkeys && <Kbd>{i + 1}</Kbd>}
              </label>
            </li>
          ))}
        </ul>
      </section>
      {mode === 'OVERRIDE' ? (
        <div className="ag-override" role="alert">
          <span>{t('review.overrideText', { n: done.size, total: items.length })}</span>
          <div className="hg-row">
            <Button size="sm" variant="primary" icon={<CheckCircle2 />} loading={m.isPending} onClick={() => m.mutate('VERIFIED')}>{t('review.verifyAnyway')}{hotkeys && <Kbd>V</Kbd>}</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>{t('actions.cancel')}</Button>
          </div>
        </div>
      ) : mode !== 'NEEDS_CORRECTION' ? (
        <div className="ag-decision__buttons">
          <Button variant={allChecked ? 'primary' : 'secondary'} icon={<CheckCircle2 />} loading={m.isPending && m.variables === 'VERIFIED'} onClick={verify}
            title={allChecked ? undefined : t('review.verifyHint')}>
            {t('review.verify')}{hotkeys && <Kbd>V</Kbd>}
          </Button>
          <Button variant="secondary" icon={<RotateCcw />} onClick={startCorrection}>
            {t('review.requestChanges')}{hotkeys && <Kbd>C</Kbd>}
          </Button>
        </div>
      ) : (
        <div className="hg-stack" style={{ '--hg-gap': '10px' } as React.CSSProperties}>
          {quick.length > 0 && (
            <div>
              <div className="hg-label" style={{ marginBottom: 6 }}>{t('review.quickReasons')}</div>
              <div className="ag-reasons-quick">
                {quick.map((tp, i) => (
                  <button key={tp.id} type="button" aria-pressed={reason.includes(tp.text)} onClick={() => setReason((r) => appendReason(r, tp.text))} title={tp.text}>
                    {hotkeys && <Kbd>{i + 1}</Kbd>}<span className="hg-grow">{tp.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <Field label={t('review.reason')} htmlFor={`reason-${doc.id}`} error={touched && err ? t(err) : undefined} hint={t('review.reasonHintShort')}>
            <Textarea ref={ref} id={`reason-${doc.id}`} rows={4} value={reason} invalid={touched && !!err} maxLength={2000}
              onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendCorrection(); if (e.key === 'Escape') setMode(null); }} />
          </Field>
          <div className="hg-row" style={{ gap: 8 }}>
            <Button variant="danger" icon={<RotateCcw />} loading={m.isPending} onClick={sendCorrection}>{t('review.sendBack')}</Button>
            <Button variant="ghost" icon={<X />} onClick={() => setMode(null)}>{t('actions.cancel')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The malware-scan result, when there is one.
 *
 * V12: `SKIPPED` renders nothing. Development uses a no-op scanner that records `SKIPPED`, and V11 printed that
 * as "Not scanned (development)" on every document a reviewer opened — an engineering status on a working
 * screen (brief Part 17). Relabelling it would be worse: claiming a file was scanned when it was not is exactly
 * the "do not hide fake data as real data" failure. So the row is absent until a real scan has a real result,
 * and when production runs ClamAV the reviewer sees what it found.
 */
function scanText(status: string | null | undefined, t: (k: string) => string) {
  if (!status || status === 'SKIPPED') return null;
  return t(`review.scanStatus.${status}`);
}

/**
 * V7: file-manager.html anatomy — the preview is a YNEX card (title, owner, status, optional queue toolbar in its header),
 * requirement / checks / decision sit in a second card on the right. On the document queue page these become panes two and three.
 */
export function DocumentReviewPanel({ id, onDecided, hotkeys, toolbar }: { id: string; onDecided?: (d: VaultDocument) => void; hotkeys?: boolean; toolbar?: ReactNode }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const q = useQuery({ queryKey: ['document', id], queryFn: () => api.documents.get(id) });
  return (
    <QueryState query={q}>
      {(doc) => {
        const category = t(`docCategory.${doc.category}`);
        // The upload title usually repeats the category ("Bank balance certificate / Bank balance certificate"): show it only when it adds something.
        const distinctTitle = doc.title && doc.title.trim().toLowerCase() !== category.trim().toLowerCase() ? doc.title : null;
        const used = doc.used_in_applications?.length ?? 0;
        const details = [
          { label: t('review.issuingCountry'), value: doc.issuing_country ? <Flag code={doc.issuing_country} /> : null },
          { label: t('review.issued'), value: doc.issue_date ? formatDate(doc.issue_date, locale) : null },
          { label: t('review.expires'), value: doc.expires_on ? formatDate(doc.expires_on, locale) : null },
          { label: t('review.language'), value: languageName(doc.language, locale) },
          { label: t('review.translation'), value: doc.translation_required ? t('review.translationNeeded') : null },
          { label: t('review.uploaded'), value: doc.latest_file?.uploaded_at ? `${formatDateTime(doc.latest_file.uploaded_at, locale)}${doc.current_version > 1 ? ` · v${doc.current_version}` : ''}` : null },
          { label: t('review.scan'), value: scanText(doc.latest_file?.scan_status, t) },
        ].filter((x) => x.value);
        return (
          <div className="ag-review ag7-review">
            <section className="card custom-card ag-review__preview ag7-review__preview" aria-labelledby={`dr-${doc.id}`}>
              <div className="card-header justify-content-between gap-2 flex-wrap ag7-review__head">
                <div className="d-flex align-items-center gap-3 min-w-0">
                  <span className="avatar avatar-md bg-primary-transparent ag7-review__icon" aria-hidden><FileText /></span>
                  <div className="min-w-0">
                    <h2 className="fs-15 fw-semibold mb-0 text-truncate" id={`dr-${doc.id}`}>{category}</h2>
                    <div className="fs-12 text-muted text-truncate">
                      {doc.owner_name && <Link to={`/students/${doc.owner_user_id}?tab=documents`}>{doc.owner_name}</Link>}
                      {distinctTitle && <span> · {distinctTitle}</span>}
                      {used > 0 && <span> · {t('review.usedInN', { count: used })}</span>}
                    </div>
                  </div>
                  <DocStatusBadge status={doc.status} />
                </div>
                {toolbar}
              </div>
              <div className="card-body"><Preview doc={doc} /></div>
            </section>
            <aside className="card custom-card ag-review__side ag7-review__side" aria-label={t('review.checklist')}>
              <div className="card-body hg-stack">
              {<Decision doc={doc} onDecided={onDecided} hotkeys={hotkeys} />}
              <section className="ag-subsection">
                <h3 className="ag-h3">{t('review.metadata')}</h3>
                <DescriptionList items={details} />
              </section>
              {(doc.legalization_path !== 'NONE' || doc.legalization) && (
                <section className="ag-subsection">
                  <h3 className="ag-h3">{t('review.legalization')}</h3>
                  <Legalization doc={doc} />
                </section>
              )}
              {(doc.reviews ?? []).length > 0 && (
                <section className="ag-subsection">
                  <h3 className="ag-h3">{t('review.history')}</h3>
                  <ul className="hg-list">
                    {doc.reviews!.map((r, i) => (
                      <li key={i} style={{ padding: '8px 0' }}>
                        <div className="hg-row hg-between hg-small">
                          <strong>{r.decision === 'VERIFIED' ? t('docStatus.VERIFIED') : r.decision === 'NEEDS_CORRECTION' ? t('docStatus.NEEDS_CORRECTION') : t('review.precheck')}</strong>
                          <span className="hg-subtle hg-xs">v{r.version} · {formatDateTime(r.at, locale)}</span>
                        </div>
                        <div className="hg-subtle hg-xs">{r.reviewer}</div>
                        {r.reason && <div className="hg-small ag-quote">{r.reason}</div>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              </div>
            </aside>
          </div>
        );
      }}
    </QueryState>
  );
}
