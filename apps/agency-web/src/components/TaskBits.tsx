import { useAuth } from '@hangyul/auth';
import { Check, UserRound, UserRoundCheck } from '@hangyul/icons';
import type { Task, TaskPriority, TaskType } from '@hangyul/types';
import { Avatar, Button, Checkbox, Field, Input, Modal, Popover, Select, StatusText, Textarea, useToast } from '@hangyul/ui';
import { cx, formatDateTime, formatRelative } from '@hangyul/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { usePerms, useTeam } from '../lib/hooks';
import { StudentPicker, useT } from './bits';
import { taskTitle } from '../lib/logic';

export const TASK_TYPES: TaskType[] = [
  'GENERAL', 'CONSULTATION', 'DOCUMENT_REVIEW', 'DOCUMENT_UPLOAD', 'ESSAY_REVIEW', 'ESSAY_WRITE', 'APPLICATION_SUBMIT', 'APPLICATION_DEADLINE',
  'INTERVIEW', 'TUITION_PAYMENT', 'VISA_STEP', 'DORM_APPLICATION', 'ARRIVAL_STEP', 'SCHOLARSHIP_DEADLINE', 'PROFILE', 'UNIVERSITY_REQUEST', 'SLA_FOLLOW_UP',
];
export const PRIORITIES: TaskPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

export function useTaskMutations() {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.tasks.update>[1]; msg?: string }) => api.tasks.update(id, patch),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['agency'] });
      toast.success(v.msg ?? t('actions.saved'));
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

export function TaskRow({ task, showStudent = true }: { task: Task; showStudent?: boolean }) {
  const { t, locale } = useT();
  const perms = usePerms();
  const team = useTeam();
  const m = useTaskMutations();
  const done = task.status === 'DONE';
  const members = (team.data?.members ?? []).filter((x) => x.active);
  return (
    <li className={cx('ag-task', task.overdue && 'ag-task--overdue', done && 'ag-task--done')}>
      <button type="button" className="ag-task__check" role="checkbox" aria-checked={done} aria-label={t('tasksPage.complete', { title: taskTitle(t, task) })}
        disabled={m.isPending || done} onClick={() => m.mutate({ id: task.id, patch: { status: 'DONE' }, msg: t('tasksPage.completed') })}>
        {done && <Check aria-hidden />}
      </button>
      <div className="ag-task__main">
        <div className="ag-task__title">
          {task.link ? <Link to={task.link}>{taskTitle(t, task)}</Link> : <span>{taskTitle(t, task)}</span>}
        </div>
        <div className="ag-task__meta">
          <span className="hg-subtle hg-xs">{t(`taskType.${task.task_type}`)}</span>
          {(task.priority === 'URGENT' || task.priority === 'HIGH') && <StatusText tone={task.priority === 'URGENT' ? 'danger' : 'warning'} colored>{t(`priority.${task.priority}`)}</StatusText>}
          {showStudent && task.student_id && <Link to={`/students/${task.student_id}?tab=tasks`} className="hg-xs">{task.student_name ?? t('misc.student')}</Link>}
          {task.university && <span className="hg-subtle hg-xs">{task.university}</span>}
          {task.status === 'BLOCKED' && <span className="hg-xs" style={{ color: 'var(--hg-status-danger-fg)' }}>{t('taskStatus.BLOCKED')}</span>}
        </div>
      </div>
      <div className="ag-task__due" title={formatDateTime(task.due_at, locale)}>
        {task.due_at ? <span className={task.overdue ? 'ag-overdue' : 'hg-subtle'}>{formatRelative(task.due_at, locale)}</span> : <span className="hg-subtle">{t('tasksPage.noDue')}</span>}
      </div>
      <div className="ag-task__owner">
        <Popover width={260} trigger={(p) => (
          <button type="button" className="ag-owner-btn" aria-label={t('tasksPage.reassign', { title: taskTitle(t, task) })} {...p}>
            {task.owner ? <Avatar name={task.owner.full_name} size={24} /> : <span className="ag-owner-empty"><UserRound size={14} aria-hidden /></span>}
            <span className="hg-truncate hg-xs">{task.owner?.full_name ?? t('tasksPage.unclaimed')}</span>
          </button>
        )}>
          {(close) => (
            <div role="menu" aria-label={t('actions.reassign')} style={{ maxHeight: 300, overflowY: 'auto' }}>
              {task.owner?.id !== perms.userId && (
                <button type="button" role="menuitem" className="hg-menu-item" onClick={() => { close(); m.mutate({ id: task.id, patch: { owner_user_id: perms.userId }, msg: t('tasksPage.claimed') }); }}>
                  <UserRoundCheck aria-hidden /> {t('tasksPage.assignMe')}
                </button>
              )}
              {members.filter((x) => x.user_id !== perms.userId).map((x) => (
                <button key={x.user_id} type="button" role="menuitem" className="hg-menu-item" aria-current={task.owner?.id === x.user_id}
                  onClick={() => { close(); m.mutate({ id: task.id, patch: { owner_user_id: x.user_id }, msg: t('tasksPage.reassigned', { name: x.full_name }) }); }}>
                  <Avatar name={x.full_name} size={22} /><span className="hg-grow hg-truncate">{x.full_name}</span>
                </button>
              ))}
              <hr className="hg-divider" style={{ margin: '4px 0' }} />
              {PRIORITIES.filter((p) => p !== task.priority).map((p) => (
                <button key={p} type="button" role="menuitem" className="hg-menu-item hg-small" onClick={() => { close(); m.mutate({ id: task.id, patch: { priority: p } }); }}>
                  {t('tasksPage.setPriority', { p: t(`priority.${p}`) })}
                </button>
              ))}
              {task.status !== 'BLOCKED' ? (
                <button type="button" role="menuitem" className="hg-menu-item hg-small" onClick={() => { close(); m.mutate({ id: task.id, patch: { status: 'BLOCKED' } }); }}>{t('tasksPage.markBlocked')}</button>
              ) : (
                <button type="button" role="menuitem" className="hg-menu-item hg-small" onClick={() => { close(); m.mutate({ id: task.id, patch: { status: 'OPEN' } }); }}>{t('tasksPage.unblock')}</button>
              )}
            </div>
          )}
        </Popover>
      </div>
    </li>
  );
}

