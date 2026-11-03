/** V5 concierge — shared pieces for Arrival, Housing and Help (student web). Strings live in the `concierge` namespace. */
import { useApi } from '@hangyul/auth';
import { useLocale } from '@hangyul/i18n';
import { Ambulance, BadgeInfo, Check, ExternalLink, Phone, Shield } from '@hangyul/icons';
import type { EmergencyInfo, OfficialFacts, ServiceCase, ServiceVendor } from '@hangyul/types';
import { Button, Textarea, useToast } from '@hangyul/ui';
import { formatDate, formatMoney } from '@hangyul/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import '../concierge.css';

export function useCT() {
  return useLocale(['concierge', 'common', 'student']);
}

/** "Official source: HiKorea · checked 29 Sep 2026" — or an honest "still being confirmed". */
export function OfficialNote({ official, compact }: { official: OfficialFacts | null | undefined; compact?: boolean }) {
  const { t, locale } = useCT();
  if (!official) return null;
  const s = official.source;
  if (!s || official.status === 'NEEDS_REVIEW') {
    return <p className="cg-source cg-source--review">{t('official.needsReview')}{s?.url && <> · <a href={s.url} target="_blank" rel="noreferrer" className="hg-link" data-source-quote={s.name ? true : undefined}>{s.name ?? t('official.source')}</a></>}</p>;
  }
  return (
    <p className="cg-source">
      {t(official.status === 'VERIFIED' ? 'official.checked' : 'official.partly')}{' '}
      <a href={s.url ?? '#'} target="_blank" rel="noreferrer" className="hg-link" data-source-quote={s.name ? true : undefined}>{s.name ?? t('official.source')}</a>
      {s.verified_at && !compact && <> · {t('official.lastChecked', { date: formatDate(s.verified_at, locale) })}</>}
    </p>
  );
}

/**
 * Research/catalogue text that exists only in English. In English it reads as normal text; in any other language it is
 * kept as a quoted source behind a disclosure ("Official text, in English") so the page itself stays in the reader's
 * language — the translated explanation is the step text above it.
 */
export function SourceQuote({ children }: { children: React.ReactNode }) {
  const { t, locale } = useCT();
  if (locale.startsWith('en')) return <>{children}</>;
  return (
    <details className="cg-srcq" data-source-quote>
      <summary className="hg-link hg-small">{t('official.sourceText')}</summary>
      <div lang="en">{children}</div>
    </details>
  );
}

/** Facts from the official research: summary, what to bring, timing, cost. English source text is shown as the source says it. */
export function OfficialFactsBlock({ official, show = ['summary', 'documents', 'timing', 'cost'] }: { official: OfficialFacts | null | undefined; show?: ('summary' | 'steps' | 'documents' | 'timing' | 'cost')[] }) {
  const { locale } = useCT();
  if (!official || (!official.summary && !official.documents.length)) return <OfficialNote official={official} />;
  if (!locale.startsWith('en')) {
    return <div className="cg-facts"><SourceQuote><OfficialFactsBody official={official} show={show} /></SourceQuote><OfficialNote official={official} /></div>;
  }
  return <div className="cg-facts"><OfficialFactsBody official={official} show={show} /><OfficialNote official={official} /></div>;
}

function OfficialFactsBody({ official, show }: { official: OfficialFacts; show: ('summary' | 'steps' | 'documents' | 'timing' | 'cost')[] }) {
  const { t } = useCT();
  return (
    <>
      {show.includes('summary') && official.summary && <p className="cg-facts__summary">{official.summary}</p>}
      {show.includes('steps') && official.steps.length > 0 && (
        <ol className="cg-facts__list">{official.steps.map((x) => <li key={x}>{x}</li>)}</ol>
      )}
      {show.includes('documents') && official.documents.length > 0 && (
        <div><p className="cg-facts__label">{t('official.bring')}</p><ul className="cg-facts__list">{official.documents.map((x) => <li key={x}>{x}</li>)}</ul></div>
      )}
      {show.includes('timing') && official.timing && <p className="hg-small"><span className="cg-facts__label">{t('official.timing')}</span> {official.timing}</p>}
      {show.includes('cost') && official.cost && <p className="hg-small"><span className="cg-facts__label">{t('official.cost')}</span> {official.cost}</p>}
    </>
  );
}

/** Who provides the service — "Hangyul partner" only with an active agreement. Seeded providers carry no per-row label (is_demo stays in the API). */
export function ProviderLine({ vendor }: { vendor: ServiceVendor | null | undefined }) {
  const { t } = useCT();
  if (!vendor) return null;
  return (
    <span className="cg-provider">
      {t('provider.by', { name: vendor.name })}
      {vendor.label === 'PARTNER' && <span className="cg-tag">{t('provider.partner')}</span>}
    </span>
  );
}

