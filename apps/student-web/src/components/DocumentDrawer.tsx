import { useApi } from '@hangyul/auth';
import { Check, Download, Eye, FileUp, History, Wrench } from '@hangyul/icons';
import type { VaultDocument } from '@hangyul/types';
import { Badge, Button, Callout, DescriptionList, Drawer, FreshnessBadge, QueryState, SkeletonCard, StatusText, useToast } from '@hangyul/ui';
import { countryName, documentTone, formatDate, formatDateTime } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { openSigned, reviewIsLate } from '../lib/format';
import { findingText, needsCheck, reasonText } from '../lib/dossier';
import { useT } from '../lib/i18n';
import { SuggestionList, useDossier, useDT, WhoCanSee } from './dossier/DossierParts';

export function LegalizationChecklist({ doc }: { doc: VaultDocument }) {
  const { t, locale } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const info = doc.legalization;
  const m = useMutation({
    mutationFn: (progress: string[]) => api.documents.update(doc.id, { legalization_progress: progress }),
    onMutate: (progress) => {
      qc.setQueryData<VaultDocument>(['document', doc.id], (d) => (d ? { ...d, legalization_progress: progress } : d));
    },
    onSuccess: (d) => {
      qc.setQueryData(['document', doc.id], (prev: VaultDocument | undefined) => ({ ...prev, ...d, legalization: prev?.legalization ?? d.legalization }));
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => { toast.error((e as Error).message); qc.invalidateQueries({ queryKey: ['document', doc.id] }); },
  });
  if (!info || doc.legalization_path === 'NONE' || !info.steps.length) return null;
  const done = new Set(doc.legalization_progress);
  const country = doc.issuing_country ? countryName(doc.issuing_country, locale) : t('legalFlow.yourCountry');
  // Step titles come from the API in English; outside English the translated title for the step key is shown.
  const title = (s: { key: string; title: string }) => (locale.startsWith('en') ? s.title : t(`legalFlow.step.${s.key}.title`, { country, defaultValue: s.title }));
  const note = info.note_code ? t(`legalFlow.note.${info.note_code}`, { country, date: info.note_params?.date ? formatDate(info.note_params.date, locale) : '', defaultValue: info.note ?? '' }) : info.note;
  return (
    <section className="st-drawer-sec lf">
      <div className="hg-row hg-between">
        <h3 className="hg-title-sm">{t('legalFlow.title', { path: t(`common:legalization.${info.path}`) })}</h3>
        <StatusText tone={doc.legalization_status === 'COMPLETED' ? 'success' : doc.legalization_status === 'IN_PROGRESS' ? 'info' : 'warning'}>{t(`common:legalization.status.${doc.legalization_status}`)}</StatusText>
      </div>
      <p className="hg-muted hg-small">{t(`legalFlow.intro.${info.path}`, { country, defaultValue: t('documents.legal.intro') })}</p>
      <ol className="lf-steps">
        {info.steps.map((s, i) => {
          const optional = s.key === 'notarize' && info.requires_notarization === false;
          const isDone = done.has(s.key);
          const prev = info.steps[i - 1];
          return (
            <li key={s.key} data-done={isDone || undefined}>
              <button type="button" className="lf-mark" role="checkbox" aria-checked={isDone} aria-label={t('legalFlow.markDone', { step: title(s) })}
                onClick={() => m.mutate(isDone ? [...done].filter((x) => x !== s.key) : [...done, s.key])}>
                {isDone ? <Check aria-hidden /> : <span className="hg-num">{i + 1}</span>}
              </button>
              <div className="lf-body">
                <div className="lf-title">{title(s)}{optional && <span className="hg-subtle"> · {t('legalFlow.onlyIfRequired')}</span>}</div>
                <dl className="lf-facts">
                  <div><dt>{t('legalFlow.where')}</dt><dd>{t(`legalFlow.step.${s.key}.where`, { country, defaultValue: '—' })}</dd></div>
                  <div><dt>{t('legalFlow.why')}</dt><dd>{t(`legalFlow.step.${s.key}.why`, { country, defaultValue: s.detail ?? '—' })}</dd></div>
                  {prev && <div><dt>{t('legalFlow.after')}</dt><dd>{title(prev)}</dd></div>}
                </dl>
              </div>
            </li>
          );
        })}
      </ol>
      {note && <Callout tone="info">{note}</Callout>}
      <FreshnessBadge data={{ source_url: info.source_url ?? null, verified_at: info.verified_at ?? null, verification_status: info.verification_status ?? (info.verified ? 'CURRENT' : null) }} />
    </section>
  );
}

export function DocumentDrawer({ id, onClose, onNewVersion }: { id: string | null; onClose: () => void; onNewVersion: (doc: VaultDocument) => void }) {
  const { t, locale } = useT();
  const api = useApi();
  const toast = useToast();
  const q = useQuery({ queryKey: ['document', id], queryFn: () => api.documents.get(id as string), enabled: !!id });
  const open = (docId: string, disposition: 'inline' | 'attachment', version?: number) =>
    openSigned(() => api.documents.downloadUrl(docId, disposition, version)).catch((e) => toast.error((e as Error).message));

  return (
    <Drawer open={!!id} onClose={onClose} width={520} title={q.data?.title ?? t('documents.drawer.title')}>
      <QueryState query={q} skeleton={<SkeletonCard lines={6} />}>
        {(d) => (
          <div className="hg-stack" style={{ '--hg-gap': '22px' } as React.CSSProperties}>
            <div className="hg-row-wrap">
              <Badge tone={documentTone[d.status]}>{t(`common:docStatus.${d.status}`)}</Badge>
              <Badge tone="neutral" outline>{t(`common:docCategory.${d.category}`)}</Badge>
              {d.reusable && <Badge tone="teal" size="sm">{t('documents.reusable')}</Badge>}
            </div>
            {d.status === 'NEEDS_CORRECTION' && (
              <Callout tone="danger" icon={<Wrench aria-hidden />} title={t('documents.drawer.fixTitle')}
                action={<Button size="sm" variant="primary" icon={<FileUp />} onClick={() => onNewVersion(d)}>{t('documents.drawer.uploadFixed')}</Button>}>
                <span data-user-content={d.rejection_reason ? true : undefined}>{d.rejection_reason ?? t('documents.drawer.fixDefault')}</span>
              </Callout>
            )}
            {d.status === 'EXPIRED' && <Callout tone="warning" title={t('documents.drawer.expired')}>{t('documents.drawer.expiredText')}</Callout>}
            {(d.status === 'NEEDS_REVIEW' || d.status === 'UPLOADED' || d.status === 'PROCESSING') && (reviewIsLate(d.updated_at)
              ? <Callout tone="warning" title={t('v4.review.lateShort')}>{t('v4.review.late')}</Callout>
              : <Callout tone="info">{t('documents.drawer.inReview')} {t('v4.review.usual')}.</Callout>)}
            <div className="hg-row-wrap">
              <Button size="sm" icon={<Eye />} disabled={!d.latest_file} onClick={() => open(d.id, 'inline')}>{t('common:actions.view')}</Button>
              <Button size="sm" variant="ghost" icon={<Download />} disabled={!d.latest_file} onClick={() => open(d.id, 'attachment')}>{t('common:actions.download')}</Button>
              {d.status !== 'NEEDS_CORRECTION' && <Button size="sm" variant="ghost" icon={<FileUp />} onClick={() => onNewVersion(d)}>{t('documents.drawer.newVersion')}</Button>}
            </div>
            <DescriptionList items={[
              { label: t('documents.drawer.country'), value: d.issuing_country ? countryName(d.issuing_country, locale) : '—' },
              { label: t('documents.drawer.issued'), value: formatDate(d.issue_date, locale) },
              { label: t('documents.drawer.expires'), value: formatDate(d.expires_on, locale) },
              { label: t('documents.drawer.translation'), value: d.translation_required ? t('documents.drawer.translationYes') : t('documents.drawer.translationNo') },
              { label: t('documents.drawer.file'), value: d.latest_file ? `${d.latest_file.filename} · ${(d.latest_file.size_bytes / 1024).toFixed(0)} KB` : '—' },
            ]} />
            <LegalizationChecklist doc={d} />
            <DossierDocSection docId={d.id} />
            {d.reviews && d.reviews.length > 0 && (
              <section className="st-drawer-sec">
                <h3 className="hg-title-sm">{t('documents.drawer.reviews')}</h3>
                <ul className="st-review-list">
                  {d.reviews.map((r, i) => (
                    <li key={i}>
                      <Badge size="sm" tone={r.decision === 'VERIFIED' ? 'success' : 'danger'}>{t(`common:docStatus.${r.decision}`, { defaultValue: r.decision })}</Badge>
                      <div className="hg-grow">
                        {r.reason && <p className="hg-small">{r.reason}</p>}
                        <span className="hg-subtle hg-xs">{t('documents.drawer.reviewMeta', { version: r.version, when: formatDateTime(r.at, locale) })}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="st-drawer-sec">
              <h3 className="hg-title-sm"><History size={16} aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('documents.drawer.versions')}</h3>
              <ul className="st-review-list">
                {[...d.versions].reverse().map((v) => (
                  <li key={v.version}>
                    <Badge size="sm" tone={v.version === d.current_version ? 'brand' : 'neutral'}>v{v.version}</Badge>
                    <div className="hg-grow" style={{ minWidth: 0 }}>
                      <div className="hg-small hg-truncate">{v.filename}</div>
                      <span className="hg-subtle hg-xs">{formatDateTime(v.uploaded_at, locale)}</span>
                    </div>
                    <Button size="sm" variant="ghost" iconOnly icon={<Eye />} aria-label={t('documents.drawer.viewVersion', { version: v.version })} onClick={() => open(d.id, 'inline', v.version)} />
                  </li>
                ))}
              </ul>
            </section>
            {/* V9 S4: "Who can see this?" replaces the generic privacy note with the facts of this document. */}
            <DocWho docId={d.id} />
          </div>
        )}
      </QueryState>
    </Drawer>
  );
}

function DocWho({ docId }: { docId: string }) {
  const q = useDossier();
  const row = q.data?.rows.find((r) => r.document?.id === docId || r.other_versions.some((o) => o.id === docId) || r.superseded.some((o) => o.id === docId));
  return <WhoCanSee row={row ?? null} />;
}

/** V5: where this document can be used (per application), notes from the automatic check, values found in the file. */
function DossierDocSection({ docId }: { docId: string }) {
  const { t, fmt } = useDT();
  const q = useDossier();
  const row = q.data?.rows.find((r) => r.document?.id === docId || r.other_versions.some((o) => o.id === docId) || r.superseded.some((o) => o.id === docId));
  if (!q.data || !row) return null;
  const uses = row.applications.filter((u) => u.document_id === docId || (row.document?.id === docId && !u.document_id));
  const findings = row.findings.filter((f) => f.document_id === docId);
  const sugs = needsCheck(q.data.suggestions.filter((s) => s.document_id === docId));
  const matching = q.data.suggestions.filter((s) => s.document_id === docId && s.status === 'SUGGESTED' && s.matches_profile).length;
  const TONE: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'neutral'> = { READY: 'success', NEAR_EXPIRY: 'warning', IN_REVIEW: 'info', MISSING: 'neutral' };
  return (
    <>
      <section className="st-drawer-sec">
        <h3 className="hg-title-sm">{t('drawer.where')}</h3>
        {uses.length ? (
          <ul className="dz-uses">
            {uses.map((u) => (
              <li key={`${u.application_id}-${u.requirement_id}`}>
                <StatusText tone={TONE[u.status] ?? 'danger'}>{u.university}{u.sent ? ` · ${t('drawer.sent')}` : ''}</StatusText>
                <span className="dz-uses__why">{reasonText(t, u.reason, fmt)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="hg-muted hg-small">{t('drawer.notNeeded')}</p>}
      </section>
      {findings.length > 0 && (
        <section className="st-drawer-sec">
          <h3 className="hg-title-sm">{t('drawer.notes')}</h3>
          {findings.map((f) => <p key={f.id} className={`dz-finding dz-finding--${f.severity === 'BLOCKER' ? 'danger' : f.severity === 'WARNING' ? 'warning' : 'neutral'}`}>{findingText(t, f, fmt)}</p>)}
        </section>
      )}
      {(sugs.length > 0 || matching > 0) && (
        <section className="st-drawer-sec">
          <h3 className="hg-title-sm">{t('check.title')}</h3>
          <SuggestionList items={sugs} matching={matching} />
        </section>
      )}
    </>
  );
}
