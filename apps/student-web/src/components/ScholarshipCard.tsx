import { CheckCircle2, CircleHelp, Landmark, School, Sparkles, Tag, XCircle } from '@hangyul/icons';
import type { Scholarship, ScholarshipKind } from '@hangyul/types';
import { Badge, Card, FreshnessBadge } from '@hangyul/ui';
import { formatDate, type Tone } from '@hangyul/utils';
import type { ReactNode } from 'react';

import { useT } from '../lib/i18n';
import { DaysLeft, Krw } from './bits';

export const KIND_TONE: Record<ScholarshipKind, Tone> = { UNIVERSITY: 'teal', GOVERNMENT: 'info', HANGYUL_PARTNER: 'brand', OTHER: 'neutral' };
const KIND_ICON: Record<ScholarshipKind, ReactNode> = { UNIVERSITY: <School />, GOVERNMENT: <Landmark />, HANGYUL_PARTNER: <Sparkles />, OTHER: <Tag /> };

export function KindBadge({ kind }: { kind: ScholarshipKind }) {
  const { t } = useT();
  return <Badge tone={KIND_TONE[kind]} size="sm" icon={KIND_ICON[kind]}>{t(`common:scholarshipKind.${kind}`)}</Badge>;
}

type Check = NonNullable<Scholarship['eligibility']>['checks'][number];
type TFn = ReturnType<typeof useT>['t'];

/** V9 l10n: a scholarship rule in the reader's language from its rule code; null when no translation exists. */
export function ruleText(t: TFn, c: Check): string | null {
  if (!c.field) return null;
  const key = c.field === 'degree_level' && !c.operator ? 'degree_level' : `${c.field}_${c.operator}`;
  const s = t(`common:v9.l10n.rule.${key}`, { value: String(c.value ?? ''), defaultValue: '' });
  return s && !s.includes('{{') ? s : null;
}

/**
 * Catalogue text that only exists in English (scholarship coverage, descriptions, rule wording). English readers see it
 * as is; other readers get it behind an "Exact wording (English)" disclosure, marked lang="en" as a source quote.
 */
export function SourceText({ text, className }: { text: string; className?: string }) {
  const { t, locale } = useT();
  if (locale.startsWith('en')) return <span className={className}>{text}</span>;
  return (
    <details className={className}>
      <summary className="hg-xs hg-muted">{t('common:v9.l10n.exactWording')}</summary>
      <span lang="en" data-source-quote>{text}</span>
    </details>
  );
}

/** A rule check: translated when the rule code is known, otherwise the catalogue wording. */
export function CheckText({ c }: { c: Check }) {
  const { t, locale } = useT();
  const tr = ruleText(t, c);
  if (tr && !locale.startsWith('en')) return <span>{tr}</span>;
  return locale.startsWith('en') ? <span>{c.text}</span> : <SourceText text={c.text} />;
}

export function ScholarshipCard({ s, showChecks = true }: { s: Scholarship; showChecks?: boolean }) {
  const { t, locale } = useT();
  const waiver = s.tuition_waiver_percent_min !== null || s.tuition_waiver_percent_max !== null
    ? s.tuition_waiver_percent_min === s.tuition_waiver_percent_max || s.tuition_waiver_percent_max === null
      ? t('scholarships.waiverOne', { pct: s.tuition_waiver_percent_min ?? s.tuition_waiver_percent_max })
      : t('scholarships.waiverRange', { min: s.tuition_waiver_percent_min ?? 0, max: s.tuition_waiver_percent_max })
    : null;
  return (
    <Card className="st-schol" as="article">
      <div className="hg-row-wrap" style={{ '--hg-gap': '6px' } as React.CSSProperties}>
        <KindBadge kind={s.kind} />
        {s.eligibility && (
          <Badge size="sm" tone={s.eligibility.status === 'ELIGIBLE' ? 'success' : s.eligibility.status === 'POSSIBLE' ? 'warning' : 'neutral'}>
            {t(`common:eligibility.${s.eligibility.status}`)}
          </Badge>
        )}
        {s.is_automatic && <Badge size="sm" tone="neutral" outline>{t('scholarships.automatic')}</Badge>}
      </div>
      <h3 className="st-schol__name">{s.name}</h3>
      <div className="hg-muted hg-small">{s.provider}{s.university_name ? ` · ${s.university_name}` : ''}</div>
      {(s.coverage || waiver || s.amount_krw) && (
        <div className="st-schol__cover">
          {s.coverage && <SourceText text={s.coverage} />}
          {waiver && <span className="hg-strong">{waiver}</span>}
          {s.amount_krw ? <span className="hg-strong"><Krw value={s.amount_krw} /></span> : null}
        </div>
      )}
      {s.description && (locale.startsWith('en') ? <p className="hg-muted hg-small hg-clamp-2" title={s.description}>{s.description}</p> : <SourceText className="hg-muted hg-small" text={s.description} />)}
      {showChecks && s.eligibility && s.eligibility.checks.length > 0 && (
        <ul className="st-checks" aria-label={t('scholarships.checks')}>
          {s.eligibility.checks.map((c, i) => (
            <li key={i} data-ok={String(c.ok)}>
              {c.ok === true ? <CheckCircle2 aria-hidden /> : c.ok === false ? <XCircle aria-hidden /> : <CircleHelp aria-hidden />}
              <span className="hg-sr-only">{c.ok === true ? t('scholarships.checkOk') : c.ok === false ? t('scholarships.checkNo') : t('scholarships.checkUnknown')}: </span>
              <CheckText c={c} />
            </li>
          ))}
        </ul>
      )}
      <div className="st-schol__foot">
        {s.application_deadline ? (
          <span className="hg-row" style={{ '--hg-gap': '6px' } as React.CSSProperties}>
            <span className="hg-xs hg-muted">{t('common:time.due', { date: formatDate(s.application_deadline, locale) })}</span>
            <DaysLeft date={s.application_deadline} size="sm" />
          </span>
        ) : <span className="hg-xs hg-subtle">{t('scholarships.noDeadline')}</span>}
        <FreshnessBadge data={s} />
      </div>
    </Card>
  );
}
