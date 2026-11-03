/**
 * "Where will you live?" (V5 concierge). One decision, then the flow for that choice:
 * University dormitory (verified facts + application tracking) · Partner housing (only providers with an active agreement) ·
 * Off-campus (provider listings, clearly labelled; interest → viewing → contract review → deposit → confirmed → move-in) ·
 * Temporary accommodation (planning case) · Undecided. Lease support flags only missing/unclear terms — never legal advice.
 */
import { localName } from '@hangyul/i18n';
import { useApi } from '@hangyul/auth';
import { Building2, BedDouble, Check, FileSignature, Home, Hotel, House, Upload } from '@hangyul/icons';
import type { DormitoryFacts, HousingInfo, HousingListing, HousingOption, HousingPlan, ServiceCase } from '@hangyul/types';
import {
  Button, ButtonLink, Callout, EmptyState, Field, FreshnessBadge, Input, OptionCards, QueryState, Section, Select, SkeletonCard, useToast,
} from '@hangyul/ui';
import { formatDate, formatMoney } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { CaseStatus, Flow, ProviderLine, SourceQuote, useCT } from '../components/ConciergeBits';
import { PageIntro } from '../components/bits';
import { DORM_FLOW, flowIndex, SEARCH_FLOW, studentNextMove } from '../lib/concierge';
import { ADMITTED, useDashboard } from '../lib/queries';

type H = HousingInfo & HousingPlan;

