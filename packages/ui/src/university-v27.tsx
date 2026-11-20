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
import type { InstAdmissions, InstRule, InstScholarship, InstScholarshipPick, InstitutionDetail, StudyLevel, UniversityContent } from '@hangyul/types';
import { cx, formatDate, formatNumber, scholarshipName } from '@hangyul/utils';
import { useState, type ReactNode } from 'react';

import { FilterSelect } from './select';
import './styles/university-v27.css';

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

/* ============================================================================================================
 * The decision page (launch pass): summary → admissions → scholarships → campus and student life.
 *
 * Three rules shared by everything below:
 *   - a fact renders only when the export carries it, with its source and the date Hangyul read it;
 *   - what Hangyul has not confirmed is said once per topic as "Not yet verified", with the official link —
 *     never as "none", and never as an empty row per missing field;
 *   - free-text research fields (guide names, scholarship conditions) are the researcher's record of the
 *     official wording and are marked `data-no-l10n`; nothing here writes a new claim about an institution.
 * ============================================================================================================ */

type T = (k: string, o?: Record<string, unknown>) => string;
const DATE: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

export interface UniversityLinkSet {
  admissions: string | null; office: string | null; scholarship: string | null;
  dormitory: string | null; kli: string | null; website: string | null;
}

/** The official destinations, verified research first and the site-read links as the fallback. */
export function universityLinks(content: UniversityContent | null | undefined, website?: string | null): UniversityLinkSet {
  const l = content?.intl?.links ?? {};
  return {
    admissions: l.international_admissions?.url ?? content?.international_admissions_url ?? null,
    office: l.international_office?.url ?? content?.international_office_url ?? null,
    scholarship: l.scholarship?.url ?? null,
    dormitory: l.dormitory?.url ?? content?.dormitory_url ?? null,
    kli: l.korean_language_institute?.url ?? null,
    website: website ?? l.official_website?.url ?? content?.website_url ?? null,
  };
}

