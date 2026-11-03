import { AlertCircle, Check, CheckCircle2, Handshake, Info, TriangleAlert } from '@hangyul/icons';
import type { JourneyStage, MatchReason, MatchTier } from '@hangyul/types';
import { Badge, StatusText } from '@hangyul/ui';
import { cx, daysUntil, formatDate, formatMoney, tierTone, type Tone } from '@hangyul/utils';
import type { ReactNode } from 'react';

import { deadlineTone } from '../lib/format';
import { reasonText, useT } from '../lib/i18n';

/** "23 days left" as quiet text; only urgent deadlines (≤ 7 days or overdue) take colour. */
export function DaysLeft({ date }: { date: string | null | undefined; size?: 'sm' }) {
  const { t } = useT();
  const d = daysUntil(date);
  if (d === null) return null;
  const label = d < 0 ? t('common:time.overdueBy', { count: Math.abs(d) }) : d === 0 ? t('common:time.today') : d === 1 ? t('common:time.tomorrow') : t('common:time.daysLeft', { count: d });
  const tone = deadlineTone(d);
  return <span className={cx('st-days hg-num', tone === 'danger' && 'st-days--urgent', tone === 'warning' && 'st-days--soon')}>{label}</span>;
}

export function TierBadge({ tier, size }: { tier: MatchTier; size?: 'sm' }) {
  const { t } = useT();
  return <Badge tone={tierTone[tier]} dot size={size}>{t(`common:tier.${tier}`)}</Badge>;
}

/** Student-facing verdict tones: Strong (meets everything, fits preferences) · Possible (meets requirements, needs attention) · Not eligible yet. */
const VERDICT_TONE: Record<MatchTier, Tone> = { STRONG: 'success', COMPETITIVE: 'info', REACH: 'warning', NOT_ELIGIBLE: 'neutral' };

/** Match verdict in plain words, with a status dot. Used in lists. */
export function TierLabel({ tier }: { tier: MatchTier }) {
  const { t } = useT();
  return <StatusText tone={VERDICT_TONE[tier]}>{t(`verdict.${tier}`)}</StatusText>;
}

export function PartnerBadge({ size = 'sm' }: { size?: 'sm' }) {
  const { t } = useT();
  return (
    <Badge tone="brand" size={size} icon={<Handshake />}>
      {t('explore.partner')}
    </Badge>
  );
}

export function Krw({ value, compact, perYear }: { value: number | null | undefined; compact?: boolean; perYear?: boolean }) {
  const { t, locale } = useT();
  if (value === null || value === undefined) return <span className="hg-subtle">{t('common:states.insufficientData')}</span>;
  return <span className="hg-num">{formatMoney(value, 'KRW', locale, { compact })}{perYear ? t('units.perYear') : ''}</span>;
}

export function ReasonIcon({ kind }: { kind: MatchReason['kind'] }) {
  if (kind === 'met') return <CheckCircle2 className="st-reason__icon st-reason__icon--met" aria-hidden />;
  if (kind === 'missing') return <AlertCircle className="st-reason__icon st-reason__icon--missing" aria-hidden />;
  if (kind === 'warning') return <TriangleAlert className="st-reason__icon st-reason__icon--warning" aria-hidden />;
  return <Info className="st-reason__icon st-reason__icon--info" aria-hidden />;
}

/** Match reasons with ✓ met / ! missing / info icons. Text is translated by code with the API text as fallback. */
export function ReasonList({ reasons, limit }: { reasons: MatchReason[]; limit?: number }) {
  const { t } = useT();
  const list = limit ? reasons.slice(0, limit) : reasons;
  return (
    <ul className="st-reasons">
      {list.map((r, i) => (
        <li key={`${r.code}-${i}`} className="st-reason" data-kind={r.kind}>
          <ReasonIcon kind={r.kind} />
          <span className="hg-sr-only">{t(`matches.reasonKind.${r.kind}`)}: </span>
          <span>{reasonText(t, r)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Put what's missing first so the student sees what to fix, then what's already fine. */
export function sortReasons(reasons: MatchReason[]): MatchReason[] {
  const rank: Record<MatchReason['kind'], number> = { missing: 0, warning: 1, met: 2, info: 3 };
  return [...reasons].sort((a, b) => rank[a.kind] - rank[b.kind]);
}

export function JourneySteps({ stages, current }: { stages: JourneyStage[]; current: JourneyStage }) {
  const { t } = useT();
  const idx = stages.indexOf(current);
  return (
    <ol className="hg-steps" aria-label={t('dashboard.journey.title')}>
      {stages.map((s, i) => (
        <li key={s} className={cx('hg-step', i < idx && 'hg-step--done', i === idx && 'hg-step--current')} aria-current={i === idx ? 'step' : undefined}>
          <span className="hg-step__bar" />
          <span>{t(`journey.${s}`)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Vertical status timeline. */
export function Timeline({ items }: { items: { key: string; title: ReactNode; meta?: ReactNode; state: 'done' | 'active' | 'todo' }[] }) {
  return (
    <ol className="hg-timeline">
      {items.map((it) => (
        <li key={it.key} className={cx('hg-timeline__item', it.state === 'done' && 'hg-timeline__item--done', it.state === 'active' && 'hg-timeline__item--active')}>
          <span className="hg-timeline__dot" aria-hidden />
          <div className={cx('hg-strong hg-small', it.state === 'todo' && 'hg-subtle')}>{it.title}</div>
          {it.meta && <div className="hg-subtle hg-xs">{it.meta}</div>}
        </li>
      ))}
    </ol>
  );
}

/** Tappable checklist row with a real checkbox semantics. */
export function CheckRow({ done, blocked, onToggle, title, detail, extra, disabled }: {
  done: boolean; blocked?: boolean; onToggle?: () => void; title: ReactNode; detail?: ReactNode; extra?: ReactNode; disabled?: boolean;
}) {
  const body = (
    <>
      <span className="hg-check-item__box" aria-hidden>{done && <Check />}</span>
      <span className="hg-grow">
        <span className={cx('hg-strong', done && 'st-done-text')} style={{ display: 'block' }}>{title}</span>
        {detail && <span className="hg-muted hg-small" style={{ display: 'block', marginTop: 2 }}>{detail}</span>}
        {extra && <span style={{ display: 'block', marginTop: 6 }}>{extra}</span>}
      </span>
    </>
  );
  if (!onToggle) return <div className="hg-check-item" data-done={done} data-blocked={blocked}>{body}</div>;
  return (
    <button type="button" className="hg-check-item" role="checkbox" aria-checked={done} data-done={done} data-blocked={blocked} onClick={onToggle} disabled={disabled || blocked}>
      {body}
    </button>
  );
}

export function DateText({ value, withTime }: { value: string | null | undefined; withTime?: boolean }) {
  const { locale } = useT();
  return <span className="hg-num">{formatDate(value, locale, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })}</span>;
}

export function PageIntro({ eyebrow, title, subtitle, actions }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="st-intro">
      <div className="hg-grow">
        {eyebrow && <div className="hg-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
        <h1 className="st-intro__title">{title}</h1>
        {subtitle && <p className="st-intro__sub">{subtitle}</p>}
      </div>
      {actions && <div className="st-intro__actions">{actions}</div>}
    </header>
  );
}
