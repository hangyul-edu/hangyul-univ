// PRIMARY QUESTION: Which university admin can sign in, and to which university?
//
// V22 대학 계정 / University accounts (REPORT §247, §252.2) — Hangyul staff only. One roster across every partner
// university: university · admin user · email · status · last login · assigned university; invite (university picker +
// email + name), disable/enable, reassign. Every university administrator has the same permissions, so there is no
// role column here either.
import { localName } from '@hangyul/i18n';
import { useAuth } from '@hangyul/auth';
import type { UniversityAccount } from '@hangyul/api-client';
import { UserMinus, UserPlus, UserCheck } from '@hangyul/icons';
import { Button, EmptyState, Field, Modal, QueryState, Select, useToast } from '@hangyul/ui';
import { PageHeader, YCard } from '@hangyul/ynex-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';

import { SearchBox, useT } from '../../components/bits';
import { usePerms } from '../../lib/hooks';
import { AccountStatus, InviteModal, LastLogin } from '../Team';

function usePartnerUniversities() {
  const { api } = useAuth();
  return useQuery({ queryKey: ['catalog', 'universities', { partner_only: true, page_size: 100 }], queryFn: () => api.catalog.universities({ partner_only: true, page_size: 100 }), staleTime: 5 * 60_000 });
}

function UniversityPicker({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  const { t, locale } = useT();
  const unis = usePartnerUniversities();
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('v22.hq.accounts.pickUniversity')}>
      <option value="">{t('v22.hq.accounts.pickUniversityPh')}</option>
      {(unis.data?.items ?? []).map((u) => <option key={u.id} value={u.id}>{locale.startsWith('ko') ? u.name_ko : u.name_en}</option>)}
    </Select>
  );
}

function ReassignModal({ account, onClose }: { account: UniversityAccount | null; onClose: () => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [uni, setUni] = useState('');
  useEffect(() => { if (account) setUni(''); }, [account]);
  const m = useMutation({
    mutationFn: () => api.hq.reassignUniversityAccount(account!.user_id, uni),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); toast.success(t('actions.saved')); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open={!!account} onClose={onClose} title={account ? t('v22.hq.accounts.reassignTitle', { name: account.full_name }) : ''} width={460}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" disabled={!uni || uni === account?.university?.id} loading={m.isPending} onClick={() => m.mutate()}>{t('v22.hq.accounts.reassign')}</Button></>}>
      <div className="hg-stack">
        <p className="hg-small mb-0">{t('v22.hq.accounts.reassignText')}</p>
        <Field label={t('v22.hq.accounts.pickUniversity')} htmlFor="re-uni"><UniversityPicker id="re-uni" value={uni} onChange={setUni} /></Field>
      </div>
    </Modal>
  );
}

export default function HqAccounts() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const perms = usePerms();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['accounts', 'university'], queryFn: () => api.hq.universityAccounts(), enabled: perms.isHangyul });
  const [invite, setInvite] = useState(false);
  const [inviteUni, setInviteUni] = useState('');
  const [reassigning, setReassigning] = useState<UniversityAccount | null>(null);
  const [search, setSearch] = useState('');
  const toggle = useMutation({
    mutationFn: (a: UniversityAccount) => (a.active ? api.hq.disableUniversityAccount(a.user_id) : api.hq.enableUniversityAccount(a.user_id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); toast.success(t('actions.saved')); },
    onError: (e) => toast.error((e as Error).message),
  });
  const uniName = (a: UniversityAccount) => (a.university ? (locale.startsWith('ko') ? a.university.name_ko : localName(a.university)) : a.organization.name);
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    const all = q.data?.accounts ?? [];
    return s ? all.filter((a) => [a.full_name, a.email, uniName(a)].some((x) => x.toLowerCase().includes(s))) : all;
  }, [q.data, search, locale]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!perms.isHangyul) return <Navigate replace to="/" />;
  return (
    <div className="ag7 ag22-accounts">
      <PageHeader eyebrow={t('hq.context')} title={t('v22.hq.accounts.title')} sub={t('v22.hq.accounts.sub')}
        actions={<Button variant="primary" icon={<UserPlus />} onClick={() => { setInviteUni(''); setInvite(true); }}>{t('v22.hq.accounts.invite')}</Button>} />
      <QueryState query={q}>
        {(d) => (
          <YCard flush title={t('v22.hq.accounts.title')} count={d.accounts.length}
            tools={<SearchBox value={search} onChange={setSearch} placeholder={t('v22.hq.accounts.search')} label={t('actions.search')} />}>
            {d.accounts.length === 0 ? <EmptyState compact title={t('v22.hq.accounts.empty')} /> : (
              <div className="table-responsive">
                <table className="table table-hover mb-0 ag22-roster" aria-label={t('v22.hq.accounts.title')}>
                  <thead>
                    <tr>
                      <th scope="col">{t('v22.hq.accounts.university')}</th>
                      <th scope="col">{t('v22.hq.accounts.adminUser')}</th>
                      <th scope="col">{t('v22.team.email')}</th>
                      <th scope="col">{t('v22.team.status')}</th>
                      <th scope="col">{t('v22.team.lastLogin')}</th>
                      <th scope="col">{t('v22.hq.accounts.assigned')}</th>
                      <th scope="col"><span className="hg-sr-only">{t('actions.menu')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.user_id} data-active={a.active}>
                        <td className="fw-semibold ag22-roster__uni" title={uniName(a)}>{uniName(a)}</td>
                        <td>{a.full_name}</td>
                        <td className="ag22-roster__email"><a href={`mailto:${a.email}`} className="ag-link-plain" title={a.email}>{a.email}</a></td>
                        <td><AccountStatus a={a} /></td>
                        <td><LastLogin at={a.last_login_at} /></td>
                        <td>{a.university ? <span className="hg-nowrap">{a.university.slug}</span> : <span className="hg-subtle">{t('v22.hq.accounts.noUniversity')}</span>}</td>
                        <td className="text-end hg-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => setReassigning(a)}>{t('v22.hq.accounts.reassign')}</Button>
                          <Button size="sm" variant="ghost" iconOnly icon={a.active ? <UserMinus /> : <UserCheck />} aria-label={a.active ? t('v22.team.disable') : t('v22.team.enable')} title={a.active ? t('v22.team.disable') : t('v22.team.enable')}
                            loading={toggle.isPending && toggle.variables?.user_id === a.user_id} onClick={() => toggle.mutate(a)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </YCard>
        )}
      </QueryState>
      <InviteModal open={invite} onClose={() => setInvite(false)} title={t('v22.hq.accounts.invite')} sub={t('v22.team.inviteSub')} extraValid={!!inviteUni}
        onInvite={(b) => api.hq.inviteUniversityAccount({ ...b, university_id: inviteUni })}>
        <Field label={t('v22.hq.accounts.pickUniversity')} htmlFor="inv-uni"><UniversityPicker id="inv-uni" value={inviteUni} onChange={setInviteUni} /></Field>
      </InviteModal>
      <ReassignModal account={reassigning} onClose={() => setReassigning(null)} />
    </div>
  );
}
