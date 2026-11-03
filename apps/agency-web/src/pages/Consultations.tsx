import type { Appointment } from '@hangyul/api-client';
import { useAuth } from '@hangyul/auth';
import { CalendarDays, CalendarPlus, MapPin, Phone, Video } from '@hangyul/icons';
import { Button, EmptyState, Field, Input, Modal, QueryState, Segmented, Select, StatusText, Tabs, Textarea, useToast } from '@hangyul/ui';
import { cx, formatDate } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { StudentPicker, useT } from '../components/bits';
import { dayKey, groupBy, taskTitle } from '../lib/logic';

const KINDS = ['CONSULTATION', 'INTERVIEW_PREP', 'INTERVIEW'] as const;
const CHANNELS = ['VIDEO', 'PHONE', 'IN_PERSON'] as const;
const DURATIONS = [15, 30, 45, 60, 90];

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentForm({ open, onClose, student }: { open: boolean; onClose: () => void; student?: { id: string; full_name: string } | null }) {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [who, setWho] = useState(student ?? null);
  const [at, setAt] = useState('');
  const [kind, setKind] = useState<string>('CONSULTATION');
  const [channel, setChannel] = useState<string>('VIDEO');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!open) return;
    const d = new Date(Date.now() + 86_400_000); d.setMinutes(0, 0, 0); d.setHours(10);
    setWho(student ?? null); setAt(toLocalInput(d)); setKind('CONSULTATION'); setChannel('VIDEO'); setDuration(30); setNotes(''); setTouched(false);
  }, [open, student]);
  const past = at ? new Date(at).getTime() < Date.now() : false;
  const m = useMutation({
    mutationFn: () => api.agency.createAppointment({ student_id: who!.id, starts_at: new Date(at).toISOString(), kind, channel, duration_minutes: duration, notes: notes.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency', 'appointments'] });
      qc.invalidateQueries({ queryKey: ['agency', 'student'] });
      toast.success(t('consult.created'));
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const submit = () => { setTouched(true); if (who && at && !past) m.mutate(); };
  return (
    <Modal open={open} onClose={onClose} title={t('consult.new')} width={560}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={submit}>{t('consult.schedule')}</Button></>}>
      <div className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties}>
        <Field label={t('misc.student')} error={touched && !who ? t('validation.required') : undefined}><StudentPicker value={who} onChange={setWho} label={t('misc.student')} /></Field>
        <div className="ag-form-grid">
          <Field label={t('consult.when')} htmlFor="ap-at" error={touched && past ? t('consult.inPast') : undefined}>
            <Input id="ap-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} invalid={touched && past} />
          </Field>
          <Field label={t('consult.duration')} htmlFor="ap-dur">
            <Select id="ap-dur" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => <option key={d} value={d}>{t('consult.minutes', { count: d })}</option>)}
            </Select>
          </Field>
          <Field label={t('consult.kindLabel')} htmlFor="ap-kind">
            <Select id="ap-kind" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k} value={k}>{t(`consult.kind.${k}`)}</option>)}</Select>
          </Field>
          <Field label={t('consult.channelLabel')} htmlFor="ap-ch">
            <Select id="ap-ch" value={channel} onChange={(e) => setChannel(e.target.value)}>{CHANNELS.map((k) => <option key={k} value={k}>{t(`consult.channel.${k}`)}</option>)}</Select>
          </Field>
        </div>
        <Field label={t('consult.notes')} htmlFor="ap-notes" optional hint={t('consult.notesHint')}>
          <Textarea id="ap-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </Field>
        <p className="hg-subtle hg-xs">{t('consult.notifyNote')}</p>
      </div>
    </Modal>
  );
}

const channelIcon = (c: string) => (c === 'PHONE' ? <Phone aria-hidden size={14} /> : c === 'IN_PERSON' ? <MapPin aria-hidden size={14} /> : <Video aria-hidden size={14} />);
type Bucket = 'upcoming' | 'follow_up' | 'done';

