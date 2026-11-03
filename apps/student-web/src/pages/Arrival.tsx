/**
 * "Your first weeks in Korea" (V5 concierge). One journey with one next step:
 * before admission quiet → after admission housing → visa issued: housing, flight, pickup, documents, SIM, orientation →
 * after arrival: residence card, health insurance, bank, transport, campus registration, emergency numbers.
 * Every fact carries its official source + last checked date (docs/research/arrival-official.json) or says it is being confirmed.
 */
import { useApi } from '@hangyul/auth';
import { Check, ChevronDown, ExternalLink, LifeBuoy, Lock, PartyPopper, Plane } from '@hangyul/icons';
import type { ArrivalJourney, ServiceCase } from '@hangyul/types';
import { Button, ButtonLink, Callout, EmptyState, Field, Input, Modal, QueryState, Select, SkeletonCard, Textarea, useToast } from '@hangyul/ui';
import { formatDate } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { CaseStatus, CostLine, EmergencyNumbers, FeedbackLine, Flow, OfficialFactsBlock, OfficialNote, ProviderLine, useCT } from '../components/ConciergeBits';
import { DaysLeft, PageIntro } from '../components/bits';
import { daysUntil, delayMinutes, fromSeoulInput, PICKUP_STEPS, pickupStepIndex, RESIDENCE_FLOW, flowIndex, SEOUL_TIME, toSeoulInput } from '../lib/concierge';

const AIRPORTS = ['ICN', 'GMP', 'PUS', 'CJU', 'TAE', 'CJJ'];
const CONTACTS = ['KAKAOTALK', 'WHATSAPP', 'ZALO', 'LINE', 'TELEGRAM', 'PHONE', 'IN_APP'];
const SELF_TICK = new Set(['documents_to_carry', 'sim_esim', 'orientation', 'residence_setup', 'health_insurance', 'bank_account', 'transport_card', 'campus_registration', 'emergency_info']);