/** The verified official admission guides (PDFs / notices a person read), newest research first as exported. */
export function universityGuides(content: UniversityContent | null | undefined) {
  return (content?.intl?.sources ?? []).filter((s) => s.kind === 'OFFICIAL_GUIDE' && s.url);
}
/** A guide's title without the researcher's "linked from …" trail. */
const guideTitle = (name?: string) => (name ?? '').split(/;|\s\(attached|\s[—–-]\slinked/)[0].trim();

/** GKS programme names as NIIED lists them, without the track detail, newest first, no repeats. */
function gksProgrammes(content: UniversityContent | null | undefined) {
  const seen = new Map<string, { label: string; url?: string; date?: string }>();
  for (const g of content?.gks?.programmes ?? []) {
    const label = g.programme.replace(/\s*—.*$/, '');
    if (!seen.has(label)) seen.set(label, { label, url: g.notice_url, date: g.notice_date?.slice(0, 10) });
  }
  return [...seen.values()];
}

const levelsWithRules = (data: InstAdmissions | undefined) => LEVEL_ORDER.filter((l) => data?.language_rules[l]?.length);
const testLabel = (t: T, r: InstRule) => `${t(`fit.test.${r.test}`, { defaultValue: r.test })}${r.min ? ` ${r.min}` : ''}`;

function Ext({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a className={cx('hg-unid-ext', className)} href={href} target="_blank" rel="noopener noreferrer">
      <span>{children}</span> <ArrowUpRight aria-hidden size={14} />
    </a>
  );
}

/**
 * "Not yet verified" — the designed state for a fact Hangyul has not confirmed.
 *
 * One quiet line per topic: what is unconfirmed, and where the reader can check it themselves. It is never an
 * error, never "none", and never a grey box.
 */
export function UniversityUnverified({ items, href, hrefLabel, className }: {
  items: string[]; href?: string | null; hrefLabel?: string; className?: string;
}) {
  const { t } = useLocale('common');
  if (!items.length) return null;
  return (
    <p className={cx('hg-unid-nyv', className)}>
      <span className="hg-unid-nyv__mark" aria-hidden />
      <span className="hg-unid-nyv__text">
        <strong>{t('uniDetail.nyv.label')}</strong>
        <span>{items.join(' · ')}</span>
      </span>
      {href && <Ext href={href} className="hg-unid-nyv__link">{hrefLabel ?? t('uniDetail.nyv.official')}</Ext>}
    </p>
  );
}

function Head({ id, eyebrow, title, lede }: { id: string; eyebrow: string; title: string; lede?: ReactNode }) {
  return (
    <header className="hg-unid-head">
      <p className="hg-uni-sec__eyebrow">{eyebrow}</p>
      <h2 className="hg-uni-sec__h" id={id}>{title}</h2>
      {lede && <p className="hg-uni-sec__lede">{lede}</p>}
    </header>
  );
}

/* --------------------------------------------------------------------------------------- decision summary */

interface SummaryFact { k: string; v: ReactNode }

/**
 * The decision summary: five questions a student asks before anything else, answered only from confirmed data.
 * Each row names what is still unverified in one line and links the official source for it.
 */
export function UniversitySummary({ inst, data, typeLabel, regionLabel, level, anchors, foot }: {
  /** Provenance line(s) under the summary, e.g. the registry's checked date. */
  foot?: ReactNode;
  inst: InstitutionDetail; data: InstAdmissions | undefined; typeLabel: string; regionLabel: string;
  level?: StudyLevel | null;
  /** In-page targets for the row titles, e.g. `{ admissions: '#admissions' }`. A row with no target is plain text. */
  anchors?: Partial<Record<'admissions' | 'scholarships' | 'life', string>>;
}) {
  const { t, locale } = useLocale('common');
  const content = inst.enrichment ?? null;
  const intl = content?.intl;
  const links = universityLinks(content, inst.website_url);
  const levels = levelsWithRules(data);
  const lv = level && levels.includes(level) ? level : levels.includes('BACHELOR') ? 'BACHELOR' : levels[0] ?? null;
  const rules = (lv && data?.language_rules[lv]) || [];
  const guides = universityGuides(content);
  const gks = gksProgrammes(content);
  const dorm = intl?.dormitory;
  const date = (d?: string | null) => (d ? formatDate(d, locale, DATE) : '');
  const nyv = (k: string) => t(`uniDetail.nyv.item.${k}`);

  /* Study options */
  const study: SummaryFact[] = [{ k: t('uniDetail.sum.institution'), v: typeLabel }];
  if (levels.length) study.push({ k: t('uniDetail.sum.levels'), v: levels.map((l) => t(`fit.level.${l}`)).join(' · ') });
  if (intl?.english_taught_degrees?.value === true) {
    const el = intl.english_taught_degrees.levels ?? [];
    study.push({ k: t('uniDetail.sum.english'), v: el.length ? el.map((l) => t(`fit.level.${l}`)).join(' · ') : t('uniDetail.sum.offered') });
  }
  if (intl?.korean_language_program?.value === true || inst.ieqas?.language_programme) {
    study.push({ k: t('uniDetail.sum.korean'), v: inst.ieqas?.language_programme ? t('uniDetail.sum.koreanCertified') : t('uniDetail.sum.offered') });
  }
  if (inst.major_count) {
    study.push({ k: t('uniDetail.sum.majors'), v: t('uniDetail.sum.majorsValue', { count: inst.major_count, year: inst.sources?.registry?.survey_year ?? '' }) });
  }

  /* Admissions */
  const adm: SummaryFact[] = [];
  if (rules.length && lv) {
    const lines = (['KOREAN', 'ENGLISH', 'ANY'] as const).flatMap((tr) => {
      const mine = rules.filter((r) => r.track === tr && r.stage === 'APPLICATION');
      if (!mine.length) return [];
      const named = mine.filter((r) => r.test !== 'OTHER' && r.test !== 'NONE_REQUIRED');
      const body = mine.some((r) => r.test === 'NONE_REQUIRED') ? t('uniDetail.sum.noScore')
        : named.length ? `${testLabel(t, named[0])}${mine.length > 1 ? ` ${t('uniDetail.sum.orOther')}` : ''}` : t('uniDetail.sum.ownTest');
      return [<span key={tr} className="hg-unid-line"><em>{tr === 'ANY' ? t('uni27.intl.allTracks') : t(`fit.track.${tr}`)}</em> {body}</span>];
    });
    if (lines.length) adm.push({ k: t('uniDetail.sum.language', { level: t(`fit.level.${lv}`) }), v: lines });
  }
  if (guides.length) adm.push({ k: t('uniDetail.sum.guide'), v: t('uniDetail.sum.guideRead', { date: date(intl?.researched_at) }) });
  else if (links.admissions) adm.push({ k: t('uniDetail.sum.admissionsPage'), v: <Ext href={links.admissions}>{t('uniDetail.officialPage')}</Ext> });
  const admMissing = [...(rules.length ? [] : [nyv('language')]), nyv('period'), nyv('documents')];

  /* Cost */
  const cost: SummaryFact[] = [];
  const dmin = dorm?.cost_semester_krw_min ?? null, dmax = dorm?.cost_semester_krw_max ?? null;
  if (dmin || dmax) {
    cost.push({ k: t('uniDetail.sum.dormCost'), v: `${dmin && dmax && dmin !== dmax
      ? t('uni27.house.costRange', { min: formatNumber(dmin, locale), max: formatNumber(dmax, locale) })
      : t('uni27.house.cost', { amount: formatNumber((dmin ?? dmax)!, locale) })} ${t('uniDetail.sum.perSemester')}` });
  }
  const costMissing = [nyv('tuition'), nyv('fee'), ...(dmin || dmax ? [] : [nyv('dormCost')])];

  /* Student life */
  const life: SummaryFact[] = [{ k: t('uniDetail.sum.location'), v: locale === 'ko' && content?.city_ko && content.city_ko !== regionLabel ? `${content.city_ko} · ${regionLabel}` : regionLabel }];
  if (dorm?.available === true) life.push({ k: t('uniDetail.sum.dormitory'), v: t('uniDetail.sum.dormOpen') });
  else if (dorm?.available === false) life.push({ k: t('uniDetail.sum.dormitory'), v: t('uniDetail.sum.dormNotConfirmed') });
  else if (links.dormitory) life.push({ k: t('uniDetail.sum.dormitory'), v: <Ext href={links.dormitory}>{t('uniDetail.officialPage')}</Ext> });
  if (links.office) life.push({ k: t('uniDetail.sum.office'), v: <Ext href={links.office}>{t('uniDetail.officialPage')}</Ext> });
  if (inst.other_campuses?.length) life.push({ k: t('uniDetail.sum.campuses'), v: <span lang="ko">{inst.other_campuses.map((c) => c.name_ko).join(' · ')}</span> });
  const lifeMissing = [...(dorm?.available != null || links.dormitory ? [] : [nyv('dormitory')]), ...(links.office ? [] : [nyv('office')])];

  /* Support */
  const support: SummaryFact[] = [];
  const n = data?.scholarships.length ?? 0;
  if (n) support.push({ k: t('uniDetail.sum.scholarships'), v: t('uniDetail.sum.scholarshipsValue', { count: n }) });
  if (gks.length) support.push({ k: t('uniDetail.sum.gks'), v: <span data-no-l10n>{gks.slice(0, 3).map((g) => g.label.replace(/^GKS\s*/, '')).join(' · ')}</span> }); // NIIED's own programme names
  if (inst.ieqas?.certified) support.push({ k: t('uniDetail.sum.ieqas'), v: t(inst.ieqas.excellent ? 'uniDetail.sum.ieqasExcellent' : 'uniDetail.sum.ieqasCertified') });
  const services = intl?.support_services ?? [];
  if (services.length) support.push({ k: t('uniDetail.sum.services'), v: services.map((s) => t(`uni27.service.${s.key}`, { defaultValue: s.key })).join(' · ') });
  const supportMissing = [...(n ? [] : [nyv('scholarships')]), ...(services.length ? [] : [nyv('services')])];

  const fallback = links.admissions ?? links.website;
  const rows: { key: string; title: string; href?: string; facts: SummaryFact[]; missing: string[]; link: string | null }[] = [
    { key: 'study', title: t('uniDetail.sum.study'), facts: study, missing: levels.length ? [] : [nyv('levels')], link: fallback },
    { key: 'admissions', title: t('uniDetail.sum.admissions'), href: anchors?.admissions, facts: adm, missing: admMissing, link: guides[0]?.url ?? fallback },
    { key: 'cost', title: t('uniDetail.sum.cost'), facts: cost, missing: costMissing, link: guides[0]?.url ?? fallback },
    { key: 'life', title: t('uniDetail.sum.life'), href: anchors?.life, facts: life, missing: lifeMissing, link: links.office ?? links.website },
    { key: 'support', title: t('uniDetail.sum.support'), href: anchors?.scholarships, facts: support, missing: supportMissing, link: links.scholarship ?? fallback },
  ];

  return (
    <section className="hg-uni-sec hg-unid-sum" aria-labelledby="hg-unid-sum-h">
      <Head id="hg-unid-sum-h" eyebrow={t('uniDetail.sum.eyebrow')} title={t('uniDetail.sum.title')} />
      <div className="hg-unid-sum__rows">
        {rows.map((r) => (
          <section key={r.key} className="hg-unid-sum__row" aria-labelledby={`hg-unid-sum-${r.key}`}>
            <h3 id={`hg-unid-sum-${r.key}`} className="hg-unid-sum__k">
              {r.href ? <a href={r.href}>{r.title}</a> : r.title}
            </h3>
            <div className="hg-unid-sum__v">
              {r.facts.length > 0 && (
                <dl className="hg-unid-facts">
                  {r.facts.map((f) => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd></div>)}
                </dl>
              )}
              <UniversityUnverified items={r.missing} />
            </div>
          </section>
        ))}
      </div>
      <p className="hg-unid-foot">
        {t('uniDetail.nyv.explain')}{' '}
        {fallback ? <Ext href={fallback}>{t('uniDetail.nyv.official')}</Ext> : t('uniDetail.nyv.noLink')}
      </p>
      {foot}
    </section>
  );
}

/* ----------------------------------------------------------------------------------------------- admissions */

/**
 * Admissions, separated from everything else: the level, the language requirement with its source and date, the
 * verified guide, the official pages — and one line for what changes every intake and is not verified here.
 */
export function UniversityAdmissions({ content, data, level, website, action, id = 'admissions' }: {
  content: UniversityContent | null; data: InstAdmissions | undefined; level: StudyLevel | null; website?: string | null; id?: string;
  /** The one action that belongs at the end of admissions (the page passes the official guide). */
  action?: ReactNode;
}) {
  const { t, locale } = useLocale('common');
  const levels = levelsWithRules(data);
  const [chosen, setChosen] = useState<StudyLevel | null>(null);
  const lv = chosen ?? (level && levels.includes(level) ? level : levels.includes('BACHELOR') ? 'BACHELOR' : levels[0] ?? null);
  const rules = (lv && data?.language_rules[lv]) || [];
  const links = universityLinks(content, website);
  const guides = universityGuides(content);
  const intl = content?.intl;
  const sources = intl?.sources ?? [];
  const date = (d?: string | null) => (d ? formatDate(d, locale, DATE) : '');
  const tracks = (['KOREAN', 'ENGLISH', 'ANY'] as const).filter((tr) => rules.some((r) => r.track === tr));

  // The pages the chosen level's rules were read from, each once, named where the research record names it.
  const ruleSources = [...new Map(rules.filter((r) => r.source_url).map((r) => [r.source_url!, r.verified_at])).entries()]
    .map(([url, at]) => ({ url, at, name: guideTitle(sources.find((s) => s.url === url)?.name) }));
  const fallback = guides[0]?.url ?? links.admissions ?? links.office ?? links.website;
  const verified = levels.length > 0;

  return (
    <section className="hg-uni-sec hg-unid-rule hg-unid-adm" id={id} aria-labelledby="hg-unid-adm-h">
      <Head id="hg-unid-adm-h" eyebrow={t('uniDetail.adm.eyebrow')} title={t('uniDetail.adm.title')}
        lede={verified ? t('uniDetail.adm.lede') : t('uniDetail.adm.ledeUnverified')} />

      <dl className="hg-unid-rows">
        {verified && (
          <div className="hg-unid-row">
            <dt>{t('uniDetail.adm.level')}</dt>
            <dd>
              <div className="hg-unid-levels" role="group" aria-label={t('uniDetail.adm.level')}>
                {levels.map((l) => (
                  <button key={l} type="button" className="hg-unid-level" aria-pressed={l === lv} onClick={() => setChosen(l)}>
                    {t(`fit.level.${l}`)}
                  </button>
                ))}
              </div>
            </dd>
          </div>
        )}

        {verified && (
          <div className="hg-unid-row">
            <dt>{t('uniDetail.adm.language')}</dt>
            <dd aria-live="polite">
              <div className="hg-unid-tracks">
                {tracks.map((tr) => {
                  const mine = rules.filter((r) => r.track === tr);
                  const apply = mine.filter((r) => r.stage === 'APPLICATION' && r.test !== 'OTHER' && r.test !== 'NONE_REQUIRED');
                  const later = mine.filter((r) => r.stage !== 'APPLICATION' && r.test !== 'OTHER' && r.test !== 'NONE_REQUIRED');
                  const none = mine.some((r) => r.test === 'NONE_REQUIRED');
                  return (
                    <div key={tr} className="hg-unid-track">
                      <p className="hg-unid-track__h">{tr === 'ANY' ? t('uni27.intl.allTracks') : t(`fit.track.${tr}`)}</p>
                      {none ? <p>{t('fit.reason.noneRequired')}</p> : apply.length > 0 && (
                        <>
                          {apply.length > 1 && <p className="hg-unid-track__any">{t('uniDetail.adm.anyOne')}</p>}
                          <ul className="hg-unid-tests">
                            {apply.map((r) => <li key={`${r.test}-${r.min}-${r.group}`}>{testLabel(t, r)}</li>)}
                          </ul>
                        </>
                      )}
                      {mine.some((r) => r.test === 'OTHER') && <p className="hg-unid-note">{t('uni27.intl.otherRoutes')}</p>}
                      {later.length > 0 && <p className="hg-unid-note">{t('uni27.intl.later', { tests: later.map((r) => testLabel(t, r)).join(t('fit.or')) })}</p>}
                    </div>
                  );
                })}
              </div>
              {ruleSources.length > 0 && (
                <p className="hg-unid-src">
                  <span>{t('uni27.source')}</span>
                  {ruleSources.map((s) => (
                    <span key={s.url} className="hg-unid-src__item">
                      <Ext href={s.url}><span data-no-l10n>{s.name || t('uniDetail.adm.officialSource')}</span></Ext>
                      {s.at && <span>{t('uni27.checkedOn', { date: date(s.at) })}</span>}
                    </span>
                  ))}
                </p>
              )}
            </dd>
          </div>
        )}

        {guides.length > 0 && (
          <div className="hg-unid-row">
            <dt>{t('uniDetail.adm.guide')}</dt>
            <dd>
              <ul className="hg-unid-guides">
                {guides.map((g) => (
                  <li key={g.url}>
                    <Ext href={g.url}><span data-no-l10n>{guideTitle(g.name) || t('uniDetail.adm.guide')}</span></Ext>
                    <span className="hg-unid-meta">
                      {g.publication_date && /^\d{4}-\d{2}-\d{2}$/.test(g.publication_date) ? `${t('uniDetail.adm.published', { date: date(g.publication_date) })} · ` : ''}
                      {intl?.researched_at ? t('uni27.checkedOn', { date: date(intl.researched_at) }) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}

        {links.admissions && (
          <div className="hg-unid-row">
            <dt>{t('uniDetail.adm.page')}</dt>
            <dd><Ext href={links.admissions}>{t('uniDetail.adm.pageLink')}</Ext></dd>
          </div>
        )}
        {links.office && (
          <div className="hg-unid-row">
            <dt>{t('uniDetail.adm.office')}</dt>
            <dd><Ext href={links.office}>{t('uniDetail.adm.officeLink')}</Ext></dd>
          </div>
        )}
        {!links.admissions && !links.office && links.website && (
          <div className="hg-unid-row">
            <dt>{t('uniDetail.adm.website')}</dt>
            <dd><Ext href={links.website}>{t('uniDetail.adm.websiteLink')}</Ext></dd>
          </div>
        )}

        <div className="hg-unid-row hg-unid-row--nyv">
          <dt>{t('uniDetail.adm.eachIntake')}</dt>
          <dd>
            <UniversityUnverified
              items={[...(verified ? [] : [t('uniDetail.nyv.item.language')]), t('uniDetail.nyv.item.period'), t('uniDetail.nyv.item.documents'), t('uniDetail.nyv.item.legalization'), t('uniDetail.nyv.item.tuitionFee')]}
              href={fallback}
              hrefLabel={guides.length ? t('uniDetail.adm.viewGuide') : undefined}
            />
            <p className="hg-unid-note">{fallback ? t('uniDetail.adm.eachIntakeBody') : t('uniDetail.nyv.noLink')}</p>
          </dd>
        </div>
      </dl>
      {action && <div className="hg-unid-act">{action}</div>}
    </section>
  );
}

/* --------------------------------------------------------------------------------------------- scholarships */

type ScholGroup = 'ENTRANCE' | 'LANGUAGE' | 'GKS' | 'ENROLLED' | 'FOUNDATION' | 'HOUSING';
const SCHOL_GROUPS: ScholGroup[] = ['ENTRANCE', 'LANGUAGE', 'GKS', 'ENROLLED', 'FOUNDATION', 'HOUSING'];
/** How a reader looks for a scholarship: what they can get on entry, for a language score, from the government, once enrolled. */
function scholGroup(s: InstScholarship): ScholGroup {
  const c = s.category ?? 'UNIVERSITY';
  if (c === 'GKS' || c === 'LANGUAGE' || c === 'FOUNDATION' || c === 'HOUSING') return c;
  return c === 'ACADEMIC' || s.stage === 'ENROLLED' ? 'ENROLLED' : 'ENTRANCE';
}
const GROUP_LABEL: Record<ScholGroup, string> = {
  ENTRANCE: 'uniDetail.schol.group.ENTRANCE', ENROLLED: 'uniDetail.schol.group.ENROLLED',
  LANGUAGE: 'uni27.cat.LANGUAGE', GKS: 'uni27.cat.GKS', FOUNDATION: 'uni27.cat.FOUNDATION', HOUSING: 'uni27.cat.HOUSING',
};

/**
 * Scholarships, grouped the way a student searches for one. Each record carries who it is for, the benefit, the
 * conditions, the period, its official source and the date Hangyul read it. GKS designation (from NIIED's own
 * guidelines) is shown even where the university's own schemes are not verified yet.
 */
export function UniversityScholarships({ data, level, levelLabel, checkHref, fallbackHref, content, id = 'scholarships' }: {
  data: InstAdmissions | undefined; level: StudyLevel | null; levelLabel?: string; checkHref: string; fallbackHref?: string | null;
  /** Optional: lets the section show the institution's GKS designation beside its own schemes. */
  content?: UniversityContent | null; id?: string;
}) {
  const { t, locale } = useLocale('common');
  const nameOf = useName();
  if (!data) return null;
  const all = data.scholarships;
  const gks = gksProgrammes(content);
  const date = (d?: string | null) => (d ? formatDate(d, locale, DATE) : '');

  const gksBlock = gks.length > 0 && (
    <div className="hg-unid-gks">
      <h3>{t('uniDetail.schol.gksTitle')}</h3>
      <p>{t('uniDetail.schol.gksBody')}</p>
      <ul>
        {gks.map((g) => (
          <li key={g.label}>
            {g.url ? <Ext href={g.url}><span data-no-l10n>{g.label}</span></Ext> : <span data-no-l10n>{g.label}</span>}
            {g.date && /^\d{4}-\d{2}-\d{2}$/.test(g.date) && <span className="hg-unid-meta">{t('uniDetail.schol.notice', { date: date(g.date) })}</span>}
          </li>
        ))}
      </ul>
    </div>
  );

  if (!all.length) {
    return (
      <section className="hg-uni-sec hg-unid-rule hg-unid-schol" id={id} aria-labelledby="hg-uni-schol-h">
        <Head id="hg-uni-schol-h" eyebrow={t('uni27.schol.eyebrow')} title={t('uni27.schol.title')} />
        <div className="hg-unid-schol__empty">
          {gksBlock}
          <div>
            <UniversityUnverified items={[t('uniDetail.nyv.item.ownScholarships')]} href={fallbackHref} hrefLabel={fallbackHref ? t('uni27.schol.officialPage') : undefined} />
            <p className="hg-unid-note">{t('uni27.schol.notVerified')}</p>
          </div>
        </div>
      </section>
    );
  }

  const forLevel = level ? all.filter((s) => !s.degree_levels.length || s.degree_levels.includes(level)) : all;
  const pool = forLevel.length ? forLevel : all;
  const strongest = [...pool].filter((s) => s.stage !== 'ENROLLED').sort((a, b) => (b.waiver_max ?? 0) - (a.waiver_max ?? 0) || (b.amount_krw ?? 0) - (a.amount_krw ?? 0))[0] ?? pool[0];
  const sum = data.summary;
  const stageRank = (s: InstScholarship) => ({ NEW: 0, BOTH: 1, ENROLLED: 2 } as Record<string, number>)[s.stage ?? ''] ?? 1;
  const groups = SCHOL_GROUPS.map((g) => ({ g, rows: all.filter((s) => scholGroup(s) === g)
    .sort((a, b) => stageRank(a) - stageRank(b) || (b.waiver_max ?? 0) - (a.waiver_max ?? 0)) })).filter((x) => x.rows.length);
  const latest = all.map((s) => s.verified_at).filter(Boolean).sort().at(-1);

  return (
    <section className="hg-uni-sec hg-unid-rule hg-unid-schol" id={id} aria-labelledby="hg-uni-schol-h">
      <Head id="hg-uni-schol-h" eyebrow={t('uni27.schol.eyebrow')} title={t('uni27.schol.title')}
        lede={t('uniDetail.schol.lede')} />
      <p className="hg-unid-meta hg-unid-schol__count">{t('uni27.schol.count', { count: all.length })}{latest ? ` ${t('uni27.checkedOn', { date: date(latest) })}` : ''}</p>

      <dl className="hg-unid-pick">
        <div>
          <dt>{level && levelLabel ? t('uni27.schol.strongestFor', { level: levelLabel }) : t('uni27.schol.strongest')}</dt>
          <dd><strong data-no-l10n>{nameOf(strongest)}</strong><span>{benefit(strongest, t, locale)}</span></dd>
        </div>
        {sum?.best && (
          <div className="is-you">
            <dt>{t('uni27.schol.youMay')}</dt>
            <dd><strong data-no-l10n>{nameOf(sum.best)}</strong><span>{benefit(sum.best, t, locale)}</span></dd>
          </div>
        )}
        {sum?.unlock && (
          <div>
            <dt>{t('uni27.schol.unlockWith', { test: t(`fit.test.${sum.unlock.needs.test}`, { defaultValue: sum.unlock.needs.test }), min: sum.unlock.needs.min })}</dt>
            <dd><strong data-no-l10n>{nameOf(sum.unlock)}</strong><span>{benefit(sum.unlock, t, locale)}</span></dd>
          </div>
        )}
        {!sum && (
          <div className="hg-unid-pick__cta">
            <dt>{t('uniDetail.schol.mineTitle')}</dt>
            <dd><a className="hg-unid-go" href={checkHref}>{t('uni27.schol.checkMine')} <span aria-hidden className="hg-flip-rtl">→</span></a></dd>
          </div>
        )}
      </dl>

      <div className="hg-unid-groups">
        {groups.map(({ g, rows }, i) => <ScholarshipGroup key={g} label={t(GROUP_LABEL[g])} rows={rows} open={i === 0} />)}
      </div>
      {gksBlock}
    </section>
  );
}

/** One group, as a native disclosure. A long group opens on its first three records; the rest are one press away. */
const GROUP_PREVIEW = 3;
function ScholarshipGroup({ label, rows, open }: { label: string; rows: InstScholarship[]; open: boolean }) {
  const { t } = useLocale('common');
  const [all, setAll] = useState(false);
  const max = Math.max(...rows.map((s) => s.waiver_max ?? 0));
  const shown = all || rows.length <= GROUP_PREVIEW + 1 ? rows : rows.slice(0, GROUP_PREVIEW);
  return (
    <details className="hg-unid-group" open={open}>
      <summary>
        <h3 className="hg-unid-group__name">{label}</h3>
        <span className="hg-unid-group__meta">
          {t('uniDetail.schol.groupCount', { count: rows.length })}{max > 0 ? ` · ${t('uniDetail.schol.upTo', { pct: max })}` : ''}
        </span>
        <ChevronDown aria-hidden size={18} className="hg-unid-group__chev" />
      </summary>
      <ul className="hg-unid-schs">
        {shown.map((s) => <ScholarshipRow key={s.id} s={s} />)}
      </ul>
      {shown.length < rows.length && (
        <button type="button" className="hg-unid-showall" onClick={() => setAll(true)}>
          {t('uniDetail.schol.showAll', { count: rows.length })} <ChevronDown aria-hidden size={16} />
        </button>
      )}
    </details>
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
  const period = [s.duration, s.application_period].filter(Boolean).join(' · ');
  return (
    <li className="hg-unid-sch">
      <div className="hg-unid-sch__head">
        <h4 className="hg-unid-sch__name" data-no-l10n>{nameOf(s)}</h4>
        <p className="hg-unid-sch__benefit">{benefit(s, t, locale)}{s.dormitory_support ? ` · ${t('uni27.schol.dorm')}` : ''}{s.living_allowance ? ` · ${t('uni27.schol.living')}` : ''}</p>
      </div>
      <dl className="hg-unid-sch__facts">
        {who && <div><dt>{t('uniDetail.schol.for')}</dt><dd>{who}</dd></div>}
        {cond.length > 0 && <div><dt>{t('uni27.schol.conditions')}</dt><dd data-no-l10n>{cond.join(' · ')}</dd></div>}
        <div><dt>{t('uniDetail.schol.how')}</dt><dd>{s.automatic ? t('uni27.schol.automatic') : t('uni27.schol.apply')}</dd></div>
        {period && <div><dt>{t('uniDetail.schol.period')}</dt><dd data-no-l10n>{period}</dd></div>}
        {s.renewal && <div><dt>{t('uni27.schol.renewal')}</dt><dd data-no-l10n>{s.renewal}</dd></div>}
        {s.source_url && (
          <div>
            <dt>{t('uni27.source')}</dt>
            <dd>
              <Ext href={s.source_url}><span data-no-l10n>{guideTitle(s.source_name ?? undefined) || t('uniDetail.adm.officialSource')}</span></Ext>
              {s.verified_at && <span className="hg-unid-meta">{t('uni27.checkedOn', { date: formatDate(s.verified_at, locale, DATE) })}</span>}
            </dd>
          </div>
        )}
      </dl>
    </li>
  );
}

/* --------------------------------------------------------------------------------- campus and student life */

/**
 * Student life, as facts: where it is, housing, who to write to, the Korean-language institute, the support the
 * university itself publishes. Media (the campus gallery or the identity composition) is passed in by the page.
 */
export function UniversityLife({ inst, regionLabel, regionLine, regionBody, media, id = 'life' }: {
  inst: InstitutionDetail; regionLabel: string;
  /** One line and a short text about the region, written once per region and never about the institution. */
  regionLine?: string; regionBody?: string;
  media?: ReactNode; id?: string;
}) {
  const { t, locale } = useLocale('common');
  const content = inst.enrichment ?? null;
  const intl = content?.intl;
  const links = universityLinks(content, inst.website_url);
  const d = intl?.dormitory;
  const dmin = d?.cost_semester_krw_min ?? null, dmax = d?.cost_semester_krw_max ?? null;
  const services = intl?.support_services ?? [];
  const kli = intl?.korean_language_program;
  const lat = inst.latitude ?? content?.lat, lon = inst.longitude ?? content?.lon;
  const hasKli = kli?.value === true || !!inst.ieqas?.language_programme || !!links.kli;
  const missing = [
    ...(d?.available != null || links.dormitory ? [] : [t('uniDetail.nyv.item.dormitory')]),
    ...(links.office ? [] : [t('uniDetail.nyv.item.office')]),
    ...(hasKli ? [] : [t('uniDetail.nyv.item.kli')]),
    ...(services.length ? [] : [t('uniDetail.nyv.item.services')]),
  ];

  return (
    <section className="hg-uni-sec hg-unid-rule hg-unid-life" id={id} aria-labelledby="hg-unid-life-h">
      <Head id="hg-unid-life-h" eyebrow={t('uniDetail.life.eyebrow')} title={t('uniDetail.life.title')} />
      {media}
      <div className="hg-unid-life__grid">
        <dl className="hg-unid-rows">
          <div className="hg-unid-row">
            <dt>{t('uniDetail.sum.location')}</dt>
            <dd>
              <p>{locale === 'ko' && content?.city_ko && content.city_ko !== regionLabel ? `${content.city_ko} · ${regionLabel}` : regionLabel}</p>
              {inst.other_campuses?.length > 0 && <p className="hg-unid-note">{t('uniDetail.life.campuses')} <span lang="ko">{inst.other_campuses.map((c) => c.name_ko).join(' · ')}</span></p>}
              {lat != null && lon != null && <Ext href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}>{t('uniDetail.life.map')}</Ext>}
            </dd>
          </div>

          {(d?.available != null || links.dormitory) && (
            <div className="hg-unid-row">
              <dt>{t('uniDetail.sum.dormitory')}</dt>
              <dd>
                {d?.available != null && <p>{d.available ? t('uni27.house.available') : t('uni27.house.notAvailable')}</p>}
                {(dmin || dmax) && (
                  <p className="hg-unid-cost">
                    <strong>{dmin && dmax && dmin !== dmax ? t('uni27.house.costRange', { min: formatNumber(dmin, locale), max: formatNumber(dmax, locale) })
                      : t('uni27.house.cost', { amount: formatNumber((dmin ?? dmax)!, locale) })}</strong>
                    <span>{t('uni27.house.perSemester')}</span>
                  </p>
                )}
                {d?.capacity ? <p>{t('uni27.house.capacity', { count: d.capacity, formatted: formatNumber(d.capacity, locale) })}</p> : null}
                {d?.international_priority ? <p>{t('uni27.house.priority')}</p> : null}
                {d?.available == null && <p className="hg-unid-note">{t('uniDetail.life.dormLinkOnly')}</p>}
                {links.dormitory && <Ext href={links.dormitory}>{t('uniDetail.life.dormLink')}</Ext>}
                {d?.available != null && intl?.researched_at && <span className="hg-unid-meta">{t('uni27.checkedOn', { date: formatDate(intl.researched_at, locale, DATE) })}</span>}
              </dd>
            </div>
          )}

          {links.office && (
            <div className="hg-unid-row">
              <dt>{t('uniDetail.adm.office')}</dt>
              <dd><Ext href={links.office}>{t('uniDetail.adm.officeLink')}</Ext></dd>
            </div>
          )}

          {hasKli && (
            <div className="hg-unid-row">
              <dt>{t('uniDetail.life.kli')}</dt>
              <dd>
                {kli?.value === true && kli.name && <p data-no-l10n>{kli.name}</p>}
                {inst.ieqas?.language_programme && <p>{t('uniDetail.life.kliCertified')}</p>}
                {links.kli && <Ext href={links.kli}>{t('uniDetail.life.kliLink')}</Ext>}
              </dd>
            </div>
          )}

          {services.length > 0 && (
            <div className="hg-unid-row">
              <dt>{t('uniDetail.life.services')}</dt>
              <dd>
                <ul className="hg-unid-chips">
                  {services.map((s) => <li key={s.key}>{t(`uni27.service.${s.key}`, { defaultValue: s.key })}</li>)}
                </ul>
                {intl?.researched_at && <span className="hg-unid-meta">{t('uniDetail.life.servicesSource', { date: formatDate(intl.researched_at, locale, DATE) })}</span>}
              </dd>
            </div>
          )}

          {missing.length > 0 && (
            <div className="hg-unid-row hg-unid-row--nyv">
              <dt className="hg-sr-only">{t('uniDetail.nyv.label')}</dt>
              <dd><UniversityUnverified items={missing} href={links.office ?? links.website} /></dd>
            </div>
          )}
        </dl>

        {regionBody && (
          <aside className="hg-unid-region" aria-labelledby="hg-unid-region-h">
            <h3 id="hg-unid-region-h">{t('uniDetail.life.regionTitle', { region: regionLabel })}</h3>
            {regionLine && <p className="hg-unid-region__line">{regionLine}</p>}
            {regionBody.split('\n').map((para) => <p key={para.slice(0, 24)}>{para}</p>)}
          </aside>
        )}
      </div>
    </section>
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
