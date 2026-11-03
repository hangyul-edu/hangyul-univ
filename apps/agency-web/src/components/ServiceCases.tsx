/**
 * V5 concierge — service-case rows + the case drawer (agency / Hangyul ops).
 * Used by the Services queue page and the student workspace "Services" tab. Strings: `concierge` namespace.
 */
import { useAuth } from '@hangyul/auth';
import { useLocale } from '@hangyul/i18n';
import { Camera, Plane } from '@hangyul/icons';
import type { ServiceCase } from '@hangyul/types';
import { Button, Drawer, EmptyState, Field, Input, QueryState, Select, Skeleton, StatusText, Textarea, useToast } from '@hangyul/ui';
import { cx, formatDate, formatMoney, formatRelative } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import '../concierge.css';
import { VisaRoutePanel } from './VisaRoutePanel';

export function useCT() {
  return useLocale(['concierge', 'agency', 'common', 'visaroute']);
}

const SEOUL: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' };
const VENDOR_KIND: Record<string, string> = {
  AIRPORT_PICKUP: 'airport_transport', DORMITORY: 'housing_provider', HOUSING_SEARCH: 'housing_provider', TEMPORARY_HOUSING: 'housing_provider',
  SIM: 'sim_esim', ARRIVAL_SUPPORT: 'relocation', VISA_SUPPORT: 'legalization',
};