function useJourneyMutation<T>(fn: (v: T) => Promise<unknown>, success?: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useCT();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arrival-journey'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      if (success) toast.success(t(success));
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

// ------------------------------------------------------------------------------------------------ flight
function FlightForm({ j }: { j: ArrivalJourney }) {
  const { t, locale } = useCT();
  const api = useApi();
  const f = j.flight;
  const [number, setNumber] = useState(f?.number ?? '');
  const [airport, setAirport] = useState(f?.airport ?? 'ICN');
  const [at, setAt] = useState(toSeoulInput(f?.scheduled_arrival));
  const [terminal, setTerminal] = useState(f?.terminal ?? '');
  const [edit, setEdit] = useState(!f);
  const m = useJourneyMutation(() => api.concierge.setFlight({ number: number.trim(), airport, scheduled_arrival: fromSeoulInput(at)!, terminal: terminal.trim() || null }), 'flight.saved');
  const delay = delayMinutes(f?.scheduled_arrival, f?.estimated_arrival);
  return (
    <div className="cg-panel" id="flight">
      {f && !edit ? (
        <>
          <dl className="cg-kv">
            <div><dt>{t('flight.number')}</dt><dd>{f.number}</dd></div>
            <div><dt>{t('flight.arrives')}</dt><dd>{formatDate(f.scheduled_arrival, locale, SEOUL_TIME)} · {t(`airport.${f.airport}`, { defaultValue: f.airport ?? '' })}{f.terminal ? ` · ${f.terminal}` : ''}</dd></div>
            {f.estimated_arrival && (
              <div><dt>{t('flight.expected')}</dt><dd>{formatDate(f.estimated_arrival, locale, SEOUL_TIME)}{delay && delay > 0 ? ` · ${t('flight.late', { count: delay })}` : ''}</dd></div>
            )}
          </dl>
          <p className="cg-source cg-source--review">{f.live ? t('flight.live') : t('flight.notLive')}</p>
          <div><Button size="sm" variant="secondary" onClick={() => setEdit(true)}>{t('flight.change')}</Button></div>
        </>
      ) : (
        <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); if (fromSeoulInput(at) && number.trim()) m.mutate(undefined, { onSuccess: () => setEdit(false) }); }}>
          <div className="cg-form-grid">
            <Field label={t('flight.number')} htmlFor="cg-flight"><Input id="cg-flight" value={number} required onChange={(e) => setNumber(e.target.value.toUpperCase().slice(0, 20))} placeholder="VN408" /></Field>
            <Field label={t('flight.airport')} htmlFor="cg-airport">
              <Select id="cg-airport" value={airport} onChange={(e) => setAirport(e.target.value)}>
                {AIRPORTS.map((x) => <option key={x} value={x}>{t(`airport.${x}`)}</option>)}
              </Select>
            </Field>
            <Field label={t('flight.when')} htmlFor="cg-at" hint={t('flight.whenHint')}><Input id="cg-at" type="datetime-local" required value={at} onChange={(e) => setAt(e.target.value)} /></Field>
            <Field label={t('flight.terminal')} htmlFor="cg-terminal" optional><Input id="cg-terminal" value={terminal} onChange={(e) => setTerminal(e.target.value.slice(0, 8))} placeholder="T1" /></Field>
          </div>
          <p className="cg-note">{t('flight.notLive')}</p>
          <div className="cg-actions">
            <Button type="submit" variant="primary" loading={m.isPending}>{t('flight.save')}</Button>
            {f && <Button variant="ghost" onClick={() => setEdit(false)}>{t('common:actions.cancel')}</Button>}
          </div>
        </form>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ pickup
function PickupRequest({ j }: { j: ArrivalJourney }) {
  const { t } = useCT();
  const api = useApi();
  const [passengers, setPassengers] = useState('1');
  const [luggage, setLuggage] = useState('2');
  const [dest, setDest] = useState('DORM');
  const [address, setAddress] = useState('');
  const [requests, setRequests] = useState('');
  const [contact, setContact] = useState('KAKAOTALK');
  const [handle, setHandle] = useState('');
  const req = useJourneyMutation(() => api.concierge.requestPickup({ passengers: Number(passengers), luggage: Number(luggage), destination_kind: dest,
    destination_address: address.trim() || null, special_requests: requests.trim() || null, contact_method: contact, contact_handle: handle.trim() || null }), 'pickup.requested');
  const skip = useJourneyMutation(() => api.concierge.setItems([...j.completed_items, 'pickup_not_needed']));
  if (!j.flight) return <p className="cg-note">{t('pickup.needFlight')}</p>;
  return (
    <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); req.mutate(undefined); }}>
      <p className="cg-note">{t('pickup.intro')}</p>
      <div className="cg-form-grid">
        <Field label={t('pickup.passengers')} htmlFor="cg-pax">
          <Select id="cg-pax" value={passengers} onChange={(e) => setPassengers(e.target.value)}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
        </Field>
        <Field label={t('pickup.luggage')} htmlFor="cg-lug">
          <Select id="cg-lug" value={luggage} onChange={(e) => setLuggage(e.target.value)}>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{t('pickup.bags', { count: n })}</option>)}</Select>
        </Field>
        <Field label={t('pickup.destination')} htmlFor="cg-dest">
          <Select id="cg-dest" value={dest} onChange={(e) => setDest(e.target.value)}>{['DORM', 'HOUSING', 'TEMPORARY', 'OTHER'].map((d) => <option key={d} value={d}>{t(`pickup.dest.${d}`)}</option>)}</Select>
        </Field>
        <Field label={t('pickup.address')} htmlFor="cg-addr" optional><Input id="cg-addr" value={address} onChange={(e) => setAddress(e.target.value.slice(0, 300))} /></Field>
        <Field label={t('pickup.contact')} htmlFor="cg-contact">
          <Select id="cg-contact" value={contact} onChange={(e) => setContact(e.target.value)}>{CONTACTS.map((c) => <option key={c} value={c}>{t(`contact.${c}`)}</option>)}</Select>
        </Field>
        {contact !== 'IN_APP' && <Field label={t('pickup.handle')} htmlFor="cg-handle" optional><Input id="cg-handle" value={handle} onChange={(e) => setHandle(e.target.value.slice(0, 120))} /></Field>}
      </div>
      <Field label={t('pickup.requests')} htmlFor="cg-req" optional><Textarea id="cg-req" rows={2} value={requests} onChange={(e) => setRequests(e.target.value.slice(0, 500))} placeholder={t('pickup.requestsHint')} /></Field>
      <div className="cg-actions">
        <Button type="submit" variant="primary" loading={req.isPending}>{t('pickup.request')}</Button>
        <Button variant="ghost" loading={skip.isPending} onClick={() => skip.mutate(undefined)}>{t('pickup.notNeeded')}</Button>
      </div>
    </form>
  );
}

