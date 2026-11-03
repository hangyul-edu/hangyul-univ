import { useApi, useAuth } from '@hangyul/auth';
import { translationQuality } from '@hangyul/i18n';
import { Download, Eye, LogOut, Trash2 } from '@hangyul/icons';
import { Badge, Button, Callout, ErrorState, Field, Input, LocaleSelector, Modal, Skeleton, Switch, Textarea, useToast } from '@hangyul/ui';
import { formatDate } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { PageIntro } from '../components/bits';
import { useT } from '../lib/i18n';

/** Settings read as sections: what it is on the left, the controls on the right — no stack of boxes. */
function SettingsSection({ title, sub, children, id }: { title: string; sub?: string; children: React.ReactNode; id?: string }) {
  return (
    <section className="sset-sec" id={id}>
      <div className="sset-head"><h2 className="hg-title-sm">{title}</h2>{sub && <p className="hg-small hg-muted">{sub}</p>}</div>
      <div className="sset-body">{children}</div>
    </section>
  );
}

const PURPOSES = ['SHARE_WITH_AGENCY', 'SHARE_WITH_UNIVERSITY', 'CROSS_BORDER_TRANSFER', 'OUTCOME_RESEARCH', 'MARKETING'] as const;

function Account() {
  const { t } = useT();
  const { session } = useAuth();
  const api = useApi();
  const toast = useToast();
  const [full, setFull] = useState(session?.user.full_name ?? '');
  const [pref, setPref] = useState(session?.user.preferred_name ?? '');
  const m = useMutation({
    mutationFn: () => api.me.updateProfile({ full_name: full.trim(), preferred_name: pref.trim() || null }),
    onSuccess: () => toast.success(t('settings.account.saved')),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <SettingsSection title={t('settings.account.title')}>
        <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="st-form-grid">
            <Field label={t('common:auth.fullName')} htmlFor="s-full" hint={t('settings.account.fullHint')}><Input id="s-full" value={full} onChange={(e) => setFull(e.target.value)} autoComplete="name" /></Field>
            <Field label={t('settings.account.preferred')} htmlFor="s-pref" optional hint={t('settings.account.preferredHint')}><Input id="s-pref" value={pref} onChange={(e) => setPref(e.target.value)} /></Field>
          </div>
          <Field label={t('common:auth.email')} htmlFor="s-email"><Input id="s-email" value={session?.user.email ?? ''} disabled readOnly /></Field>
          <div><Button type="submit" loading={m.isPending} disabled={!full.trim()}>{t('common:actions.save')}</Button></div>
        </form>
    </SettingsSection>
  );
}

function Language() {
  const { t, locale } = useT();
  const api = useApi();
  const q = translationQuality(locale, 'student');
  return (
    <SettingsSection title={t('settings.language.title')} sub={t('settings.language.subtitle')}>
        <div className="hg-row-wrap">
          <LocaleSelector onChange={(code) => { api.me.updateProfile({ locale: code }).catch(() => undefined); }} />
          <span className="hg-subtle hg-xs">{t('settings.language.note')}</span>
        </div>
        <p className="hg-small hg-muted">{t(`settingsV3.translation.${q.status}`, { percent: q.coverage })}</p>
    </SettingsSection>
  );
}

function Privacy() {
  const { t, locale } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['consents'], queryFn: () => api.me.consents() });
  const m = useMutation({
    mutationFn: ({ purpose, granted }: { purpose: string; granted: boolean }) => api.me.setConsent(purpose, granted),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['consents'] }); toast.success(t('settings.privacy.saved')); },
    onError: (e) => toast.error((e as Error).message),
  });
  const granted = (p: string) => {
    if (m.isPending && m.variables?.purpose === p) return m.variables.granted;
    return q.data?.find((c) => c.purpose === p)?.granted ?? false;
  };
  return (
    <SettingsSection id="privacy" title={t('settings.privacy.title')} sub={t('settings.privacy.subtitle')}>
        {/* V9 S3: family links are a consent too — managed (and turned off) on their own page. */}
        <p className="hg-small"><Link to="/family" className="hg-link-arrow">{t('v9.family.settingsLink')}</Link></p>
        {q.isLoading ? <Skeleton h={120} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
          <ul className="st-consents">
            {PURPOSES.map((p) => {
              const rec = q.data?.find((c) => c.purpose === p);
              return (
                <li key={p}>
                  <div className="hg-grow">
                    <div className="hg-strong hg-small">{t(`settings.privacy.purpose.${p}.title`)}</div>
                    <div className="hg-muted hg-xs">{t(`settings.privacy.purpose.${p}.text`)}</div>
                    {rec && <div className="hg-subtle hg-xs">{t('settings.privacy.updated', { date: formatDate(rec.at, locale), version: rec.version })}</div>}
                  </div>
                  <Switch checked={granted(p)} onChange={(v) => m.mutate({ purpose: p, granted: v })} label={t(`settings.privacy.purpose.${p}.title`)} />
                </li>
              );
            })}
          </ul>
        )}
        <Callout tone="neutral" icon={<Eye aria-hidden />} title={t('settings.privacy.whoTitle')}>
          <ul className="st-bullets">
            <li>{t('settings.privacy.who.you')}</li>
            <li>{t('settings.privacy.who.agency')}</li>
            <li>{t('settings.privacy.who.university')}</li>
            <li>{t('settings.privacy.who.hangyul')}</li>
          </ul>
        </Callout>
    </SettingsSection>
  );
}

