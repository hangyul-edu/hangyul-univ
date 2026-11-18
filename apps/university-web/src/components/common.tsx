import { Lock } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { ApplicationStatus, Freshness } from '@hangyul/types';
import { MARKETS } from '@hangyul/i18n';
import { Badge, Card, CardHeader, EmptyState, Flag, FreshnessBadge } from '@hangyul/ui';
import { applicationTone, countryName, type Tone } from '@hangyul/utils';
import type { ReactNode } from 'react';

import { useUniversity } from '../lib/university';

export function StatusBadge({ status, size }: { status: ApplicationStatus | string; size?: 'sm' }) {
  const { t } = useLocale('common');
  return <Badge tone={applicationTone[status as ApplicationStatus] ?? 'neutral'} size={size}>{t(`appStatus.${status}`, { defaultValue: status })}</Badge>;
}

const FLAG_CODES = new Set(MARKETS.map((m) => m.code));

/**
 * A country's flag from the owner's SVG set (`public/flags`, the same files the language picker uses) — never an emoji:
 * regional-indicator emoji render as two boxed letters on Windows and in headless Chromium. A country outside the 33
 * market flags gets its ISO code in the same slot, so a column of countries still aligns. Decorative: the name follows.
 */
export function CountryFlag({ code }: { code: string | null | undefined }) {
  if (!code) return null;
  const c = code.toUpperCase();
  if (FLAG_CODES.has(c)) return <Flag code={c} className="uc-flagslot" />;
  return <span className="uc-flagslot uc-flagslot--code" aria-hidden>{c}</span>;
}

export function Country({ code, className }: { code: string | null | undefined; className?: string }) {
  const { locale } = useLocale('common');
  if (!code) return <span className="hg-subtle">—</span>;
  const name = countryName(code, locale);
  return <span className={className ? `uc-country ${className}` : 'uc-country'} title={name}><CountryFlag code={code} /><span className="uc-country__name">{name}</span></span>;
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