function PickupCase({ c, j }: { c: ServiceCase; j: ArrivalJourney }) {
  const { t, locale } = useCT();
  const api = useApi();
  const cancel = useJourneyMutation(() => api.concierge.cancel(c.id), 'pickup.cancelled');
  const driver = c.details.driver as { name?: string; phone?: string; vehicle?: string } | undefined;
  const f = c.flight ?? j.flight;
  const delay = delayMinutes(f?.scheduled_arrival, f?.estimated_arrival);
  return (
    <div className="cg-panel">
      <p className="hg-md"><CaseStatus c={c} />{c.status === 'FLIGHT_DELAYED' && delay ? ` — ${t('flight.late', { count: delay })}` : ''}</p>
      {!['CANCELLED', 'NO_SHOW'].includes(c.status) && <Flow steps={PICKUP_STEPS} current={pickupStepIndex(c.status)} type="AIRPORT_PICKUP" label={t('pickup.title')} />}
      <p className="cg-note">{t(`pickup.explain.${c.status}`, { defaultValue: '' })}</p>
      <dl className="cg-kv">
        {c.due_at && <div><dt>{t('pickup.time')}</dt><dd>{formatDate(c.due_at, locale, SEOUL_TIME)}</dd></div>}
        {c.details.meeting_point && <div><dt>{t('pickup.meeting')}</dt><dd>{String(c.details.meeting_point)}</dd></div>}
        {driver?.name && <div><dt>{t('pickup.driver')}</dt><dd>{[driver.name, driver.vehicle].filter(Boolean).join(' · ')}{driver.phone ? <> · <a className="hg-link" href={`tel:${driver.phone}`}>{driver.phone}</a></> : null}</dd></div>}
        <div><dt>{t('pickup.to')}</dt><dd>{t(`pickup.dest.${c.details.destination_kind ?? 'OTHER'}`)}{c.details.destination_address ? ` · ${c.details.destination_address}` : ''}</dd></div>
      </dl>
      <div className="cg-actions"><ProviderLine vendor={c.vendor} /><CostLine cost={c.cost} /></div>
      {f && !f.live && <p className="cg-source cg-source--review">{t('flight.notLive')}</p>}
      {['REQUESTED', 'CONFIRMED'].includes(c.status) && <div><Button size="sm" variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate(undefined)}>{t('pickup.cancel')}</Button></div>}
      {(c.status === 'COMPLETED' || c.status === 'PICKED_UP') && <FeedbackLine c={c} />}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ residence card
function ResidencePanel({ j }: { j: ArrivalJourney }) {
  const { t, locale } = useCT();
  const api = useApi();
  const c = j.residence_card;
  const [when, setWhen] = useState('');
  const [office, setOffice] = useState('');
  const step = useJourneyMutation((body: { status: string; details?: Record<string, unknown> }) => api.concierge.step(c!.id, body), 'residence.saved');
  const official = j.steps.find((s) => s.key === 'residence_card')?.official;
  if (!c) return <OfficialFactsBlock official={official} />;
  const group = j.university_arrival?.group_residence_registration;
  const left = daysUntil(j.residence_card_due);
  return (
    <div className="cg-panel" id="residence">
      {j.residence_card_due && (
        <p className="hg-md"><strong>{t('residence.due', { date: formatDate(j.residence_card_due, locale) })}</strong> <DaysLeft date={j.residence_card_due} size="sm" /></p>
      )}
      <Flow steps={RESIDENCE_FLOW} current={flowIndex(RESIDENCE_FLOW, c.status)} type="RESIDENCE_CARD" label={t('residence.title')} />
      {c.status === 'PREPARING' && (
        <>
          <OfficialFactsBlock official={official} show={['documents', 'timing', 'cost']} />
          <p className="cg-note">{group === true ? t('residence.groupYes') : group === false ? t('residence.groupNo') : t('residence.groupUnknown')}</p>
          <div className="cg-panel">
            <h3>{t('residence.bookTitle')}</h3>
            <p className="cg-note">{t('residence.bookText')}</p>
            <div><ButtonLink href="https://www.hikorea.go.kr/" target="_blank" rel="noreferrer" variant="primary" iconEnd={<ExternalLink />}>{t('residence.openHikorea')}</ButtonLink></div>
            <form className="cg-form-grid" onSubmit={(e) => { e.preventDefault(); const at = fromSeoulInput(when); if (at) step.mutate({ status: 'APPOINTMENT_BOOKED', details: { appointment_at: at, office: office.trim() || null } }); }}>
              <Field label={t('residence.when')} htmlFor="cg-rc-when"><Input id="cg-rc-when" type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
              <Field label={t('residence.office')} htmlFor="cg-rc-office" optional><Input id="cg-rc-office" value={office} onChange={(e) => setOffice(e.target.value.slice(0, 120))} /></Field>
              <div><Button type="submit" variant="secondary" loading={step.isPending}>{t('residence.saveBooking')}</Button></div>
            </form>
            {group !== false && <div><Button size="sm" variant="ghost" onClick={() => step.mutate({ status: 'GROUP_FILING' })}>{t('residence.useGroup')}</Button></div>}
          </div>
        </>
      )}
      {c.status === 'APPOINTMENT_BOOKED' && (
        <>
          <p className="cg-note">{t('residence.booked', { when: c.due_at ? formatDate(c.due_at, locale, SEOUL_TIME) : '—', office: c.details.office ?? t('residence.officeUnknown') })}</p>
          <OfficialFactsBlock official={official} show={['documents']} />
          <div><Button variant="primary" loading={step.isPending} onClick={() => step.mutate({ status: 'SUBMITTED' })}>{t('residence.submitted')}</Button></div>
        </>
      )}
      {c.status === 'GROUP_FILING' && <><p className="cg-note">{t('residence.groupFiling')}</p><div><Button variant="secondary" onClick={() => step.mutate({ status: 'SUBMITTED' })}>{t('residence.submitted')}</Button></div></>}
      {c.status === 'SUBMITTED' && <><p className="cg-note">{t('residence.waiting')}</p><div><Button variant="secondary" onClick={() => step.mutate({ status: 'READY' })}>{t('residence.ready')}</Button></div></>}
      {c.status === 'READY' && <div><Button variant="primary" onClick={() => step.mutate({ status: 'COLLECTED' })}>{t('residence.collected')}</Button></div>}
      {c.status === 'COLLECTED' && <p className="cg-note">{t('residence.done')}</p>}
      {left !== null && left < 0 && c.status === 'PREPARING' && <Callout tone="danger" title={t('residence.lateTitle')}>{t('residence.lateText')}</Callout>}
      {official && c.status !== 'PREPARING' && <OfficialNote official={official} />}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ steps
function StepBody({ k, j }: { k: string; j: ArrivalJourney }) {
  const { t } = useCT();
  const api = useApi();
  const step = j.steps.find((s) => s.key === k)!;
  const toggle = useJourneyMutation((done: boolean) => api.concierge.setItems(done ? [...j.completed_items, k] : j.completed_items.filter((x) => x !== k)));
  const tick = SELF_TICK.has(k) && step.status !== 'locked' ? (
    <div><Button size="sm" variant={step.status === 'done' ? 'soft' : 'secondary'} icon={step.status === 'done' ? <Check /> : undefined} loading={toggle.isPending}
      onClick={() => toggle.mutate(step.status !== 'done')}>{step.status === 'done' ? t('step.markedDone') : t(`step.${k}.done`, { defaultValue: t('step.markDone') })}</Button></div>
  ) : null;
  switch (k) {
    case 'housing':
      return <div className="cg-panel"><p className="cg-note">{t(step.status === 'done' ? 'step.housing.doneText' : 'step.housing.text')}</p><div><ButtonLink as={Link} to="/housing" variant={step.status === 'next' ? 'primary' : 'secondary'}>{t('step.housing.cta')}</ButtonLink></div></div>;
    case 'flight':
      return <FlightForm j={j} />;
    case 'pickup':
      if (step.status === 'not_needed') {
        return <div className="cg-panel"><p className="cg-note">{t('pickup.skipped')}</p><OfficialFactsBlock official={step.official} show={['summary']} />
          <div><Button size="sm" variant="ghost" onClick={() => toggle.mutate(false)}>{t('pickup.undoSkip')}</Button></div></div>;
      }
      return <div id="pickup">{j.pickup && j.pickup.status !== 'CANCELLED' ? <PickupCase c={j.pickup} j={j} /> : <PickupRequest j={j} />}</div>;
    case 'residence_card':
      return <ResidencePanel j={j} />;
    case 'emergency_info':
      return <div className="cg-panel"><EmergencyNumbers emergency={j.emergency} />{tick}</div>;
    case 'documents_to_carry':
      return <div className="cg-panel"><p className="cg-note">{t('step.documents_to_carry.text')}</p><OfficialFactsBlock official={step.official} show={['documents']} />{tick}</div>;
    case 'orientation':
    case 'campus_registration':
      return (
        <div className="cg-panel">
          {j.university_arrival?.orientation_note && <p className="cg-note">{j.university_arrival.orientation_note}</p>}
          <OfficialFactsBlock official={step.official} show={['summary', 'steps']} />{tick}
        </div>
      );
    default:
      return <div className="cg-panel"><p className="cg-note">{t(`step.${k}.text`, { defaultValue: '' })}</p><OfficialFactsBlock official={step.official} show={['summary', 'steps', 'documents', 'cost']} />{tick}</div>;
  }
}

function Steps({ j }: { j: ArrivalJourney }) {
  const { t } = useCT();
  const { hash } = useLocation();
  const [open, setOpen] = useState<string | null>(j.next?.key ?? null);
  useEffect(() => {
    const target = hash.replace('#', '');
    const map: Record<string, string> = { flight: 'flight', pickup: 'pickup', residence: 'residence_card' };
    if (map[target]) setOpen(map[target]);
  }, [hash]);
  return (
    <ol className="cg-steps">
      {j.steps.map((s, i) => {
        const isOpen = open === s.key && s.status !== 'locked';
        return (
          <li key={s.key} className="cg-step" data-state={s.status}>
            <button type="button" className="cg-step__head" aria-expanded={isOpen} disabled={s.status === 'locked'} onClick={() => setOpen(isOpen ? null : s.key)}>
              <span className="cg-step__mark" aria-hidden>{s.status === 'done' || s.status === 'not_needed' ? <Check /> : s.status === 'locked' ? <Lock size={12} /> : i + 1}</span>
              <span className="cg-step__title">{t(`step.${s.key}.title`)}<span className="cg-step__sub">{t(`step.${s.key}.sub`, { defaultValue: '' })}</span></span>
              <span className="cg-step__state">{t(`stepState.${s.status}`)} {s.status !== 'locked' && <ChevronDown size={14} aria-hidden style={{ verticalAlign: '-2px', transform: isOpen ? 'rotate(180deg)' : undefined }} />}</span>
            </button>
            {isOpen && <div className="cg-step__body"><StepBody k={s.key} j={j} /></div>}
          </li>
        );
      })}
    </ol>
  );
}

function Hero({ j }: { j: ArrivalJourney }) {
  const { t, locale } = useCT();
  const next = j.next;
  if (j.stage === 'ARRIVED' && !next) {
    return <Callout tone="success" icon={<PartyPopper aria-hidden />} title={t('hero.settledTitle')}>{t('hero.settledText')}</Callout>;
  }
  const eyebrow = j.stage === 'ARRIVED' ? t('hero.arrived', { date: formatDate(j.arrived_at, locale) }) : j.stage === 'READY_TO_COME' ? t('hero.ready') : t('hero.admitted');
  return (
    <section className="cg-hero" aria-labelledby="cg-hero-title">
      <p className="cg-hero__eyebrow">{eyebrow}</p>
      {next ? (
        <>
          <p className="cg-hero__next">{t('hero.next')}</p>
          <h2 id="cg-hero-title" className="cg-hero__title">{t(`step.${next.key}.title`)}</h2>
          <p className="hg-muted">{t(`step.${next.key}.why`, { defaultValue: t(`step.${next.key}.sub`, { defaultValue: '' }) })}</p>
          {next.key === 'residence_card' && j.residence_card_due && <p className="hg-small"><DaysLeft date={j.residence_card_due} size="sm" /></p>}
          {next.link && next.link.startsWith('/housing') ? <ButtonLink as={Link} to={next.link} variant="primary">{t(`step.${next.key}.cta`, { defaultValue: t('hero.go') })}</ButtonLink>
            : <ButtonLink as={Link} to={`#${next.key === 'residence_card' ? 'residence' : next.key}`} variant="primary">{t(`step.${next.key}.cta`, { defaultValue: t('hero.go') })}</ButtonLink>}
        </>
      ) : <h2 id="cg-hero-title" className="cg-hero__title">{t('hero.allSet')}</h2>}
    </section>
  );
}

export default function Arrival() {
  const { t } = useCT();
  const api = useApi();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({ queryKey: ['arrival-journey'], queryFn: () => api.concierge.journey() });
  const arrived = useJourneyMutation(() => api.me.updateArrival({ arrived: true }), 'arrived.welcome');
  return (
    <div className="st-page">
      <PageIntro title={t('page.title')} subtitle={t('page.subtitle')} />
      <QueryState query={q} skeleton={<SkeletonCard lines={8} />}>
        {(j) => {
          if (j.stage === 'QUIET') {
            return <EmptyState icon={<Plane />} title={t('page.quietTitle')} text={t('page.quietText')} action={<ButtonLink as={Link} to="/" variant="secondary">{t('page.backHome')}</ButtonLink>} />;
          }
          return (
            <div className="sv-layout">
              <div className="sv-main">
                <Hero j={j} />
                {j.stage === 'ADMITTED' && <Callout tone="neutral" title={t('page.admittedTitle')}>{t('page.admittedText')}</Callout>}
                <section aria-labelledby="cg-steps-title">
                  <h2 id="cg-steps-title" className="hg-title-sm" style={{ marginBottom: 8 }}>{t(j.stage === 'ARRIVED' ? 'page.afterTitle' : 'page.beforeTitle')}</h2>
                  <Steps j={j} />
                </section>
              </div>
              <aside className="sv-side">
                <EmergencyNumbers emergency={j.emergency} compact />
                <div className="cg-panel">
                  <h2 className="hg-title-sm">{t('help.title')}</h2>
                  <p className="cg-note">{t('help.sideText')}</p>
                  <div><ButtonLink as={Link} to="/help" variant="secondary" icon={<LifeBuoy />}>{t('help.open')}</ButtonLink></div>
                </div>
                {j.stage === 'READY_TO_COME' && (
                  <div className="cg-panel">
                    <h2 className="hg-title-sm">{t('arrived.title')}</h2>
                    <p className="cg-note">{t('arrived.text')}</p>
                    <div><Button variant="secondary" icon={<PartyPopper />} onClick={() => setConfirm(true)}>{t('arrived.cta')}</Button></div>
                  </div>
                )}
              </aside>
              <Modal open={confirm} onClose={() => setConfirm(false)} title={t('arrived.confirmTitle')}
                footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>{t('common:actions.cancel')}</Button><Button variant="primary" loading={arrived.isPending} onClick={() => arrived.mutate(undefined, { onSuccess: () => setConfirm(false) })}>{t('arrived.confirm')}</Button></>}>
                <p>{t('arrived.confirmText')}</p>
              </Modal>
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}
