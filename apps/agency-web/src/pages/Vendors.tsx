// PRIMARY QUESTION: Which arrival services are at risk, and with whom?
// V9 (REPORT §59 A6): per provider — agreement status FIRST ("No agreement recorded" is never called a partner), then
// the service types it handles, open and late cases, and its last issue (GET /agency/providers). Logic unchanged otherwise.
/**
 * Providers (V5 concierge): the vendor / partner network behind services. A provider is shown to students as a
 * "partner" only while its agreement is active (with a contract reference) (the environment indicator discloses synthetic data once).
 */
import { useAuth } from '@hangyul/auth';
import { Plus, Store } from '@hangyul/icons';
import type { ServiceVendor } from '@hangyul/types';
import { Button, Checkbox, Drawer, EmptyState, Field, Input, PageHeader, QueryState, FilterSelect, Select, Skeleton, StatusText, Textarea, useToast } from '@hangyul/ui';
import { formatDate } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useCT } from '../components/ServiceCases';

type Draft = { name: string; kind: string; service_area: string; languages: string; price_model: string; availability: string; sla_hours: string;
  contact_name: string; contact_phone: string; contact_email: string; quality_status: string; agreement_active: boolean; agreement_since: string; agreement_until: string; agreement_reference: string; notes: string; network: boolean };

const blank = (kind: string): Draft => ({ name: '', kind, service_area: '', languages: '', price_model: '', availability: '', sla_hours: '', contact_name: '', contact_phone: '', contact_email: '',
  quality_status: 'NEW', agreement_active: false, agreement_since: '', agreement_until: '', agreement_reference: '', notes: '', network: false });

interface ProviderRow { id: string; agreement_status: 'ACTIVE' | 'INACTIVE' | 'NONE'; service_types: string[]; open_cases: number; late_cases: number;
  last_issue: { kind: string; at: string; case_type: string; link: string } | null }

function fromVendor(v: ServiceVendor): Draft {
  return { name: v.name, kind: v.kind, service_area: (v.service_area ?? []).join(', '), languages: (v.languages ?? []).join(', '), price_model: v.price_model ?? '', availability: v.availability ?? '',
    sla_hours: v.sla_hours ? String(v.sla_hours) : '', contact_name: v.contact?.name ?? '', contact_phone: v.contact?.phone ?? '', contact_email: v.contact?.email ?? '',
    quality_status: v.quality_status ?? 'NEW', agreement_active: !!v.agreement?.active, agreement_since: v.agreement?.since ?? '', agreement_until: v.agreement?.until ?? '',
    agreement_reference: v.agreement?.reference ?? '', notes: v.notes ?? '', network: !!v.network };
}

