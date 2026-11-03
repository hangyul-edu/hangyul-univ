import { localName } from '@hangyul/i18n';
import { Building2, CalendarClock, Columns3, Heart, Languages, MapPin } from '@hangyul/icons';
import type { Program } from '@hangyul/types';
import { Badge, Button, Card, FreshnessBadge, useToast } from '@hangyul/ui';
import { cx, formatDate } from '@hangyul/utils';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { COMPARE_MAX, useCompare } from '../lib/compare';
import { useT } from '../lib/i18n';
import { useSaved, useToggleSave } from '../lib/queries';
import { DaysLeft, Krw, PartnerBadge } from './bits';

export function SaveButton({ universityId, programId, name, size = 'sm' }: { universityId: string; programId?: string; name: string; size?: 'sm' | 'md' }) {
  const { t } = useT();
  const saved = useSaved();
  const toggle = useToggleSave();
  const toast = useToast();
  const isSaved = (saved.data ?? []).some((u) => u.id === universityId);
  return (
    <Button
      variant="ghost"
      size={size}
      iconOnly
      className={cx('st-heart', isSaved && 'st-heart--on')}
      aria-pressed={isSaved}
      aria-label={isSaved ? t('explore.unsave', { name }) : t('explore.save', { name })}
      icon={<Heart />}
      loading={toggle.isPending}
      onClick={() => toggle.mutate({ universityId, programId, saved: isSaved }, {
        onSuccess: (now) => toast.success(now ? t('explore.savedToast', { name }) : t('explore.unsavedToast', { name })),
        onError: (e) => toast.error((e as Error).message),
      })}
    />
  );
}

export function CompareToggle({ programId, label, university }: { programId: string; label: string; university: string }) {
  const { t } = useT();
  const cmp = useCompare();
  const toast = useToast();
  const on = cmp.has(programId);
  return (
    <Button
      variant={on ? 'soft' : 'ghost'}
      size="sm"
      icon={<Columns3 />}
      aria-pressed={on}
      onClick={() => { if (!cmp.toggle({ id: programId, label, university })) toast.info(t('compare.full', { max: COMPARE_MAX })); }}
    >
      {on ? t('compare.added') : t('compare.add')}
    </Button>
  );
}

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <span className="st-fact">{icon}<span>{children}</span></span>;
}

export function ProgramCard({ p, footer }: { p: Program; footer?: ReactNode }) {
  const { t, locale } = useT();
  const u = p.university;
  const req = p.requirements;
  const next = p.next_intake;
  const langReq = [
    req?.min_topik_level ? t('explore.card.topik', { level: req.min_topik_level }) : null,
    req?.min_ielts ? t('explore.card.ielts', { score: req.min_ielts }) : null,
    req?.min_toefl_ibt ? t('explore.card.toefl', { score: req.min_toefl_ibt }) : null,
  ].filter(Boolean);
  return (
    <Card className="st-pcard" as="article">
      <div className="st-pcard__top">
        <span className="st-uni-mark" style={{ background: u?.brand_color ?? 'var(--hg-palette-ink-900)' }} aria-hidden>{(u?.name_en ?? '?').slice(0, 1)}</span>
        <div className="hg-grow" style={{ minWidth: 0 }}>
          <Link to={`/universities/${u?.slug}?tab=programs&program=${p.id}`} className="st-pcard__uni">{localName(u)}</Link>
          <div className="hg-subtle hg-xs hg-truncate">{u?.name_ko}</div>
        </div>
        {u && <SaveButton universityId={u.id} programId={p.id} name={localName(u)} />}
      </div>
      <h3 className="st-pcard__program">{localName(p)}</h3>
      <div className="hg-row-wrap" style={{ '--hg-gap': '6px' } as React.CSSProperties}>
        <Badge size="sm" tone="neutral">{t(`common:degree.${p.degree_level}`)}</Badge>
        {u?.is_partner && <PartnerBadge />}
      </div>
      <div className="st-pcard__facts">
        <Fact icon={<MapPin aria-hidden />}>{u ? `${u.city} · ${t(`common:region.${u.region}`, { defaultValue: u.region })}` : '—'}</Fact>
        <Fact icon={<Building2 aria-hidden />}>{u ? t(`common:institution.${u.institution_type}`) : '—'}</Fact>
        <Fact icon={<Languages aria-hidden />}>{t(`common:instruction.${p.instruction_language}`)}{langReq.length ? ` · ${langReq.join(' / ')}` : ''}</Fact>
      </div>
      <dl className="st-pcard__money">
        <div><dt>{t('explore.card.tuition')}</dt><dd><Krw value={p.tuition_per_semester_krw} compact /></dd></div>
        <div><dt>{t('explore.card.annual')}</dt><dd><Krw value={p.estimated_annual_cost_krw} compact /></dd></div>
      </dl>
      <div className="st-pcard__deadline">
        <CalendarClock aria-hidden />
        {next ? (
          <>
            <span className="hg-small">{t('explore.card.deadline', { date: formatDate(next.application_deadline, locale) })}</span>
            <DaysLeft date={next.application_deadline} size="sm" />
          </>
        ) : <span className="hg-small hg-subtle">{t('explore.card.noIntake')}</span>}
      </div>
      <div className="st-pcard__foot">
        <FreshnessBadge data={p} compact />
        <div className="hg-grow" />
        {footer ?? (u && <CompareToggle programId={p.id} label={localName(p)} university={localName(u)} />)}
      </div>
    </Card>
  );
}
