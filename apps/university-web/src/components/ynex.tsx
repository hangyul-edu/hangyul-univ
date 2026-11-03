// University-side YNEX helpers (V7). Same anatomy as the agency console (apps/agency-web/src/components/ynex.tsx):
// Hangyul status tone → YNEX soft tone, initials avatar (util/_avatars.scss), soft status badge with the university's
// wording (docs/STATE_MAP.md "University sees"), card-header "view all" link, and the rate text used on every card.
import { ArrowRight } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { ApplicationStatus, RateKpi } from '@hangyul/types';
import { applicationTone, cx, formatNumber, formatPercent, type Tone } from '@hangyul/utils';
import type { YxTone } from '@hangyul/ynex-ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export function yxTone(tone: Tone | string | undefined): YxTone {
  switch (tone) {
    case 'success': return 'success';
    case 'warning': return 'warning';
    case 'danger': return 'danger';
    case 'info': return 'primary';
    case 'brand': return 'purple';
    case 'teal': return 'teal';
    default: return 'light';
  }
}

const AV_TONES: YxTone[] = ['primary', 'secondary', 'success', 'warning', 'info', 'purple', 'teal', 'orange'];
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase();
}

/** Initials avatar in YNEX anatomy. Decorative: the name is always printed next to it. */
export function YAvatar({ name, size = 'sm', className, square }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string; square?: boolean }) {
  const hash = [...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const tone = AV_TONES[hash % AV_TONES.length];
  return (
    <span className={cx('avatar', `avatar-${size}`, !square && 'avatar-rounded', `bg-${tone}-transparent`, 'uv7-av', className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

/** The university's wording for a status (short form for lists, full form for headers). */
export function useStatusLabel() {
  const { t } = useLocale(['university', 'common']);
  return (s: ApplicationStatus | string, short = false) => {
    const full = t(`university:v4.status.${s}`, { defaultValue: t(`common:appStatus.${s}`, { defaultValue: s }) });
    return short ? t(`university:v4.statusShort.${s}`, { defaultValue: full }) : full;
  };
}

/** Application status as a YNEX soft badge — text + colour, never colour alone. */
export function StatusSoft({ status, short, className }: { status: ApplicationStatus | string; short?: boolean; className?: string }) {
  const label = useStatusLabel();
  // V24 (REPORT §296): colour only where it means something — an outcome (green / red) or a status that is
  // waiting on someone (amber). Moving-along states (submitted, in review, visa in progress) are neutral; tinted
  // tangerine and purple they made one column of the table look like a legend.
  const base = applicationTone[status as ApplicationStatus];
  const tone = yxTone(base === 'info' || base === 'brand' || base === 'teal' ? 'neutral' : base);
  return <span className={cx('badge', tone === 'light' ? 'bg-light text-default' : `bg-${tone}-transparent`, 'uv7-status', className)}>{label(status, short)}</span>;
}

/** Card-header link ("Analytics →"). */
export function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="fs-12 text-muted uv7-cardlink">{children}<ArrowRight aria-hidden className="hg-flip-rtl" /></Link>;
}

/** "82% · 9 of 11" — or "Too few to rate · 3 of 3" below the minimum sample. The count is always printed. */
export function RateText({ r, min = 5, strong }: { r: Pick<RateKpi, 'value' | 'numerator' | 'denominator'> | null | undefined; min?: number; strong?: boolean }) {
  const { t, locale } = useLocale(['university', 'common']);
  if (!r || !r.denominator) return <span className="text-muted">—</span>;
  const withheld = r.value === null || r.value === undefined || r.denominator < min;
  return (
    <span className="uv7-rate">
      {withheld ? <span className="text-muted">{t('university:af.lowN')}</span> : <span className={strong ? 'fw-semibold' : undefined}>{formatPercent(r.value as number, locale, 0)}</span>}
      <span className="uv7-rate__n">{t('university:metric.ofN', { num: formatNumber(r.numerator ?? 0, locale), den: formatNumber(r.denominator, locale) })}</span>
    </span>
  );
}
