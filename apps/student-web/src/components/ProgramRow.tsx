import { localName } from '@hangyul/i18n';
import { Award, ChevronDown, ShieldCheck } from '@hangyul/icons';
import type { Match, MatchReason, Program } from '@hangyul/types';
import { Button, ButtonLink, UniMark } from '@hangyul/ui';
import { cx, formatDate } from '@hangyul/utils';
import { useState } from 'react';
import { Link } from 'react-router';

import { FirstYearAmount } from '../lib/cost';
import { reasonText, useT, type TFn } from '../lib/i18n';
import { lc } from '../lib/workspace';
import { DaysLeft, ReasonList, TierLabel, sortReasons } from './bits';
import { CompareToggle, SaveButton } from './ProgramCard';
import { useStartApplication } from './StartApplication';

/** The exact gap for a program the student cannot apply to yet, and what would unlock it. */
export function gapOf(t: TFn, reasons: MatchReason[]): { gap: string; unlock: string | null; more: number } | null {
  const missing = reasons.filter((r) => r.kind === 'missing');
  if (!missing.length) return null;
  const r = missing[0];
  const p = (r.params ?? {}) as Record<string, string | number | null | undefined>;
  let gap = reasonText(t, r);
  let unlock: string | null = null;
  if (r.code === 'LANGUAGE_GAP_SMALL' || r.code === 'LANGUAGE_BELOW') {
    if (p.min_topik) unlock = t('v4.unlock.topik', { level: p.min_topik });
    else if (p.min_ielts) unlock = t('v4.unlock.ielts', { score: p.min_ielts });
  } else if ((r.code === 'GPA_BELOW' || r.code === 'GPA_SLIGHTLY_BELOW') && p.min != null && p.have != null) {
    gap = t('v4.gap.gpa', { min: Math.round(Number(p.min)), have: Math.round(Number(p.have)) });
  } else if (r.code === 'DEGREE_MISMATCH' && p.program) {
    gap = t('v4.gap.degree', { program: t(`common:degree.${p.program}`), target: lc(t(`common:degree.${p.target}`)) });
    // A different degree level explains the rest (e.g. "requires a bachelor's"): don't count those as extra gaps.
    return { gap, unlock: t('v4.unlock.degree'), more: 0 };
  } else if (r.code === 'NO_OPEN_INTAKE') {
    unlock = t('v4.unlock.intake');
  }
  return { gap, unlock, more: missing.length - 1 };
}

function languageText(t: TFn, program: Program): string {
  const req = program.requirements;
  return [
    req?.min_topik_level ? t('explore.card.topik', { level: req.min_topik_level }) : null,
    req?.min_ielts ? t('explore.card.ielts', { score: req.min_ielts }) : null,
  ].filter(Boolean).join(' / ') || t('discover.noLanguageMin');
}

/**
 * One program in a discovery list. Hierarchy (V4): university → program → match state → first-year cost → language → deadline.
 * `grouped`: rendered under a university header (the university is not repeated). `hideVerdict`: the list is already one tier.
 */
