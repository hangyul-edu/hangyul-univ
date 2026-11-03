import { useApi } from '@hangyul/auth';
import { FileText, Lock, PenLine, Upload } from '@hangyul/icons';
import type { DocumentCategory, DossierRequestSuggestion, DossierRow } from '@hangyul/types';
import { Button, ButtonLink, EmptyState, QueryState, Section, SkeletonCard, useToast } from '@hangyul/ui';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { PageIntro } from '../components/bits';
import { DocumentDrawer } from '../components/DocumentDrawer';
import {
  DossierRowItem, PackageItem, RequestItem, SuggestionList, useDossier, useDossierInvalidate, useDT, WhoCanSee,
} from '../components/dossier/DossierParts';
import { UploadModal, type UploadTarget } from '../components/UploadModal';
import { needsCheck, type RowAction } from '../lib/dossier';

/**
 * PRIMARY QUESTION: "Which documents are ready, which need me, and who sees them?"
 * V5 Documents = the universal dossier. Every document once, with where it can be used ("Ready for 3 of 3 applications"),
 * plain-language notes from the automatic check, values to confirm, and each application's package.
 * Phone-first: one list, one action per row; details live in the drawer.
 */
export default function Documents() {
  const { t } = useDT();
  const api = useApi();
  const toast = useToast();
  const nav = useNavigate();
  const { hash } = useLocation();
  const [sp, setSp] = useSearchParams();
  const q = useDossier();
  const refresh = useDossierInvalidate();
  const [upload, setUpload] = useState<UploadTarget | null>(() => {
    const c = sp.get('upload');
    return c ? { category: c as DocumentCategory } : null;
  });
  const uploadParam = sp.get('upload');
  useEffect(() => { if (uploadParam) setUpload({ category: uploadParam as DocumentCategory }); }, [uploadParam]);
  useEffect(() => {
    if (hash && q.data) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash, q.data]);
  const docId = sp.get('doc');
  // V26 (REPORT §341): a task or notification about one requirement opens that row — scrolled to and marked.
  const focusCat = sp.get('focus');
  useEffect(() => {
    if (!focusCat || !q.data) return;
    const el = document.querySelector<HTMLElement>('.dz-page [data-focus="true"]');
    if (!el) return;
    if (el.closest('details') && !(el.closest('details') as HTMLDetailsElement).open) (el.closest('details') as HTMLDetailsElement).open = true;
    el.scrollIntoView({ behavior: 'auto', block: 'center' });
  }, [focusCat, q.data]);
  const setDoc = (id: string | null) => {
    const n = new URLSearchParams(sp);
    n.delete('upload');
    if (id) n.set('doc', id); else n.delete('doc');
    setSp(n, { replace: true });
  };
  const closeUpload = () => {
    setUpload(null);
    if (sp.has('upload')) { const n = new URLSearchParams(sp); n.delete('upload'); setSp(n, { replace: true }); }
  };
  // A request answered by a new upload is fulfilled with the uploaded document.
  const fulfil = useMutation({
    mutationFn: ({ rid, doc }: { rid: string; doc: string }) => api.applications.fulfillRequest(rid, doc),
    onSuccess: () => { refresh(); toast.success(t('student:ws3.request.sent')); },
    onError: (e) => toast.error((e as Error).message),
  });

  const onRow = (row: DossierRow, action: RowAction) => {
    if ((action === 'write' || !row.document) && row.essay) return nav(`/essays/${row.essay.id}`);
    if (action === 'upload' || action === 'uploadNewer' || (action === 'addTranslation' && !row.document)) return setUpload({ category: row.category });
    if (action === 'addTranslation' && row.document) return setUpload({ documentId: row.document.id, category: row.category, title: row.document.title });
    if (row.document) setDoc(row.document.id);
  };
  const onRequestUpload = (r: DossierRequestSuggestion) =>
    setUpload({ category: (r.category ?? 'OTHER') as DocumentCategory, title: r.label, requestId: r.request_id, applicationId: r.application_id });

  return (
    <div className="st-page dz-page">
      <PageIntro title={t('page.title')} subtitle={t('page.subtitle')}
        actions={<>
          {/* V22 (REPORT §248 S4): Essays left the More menu; Writing is reached from the documents it belongs with. */}
          <ButtonLink as={Link} to="/essays" variant="ghost" icon={<PenLine />}>{t('student:v22.home.writing')}</ButtonLink>
          <Button icon={<Upload />} onClick={() => setUpload({})}>{t('page.upload')}</Button>
        </>} />
      <QueryState query={q} skeleton={<SkeletonCard lines={6} />}>
        {(d) => {
          if (!d.rows.length && !d.requests.length) {
            return <EmptyState icon={<FileText />} title={t('page.empty')} text={t('page.emptyText')}
              action={<Button variant="primary" icon={<Upload />} onClick={() => setUpload({ category: 'PASSPORT' })}>{t('page.upload')}</Button>} />;
          }
          const by = (s: DossierRow['state']) => d.rows.filter((r) => r.state === s);
          const todo = by('todo'), review = by('review'), ready = by('ready'), extra = by('extra');
          const needed = todo.length + review.length + ready.length;
          const check = needsCheck(d.suggestions);
          return (
            <>
              {d.requests.length > 0 && (
                <Section title={t('group.requests')}>
                  <ul className="hg-panel dz-list">{d.requests.map((r, i) => <RequestItem key={r.request_id} r={r} onUpload={onRequestUpload} primary={i === 0} />)}</ul>
                </Section>
              )}
              {needed > 0 && (
                <p className="dz-summary">
                  <strong className="hg-num">{t('page.summary', { ready: ready.length, total: needed })}</strong>
                  <span>{todo.length ? t('page.needYou', { count: todo.length }) : t('page.allSet')}{review.length ? ` · ${t('page.inReview', { count: review.length })}` : ''}</span>
                </p>
              )}
              {todo.length > 0 && (
                <Section title={t('group.todo')}>
                  <ul className="hg-panel dz-list">{todo.map((r) => <DossierRowItem key={r.category} row={r} onAction={onRow} stateInHeading focused={r.category === focusCat} />)}</ul>
                </Section>
              )}
              {(check.length > 0 || d.counts.matching > 0) && (
                <Section title={t('check.title')} sub={t('check.sub')} id="check-section">
                  <SuggestionList items={check} matching={d.counts.matching} />
                </Section>
              )}
              {review.length > 0 && (
                <Section title={t('group.review')}>
                  <ul className="hg-panel dz-list">{review.map((r) => <DossierRowItem key={r.category} row={r} onAction={onRow} stateInHeading focused={r.category === focusCat} />)}</ul>
                </Section>
              )}
              {ready.length > 0 && (
                <Section title={t('group.ready')}>
                  {/* Progressive disclosure: while something needs the student, ready documents fold into one line. */}
                  <details className="dz-extra dz-ready" open={todo.length === 0 && review.length === 0}>
                    <summary>{t('group.readyCount', { count: ready.length })}</summary>
                    <ul className="hg-panel dz-list">{ready.map((r) => <DossierRowItem key={r.category} row={r} onAction={onRow} stateInHeading focused={r.category === focusCat} />)}</ul>
                  </details>
                </Section>
              )}
              {extra.length > 0 && (
                <details className="dz-extra">
                  <summary>{t('group.extraCount', { count: extra.length })}</summary>
                  <ul className="hg-panel dz-list">{extra.map((r) => <DossierRowItem key={r.category} row={r} onAction={onRow} stateInHeading focused={r.category === focusCat} />)}</ul>
                </details>
              )}
              {d.packages.length > 0 && (
                <Section title={t('package.title')} sub={t('package.sub')}>
                  <ul className="hg-panel dz-pkgs">{d.packages.map((p) => <PackageItem key={p.application.id} p={p} />)}</ul>
                </Section>
              )}
              <p className="dz-method">{t('page.method')}</p>
            </>
          );
        }}
      </QueryState>
      {/* V9 S4: who sees the documents — plain facts, one tap away (the drawer shows the same per document). */}
      <details className="v9-who-fold">
        <summary><Lock aria-hidden /> <span>{t('v9.who.foldTitle')}</span></summary>
        <WhoCanSee />
      </details>
      <DocumentDrawer id={docId} onClose={() => setDoc(null)} onNewVersion={(doc) => { setDoc(null); setUpload({ documentId: doc.id, category: doc.category, title: doc.title }); }} />
      {upload && (
        <UploadModal open onClose={closeUpload} target={upload}
          onUploaded={(id) => {
            if (upload.requestId) fulfil.mutate({ rid: upload.requestId, doc: id });
            else setDoc(id);
          }} />
      )}
    </div>
  );
}
