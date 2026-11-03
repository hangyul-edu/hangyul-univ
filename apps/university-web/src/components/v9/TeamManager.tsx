// V9 U8: a reviewer leaves → their open applicants are listed and handed over in the same step (admin). The API refuses to
// remove someone who still holds open applicants without a new reviewer, so no applicant is ever orphaned. Applicants
// whose reviewer lost access elsewhere are listed at the top with a one-step reassignment.
import { useAuth } from '@hangyul/auth';
import { useLocale } from '@hangyul/i18n';
import { Avatar, Button, Callout, Field, Input, Modal, Select, Skeleton, StatusText, useToast } from '@hangyul/ui';
import { formatNumber } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { handoverTargets, useOrphaned, type Assigned, type TeamMember } from '../../lib/v9';

function AssignedList({ items }: { items: Assigned[] }) {
  const { t } = useLocale(['university', 'common']);
  return (
    <ul className="uv9-preview">
      {items.map((a) => (
        <li key={a.id}><Link to={`/applications/${a.id}`} className="text-truncate">{a.student ?? '—'} · {a.program ?? ''}</Link><span className="text-muted flex-none">{t(`common:appStatus.${a.status}`)}</span></li>
      ))}
    </ul>
  );
}

function RemoveModal({ m, team, onClose }: { m: TeamMember; team: TeamMember[]; onClose: () => void }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const assigned = useQuery({ queryKey: ['university', 'member-assignments', m.user_id], queryFn: () => api.get<Assigned[]>(`/university/team/${m.user_id}/assignments`) });
  const targets = handoverTargets(team, m.user_id);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const n = assigned.data?.length ?? 0;
  const go = useMutation({
    mutationFn: () => api.post<{ reassigned: number }>(`/university/team/${m.user_id}/deactivate`, { reassign_to: to || null, note: note.trim() || null }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['university', 'team'] });
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['university', 'orphaned'] });
      toast.success(t('university:v9.team.removed', { name: m.full_name, count: r.reassigned }));
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const submit = () => { if (n > 0 && !to) { setErr('validation.required'); return; } setErr(null); go.mutate(); };
  return (
    <Modal open onClose={onClose} title={t('university:v9.team.removeTitle', { name: m.full_name })} description={t('university:v9.team.removeDesc')}
      footer={<><Button onClick={onClose}>{t('common:actions.cancel')}</Button><Button variant="danger" loading={go.isPending} disabled={assigned.isLoading} onClick={submit}>{n ? t('university:v9.team.removeAndMove', { count: n }) : t('university:v9.team.remove')}</Button></>}>
      <div className="hg-stack">
        {assigned.isLoading ? <Skeleton h={60} /> : n === 0 ? <p className="mb-0">{t('university:v9.team.noOpen')}</p> : (
          <>
            <p className="mb-0"><b>{t('university:v9.team.holds', { count: n, n: formatNumber(n) })}</b></p>
            <AssignedList items={assigned.data ?? []} />
            <Field label={t('university:v9.team.handTo')} htmlFor="rm-to" error={err ?? undefined}>
              <Select id="rm-to" value={to} onChange={(e) => setTo(e.target.value)} invalid={!!err}>
                <option value="">{t('university:v9.team.choose')}</option>
                {targets.map((x) => <option key={x.user_id} value={x.user_id}>{x.full_name}{x.open_assignments ? ` · ${t('university:v9.team.holdsShort', { count: x.open_assignments })}` : ''}</option>)}
              </Select>
            </Field>
          </>
        )}
        <Field label={t('university:v9.team.note')} htmlFor="rm-note" optional>
          <Input id="rm-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function Orphans({ team }: { team: TeamMember[] }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useOrphaned();
  const [to, setTo] = useState('');
  const go = useMutation({
    mutationFn: () => api.university.bulk('assign-reviewer', { ids: (q.data ?? []).map((a) => a.id), reviewer_id: to }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['university', 'orphaned'] }); qc.invalidateQueries({ queryKey: ['university', 'team'] }); toast.success(t('university:v9.team.orphansDone')); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!q.data?.length) return null;
  return (
    <Callout tone="warning" title={t('university:v9.team.orphans', { count: q.data.length })}>
      <AssignedList items={q.data} />
      <div className="d-flex flex-wrap gap-2 align-items-end mt-2">
        <Field label={t('university:v9.team.handTo')} htmlFor="orph-to">
          <Select id="orph-to" compact value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">{t('university:v9.team.choose')}</option>
            {handoverTargets(team, '').map((x) => <option key={x.user_id} value={x.user_id}>{x.full_name}</option>)}
          </Select>
        </Field>
        <Button size="sm" variant="primary" disabled={!to} loading={go.isPending} onClick={() => go.mutate()}>{t('university:v9.team.reassign')}</Button>
      </div>
    </Callout>
  );
}

export function TeamManager({ team, isAdmin, me }: { team: TeamMember[]; isAdmin: boolean; me?: string }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const restore = useMutation({
    mutationFn: (id: string) => api.post(`/university/team/${id}/reactivate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['university', 'team'] }); toast.success(t('university:v9.team.restored')); },
    onError: (e) => toast.error((e as Error).message),
  });
  const sorted = [...team].sort((a, b) => Number(b.is_active !== false) - Number(a.is_active !== false));
  return (
    <div className="hg-stack">
      {isAdmin && <Orphans team={team} />}
      <div className="uc-panel">
        {sorted.map((m) => {
          const active = m.is_active !== false;
          return (
            <div key={m.user_id} className="uv9-team__row" data-inactive={!active || undefined}>
              <span className="uv9-team__who">
                <Avatar name={m.full_name} size={28} />
                <span className="min-w-0">
                  <span className="hg-medium d-block">{m.full_name}{m.user_id === me && <span className="uc-sub"> · {t('university:settings.youShort')}</span>}</span>
                  <span className="uv9-team__meta">{m.title ?? ''}</span>
                </span>
              </span>
              <span className="uv9-team__meta">{active ? (m.open_assignments ? t('university:v9.team.holdsShort', { count: m.open_assignments }) : t('university:v9.team.holdsNone')) : <StatusText tone="neutral">{t('university:v9.team.inactive')}</StatusText>}</span>
              {isAdmin && m.user_id !== me && (active
                ? <Button size="sm" variant="ghost" onClick={() => setRemoving(m)}>{t('university:v9.team.remove')}</Button>
                : <Button size="sm" variant="ghost" loading={restore.isPending && restore.variables === m.user_id} onClick={() => restore.mutate(m.user_id)}>{t('university:v9.team.restore')}</Button>)}
            </div>
          );
        })}
      </div>
      {removing && <RemoveModal m={removing} team={team} onClose={() => setRemoving(null)} />}
    </div>
  );
}