function DataRequests() {
  const { t, locale } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [note, setNote] = useState('');
  const q = useQuery({ queryKey: ['data-requests'], queryFn: () => api.me.dataRequests() });
  const m = useMutation({
    mutationFn: (kind: 'EXPORT' | 'DELETE') => api.me.dataRequest(kind, note.trim() || undefined),
    onSuccess: (r, kind) => {
      qc.invalidateQueries({ queryKey: ['data-requests'] });
      toast.success(t(`settings.data.done.${kind}`, { date: formatDate(r.due_at, locale) }));
      setConfirmDelete(false);
      setNote('');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <SettingsSection title={t('settings.data.title')} sub={t('settings.data.subtitle')}>
        <div className="hg-row-wrap">
          <Button icon={<Download />} loading={m.isPending && m.variables === 'EXPORT'} onClick={() => m.mutate('EXPORT')}>{t('settings.data.export')}</Button>
          <Button variant="ghost" className="st-danger-text" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>{t('settings.data.delete')}</Button>
        </div>
        {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {(q.data ?? []).length > 0 && (
          <ul className="st-mini-list" style={{ marginTop: 14 }}>
            {(q.data ?? []).map((r) => (
              <li key={r.id} className="hg-row hg-between hg-small">
                <span>{t(`settings.data.kind.${r.kind}`, { defaultValue: r.kind })} · {formatDate(r.created_at, locale)}</span>
                <span className="hg-row" style={{ '--hg-gap': '6px' } as React.CSSProperties}><Badge size="sm" tone="info">{t(`settings.data.status.${r.status}`, { defaultValue: r.status })}</Badge><span className="hg-subtle hg-xs">{t('settings.data.due', { date: formatDate(r.due_at, locale) })}</span></span>
              </li>
            ))}
          </ul>
        )}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('settings.data.confirmTitle')}
        footer={<><Button variant="ghost" onClick={() => setConfirmDelete(false)}>{t('common:actions.cancel')}</Button><Button variant="danger" loading={m.isPending} onClick={() => m.mutate('DELETE')}>{t('settings.data.confirm')}</Button></>}>
        <div className="hg-stack">
          <p>{t('settings.data.confirmText')}</p>
          <Field label={t('settings.data.note')} htmlFor="del-note" optional><Textarea id="del-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
      </Modal>
    </SettingsSection>
  );
}

export default function Settings() {
  const { t } = useT();
  const { logout } = useAuth();
  return (
    <div className="st-page">
      <PageIntro title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="st-settings">
        <Account />
        <Language />
        <Privacy />
        <DataRequests />
        <SettingsSection title={t('settings.sessions.title')} sub={t('settings.sessions.text')}>
          <div><Button icon={<LogOut />} onClick={() => logout()}>{t('common:actions.signOut')}</Button></div>
        </SettingsSection>
      </div>
    </div>
  );
}
