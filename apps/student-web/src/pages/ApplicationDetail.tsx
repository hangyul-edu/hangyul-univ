import { useApi } from '@hangyul/auth';
import { docLabel, localName } from '@hangyul/i18n';
import { CalendarClock, Landmark } from '@hangyul/icons';
import type { ApplicationDetail as Detail, ApplicationStatus, DocumentCategory, DocumentRequest } from '@hangyul/types';
import {
  Button, ButtonLink, Callout, DescriptionList, Field, Modal, QueryState, Section, SkeletonCard, StatusText,
  Textarea, UniMark, useToast, type ButtonVariant,
} from '@hangyul/ui';
import { applicationTone, formatDate, formatDateTime, formatMoney, formatRelative } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUpgradeOnRefusal } from '../lib/upgrade';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { MoneyTimeline, PaymentGuard } from '../components/MoneyPlan';
import type { MoneyLine } from '../lib/money';
import { DaysLeft, Krw, Timeline } from '../components/bits';
import { StrategyBlock } from '../components/success/Strategy';
import { SubmissionEvidenceLine, SubmissionHero } from '../components/success/Submission';
import { PackageLine } from '../components/dossier/DossierParts';
import { UploadModal } from '../components/UploadModal';
import { range } from '../lib/budget';
import { intakeLabel, tr, useT } from '../lib/i18n';
import { buildWorkspace, heroItem, type ItemState, type Lane, type WsItem } from '../lib/workspace';

const PRIMARY: ApplicationStatus[] = ['SUBMITTED', 'OFFER_ACCEPTED', 'DOCUMENT_PREPARATION', 'PROFILE_REVIEW', 'VISA_PREPARATION', 'VISA_SUBMITTED', 'VISA_ISSUED'];
const CONFIRM: ApplicationStatus[] = ['SUBMITTED', 'OFFER_ACCEPTED', 'WITHDRAWN'];

/** Transitions a student may trigger, ordered with the most important first. Withdraw is always last. */
export function studentActions(allowed: ApplicationStatus[]): ApplicationStatus[] {
  const main = PRIMARY.filter((s) => allowed.includes(s));
  return allowed.includes('WITHDRAWN') ? [...main, 'WITHDRAWN'] : main;
}

