/**
 * V27 university-detail sections (REPORT §355, brief §2–§4): scholarships, international students, housing.
 *
 * Every line rendered here is a verified fact from the institution's own official pages, carried with its source and
 * the date Hangyul read it. Missing data renders as "not verified yet" with the official link — never as "none".
 * Eligibility is never claimed when a condition cannot be checked; the summary comes from the server (the same rule
 * as the quick fit).
 */
import { useLocale } from '@hangyul/i18n';
import { ArrowUpRight, ChevronDown } from '@hangyul/icons';
import type { InstAdmissions, InstScholarship, InstScholarshipPick, StudyLevel, UniversityContent } from '@hangyul/types';
import { cx, formatDate, formatNumber, scholarshipName } from '@hangyul/utils';
import { useState, type ReactNode } from 'react';

import {  } from './primitives';
import { FilterSelect } from './select';
import './styles/university-v27.css';

const CATS = ['GKS', 'UNIVERSITY', 'LANGUAGE', 'ACADEMIC', 'DEPARTMENT', 'FOUNDATION', 'HOUSING'];
const LEVEL_ORDER: StudyLevel[] = ['LANGUAGE', 'ASSOCIATE', 'BACHELOR', 'TRANSFER', 'MASTER', 'DOCTORATE', 'COMBINED'];

function Sec({ id, eyebrow, title, children, className }: { id: string; eyebrow: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('hg-uni-sec', className)} aria-labelledby={id}>
      <div className="hg-uni-split">
        <div className="hg-uni-split__aside">
          <p className="hg-uni-sec__eyebrow">{eyebrow}</p>
          <h2 className="hg-uni-sec__h" id={id}>{title}</h2>
        </div>
        <div className="hg-uni-split__body">{children}</div>
      </div>
    </section>
  );
}

function useName() {
  const { locale } = useLocale('common');
  return (s: { name: string; name_en: string | null; name_display_ko?: string | null; name_official_en?: string | null }) => scholarshipName(s, locale);
}

function benefit(s: InstScholarshipPick | InstScholarship, t: (k: string, o?: Record<string, unknown>) => string, locale: string): string {
  const max = 'waiver_max' in s ? s.waiver_max : null;
  const min = 'waiver_min' in s ? (s as InstScholarship).waiver_min : null;
  if (max != null) return min != null && min !== max ? t('uni27.schol.waiverRange', { min, max }) : t('uni27.schol.waiver', { pct: max });
  if (s.amount_krw) return t('uni27.schol.amount', { amount: formatNumber(s.amount_krw, locale) });
  return t('uni27.schol.benefitOnPage');
}

