import { Lock } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { ApplicationStatus, Freshness } from '@hangyul/types';
import { Badge, Card, CardHeader, EmptyState, FreshnessBadge } from '@hangyul/ui';
import { applicationTone, countryName, flagEmoji, type Tone } from '@hangyul/utils';
import type { ReactNode } from 'react';

import { useUniversity } from '../lib/university';

export function StatusBadge({ status, size }: { status: ApplicationStatus | string; size?: 'sm' }) {
  const { t } = useLocale('common');
  return <Badge tone={applicationTone[status as ApplicationStatus] ?? 'neutral'} size={size}>{t(`appStatus.${status}`, { defaultValue: status })}</Badge>;
}

export function Country({ code }: { code: string | null | undefined }) {
  const { locale } = useLocale('common');
  if (!code) return <span className="hg-subtle">—</span>;
  return <span className="uc-country"><span aria-hidden>{flagEmoji(code)}</span> {countryName(code, locale)}</span>;
}

/**
 * V6: provenance without per-row development labels. Real freshness (verified on…, review due, changed) is shown;
 * seeded sample rows show nothing — the global development indicator discloses the environment once.
 */
export function Provenance({ data, compact }: { data: Partial<Freshness> | null | undefined; compact?: boolean }) {
  if (!data || data.verification_status === 'DEMO') return null;
  return <FreshnessBadge data={data} compact={compact} />;
}

export function Section({ title, subtitle, actions, children, className, id }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <Card as="section" className={className} aria-labelledby={id}>
      <CardHeader title={title} subtitle={subtitle} actions={actions} id={id} />
      <div className="uc-section__body">{children}</div>
    </Card>
  );
}

/** Shown in place of a page when the role cannot use it (the API would also refuse). */
export function NoAccess() {
  const { t } = useLocale('common');
  return <EmptyState icon={<Lock />} title={t('states.forbidden')} text={t('states.forbiddenDetail')} />;
}

export function RequirePerm({ allow, children }: { allow: (p: ReturnType<typeof useUniversity>['perms']) => boolean; children: ReactNode }) {
  const { perms } = useUniversity();
  return allow(perms) ? <>{children}</> : <NoAccess />;
}

export const certificationTone = (s: string | undefined): Tone =>
  s === 'EXCELLENT' || s === 'CERTIFIED' ? 'success' : s === 'VISA_RESTRICTED' ? 'danger' : s === 'BASIC' ? 'info' : 'neutral';

/** Horizontal usage bar (quota / budget) with accessible text. */
export function UsageBar({ used, total, label, tone = 'brand', segments }: {
  used: number; total: number; label: string; tone?: 'brand' | 'teal' | 'info';
  segments?: { value: number; className: string; label: string }[];
}) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="uc-usage" role="img" aria-label={label}>
      {segments ? (
        <div className="uc-usage__track">
          {segments.map((s) => (
            <span key={s.className} className={`uc-usage__seg ${s.className}`} style={{ inlineSize: `${total > 0 ? Math.min(100, (s.value / total) * 100) : 0}%` }} title={s.label} />
          ))}
        </div>
      ) : (
        <div className="uc-usage__track"><span className={`uc-usage__seg uc-usage__seg--${tone}`} style={{ inlineSize: `${pct}%` }} /></div>
      )}
    </div>
  );
}
