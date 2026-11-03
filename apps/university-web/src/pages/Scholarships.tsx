import { useAuth } from '@hangyul/auth';
import { Plus, Wallet } from '@hangyul/icons';
import { useLocale, localName } from '@hangyul/i18n';
import type { Partnership, Scholarship } from '@hangyul/types';
import { Button, Callout, EmptyState, Field, Input, Metrics, Modal, QueryState, Select, SkeletonCard, StatusText, Tabs, Textarea, useToast } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import { formatDate, formatMoney, type Tone } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { NoAccess, Provenance, UsageBar } from '../components/common';
import { intakeText } from '../lib/format';
import { OFFER_STATUSES } from '../lib/permissions';
import { usePartnership, useApplications } from '../lib/queries';
import { useUniversity } from '../lib/university';

type Pool = Partnership['pools'][number];
type Award = Pool['awards'][number];

export function poolAvailable(pool: Pool): number {
  const proposed = pool.awards.filter((a) => a.status === 'PROPOSED').reduce((s, a) => s + a.amount_krw, 0);
  return Math.max(0, pool.total_krw - pool.committed_krw - pool.paid_krw - proposed);
}

const awardTone = (s: string): Tone => (s === 'PAID' ? 'success' : s === 'COMMITTED' ? 'info' : s === 'CANCELLED' ? 'neutral' : 'warning');

