// PRIMARY QUESTION: What still blocks launch?
// V9 launch readiness (REPORT §61 H3, GET /agency/hq/readiness): every dependency classified CODE-COMPLETE · NEEDS
// CREDENTIALS · NEEDS PROVIDER AGREEMENT · NEEDS BUSINESS DATA · NEEDS LEGAL APPROVAL · NEEDS HUMAN REVIEW · NEEDS
// INFRASTRUCTURE, generated from the running configuration and real records (integrations come from /admin/readiness:
// nothing is "active" because a variable exists). Blocking (required) items first; values of secrets are never shown.
import { useAuth } from '@hangyul/auth';
import { ErrorState, Skeleton } from '@hangyul/ui';
import { PageHeader, SoftBadge, YCard, type YxTone } from '@hangyul/ynex-ui';
import { formatRelative } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';

import { useT } from '../../components/bits';
import { usePerms } from '../../lib/hooks';

const CATS = ['NEEDS_LEGAL_APPROVAL', 'NEEDS_PROVIDER_AGREEMENT', 'NEEDS_CREDENTIALS', 'NEEDS_INFRASTRUCTURE', 'NEEDS_BUSINESS_DATA', 'NEEDS_HUMAN_REVIEW', 'CODE_COMPLETE'] as const;
type Cat = (typeof CATS)[number];
const TONE: Record<Cat, YxTone> = {
  NEEDS_LEGAL_APPROVAL: 'danger', NEEDS_PROVIDER_AGREEMENT: 'warning', NEEDS_CREDENTIALS: 'orange', NEEDS_INFRASTRUCTURE: 'purple',
  NEEDS_BUSINESS_DATA: 'info', NEEDS_HUMAN_REVIEW: 'teal', CODE_COMPLETE: 'success',
};
interface Item { key: string; group: string; category: Cat; required: boolean; integration_status: string | null; evidence: string | null; requires: string[]; fallback: string | null }
interface Launch { generated_at: string; environment: string; counts: Record<Cat, number>; blocking: string[]; ready_for_launch: boolean; items: Item[] }

function Row({ i }: { i: Item }) {
  const { t } = useT();
  return (
    <li className="ag8-ready__row" data-cat={i.category}>
      <span className="ag8-ready__name">
        <strong>{t(`v9.ready.item.${i.key}`, { defaultValue: t(`v8.ready.item.${i.key}`, { defaultValue: i.key }) })}</strong>
        <span className="ag8-ready__what">{i.required ? t('v9.ready.required') : t('v9.ready.optional')}{i.integration_status ? ` · ${t(`v8.ready.status.${i.integration_status}`, { defaultValue: i.integration_status })}` : ''}</span>
      </span>
      <span className="ag8-ready__status"><SoftBadge tone={TONE[i.category]}>{t(`v9.ready.cat.${i.category}`)}</SoftBadge></span>
      <span className="ag8-ready__detail">
        {i.evidence && <span>{t(`v9.ready.ev.${i.key}`, { defaultValue: i.evidence })}</span>}
        {i.category !== 'CODE_COMPLETE' && i.requires.length > 0 && <span className="text-muted">{t('v8.ready.needs')}: {i.requires.map((r, n) => (/^HG_/.test(r) ? <code key={r} className="ag8-ready__env">{r}</code> : <span key={r}>{n > 0 ? ' · ' : ''}{r} </span>))}</span>}
        {i.category !== 'CODE_COMPLETE' && i.fallback && <span className="text-muted">{t('v8.ready.fallback')}: {i.fallback}</span>}
      </span>
    </li>
  );
}

export default function Readiness() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const perms = usePerms();
  const q = useQuery({ queryKey: ['hq', 'launch-readiness'], queryFn: () => api.get<Launch>('/agency/hq/readiness'), enabled: perms.isHangyul });
  const d = q.data;
  const blocking = d?.items.filter((i) => i.required && i.category !== 'CODE_COMPLETE') ?? [];
  const rest = d?.items.filter((i) => !(i.required && i.category !== 'CODE_COMPLETE')) ?? [];
  return (
    <div className="ag7 ag8-ready">
      <PageHeader eyebrow={t('hq.context')} title={t('v8.nav.readiness')} sub={t('v9.ready.question')} />
      {!perms.isHangyul ? <ErrorState error={{ status: 404 }} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !d ? <Skeleton h={320} /> : (
        <>
          <div className={`ag8-ready__verdict ${d.ready_for_launch ? 'is-ready' : 'is-not'}`} role="status">
            <strong>{d.ready_for_launch ? t('v9.ready.yes') : t('v9.ready.no', { count: d.blocking.length })}</strong>
            <span>{t('v8.ready.env', { env: d.environment })} · {t('v8.ready.checked', { when: formatRelative(d.generated_at, locale) })}</span>
            <span className="ag8-ready__counts">
              {CATS.filter((c) => d.counts[c] > 0).map((c) => <SoftBadge key={c} tone={TONE[c]}>{t(`v9.ready.cat.${c}`)} {d.counts[c]}</SoftBadge>)}
            </span>
          </div>
          <YCard as="section" title={t('v9.ready.blocking')} count={blocking.length} flush>
            <ul className="list-unstyled mb-0">{blocking.map((i, n) => <Row key={`${i.key}-${n}`} i={i} />)}</ul>
          </YCard>
          <YCard as="section" title={t('v9.ready.other')} count={rest.length} flush>
            <ul className="list-unstyled mb-0">{rest.map((i, n) => <Row key={`${i.key}-${n}`} i={i} />)}</ul>
          </YCard>
          <YCard title={t('v8.ready.legendTitle')}>
            <dl className="ag8-ready__legend">
              {CATS.map((c) => <div key={c}><dt><SoftBadge tone={TONE[c]}>{t(`v9.ready.cat.${c}`)}</SoftBadge></dt><dd>{t(`v9.ready.legend.${c}`)}</dd></div>)}
            </dl>
          </YCard>
        </>
      )}
    </div>
  );
}
