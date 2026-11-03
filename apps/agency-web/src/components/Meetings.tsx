// V9 meeting records (REPORT §59 A8): one record = notes + decisions + follow-up tasks + next appointment, created from
// the student workspace (POST /agency/students/{id}/meetings, or closing a scheduled one via /agency/appointments/{id}/close)
// and shown on the workspace timeline. The Tasks "Meetings" view keeps listing the same appointments.
import { useAuth } from '@hangyul/auth';
import { CalendarClock, CheckCircle2, ListChecks, NotebookPen } from '@hangyul/icons';
import { Button, Checkbox, EmptyState, Field, Input, Modal, QueryState, Select, Textarea, useToast } from '@hangyul/ui';
import { formatDate, formatDateTime } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useT } from './bits';

export interface MeetingRecord {
  id: string; kind: string; starts_at: string; status: string; channel: string; notes: string | null; outcome_notes: string | null;
  decisions: string[]; closed_at: string | null; host: { id: string; full_name: string } | null;
  follow_ups: { id: string; title: string; due_at: string | null; done: boolean; for_student: boolean }[];
  next_meeting: { id: string; starts_at: string; kind: string; channel: string; status: string } | null;
}

function toLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

/** Record a meeting that just happened (or close a scheduled one) as one record. */
export function RecordMeetingModal({ open, onClose, studentId, appointmentId }: { open: boolean; onClose: () => void; studentId: string; appointmentId?: string | null }) {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [decisions, setDecisions] = useState('');
  const [staffTasks, setStaffTasks] = useState('');
  const [studentTasks, setStudentTasks] = useState('');
  const [nextOn, setNextOn] = useState(false);
  const [nextAt, setNextAt] = useState('');
  const [channel, setChannel] = useState('VIDEO');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!open) return;
    const d = new Date(Date.now() + 7 * 86_400_000); d.setHours(10, 0, 0, 0);
    setNotes(''); setDecisions(''); setStaffTasks(''); setStudentTasks(''); setNextOn(false); setNextAt(toLocal(d)); setChannel('VIDEO'); setTouched(false);
  }, [open]);
  const body = () => ({
    status: 'COMPLETED', outcome_notes: notes.trim(), decisions: lines(decisions),
    follow_ups: [...lines(staffTasks).map((title) => ({ title })), ...lines(studentTasks).map((title) => ({ title, for_student: true }))],
    next_meeting: nextOn && nextAt ? { starts_at: new Date(nextAt).toISOString(), channel } : null,
  });
  const m = useMutation({
    mutationFn: () => (appointmentId ? api.post(`/agency/appointments/${appointmentId}/close`, body()) : api.post(`/agency/students/${studentId}/meetings`, body())),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(t('v9.meet.saved'));
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const submit = () => { setTouched(true); if (notes.trim()) m.mutate(); };
  return (
    <Modal open={open} onClose={onClose} title={appointmentId ? t('v9.meet.closeTitle') : t('v9.meet.recordTitle')} width={600}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={submit}>{t('v9.meet.save')}</Button></>}>
      <div className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties}>
        <Field label={t('v9.meet.notes')} htmlFor="mt-notes" error={touched && !notes.trim() ? t('validation.required') : undefined}>
          <Textarea id="mt-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} invalid={touched && !notes.trim()} />
        </Field>
        <Field label={t('v9.meet.decisions')} htmlFor="mt-dec" optional hint={t('v9.meet.oneper')}>
          <Textarea id="mt-dec" rows={2} value={decisions} onChange={(e) => setDecisions(e.target.value)} maxLength={2000} />
        </Field>
        <div className="ag-form-grid">
          <Field label={t('v9.meet.staffTasks')} htmlFor="mt-st" optional hint={t('v9.meet.oneper')}>
            <Textarea id="mt-st" rows={2} value={staffTasks} onChange={(e) => setStaffTasks(e.target.value)} maxLength={2000} />
          </Field>
          <Field label={t('v9.meet.studentTasks')} htmlFor="mt-stu" optional hint={t('v9.meet.studentHint')}>
            <Textarea id="mt-stu" rows={2} value={studentTasks} onChange={(e) => setStudentTasks(e.target.value)} maxLength={2000} />
          </Field>
        </div>
        <Checkbox label={t('v9.meet.scheduleNext')} checked={nextOn} onChange={(e) => setNextOn(e.target.checked)} />
        {nextOn && (
          <div className="ag-form-grid">
            <Field label={t('consult.when')} htmlFor="mt-next"><Input id="mt-next" type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)} /></Field>
            <Field label={t('consult.channelLabel')} htmlFor="mt-ch">
              <Select id="mt-ch" value={channel} onChange={(e) => setChannel(e.target.value)}>
                {['VIDEO', 'PHONE', 'IN_PERSON'].map((k) => <option key={k} value={k}>{t(`consult.channel.${k}`)}</option>)}
              </Select>
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Meeting records on the workspace timeline: what was said, decided, who does what next, and when we meet again. */
export function MeetingRecords({ studentId, limit, onClose }: { studentId: string; limit?: number; onClose?: (appointmentId: string) => void }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const q = useQuery({ queryKey: ['agency', 'meetings', studentId], queryFn: () => api.get<{ items: MeetingRecord[] }>(`/agency/students/${studentId}/meetings`) });
  return (
    <QueryState query={q} isEmpty={(d) => d.items.length === 0} empty={<EmptyState compact title={t('consult.empty')} />}>
      {(d) => (
        <ol className="list-unstyled mb-0 ag9-meet">
          {d.items.slice(0, limit ?? d.items.length).map((m) => {
            const open = m.status === 'SCHEDULED';
            const past = new Date(m.starts_at).getTime() < Date.now();
            return (
              <li key={m.id} className="ag9-meet__item" data-open={open || undefined}>
                <div className="ag9-meet__head">
                  <span className="fw-semibold"><NotebookPen aria-hidden className="ag9-meet__icon" />{t(`consult.kind.${m.kind}`, { defaultValue: m.kind })}</span>
                  <time className="text-muted fs-12" dateTime={m.starts_at}>{formatDateTime(m.starts_at, locale)}</time>
                  <span className="badge bg-light text-muted">{t(`consult.status.${m.status}`, { defaultValue: m.status })}</span>
                  {m.host && <span className="text-muted fs-12">{m.host.full_name}</span>}
                  {open && past && onClose && <button type="button" className="btn btn-sm btn-primary-light ms-auto" onClick={() => onClose(m.id)}>{t('v9.meet.closeShort')}</button>}
                </div>
                {m.outcome_notes && <p className="ag9-meet__notes">{m.outcome_notes}</p>}
                {m.decisions.length > 0 && (
                  <div className="ag9-meet__block"><span className="ag9-meet__k">{t('v9.meet.decisions')}</span>
                    <ul>{m.decisions.map((x, i) => <li key={i}><CheckCircle2 aria-hidden />{x}</li>)}</ul></div>
                )}
                {m.follow_ups.length > 0 && (
                  <div className="ag9-meet__block"><span className="ag9-meet__k">{t('v9.meet.followUps')}</span>
                    <ul>{m.follow_ups.map((f) => (
                      <li key={f.id} data-done={f.done || undefined}><ListChecks aria-hidden />
                        {f.for_student ? t('v9.next.studentSays', { what: f.title }) : f.title}
                        {f.due_at && <span className="text-muted"> · {formatDate(f.due_at, locale, { month: 'short', day: 'numeric' })}</span>}
                        {f.done && <span className="text-muted"> · {t('v9.meet.done')}</span>}
                      </li>
                    ))}</ul></div>
                )}
                {m.next_meeting && (
                  <p className="ag9-meet__next"><CalendarClock aria-hidden />{t('v9.meet.next', { when: formatDateTime(m.next_meeting.starts_at, locale) })}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </QueryState>
  );
}