/** Scholarships: the summary first, the full list behind one disclosure (brief §2). */
export function UniversityScholarships({ data, level, levelLabel, checkHref, fallbackHref }: {
  data: InstAdmissions | undefined; level: StudyLevel | null; levelLabel?: string; checkHref: string; fallbackHref?: string | null;
}) {
  const { t, locale } = useLocale('common');
  const nameOf = useName();
  const [open, setOpen] = useState(false);
  if (!data) return null;
  const all = data.scholarships;
  if (!all.length) {
    return (
      <Sec id="hg-uni-schol-h" eyebrow={t('uni27.schol.eyebrow')} title={t('uni27.schol.title')}>
        <p>{t('uni27.schol.notVerified')}</p>
        {fallbackHref && <p><a className="hg-uni27-link" href={fallbackHref} target="_blank" rel="noopener noreferrer">{t('uni27.schol.officialPage')} <ArrowUpRight aria-hidden size={14} /></a></p>}
      </Sec>
    );
  }
  const forLevel = level ? all.filter((s) => !s.degree_levels.length || s.degree_levels.includes(level)) : all;
  const pool = forLevel.length ? forLevel : all;
  const strongest = [...pool].filter((s) => s.stage !== 'ENROLLED').sort((a, b) => (b.waiver_max ?? 0) - (a.waiver_max ?? 0) || (b.amount_krw ?? 0) - (a.amount_krw ?? 0))[0] ?? pool[0];
  const sum = data.summary;
  const stageRank = (s: InstScholarship) => ({ NEW: 0, BOTH: 1, ENROLLED: 2 } as Record<string, number>)[s.stage ?? ''] ?? 1;
  const groups = CATS.map((c) => ({ c, rows: all.filter((s) => (s.category ?? 'UNIVERSITY') === c)
    .sort((a, b) => stageRank(a) - stageRank(b) || (b.waiver_max ?? 0) - (a.waiver_max ?? 0)) })).filter((g) => g.rows.length);
  const latest = all.map((s) => s.verified_at).filter(Boolean).sort().at(-1);

  return (
    <Sec id="hg-uni-schol-h" eyebrow={t('uni27.schol.eyebrow')} title={t('uni27.schol.title')}>
      <dl className="hg-uni27-sum">
        <div>
          <dt>{level && levelLabel ? t('uni27.schol.strongestFor', { level: levelLabel }) : t('uni27.schol.strongest')}</dt>
          <dd><strong>{nameOf(strongest)}</strong><span>{benefit(strongest, t, locale)}</span></dd>
        </div>
        {sum?.best && (
          <div className="is-you">
            <dt>{t('uni27.schol.youMay')}</dt>
            <dd><strong>{nameOf(sum.best)}</strong><span>{benefit(sum.best, t, locale)}</span></dd>
          </div>
        )}
        {sum?.unlock && (
          <div>
            <dt>{t('uni27.schol.unlockWith', { test: t(`fit.test.${sum.unlock.needs.test}`, { defaultValue: sum.unlock.needs.test }), min: sum.unlock.needs.min })}</dt>
            <dd><strong>{nameOf(sum.unlock)}</strong><span>{benefit(sum.unlock, t, locale)}</span></dd>
          </div>
        )}
      </dl>
      {!sum && <p className="hg-uni27-note"><a href={checkHref}>{t('uni27.schol.checkMine')}</a></p>}
      <p className="hg-uni27-note">{t('uni27.schol.count', { count: all.length })}{latest ? ` ${t('uni27.checkedOn', { date: formatDate(latest, locale, { year: 'numeric', month: 'short', day: 'numeric' }) })}` : ''}</p>

      <button type="button" className="hg-uni27-more" aria-expanded={open} aria-controls="hg-uni27-schol-all" onClick={() => setOpen(!open)}>
        {t('uni27.schol.all')} <ChevronDown aria-hidden size={16} className={open ? 'is-open' : undefined} />
      </button>
      {open && (
        <div id="hg-uni27-schol-all" className="hg-uni27-all">
          {groups.map(({ c, rows }) => (
            <div key={c} className="hg-uni27-cat">
              <h3>{t(`uni27.cat.${c}`)}</h3>
              <ul>
                {rows.map((s) => <ScholarshipRow key={s.id} s={s} />)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Sec>
  );
}

function ScholarshipRow({ s }: { s: InstScholarship }) {
  const { t, locale } = useLocale('common');
  const nameOf = useName();
  const who = [
    s.stage ? t(`uni27.stage.${s.stage}`) : null,
    s.degree_levels.length ? s.degree_levels.map((l) => t(`fit.level.${l}`)).join(', ') : null,
  ].filter(Boolean).join(' · ');
  const cond: string[] = [];
  if (s.topik_min) cond.push(t('uni27.cond.topik', { level: s.topik_min }));
  if (s.english_min) cond.push(Object.entries(s.english_min).map(([k, v]) => `${t(`fit.test.${k}`, { defaultValue: k })} ${v}`).join(t('fit.or')));
  else if (s.english_text) cond.push(s.english_text);
  if (s.gpa_requirement) cond.push(s.gpa_requirement);
  if (s.department_restriction) cond.push(s.department_restriction);
  if (s.nationality_restriction) cond.push(s.nationality_restriction);
  return (
    <li className="hg-uni27-sch">
      <p className="hg-uni27-sch__name">{nameOf(s)}</p>
      <p className="hg-uni27-sch__benefit">{benefit(s, t, locale)}{s.dormitory_support ? ` · ${t('uni27.schol.dorm')}` : ''}{s.living_allowance ? ` · ${t('uni27.schol.living')}` : ''}</p>
      {who && <p className="hg-uni27-sch__meta">{who}</p>}
      {cond.length > 0 && <p className="hg-uni27-sch__meta">{t('uni27.schol.conditions')} {cond.join(' · ')}</p>}
      <p className="hg-uni27-sch__meta">{s.automatic ? t('uni27.schol.automatic') : t('uni27.schol.apply')}{s.duration ? ` · ${s.duration}` : ''}</p>
      {s.renewal && <p className="hg-uni27-sch__meta">{t('uni27.schol.renewal')} {s.renewal}</p>}
      {s.source_url && (
        <p className="hg-uni27-sch__src"><a href={s.source_url} target="_blank" rel="noopener noreferrer">{s.source_name || t('uni27.source')} <ArrowUpRight aria-hidden size={12} /></a>
          {s.verified_at ? ` · ${t('uni27.checkedOn', { date: formatDate(s.verified_at, locale, { year: 'numeric', month: 'short', day: 'numeric' }) })}` : ''}</p>
      )}
    </li>
  );
}

/** International students: language rules for one level (Korean / English track), Korean programme, English-taught
 *  degrees, support, GKS. Only what the official pages say. */
export function UniversityInternational({ content, data, level }: { content: UniversityContent | null; data: InstAdmissions | undefined; level: StudyLevel | null }) {
  const { t } = useLocale('common');
  const levels = LEVEL_ORDER.filter((l) => data?.language_rules[l]?.length);
  const [chosen, setChosen] = useState<StudyLevel | null>(null);
  const lv = chosen ?? (level && levels.includes(level) ? level : levels.includes('BACHELOR') ? 'BACHELOR' : levels[0] ?? null);
  const rules = (lv && data?.language_rules[lv]) || [];
  const intl = content?.intl;
  const gks = content?.gks?.programmes ?? [];
  const services = intl?.support_services ?? [];
  if (!rules.length && !intl && !gks.length) return null;
  const tracks = ['KOREAN', 'ENGLISH', 'ANY'].filter((tr) => rules.some((r) => r.track === tr));
  return (
    <Sec id="hg-uni-intl27-h" eyebrow={t('uni27.intl.eyebrow')} title={t('uni27.intl.title')}>
      {levels.length > 0 && (
        <div className="hg-uni27-rules">
          <div className="hg-uni27-rules__head">
            <h3>{t('uni27.intl.language')}</h3>
            {levels.length > 1 && (
              <FilterSelect size="sm" label={t('uni27.intl.levelPick')} active={false} value={lv ?? ''} onChange={(e) => setChosen(e.target.value as StudyLevel)}>
                {levels.map((l) => <option key={l} value={l}>{t(`fit.level.${l}`)}</option>)}
              </FilterSelect>
            )}
          </div>
          {tracks.map((tr) => {
            const mine = rules.filter((r) => r.track === tr);
            const apply = mine.filter((r) => r.stage === 'APPLICATION' && r.test !== 'OTHER');
            const later = mine.filter((r) => r.stage !== 'APPLICATION' && r.test !== 'OTHER');
            const none = mine.some((r) => r.test === 'NONE_REQUIRED');
            return (
              <div key={tr} className="hg-uni27-track">
                <p className="hg-uni27-track__h">{tr === 'ANY' ? t('uni27.intl.allTracks') : t(`fit.track.${tr}`)}</p>
                {none ? <p>{t('fit.reason.noneRequired')}</p> : apply.length > 0 && (
                  <p>{apply.filter((r) => r.test !== 'NONE_REQUIRED').map((r) => `${t(`fit.test.${r.test}`, { defaultValue: r.test })}${r.min ? ` ${r.min}` : ''}`).join(t('fit.or'))}</p>
                )}
                {later.length > 0 && <p className="hg-uni27-note">{t('uni27.intl.later', { tests: later.map((r) => `${t(`fit.test.${r.test}`, { defaultValue: r.test })}${r.min ? ` ${r.min}` : ''}`).join(t('fit.or')) })}</p>}
                {mine.some((r) => r.test === 'OTHER') && <p className="hg-uni27-note">{t('uni27.intl.otherRoutes')}</p>}
              </div>
            );
          })}
        </div>
      )}
      {intl?.korean_language_program?.value && <p>{t('uni27.intl.kli', { name: intl.korean_language_program.name ?? '' , context: intl.korean_language_program.name ? 'named' : undefined })}</p>}
      {intl?.english_taught_degrees?.value === true && (
        <p>{t('uni27.intl.english', { levels: (intl.english_taught_degrees.levels ?? []).map((l) => t(`fit.level.${l}`)).join(', '), context: intl.english_taught_degrees.levels?.length ? 'levels' : undefined })}</p>
      )}
      {services.length > 0 && (
        <ul className="hg-uni27-services">
          {services.map((s) => <li key={s.key}>{t(`uni27.service.${s.key}`, { defaultValue: s.key })}</li>)}
        </ul>
      )}
      {gks.length > 0 && <p>{t('uni27.intl.gks', { programmes: gks.map((g) => g.programme.replace(/\s*—.*$/, '')).filter((v, i, a) => a.indexOf(v) === i).join(', ') })}</p>}
    </Sec>
  );
}

/** Housing: availability and the verified per-semester cost — the number a family asks about first. */
export function UniversityHousing({ content }: { content: UniversityContent | null }) {
  const { t, locale } = useLocale('common');
  const d = content?.intl?.dormitory;
  if (!d || d.available == null) return null;
  const min = d.cost_semester_krw_min ?? null;
  const max = d.cost_semester_krw_max ?? null;
  return (
    <Sec id="hg-uni-house-h" eyebrow={t('uni27.house.eyebrow')} title={t('uni27.house.title')}>
      <p>{d.available ? t('uni27.house.available') : t('uni27.house.notAvailable')}</p>
      {(min || max) && (
        <p className="hg-uni27-cost">
          <strong>{min && max && min !== max ? t('uni27.house.costRange', { min: formatNumber(min, locale), max: formatNumber(max, locale) })
            : t('uni27.house.cost', { amount: formatNumber((min ?? max)!, locale) })}</strong>
          <span>{t('uni27.house.perSemester')}</span>
        </p>
      )}
      {d.capacity ? <p>{t('uni27.house.capacity', { count: d.capacity, formatted: formatNumber(d.capacity, locale) })}</p> : null}
      {d.international_priority ? <p>{t('uni27.house.priority')}</p> : null}
      {/* V28: `note` is the researcher's English working note (why a figure was not recorded) — evidence, never page copy. */}
    </Sec>
  );
}
