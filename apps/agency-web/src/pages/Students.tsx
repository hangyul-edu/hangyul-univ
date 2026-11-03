// PRIMARY QUESTION: Where is every student, and what is each one waiting on?
//
// V22 Students (REPORT §249 G1/G3, brief §53): the same strip + toolbar + table grammar as Today (components/Caseload),
// with full paging and sortable columns. The ten V8 "views" are a toolbar filter, not a tab row; the counselor column
// is gone (every administrator is the team) and intake is a filter. Bulk actions stay: stage, owner (internal
// accountability field, 담당자), task regeneration.
import { useAuth } from '@hangyul/auth';
import { RefreshCw, UserCheck } from '@hangyul/icons';
import { PIPELINE_STAGES, type AgencySavedView, type PipelineStage } from '@hangyul/types';
import { Button, Field, Input, Modal, Segmented, Select, useToast } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useT } from '../components/bits';
import { Caseload } from '../components/Caseload';
import { useTeam } from '../lib/hooks';

export { useCountries } from '../components/Caseload';

function BulkActions({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const team = useTeam();
  const qc = useQueryClient();
  const toast = useToast();
  const [stage, setStage] = useState<PipelineStage | ''>('');
  const [owner, setOwner] = useState('');
  const [confirm, setConfirm] = useState<null | 'SET_STAGE' | 'ASSIGN_COUNSELOR' | 'REGENERATE_TASKS'>(null);
  const m = useMutation({
    mutationFn: (action: 'SET_STAGE' | 'ASSIGN_COUNSELOR' | 'REGENERATE_TASKS') =>
      api.agency.bulk({ student_ids: ids, action, stage: stage || undefined, counselor_id: owner || undefined }),
    onSuccess: (r) => {
      toast.success(t('students.bulk.done', { count: r.updated }));
      qc.invalidateQueries({ queryKey: ['agency'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setConfirm(null);
      onDone();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  // Every active administrator can own a case (REPORT §246 A1: `counselor_user_id` is accountability, not visibility).
  const owners = (team.data?.members ?? []).filter((mbr) => mbr.active);
  return (
    <>
      <div className="ag-bulkbar__group">
        <Select compact aria-label={t('students.bulk.stage')} value={stage} onChange={(e) => setStage(e.target.value as PipelineStage)}>
          <option value="">{t('students.bulk.stage')}</option>
          {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{t(`pipeline.${s}`)}</option>)}
        </Select>
        <Button size="sm" disabled={!stage} onClick={() => setConfirm('SET_STAGE')}>{t('actions.apply')}</Button>
      </div>
      <div className="ag-bulkbar__group">
        <Select compact aria-label={t('v22.work.owner')} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">{t('v22.work.bulkOwner')}</option>
          {owners.map((c) => <option key={c.user_id} value={c.user_id}>{c.full_name}</option>)}
        </Select>
        <Button size="sm" icon={<UserCheck />} disabled={!owner} onClick={() => setConfirm('ASSIGN_COUNSELOR')}>{t('actions.assign')}</Button>
      </div>
      <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => setConfirm('REGENERATE_TASKS')}>{t('students.bulk.regen')}</Button>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={t('students.bulk.confirmTitle')}
        footer={<>
          <Button onClick={() => setConfirm(null)}>{t('actions.cancel')}</Button>
          <Button variant="primary" loading={m.isPending} onClick={() => confirm && m.mutate(confirm)}>{t('actions.confirm')}</Button>
        </>}>
        <p>
          {confirm === 'SET_STAGE' && t('students.bulk.confirmStage', { count: ids.length, stage: stage ? t(`pipeline.${stage}`) : '' })}
          {confirm === 'ASSIGN_COUNSELOR' && t('v22.work.confirmOwner', { count: ids.length, name: owners.find((c) => c.user_id === owner)?.full_name ?? '' })}
          {confirm === 'REGENERATE_TASKS' && t('students.bulk.confirmRegen', { count: ids.length })}
        </p>
      </Modal>
    </>
  );
}

function SaveViewModal({ open, onClose, filters, sort, onSaved }: { open: boolean; onClose: () => void; filters: Record<string, unknown>; sort: string; onSaved: (v: AgencySavedView) => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const toast = useToast();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'PERSONAL' | 'TEAM'>('PERSONAL');
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (open) { setName(''); setScope('PERSONAL'); setTouched(false); } }, [open]);
  const m = useMutation({
    mutationFn: () => api.agency.createSavedView({ name: name.trim(), scope, filters, sort }),
    onSuccess: (v) => { toast.success(t('savedViews.saved', { name: v.name })); onSaved(v); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const n = Object.keys(filters).length;
  return (
    <Modal open={open} onClose={onClose} title={t('savedViews.saveTitle')} width={480}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={() => { setTouched(true); if (name.trim()) m.mutate(); }}>{t('savedViews.save')}</Button></>}>
      <div className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties}>
        <p className="hg-small hg-muted">{n ? t('savedViews.saveHint', { count: n }) : t('savedViews.saveHintEmpty')}</p>
        <Field label={t('savedViews.name')} htmlFor="sv-name" error={touched && !name.trim() ? t('validation.required') : undefined}>
          <Input id="sv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t('savedViews.namePh')} invalid={touched && !name.trim()} />
        </Field>
        <Field label={t('savedViews.shareWith')}>
          {/* V22: every administrator can share a view with the team — there are no managers to reserve it for. */}
          <Segmented label={t('savedViews.shareWith')} value={scope} onChange={setScope}
            options={[{ value: 'PERSONAL', label: t('savedViews.personal') }, { value: 'TEAM', label: t('savedViews.team') }]} />
        </Field>
      </div>
    </Modal>
  );
}

export default function Students() {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const [, setSp] = useSearchParams();
  const [save, setSave] = useState<null | { filters: Record<string, unknown>; sort: string }>(null);
  const counts = useQuery({ queryKey: ['agency', 'students', 'views', null], queryFn: () => api.agency.studentViews() });
  return (
    <div className="ag7 ag-students ag22-students">
      <PageHeader title={t('v22.nav.students')} sub={t('students.subCount', { count: counts.data?.all ?? 0 })}
        crumbs={[{ label: t('v22.nav.today'), to: '/' }, { label: t('v22.nav.students') }]} />
      <Caseload mode="students" bulkActions={(ids, clear) => <BulkActions ids={ids} onDone={clear} />} saveView={(filters, sort) => setSave({ filters, sort })} />
      <SaveViewModal open={!!save} onClose={() => setSave(null)} filters={save?.filters ?? {}} sort={save?.sort ?? 'deadline'}
        onSaved={(v) => { qc.invalidateQueries({ queryKey: ['agency', 'saved-views'] }); setSp((p) => { const n = new URLSearchParams(p); n.set('saved', v.id); return n; }, { replace: true }); }} />
    </div>
  );
}