function useHousingMutation<T>(fn: (v: T) => Promise<unknown>, success?: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useCT();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housing'] });
      qc.invalidateQueries({ queryKey: ['arrival-journey'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      if (success) toast.success(t(success));
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

function Won({ v }: { v: number | null | undefined }) {
  const { t, locale } = useCT();
  return v == null ? <span className="cg-unknown">{t('housing.notPublished')}</span> : <>{formatMoney(v, 'KRW', locale)}</>;
}

// ------------------------------------------------------------------------------------------------ dormitory
function DormFacts({ d }: { d: DormitoryFacts }) {
  const { t, locale } = useCT();
  const unknown = <span className="cg-unknown">{t('housing.notPublished')}</span>;
  const rows: [string, React.ReactNode][] = [
    ['period', d.application_opens || d.application_closes ? `${formatDate(d.application_opens, locale)} – ${formatDate(d.application_closes, locale)}` : unknown],
    ['eligibility', d.eligibility ?? unknown],
    ['price', d.cost_per_semester_krw_min ? <>{formatMoney(d.cost_per_semester_krw_min, 'KRW', locale)}{d.cost_per_semester_krw_max && d.cost_per_semester_krw_max !== d.cost_per_semester_krw_min ? ` – ${formatMoney(d.cost_per_semester_krw_max, 'KRW', locale)}` : ''} {t('housing.perSemester')}</> : unknown],
    ['rooms', d.room_types.length ? d.room_types.map((r) => t(`housing.room.${r}`, { defaultValue: r })).join(', ') : unknown],
    ['meals', d.meal_required == null ? unknown : d.meal_required ? t('housing.mealsRequired') : t('housing.mealsOptional')],
    ['moveIn', d.move_in_date ? formatDate(d.move_in_date, locale) : unknown],
    ['deposit', <Won key="d" v={d.deposit_krw} />],
    ['documents', d.required_documents.length ? d.required_documents.join(', ') : unknown],
    ['location', d.location ?? unknown],
  ];
  // Eligibility, documents and location are the university's own English text: outside English they are quoted as source.
  const SOURCE = new Set(['eligibility', 'documents', 'location']);
  const en = locale.startsWith('en');
  const kv = (list: typeof rows) => <dl className="cg-kv">{list.map(([k, v]) => <div key={k}><dt>{t(`housing.fact.${k}`)}</dt><dd>{v}</dd></div>)}</dl>;
  const quoted = rows.filter(([k]) => SOURCE.has(k) && !en && (k === 'documents' ? d.required_documents.length > 0 : k === 'eligibility' ? !!d.eligibility : !!d.location));
  return (
    <>
      {kv(rows.filter((r) => !quoted.includes(r)))}
      {quoted.length > 0 && <SourceQuote>{kv(quoted)}</SourceQuote>}
      <p className="cg-source">
        {d.source_url && <><a className="hg-link" href={d.source_url} target="_blank" rel="noreferrer">{d.verification_status === 'DEMO' ? t('common:freshness.source') : t('official.source')}</a> · </>}
        {d.verified_at ? t('official.lastChecked', { date: formatDate(d.verified_at, locale) }) : t('official.notChecked')}
      </p>
    </>
  );
}

function DormSection({ h }: { h: H }) {
  const { t } = useCT();
  const api = useApi();
  const c = h.dorm_case;
  const apply = useHousingMutation((v: { id: string; status: 'PLANNING' | 'APPLIED' }) => api.concierge.dormApply(v.id, v.status), 'housing.dormSaved');
  const step = useHousingMutation((status: string) => api.concierge.step(c!.id, { status }), 'housing.saved');
  const next = studentNextMove(c);
  const dorms = h.dormitories as unknown as DormitoryFacts[];
  return (
    <Section title={t('housing.dormTitle', { university: h.university?.name_en ?? '' })} sub={t('housing.dormSub')}>
      {c && (
        <div className="cg-panel" style={{ marginBottom: 16 }}>
          <p className="hg-md">{t('housing.yourApplication', { dorm: c.details.dormitory ?? '' })} — <CaseStatus c={c} /></p>
          {c.status !== 'CANCELLED' && c.status !== 'NOT_ASSIGNED' && <Flow steps={DORM_FLOW} current={flowIndex(DORM_FLOW, c.status)} type="DORMITORY" label={t('housing.dormTitle', { university: '' })} />}
          <p className="cg-note">{t(`housing.dormExplain.${c.status}`, { defaultValue: '' })}</p>
          {next && <div><Button variant={c.waiting_on === 'student' ? 'primary' : 'secondary'} loading={step.isPending} onClick={() => step.mutate(next)}>{t(`housing.dormMove.${next}`)}</Button></div>}
        </div>
      )}
      {dorms.length === 0 ? <p className="hg-muted">{t('housing.noDorms')}</p> : (
        <ul className="cg-list">
          {dorms.map((d) => {
            const chosen = c?.details.dormitory_id === d.id || h.case?.dormitory_id === d.id;
            return (
              <li key={d.id} className="cg-item" data-chosen={chosen || undefined}>
                <div className="cg-item__head">
                  <span className="cg-item__title">{d.name}</span>
                  <FreshnessBadge data={d} />
                </div>
                <DormFacts d={d} />
                {!c && (
                  <div className="cg-actions">
                    <Button size="sm" variant="primary" loading={apply.isPending} onClick={() => apply.mutate({ id: d.id, status: 'PLANNING' })}>{t('housing.planDorm')}</Button>
                    <Button size="sm" variant="secondary" loading={apply.isPending} onClick={() => apply.mutate({ id: d.id, status: 'APPLIED' })}>{t('housing.alreadyApplied')}</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------------------------------------ off-campus + partner
function ListingRow({ li, asked, onAsk, busy }: { li: HousingListing; asked: boolean; onAsk: () => void; busy: boolean }) {
  const { t, locale } = useCT();
  return (
    <li className="cg-item">
      <div className="cg-item__head">
        <span className="cg-item__title">{li.title}</span>
        <ProviderLine vendor={li.provider} />
      </div>
      <div className="cg-item__facts">
        <span>{t('housing.rent')} <strong>{li.rent_monthly_krw != null ? formatMoney(li.rent_monthly_krw, 'KRW', locale) : '—'}</strong>{t('housing.perMonth')}</span>
        <span>{t('housing.deposit')} <strong>{li.deposit_krw != null ? formatMoney(li.deposit_krw, 'KRW', locale) : '—'}</strong></span>
        {li.management_fee_krw != null && <span>{t('housing.fee')} <strong>{formatMoney(li.management_fee_krw, 'KRW', locale)}</strong></span>}
        {li.commute_minutes != null && <span>{t('housing.commute', { count: li.commute_minutes })}</span>}
        {li.contract_months_min != null && <span>{t('housing.minMonths', { count: li.contract_months_min })}</span>}
        {li.furnished != null && <span>{t(li.furnished ? 'housing.furnished' : 'housing.unfurnished')}</span>}
        {li.available_from && <span>{t('housing.availableFrom', { date: formatDate(li.available_from, locale) })}</span>}
      </div>
      {li.area && <p className="cg-note">{li.area}{li.utilities ? ` · ${li.utilities}` : ''}</p>}
      <div>{asked ? <span className="hg-small hg-muted"><Check size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {t('housing.asked')}</span>
        : <Button size="sm" variant="secondary" loading={busy} onClick={onAsk}>{t('housing.ask')}</Button>}</div>
    </li>
  );
}

const LEASE_FLAG_ORDER = ['MISSING_ADDRESS', 'UNCLEAR_DEPOSIT', 'UNCLEAR_RENT', 'UNCLEAR_DATES', 'MISSING_LANDLORD'];

function LeaseReview({ caseId }: { caseId?: string }) {
  const { t } = useCT();
  const api = useApi();
  const file = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ address: '', deposit_krw: '', rent_monthly_krw: '', start_date: '', end_date: '', landlord_name: '', agent_name: '' });
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const send = useHousingMutation(async () => {
    let document_id: string | undefined;
    const picked = file.current?.files?.[0];
    if (picked) {
      setUploading(true);
      try { document_id = (await api.documents.upload(picked, { category: 'OTHER', title: 'Proposed housing contract' })).id; } finally { setUploading(false); }
    }
    return api.concierge.leaseReview({
      case_id: caseId, document_id, address: f.address.trim() || null, deposit_krw: f.deposit_krw ? Number(f.deposit_krw) : null,
      rent_monthly_krw: f.rent_monthly_krw ? Number(f.rent_monthly_krw) : null, start_date: f.start_date || null, end_date: f.end_date || null,
      landlord_name: f.landlord_name.trim() || null, agent_name: f.agent_name.trim() || null,
    });
  }, 'lease.sent');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k.endsWith('krw') ? e.target.value.replace(/\D/g, '') : e.target.value });
  return (
    <form className="cg-panel" onSubmit={(e) => { e.preventDefault(); send.mutate(undefined, { onError: (er) => toast.error((er as Error).message) }); }}>
      <h3><FileSignature size={16} aria-hidden style={{ verticalAlign: '-3px' }} /> {t('lease.title')}</h3>
      <p className="cg-note">{t('lease.intro')}</p>
      <Field label={t('lease.file')} htmlFor="cg-lease-file" optional hint={t('lease.fileHint')}><input id="cg-lease-file" ref={file} type="file" accept="application/pdf,image/*" /></Field>
      <div className="cg-form-grid">
        <Field label={t('lease.address')} htmlFor="cg-l-addr"><Input id="cg-l-addr" value={f.address} onChange={set('address')} /></Field>
        <Field label={t('lease.deposit')} htmlFor="cg-l-dep"><Input id="cg-l-dep" inputMode="numeric" value={f.deposit_krw} onChange={set('deposit_krw')} /></Field>
        <Field label={t('lease.rent')} htmlFor="cg-l-rent"><Input id="cg-l-rent" inputMode="numeric" value={f.rent_monthly_krw} onChange={set('rent_monthly_krw')} /></Field>
        <Field label={t('lease.start')} htmlFor="cg-l-start"><Input id="cg-l-start" type="date" value={f.start_date} onChange={set('start_date')} /></Field>
        <Field label={t('lease.end')} htmlFor="cg-l-end"><Input id="cg-l-end" type="date" value={f.end_date} onChange={set('end_date')} /></Field>
        <Field label={t('lease.landlord')} htmlFor="cg-l-ll"><Input id="cg-l-ll" value={f.landlord_name} onChange={set('landlord_name')} /></Field>
        <Field label={t('lease.agent')} htmlFor="cg-l-ag" optional><Input id="cg-l-ag" value={f.agent_name} onChange={set('agent_name')} /></Field>
      </div>
      <p className="hg-xs hg-subtle">{t('lease.disclaimer')}</p>
      <div><Button type="submit" variant="primary" icon={<Upload />} loading={send.isPending || uploading}>{t('lease.send')}</Button></div>
    </form>
  );
}

function SearchCase({ c }: { c: ServiceCase }) {
  const { t } = useCT();
  const api = useApi();
  const next = studentNextMove(c);
  const step = useHousingMutation((status: string) => api.concierge.step(c.id, { status }), 'housing.saved');
  const flags = (c.lease_flags ?? []).slice().sort((a, b) => LEASE_FLAG_ORDER.indexOf(a) - LEASE_FLAG_ORDER.indexOf(b));
  return (
    <li className="cg-item">
      <div className="cg-item__head"><span className="cg-item__title">{c.details.listing ?? t('housing.ownPlace')}</span><CaseStatus c={c} /></div>
      {c.status !== 'CANCELLED' && <Flow steps={SEARCH_FLOW} current={flowIndex(SEARCH_FLOW, c.status)} type="HOUSING_SEARCH" label={t('housing.searchTitle')} />}
      <p className="cg-note">{t(`housing.searchExplain.${c.status}`, { defaultValue: '' })}</p>
      {c.details.lease && (
        flags.length ? (
          <Callout tone="warning" title={t('lease.flagsTitle')}>
            <ul className="cg-flags">{flags.map((f) => <li key={f}>{t(`lease.flag.${f}`)}</li>)}</ul>
            <p className="hg-xs hg-subtle" style={{ marginTop: 6 }}>{t('lease.disclaimer')}</p>
          </Callout>
        ) : <p className="hg-small hg-muted">{t('lease.noFlags')}</p>
      )}
      {['INTERESTED', 'VIEWING'].includes(c.status) && <LeaseReview caseId={c.id} />}
      {next && <div><Button variant={c.waiting_on === 'student' ? 'primary' : 'secondary'} loading={step.isPending} onClick={() => step.mutate(next)}>{t(`housing.searchMove.${next}`)}</Button></div>}
    </li>
  );
}

function OffCampus({ h, partner }: { h: H; partner: boolean }) {
  const { t } = useCT();
  const api = useApi();
  const ask = useHousingMutation((id: string) => api.concierge.listingInterest(id), 'housing.askedToast');
  const listings = partner ? h.partner_listings : h.listings;
  const askedIds = new Set(h.search_cases.filter((c) => !c.closed).map((c) => c.details.listing_id as string));
  const own = h.search_cases.some((c) => !c.details.listing_id && !c.closed);
  return (
    <>
      {h.search_cases.length > 0 && (
        <Section title={t('housing.searchTitle')}>
          <ul className="cg-list">{h.search_cases.map((c) => <SearchCase key={c.id} c={c} />)}</ul>
        </Section>
      )}
      <Section title={t(partner ? 'housing.partnerTitle' : 'housing.listingsTitle')} sub={t(partner ? 'housing.partnerSub' : 'housing.listingsSub')}>
        {listings.length === 0 ? (
          <EmptyState compact icon={<House />} title={t(partner ? 'housing.noPartner' : 'housing.noListings')} text={t('housing.noListingsText')} />
        ) : (
          <ul className="cg-list">
            {listings.map((li) => <ListingRow key={li.id} li={li} asked={askedIds.has(li.id)} busy={ask.isPending} onAsk={() => ask.mutate(li.id)} />)}
          </ul>
        )}
      </Section>
      {!own && !partner && (
        <Section title={t('housing.foundOwnTitle')} sub={t('housing.foundOwnSub')}>
          <LeaseReview />
        </Section>
      )}
    </>
  );
}

// ------------------------------------------------------------------------------------------------ temporary
function Temporary({ h }: { h: H }) {
  const { t, locale } = useCT();
  const api = useApi();
  const [from, setFrom] = useState('');
  const [nights, setNights] = useState('7');
  const req = useHousingMutation(() => api.concierge.request({ type: 'TEMPORARY_HOUSING', details: { from_date: from || null, nights: Number(nights) } }), 'housing.tempRequested');
  const c = h.temporary_case;
  return (
    <Section title={t('housing.tempTitle')} sub={t('housing.tempSub')}>
      {c && c.status !== 'CANCELLED' ? (
        <div className="cg-panel">
          <p className="hg-md"><CaseStatus c={c} /></p>
          <p className="cg-note">{t('housing.tempCase', { date: c.details.from_date ? formatDate(c.details.from_date, locale) : '—', count: Number(c.details.nights ?? 0) })}</p>
          <ProviderLine vendor={c.vendor} />
        </div>
      ) : (
        <form className="cg-form-grid" onSubmit={(e) => { e.preventDefault(); req.mutate(undefined); }}>
          <Field label={t('housing.tempFrom')} htmlFor="cg-t-from"><Input id="cg-t-from" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label={t('housing.tempNights')} htmlFor="cg-t-n"><Select id="cg-t-n" value={nights} onChange={(e) => setNights(e.target.value)}>{[3, 7, 14, 30].map((n) => <option key={n} value={n}>{t('housing.nights', { count: n })}</option>)}</Select></Field>
          <div><Button type="submit" variant="primary" loading={req.isPending}>{t('housing.tempRequest')}</Button></div>
        </form>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------------------------------------ profile + move-in
function Profile({ h, dorm }: { h: H; dorm: boolean }) {
  const { t } = useCT();
  const api = useApi();
  const p = h.profile ?? {};
  const [v, setV] = useState({
    monthly_budget_krw: p.monthly_budget_krw ? String(p.monthly_budget_krw) : '', deposit_budget_krw: p.deposit_budget_krw ? String(p.deposit_budget_krw) : '',
    room: p.room ?? '', max_commute_minutes: p.max_commute_minutes ? String(p.max_commute_minutes) : '', gender_requirement: p.gender_requirement ?? '',
    move_in_date: p.move_in_date ?? '', stay_months: p.stay_months ? String(p.stay_months) : '', furnished: p.furnished == null ? '' : p.furnished ? 'yes' : 'no',
  });
  const save = useHousingMutation(() => api.concierge.updatePlan({ profile: {
    monthly_budget_krw: v.monthly_budget_krw ? Number(v.monthly_budget_krw) : null, deposit_budget_krw: v.deposit_budget_krw ? Number(v.deposit_budget_krw) : null,
    room: v.room || null, max_commute_minutes: v.max_commute_minutes ? Number(v.max_commute_minutes) : null, gender_requirement: v.gender_requirement || null,
    move_in_date: v.move_in_date || null, stay_months: v.stay_months ? Number(v.stay_months) : null, furnished: v.furnished ? v.furnished === 'yes' : null,
  } }), 'housing.saved');
  const num = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value.replace(/\D/g, '') });
  return (
    <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
      <div className="cg-form-grid">
        <Field label={t('profile.budget')} htmlFor="cg-p-b"><Input id="cg-p-b" inputMode="numeric" value={v.monthly_budget_krw} onChange={num('monthly_budget_krw')} placeholder="500000" /></Field>
        {!dorm && <Field label={t('profile.deposit')} htmlFor="cg-p-d"><Input id="cg-p-d" inputMode="numeric" value={v.deposit_budget_krw} onChange={num('deposit_budget_krw')} placeholder="3000000" /></Field>}
        <Field label={t('profile.room')} htmlFor="cg-p-r"><Select id="cg-p-r" value={v.room} onChange={(e) => setV({ ...v, room: e.target.value })}><option value="">{t('profile.any')}</option><option value="private">{t('profile.private')}</option><option value="shared">{t('profile.shared')}</option></Select></Field>
        {!dorm && <Field label={t('profile.commute')} htmlFor="cg-p-c"><Select id="cg-p-c" value={v.max_commute_minutes} onChange={(e) => setV({ ...v, max_commute_minutes: e.target.value })}><option value="">{t('profile.any')}</option>{[15, 30, 45, 60].map((m) => <option key={m} value={m}>{t('profile.minutes', { count: m })}</option>)}</Select></Field>}
        {dorm && <Field label={t('profile.gender')} htmlFor="cg-p-g" hint={t('profile.genderHint')}><Select id="cg-p-g" value={v.gender_requirement} onChange={(e) => setV({ ...v, gender_requirement: e.target.value })}><option value="">{t('profile.preferNot')}</option><option value="female">{t('profile.female')}</option><option value="male">{t('profile.male')}</option><option value="any">{t('profile.anyGender')}</option></Select></Field>}
        <Field label={t('profile.moveIn')} htmlFor="cg-p-m"><Input id="cg-p-m" type="date" value={v.move_in_date} onChange={(e) => setV({ ...v, move_in_date: e.target.value })} /></Field>
        <Field label={t('profile.stay')} htmlFor="cg-p-s"><Select id="cg-p-s" value={v.stay_months} onChange={(e) => setV({ ...v, stay_months: e.target.value })}><option value="">{t('profile.any')}</option>{[6, 12, 24].map((m) => <option key={m} value={m}>{t('profile.months', { count: m })}</option>)}</Select></Field>
        {!dorm && <Field label={t('profile.furnished')} htmlFor="cg-p-f"><Select id="cg-p-f" value={v.furnished} onChange={(e) => setV({ ...v, furnished: e.target.value })}><option value="">{t('profile.any')}</option><option value="yes">{t('profile.yes')}</option><option value="no">{t('profile.no')}</option></Select></Field>}
      </div>
      <div><Button type="submit" variant="secondary" loading={save.isPending}>{t('profile.save')}</Button></div>
    </form>
  );
}

function MoveIn({ h }: { h: H }) {
  const { t } = useCT();
  const api = useApi();
  const mi = h.move_in ?? {};
  const [v, setV] = useState({ date: mi.date ?? '', address: mi.address ?? '', check_in_method: mi.check_in_method ?? '', manager_contact: mi.manager_contact ?? '', deposit_status: mi.deposit_status ?? '' });
  const done = mi.checklist_done ?? [];
  const save = useHousingMutation((body: Record<string, unknown>) => api.concierge.updatePlan({ move_in: body }), 'housing.saved');
  const docs = (h.dormitories as unknown as DormitoryFacts[]).find((d) => d.id === (h.dorm_case?.details.dormitory_id ?? h.case?.dormitory_id))?.required_documents ?? [];
  return (
    <Section title={t('moveIn.title')} sub={t('moveIn.sub')}>
      <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); save.mutate({ ...v, deposit_status: v.deposit_status || null }); }}>
        <div className="cg-form-grid">
          <Field label={t('moveIn.date')} htmlFor="cg-m-d"><Input id="cg-m-d" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
          <Field label={t('moveIn.address')} htmlFor="cg-m-a"><Input id="cg-m-a" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
          <Field label={t('moveIn.checkIn')} htmlFor="cg-m-c"><Input id="cg-m-c" value={v.check_in_method} onChange={(e) => setV({ ...v, check_in_method: e.target.value })} placeholder={t('moveIn.checkInHint')} /></Field>
          <Field label={t('moveIn.manager')} htmlFor="cg-m-m" optional><Input id="cg-m-m" value={v.manager_contact} onChange={(e) => setV({ ...v, manager_contact: e.target.value })} /></Field>
          <Field label={t('moveIn.deposit')} htmlFor="cg-m-dep"><Select id="cg-m-dep" value={v.deposit_status} onChange={(e) => setV({ ...v, deposit_status: e.target.value })}><option value="">—</option>{['UNPAID', 'PAID', 'NOT_APPLICABLE'].map((s) => <option key={s} value={s}>{t(`moveIn.depositStatus.${s}`)}</option>)}</Select></Field>
        </div>
        <div><Button type="submit" variant="secondary" loading={save.isPending}>{t('moveIn.save')}</Button></div>
      </form>
      {docs.length > 0 && <SourceQuote><p className="cg-note" style={{ marginTop: 12 }}>{t('moveIn.bring', { list: docs.join(', ') })}</p></SourceQuote>}
      <ul className="cg-steps" style={{ marginTop: 12 }}>
        {h.move_in_checklist.map((k) => {
          const on = done.includes(k);
          return (
            <li key={k} className="cg-step" data-state={on ? 'done' : 'todo'}>
              <button type="button" className="cg-step__head" aria-pressed={on} onClick={() => save.mutate({ checklist_done: on ? done.filter((x) => x !== k) : [...done, k] })}>
                <span className="cg-step__mark" aria-hidden>{on ? <Check /> : null}</span>
                <span className="cg-step__title">{t(`moveIn.item.${k}.title`)}<span className="cg-step__sub">{t(`moveIn.item.${k}.text`)}</span></span>
                <span className="cg-step__state">{on ? t('stepState.done') : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

const CONFIRMED = new Set(['CONFIRMED', 'MOVED_IN']);

export default function Housing() {
  const { t, locale } = useCT();
  const api = useApi();
  const q = useQuery({ queryKey: ['housing'], queryFn: () => api.concierge.housing() });
  const dash = useDashboard();
  const early = !!dash.data && !ADMITTED.has(dash.data.journey.stage);
  const choose = useHousingMutation((option: HousingOption) => api.concierge.updatePlan({ option }));
  return (
    <div className="st-page">
      <PageIntro title={t('housing.title')} subtitle={t('housing.subtitle')} />
      <QueryState query={q} skeleton={<SkeletonCard lines={6} />}>
        {(h) => {
          if (early) {
            return <EmptyState icon={<Home />} title={t('housing.quietTitle')} text={t('housing.quietText')} action={<ButtonLink as={Link} to="/" variant="secondary">{t('page.backHome')}</ButtonLink>} />;
          }
          if (!h.university) {
            return <EmptyState icon={<Home />} title={t('housing.noUni')} text={t('housing.noUniText')} action={<ButtonLink as={Link} to="/applications" variant="primary">{t('housing.noUniCta')}</ButtonLink>} />;
          }
          const option = h.option;
          const partnerAvailable = h.options.find((o) => o.value === 'PARTNER')?.available;
          const dorms = h.dormitories as unknown as DormitoryFacts[];
          const priced = dorms.filter((d) => d.cost_per_semester_krw_min);
          const dormFrom = priced.length ? Math.min(...priced.map((d) => d.cost_per_semester_krw_min!)) : null;
          const settled = (h.dorm_case && CONFIRMED.has(h.dorm_case.status)) || h.search_cases.some((c) => CONFIRMED.has(c.status));
          return (
            <div className="sv-layout">
              <div className="sv-main">
                {settled && <Callout tone="success" title={t('housing.settledTitle')}>{t('housing.settledText')}</Callout>}
                <Section title={t('housing.where', { university: localName(h.university) })}>
                  <OptionCards<HousingOption> label={t('housing.where', { university: localName(h.university) })} min={170} value={option}
                    onChange={(v) => choose.mutate(v as HousingOption)}
                    options={[
                      { value: 'DORM', icon: <Building2 />, label: t('housing.opt.DORM'), sub: dormFrom ? t('housing.dormFrom', { amount: formatMoney(dormFrom, 'KRW', locale, { compact: true }) }) : t('housing.priceUnknown') },
                      { value: 'PARTNER', icon: <House />, label: t('housing.opt.PARTNER'), sub: partnerAvailable ? t('housing.partnerAvail') : t('housing.noPartnerShort') },
                      { value: 'OFF_CAMPUS', icon: <Home />, label: t('housing.opt.OFF_CAMPUS'), sub: h.university.est_living_cost_monthly_krw ? t('housing.offFrom', { amount: formatMoney(h.university.est_living_cost_monthly_krw, 'KRW', locale, { compact: true }) }) : undefined },
                      { value: 'TEMPORARY', icon: <Hotel />, label: t('housing.opt.TEMPORARY'), sub: t('housing.tempShort') },
                      { value: 'UNDECIDED', icon: <BedDouble />, label: t('housing.opt.UNDECIDED'), sub: t('housing.undecidedSub') },
                    ]} />
                </Section>
                {option === 'DORM' && <DormSection h={h} />}
                {option === 'PARTNER' && <OffCampus h={h} partner />}
                {option === 'OFF_CAMPUS' && <OffCampus h={h} partner={false} />}
                {option === 'TEMPORARY' && <Temporary h={h} />}
                {option === 'UNDECIDED' && (
                  <Section title={t('housing.compareTitle')}>
                    <ul className="cg-list">
                      {(['DORM', 'OFF_CAMPUS', 'TEMPORARY'] as const).map((o) => (
                        <li key={o} className="cg-item"><span className="cg-item__title">{t(`housing.opt.${o}`)}</span><p className="cg-note">{t(`housing.compare.${o}`)}</p></li>
                      ))}
                    </ul>
                  </Section>
                )}
                {settled && <MoveIn h={h} />}
              </div>
              <aside className="sv-side">
                {option !== 'UNDECIDED' && (
                  <Section title={t('profile.title')} sub={t('profile.sub')}>
                    <Profile h={h} dorm={option === 'DORM'} />
                  </Section>
                )}
                <p className="hg-small hg-subtle">{t('housing.honest')}</p>
              </aside>
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}
