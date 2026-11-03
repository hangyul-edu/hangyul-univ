/**
 * PRIMARY QUESTION: "What do I need now for my visa?"
 * V9 S6: ≤ 3 phone screens — route (where the official action happens) · ready count · needed now · who provides · next;
 * everything else folds into one-line rows. Money rules are translated keys + params; the embassy's own words only
 * behind "as published".
 *
 * Student visa (V5 visa concierge) — "a calm expert sitting beside me".
 * One resolved route (post + method) from the researched embassy playbook, what needs the student now (name, why, who,
 * status, source, verified date), documents reused from the dossier, the preparation form (the student's own check —
 * never submitted or declared by Hangyul), appointment / official hand-off / submission with evidence, and help.
 * Phone-first (390 px). Research wording (English) only appears inside "exact wording" disclosures.
 */
import { useApi } from '@hangyul/auth';
import { Check, ExternalLink, FileUp, LifeBuoy } from '@hangyul/icons';
import { useLocale, localName } from '@hangyul/i18n';
import type { DocumentCategory, VisaDisplayStatus, VisaRouteDoc, VisaRoutePlan, VisaStatus } from '@hangyul/types';
import { VISA_STATUSES } from '@hangyul/types';
import { Button, ButtonLink, Callout, Field, Input, JourneyRail, OptionCards, QueryState, Section, Select, SkeletonCard, StatusText, Textarea, useToast } from '@hangyul/ui';
import { countryName, formatDate, formatMoney } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { PageIntro } from '../components/bits';
import { FundsToShowBlock } from '../components/MoneyPlan';
import type { FundsToShow, ParsedFunds } from '../lib/money';
import { UploadModal, type UploadTarget } from '../components/UploadModal';
import { docAction, formProgress, groupDocs, nowDoc, postKey, RAIL, railPhase, trackStage } from '../lib/visaroute';
import '../visaroute.css';

const FLOW: VisaStatus[] = VISA_STATUSES.filter((s) => s !== 'REJECTED' && s !== 'ADDITIONAL_DOCUMENTS');

/** Legacy helper kept for the V3 component test: the visa status timeline. */
export function visaTimeline(current: VisaStatus): { key: VisaStatus; state: 'done' | 'active' | 'todo' }[] {
  const flow: VisaStatus[] = current === 'ADDITIONAL_DOCUMENTS' ? [...FLOW.slice(0, FLOW.indexOf('SUBMITTED') + 1), 'ADDITIONAL_DOCUMENTS', ...FLOW.slice(FLOW.indexOf('SUBMITTED') + 1)]
    : current === 'REJECTED' ? [...FLOW.slice(0, FLOW.indexOf('SUBMITTED') + 1), 'REJECTED'] : FLOW;
  const idx = flow.indexOf(current);
  return flow.map((s, i) => ({ key: s, state: i < idx ? 'done' : i === idx ? 'active' : 'todo' }));
}

const KEY = ['visa', 'route'];
const TONE: Record<VisaDisplayStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  PREPARING: 'info', READY: 'success', SUBMITTED: 'info', EMBASSY_REQUEST: 'warning', APPROVED: 'success', ISSUED: 'success', NEEDS_ATTENTION: 'danger',
};
const STOP = new Set(['NO_ROUTE', 'NOT_VERIFIED', 'OTHER_RESIDENCE', 'IN_KOREA', 'NEEDS_PROFILE', 'NEEDS_PROGRAM']);

function useVT() {
  return useLocale(['visaroute', 'student', 'common']);
}

