import { useAuth } from '@hangyul/auth';
import { PlugZap, ShieldCheck, Shuffle } from '@hangyul/icons';
import { PageHeader } from '@hangyul/ynex-ui';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { useT } from '../../components/bits';

/**
 * Hangyul operations — the tools, kept off the incident view (REPORT §79.7, brief Part 14).
 *
 * `/hq` answers one question: *where is something going wrong right now?* V10 put three more destinations beside
 * it — the assignment override, the source registry and launch readiness — none of which answers that question.
 * Source freshness already appears on `/hq` as an incident row with a link to its queue, so the registry is the
 * detail behind an incident rather than a place to visit; readiness asks "what still blocks launch?", which is a
 * planning question; the override is a rare action.
 *
 * All three keep their routes and are one click from here. HQ stays two rail items: incidents, and health.
 */
export default function HqManage() {
  const { t } = useT();
  const items: { to: string; label: string; hint: string; icon: ReactNode }[] = [
    { to: '/hq/sources', label: t('nav.sources'), hint: t('v11.hq.sourcesHint'), icon: <ShieldCheck /> },
    { to: '/hq/readiness', label: t('v8.nav.readiness'), hint: t('v11.hq.readinessHint'), icon: <PlugZap /> },
    { to: '/hq/assignments', label: t('sidebar.override'), hint: t('v11.hq.overrideHint'), icon: <Shuffle /> },
  ];
  return (
    <div className="hg-stack ag-page">
      <PageHeader title={t('v11.hq.title')} sub={t('v11.hq.sub')} />
      <ul className="ag-manage__list">
        {items.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="ag-manage__item">
              <span className="ag-manage__icon" aria-hidden>{i.icon}</span>
              <span><strong>{i.label}</strong><span>{i.hint}</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <GuideReview />
    </div>
  );
}

interface ReviewItem { kind: string; university?: string | null; university_ko?: string | null; degree_level?: string; applications?: number;
  guide?: { title: string | null; source_url: string | null; intake_year: number; term: string } | null; reviewer_note?: string | null; conflicts?: unknown[] | null }

/**
 * V27 (REPORT §357): admission guides a person must look at. A university × level with students preparing and no
 * verified guide shows them no checklist at all — this list is where that gets fixed, biggest queue first.
 */
function GuideReview() {
  const { t, locale } = useT();
  const { api } = useAuth();
  const q = useQuery({ queryKey: ['hq', 'guide-review'], queryFn: () => api.get<{ items: ReviewItem[] }>('/agency/hq/admission-guides/review') });
  const items = q.data?.items ?? [];
  return (
    <section className="ag-subsection" aria-labelledby="hq-guides-h">
      <h2 className="ag-h3" id="hq-guides-h">{t('v27.hq.guidesTitle')}</h2>
      <p className="hg-small hg-muted">{t('v27.hq.guidesSub')}</p>
      {q.isLoading ? null : items.length === 0 ? <p className="hg-small">{t('v27.hq.guidesNone')}</p> : (
        <ul className="hg-list">
          {items.map((i, n) => (
            <li key={n} className="hg-row hg-between" style={{ padding: '10px 0', gap: 12 }}>
              <span style={{ minWidth: 0 }}>
                <strong className="hg-small">{i.kind === 'MISSING_GUIDE'
                  ? `${locale === 'ko' && i.university_ko ? i.university_ko : i.university} · ${t(`degreeShort.${i.degree_level}`, { defaultValue: i.degree_level })}`
                  : i.guide?.title}</strong>
                <span className="hg-xs hg-muted" style={{ display: 'block' }}>
                  {t(`v27.hq.kind.${i.kind}`)}{i.applications ? ` · ${t('v27.hq.waiting', { count: i.applications })}` : ''}{i.reviewer_note ? ` · ${i.reviewer_note}` : ''}
                </span>
              </span>
              {i.guide?.source_url && <a className="hg-small" href={i.guide.source_url} target="_blank" rel="noopener noreferrer">{t('v27.guide.source')}</a>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
