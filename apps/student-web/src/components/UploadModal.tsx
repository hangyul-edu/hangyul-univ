import { useApi } from '@hangyul/auth';
import { FileUp, Lock, Send } from '@hangyul/icons';
import { DOCUMENT_CATEGORIES, type DocumentCategory, type DossierReuse } from '@hangyul/types';
import { Button, Callout, CountrySelect, Field, Input, Modal, Select, useToast } from '@hangyul/ui';
import { ALLOWED_UPLOAD_TYPES, checkUpload, MAX_UPLOAD_MB } from '@hangyul/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { reasonText } from '../lib/dossier';
import { lc } from '../lib/workspace';
import { useT } from '../lib/i18n';
import { useCountries, useProfile } from '../lib/queries';
import { useDT } from './dossier/DossierParts';

const DOC_LANGS = ['en', 'ko', 'vi', 'zh', 'ja', 'mn', 'uz', 'ru', 'ne', 'id', 'th', 'other'];

export interface UploadTarget {
  category?: DocumentCategory;
  documentId?: string;
  title?: string;
  /** V5: answering a university request — offer "Send your existing …" when the dossier already holds a valid copy. */
  requestId?: string;
  applicationId?: string;
}

type Mode = 'ask' | 'form';

/**
 * Upload with duplicate minimisation (V5 dossier):
 * - answering a university request: send the existing copy when it is valid, or upload a newer copy that replaces it;
 * - a category the student already has: "Keep using it / Replace it / Add a different version", with the reason a new
 *   copy might be needed (e.g. a university that needs one issued within 30 days).
 */