export function toSeoulInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}T${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}
const fromSeoulInput = (v: string) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00+09:00` : null);

function statusLabel(t: (k: string, o?: Record<string, unknown>) => string, c: Pick<ServiceCase, 'status_key' | 'status'> & { type?: string }) {
  if (c.type === 'VISA_SUPPORT') return t(`visaroute:staff.status.${c.status}`, { defaultValue: c.status });
  return t(`staffStatus.${c.status_key.replace(/^status\./, '')}`, { defaultValue: t(c.status_key, { defaultValue: c.status }) });
}

const WAIT_TONE: Record<string, 'danger' | 'warning' | 'info' | 'neutral' | 'success'> = { team: 'warning', student: 'info', provider: 'neutral', external: 'neutral', none: 'success' };

export function ServiceRow({ c, onOpen, showStudent = true }: { c: ServiceCase; onOpen: (id: string) => void; showStudent?: boolean }) {
  const { t, locale } = useCT();
  const due = c.overdue ? c.sla_due_at : c.due_at ?? c.sla_due_at;
  return (
    <li className={cx('cq-row', c.overdue && 'is-overdue')}>
      <button type="button" className="cq-row__main" onClick={() => onOpen(c.id)}>
        {showStudent && <span className="cq-row__student">{c.student?.full_name}</span>}
        <span className="cq-row__what">
          <span className="cq-row__type">{t(`type.${c.type}`)}{c.help_category ? ` · ${t(`help.cat.${c.help_category}`)}` : ''}</span>
          <span className="cq-row__status">{statusLabel(t, c)}</span>
        </span>
        <span className={cx('cq-row__due hg-num', c.overdue && 'ag-overdue')} title={due ? formatDate(due, locale, SEOUL) : undefined}>
          {due ? (c.overdue ? t('staff.slaLate', { when: formatRelative(due, locale) }) : formatRelative(due, locale)) : '—'}
        </span>
        <span className="cq-row__wait"><StatusText tone={WAIT_TONE[c.waiting_on]}>{t(`waiting.${c.waiting_on}`)}</StatusText></span>
        <span className="cq-row__owner">{c.routed_to === 'HANGYUL_OPS' && !c.owner ? t('staff.hangyulOps') : c.owner?.full_name ?? <span className="hg-subtle">{t('staff.unassigned')}</span>}</span>
      </button>
    </li>
  );
}

export function ServiceList({ items, onOpen, showStudent = true, empty }: { items: ServiceCase[]; onOpen: (id: string) => void; showStudent?: boolean; empty?: React.ReactNode }) {
  const { t } = useCT();
  if (!items.length) return <>{empty}</>;
  return (
    <>
      <div className={cx('cq-row__main cq-head', !showStudent && 'cq-head--nostudent')} aria-hidden>
        {showStudent && <span>{t('staff.col.student')}</span>}<span>{t('staff.col.service')}</span><span>{t('staff.col.due')}</span><span>{t('staff.col.waiting')}</span><span>{t('staff.col.owner')}</span>
      </div>
      <ul className={cx('cq-list', !showStudent && 'cq-list--nostudent')}>{items.map((c) => <ServiceRow key={c.id} c={c} onOpen={onOpen} showStudent={showStudent} />)}</ul>
    </>
  );
}

// ------------------------------------------------------------------------------------------------ drawer
function useCaseMutation(id: string) {
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useCT();
  const done = () => { qc.invalidateQueries({ queryKey: ['services'] }); qc.invalidateQueries({ queryKey: ['service', id] }); toast.success(t('staff.saved')); };
  const err = (e: unknown) => toast.error((e as Error).message);
  return {
    update: useMutation({ mutationFn: (b: Record<string, unknown>) => api.concierge.update(id, b), onSuccess: done, onError: err }),
    event: useMutation({ mutationFn: (b: Parameters<typeof api.concierge.addEvent>[1]) => api.concierge.addEvent(id, b), onSuccess: done, onError: err }),
  };
}

function StatusMove({ c }: { c: ServiceCase }) {
  const { t } = useCT();
  const { api } = useAuth();
  const { update } = useCaseMutation(c.id);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!c.allowed_next?.length) return <p className="hg-small hg-muted">{t('staff.final')}</p>;
  const needsProof = c.type === 'AIRPORT_PICKUP' && to === 'COMPLETED';
  const submit = async () => {
    let attachment_document_id: string | undefined;
    const f = file.current?.files?.[0];
    if (f && c.student) {
      setBusy(true);
      try { attachment_document_id = (await api.documents.upload(f, { category: 'OTHER', title: 'Service completion photo', student_user_id: c.student.id })).id; } finally { setBusy(false); }
    }
    update.mutate({ status: to, note: note.trim() || undefined, attachment_document_id }, { onSuccess: () => { setTo(''); setNote(''); } });
  };
  return (
    <div className="cq-block">
      <div className="cq-actions">
        {c.allowed_next.map((s) => (
          <Button key={s} size="sm" variant={to === s ? 'soft' : 'secondary'} aria-pressed={to === s} onClick={() => setTo(to === s ? '' : s)}>{stLabel(t, c.type, s)}</Button>
        ))}
      </div>
      {to && (
        <>
          <Field label={needsProof ? t('staff.proofNote') : t('staff.noteForStudent')} htmlFor="cq-note" optional={!needsProof}>
            <Textarea id="cq-note" rows={2} value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} />
          </Field>
          {needsProof && <Field label={t('staff.proofPhoto')} htmlFor="cq-proof" optional><input id="cq-proof" ref={file} type="file" accept="image/*,application/pdf" /></Field>}
          <div><Button size="sm" variant="primary" loading={update.isPending || busy} onClick={submit}>{t('staff.moveTo', { status: stLabel(t, c.type, to) })}</Button></div>
        </>
      )}
    </div>
  );
}
const STATUS_TYPES: Record<string, true> = { AIRPORT_PICKUP: true, DORMITORY: true, HOUSING_SEARCH: true, TEMPORARY_HOUSING: true, RESIDENCE_CARD: true };
/** V5 visa: VISA_SUPPORT has its own status table (visaroute namespace). */
function stLabel(t: (k: string, o?: Record<string, unknown>) => string, type: string, s: string) {
  if (type === 'VISA_SUPPORT') return t(`visaroute:staff.status.${s}`, { defaultValue: s });
  return t(`staffStatus.${type in STATUS_TYPES ? type : 'GENERIC'}.${s}`, { defaultValue: s });
}

function OwnerVendor({ c }: { c: ServiceCase }) {
  const { t } = useCT();
  const { api } = useAuth();
  const { update } = useCaseMutation(c.id);
  const team = useQuery({ queryKey: ['agency', 'team'], queryFn: () => api.agency.team(), staleTime: 300_000 });
  const kind = VENDOR_KIND[c.type];
  const vendors = useQuery({ queryKey: ['vendors', kind ?? 'all'], queryFn: () => api.concierge.vendors(kind), staleTime: 60_000 });
  return (
    <div className="cq-grid">
      <Field label={t('staff.owner')} htmlFor="cq-owner">
        <Select id="cq-owner" value={c.owner?.id ?? ''} onChange={(e) => update.mutate({ owner_user_id: e.target.value || null })}>
          <option value="">{t('staff.unassigned')}</option>
          {c.owner && !team.data?.members.some((m) => m.user_id === c.owner!.id) && <option value={c.owner.id}>{c.owner.full_name}</option>}
          {(team.data?.members ?? []).filter((m) => m.active).map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
        </Select>
      </Field>
      <Field label={t('staff.provider')} htmlFor="cq-vendor">
        <Select id="cq-vendor" value={c.vendor?.id ?? ''} onChange={(e) => update.mutate({ vendor_id: e.target.value || null })}>
          <option value="">{t('staff.noProvider')}</option>
          {(vendors.data?.items ?? []).filter((v) => v.quality_status !== 'SUSPENDED').map((v) => (
            <option key={v.id} value={v.id}>{v.name}{v.agreement_active ? ` · ${t('provider.partner')}` : ''}</option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function PickupTools({ c }: { c: ServiceCase }) {
  const { t, locale } = useCT();
  const { update, event } = useCaseMutation(c.id);
  const d = (c.details.driver ?? {}) as { name?: string; phone?: string; vehicle?: string };
  const [driver, setDriver] = useState({ name: d.name ?? '', phone: d.phone ?? '', vehicle: d.vehicle ?? '' });
  const [meeting, setMeeting] = useState(String(c.details.meeting_point ?? ''));
  const [est, setEst] = useState(toSeoulInput(c.flight?.estimated_arrival ?? c.flight?.scheduled_arrival));
  const [terminal, setTerminal] = useState(c.flight?.terminal ?? '');
  const [note, setNote] = useState('');
  const f = c.flight;
  return (
    <>
      <section className="cq-block" aria-labelledby="cq-flight">
        <h3 id="cq-flight" className="cq-h"><Plane size={14} aria-hidden /> {t('staff.flight')}</h3>
        {f ? (
          <dl className="cq-kv">
            <div><dt>{t('flight.number')}</dt><dd>{f.number} · {f.airport}{f.terminal ? ` ${f.terminal}` : ''}</dd></div>
            <div><dt>{t('flight.arrives')}</dt><dd>{formatDate(f.scheduled_arrival, locale, SEOUL)}</dd></div>
            {f.estimated_arrival && <div><dt>{t('flight.expected')}</dt><dd>{formatDate(f.estimated_arrival, locale, SEOUL)}</dd></div>}
            <div><dt>{t('staff.flightSource')}</dt><dd>{f.live ? t('staff.flightLive') : t('staff.flightManual', { who: t(`staff.by.${f.updated_by ?? 'student'}`) })}</dd></div>
          </dl>
        ) : <p className="hg-small hg-muted">{t('staff.noFlight')}</p>}
        {c.details.reconfirm && <p className="hg-small ag-overdue">{t('staff.reconfirm')}</p>}
        {f && !c.closed && (
          <form className="cq-grid" onSubmit={(e) => { e.preventDefault(); const iso = fromSeoulInput(est); if (iso) event.mutate({ kind: 'FLIGHT_CHANGE', estimated_arrival: iso, terminal: terminal || undefined, body: note || undefined }, { onSuccess: () => setNote('') }); }}>
            <Field label={t('staff.estimated')} htmlFor="cq-est" hint={t('staff.koreaTime')}><Input id="cq-est" type="datetime-local" value={est} onChange={(e) => setEst(e.target.value)} /></Field>
            <Field label={t('flight.terminal')} htmlFor="cq-term" optional><Input id="cq-term" value={terminal} onChange={(e) => setTerminal(e.target.value.slice(0, 8))} /></Field>
            <Field label={t('staff.flightNote')} htmlFor="cq-fnote" optional><Input id="cq-fnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('staff.flightNotePh')} /></Field>
            <div className="cq-end"><Button size="sm" type="submit" loading={event.isPending}>{t('staff.recordFlight')}</Button></div>
          </form>
        )}
      </section>
      {!c.closed && (
        <section className="cq-block" aria-labelledby="cq-driver">
          <h3 id="cq-driver" className="cq-h">{t('staff.driver')}</h3>
          <form className="cq-grid" onSubmit={(e) => { e.preventDefault(); update.mutate({ details: { driver: { name: driver.name.trim() || null, phone: driver.phone.trim() || null, vehicle: driver.vehicle.trim() || null }, meeting_point: meeting.trim() || null } }); }}>
            <Field label={t('staff.driverName')} htmlFor="cq-dn"><Input id="cq-dn" value={driver.name} onChange={(e) => setDriver({ ...driver, name: e.target.value })} /></Field>
            <Field label={t('staff.driverPhone')} htmlFor="cq-dp"><Input id="cq-dp" value={driver.phone} onChange={(e) => setDriver({ ...driver, phone: e.target.value })} /></Field>
            <Field label={t('staff.vehicle')} htmlFor="cq-dv" optional><Input id="cq-dv" value={driver.vehicle} onChange={(e) => setDriver({ ...driver, vehicle: e.target.value })} /></Field>
            <Field label={t('staff.meeting')} htmlFor="cq-mp" optional><Input id="cq-mp" value={meeting} onChange={(e) => setMeeting(e.target.value)} /></Field>
            <div className="cq-end"><Button size="sm" type="submit" loading={update.isPending}>{t('staff.saveDriver')}</Button></div>
          </form>
          {['DRIVER_ASSIGNED', 'FLIGHT_DELAYED', 'DRIVER_WAITING'].includes(c.status) && (
            <div><Button size="sm" variant="ghost" onClick={() => event.mutate({ kind: 'NO_SHOW', body: t('staff.noShowNote') })}>{t('staff.noShow')}</Button></div>
          )}
        </section>
      )}
    </>
  );
}

function CostAndNotes({ c }: { c: ServiceCase }) {
  const { t } = useCT();
  const { update, event } = useCaseMutation(c.id);
  const [amount, setAmount] = useState(c.cost?.amount != null ? String(c.cost.amount) : '');
  const [payer, setPayer] = useState(c.cost?.payer ?? '');
  const [notes, setNotes] = useState(c.internal_notes ?? '');
  const [msg, setMsg] = useState('');
  const [vis, setVis] = useState<'INTERNAL' | 'STUDENT'>('INTERNAL');
  return (
    <>
      <section className="cq-block" aria-labelledby="cq-cost">
        <h3 id="cq-cost" className="cq-h">{t('staff.cost')}</h3>
        <form className="cq-grid" onSubmit={(e) => { e.preventDefault(); if (payer) update.mutate({ cost: { amount: amount ? Number(amount) : null, currency: 'KRW', payer } }); }}>
          <Field label={t('staff.payer')} htmlFor="cq-payer"><Select id="cq-payer" value={payer} onChange={(e) => setPayer(e.target.value as typeof payer)}><option value="">—</option>{['included', 'student', 'university', 'hangyul'].map((p) => <option key={p} value={p}>{t(`staff.payerOpt.${p}`)}</option>)}</Select></Field>
          <Field label={t('staff.amount')} htmlFor="cq-amt" optional hint={t('staff.amountHint')}><Input id="cq-amt" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
          <div className="cq-end"><Button size="sm" type="submit" disabled={!payer} loading={update.isPending}>{t('staff.saveCost')}</Button></div>
        </form>
      </section>
      <section className="cq-block" aria-labelledby="cq-notes">
        <h3 id="cq-notes" className="cq-h">{t('staff.internalNotes')}</h3>
        <Textarea aria-label={t('staff.internalNotes')} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (c.internal_notes ?? '') && update.mutate({ internal_notes: notes })} />
        <form className="hg-stack" style={{ '--hg-gap': '8px' } as React.CSSProperties} onSubmit={(e) => { e.preventDefault(); if (msg.trim()) event.mutate({ kind: 'NOTE', body: msg.trim(), visibility: vis }, { onSuccess: () => setMsg('') }); }}>
          <Field label={t('staff.addUpdate')} htmlFor="cq-msg"><Textarea id="cq-msg" rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
          <div className="cq-actions">
            <Select compact aria-label={t('staff.visibility')} value={vis} onChange={(e) => setVis(e.target.value as 'INTERNAL' | 'STUDENT')}>
              <option value="INTERNAL">{t('staff.vis.INTERNAL')}</option><option value="STUDENT">{t('staff.vis.STUDENT')}</option>
            </Select>
            <Button size="sm" type="submit" loading={event.isPending}>{t('staff.post')}</Button>
          </div>
        </form>
      </section>
    </>
  );
}

function CaseBody({ c }: { c: ServiceCase }) {
  const { t, locale } = useCT();
  const lease = c.details.lease as Record<string, unknown> | undefined;
  return (
    <div className="hg-stack" style={{ '--hg-gap': '20px' } as React.CSSProperties}>
      <div className="cq-summary">
        <p className="cq-summary__status">{statusLabel(t, c)} · <StatusText tone={WAIT_TONE[c.waiting_on]}>{t(`waiting.${c.waiting_on}`)}</StatusText></p>
        {c.student && <p className="hg-small"><Link to={`/students/${c.student.id}?tab=services`}>{c.student.full_name}</Link>{c.student.nationality ? ` · ${c.student.nationality}` : ''}</p>}
        <p className="hg-xs hg-subtle">
          {c.sla_due_at && <>{t(c.overdue ? 'staff.slaWasDue' : 'staff.slaDue', { when: formatRelative(c.sla_due_at, locale) })} · </>}
          {c.due_at && <>{t('staff.happens', { when: formatDate(c.due_at, locale, SEOUL) })} · </>}
          {c.routed_to === 'HANGYUL_OPS' ? t('staff.routedOps') : t('staff.routedAgency')}
        </p>
      </div>
      {c.details.message && <blockquote className="cq-quote">{String(c.details.message)}</blockquote>}
      <StatusMove c={c} />
      <OwnerVendor c={c} />
      {c.type === 'VISA_SUPPORT' && c.student && <VisaRoutePanel studentId={c.student.id} compact />}
      {c.type === 'AIRPORT_PICKUP' && <PickupTools c={c} />}
      {c.type === 'AIRPORT_PICKUP' && (
        <dl className="cq-kv">
          <div><dt>{t('pickup.passengers')}</dt><dd>{String(c.details.passengers ?? '—')}</dd></div>
          <div><dt>{t('pickup.luggage')}</dt><dd>{String(c.details.luggage ?? '—')}</dd></div>
          <div><dt>{t('pickup.to')}</dt><dd>{t(`pickup.dest.${c.details.destination_kind ?? 'OTHER'}`)}{c.details.destination_address ? ` · ${c.details.destination_address}` : ''}</dd></div>
          <div><dt>{t('pickup.contact')}</dt><dd>{c.details.contact_method ? t(`contact.${c.details.contact_method}`) : '—'}{c.details.contact_handle ? ` · ${c.details.contact_handle}` : ''}</dd></div>
          {c.details.special_requests && <div><dt>{t('pickup.requests')}</dt><dd>{String(c.details.special_requests)}</dd></div>}
        </dl>
      )}
      {lease && (
        <section className="cq-block" aria-labelledby="cq-lease">
          <h3 id="cq-lease" className="cq-h">{t('lease.title')}</h3>
          <dl className="cq-kv">
            {(['address', 'deposit_krw', 'rent_monthly_krw', 'start_date', 'end_date', 'landlord_name', 'agent_name'] as const).map((k) => (
              <div key={k}><dt>{t(`lease.field.${k}`)}</dt><dd>{lease[k] == null || lease[k] === '' ? '—' : k.endsWith('krw') ? formatMoney(Number(lease[k]), 'KRW', locale) : String(lease[k])}</dd></div>
            ))}
          </dl>
          {(c.lease_flags ?? []).length > 0 && <ul className="cq-flags">{c.lease_flags!.map((f) => <li key={f}>{t(`lease.flag.${f}`)}</li>)}</ul>}
          <p className="hg-xs hg-subtle">{t('lease.staffDisclaimer')}</p>
        </section>
      )}
      <CostAndNotes c={c} />
      <section className="cq-block" aria-labelledby="cq-history">
        <h3 id="cq-history" className="cq-h">{t('staff.history')}</h3>
        <ol className="cq-events">
          {(c.events ?? []).slice().reverse().map((e) => (
            <li key={e.id}>
              <span className="hg-small">
                {e.kind === 'STATUS' || e.kind === 'CREATED' ? t('staff.event.status', { status: stLabel(t, c.type, e.to ?? '') }) : t(`staff.event.${e.kind}`, { defaultValue: e.kind })}
                {e.visibility === 'INTERNAL' && <span className="cq-internal"> · {t('staff.vis.INTERNAL')}</span>}
                {e.attachment_document_id && <> · <Camera size={12} aria-hidden /> {t('staff.attachment')}</>}
              </span>
              {e.body && <span className="hg-small hg-muted">{e.body}</span>}
              {e.kind === 'FLIGHT_CHANGE' && e.data?.estimated_arrival ? <span className="hg-xs hg-subtle">{t('flight.expected')}: {formatDate(String(e.data.estimated_arrival), locale, SEOUL)}</span> : null}
              <span className="hg-xs hg-subtle">{e.actor ?? t('staff.system')} · {formatRelative(e.at, locale)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function ServiceCaseDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useCT();
  const { api } = useAuth();
  const q = useQuery({ queryKey: ['service', id], queryFn: () => api.concierge.case(id!), enabled: !!id });
  return (
    <Drawer open={!!id} onClose={onClose} width={560} title={q.data ? `${t(`type.${q.data.type}`)}${q.data.student ? ` — ${q.data.student.full_name}` : ''}` : t('staff.loading')}>
      {id && <QueryState query={q} skeleton={<div className="hg-stack">{[0, 1, 2].map((i) => <Skeleton key={i} h={48} r={8} />)}</div>}>{(c) => <CaseBody key={c.updated_at} c={c} />}</QueryState>}
    </Drawer>
  );
}

/** Student workspace tab: this student's service cases + "open a case". */
export function StudentServices({ studentId }: { studentId: string }) {
  const { t } = useCT();
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [type, setType] = useState('');
  const q = useQuery({ queryKey: ['services', 'student', studentId], queryFn: () => api.concierge.queue({ student_id: studentId }) });
  const done = useQuery({ queryKey: ['services', 'student', studentId, 'done'], queryFn: () => api.concierge.queue({ student_id: studentId, view: 'completed' }) });
  const create = useMutation({
    mutationFn: () => api.concierge.create({ student_id: studentId, type: type as ServiceCase['type'] }),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['services'] }); setType(''); setOpen(c.id); },
    onError: (e) => toast.error((e as Error).message),
  });
  const items = [...(q.data?.items ?? []), ...(done.data?.items ?? [])];
  return (
    <div className="hg-stack">
      <div className="cq-actions">
        <Select compact aria-label={t('staff.newCase')} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('staff.newCase')}</option>
          {(q.data?.types ?? []).filter((x) => x !== 'RESIDENCE_CARD').map((x) => <option key={x} value={x}>{t(`type.${x}`)}</option>)}
        </Select>
        <Button size="sm" disabled={!type} loading={create.isPending} onClick={() => create.mutate()}>{t('staff.open')}</Button>
      </div>
      <div className="hg-panel">
        {q.isLoading ? <Skeleton h={48} /> : <ServiceList items={items} onOpen={setOpen} showStudent={false} empty={<EmptyState compact title={t('staff.noCases')} text={t('staff.noCasesText')} />} />}
      </div>
      <ServiceCaseDrawer id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