/** Money on a service: always says who pays (student → provider, Hangyul plan, university) — never mixed with tuition. */
export function CostLine({ cost }: { cost: ServiceCase['cost'] }) {
  const { t, locale } = useCT();
  if (!cost || !cost.payer) return null;
  const amount = cost.amount != null ? formatMoney(cost.amount, cost.currency ?? 'KRW', locale) : null;
  return <span className="cg-cost">{t(`cost.${cost.payer}`, { amount: amount ?? t('cost.tbc') })}</span>;
}

/** A compact horizontal/vertical progress for a service flow. */
export function Flow({ steps, current, type, label }: { steps: readonly string[]; current: number; type: string; label: string }) {
  const { t } = useCT();
  return (
    <ol className="cg-flow" aria-label={label}>
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={s} className="cg-flow__step" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="cg-flow__dot" aria-hidden>{state === 'done' ? <Check /> : null}</span>
            <span className="cg-flow__label">{t(`status.${type}.${s}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function CaseStatus({ c }: { c: ServiceCase }) {
  const { t } = useCT();
  // V5 visa: VISA_SUPPORT statuses live in the visaroute namespace.
  const label = c.type === 'VISA_SUPPORT' ? t(`visaroute:support.status.${c.status}`, { defaultValue: c.status }) : t(c.status_key, { defaultValue: c.status });
  return <span className="cg-status" data-wait={c.waiting_on}>{label}</span>;
}

/** "Did this go well?" — one line, yes/no + optional comment. */
export function FeedbackLine({ c }: { c: ServiceCase }) {
  const { t } = useCT();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const [ok, setOk] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const m = useMutation({
    mutationFn: () => api.concierge.feedback(c.id, { ok: ok!, comment: comment.trim() || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['arrival-journey'] }); qc.invalidateQueries({ queryKey: ['housing'] }); qc.invalidateQueries({ queryKey: ['help'] }); toast.success(t('feedback.thanks')); },
  });
  if (c.feedback.ok !== null) return <p className="hg-small hg-muted">{t(c.feedback.ok ? 'feedback.gaveYes' : 'feedback.gaveNo')}</p>;
  return (
    <div className="cg-feedback">
      <span className="hg-small">{t('feedback.question')}</span>
      <div className="hg-row" style={{ gap: 8 }}>
        <Button size="sm" variant={ok === true ? 'soft' : 'secondary'} onClick={() => setOk(true)} aria-pressed={ok === true}>{t('feedback.yes')}</Button>
        <Button size="sm" variant={ok === false ? 'soft' : 'secondary'} onClick={() => setOk(false)} aria-pressed={ok === false}>{t('feedback.no')}</Button>
      </div>
      {ok !== null && (
        <div className="hg-stack" style={{ '--hg-gap': '8px' } as React.CSSProperties}>
          <Textarea aria-label={t('feedback.comment')} placeholder={t('feedback.comment')} rows={2} value={comment} onChange={(e) => setComment(e.target.value.slice(0, 500))} />
          <div><Button size="sm" variant="primary" loading={m.isPending} onClick={() => m.mutate()}>{t('feedback.send')}</Button></div>
        </div>
      )}
    </div>
  );
}

const ICON: Record<string, React.ReactNode> = { police: <Shield aria-hidden />, fire_ambulance: <Ambulance aria-hidden />, immigration: <BadgeInfo aria-hidden />, travel_helpline: <Phone aria-hidden />, nhis_foreigners: <BadgeInfo aria-hidden /> };

export function EmergencyNumbers({ emergency, compact }: { emergency: EmergencyInfo | null | undefined; compact?: boolean }) {
  const { t } = useCT();
  if (!emergency) return null;
  const nums = compact ? emergency.numbers.filter((n) => ['112', '119', '1345', '1330'].includes(n.number)) : emergency.numbers;
  return (
    <section className="cg-emergency" aria-labelledby="cg-emergency-title">
      <h2 id="cg-emergency-title" className="hg-title-sm">{t('emergency.title')}</h2>
      <p className="hg-small hg-muted">{t('emergency.subtitle')}</p>
      <ul className="cg-emergency__list">
        {nums.map((n) => (
          <li key={n.number}>
            {ICON[n.key] ?? <Phone aria-hidden />}
            <a href={`tel:${n.number.replace(/-/g, '')}`} className="cg-emergency__num">{n.number}</a>
            <span>
              {t(`emergency.${n.key}`, { defaultValue: n.key })}
              {!compact && n.source?.url && <a className="cg-emergency__src" href={n.source.url} target="_blank" rel="noreferrer" aria-label={t('official.sourceFor', { name: n.number })}><ExternalLink aria-hidden /></a>}
            </span>
          </li>
        ))}
      </ul>
      <p className="hg-xs hg-subtle">{t('emergency.note')}</p>
    </section>
  );
}
