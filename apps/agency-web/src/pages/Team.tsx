// PRIMARY QUESTION: Who can sign in to this agency's console?
//
// V22 관리자 계정 / Administrator accounts (REPORT §246 A5, brief §55). The V9 operations console — roles, expertise,
// the weight table, capacity meters, "member leaves" — is gone from this screen. Every administrator has the same
// permissions, so what is left is a roster: name · email · status · last login, plus invite and disable/enable.
// Capacity, leave and weights stay in the API (the assignment engine still uses them); they are not a first screen.
import { useAuth } from '@hangyul/auth';
import type { AccountRow } from '@hangyul/api-client';
import { UserMinus, UserPlus, UserCheck } from '@hangyul/icons';
import { Button, Field, Input, Modal, QueryState, StatusText, useToast } from '@hangyul/ui';
import { PageHeader, YCard } from '@hangyul/ynex-ui';
import { formatDateTime, formatRelative } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useT } from '../components/bits';
import { usePerms } from '../lib/hooks';

/** Email + name → `POST /agency/team/invite`. On 201: "초대 메일을 보냈어요"; in development the code is console-only. */
export function InviteModal({ open, onClose, onInvite, title, sub, children, extraValid = true }: {
  open: boolean; onClose: () => void; title: string; sub: string;
  onInvite: (body: { email: string; full_name: string; locale: string }) => Promise<{ invite: { delivery: string } }>;
  /** Extra fields (the HQ university picker) rendered above email + name. */
  children?: React.ReactNode; extraValid?: boolean;
}) {
  const { t, locale } = useT();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<null | { delivery: string }>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setEmail(''); setName(''); setTouched(false); setDone(null); setError(null); } }, [open]);
  const valid = /.+@.+\..+/.test(email.trim()) && name.trim().length > 0 && extraValid;
  const m = useMutation({
    mutationFn: () => onInvite({ email: email.trim(), full_name: name.trim(), locale }),
    onSuccess: (r) => { setDone({ delivery: r.invite.delivery }); qc.invalidateQueries({ queryKey: ['accounts'] }); },
    onError: (e) => setError((e as Error).message),
  });
  return (
    <Modal open={open} onClose={onClose} title={title} description={done ? undefined : sub} width={480}
      footer={done
        ? <Button variant="primary" onClick={onClose}>{t('actions.done')}</Button>
        : <><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" loading={m.isPending} disabled={touched && !valid} onClick={() => { setTouched(true); if (valid) m.mutate(); }}>{t('v22.team.sendInvite')}</Button></>}>
      {done ? (
        <div className="hg-stack ag22-invited" role="status">
          <p className="hg-strong mb-0">{t('v22.team.sent')}</p>
          <p className="hg-small hg-muted mb-0">{t('v22.team.sentTo', { email: email.trim() })}</p>
          {done.delivery === 'console' && <p className="hg-xs hg-subtle mb-0" data-dev-note>{t('v22.team.devNote')}</p>}
          {done.delivery === 'failed' && <p className="hg-xs text-danger mb-0">{t('v22.team.mailFailed')}</p>}
        </div>
      ) : (
        <div className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties}>
          {children}
          <Field label={t('v22.team.email')} htmlFor="inv-email" error={touched && !/.+@.+\..+/.test(email.trim()) ? t('validation.email', { defaultValue: t('validation.required') }) : undefined}>
            <Input id="inv-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          </Field>
          <Field label={t('v22.team.name')} htmlFor="inv-name" error={touched && !name.trim() ? t('validation.required') : undefined}>
            <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </Field>
          {error && <p className="text-danger hg-small mb-0" role="alert">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

export function AccountStatus({ a }: { a: AccountRow }) {
  const { t } = useT();
  if (!a.active) return <StatusText tone="neutral">{t('v22.team.disabled')}</StatusText>;
  if (!a.email_verified && !a.last_login_at) return <StatusText tone="warning" hollow>{t('v22.team.unverified')}</StatusText>;
  return <StatusText tone="success">{t('v22.team.active')}</StatusText>;
}

export function LastLogin({ at }: { at: string | null }) {
  const { t, locale } = useT();
  if (!at) return <span className="hg-subtle">{t('v22.team.never')}</span>;
  return <time dateTime={at} title={formatDateTime(at, locale)} className="hg-nowrap">{formatRelative(at, locale)}</time>;
}

function DisableModal({ account, onClose }: { account: AccountRow | null; onClose: () => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState('');
  useEffect(() => { if (account) setReason(''); }, [account]);
  const m = useMutation({
    mutationFn: () => api.agency.deactivateMember(account!.user_id, { reason: reason.trim() || t('v22.team.disableReasonPh') }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['agency', 'team'] }); toast.success(t('actions.saved')); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open={!!account} onClose={onClose} title={account ? t('v22.team.disableTitle', { name: account.full_name }) : ''} width={460}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="danger" loading={m.isPending} onClick={() => m.mutate()}>{t('v22.team.disable')}</Button></>}>
      <div className="hg-stack">
        <p className="hg-small mb-0">{t('v22.team.disableText')}</p>
        <Field label={t('v22.team.disableReason')} htmlFor="dis-reason">
          <Input id="dis-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('v22.team.disableReasonPh')} maxLength={300} />
        </Field>
      </div>
    </Modal>
  );
}

export default function Team() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const perms = usePerms();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['accounts', 'agency'], queryFn: () => api.agency.accounts() });
  const [invite, setInvite] = useState(false);
  const [disabling, setDisabling] = useState<AccountRow | null>(null);
  const enable = useMutation({
    mutationFn: (id: string) => api.agency.reactivateMember(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['agency', 'team'] }); toast.success(t('actions.saved')); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="ag7 ag22-accounts">
      <PageHeader title={t('v22.team.title')} sub={t('v22.team.sub')}
        crumbs={[{ label: t('v11.manage.title'), to: '/manage' }, { label: t('v22.team.title') }]}
        actions={<Button variant="primary" icon={<UserPlus />} onClick={() => setInvite(true)}>{t('v22.team.invite')}</Button>} />
      <QueryState query={q}>
        {(d) => (
          <YCard flush title={d.organization.name} count={t('v22.team.count', { count: d.accounts.length })}>
            {d.accounts.length === 0 ? <p className="text-muted p-3 mb-0">{t('v22.team.empty')}</p> : (
              <div className="table-responsive">
                <table className="table table-hover mb-0 ag22-roster" aria-label={t('v22.team.title')}>
                  <thead>
                    <tr>
                      <th scope="col">{t('v22.team.name')}</th>
                      <th scope="col">{t('v22.team.email')}</th>
                      <th scope="col">{t('v22.team.status')}</th>
                      <th scope="col">{t('v22.team.lastLogin')}</th>
                      <th scope="col"><span className="hg-sr-only">{t('actions.menu')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.accounts.map((a) => {
                      const me = a.user_id === perms.userId;
                      return (
                        <tr key={a.user_id} data-active={a.active}>
                          <td className="fw-semibold">{a.full_name}{me && <span className="hg-subtle fw-normal"> · {t('v22.team.you')}</span>}</td>
                          <td><a href={`mailto:${a.email}`} className="ag-link-plain">{a.email}</a></td>
                          <td><AccountStatus a={a} /></td>
                          <td><LastLogin at={a.last_login_at} />{a.invited_at && !a.last_login_at && <span className="hg-subtle hg-xs d-block">{t('v22.team.unverified').split(' · ')[0]} {formatRelative(a.invited_at, locale)}</span>}</td>
                          <td className="text-end">
                            {!me && (a.active
                              ? <Button size="sm" variant="ghost" icon={<UserMinus />} onClick={() => setDisabling(a)}>{t('v22.team.disable')}</Button>
                              : <Button size="sm" variant="ghost" icon={<UserCheck />} loading={enable.isPending && enable.variables === a.user_id} onClick={() => enable.mutate(a.user_id)}>{t('v22.team.enable')}</Button>)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </YCard>
        )}
      </QueryState>
      <InviteModal open={invite} onClose={() => setInvite(false)} title={t('v22.team.invite')} sub={t('v22.team.inviteSub')} onInvite={(b) => api.agency.invite(b)} />
      <DisableModal account={disabling} onClose={() => setDisabling(null)} />
    </div>
  );
}