export function ProgramRow({ program, match, grouped = false, hideVerdict = false, quietDegree = false }: {
  program: Program; match?: Match; grouped?: boolean; hideVerdict?: boolean;
  /** V26: the list explains another degree level once at the top; rows then say only "학사 · 편입" quietly. */
  quietDegree?: boolean;
}) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const start = useStartApplication();
  const u = program.university;
  const next = match?.intake ?? program.next_intake ?? null;
  const cost = match?.first_year_range_krw ?? program.first_year_range_krw;
  const reasons = match ? sortReasons(match.reasons) : [];
  const gap = match && !match.eligible ? gapOf(t, reasons) : match?.tier === 'REACH' ? gapOf(t, reasons) : null;
  const otherLevel = !!match && reasons.some((r) => r.kind === 'missing' && r.code === 'DEGREE_MISMATCH');
  const href = `/universities/${u?.slug}?program=${program.id}`;
  return (
    <article className={cx('v4-row', grouped && 'v4-row--grouped', open && 'v4-row--open')} data-other-degree={quietDegree && otherLevel ? '' : undefined}>
      <div className="v4-row__main">
        {!grouped && <UniMark name={u?.name_en ?? '?'} color={u?.brand_color} photo={u?.photo} />}
        <div className="v4-row__body">
          {!grouped && (
            <p className="v4-row__uni">
              <span className="v4-row__uniname">{localName(u)}</span>{u ? <span className="v4-row__city"> · {u.city}</span> : null}
            </p>
          )}
          <p className="v4-row__prog">
            <Link to={href} className="v4-row__title">{localName(program)}</Link>
            <span className="v4-row__deg"> · {t(`common:degreeShort.${program.degree_level}`)}</span>
            {match && !hideVerdict && <span className="v4-row__verdict"><TierLabel tier={match.tier} /></span>}
          </p>
          <p className="v4-row__facts">
            <span><FirstYearAmount value={cost} /> <span className="v4-row__unit">{t('v4.cost.firstYearShort')}</span></span>
            <span>{languageText(t, program)}</span>
            <span>
              {next ? <>{t('v4.row.applyBy', { date: formatDate(next.application_deadline, locale, { month: 'short', day: 'numeric' }) })} <DaysLeft date={next.application_deadline} /></>
                : <span className="hg-subtle">{t('explore.card.noIntake')}</span>}
            </span>
            {/* V9 S5: the scholarship is on the row, not behind "Why". */}
            {match && match.scholarship_ids.length > 0 && <span className="v9-row__schol"><Award aria-hidden /> {t('v9.discovery.scholarship', { count: match.scholarship_ids.length })}</span>}
          </p>
          {gap && !(quietDegree && otherLevel) && (
            <p className="v4-row__gap">
              <strong>{gap.gap}</strong>{gap.more > 0 ? ` ${t('v4.gap.more', { count: gap.more })}` : ''}
              {gap.unlock && <span className="v4-row__unlock"> {gap.unlock}</span>}
            </p>
          )}
        </div>
        <div className="v4-row__actions">
          {!grouped && u && <SaveButton universityId={u.id} programId={program.id} name={localName(u)} />}
          {match && (
            <Button variant="ghost" size="sm" iconOnly aria-expanded={open} aria-label={open ? t('matches.less') : t('discover.why')}
              icon={<ChevronDown className={open ? 'st-rot' : undefined} />} onClick={() => setOpen(!open)} />
          )}
        </div>
      </div>
      {open && match && (
        <div className="v4-row__more">
          <div>
            <h3 className="hg-small hg-strong" style={{ marginBottom: 8 }}>{t('discover.whyTitle')}</h3>
            <ReasonList reasons={reasons} />
            {match.guarantee && (
              <p className="sx-row__guarantee"><ShieldCheck aria-hidden /> {match.guarantee.terms ?? t('matches.guarantee.noTerms')}</p>
            )}
          </div>
          <div className="sx-row__more-actions">
            {u && <CompareToggle programId={program.id} label={localName(program)} university={localName(u)} />}
            <ButtonLink as={Link} to={href} size="sm">{t('discover.details')}</ButtonLink>
            {match.eligible && match.intake && (
              <Button variant="primary" size="sm" loading={start.isPending && start.variables?.programId === program.id}
                onClick={() => start.mutate({ programId: program.id, intakeId: match.intake_id })}>{t('matches.start')}</Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

/** Several programs of one university under one header: the university is what a student recognises first. */
export function UniversityGroup({ matches, hideVerdict }: { matches: Match[]; hideVerdict?: boolean }) {
  const { t } = useT();
  const u = matches[0].program.university;
  return (
    <section className="v4-group" aria-label={localName(u)}>
      <header className="v4-group__head">
        <UniMark name={u?.name_en ?? '?'} color={u?.brand_color} photo={u?.photo} />
        <div className="v4-group__id">
          <h3 className="v4-group__name"><Link to={`/universities/${u?.slug}`}>{localName(u)}</Link></h3>
          <p className="v4-group__meta">
            {u?.city}
            {u?.is_partner && <> · <span className="v4-group__partner">{t('explore.partner')}</span></>}
            {matches.length > 1 && <> · {t('v4.row.programs', { count: matches.length })}</>}
          </p>
        </div>
        {u && <SaveButton universityId={u.id} programId={matches[0].program_id} name={localName(u)} />}
      </header>
      {matches.map((m) => <ProgramRow key={m.program_id} program={m.program} match={m} grouped hideVerdict={hideVerdict} />)}
    </section>
  );
}

/**
 * V26 (REPORT §334 S2): the full programme list, grouped under its university. Before V26 every programme was its own
 * row with its own campus photo, so one university appeared seven times in a row and the list read as a database. Runs of
 * adjacent programmes of one university share one header (the server's order — relevance, deadline, tuition, name — is
 * kept: a university that appears again further down starts a new group there).
 */
export function ProgramGroups({ items, byProgram, dim }: { items: Program[]; byProgram: Map<string, Match>; /** refetching: keep the old list visible, quieter */ dim?: boolean }) {
  const { t } = useT();
  const runs: Program[][] = [];
  items.forEach((p) => { const last = runs.at(-1); if (last && last[0].university_id === p.university_id) last.push(p); else runs.push([p]); });
  const otherLevel = items.filter((p) => byProgram.get(p.id)?.reasons.some((r) => r.kind === 'missing' && r.code === 'DEGREE_MISMATCH')).length;
  return (
    <>
      {otherLevel > 0 && <p className="sx-otherlevel hg-small hg-muted">{t('v26.explore.otherLevel', { count: otherLevel })} <Link to="/profile?edit=goals" className="hg-link">{t('v26.explore.changeGoal')}</Link></p>}
      <div className="v4-list v4-groups" style={{ opacity: dim ? 0.6 : 1 }}>
        {runs.map((g, i) => {
          const u = g[0].university;
          return (
            <section key={`${g[0].university_id}-${i}`} className="v4-group" aria-label={localName(u)}>
              <header className="v4-group__head">
                <UniMark name={u?.name_en ?? '?'} color={u?.brand_color} photo={u?.photo} />
                <div className="v4-group__id">
                  <h3 className="v4-group__name"><Link to={`/universities/${u?.slug}`}>{localName(u)}</Link></h3>
                  <p className="v4-group__meta">{u?.city}{g.length > 1 && <> · {t('v4.row.programs', { count: g.length })}</>}</p>
                </div>
                {u && <SaveButton universityId={u.id} programId={g[0].id} name={localName(u)} />}
              </header>
              {g.map((p) => <ProgramRow key={p.id} program={p} match={byProgram.get(p.id)} grouped quietDegree />)}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Groups matches by university, keeping the engine's order (a university sits where its best program ranks). */
export function groupByUniversity(items: Match[]): Match[][] {
  const groups = new Map<string, Match[]>();
  items.forEach((m) => {
    const k = m.program.university_id;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(m);
  });
  return [...groups.values()];
}