export function CreateTaskModal({ open, onClose, student, applicationId }: {
  open: boolean; onClose: () => void; student?: { id: string; full_name: string } | null; applicationId?: string;
}) {
  const { api } = useAuth();
  const { t } = useT();
  const perms = usePerms();
  const team = useTeam();
  const qc = useQueryClient();
  const toast = useToast();
  const [who, setWho] = useState<{ id: string; full_name: string } | null>(student ?? null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<TaskType>('GENERAL');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [due, setDue] = useState('');
  const [owner, setOwner] = useState('');
  const [forStudent, setForStudent] = useState(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!open) return;
    setWho(student ?? null); setTitle(''); setDesc(''); setType('GENERAL'); setPriority('MEDIUM'); setDue(''); setOwner(perms.userId); setForStudent(false); setTouched(false);
  }, [open, student, perms.userId]);
  const m = useMutation({
    mutationFn: () => api.tasks.create({
      title: title.trim(), description: desc.trim() || undefined, task_type: type, priority, due_at: due ? new Date(due).toISOString() : undefined,
      student_id: who?.id, application_id: applicationId,
      owner_user_id: forStudent && who ? who.id : owner || undefined, visible_to_student: forStudent,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['agency'] }); toast.success(t('tasksPage.created')); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const submit = () => { setTouched(true); if (title.trim()) m.mutate(); };
  return (
    <Modal open={open} onClose={onClose} title={t('tasksPage.new')} width={580}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={submit}>{t('tasksPage.create')}</Button></>}>
      <form className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label={t('tasksPage.title')} htmlFor="ct-title" error={touched && !title.trim() ? t('validation.required') : undefined}>
          <Input id="ct-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} invalid={touched && !title.trim()} autoFocus />
        </Field>
        <Field label={t('misc.student')} optional>
          <StudentPicker value={who} onChange={(v) => { setWho(v); if (!v) setForStudent(false); }} label={t('misc.student')} />
        </Field>
        <div className="ag-form-grid">
          <Field label={t('tasksPage.type')} htmlFor="ct-type">
            <Select id="ct-type" value={type} onChange={(e) => setType(e.target.value as TaskType)}>
              {TASK_TYPES.map((x) => <option key={x} value={x}>{t(`taskType.${x}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('tasksPage.priority')} htmlFor="ct-prio">
            <Select id="ct-prio" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {PRIORITIES.map((x) => <option key={x} value={x}>{t(`priority.${x}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('tasksPage.due')} htmlFor="ct-due" optional>
            <Input id="ct-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label={t('tasksPage.owner')} htmlFor="ct-owner">
            <Select id="ct-owner" value={forStudent ? '__student' : owner} disabled={forStudent} onChange={(e) => setOwner(e.target.value)}>
              {forStudent && <option value="__student">{who?.full_name}</option>}
              {(team.data?.members ?? []).filter((x) => x.active).map((x) => <option key={x.user_id} value={x.user_id}>{x.full_name}{x.user_id === perms.userId ? ` (${t('tasksPage.me')})` : ''}</option>)}
            </Select>
          </Field>
        </div>
        <Checkbox label={t('tasksPage.forStudent')} checked={forStudent} disabled={!who} onChange={(e) => setForStudent(e.target.checked)} />
        {forStudent && <p className="hg-subtle hg-xs" style={{ marginTop: -8 }}>{t('tasksPage.forStudentHint')}</p>}
        <Field label={t('tasksPage.description')} htmlFor="ct-desc" optional>
          <Textarea id="ct-desc" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={4000} />
        </Field>
      </form>
    </Modal>
  );
}