function CreateAward({ contracts, onClose }: { contracts: Partnership[]; onClose: () => void }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { scopeId } = useUniversity();
  const pools = contracts.filter((c) => c.status === 'ACTIVE').flatMap((c) => c.pools);
  const offered = useApplications({ status: [...OFFER_STATUSES, 'VISA_PREPARATION', 'VISA_SUBMITTED', 'VISA_ISSUED', 'ENROLLED'], page: 1, page_size: 200 });
  const [poolId, setPoolId] = useState(pools[0]?.id ?? '');
  const [appId, setAppId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pool = pools.find((p) => p.id === poolId);
  const available = pool ? poolAvailable(pool) : 0;
  const app = offered.data?.items.find((a) => a.id === appId);
  const m = useMutation({
    mutationFn: () => api.university.createAward({ pool_id: poolId, student_id: app!.student!.id, application_id: app!.id, amount_krw: Math.round(Number(amount)), note: note.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['university', 'partnership', scopeId ?? 'own'] });
      qc.invalidateQueries({ queryKey: ['university', 'analytics'] });
      toast.success(t('university:scholarships.created'));
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!poolId) e.pool = 'validation.required';
    if (!app?.student) e.app = 'validation.required';
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) e.amount = 'validation.required';
    else if (n > available) e.amount = t('university:scholarships.overBudget', { available: formatMoney(available, 'KRW', locale) });
    setErrors(e);
    if (!Object.keys(e).length) m.mutate();
  };
  return (
    <Modal open onClose={onClose} title={t('university:scholarships.createTitle')} description={t('university:scholarships.createDesc')}
      footer={<><Button onClick={onClose}>{t('common:actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={submit}>{t('university:scholarships.propose')}</Button></>}>
      <div className="hg-stack">
        <Field label={t('university:scholarships.pool')} htmlFor="aw-pool" error={errors.pool}>
          <Select id="aw-pool" value={poolId} onChange={(e) => setPoolId(e.target.value)}>
            {pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label={t('university:scholarships.applicant')} htmlFor="aw-app" hint={t('university:scholarships.applicantHint')} error={errors.app}>
          <Select id="aw-app" value={appId} onChange={(e) => setAppId(e.target.value)} disabled={offered.isLoading}>
            <option value="">{offered.isLoading ? t('common:states.loading') : t('common:form.selectPlaceholder')}</option>
            {(offered.data?.items ?? []).map((a) => <option key={a.id} value={a.id}>{a.student?.full_name} · {localName(a.program)} · {t(`common:appStatus.${a.status}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('university:scholarships.amount')} htmlFor="aw-amt" hint={t('university:scholarships.available', { amount: formatMoney(available, 'KRW', locale) })} error={errors.amount}>
          <Input id="aw-amt" type="number" inputMode="numeric" min={1} step={100000} value={amount} onChange={(e) => setAmount(e.target.value)} invalid={!!errors.amount} />
        </Field>
        <Field label={t('university:scholarships.note')} htmlFor="aw-note" optional>
          <Textarea id="aw-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Callout tone="info">{t('university:scholarships.proposeInfo')}</Callout>
      </div>
    </Modal>
  );
}

function AwardAction({ award, to, onDone }: { award: Award; to: 'COMMITTED' | 'PAID' | 'CANCELLED'; onDone?: () => void }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { scopeId } = useUniversity();
  const [confirm, setConfirm] = useState(false);
  const m = useMutation({
    mutationFn: () => api.university.awardStatus(award.id, to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['university', 'partnership', scopeId ?? 'own'] });
      qc.invalidateQueries({ queryKey: ['university', 'analytics'] });
      toast.success(t(`university:scholarships.moved.${to}`));
      setConfirm(false);
      onDone?.();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <>
      <Button size="sm" variant={to === 'CANCELLED' ? 'ghost' : to === 'PAID' ? 'success' : 'secondary'} onClick={() => setConfirm(true)}>{t(`university:scholarships.action.${to}`)}</Button>
      {confirm && (
        <Modal open onClose={() => setConfirm(false)} title={t(`university:scholarships.action.${to}`)}
          description={t('university:scholarships.confirmMove', { student: award.student, amount: formatMoney(award.amount_krw, 'KRW', locale), status: t(`university:awardStatus.${to}`) })}
          footer={<><Button onClick={() => setConfirm(false)}>{t('common:actions.cancel')}</Button><Button variant={to === 'CANCELLED' ? 'danger' : 'primary'} loading={m.isPending} onClick={() => m.mutate()}>{t('common:actions.confirm')}</Button></>}>
          {to === 'COMMITTED' && <p className="hg-small">{t('university:scholarships.commitNote')}</p>}
          {to === 'PAID' && <p className="hg-small">{t('university:scholarships.paidNote')}</p>}
        </Modal>
      )}
    </>
  );
}

function PoolCard({ pool, contract }: { pool: Pool; contract: Partnership }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { perms } = useUniversity();
  const money = (v: number) => formatMoney(v, 'KRW', locale);
  const recipients = pool.awards.filter((a) => a.status === 'COMMITTED' || a.status === 'PAID').length;
  const proposed = pool.awards.filter((a) => a.status === 'PROPOSED').reduce((s, a) => s + a.amount_krw, 0);
  return (
    <section className="hg-stack" aria-labelledby={`pool-${pool.id}`} style={{ '--hg-gap': '16px' } as React.CSSProperties}>
      <div>
        <div className="hg-row-wrap" style={{ gap: 12 }}>
          <h2 id={`pool-${pool.id}`} className="hg-title-sm">{pool.name}</h2>
          <StatusText tone={contract.status === 'ACTIVE' ? 'success' : 'neutral'}>{t(`university:contractStatus.${contract.status}`, { defaultValue: contract.status })}</StatusText>
        </div>
        <p className="uc-sub">{intakeText(pool.intake, t)} · {t('university:scholarships.recipients', { count: recipients })}</p>
      </div>
      <Metrics items={[
        { label: t('university:scholarships.allocated'), value: money(pool.total_krw) },
        { label: t('university:scholarships.committed'), value: money(pool.committed_krw) },
        { label: t('university:scholarships.paid'), value: money(pool.paid_krw) },
        { label: t('university:scholarships.remaining'), value: money(pool.remaining_krw), foot: proposed ? t('university:scholarships.proposedFoot', { amount: money(proposed) }) : undefined },
      ]} />
      <UsageBar used={pool.committed_krw + pool.paid_krw} total={pool.total_krw} label={pool.name} />
      {pool.rules_summary && <p className="hg-small"><span className="hg-medium">{t('university:scholarships.rules')}:</span> {pool.rules_summary}</p>}
        <h3 className="uc-h3">{t('university:scholarships.awards')}</h3>
        {pool.awards.length === 0 ? <p className="hg-subtle hg-small">{t('university:scholarships.noAwards')}</p> : (
          <div className="uc-table-scroll" tabIndex={0}>
            <table className="hg-table hg-table--dense uc-simple-table">
              <caption className="hg-sr-only">{t('university:scholarships.awards')}</caption>
              <thead><tr><th>{t('university:scholarships.recipient')}</th><th className="hg-table__num">{t('university:scholarships.amount')}</th><th>{t('university:scholarships.status')}</th><th>{t('university:scholarships.note')}</th><th>{t('university:scholarships.updated')}</th><th><span className="hg-sr-only">{t('university:scholarships.actions')}</span></th></tr></thead>
              <tbody>
                {pool.awards.map((a) => (
                  <tr key={a.id}>
                    <td className="hg-strong">{a.student}</td>
                    <td className="hg-table__num">{money(a.amount_krw)}</td>
                    <td><StatusText tone={awardTone(a.status)}>{t(`university:awardStatus.${a.status}`, { defaultValue: a.status })}</StatusText></td>
                    <td className="hg-small">{a.note ?? '—'}</td>
                    <td className="hg-xs hg-subtle">{formatDate(a.updated_at, locale)}</td>
                    <td>
                      <div className="hg-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        {a.status === 'PROPOSED' && perms.canManageAwards && <><AwardAction award={a} to="COMMITTED" /><AwardAction award={a} to="CANCELLED" /></>}
                        {a.status === 'COMMITTED' && <>{perms.canPayAward && <AwardAction award={a} to="PAID" />}{perms.canManageAwards && <AwardAction award={a} to="CANCELLED" />}</>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}

function CatalogScholarships({ kind }: { kind: 'UNIVERSITY' | 'GOVERNMENT' }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const { universityId } = useUniversity();
  const q = useQuery({
    queryKey: ['scholarships', kind, kind === 'UNIVERSITY' ? universityId : 'all'],
    queryFn: () => api.catalog.scholarships(kind === 'UNIVERSITY' ? { university_id: universityId ?? undefined, kind: ['UNIVERSITY', 'OTHER'] } : { kind: ['GOVERNMENT'] }),
    enabled: kind === 'GOVERNMENT' || !!universityId,
    staleTime: 10 * 60_000,
  });
  return (
    <QueryState query={q} skeleton={<SkeletonCard lines={3} />} isEmpty={(d) => d.length === 0} empty={<p className="hg-subtle hg-small">{t('university:scholarships.noneListed')}</p>}>
      {(d) => (
        <div className="uc-table-scroll" tabIndex={0}>
          <table className="hg-table uc-simple-table">
            <caption className="hg-sr-only">{t(`common:scholarshipKind.${kind}`)}</caption>
            <thead><tr><th>{t('university:scholarships.name')}</th><th>{t('university:scholarships.benefit')}</th><th>{t('university:scholarships.howAwarded')}</th><th>{t('university:scholarships.deadline')}</th><th>{t('university:scholarships.source')}</th></tr></thead>
            <tbody>
              {d.map((s: Scholarship) => (
                <tr key={s.id}>
                  <td><span className="hg-medium">{s.name}</span><span className="uc-sub" style={{ display: 'block' }}>{s.provider}</span></td>
                  <td className="hg-small">{[s.tuition_waiver_percent_max !== null ? t('university:scholarships.waiver', { min: s.tuition_waiver_percent_min ?? s.tuition_waiver_percent_max, max: s.tuition_waiver_percent_max }) : null,
                    s.amount_krw !== null ? formatMoney(s.amount_krw, 'KRW', locale) : null, s.coverage].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="hg-small">{s.is_automatic ? t('university:scholarships.automatic') : t('university:scholarships.byApplication')}</td>
                  <td className="hg-small">{s.application_deadline ? formatDate(s.application_deadline, locale) : '—'}</td>
                  <td><Provenance data={s} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </QueryState>
  );
}

export default function Scholarships() {
  const { t } = useLocale(['university', 'common']);
  const { perms } = useUniversity();
  const q = usePartnership();
  const [create, setCreate] = useState(false);
  const hasActive = useMemo(() => (q.data ?? []).some((c) => c.status === 'ACTIVE' && c.pools.length), [q.data]);
  if (!perms.canViewPartnership) return <NoAccess />;
  const [sp, setSp] = useSearchParams();
  const tab = (['partner', 'university', 'government'].includes(sp.get('tab') ?? '') ? sp.get('tab') : 'partner') as 'partner' | 'university' | 'government';
  const poolCount = (q.data ?? []).reduce((s, c) => s + c.pools.length, 0);
  return (
    <div className="hg-stack uc-page uv7">
      <PageHeader title={t('common:nav.scholarships')} sub={t('university:scholarships.subtitleV3')}
        actions={perms.canAward && hasActive && tab === 'partner' ? <Button variant="primary" icon={<Plus />} onClick={() => setCreate(true)}>{t('university:scholarships.create')}</Button> : undefined} />
      <Tabs label={t('university:scholarships.kinds')} value={tab} onChange={(v) => setSp({ tab: v }, { replace: true })}
        tabs={[
          { value: 'partner', label: t('common:scholarshipKind.HANGYUL_PARTNER'), count: poolCount || undefined },
          { value: 'university', label: t('common:scholarshipKind.UNIVERSITY') },
          { value: 'government', label: t('common:scholarshipKind.GOVERNMENT') },
        ]} />
      <p className="hg-small hg-muted" style={{ maxInlineSize: 720 }}>{t(`university:scholarships.kind.${tab === 'partner' ? 'HANGYUL_PARTNER' : tab === 'university' ? 'UNIVERSITY' : 'GOVERNMENT'}`)}</p>
      {tab === 'partner' && (
        <QueryState query={q} skeleton={<SkeletonCard lines={6} />} isEmpty={(d) => d.every((c) => c.pools.length === 0)}
          empty={<EmptyState icon={<Wallet />} title={t('university:scholarships.noPools')} text={t('university:scholarships.noPoolsText')} />}>
          {(contracts) => (
            <div className="hg-stack" style={{ '--hg-gap': '40px' } as React.CSSProperties}>
              {!hasActive && <Callout tone="warning">{t('university:scholarships.noActive')}</Callout>}
              {contracts.flatMap((c) => c.pools.map((p) => <PoolCard key={p.id} pool={p} contract={c} />))}
            </div>
          )}
        </QueryState>
      )}
      {tab === 'university' && <CatalogScholarships kind="UNIVERSITY" />}
      {tab === 'government' && <CatalogScholarships kind="GOVERNMENT" />}
      {create && q.data && <CreateAward contracts={q.data} onClose={() => setCreate(false)} />}
    </div>
  );
}