function Actions({ a, mode = 'primary', fallback }: { a: Detail; mode?: 'primary' | 'withdraw'; fallback?: React.ReactNode }) {
  const { t } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState<ApplicationStatus | null>(null);
  const [note, setNote] = useState('');
  const upgrade = useUpgradeOnRefusal();
  const m = useMutation({
    mutationFn: (to: ApplicationStatus) => api.applications.transition(a.id, { to, note: note.trim() || undefined }),
    onSuccess: (d, to) => {
      qc.setQueryData(['application', a.id], d);
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(t(`applicationDetail.done.${to}`, { defaultValue: t('applicationDetail.done.default') }));
      setConfirm(null);
      setNote('');
    },
    // V17: a DRAFT leaving DRAFT is one of the 지원 학교 최대 N곳 the plan sells, and the server refuses the
    // (N+1)th with its own numbers. That is not an error to apologise for — it is the plan boundary, so the
    // upgrade sheet takes it and the toast only sees the failures that really are failures.
    onError: (e) => { if (!upgrade.catchRefusal(e)) toast.error((e as Error).message); },
  });
  const all = studentActions(a.allowed_transitions);
  const actions = mode === 'withdraw' ? all.filter((s) => s === 'WITHDRAWN') : all.filter((s) => s !== 'WITHDRAWN');
  if (!actions.length) return mode === 'withdraw' ? null : <>{fallback}</>;
  const variant = (s: ApplicationStatus, i: number): ButtonVariant => (s === 'WITHDRAWN' ? 'link' : i === 0 ? 'primary' : 'secondary');
  return (
    <div className="sa-actions">
      {upgrade.sheet}
      {actions.map((s, i) => (
        <Button key={s} variant={variant(s, i)} className={s === 'WITHDRAWN' ? 'st-danger-text' : undefined} loading={m.isPending && m.variables === s}
          onClick={() => (CONFIRM.includes(s) ? setConfirm(s) : m.mutate(s))}>
          {t(`applicationDetail.transition.${s}`, { defaultValue: t(`common:appStatus.${s}`) })}
        </Button>
      ))}
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm ? t(`applicationDetail.confirm.${confirm}.title`) : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>{t('common:actions.cancel')}</Button>
            <Button variant={confirm === 'WITHDRAWN' ? 'danger' : 'primary'} loading={m.isPending} onClick={() => confirm && m.mutate(confirm)}>
              {confirm ? t(`applicationDetail.transition.${confirm}`) : ''}
            </Button>
          </>
        }
      >
        {confirm && (
          <div className="hg-stack">
            <p>{t(`applicationDetail.confirm.${confirm}.text`, { university: localName(a.university) })}</p>
            {confirm === 'OFFER_ACCEPTED' && <Callout tone="info" icon={<Landmark aria-hidden />}>{t('applicationDetail.tuition.direct')}</Callout>}
            {confirm === 'WITHDRAWN' && (
              <Field label={t('applicationDetail.confirm.reason')} htmlFor="withdraw-note" optional>
                <Textarea id="withdraw-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

type Phase = 'prep' | 'review' | 'decision' | 'enrol' | 'visa' | 'done';
export function phaseOf(status: ApplicationStatus): Phase {
  if (['DRAFT', 'PROFILE_REVIEW', 'DOCUMENT_PREPARATION', 'READY'].includes(status)) return 'prep';
  if (['SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW'].includes(status)) return 'review';
  if (['OFFERED', 'WAITLISTED', 'REJECTED'].includes(status)) return 'decision';
  if (status.startsWith('VISA_')) return 'visa';
  if (status === 'ENROLLED' || status === 'WITHDRAWN') return 'done';
  return 'enrol';
}

type Upload = (requestId: string) => void;

/** V22 (REPORT §246 A3): who works this application — the Hangyul team (never a staff name) and the agency it works with. */
function useCounselor(a: Detail): { name: string | null; org: string | null } {
  const { t } = useT();
  const api = useApi();
  const q = useQuery({ queryKey: ['assignment'], queryFn: () => api.me.assignment(), staleTime: 300_000 });
  const as = q.data;
  const same = as && (!a.agency || as.organization_id === a.agency.id);
  return { name: same && as?.counselor ? t('messages.team') : null, org: a.agency?.name ?? as?.organization ?? null };
}

function LaneMark({ state }: { state: ItemState }) {
  const glyph = { done: '✓', todo: '!', late: '!', active: '●', waiting: '○' }[state];
  return <span className="ws-lane__mark" aria-hidden>{glyph}</span>;
}

/** The three responsibility lanes ARE the checklist: every requirement once, in its true state. */
function Lanes({ a, items, counselor, onUpload, heroKey }: { a: Detail; items: WsItem[]; counselor: { name: string | null; org: string | null }; onUpload: Upload; heroKey?: string }) {
  const { t } = useT();
  const lanes: { key: Lane; who: React.ReactNode; empty: string }[] = [
    // V25 (REPORT §313 S4): each lane names the work, not only the party — 내가 할 일 · 한귤이 하는 일 · 대학이 확인하는 일.
    { key: 'you', who: t('v25.lane.you'), empty: t('v4.ws.empty.you') },
    { key: 'team', who: <>{t('v25.lane.team')}{counselor.org && <span className="ws-lane__org">{counselor.org}</span>}</>, empty: t('v4.ws.empty.team') },
    { key: 'university', who: <>{t('v25.lane.university')}<span className="ws-lane__org">{localName(a.university)}</span></>, empty: t('v4.ws.empty.university') },
  ];
  return (
    <section className="ws-lanes v4-lanes" aria-label={t('workspace.whoLabel')}>
      {lanes.map((l) => {
        const list = items.filter((i) => i.lane === l.key);
        return (
          <div key={l.key} className="ws-lane">
            <h3 className="ws-lane__who">{l.who}</h3>
            {list.length === 0 ? <p className="v4-lane__empty">{l.empty}</p> : (
              <ul className="ws-lane__list">
                {list.map((it) => (
                  <li key={it.key} data-state={it.state}>
                    <LaneMark state={it.state} />
                    <span className="hg-sr-only">{t(`v4.ws.state.${it.state}`)}: </span>
                    <span className="v4-lane__text">
                      {it.href ? <Link to={it.href} className="v4-lane__title">{it.title}</Link> : <span className="v4-lane__title">{it.title}</span>}
                      {it.detail && it.key !== heroKey && <span className="v4-lane__detail">{it.detail}</span>}
                      {it.requestId && <Button size="sm" variant="secondary" className="v4-lane__btn" onClick={() => onUpload(it.requestId!)}>{it.action}</Button>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** Hero: the single next thing, named — why, what happens if it isn't done, when, and one action. */
function NextStep({ a, item, count, counselor, onUpload }: { a: Detail; item: WsItem | null; count: number; counselor: { name: string | null }; onUpload: Upload }) {
  const { t, locale } = useT();
  const phase = phaseOf(a.status);
  if (!item) {
    const statusText = tr(t, `applicationDetail.statusText.${a.status}`, '');
    return (
      <section className="sa-next v4-hero" aria-labelledby="sa-next-title">
        <div className="sa-next__text">
          <p className="v4-hero__eyebrow">{t('v4.ws.nextEyebrow')}</p>
          <h2 id="sa-next-title" className="hg-title-md">{t(`v4.ws.idle.${phase}`, { university: localName(a.university), name: counselor.name ?? t('v4.ws.yourCounselor') })}</h2>
          {statusText && <p className="hg-muted">{statusText}</p>}
        </div>
        <div className="sa-next__actions"><Actions a={a} /></div>
      </section>
    );
  }
  const consequence = item.requestId ? t('v4.ws.consequence.request', { university: localName(a.university) })
    : item.key === 'tuition' ? t('v4.ws.consequence.tuition', { university: localName(a.university) })
    : phase === 'prep' ? t('v4.ws.consequence.prep', { university: localName(a.university) }) : null;
  return (
    <section className="sa-next v4-hero" aria-labelledby="sa-next-title">
      <div className="sa-next__text">
        <p className="v4-hero__eyebrow">{t('v4.ws.nextEyebrow')}</p>
        <h2 id="sa-next-title" className="v4-hero__title">{item.title}</h2>
        {item.detail && <p className="v4-hero__why">{item.detail}</p>}
        {consequence && <p className="v4-hero__consequence">{consequence}</p>}
        {item.due && <p className="v4-hero__due">{t('v4.ws.due', { date: formatDate(item.due, locale, { month: 'short', day: 'numeric' }) })} · <DaysLeft date={item.due} /></p>}
      </div>
      <div className="sa-next__actions">
        {item.requestId ? <Button variant="primary" size="lg" onClick={() => onUpload(item.requestId!)}>{item.action}</Button>
          : item.href ? <ButtonLink as={Link} to={item.href} variant="primary" size="lg">{item.action ?? t('v4.ws.action.open')}</ButtonLink>
          : <Actions a={a} />}
        {count > 1 && <p className="hg-small hg-muted">{t('v4.ws.more', { count: count - 1 })}</p>}
      </div>
    </section>
  );
}

/** "You pay ₩X to {university} by {date} (tuition ₩Y − scholarship ₩Z)" — computed only when the offer states it exactly. */
function PayLine({ a }: { a: Detail }) {
  const { t, locale } = useT();
  const api = useApi();
  const q = useQuery({ queryKey: ['offers'], queryFn: () => api.me.offers(), staleTime: 60_000 });
  const o = q.data?.items.find((x) => x.application_id === a.id);
  if (!o || o.payment.pay === null) return null;
  const m = (v: number | null) => formatMoney(v ?? 0, 'KRW', locale);
  const money = (o as typeof o & { money?: MoneyLine[] }).money ?? [];
  return (
    <div className="v4-pay">
      <p className="v4-pay__main">{a.tuition_due ? t('v4.offer.pay', { amount: m(o.payment.pay), university: localName(a.university), date: formatDate(a.tuition_due, locale, { month: 'short', day: 'numeric' }) })
        : t('v4.offer.payNoDate', { amount: m(o.payment.pay), university: localName(a.university) })}{a.tuition_due && <> <DaysLeft date={a.tuition_due} /></>}</p>
      {o.payment.scholarship ? <p className="v4-pay__calc">{t('v4.offer.calc', { tuition: m(o.payment.tuition), scholarship: m(o.payment.scholarship) })}</p>
        : <p className="v4-pay__calc">{t('v4.offer.calcNoSchol', { tuition: m(o.payment.tuition) })}</p>}
      {o.first_year_after_scholarship_krw && <p className="v4-pay__year">{t('v4.offer.firstYear', { range: range(o.first_year_after_scholarship_krw.low, o.first_year_after_scholarship_krw.high, 'KRW', undefined, locale) })}</p>}
      {/* V9 S2/S8: the payment route (directly, own name) and what comes after the tuition — payee, when, refundable. */}
      <PaymentGuard />
      {money.length > 0 && (
        <details className="v9-asis">
          <summary>{t('v9.money.whenTitle')}</summary>
          <MoneyTimeline lines={money.filter((l) => l.when !== 'APPLICATION')} hideKeys={['hangyul_fee']} />
        </details>
      )}
    </div>
  );
}


/** Offer: what it is, what the student actually pays and by when, what happens next. Calm, not a celebration screen. */
function AdmissionResult({ a }: { a: Detail }) {
  const { t, locale } = useT();
  const api = useApi();
  const offers = useQuery({ queryKey: ['offers'], queryFn: () => api.me.offers(), staleTime: 60_000 });
  const otherOffers = (offers.data?.items ?? []).filter((o) => o.application_id !== a.id && o.status === 'OFFERED').length;
  return (
    <section className="ws-offer v4-offer" aria-labelledby="ws-offer-title">
      <p className="ws-offer__eyebrow">{t('ws3.offer.eyebrow')}</p>
      <h2 id="ws-offer-title" className="ws-offer__title">{t('v4.offer.title', { university: localName(a.university) })}</h2>
      <p className="ws-offer__text">{localName(a.program)} · {intakeLabel(t, a.intake.term, a.intake.year)}</p>
      <PayLine a={a} />
      {a.offer_scholarship_note && (() => {
        // The note is the university's own offer wording: quoted as written, inside a translated sentence.
        const [before, after = ''] = t('ws3.offer.scholarship', { note: '\u0000' }).split('\u0000');
        return <p className="ws-offer__schol">{before}<span data-user-content lang="en">{a.offer_scholarship_note}</span>{after}</p>;
      })()}
      <div className="ws-offer__actions"><Actions a={a} /></div>
      {otherOffers > 0 && <p className="hg-small"><Link to="/applications" className="hg-link">{t('v4.offer.compare', { count: otherOffers + 1 })}</Link></p>}
      <h3 className="ws-offer__next">{t('ws3.offer.nextTitle')}</h3>
      <ol className="ws-offer__steps">
        {[2, 3, 4, 5].map((i) => <li key={i}><span className="hg-medium">{t(`ws3.offer.step${i}.title`)}</span> <span className="hg-muted">{t(`ws3.offer.step${i}.text`)}</span></li>)}
      </ol>
      <p className="hg-small hg-muted">{t('v4.offer.ifNothing', { date: a.tuition_due ? formatDate(a.tuition_due, locale, { month: 'short', day: 'numeric' }) : '—' })}</p>
    </section>
  );
}

function Tuition({ a }: { a: Detail }) {
  const { t, locale } = useT();
  const paid = !['OFFERED', 'OFFER_ACCEPTED', 'TUITION_PENDING'].includes(a.status);
  return (
    <Section title={t('ws3.tuition.title')} sub={t('ws3.tuition.sub')}>
      {!paid && <PayLine a={a} />}
      <DescriptionList items={[
        { label: t('v4.offer.invoice'), value: <Krw value={a.tuition_amount_krw} /> },
        { label: t('applicationDetail.tuition.due'), value: a.tuition_due ? <span className="hg-row-wrap">{formatDate(a.tuition_due, locale)} <DaysLeft date={a.tuition_due} /></span> : t('ws3.tuition.dueUnknown') },
        { label: t('ws3.tuition.status'), value: <StatusText tone={paid ? 'success' : 'warning'}>{paid ? t('ws3.tuition.confirmed') : t('ws3.tuition.waiting')}</StatusText> },
        { label: t('applicationDetail.tuition.scholarship'), value: a.offer_scholarship_note ? <span data-user-content lang="en">{a.offer_scholarship_note}</span> : '—' },
      ]} />
      {!paid && <Callout tone="neutral" icon={<Landmark aria-hidden />} title={t('ws3.tuition.howTitle')}>{t('ws3.tuition.how')}</Callout>}
    </Section>
  );
}


/** PRIMARY QUESTION: "What is left before submission, and who is doing it?" — after an offer: "What do I pay, to whom,
 * by when — and how do I pay safely?" (V9 S2 payment-route guard + money timeline on the offer). */
const PREP_STATES = new Set(['DRAFT', 'PROFILE_REVIEW', 'DOCUMENT_PREPARATION', 'READY']);

export default function ApplicationDetail() {
  const { t, locale } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['application', id], queryFn: () => api.applications.get(id) });
  const [uploading, setUploading] = useState<DocumentRequest | null>(null);
  const fulfil = useMutation({
    mutationFn: ({ rid, doc }: { rid: string; doc: string }) => api.applications.fulfillRequest(rid, doc),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['application', id] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success(t('ws3.request.sent')); },
    onError: (e) => toast.error((e as Error).message),
  });
  const counselor = useCounselor(q.data ?? ({ agency: null } as unknown as Detail));
  return (
    <QueryState query={q} skeleton={<div className="st-page"><SkeletonCard lines={3} /><SkeletonCard lines={6} /></div>}>
      {(a) => {
        const phase = phaseOf(a.status);
        const items = buildWorkspace(a, t, { counselor: counselor.name, formatDate: (d) => formatDate(d, locale, { month: 'short', day: 'numeric' }) });
        const hero = heroItem(items);
        const historyNote = (note: string) => {
          const r = (a.document_requests ?? []).find((x) => note === `Requested: ${x.label} — ${x.note}`);
          return r ? <>{t('ws3.uni.asked', { label: docLabel(t, r) })} — <span data-user-content>“{r.note}”</span></> : <span data-user-content>{note}</span>;
        };
        const youCount = items.filter((i) => i.lane === 'you' && i.state === 'todo').length;
        const onUpload = (rid: string) => setUploading((a.document_requests ?? []).find((r) => r.id === rid) ?? null);
        const inTuition = ['OFFER_ACCEPTED', 'TUITION_PENDING', 'TUITION_PAID', 'ADMISSION_CERTIFICATE_PENDING'].includes(a.status);
        return (
          <div className="st-page sa-page">
            <nav className="hg-crumbs" aria-label={t('applicationDetail.crumbs')}><Link to="/applications">{t('common:nav.applications')}</Link><span aria-hidden>/</span><span>{localName(a.university)}</span></nav>
            <header className="ws-head">
              <UniMark name={localName(a.university)} color={a.university.brand_color} photo={a.university.photo} size="lg" />
              <div className="hg-grow" style={{ minWidth: 0 }}>
                <h1 className="su-head__title">{localName(a.university)}</h1>
                <p className="hg-muted">{localName(a.program)} · {intakeLabel(t, a.intake.term, a.intake.year)}</p>
                <div className="ws-head__facts">
                  <StatusText tone={applicationTone[a.status]}>{t(`stage.${a.status}`, { defaultValue: t(`common:appStatus.${a.status}`) })}</StatusText>
                  {phase === 'prep' && <span>{t('ws3.closes', { date: formatDate(a.intake.application_deadline, locale) })} · <DaysLeft date={a.intake.application_deadline} /></span>}
                  {/* V26 (REPORT §334 S8, brief §21): what changed last, so a returning student sees movement without opening the history. */}
                  {a.history.length > 0 && (() => {
                    const last = a.history[a.history.length - 1];
                    return <span className="sa26-latest">{t('v26.app.latest', { stage: t(`stage.${last.to}`, { defaultValue: t(`common:appStatus.${last.to}`) }), when: formatRelative(last.at, locale) })}</span>;
                  })()}
                </div>
              </div>
            </header>
            {/* V27 (REPORT §357): no verified official guide yet → say so instead of showing a checklist that may be wrong. */}
            {a.admission_guide?.state === 'REVIEW_REQUIRED' && a.admission_guide.blocks && (
              <Callout tone="info" title={t('v27.guide.reviewTitle')}>{t('v27.guide.reviewBody', { university: localName(a.university) })}</Callout>
            )}
            {a.admission_guide?.state === 'PREVIOUS_ROUND' && PREP_STATES.has(a.status) && (
              <p className="hg-small hg-muted">{t('v27.guide.previousRound')}</p>
            )}
            {a.status === 'OFFERED' ? <AdmissionResult a={a} />
              : a.status === 'READY' && !hero ? <SubmissionHero a={a} counselorName={counselor.name} />
              : <NextStep a={a} item={hero} count={youCount} counselor={counselor} onUpload={onUpload} />}
            {(phase === 'prep' || ['SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW', 'WAITLISTED'].includes(a.status)) && <PackageLine applicationId={a.id} />}
            <Lanes a={a} items={items} counselor={counselor} onUpload={onUpload} heroKey={a.status === 'OFFERED' ? undefined : hero?.key} />
            <StrategyBlock appId={a.id} />
            {a.interview_at && (
              <Callout tone="info" icon={<CalendarClock aria-hidden />} title={t('applicationDetail.interview.title')}>
                {t('applicationDetail.interview.text', { when: formatDateTime(a.interview_at, locale) })}
              </Callout>
            )}
            {inTuition && <Tuition a={a} />}
            <div className="sa-overview">
              <Section title={t('workspace.details')}>
                <DescriptionList items={[
                  { label: t('applicationDetail.info.start'), value: formatDate(a.intake.semester_start, locale) },
                  { label: t('applicationDetail.info.degree'), value: t(`common:degree.${a.program.degree_level}`) },
                  { label: t('applicationDetail.info.language'), value: t(`common:instruction.${a.program.instruction_language}`) },
                  ...(a.submitted_at ? [{ label: t('applicationDetail.info.submitted'), value: formatDate(a.submitted_at, locale) }] : []),
                  ...(a.external_reference ? [{ label: t('applicationDetail.info.reference'), value: a.external_reference }] : []),
                ]} />
                {phase !== 'prep' && <SubmissionEvidenceLine a={a} />}
              </Section>
              <Section title={t('v4.ws.help')}>
                <p className="hg-muted hg-small">{counselor.name ? t('v4.ws.helpText', { name: counselor.name }) : t('v4.ws.helpTextNoName')}</p>
                <div className="hg-row-wrap" style={{ marginTop: 8 }}>
                  {a.agency ? <ButtonLink as={Link} to="/messages" size="sm">{counselor.name ? t('v4.ws.message', { name: counselor.name }) : t('v4.ws.messageTeam')}</ButtonLink>
                    : <Link to="/services" className="hg-link">{t('dashboard.counselor.noneCta')}</Link>}
                </div>
                {/* A university's request is recorded as "Requested: <label> — <note>": name the document in the reader's
                    language and quote the university's note; any other note was written by a person and is shown as written. */}
                <details className="v4-history">
                  <summary>{t('v4.ws.history', { count: a.history.length })}</summary>
                  <Timeline items={[...a.history].reverse().map((h, i) => ({
                    key: `${h.to}-${i}`,
                    title: t(`stage.${h.to}`, { defaultValue: t(`common:appStatus.${h.to}`) }),
                    meta: <>{formatDateTime(h.at, locale)} · {t(`applicationDetail.actor.${h.actor_org_type ?? 'SYSTEM'}`, { defaultValue: h.actor })}{h.note ? <> — {historyNote(h.note)}</> : ''}</>,
                    state: i === 0 ? 'active' : 'done',
                  }))} />
                </details>
                <div className="sa-withdraw"><Actions a={a} mode="withdraw" /></div>
              </Section>
            </div>
            {uploading && (
              <UploadModal open onClose={() => setUploading(null)} target={{ category: (uploading.category ?? 'OTHER') as DocumentCategory, title: uploading.label, requestId: uploading.id, applicationId: a.id }}
                onUploaded={(doc) => { fulfil.mutate({ rid: uploading.id, doc }); setUploading(null); }} />
            )}
          </div>
        );
      }}
    </QueryState>
  );
}