function VendorForm({ initial, kinds, onDone, id, canNetwork }: { initial: Draft; kinds: string[]; onDone: () => void; id?: string; canNetwork: boolean }) {
  const { t } = useCT();
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState(initial);
  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const save = useMutation({
    mutationFn: () => {
      const body = { name: d.name.trim(), kind: d.kind, service_area: list(d.service_area), languages: list(d.languages), price_model: d.price_model || null, availability: d.availability || null,
        sla_hours: d.sla_hours ? Number(d.sla_hours) : null, contact: { name: d.contact_name || undefined, phone: d.contact_phone || undefined, email: d.contact_email || undefined },
        quality_status: d.quality_status, notes: d.notes || null, network: d.network,
        agreement: d.agreement_active || d.agreement_reference ? { active: d.agreement_active, since: d.agreement_since || null, until: d.agreement_until || null, reference: d.agreement_reference || null } : null };
      return id ? api.concierge.updateVendor(id, body) : api.concierge.createVendor(body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); toast.success(t('staff.saved')); onDone(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value });
  return (
    <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <Field label={t('vendors.name')} htmlFor="v-name"><Input id="v-name" required value={d.name} onChange={set('name')} /></Field>
      <div className="cq-grid">
        <Field label={t('vendors.kind')} htmlFor="v-kind"><Select id="v-kind" value={d.kind} onChange={set('kind')}>{kinds.map((k) => <option key={k} value={k}>{t(`vendors.kinds.${k}`)}</option>)}</Select></Field>
        <Field label={t('vendors.quality')} htmlFor="v-q"><Select id="v-q" value={d.quality_status} onChange={set('quality_status')}>{['NEW', 'GOOD', 'WATCH', 'SUSPENDED'].map((k) => <option key={k} value={k}>{t(`vendors.q.${k}`)}</option>)}</Select></Field>
        <Field label={t('vendors.area')} htmlFor="v-area" hint={t('vendors.commaHint')}><Input id="v-area" value={d.service_area} onChange={set('service_area')} placeholder="ICN, GMP, Seoul" /></Field>
        <Field label={t('vendors.languages')} htmlFor="v-lang" hint={t('vendors.commaHint')}><Input id="v-lang" value={d.languages} onChange={set('languages')} placeholder="ko, en, vi" /></Field>
        <Field label={t('vendors.sla')} htmlFor="v-sla" optional><Input id="v-sla" inputMode="numeric" value={d.sla_hours} onChange={(e) => setD({ ...d, sla_hours: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label={t('vendors.availability')} htmlFor="v-av" optional><Input id="v-av" value={d.availability} onChange={set('availability')} /></Field>
      </div>
      <Field label={t('vendors.price')} htmlFor="v-price" optional><Input id="v-price" value={d.price_model} onChange={set('price_model')} /></Field>
      <div className="cq-grid">
        <Field label={t('vendors.contactName')} htmlFor="v-cn" optional><Input id="v-cn" value={d.contact_name} onChange={set('contact_name')} /></Field>
        <Field label={t('vendors.phone')} htmlFor="v-cp" optional><Input id="v-cp" value={d.contact_phone} onChange={set('contact_phone')} /></Field>
        <Field label={t('vendors.email')} htmlFor="v-ce" optional><Input id="v-ce" type="email" value={d.contact_email} onChange={set('contact_email')} /></Field>
      </div>
      <fieldset className="cq-block" style={{ border: 0, margin: 0, padding: '16px 0 0' }}>
        <legend className="cq-h">{t('vendors.agreement')}</legend>
        <p className="hg-xs hg-subtle">{t('vendors.agreementHint')}</p>
        <Checkbox label={t('vendors.agreementActive')} checked={d.agreement_active} onChange={(e) => setD({ ...d, agreement_active: (e.target as HTMLInputElement).checked })} />
        <div className="cq-grid">
          <Field label={t('vendors.reference')} htmlFor="v-ref" optional={!d.agreement_active}><Input id="v-ref" value={d.agreement_reference} onChange={set('agreement_reference')} /></Field>
          <Field label={t('vendors.since')} htmlFor="v-since" optional><Input id="v-since" type="date" value={d.agreement_since} onChange={set('agreement_since')} /></Field>
          <Field label={t('vendors.until')} htmlFor="v-until" optional><Input id="v-until" type="date" value={d.agreement_until} onChange={set('agreement_until')} /></Field>
        </div>
      </fieldset>
      <Field label={t('vendors.notes')} htmlFor="v-notes" optional><Textarea id="v-notes" rows={2} value={d.notes} onChange={set('notes')} /></Field>
      {canNetwork && !id && <Checkbox label={t('vendors.network')} checked={d.network} onChange={(e) => setD({ ...d, network: (e.target as HTMLInputElement).checked })} />}
      <div><Button type="submit" variant="primary" loading={save.isPending}>{t('vendors.save')}</Button></div>
    </form>
  );
}

function Row({ editable, onOpen, children }: { editable: boolean; onOpen: () => void; children: React.ReactNode }) {
  return editable
    ? <button type="button" className="ag9-prov" onClick={onOpen}>{children}</button>
    : <div className="ag9-prov" style={{ cursor: 'default' }}>{children}</div>;
}

export default function Vendors() {
  const { t, locale } = useCT();
  const { api, isHangyul } = useAuth();
  const [kind, setKind] = useState('');
  const [editing, setEditing] = useState<ServiceVendor | 'new' | null>(null);
  const q = useQuery({ queryKey: ['vendors', kind || 'all'], queryFn: () => api.concierge.vendors(kind || undefined) });
  const ov = useQuery({ queryKey: ['vendors', 'overview'], queryFn: () => api.get<{ items: ProviderRow[]; counts: Record<string, number> }>('/agency/providers') });
  const byId = new Map((ov.data?.items ?? []).map((r) => [r.id, r]));
  const canEdit = (v: ServiceVendor) => !!q.data?.can_manage && (!v.network || isHangyul);
  return (
    <div className="hg-stack ag-page">
      <PageHeader title={t('vendors.title')} subtitle={t('vendors.subtitle')}
        actions={q.data?.can_manage ? <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>{t('vendors.add')}</Button> : undefined} />
      <div className="hg-panel">
        <div className="ag-card-toolbar">
          <FilterSelect size="sm" label={t('vendors.kind')} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">{t('vendors.allKinds')}</option>
            {(q.data?.kinds ?? []).map((k) => <option key={k} value={k}>{t(`vendors.kinds.${k}`)}</option>)}
          </FilterSelect>
        </div>
        <QueryState query={q} skeleton={<div style={{ padding: 16 }}><Skeleton h={40} /></div>} isEmpty={(d) => d.items.length === 0}
          empty={<EmptyState icon={<Store />} title={t('vendors.empty')} text={t('vendors.emptyText')} />}>
          {(d) => (
            <div>
              <div className="ag9-prov ag9-prov--head" aria-hidden>
                <span>{t('agency:vendorsPage.agreement')}</span><span>{t('agency:vendorsPage.provider')}</span><span>{t('agency:v9.prov.types')}</span>
                <span className="text-end">{t('agency:v9.prov.open')}</span><span className="text-end">{t('agency:v9.prov.late')}</span><span>{t('agency:v9.prov.lastIssue')}</span>
              </div>
              {[...d.items].sort((a, b) => ((byId.get(b.id)?.late_cases ?? 0) - (byId.get(a.id)?.late_cases ?? 0)) || ((byId.get(b.id)?.open_cases ?? 0) - (byId.get(a.id)?.open_cases ?? 0))).map((v) => {
                const o = byId.get(v.id);
                const st = o?.agreement_status ?? (v.agreement_active ? 'ACTIVE' : v.agreement ? 'INACTIVE' : 'NONE');
                return (
                  /* V23 crawl: a vendor this account cannot edit (a Hangyul-network vendor) is a row, not a disabled button. */
                  <Row key={v.id} editable={canEdit(v)} onOpen={() => setEditing(v)}>
                    <span className="hg-xs">
                      {st === 'ACTIVE' ? <StatusText tone="success">{t('vendors.partnerUntil', { date: v.agreement?.until ? formatDate(v.agreement.until, locale) : t('vendors.openEnded') })}</StatusText>
                        : st === 'INACTIVE' ? <StatusText tone="warning">{t('agency:v9.prov.inactive')}</StatusText>
                          : <StatusText tone="neutral">{t('agency:v9.prov.none')}</StatusText>}
                    </span>
                    <span className="min-w-0"><span className="cq-vendor__name">{v.name}</span><br /><span className="hg-xs hg-subtle">{t(`vendors.kinds.${v.kind}`)} · {v.network ? t('vendors.networkShort') : t('vendors.ownShort')} · {t(`vendors.q.${v.quality_status ?? 'NEW'}`)}</span></span>
                    <span className="hg-xs">{(o?.service_types ?? []).map((x) => t(`type.${x}`, { defaultValue: x })).join(', ') || <span className="hg-subtle">—</span>}</span>
                    <span className="hg-num text-end">{o ? o.open_cases : '…'}</span>
                    <span className={o?.late_cases ? 'hg-num text-end text-danger fw-semibold' : 'hg-num text-end hg-subtle'}>{o ? o.late_cases : '…'}</span>
                    <span className="hg-xs">{o?.last_issue ? <>{t(`agency:v9.prov.issue.${o.last_issue.kind}`, { defaultValue: o.last_issue.kind })}<span className="hg-subtle"> · {formatDate(o.last_issue.at, locale, { month: 'short', day: 'numeric' })}</span></> : <span className="hg-subtle">{t('agency:v9.prov.noIssue')}</span>}</span>
                  </Row>
                );
              })}
            </div>
          )}
        </QueryState>
      </div>
      <p className="hg-xs hg-subtle">{t('agency:vendorsPage.rule')}</p>
      <Drawer open={!!editing} onClose={() => setEditing(null)} width={560} title={editing === 'new' ? t('vendors.add') : editing ? editing.name : ''}>
        {editing && <VendorForm key={editing === 'new' ? 'new' : editing.id} id={editing === 'new' ? undefined : editing.id} initial={editing === 'new' ? blank(q.data?.kinds[0] ?? 'airport_transport') : fromVendor(editing)}
          kinds={q.data?.kinds ?? []} canNetwork={isHangyul} onDone={() => setEditing(null)} />}
      </Drawer>
    </div>
  );
}
