/**
 * V9 S3 — PRIMARY QUESTION: "What does my family need to know, and what exactly do they see?"
 * The student makes a read-only family link: chooses what it shows, how long it works (default 30 days), and can turn it
 * off at any time. It never shows messages, essays, counselor notes or document files. Every view is recorded and the
 * student sees when it was last opened.
 */
import { useApi } from '@hangyul/auth';
import { Check, Copy, Link2, Lock } from '@hangyul/icons';
import { LOCALES } from '@hangyul/i18n';
import { Button, Callout, Checkbox, EmptyState, Field, Input, QueryState, Section, Select, SkeletonCard, StatusText, useToast } from '@hangyul/ui';
import { formatDate, formatDateTime } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { PageIntro } from '../components/bits';
import { useT } from '../lib/i18n';
import { daysLeft, SPONSOR_SCOPES, sponsorUrl, type SponsorLink, type SponsorScope } from '../lib/sponsor';

const KEY = ['sponsor-links'];

function CreateLink({ onCreated }: { onCreated: (l: SponsorLink) => void }) {
  const { t, locale } = useT();
  const api = useApi();
  const toast = useToast();
  const [scopes, setScopes] = useState<SponsorScope[]>(['money', 'family_documents', 'dates']);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState(30);
  const [lang, setLang] = useState(locale);
  const make = useMutation({
    mutationFn: () => api.post<SponsorLink>('/me/sponsor-links', { scopes, label: label.trim() || null, days, locale: lang }),
    onSuccess: onCreated,
    onError: (e) => toast.error((e as Error).message),
  });
  const toggle = (s: SponsorScope) => setScopes((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  return (
    <form className="v9-family__form" onSubmit={(e) => { e.preventDefault(); if (scopes.length) make.mutate(); }}>
      <fieldset className="v9-family__scopes">
        <legend className="hg-label">{t('v9.family.scopesLabel')}</legend>
        {SPONSOR_SCOPES.map((s) => (
          <Checkbox key={s} checked={scopes.includes(s)} onChange={() => toggle(s)}
            label={<span><span className="hg-medium">{t(`v9.family.scope.${s}`)}</span><span className="v9-family__hint">{t(`v9.family.scopeHint.${s}`)}</span></span>} />
        ))}
      </fieldset>
      <p className="v9-family__never"><Lock aria-hidden /> {t('v9.family.never')}</p>
      <div className="v9-family__row">
        <Field label={t('v9.family.label')} htmlFor="fam-label" hint={t('v9.family.labelHint')}>
          <Input id="fam-label" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label={t('v9.family.days')} htmlFor="fam-days">
          <Select id="fam-days" value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 30, 60, 90].map((d) => <option key={d} value={d}>{t('v9.family.daysOption', { count: d })}</option>)}
          </Select>
        </Field>
        <Field label={t('v9.family.lang')} htmlFor="fam-lang" hint={t('v9.family.langHint')}>
          <Select id="fam-lang" value={lang} onChange={(e) => setLang(e.target.value)}>
            {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </Select>
        </Field>
      </div>
      <p className="hg-small hg-muted">{t('v9.family.consent')}</p>
      <div><Button type="submit" variant="primary" disabled={!scopes.length} loading={make.isPending} icon={<Link2 />}>{t('v9.family.create')}</Button></div>
    </form>
  );
}

function NewLink({ link }: { link: SponsorLink }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const url = sponsorUrl(link.path ?? '');
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <Callout tone="success" title={t('v9.family.created')}>
      <p className="hg-small">{t('v9.family.createdText')}</p>
      <div className="v9-family__url">
        <Input readOnly value={url} aria-label={t('v9.family.urlLabel')} onFocus={(e) => e.currentTarget.select()} />
        <Button size="sm" icon={copied ? <Check /> : <Copy />} onClick={copy}>{copied ? t('v9.family.copied') : t('v9.family.copy')}</Button>
      </div>
      <p className="hg-xs hg-subtle">{t('v9.family.onlyOnce')}</p>
    </Callout>
  );
}

function LinkRow({ l }: { l: SponsorLink }) {
  const { t, locale } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const revoke = useMutation({
    mutationFn: () => api.post<SponsorLink>(`/me/sponsor-links/${l.id}/revoke`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  const left = daysLeft(l.expires_at);
  return (
    <li className="v9-family__link" data-state={l.state}>
      <div className="v9-family__link-main">
        <p className="hg-medium">{l.label || t('v9.family.unnamed')}</p>
        <p className="hg-small hg-muted">{l.scopes.map((s) => t(`v9.family.scope.${s}`)).join(' · ')}</p>
        <p className="hg-xs hg-subtle">
          {l.last_viewed_at ? t('v9.family.lastOpened', { when: formatDateTime(l.last_viewed_at, locale), count: l.view_count }) : t('v9.family.notOpened')}
          {' · '}
          {l.state === 'ACTIVE' ? t('v9.family.expires', { date: formatDate(l.expires_at, locale), count: Math.max(0, left) })
            : t(`v9.family.state.${l.state}`)}
        </p>
      </div>
      <div className="v9-family__link-end">
        <StatusText tone={l.state === 'ACTIVE' ? 'success' : 'neutral'} hollow={l.state !== 'ACTIVE'}>{t(`v9.family.state.${l.state}`)}</StatusText>
        {l.state === 'ACTIVE' && <Button size="sm" variant="ghost" loading={revoke.isPending} onClick={() => revoke.mutate()}>{t('v9.family.revoke')}</Button>}
      </div>
    </li>
  );
}

export default function Family() {
  const { t } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: () => api.get<{ items: SponsorLink[] }>('/me/sponsor-links') });
  const [fresh, setFresh] = useState<SponsorLink | null>(null);
  return (
    <div className="st-page v9-family">
      <PageIntro title={t('v9.family.title')} subtitle={t('v9.family.subtitle')} />
      {fresh && <NewLink link={fresh} />}
      <Section title={t('v9.family.newTitle')}>
        <CreateLink onCreated={(l) => { setFresh(l); qc.invalidateQueries({ queryKey: KEY }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
      </Section>
      <Section title={t('v9.family.listTitle')}>
        <QueryState query={q} skeleton={<SkeletonCard lines={3} />} isEmpty={(d) => d.items.length === 0}
          empty={<EmptyState title={t('v9.family.empty')} text={t('v9.family.emptyText')} />}>
          {(d) => <ul className="hg-panel v9-family__links">{d.items.map((l) => <LinkRow key={l.id} l={l} />)}</ul>}
        </QueryState>
      </Section>
    </div>
  );
}
