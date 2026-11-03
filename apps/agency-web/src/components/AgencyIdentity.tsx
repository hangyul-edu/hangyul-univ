// V9 (REPORT §59 A12): who is responsible for this applicant — the agency's legal identity, its registration status
// ("Not recorded" until a real registration is recorded), the responsible counselor and an optional sub-agent.
// Korea's announced Certificate-of-Admission agency field is a draft (H2-2026), shown as "announced", never as law.
import { useAuth } from '@hangyul/auth';
import type { AgencyIdentity } from '@hangyul/types';
import { Button, Input, useToast } from '@hangyul/ui';
import { YCard } from '@hangyul/ynex-ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { usePerms } from '../lib/hooks';
import { useT } from './bits';

export function AgencyIdentityCard({ studentId, identity }: { studentId: string; identity: AgencyIdentity | null | undefined }) {
  const { api } = useAuth();
  const { t } = useT();
  const perms = usePerms();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [sub, setSub] = useState(identity?.sub_agent ?? '');
  const m = useMutation({
    mutationFn: (name: string | null) => api.patch(`/agency/students/${studentId}/sub-agent`, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency'] }); setEditing(false); toast.success(t('actions.saved')); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!identity) return <YCard title={t('v9.identity.title')}><p className="text-muted fs-12 mb-0">{t('v9.identity.none')}</p></YCard>;
  const reg = identity.registration;
  const rows: [string, React.ReactNode][] = [
    [t('v9.identity.legal'), identity.legal_name ?? <span className="text-muted">{t('v9.identity.notRecorded')}</span>],
    [t('v9.identity.trading'), identity.trading_name],
    [t('v9.identity.registration'), reg.status === 'NOT_RECORDED' ? <span className="text-muted">{t('v9.identity.notRecorded')}</span>
      : <>{reg.number} · {reg.authority} <span className="badge bg-light text-muted">{t(`v9.identity.reg.${reg.status}`)}</span></>],
    [t('v9.identity.counselor'), identity.responsible_counselor?.name ?? <span className="text-muted">{t('misc.unassigned')}</span>],
    [t('v9.identity.subAgent'), editing ? (
      <span className="d-flex gap-2"><Input value={sub} onChange={(e) => setSub(e.target.value)} maxLength={200} aria-label={t('v9.identity.subAgent')} />
        <Button size="sm" variant="primary" loading={m.isPending} onClick={() => m.mutate(sub.trim() || null)}>{t('actions.save')}</Button></span>
    ) : (
      <span>{identity.sub_agent ?? <span className="text-muted">{t('v9.identity.noSub')}</span>}
        {!perms.isHangyul && <button type="button" className="btn btn-link btn-sm p-0 ms-2" onClick={() => { setSub(identity.sub_agent ?? ''); setEditing(true); }}>{t('actions.edit')}</button>}</span>
    )],
  ];
  return (
    <YCard title={t('v9.identity.title')}
      footer={<p className="text-muted fs-12 mb-0">{t('v9.identity.note')}</p>}>
      <dl className="ag9-kv mb-0">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </YCard>
  );
}