/** Mutations return the whole plan; the page swaps it in place. */
function usePlanMutation<A>(fn: (a: A) => Promise<VisaRoutePlan>, ok?: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useVT();
  return useMutation({
    mutationFn: fn,
    onSuccess: (plan) => {
      qc.setQueryData(KEY, plan);
      ['visa', 'dashboard', 'tasks', 'documents', 'dossier'].forEach((k) => qc.invalidateQueries({ queryKey: [k], predicate: (q) => q.queryKey.join('/') !== KEY.join('/') }));
      if (ok) toast.success(t(ok));
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

const TODAY = () => new Date().toISOString().slice(0, 10);

/** "Get it on or after X" only while X is still ahead; otherwise any copy issued from now is valid on the date. */
function timingText(t: (k: string, o?: Record<string, unknown>) => string, timing: NonNullable<VisaRouteDoc['timing']>, locale: string) {
  if (timing.get_after && timing.get_after > TODAY()) return t('timing.getAfter', { date: fmt(timing.get_after, locale), appointment: fmt(timing.valid_on, locale) });
  if (timing.valid_on) return t('timing.nowOk', { appointment: fmt(timing.valid_on, locale) });
  return t('timing.noDate', { days: timing.days });
}

function fmt(iso: unknown, locale: string) {
  return typeof iso === 'string' ? formatDate(iso, locale, { dateStyle: 'medium' }) : '';
}

function useNames() {
  const { t, locale } = useVT();
  const docName = (key: string, fallback?: string) => t(`doc.${key}.name`, { defaultValue: fallback ?? key });
  const post = (p: { kind: string; key: string; city: string } | null | undefined) => {
    if (!p) return '';
    const k = postKey(p as never);
    return t(k.key, { city: t(k.cityKey, { defaultValue: k.city }) });
  };
  const reason = (d: VisaRouteDoc) => {
    const p = { ...d.reason.params } as Record<string, unknown>;
    for (const f of ['date', 'appointment']) if (typeof p[f] === 'string') p[f] = fmt(p[f], locale);
    if (d.reason.code === 'NEEDS_LEGALIZATION') return d.legalization ? t(`docs.legalization.${d.legalization === 'CONSULAR' ? 'CONSULAR' : 'APOSTILLE'}`) : t('reason.NEEDS_LEGALIZATION');
    return t(`reason.${d.reason.code}`, { ...p, defaultValue: t(`docStatus.${d.status}`) });
  };
  return { docName, post, reason };
}

export default function Visa() {
  const { t } = useVT();
  const api = useApi();
  const q = useQuery({ queryKey: KEY, queryFn: () => api.visaRoute.mine() });
  return (
    <div className="st-page vr-page">
      <PageIntro title={t('page.title')} subtitle={t('page.subtitle')} />
      <QueryState query={q} skeleton={<SkeletonCard lines={6} />}>{(plan) => <VisaPlan plan={plan} />}</QueryState>
    </div>
  );
}

function VisaPlan({ plan }: { plan: VisaRoutePlan }) {
  const { t } = useVT();
  const [upload, setUpload] = useState<(UploadTarget & { key: string }) | null>(null);
  const api = useApi();
  const link = usePlanMutation((a: { key: string; document_id?: string; received?: boolean }) => api.visaRoute.item(a.key, { document_id: a.document_id, received: a.received }));
  const vtype = plan.inputs.visa_type;
  const uni = plan.inputs.university;
  const stopped = STOP.has(plan.status);
  const nowKey = plan.next?.key;
  const trackNow = !!nowKey && ['book', 'go_to_appointment', 'embassy_request', 'upload_visa', 'apply', 'submit', 'decision', 'refused'].includes(nowKey)
    || (!!plan.case && !['PREPARING', 'READY'].includes(plan.display_status));
  const onUpload = (d: VisaRouteDoc) => setUpload({ key: d.key, category: (d.category as DocumentCategory | null) ?? 'OTHER', title: d.category ? undefined : t(`doc.${d.key}.name`, { defaultValue: d.key }) });
  return (
    <div className="sv-layout v9-visa">
      <div className="sv-main">
        <div className="sv-head">
          <div>
            <h2 className="hg-title-md">{vtype ? t('page.journey', { type: vtype }) : t('page.journeyGeneric')}</h2>
            {uni && <p className="hg-muted hg-small">{[localName(uni), localName(plan.inputs.program)].filter(Boolean).join(' · ')}</p>}
          </div>
          <StatusText tone={TONE[plan.display_status]}>{t(`status.${plan.display_status}`)}</StatusText>
        </div>
        <JourneyRail label={t('page.railLabel')} current={railPhase(plan)} steps={RAIL.map((p) => ({ key: p, label: t(`rail.${p}`) }))} />
        {stopped ? <StoppedState plan={plan} /> : (
          <>
            <RouteLine plan={plan} />
            <NowCard plan={plan} onUpload={onUpload} onReceived={(key) => link.mutate({ key, received: true })} busy={link.isPending} />
            <ThenLine plan={plan} />
            {/* V9 S6: the current step's own section stays open (its buttons jump to it); the rest is one line each. */}
            {plan.case && plan.form && nowKey === 'form' && <FormPrep plan={plan} />}
            {plan.case && trackNow && <Track plan={plan} />}
            <div className="v9-folds">
              <Caveats plan={plan} />
              <Fold title={t('docs.title')} meta={plan.pack ? t('docs.progress', { ready: plan.pack.ready, needed: plan.pack.needed }) : undefined}>
                <Documents plan={plan} onUpload={onUpload} onReceived={(key, on) => link.mutate({ key, received: on })} busy={link.isPending} bare />
              </Fold>
              <Money plan={plan} />
              {plan.case && plan.form && nowKey !== 'form' && (
                <Fold title={t('form.title')} meta={t('form.progress', formProgress(plan))}><FormPrep plan={plan} bare /></Fold>
              )}
              {plan.case && !trackNow && (plan.display_status !== 'PREPARING' || plan.case.appointment?.on) && (
                <Fold title={t('track.title')}><Track plan={plan} /></Fold>
              )}
              {plan.steps.length > 0 && <Fold title={t('steps.title')} meta={t('v5.stepsShow', { count: plan.steps.length })}><Steps plan={plan} bare /></Fold>}
              <Fold title={t('help.title')} open={!!plan.help?.issue}><Help plan={plan} bare /></Fold>
            </div>
          </>
        )}
        {stopped && <Help plan={plan} />}
      </div>
      {upload && (
        <UploadModal open onClose={() => setUpload(null)} target={upload}
          onUploaded={(id) => { if (plan.case) link.mutate({ key: upload.key, document_id: id }); }} />
      )}
    </div>
  );
}

/** One folded row: title + one-line meta; opens in place. */
function Fold({ title, meta, open, children }: { title: string; meta?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="v9-fold" open={open || undefined}>
      <summary><span className="v9-fold__t">{title}</span>{meta && <span className="v9-fold__m">{meta}</span>}</summary>
      <div className="v9-fold__body">{children}</div>
    </details>
  );
}

/** "Then:" — the step after the current one, so the student sees what comes next without opening the plan. */
function ThenLine({ plan }: { plan: VisaRoutePlan }) {
  const { t } = useVT();
  const idx = plan.steps.findIndex((s) => s.state === 'current');
  const next = idx >= 0 ? plan.steps.slice(idx + 1).find((s) => s.state !== 'done') : null;
  if (!next) return null;
  return <p className="v9-then"><span className="v9-then__k">{t('student:v9.visa.then')}</span> {t(`step.${next.key}.title`)} · <span className="hg-muted">{t('provides', { who: t(`who.${next.who}`, { defaultValue: t('who.you') }) })}</span></p>;
}

function StoppedState({ plan }: { plan: VisaRoutePlan }) {
  const { t, locale } = useVT();
  const country = plan.status === 'OTHER_RESIDENCE' ? countryName(plan.inputs.residence_country, locale) : countryName(plan.inputs.nationality, locale);
  const posts = plan.posts ?? [];
  const { post } = useNames();
  return (
    <>
      <Callout tone="info" title={t(`state.${plan.status}`, { country })}>
        {plan.status === 'NOT_VERIFIED' && posts.length > 0 && (
          <ul className="vr-plain">{posts.map((p) => <li key={p.key}>{p.url ? <a className="hg-link" href={p.url} target="_blank" rel="noreferrer">{post(p)}</a> : post(p)}</li>)}</ul>
        )}
      </Callout>
      {(plan.fallback_checklist?.length ?? 0) > 0 && (
        <Section title={t('state.fallbackTitle')}>
          <ul className="vr-list">
            {plan.fallback_checklist!.map((c) => (
              <li key={c.key} className="vr-row"><div className="vr-row__main"><span className="vr-row__name">{t(`student:v4.visaStep.${c.name_key ?? ''}`, { defaultValue: c.name ?? c.title })}</span></div></li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

function RouteLine({ plan }: { plan: VisaRoutePlan }) {
  const { t, locale } = useVT();
  const { post } = useNames();
  const r = plan.route!;
  const m = plan.method;
  const method = m?.code ? t(`method.${m.code}`) : null;
  return (
    <section className="vr-route" aria-label={t('route.why')}>
      <p className="vr-route__line">
        {plan.post ? t('route.oneLine', { post: post(plan.post), method: method ?? '' }).replace(/ · $/, '') : t('route.postPending')}
      </p>
      <p className="vr-route__meta">
        {t('route.visaType', { type: r.visa_type })} · {t(`verify.${r.verification_status === 'VERIFIED' ? 'VERIFIED' : 'PARTIAL'}`, { date: fmt(r.verified_at, locale) })}
      </p>
      <details className="vr-why">
        <summary className="hg-link">{t('route.why')}</summary>
        <ul className="vr-plain">
          {(plan.why ?? []).map((w) => <li key={w.code}>{t(`why.${w.code}`, { ...w.params, city: plan.post ? t(`city.${plan.post.key}`, { defaultValue: plan.post.city }) : '', country: countryName(plan.inputs.nationality, locale) })}</li>)}
          {m?.note_code && <li>{t(`methodNote.${m.note_code}`, { defaultValue: t(`student:v9.visa.methodNote.${m.note_code}`) })}</li>}
          {plan.centre && <li>{t('route.centreToo', { centre: post(plan.centre) })}</li>}
          <li>{t('why.rule')}</li>
          <li>{(m as typeof m & { fee_free?: boolean })?.fee_free ? t('student:v9.visa.feeNone') : m?.fees?.amount ? t('route.feeAmount', { amount: m.fees.amount, currency: m.fees.currency ?? '' }) : t('route.feeUnknown')}</li>
        </ul>
        <p className="vr-sources">
          {t('route.officialSources')}: {r.sources.slice(0, 3).map((s, i) => (
            <span key={`${s.url}-${i}`}>{i > 0 && ' · '}<a className="hg-link" href={s.url} target="_blank" rel="noreferrer">{t('route.source')} {i + 1}</a>{s.verified_at ? ` (${t('route.checked', { date: fmt(s.verified_at, locale) })})` : ''}</span>
          ))}
        </p>
        <details className="vr-exact">
          <summary className="hg-link hg-small">{t('route.exactWording')}</summary>
          <div className="vr-exact__body" lang="en">
            {m?.details_en && <p>{m.details_en}</p>}
            {r.processing_time_en && <p><strong>{t('route.processing')}:</strong> {r.processing_time_en}</p>}
            {m?.fees?.details && <p>{m.fees.details}</p>}
            {r.special_notes_en.map((n) => <p key={n}>{n}</p>)}
          </div>
        </details>
      </details>
    </section>
  );
}

function Caveats({ plan }: { plan: VisaRoutePlan }) {
  const { t, locale } = useVT();
  if (!plan.caveats.length) return null;
  // V9 S6: honest but folded — one line says how many details are unconfirmed; the list is one tap away.
  return (
    <details className="v9-fold v9-fold--warn">
      <summary><span className="v9-fold__t">{t('caveat.title')}</span><span className="v9-fold__m">{t('student:v9.visa.caveats', { count: plan.caveats.length })}</span></summary>
      <ul className="vr-plain v9-fold__body">
        {plan.caveats.map((c) => <li key={c.code}>{t(`caveat.${c.code}`, { ...c.params, date: fmt(c.params.date, locale), defaultValue: t(`student:v9.visa.caveat.${c.code}`, { ...c.params, date: fmt(c.params.date, locale) }) })}</li>)}
      </ul>
    </details>
  );
}

function Question({ plan }: { plan: VisaRoutePlan }) {
  const { t } = useVT();
  const api = useApi();
  const q = plan.question!;
  // The area names are the consulate's own jurisdiction wording (English): outside English the option names the
  // consulate city in the reader's language and quotes the jurisdiction underneath.
  const city = (o: { post_key: string }) => t(`city.${o.post_key}`, { defaultValue: o.post_key });
  // V6: the option names the consulate city ("Area served by Da Nang"); the consulate's own area wording sits underneath
  // without research annotations in parentheses, so a student reads a place, not a source note.
  const area = (label: string) => label.replace(/\s*\([^)]*\)/g, '').replace(/;.*$/, '').trim();
  const [value, setValue] = useState<string | null>(null);
  const save = usePlanMutation((v: string) => api.visaRoute.answer({ value: v }), 'track.saved');
  return (
    <form className="vr-question" onSubmit={(e) => { e.preventDefault(); if (value) save.mutate(value); }}>
      <p className="hg-small hg-muted">{t('question.why')}</p>
      {q.options.length <= 6 ? (
        <OptionCards<string> label={t(`question.${q.kind}`)} min={150} value={value} onChange={(v) => setValue(v as string)} options={q.options.map((o) => ({ value: o.value, label: t('question.servedBy', { city: city(o) }), sub: <span lang="en" data-source-quote title={o.label}>{area(o.label)}</span> }))} />
      ) : (
        <Field label={t(`question.${q.kind}`)} htmlFor="vr-q">
          <Select id="vr-q" value={value ?? ''} onChange={(e) => setValue(e.target.value || null)}>
            <option value="">—</option>
            {q.options.map((o) => <option key={o.value} value={o.value}>{`${t('question.servedBy', { city: city(o) })} — ${area(o.label)}`}</option>)}
          </Select>
        </Field>
      )}
      <div className="vr-actions">
        <Button type="submit" variant="primary" disabled={!value} loading={save.isPending}>{t('question.save')}</Button>
        <Link to="/messages" className="hg-link hg-small">{t('question.unsure')}</Link>
      </div>
    </form>
  );
}

function NowCard({ plan, onUpload, onReceived, busy }: { plan: VisaRoutePlan; onUpload: (d: VisaRouteDoc) => void; onReceived: (key: string) => void; busy: boolean }) {
  const { t, locale } = useVT();
  const { docName, reason } = useNames();
  const nxt = plan.next;
  if (!nxt) return null;
  const d = nowDoc(plan);
  const r = plan.route;
  const source = r?.primary_source ? (
    <span className="vr-src">{t('route.checked', { date: fmt(r.verified_at, locale) })} · <a className="hg-link" href={r.primary_source} target="_blank" rel="noreferrer">{t('route.source')}</a></span>
  ) : null;
  const params = { ...nxt.params, date: fmt(nxt.params.date, locale) };
  if (d) {
    const act = docAction(d);
    return (
      <section className="sv-now" aria-labelledby="vr-now">
        <p className="sv-now__eyebrow">{t('now.eyebrow')}</p>
        <h2 id="vr-now" className="hg-title-md">{docName(d.key, d.name_en)}</h2>
        <p className="vr-now__why">{t(`doc.${d.key}.why`, { defaultValue: t('doc.generic.why') })}</p>
        <p className="vr-now__status"><strong>{t(`docStatus.${d.status}`)}</strong> — {reason(d)}</p>
        {d.timing && <p className="hg-small">{timingText(t, d.timing, locale)}</p>}
        <p className="hg-small hg-subtle">{t('provides', { who: t(`who.${d.who}`) })}{source && <> · {source}</>}</p>
        {act === 'markReceived' ? <Button variant="primary" loading={busy} onClick={() => onReceived(d.key)}>{t('docs.markReceived')}</Button>
          : act === 'upload' || act === 'uploadNew' ? <Button variant="primary" icon={<FileUp />} onClick={() => onUpload(d)}>{t(act === 'uploadNew' ? 'docs.uploadNew' : 'docs.upload')}</Button> : null}
      </section>
    );
  }
  return (
    <section className="sv-now" aria-labelledby="vr-now">
      <p className="sv-now__eyebrow">{t('now.eyebrow')}</p>
      <h2 id="vr-now" className="hg-title-md">{t(`home.${nxt.key}`, params)}</h2>
      {nxt.key === 'choose_post' && plan.question && <Question plan={plan} />}
      {nxt.key !== 'choose_post' && <p className="hg-small hg-subtle">{t('provides', { who: t(`who.${nxt.who}`, { defaultValue: t('who.you') }) })}{source && <> · {source}</>}</p>}
      {nxt.key === 'form' && <ButtonLink href="#vr-form" variant="primary">{t('docs.prepareForm')}</ButtonLink>}
      {(nxt.key === 'book' || nxt.key === 'go_to_appointment' || nxt.key === 'embassy_request' || nxt.key === 'upload_visa') && <ButtonLink href="#vr-track" variant="primary">{t('track.title')}</ButtonLink>}
      {(nxt.key === 'refused' || nxt.key === 'counselor_confirms') && <ButtonLink href="#vr-help" variant="primary">{t('help.ask')}</ButtonLink>}
    </section>
  );
}

function DocRow({ d, onUpload, onReceived, busy, preview }: { d: VisaRouteDoc; onUpload: (d: VisaRouteDoc) => void; onReceived: (key: string, on: boolean) => void; busy: boolean; preview: boolean }) {
  const { t, locale } = useVT();
  const { docName, reason } = useNames();
  const act = preview ? null : docAction(d);
  const tone = d.status === 'READY' || d.status === 'NEAR_EXPIRY' ? 'success' : d.status === 'IN_REVIEW' || d.status === 'WAITING_UNIVERSITY' || d.status === 'GET_LATER' ? 'neutral' : 'warning';
  return (
    <li className="vr-row" data-status={d.status}>
      <div className="vr-row__main">
        <span className="vr-row__name">{docName(d.key, d.name_en)}</span>
        <StatusText tone={tone as 'success'}>{t(`docStatus.${d.status}`)}</StatusText>
      </div>
      {d.reason.code !== 'MISSING' && <p className="vr-row__reason">{reason(d)}</p>}
      <div className="vr-row__meta">
        <span>{t('provides', { who: t(`who.${d.who}`) })}</span>
        {d.reused && <span className="vr-tag">{t('docs.reused')}</span>}
        {preview && <span className="sv-step__tag">{t('route.forNationality')}</span>}
        {d.slow && d.status !== 'READY' && <span className="vr-tag vr-tag--warn">{t('docs.slow')}</span>}
        {d.applies !== 'yes' && d.condition_code && <span>{t(`cond.${d.condition_code}`, { defaultValue: t('cond.OTHER') })}</span>}
        {d.applies === 'maybe' && !d.condition_code && <span>{t('cond.OTHER')}</span>}
        {d.timing && d.status !== 'READY' && <span>{timingText(t, d.timing, locale)}</span>}
        {d.legalization && d.legalization !== 'NONE' && d.status !== 'READY' && <span>{t(`docs.legalization.${d.legalization}`)}</span>}
        {d.translation_en && d.status !== 'READY' && <span>{t('docs.translation')}</span>}
      </div>
      <div className="vr-row__actions">
        {act === 'markReceived' && <Button size="sm" loading={busy} onClick={() => onReceived(d.key, true)}>{t('docs.markReceived')}</Button>}
        {(act === 'upload' || act === 'uploadNew') && <Button size="sm" icon={<FileUp />} onClick={() => onUpload(d)}>{t(act === 'uploadNew' ? 'docs.uploadNew' : 'docs.upload')}</Button>}
        {act === 'form' && <ButtonLink size="sm" href="#vr-form">{t('docs.prepareForm')}</ButtonLink>}
        {!preview && d.reason.code === 'RECEIVED' && <button type="button" className="hg-link hg-small" onClick={() => onReceived(d.key, false)}>{t('docs.unmark')}</button>}
        <details className="vr-exact">
          <summary className="hg-link hg-small">{t('docs.details')}</summary>
          <div className="vr-exact__body">
            <p>{t(`doc.${d.key}.why`, { defaultValue: t('doc.generic.why') })}</p>
            <p className="hg-xs hg-subtle">{t('route.exactWording')}</p>
            <p lang="en">{[d.name_en, d.condition_en, d.validity_en, d.translation_en, d.notes_en].filter(Boolean).join(' — ')}</p>
          </div>
        </details>
      </div>
    </li>
  );
}

function Documents({ plan, onUpload, onReceived, busy, bare = false }: { plan: VisaRoutePlan; onUpload: (d: VisaRouteDoc) => void; onReceived: (key: string, on: boolean) => void; busy: boolean; bare?: boolean }) {
  const { t } = useVT();
  const g = groupDocs(plan.documents);
  const [showReady, setShowReady] = useState(false);
  const [showNot, setShowNot] = useState(false);
  const preview = !plan.case;
  const row = (d: VisaRouteDoc) => <DocRow key={d.key} d={d} onUpload={onUpload} onReceived={onReceived} busy={busy} preview={preview} />;
  const Wrap = ({ children }: { children: React.ReactNode }) => (bare
    ? <div className="v9-bare">{preview && <p className="hg-small hg-muted">{t('docs.previewSub')}</p>}{children}</div>
    : <Section title={preview ? t('docs.previewTitle') : t('docs.title')} sub={preview ? t('docs.previewSub') : plan.pack ? t('docs.progress', { ready: plan.pack.ready, needed: plan.pack.needed }) : undefined}>{children}</Section>);
  return (
    <Wrap>
      {g.needsYou.length > 0 && <><h3 className="vr-group">{t('docs.needsYou')}</h3><ul className="vr-list">{g.needsYou.map(row)}</ul></>}
      {g.waiting.length > 0 && <><h3 className="vr-group">{t('docs.waiting')}</h3><ul className="vr-list">{g.waiting.map(row)}</ul></>}
      {g.ready.length > 0 && (
        <>
          <button type="button" className="v4-done-toggle vr-toggle" aria-expanded={showReady} onClick={() => setShowReady(!showReady)}>
            <Check aria-hidden /> {t('docs.readyCount', { count: g.ready.length, reused: g.ready.filter((d) => d.reused).length })} · <span className="hg-link">{showReady ? t('docs.hide') : t('docs.show')}</span>
          </button>
          {showReady && <ul className="vr-list">{g.ready.map(row)}</ul>}
        </>
      )}
      {g.maybe.length > 0 && <><h3 className="vr-group">{t('docs.maybe')}</h3><p className="hg-small hg-muted">{t('docs.maybeSub')}</p><ul className="vr-list">{g.maybe.map(row)}</ul></>}
      {g.notNeeded.length > 0 && (
        <>
          <button type="button" className="v4-done-toggle vr-toggle" aria-expanded={showNot} onClick={() => setShowNot(!showNot)}>{t('docs.notNeeded', { count: g.notNeeded.length })}</button>
          {showNot && <ul className="vr-list">{g.notNeeded.map(row)}</ul>}
        </>
      )}
    </Wrap>
  );
}

/** V9 S6: the funds rule as translated keys + params (amount for the university's region, period, whose name,
 * certificate age); the embassy's English only behind "as published" inside the block. */
function Money({ plan }: { plan: VisaRoutePlan }) {
  const { t, locale } = useVT();
  const v9 = (plan as VisaRoutePlan & { funds?: { funds: ParsedFunds; amount: FundsToShow['amount']; region_kind: FundsToShow['region_kind']; waived_here: boolean; genuine: FundsToShow['genuine']; announced: FundsToShow['announced'] } | null }).funds;
  if (!v9) return null;
  const data: FundsToShow = {
    status: 'RESOLVED', nationality: plan.inputs.nationality, visa_type: plan.inputs.visa_type, route_visa_type: plan.route?.visa_type,
    region: plan.inputs.university?.region ?? null, region_kind: v9.region_kind, university: plan.inputs.university?.name_en ?? null,
    funds: v9.funds, amount: v9.amount, waived_here: v9.waived_here, genuine: v9.genuine, announced: v9.announced,
    scheduled: (plan as VisaRoutePlan & { scheduled?: FundsToShow['scheduled'] }).scheduled,
  };
  const lead = v9.amount ? t('student:v9.funds.short', { amount: formatMoney(v9.amount.amount, v9.amount.currency, locale) }) : t(`student:v9.funds.kind.${v9.funds.kind}`);
  return (
    <details className="v9-fold">
      <summary><span className="v9-fold__t">{t('money.title')}</span><span className="v9-fold__m">{lead}</span></summary>
      <div className="v9-fold__body"><FundsToShowBlock data={data} /></div>
    </details>
  );
}

const EDITABLE: Record<string, string[]> = { personal: ['full_name', 'gender'], passport: ['passport_issuing_country'], address: ['jurisdiction_area'], sponsor: ['sponsor'], stay: ['intended_entry'] };
const SPONSORS = ['SELF', 'PARENTS', 'RELATIVE', 'SCHOLARSHIP', 'EMPLOYER'];

function FormPrep({ plan, bare = false }: { plan: VisaRoutePlan; bare?: boolean }) {
  const { t } = useVT();
  const p = formProgress(plan);
  if (bare) {
    return (
      <div id="vr-form" className="v9-bare">
        <Callout tone="neutral">{t('form.notice')}</Callout>
        <ul className="vr-list">{plan.form!.sections.map((s) => <FormSectionRow key={s.key} plan={plan} section={s} first={s.key === plan.form!.sections.find((x) => !x.confirmed_at)?.key} />)}</ul>
      </div>
    );
  }
  return (
    <Section id="vr-form" title={t('form.title')} sub={t('form.progress', p)}>
      {/* V5 reduction: the six form sections open only when checking them is the next step (or on request). */}
      <details className="vr-more" open={plan.next?.key === 'form'}>
        <summary>{p.done === p.total ? t('v5.formDone') : t('v5.formOpen')}</summary>
        <Callout tone="neutral">{t('form.notice')}</Callout>
        <ul className="vr-list">{plan.form!.sections.map((s) => <FormSectionRow key={s.key} plan={plan} section={s} first={s.key === plan.form!.sections.find((x) => !x.confirmed_at)?.key} />)}</ul>
      </details>
    </Section>
  );
}

function FormSectionRow({ plan, section, first }: { plan: VisaRoutePlan; section: NonNullable<VisaRoutePlan['form']>['sections'][number]; first: boolean }) {
  const { t, locale } = useVT();
  const api = useApi();
  const { post } = useNames();
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const confirm = usePlanMutation((values?: Record<string, string>) => api.visaRoute.confirmSection(section.key, values));
  const edit = usePlanMutation(() => api.visaRoute.editSection(section.key));
  const show = (field: string, v: string | null) => {
    if (v == null || v === '') return t('form.value.empty');
    if (field === 'nationality' || field === 'residence_country' || field === 'passport_issuing_country') return countryName(v, locale);
    if (field === 'date_of_birth' || field === 'passport_expiry' || field === 'semester_start' || field === 'intended_entry') return fmt(v, locale);
    if (field === 'degree_level') return t(`degree.${v}`, { defaultValue: t(`common:degree.${v}`) });
    if (field === 'sponsor') return t(`sponsor.${v}`, { defaultValue: v });
    if (field === 'gender') return t(`gender.${v}`, { defaultValue: v });
    if (field === 'admission_letter') return t(`form.value.${v}`, { defaultValue: v });
    if (field === 'jurisdiction_area' && plan.post && v === plan.post.city) return post(plan.post);
    return v;
  };
  const done = !!section.confirmed_at;
  const editable = EDITABLE[section.key] ?? [];
  return (
    <li className="vr-row vr-form" data-done={done || undefined}>
      <div className="vr-row__main">
        <span className="vr-row__name">{t(`form.section.${section.key}`)}</span>
        {done ? <StatusText tone="success">{t('form.checked')}</StatusText> : null}
      </div>
      {!editing ? (
        <dl className="vr-fields">
          {section.fields.map((f) => (
            <div key={f.field} className="vr-field">
              <dt>{t(`form.field.${f.field}`)}</dt>
              <dd>{f.source === 'official_form' ? <span className="hg-subtle">{t('form.missingHint')}</span> : show(f.field, f.value)}
                <span className="vr-field__src"> · {t(`form.source.${f.source}`)}</span>
                {f.corrected && <span className="vr-field__src"> — {t('form.correctedHint')}</span>}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <form className="hg-stack vr-edit" onSubmit={(e) => { e.preventDefault(); confirm.mutate(vals, { onSuccess: () => setEditing(false) }); }}>
          {section.fields.filter((f) => editable.includes(f.field)).map((f) => (
            <Field key={f.field} label={t(`form.field.${f.field}`)} htmlFor={`vr-f-${f.field}`}>
              {f.field === 'sponsor' ? (
                <Select id={`vr-f-${f.field}`} value={vals[f.field] ?? f.value ?? ''} onChange={(e) => setVals({ ...vals, [f.field]: e.target.value })}>
                  <option value="">—</option>
                  {SPONSORS.map((s) => <option key={s} value={s}>{t(`sponsor.${s}`)}</option>)}
                </Select>
              ) : (
                <Input id={`vr-f-${f.field}`} type={f.field === 'intended_entry' ? 'date' : 'text'} maxLength={200} value={vals[f.field] ?? f.value ?? ''} onChange={(e) => setVals({ ...vals, [f.field]: e.target.value })} />
              )}
            </Field>
          ))}
          <div className="vr-actions">
            <Button type="submit" variant="primary" size="sm" loading={confirm.isPending}>{t('form.save')}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setVals({}); }}>{t('form.cancel')}</Button>
          </div>
        </form>
      )}
      {!editing && (
        <div className="vr-row__actions">
          {!done && <Button size="sm" variant={first ? 'primary' : 'secondary'} loading={confirm.isPending} onClick={() => confirm.mutate(undefined)}>{t('form.confirm')}</Button>}
          {editable.length > 0 && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>{t('form.edit')}</Button>}
          {done && editable.length === 0 && <Button size="sm" variant="ghost" loading={edit.isPending} onClick={() => edit.mutate(undefined)}>{t('form.edit')}</Button>}
        </div>
      )}
    </li>
  );
}

function Track({ plan }: { plan: VisaRoutePlan }) {
  const { t, locale } = useVT();
  const api = useApi();
  const c = plan.case!;
  const stage = trackStage(plan);
  const today = new Date().toISOString().slice(0, 10);
  const [appt, setAppt] = useState(c.appointment?.on ?? '');
  const [apptStatus, setApptStatus] = useState<'PLANNED' | 'BOOKED'>(c.appointment?.status === 'BOOKED' ? 'BOOKED' : 'PLANNED');
  const [apptRef, setApptRef] = useState(c.appointment?.reference ?? '');
  const [subOn, setSubOn] = useState(today);
  const [subRef, setSubRef] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [upl, setUpl] = useState<'receipt' | 'visa' | null>(null);
  const [reqNote, setReqNote] = useState('');
  const [reqDue, setReqDue] = useState('');
  const [addReq, setAddReq] = useState(false);
  const [decOn, setDecOn] = useState(today);
  const saveAppt = usePlanMutation(() => api.visaRoute.appointment({ on: appt || null, status: appt ? apptStatus : null, reference: apptRef || null }), 'track.saved');
  const handoff = usePlanMutation(() => api.visaRoute.handoff());
  const submit = usePlanMutation(() => api.visaRoute.submission({ submitted_on: subOn, reference: subRef || null, document_id: receipt }), 'track.saved');
  const request = usePlanMutation(() => api.visaRoute.request({ note: reqNote.trim(), due_on: reqDue || null }), 'track.saved');
  const sent = usePlanMutation((id: string) => api.visaRoute.requestSent(id));
  const decide = usePlanMutation((d: 'APPROVED' | 'REFUSED') => api.visaRoute.decision({ decision: d, decided_on: decOn }), 'track.saved');
  const issued = usePlanMutation((docId: string) => api.visaRoute.issued({ document_id: docId, issued_on: today }), 'track.saved');
  const official = plan.method?.official_url;
  const evisa = plan.method?.code === 'E_VISA_UNIVERSITY';

  if (stage === 'issued') {
    return (
      <Section id="vr-track" title={t('track.issuedTitle')}>
        <p>{t('track.issuedDone', { date: fmt(c.issued_on, locale) })}</p>
        <ButtonLink as={Link} to="/arrival" variant="primary">{t('track.arrivalLink')}</ButtonLink>
      </Section>
    );
  }
  return (
    <Section id="vr-track" title={t('track.title')}>
      {stage === 'before' && (
        <div className="vr-track">
          {!evisa && (
            <form className="vr-block" onSubmit={(e) => { e.preventDefault(); saveAppt.mutate(undefined); }}>
              <h3 className="vr-group">{t('track.appointment')}</h3>
              <p className="hg-small hg-muted">{t('track.appointmentHint')}</p>
              <div className="vr-inline">
                <Field label={t('track.date')} htmlFor="vr-appt"><Input id="vr-appt" type="date" min={today} value={appt} onChange={(e) => setAppt(e.target.value)} /></Field>
                <Field label={t('track.booked')} htmlFor="vr-appt-st">
                  <Select id="vr-appt-st" value={apptStatus} onChange={(e) => setApptStatus(e.target.value as 'PLANNED' | 'BOOKED')}>
                    <option value="PLANNED">{t('track.planned')}</option><option value="BOOKED">{t('track.booked')}</option>
                  </Select>
                </Field>
              </div>
              <Field label={t('track.reference')} htmlFor="vr-appt-ref"><Input id="vr-appt-ref" maxLength={120} value={apptRef} onChange={(e) => setApptRef(e.target.value)} /></Field>
              <div className="vr-actions"><Button type="submit" size="sm" loading={saveAppt.isPending}>{t('track.saveDate')}</Button>
                {c.appointment && <span className="hg-small hg-muted">{t('track.dateSaved', { status: t(c.appointment.status === 'BOOKED' ? 'track.booked' : 'track.planned'), date: fmt(c.appointment.on, locale) })}</span>}</div>
            </form>
          )}
          {official && (
            <div className="vr-block vr-handoff">
              <h3 className="vr-group">{t('track.handoffTitle')}</h3>
              <p className="hg-small">{t('track.handoffText')}</p>
              <ButtonLink href={official} target="_blank" rel="noreferrer" iconEnd={<ExternalLink />} onClick={() => handoff.mutate(undefined)}>{t(evisa ? 'track.handoffEvisa' : 'track.handoffOpen')}</ButtonLink>
              {c.handoff_opened_at && <p className="hg-xs hg-subtle">{t('track.handoffOpened', { date: fmt(c.handoff_opened_at, locale) })}</p>}
            </div>
          )}
          <form className="vr-block" onSubmit={(e) => { e.preventDefault(); submit.mutate(undefined); }}>
            <h3 className="vr-group">{t('track.submitTitle')}</h3>
            <p className="hg-small hg-muted">{t('track.submitText')}</p>
            <div className="vr-inline">
              <Field label={t('track.submittedOn')} htmlFor="vr-sub-on"><Input id="vr-sub-on" type="date" max={today} value={subOn} onChange={(e) => setSubOn(e.target.value)} /></Field>
              <Field label={t('track.receipt')} htmlFor="vr-sub-ref"><Input id="vr-sub-ref" maxLength={120} value={subRef} onChange={(e) => setSubRef(e.target.value)} /></Field>
            </div>
            <div className="vr-actions">
              <Button type="button" size="sm" variant="ghost" icon={<FileUp />} onClick={() => setUpl('receipt')}>{receipt ? '✓ ' : ''}{t('track.receiptUpload')}</Button>
              <Button type="submit" variant="primary" disabled={!subRef.trim() && !receipt} loading={submit.isPending}>{t('track.submit')}</Button>
            </div>
            {!subRef.trim() && !receipt && <p className="hg-xs hg-subtle">{t('track.needEvidence')}</p>}
          </form>
        </div>
      )}
      {stage !== 'before' && c.submission && (
        <p>{c.submission.reference ? t('track.submitted', { date: fmt(c.submission.on, locale), ref: c.submission.reference }) : t('track.submittedNoRef', { date: fmt(c.submission.on, locale) })}</p>
      )}
      {(stage === 'submitted' || stage === 'request') && (
        <>
          <p className="hg-small hg-muted">{t('track.waitingText')}</p>
          <a className="hg-link hg-small" href={plan.method?.status_url ?? 'https://www.visa.go.kr'} target="_blank" rel="noreferrer">{t('track.checkStatus')}</a>
          <div className="vr-block" id="embassy">
            <h3 className="vr-group">{t('track.requestTitle')}</h3>
            <ul className="vr-list">
              {c.requests.map((r) => (
                <li key={r.id} className="vr-row">
                  <div className="vr-row__main"><span className="vr-row__name">{r.note}</span>
                    {r.status === 'OPEN' ? <StatusText tone={r.overdue ? 'danger' : 'warning'}>{r.overdue ? t('track.requestOverdue') : r.due_on ? t('track.requestDueOn', { date: fmt(r.due_on, locale) }) : t('status.EMBASSY_REQUEST')}</StatusText>
                      : <StatusText tone="success">{t('track.requestSentOn', { date: fmt(r.sent_at, locale) })}</StatusText>}
                  </div>
                  {r.status === 'OPEN' && <div className="vr-row__actions"><Button size="sm" loading={sent.isPending} onClick={() => sent.mutate(r.id)}>{t('track.requestSent')}</Button></div>}
                </li>
              ))}
            </ul>
            {!addReq ? <Button size="sm" variant="ghost" onClick={() => setAddReq(true)}>{t('track.requestAdd')}</Button> : (
              <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); if (reqNote.trim().length >= 3) request.mutate(undefined, { onSuccess: () => { setAddReq(false); setReqNote(''); setReqDue(''); } }); }}>
                <Field label={t('track.requestNote')} htmlFor="vr-req"><Textarea id="vr-req" rows={3} maxLength={2000} value={reqNote} onChange={(e) => setReqNote(e.target.value)} /></Field>
                <Field label={t('track.requestDue')} htmlFor="vr-req-due"><Input id="vr-req-due" type="date" min={today} value={reqDue} onChange={(e) => setReqDue(e.target.value)} /></Field>
                <div className="vr-actions"><Button type="submit" variant="primary" size="sm" disabled={reqNote.trim().length < 3} loading={request.isPending}>{t('track.requestSave')}</Button></div>
              </form>
            )}
          </div>
          <div className="vr-block">
            <h3 className="vr-group">{t('track.decisionTitle')}</h3>
            <Field label={t('track.decisionOn')} htmlFor="vr-dec-on"><Input id="vr-dec-on" type="date" max={today} value={decOn} onChange={(e) => setDecOn(e.target.value)} /></Field>
            <div className="vr-actions">
              <Button size="sm" variant="primary" loading={decide.isPending} onClick={() => decide.mutate('APPROVED')}>{t('track.decisionApproved')}</Button>
              <Button size="sm" loading={decide.isPending} onClick={() => decide.mutate('REFUSED')}>{t('track.decisionRefused')}</Button>
            </div>
          </div>
        </>
      )}
      {(stage === 'approved' || stage === 'submitted' || stage === 'request') && (
        <div className="vr-block">
          <h3 className="vr-group">{t('track.issuedTitle')}</h3>
          <p className="hg-small">{t('track.issuedText')}</p>
          <Button variant={stage === 'approved' ? 'primary' : 'secondary'} icon={<FileUp />} onClick={() => setUpl('visa')}>{t('track.issuedUpload')}</Button>
        </div>
      )}
      {upl && (
        <UploadModal open onClose={() => setUpl(null)} target={{ category: upl === 'visa' ? 'VISA' : 'OTHER', title: upl === 'visa' ? undefined : t('track.receipt') }}
          onUploaded={(id) => { if (upl === 'visa') issued.mutate(id); else setReceipt(id); }} />
      )}
    </Section>
  );
}

function Steps({ plan, bare = false }: { plan: VisaRoutePlan; bare?: boolean }) {
  const { t } = useVT();
  if (!plan.steps.length) return null;
  const list = (
      <ol className="vr-steps">
        {plan.steps.map((s, i) => (
          <li key={s.key} className="vr-step" data-state={s.state}>
            <span className="vr-step__mark" aria-hidden>{s.state === 'done' ? <Check /> : i + 1}</span>
            <div>
              <p className="vr-step__title">{t(`step.${s.key}.title`)} <span className="vr-step__state">· {t(`steps.state.${s.state}`)}</span></p>
              {s.state !== 'done' && <p className="vr-step__why">{t(`step.${s.key}.why`)}</p>}
            </div>
          </li>
        ))}
      </ol>
  );
  if (bare) return list;
  return (
    <Section title={t('steps.title')}>
      <details className="vr-more">
      <summary>{t('v5.stepsShow', { count: plan.steps.length })}</summary>
      {list}
      </details>
    </Section>
  );
}

function Help({ plan, bare = false }: { plan: VisaRoutePlan; bare?: boolean }) {
  const { t, locale } = useVT();
  const api = useApi();
  const [msg, setMsg] = useState('');
  const ask = usePlanMutation(() => api.visaRoute.help(msg.trim()), 'help.sent');
  const h = plan.help;
  const issue = h?.issue;
  const Wrap = ({ children }: { children: React.ReactNode }) => (bare ? <div id="vr-help" className="v9-bare">{children}</div> : <Section id="vr-help" title={t('help.title')}>{children}</Section>);
  return (
    <Wrap>
      {issue && (
        <dl className="vr-help">
          <div><dt>{t('help.what')}</dt><dd>{t(`help.issue.${issue.code}.what`)}{issue.note ? <> — <q>{issue.note}</q></> : null}</dd></div>
          <div><dt>{t('help.needed')}</dt><dd>{t(`help.issue.${issue.code}.needed`)}</dd></div>
          <div><dt>{t('help.who')}</dt><dd>{t(`who.${issue.who}`)}</dd></div>
          <div><dt>{t('help.when')}</dt><dd>{issue.when ? fmt(issue.when, locale) : t('help.noDate')}</dd></div>
          {h?.source_url && <div><dt>{t('help.source')}</dt><dd><a className="hg-link" href={h.source_url} target="_blank" rel="noreferrer">{t('route.source')}</a></dd></div>}
          <div><dt>{t('help.contact')}</dt><dd>{h?.contact.name ?? t('who.counselor')} · <Link className="hg-link" to="/messages">{t('help.messages')}</Link></dd></div>
        </dl>
      )}
      {h?.support_case && !h.support_case.closed && (
        <p className="hg-small"><LifeBuoy aria-hidden className="vr-ico" /> {t('help.open')} · {t(`support.status.${h.support_case.status}`, { defaultValue: '' })}</p>
      )}
      <details className="vr-more" open={!!issue}>
      <summary>{t('v5.helpAsk')}</summary>
      <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); if (msg.trim().length >= 3) ask.mutate(undefined, { onSuccess: () => setMsg('') }); }}>
        <Field label={t('help.message')} htmlFor="vr-help-msg" hint={t('help.askHint')}>
          <Textarea id="vr-help-msg" rows={3} maxLength={2000} value={msg} onChange={(e) => setMsg(e.target.value)} />
        </Field>
        <div><Button type="submit" size="sm" icon={<LifeBuoy />} disabled={msg.trim().length < 3} loading={ask.isPending}>{t('help.ask')}</Button></div>
      </form>
      </details>
    </Wrap>
  );
}