// V28: an empty {{status}} (only VERIFIED/EXPIRED carry a word) must not leave "()", "“”" or "(doc, )" behind in any locale.
export function UploadModal({ open, onClose, target, onUploaded }: { open: boolean; onClose: () => void; target: UploadTarget; onUploaded?: (id: string) => void }) {
  const { t } = useT();
  const d = useDT();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const countries = useCountries();
  const profile = useProfile();
  const ids = { cat: useId(), title: useId(), file: useId(), issue: useId(), exp: useId(), lang: useId() };
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<DocumentCategory>(target.category ?? 'PASSPORT');
  const [title, setTitle] = useState(target.title ?? '');
  const [country, setCountry] = useState(profile.data?.nationality ?? '');
  const [issue, setIssue] = useState('');
  const [expires, setExpires] = useState('');
  const [language, setLanguage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [versionOf, setVersionOf] = useState<string | undefined>(target.documentId);
  const [decision, setDecision] = useState<'REPLACE' | 'ADD_VERSION' | null>(null);
  const [mode, setMode] = useState<Mode>('ask');
  const isVersion = !!versionOf;

  const reuse = useQuery({
    queryKey: ['dossier', 'reuse', category, target.requestId ?? null],
    queryFn: () => api.dossier.reuse({ category, request_id: target.requestId, application_id: target.applicationId }),
    enabled: open && !target.documentId && (!!target.requestId || !!category),
    staleTime: 15_000,
  });
  // Answering a request with "Upload a newer copy": the upload replaces the copy the university can't use (no duplicate).
  const newer = target.requestId && reuse.data?.request?.action === 'UPLOAD_NEWER' ? reuse.data.request.document?.id : undefined;
  useEffect(() => {
    if (newer && !target.documentId) { setVersionOf(newer); setDecision('REPLACE'); }
  }, [newer, target.documentId]);
  const invalidate = () => ['documents', 'document', 'dashboard', 'application', 'applications', 'dossier', 'package'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const m = useMutation({
    mutationFn: async () => {
      const doc = await api.documents.upload(file as File, {
        category, title: title.trim() || undefined, issuing_country: country || undefined, issue_date: issue || undefined,
        expires_on: expires || undefined, language: language && language !== 'other' ? language : undefined, document_id: versionOf,
      });
      // A new version keeps the document's details; the new copy's dates are recorded explicitly.
      if (versionOf && (issue || expires)) await api.documents.update(doc.id, { ...(issue ? { issue_date: issue } : {}), ...(expires ? { expires_on: expires } : {}) });
      if (decision) await api.dossier.decide({ category, decision, document_id: versionOf ?? doc.id, application_id: target.applicationId }).catch(() => undefined);
      return doc;
    },
    onSuccess: (doc) => {
      invalidate();
      toast.success(t('documents.upload.done'));
      onUploaded?.(doc.id);
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const send = useMutation({
    mutationFn: ({ rid, doc }: { rid: string; doc: string }) => api.dossier.sendExisting(rid, doc),
    onSuccess: () => {
      invalidate();
      toast.success(d.t('requests.sent', { university: reuse.data?.request?.university ?? '' }));
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const keep = useMutation({
    mutationFn: (docId: string) => api.dossier.decide({ category, decision: 'KEEP', document_id: docId, application_id: target.applicationId }),
    onSuccess: () => { toast.success(d.t('upload.kept', { doc: lc(d.t(`common:docCategory.${category}`)) })); invalidate(); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const pick = (f: File | null) => {
    setFile(f);
    setFileError(f ? checkUpload(f) : null);
  };

  const docWord = lc(d.t(`common:docCategory.${category}`));
  const prompt = mode === 'ask' ? promptFor(reuse.data, !!target.requestId, !!target.documentId) : null;
  const req = reuse.data?.request ?? null;
  const top = reuse.data?.existing?.[0];

  const footer = prompt ? null : (
    <>
      <Button variant="ghost" onClick={onClose}>{t('common:actions.cancel')}</Button>
      <Button variant="primary" icon={<FileUp />} disabled={!file || !!fileError} loading={m.isPending} onClick={() => m.mutate()}>{t('common:actions.upload')}</Button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} width={560} footer={footer}
      title={prompt === 'send' && req ? d.t('upload.sendTitle', { university: req.university, doc: docWord })
        : isVersion && req ? d.t('upload.newerTitle', { doc: docWord })
        : isVersion ? t('documents.upload.versionTitle') : t('documents.upload.title')}
      description={prompt ? undefined : t('documents.upload.subtitle')}>
      <div className="hg-stack">
        {prompt === 'send' && req?.document && (
          <div className="dz-ask">
            <p>{d.t('upload.sendText', { doc: docWord })}</p>
            <p className="dz-ask__doc">{req.document.title}{req.document.issue_date ? ` · ${d.fmt(req.document.issue_date)}` : ''}</p>
            <div className="dz-ask__actions">
              <Button variant="primary" icon={<Send />} loading={send.isPending} onClick={() => send.mutate({ rid: req.request_id, doc: req.document!.id })}>
                {d.t('requests.sendExisting', { doc: docWord })}
              </Button>
              <Button variant="ghost" onClick={() => { setDecision('ADD_VERSION'); setMode('form'); }}>{d.t('upload.orUpload')}</Button>
            </div>
          </div>
        )}
        {prompt === 'have' && top && (
          <div className="dz-ask">
            <p className="dz-ask__title">{top.used_by > 0 ? d.t('upload.haveTitle', { count: top.used_by, doc: docWord, status: d.t(`upload.status.${top.document.status}`, { defaultValue: '' }) }).replace(/,\s*([)）])/g, '$1').replace(/\(\s*\)|（\s*）|“\s*”|«\s*»|"\s*"/g, '').replace(/\s+/g, ' ').replace(/\s+([,.،])/g, '$1')
              : d.t('upload.haveNone', { doc: docWord })}</p>
            <p>{d.t('upload.question')}</p>
            {top.needs_new.slice(0, 2).map((n) => <p key={n.university} className="dz-finding dz-finding--warning">{d.t('upload.whyNew', { reason: reasonText(d.t, n.reason, d.fmt) })}</p>)}
            <div className="dz-ask__actions">
              <Button variant="secondary" loading={keep.isPending} onClick={() => keep.mutate(top.document.id)}>{d.t('upload.keep')}</Button>
              <Button variant="secondary" onClick={() => { setVersionOf(top.document.id); setDecision('REPLACE'); setMode('form'); }}>{d.t('upload.replace')}</Button>
              <Button variant="ghost" onClick={() => { setDecision('ADD_VERSION'); setMode('form'); }}>{d.t('upload.addVersion')}</Button>
            </div>
          </div>
        )}
        {!prompt && (
          <>
            {req && req.action === 'UPLOAD_NEWER' && isVersion && <Callout tone="warning">{reasonText(d.t, req.reason, d.fmt)}</Callout>}
            {isVersion && (() => {
              const replaced = [top?.document, req?.document].find((x) => x && x.id === versionOf);
              return replaced ? <p className="hg-small hg-muted">{d.t('upload.replacing', { title: replaced.title })}</p> : null;
            })()}
            <Field label={t('documents.upload.file')} htmlFor={ids.file} error={fileError ?? undefined} hint={t('documents.upload.fileHint', { mb: MAX_UPLOAD_MB })}>
              <label className="st-drop" htmlFor={ids.file} data-has={!!file}>
                <FileUp aria-hidden />
                <span className="hg-strong">{file ? file.name : t('documents.upload.choose')}</span>
                <span className="hg-subtle hg-xs">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : t('documents.upload.types')}</span>
                <input ref={fileRef} id={ids.file} type="file" accept={ALLOWED_UPLOAD_TYPES.join(',')} className="hg-sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
              </label>
            </Field>
            {isVersion ? (
              <div className="st-form-grid">
                <Field label={d.t('upload.issueDate')} htmlFor={ids.issue} optional>
                  <Input id={ids.issue} type="date" value={issue} onChange={(e) => setIssue(e.target.value)} />
                </Field>
                <Field label={t('documents.upload.expires')} htmlFor={ids.exp} optional>
                  <Input id={ids.exp} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
                </Field>
              </div>
            ) : (
              <div className="st-form-grid">
                <Field label={t('documents.upload.category')} htmlFor={ids.cat}>
                  <Select id={ids.cat} value={category} onChange={(e) => { setCategory(e.target.value as DocumentCategory); setMode('ask'); setDecision(null); }}>
                    {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`common:docCategory.${c}`)}</option>)}
                  </Select>
                </Field>
                <Field label={t('documents.upload.titleLabel')} htmlFor={ids.title} optional>
                  <Input id={ids.title} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t(`common:docCategory.${category}`)} />
                </Field>
                <Field label={t('documents.upload.country')} hint={t('documents.upload.countryHint')}>
                  <CountrySelect countries={countries.data ?? []} value={country} onChange={setCountry} label={t('documents.upload.country')} />
                </Field>
                <Field label={t('documents.upload.language')} htmlFor={ids.lang} optional>
                  <Select id={ids.lang} value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="">{t('common:form.selectPlaceholder')}</option>
                    {DOC_LANGS.map((l) => <option key={l} value={l}>{t(`documents.upload.langs.${l}`)}</option>)}
                  </Select>
                </Field>
                <Field label={t('documents.upload.issued')} htmlFor={ids.issue} optional>
                  <Input id={ids.issue} type="date" value={issue} onChange={(e) => setIssue(e.target.value)} />
                </Field>
                <Field label={t('documents.upload.expires')} htmlFor={ids.exp} optional>
                  <Input id={ids.exp} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
                </Field>
              </div>
            )}
            <Callout tone="neutral" icon={<Lock aria-hidden />}>{t('documents.privacy.short')}</Callout>
          </>
        )}
      </div>
    </Modal>
  );

  /** Which question to ask first; null = straight to the form. */
  function promptFor(r: DossierReuse | undefined, isRequest: boolean, explicitVersion: boolean): 'send' | 'have' | null {
    if (!r || explicitVersion) return null;
    if (isRequest) {
      const q = r.request;
      if (q?.action === 'SEND_EXISTING' && q.document) return 'send';
      return null;
    }
    const top = r.existing[0];
    return top && top.document.status !== 'NEEDS_CORRECTION' && top.document.status !== 'EXPIRED' ? 'have' : null;
  }
}