/** Record what was agreed and create the follow-up task in one step. */
function CloseOut({ appt, onClose }: { appt: Appointment | null; onClose: () => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<'COMPLETED' | 'NO_SHOW' | 'CANCELLED'>('COMPLETED');
  const [notes, setNotes] = useState('');
  const [task, setTask] = useState('');
  const [due, setDue] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (appt) { setStatus('COMPLETED'); setNotes(''); setTask(''); setDue(''); setTouched(false); } }, [appt]);
  const m = useMutation({
    mutationFn: () => api.agency.closeAppointment(appt!.id, { status, outcome_notes: notes.trim() || undefined, next_task_title: task.trim() || undefined,
      next_task_due_at: task.trim() && due ? new Date(due).toISOString() : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency', 'appointments'] }); qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success(t('consult.closed')); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const needNotes = status === 'COMPLETED' && !notes.trim();
  return (
    <Modal open={!!appt} onClose={onClose} title={t('consult.closeTitle', { name: appt?.student?.full_name ?? '' })} width={560}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={() => { setTouched(true); if (!needNotes) m.mutate(); }}>{t('consult.closeSave')}</Button></>}>
      <div className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties}>
        <Field label={t('consult.outcome')}>
          <Segmented label={t('consult.outcome')} value={status} onChange={setStatus}
            options={(['COMPLETED', 'NO_SHOW', 'CANCELLED'] as const).map((x) => ({ value: x, label: t(`consult.status.${x}`) }))} />
        </Field>
        <Field label={t('consult.agreed')} htmlFor="co-notes" optional={status !== 'COMPLETED'} error={touched && needNotes ? t('consult.agreedRequired') : undefined} hint={t('consult.agreedHint')}>
          <Textarea id="co-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} invalid={touched && needNotes} />
        </Field>
        <div className="ag-form-grid">
          <Field label={t('consult.nextTask')} htmlFor="co-task" optional hint={t('consult.nextTaskHint')}>
            <Input id="co-task" value={task} onChange={(e) => setTask(e.target.value)} maxLength={300} placeholder={t('consult.nextTaskPh')} />
          </Field>
          <Field label={t('consult.nextDue')} htmlFor="co-due" optional>
            <Input id="co-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} disabled={!task.trim()} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/** V8: a Tasks view (/tasks?view=meetings; /consultations redirects here). Sub-view in `bucket`. */
export function MeetingsView() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const [sp, setSp] = useSearchParams();
  const view = (['upcoming', 'follow_up', 'done'].includes(sp.get('bucket') ?? '') ? sp.get('bucket') : 'upcoming') as Bucket;
  const student = sp.get('student');
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState<Appointment | null>(null);
  const q = useQuery({ queryKey: ['agency', 'appointments'], queryFn: () => api.agency.appointments() });
  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { upcoming: 0, follow_up: 0, done: 0 };
    (q.data ?? []).forEach((a) => { c[(a.bucket ?? 'done') as Bucket] += 1; });
    return c;
  }, [q.data]);
  const groups = useMemo(() => {
    const list = (q.data ?? []).filter((a) => (a.bucket ?? 'done') === view && (!student || a.student?.id === student));
    list.sort((a, b) => (view === 'upcoming' ? 1 : -1) * (new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()));
    return groupBy(list, (a) => dayKey(a.starts_at));
  }, [q.data, view]);
  const todayKey = dayKey(new Date().toISOString());
  const time = (iso: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  return (
    <div className="hg-stack ag8-embed">
      <div className="ag8-embed__bar">
        <p className="hg-small hg-muted mb-0">{t('consult.subV3')}</p>
        <Button size="sm" variant="primary" icon={<CalendarPlus />} onClick={() => setCreating(true)}>{t('consult.new')}</Button>
      </div>
      {student && (
        <p className="hg-small mb-0">{t('v8.tasks.oneStudent')} <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setSp((p) => { const n = new URLSearchParams(p); n.delete('student'); return n; }, { replace: true })}>{t('actions.clearFilters')}</button></p>
      )}
      <Tabs label={t('consult.view')} value={view} onChange={(v) => setSp((p) => { const n = new URLSearchParams(p); if (v === 'upcoming') n.delete('bucket'); else n.set('bucket', v); return n; }, { replace: true })}
        tabs={(['upcoming', 'follow_up', 'done'] as Bucket[]).map((b) => ({ value: b, label: t(`consult.bucket.${b}`), count: q.data ? counts[b] : undefined }))} />
      {view === 'follow_up' && counts.follow_up > 0 && <p className="hg-small hg-muted">{t('consult.followUpHint')}</p>}
      <QueryState query={q} isEmpty={() => groups.length === 0}
        empty={<EmptyState icon={<CalendarDays />} title={t(`consult.emptyBucket.${view}`)} action={view === 'upcoming' ? <Button size="sm" onClick={() => setCreating(true)}>{t('consult.new')}</Button> : undefined} />}>
        {() => (
          <div className="ag-agenda">
            {groups.map(([day, items]) => (
              <section key={day} className={cx('ag-agenda__day', day === todayKey && 'is-today')} aria-labelledby={`d-${day}`}>
                <h2 id={`d-${day}`} className="ag-agenda__date">
                  <span className="ag-agenda__dow">{formatDate(`${day}`, locale, { weekday: 'short' })}</span>
                  <span className="ag-agenda__dnum hg-num">{formatDate(`${day}`, locale, { day: 'numeric' })}</span>
                  <span className="hg-subtle hg-xs">{formatDate(`${day}`, locale, { month: 'short', year: 'numeric' })}</span>
                </h2>
                <ul className="ag-cards">
                  {items.map((a: Appointment) => (
                    <li key={a.id} className="ag-agenda__item">
                      <div className="ag-agenda__time hg-num">
                        <strong>{time(a.starts_at)}</strong>
                        <span className="hg-subtle hg-xs">{t('consult.minutes', { count: a.duration_minutes })}</span>
                      </div>
                      <div className="hg-grow ag-appt" style={{ minWidth: 0 }}>
                        <div className="ag-appt__title">
                          {a.student ? <Link to={`/students/${a.student.id}?tab=history`} className="hg-link">{a.student.full_name}</Link> : null}
                          <span className="hg-subtle"> · {t(`consult.kind.${a.kind}`, { defaultValue: a.kind })}</span>
                        </div>
                        <div className="ag-appt__meta">
                          <span className="hg-row" style={{ gap: 4 }}>{channelIcon(a.channel)}{t(`consult.channel.${a.channel}`, { defaultValue: a.channel })}</span>
                          {a.application?.university && <span>{a.application.university}</span>}
                          {a.service_plan && <span>{a.service_plan}</span>}
                          {a.host && <span>{t('consult.with', { name: a.host.full_name })}</span>}
                        </div>
                        {(a.outcome_notes || a.notes) && <p className="ag-appt__notes">{a.outcome_notes ?? a.notes}</p>}
                        {a.follow_up_task && (
                          <div className="ag-appt__next">
                            <StatusText tone={a.follow_up_task.done ? 'success' : 'info'}>{t('consult.nextLabel', { title: taskTitle(t, a.follow_up_task) })}</StatusText>
                            {a.follow_up_task.due_at && <span className="hg-subtle hg-xs">{formatDate(a.follow_up_task.due_at, locale, { month: 'short', day: 'numeric' })}</span>}
                          </div>
                        )}
                      </div>
                      <div className="ag-agenda__host">
                        {a.bucket === 'follow_up' ? <Button size="sm" variant="primary" onClick={() => setClosing(a)}>{t('consult.closeOut')}</Button>
                          : a.bucket === 'upcoming' ? <StatusText tone="success">{t('consult.status.SCHEDULED')}</StatusText>
                            : <StatusText tone={a.status === 'COMPLETED' ? 'neutral' : 'warning'}>{t(`consult.status.${a.status}`, { defaultValue: a.status })}</StatusText>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </QueryState>
      <AppointmentForm open={creating} onClose={() => setCreating(false)} />
      <CloseOut appt={closing} onClose={() => setClosing(null)} />
    </div>
  );
}
