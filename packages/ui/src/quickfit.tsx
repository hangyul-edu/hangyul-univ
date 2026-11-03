/**
 * V27 quick fit — the form and the result list, shared by the marketing `/start` and the student app's `/start`
 * (REPORT §356). One implementation, so the two can never ask different questions or say different things.
 *
 * Presentational: the caller passes `run` (the API call) and `hrefFor` (where a university row goes — always the
 * canonical public university page of that app). Strings live in `common:fit.*`.
 *
 * What the page never does: show a probability, call the order a ranking, hide an institution because Hangyul has
 * not verified its rules, or claim a scholarship when a condition cannot be checked.
 */
import { useLocale } from '@hangyul/i18n';
import { ArrowRight, Bookmark, ExternalLink, Languages } from '@hangyul/icons';
import {
  fitComplete, fitGpa, GPA_HELP_URL, GPA_SCALES, LANGUAGE_TESTS, normaliseGpa, STUDY_LEVELS,
  type FitAnswers, type FitInput, type FitItem, type FitResult, type FitTier, type LanguageTestCode, type MatchSort,
  type StudyLevel, type TestFamily,
} from '@hangyul/types';
import { cx, fitReasonText, formatNumber, resolveUniversityVisual, scholarshipName } from '@hangyul/utils';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Button, Field, FilterSelect, Input, OptionCards, Select } from './primitives';
import { UniversityLogo, UniversityPhoto } from './university';
import './styles/quickfit.css';

const FAMILIES: TestFamily[] = ['KOREAN', 'ENGLISH'];
const CUSTOM = 'custom';

// ------------------------------------------------------------------------------------------------ the form

/**
 * Four questions. GPA is taken **on the student's own scale** — nobody converts first — and the conversion the
 * result used is shown back to them. Language is "what do you have?", then only the tests of that family.
 */
export function QuickFitForm({ value, onChange, countrySelect, onSubmit, busy, submitLabel, footnote }: {
  value: FitAnswers; onChange: (next: FitAnswers) => void; countrySelect: ReactNode;
  onSubmit: () => void; busy?: boolean; submitLabel: string; footnote?: ReactNode;
}) {
  const { t, locale } = useLocale('common');
  const set = (patch: Partial<FitAnswers>) => onChange({ ...value, ...patch });
  const knownScale = value.gpaScale === '' || (GPA_SCALES as readonly number[]).includes(Number(value.gpaScale));
  const [customScale, setCustomScale] = useState(!knownScale);
  const families = useMemo(() => new Set(value.languages.map((l) => LANGUAGE_TESTS.find((d) => d.code === l.test)!.family)), [value.languages]);
  const [open, setOpen] = useState<Set<TestFamily>>(() => families);
  const gpa = fitGpa(value);
  const pct = gpa ? normaliseGpa(gpa.value, gpa.scale_max) : null;
  const gpaBad = value.gpa.trim() !== '' && Number(value.gpaScale) > 0 && !gpa;
  const complete = fitComplete(value);

  const toggleFamily = (f: TestFamily) => {
    const next = new Set(open);
    if (next.has(f)) {
      next.delete(f);
      set({ languages: value.languages.filter((l) => LANGUAGE_TESTS.find((d) => d.code === l.test)!.family !== f) });
    } else {
      next.add(f);
      set({ noLanguage: false });
    }
    setOpen(next);
  };
  const setTest = (f: TestFamily, code: LanguageTestCode | '', score: string) => {
    const others = value.languages.filter((l) => LANGUAGE_TESTS.find((d) => d.code === l.test)!.family !== f);
    const n = Number(score);
    onChange({ ...value, noLanguage: false, languages: code && score !== '' && Number.isFinite(n) ? [...others, { test: code, score: n }] : others });
  };

  return (
    <div className="hg-fit-form">
      <div className="hg-fit-q">{countrySelect}</div>

      <fieldset className="hg-fit-q">
        <legend className="hg-fit-legend">{t('fit.q.level')}</legend>
        <OptionCards<StudyLevel>
          label={t('fit.q.level')} min={140} className="hg-fit-options"
          value={(value.level || null) as StudyLevel | null}
          onChange={(v) => set({ level: v as StudyLevel })}
          options={STUDY_LEVELS.map((l) => ({ value: l, label: t(`fit.level.${l}`) }))}
        />
      </fieldset>

      {value.level !== 'LANGUAGE' && (
        <fieldset className="hg-fit-q">
          <legend className="hg-fit-legend">{t('fit.q.gpa')}</legend>
          <div className="hg-fit-gpa">
            <Field label={t('fit.gpa.value')} htmlFor="hg-fit-gpa" error={gpaBad ? t('fit.gpa.outOfScale', { max: value.gpaScale }) : undefined}>
              <Input id="hg-fit-gpa" inputMode="decimal" autoComplete="off" value={value.gpa} placeholder={t('fit.gpa.placeholder')}
                onChange={(e) => set({ gpa: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '').slice(0, 6) })} aria-invalid={gpaBad || undefined} />
            </Field>
            <Field label={t('fit.gpa.scale')} htmlFor="hg-fit-scale">
              <Select id="hg-fit-scale" value={customScale ? CUSTOM : value.gpaScale}
                onChange={(e) => {
                  if (e.target.value === CUSTOM) { setCustomScale(true); set({ gpaScale: '' }); } else { setCustomScale(false); set({ gpaScale: e.target.value }); }
                }}>
                <option value="">{t('fit.gpa.chooseScale')}</option>
                {GPA_SCALES.map((s) => <option key={s} value={String(s)}>{s === 100 ? t('fit.gpa.percent') : t('fit.gpa.outOf', { max: s })}</option>)}
                <option value={CUSTOM}>{t('fit.gpa.custom')}</option>
              </Select>
            </Field>
            {customScale && (
              <Field label={t('fit.gpa.customMax')} htmlFor="hg-fit-max">
                <Input id="hg-fit-max" inputMode="decimal" value={value.gpaScale} onChange={(e) => set({ gpaScale: e.target.value.replace(/[^0-9.]/g, '').slice(0, 6) })} />
              </Field>
            )}
          </div>
          <p className="hg-fit-note">
            {pct !== null
              ? t('fit.gpa.normalised', { value: gpa!.value, max: gpa!.scale_max, pct: formatNumber(pct, locale) })
              : t('fit.gpa.why')}
            {' '}
            <a className="hg-fit-help" href={GPA_HELP_URL} target="_blank" rel="noopener noreferrer">
              {t('fit.gpa.help')}<ExternalLink size={13} aria-hidden /><span className="hg-sr">{t('fit.newTab')}</span>
            </a>
          </p>
        </fieldset>
      )}

      <fieldset className="hg-fit-q">
        <legend className="hg-fit-legend">{t('fit.q.language')}</legend>
        <div className="hg-fit-chips" role="group" aria-label={t('fit.q.language')}>
          {FAMILIES.map((f) => (
            <button key={f} type="button" className={cx('hg-fit-chip', open.has(f) && 'is-on')} aria-pressed={open.has(f)} onClick={() => toggleFamily(f)}>
              {t(`fit.family.${f}`)}
            </button>
          ))}
          <button type="button" className={cx('hg-fit-chip', value.noLanguage && 'is-on')} aria-pressed={value.noLanguage}
            onClick={() => { setOpen(new Set()); onChange({ ...value, languages: [], noLanguage: !value.noLanguage }); }}>
            {t('fit.family.NONE')}
          </button>
        </div>
        {FAMILIES.filter((f) => open.has(f)).map((f) => {
          const cur = value.languages.find((l) => LANGUAGE_TESTS.find((d) => d.code === l.test)!.family === f);
          return <TestRow key={f} family={f} test={cur?.test ?? ''} score={cur ? String(cur.score) : ''} onSet={(c, s) => setTest(f, c, s)} />;
        })}
      </fieldset>

      <div className="hg-fit-go">
        <Button variant="primary" size="lg" disabled={!complete} loading={busy} onClick={onSubmit} aria-describedby="hg-fit-foot">
          {submitLabel}
        </Button>
        <span className="hg-fit-note" id="hg-fit-foot">{complete ? footnote : t('fit.missing')}</span>
      </div>
    </div>
  );
}

function TestRow({ family, test, score, onSet }: { family: TestFamily; test: LanguageTestCode | ''; score: string; onSet: (c: LanguageTestCode | '', s: string) => void }) {
  const { t } = useLocale('common');
  const [code, setCode] = useState<LanguageTestCode | ''>(test);
  const [raw, setRaw] = useState(score);
  const def = LANGUAGE_TESTS.find((d) => d.code === code);
  useEffect(() => { setCode(test); setRaw(score); }, [test, score]);
  const n = Number(raw);
  const bad = !!def && raw !== '' && (!Number.isFinite(n) || n < def.min || n > def.max);
  const levels = def?.kind === 'LEVEL' ? Array.from({ length: (def.max - def.min) / def.step + 1 }, (_, i) => def.min + i * def.step) : null;
  const tests = LANGUAGE_TESTS.filter((d) => d.family === family);
  return (
    <div className="hg-fit-test">
      <Field label={t(`fit.testLabel.${family}`)} htmlFor={`hg-fit-test-${family}`}>
        <Select id={`hg-fit-test-${family}`} value={code} onChange={(e) => { const c = e.target.value as LanguageTestCode | ''; setCode(c); setRaw(''); onSet(c, ''); }}>
          <option value="">{t('fit.chooseTest')}</option>
          <optgroup label={t('fit.common')}>{tests.filter((d) => d.common).map((d) => <option key={d.code} value={d.code}>{t(`fit.test.${d.code}`)}</option>)}</optgroup>
          <optgroup label={t('fit.other')}>{tests.filter((d) => !d.common).map((d) => <option key={d.code} value={d.code}>{t(`fit.test.${d.code}`)}</option>)}</optgroup>
        </Select>
      </Field>
      {def && (
        <Field label={t(def.kind === 'LEVEL' ? 'fit.levelLabel' : 'fit.scoreLabel')} htmlFor={`hg-fit-score-${family}`}
          error={bad ? t('fit.scoreRange', { min: def.min, max: def.max }) : undefined}
          hint={!bad && !def.common && family === 'ENGLISH' ? t('fit.notEverywhere') : undefined}>
          {levels ? (
            <Select id={`hg-fit-score-${family}`} value={raw} onChange={(e) => { setRaw(e.target.value); onSet(code, e.target.value); }}>
              <option value="">{t('fit.chooseLevel')}</option>
              {levels.map((l) => <option key={l} value={String(l)}>{t(`fit.levelValue.${def.code}`, { level: l, defaultValue: String(l) })}</option>)}
            </Select>
          ) : (
            <Input id={`hg-fit-score-${family}`} inputMode="decimal" value={raw} aria-invalid={bad || undefined}
              placeholder={`${def.min}–${def.max}`}
              onChange={(e) => { const v = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '').slice(0, 6); setRaw(v); onSet(code, v); }} />
          )}
        </Field>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ results

const PAGE = 12;

function useSaved(): [Set<string>, (slug: string) => void] {
  const KEY = 'hg.fit.saved';
  const [saved, setSaved] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]); } catch { return new Set(); }
  });
  const toggle = (slug: string) => setSaved((prev) => {
    const next = new Set(prev);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* private mode: the toggle still works for this visit */ }
    return next;
  });
  return [saved, toggle];
}

/** Display order of the groups (V28, STATE_MAP): verified routes first — meets, one step away — then the honest "needs
 *  checking" bucket and the far one. Tier semantics are V27's and unchanged; only the reading order and labels are V28's. */
const DISPLAY: FitTier[] = ['MEETS', 'ONE_STEP', 'CHALLENGE', 'UNCLEAR'];
const PICKS = 4;

/**
 * The result (V28, UX_AUDIT MK-1/2): the answer first — how many, which group is strongest, one line, the one improvement
 * hint — then "가장 먼저 살펴볼 대학" (a few photo-led picks from the strongest verified group), then the groups quietly, 12 rows
 * each with 더 보기. Sort and region come after the answer, never before. Nothing is filtered out by default.
 */
export function QuickFitResults({ first, input, run, hrefFor, after }: {
  first: FitResult; input: FitInput; run: (body: FitInput) => Promise<FitResult>;
  hrefFor: (item: FitItem) => string; after?: ReactNode;
}) {
  const { t, locale } = useLocale('common');
  const [view, setView] = useState<FitResult>(first);
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState<MatchSort>('recommended');
  const [extra, setExtra] = useState<Record<string, FitItem[]>>({});
  const [flat, setFlat] = useState<FitResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saved, toggleSave] = useSaved();
  useEffect(() => { setView(first); setRegion(''); setExtra({}); setFlat(null); setSort('recommended'); }, [first]);
  const scoped = { ...input, ...(region ? { region } : {}) };

  const more = async (tier: FitTier, offset: number) => {
    setBusy(tier); setFailed(false);
    try {
      const r = await run({ ...scoped, sort: 'recommended', tier, offset, limit: PAGE });
      setExtra((prev) => ({ ...prev, [tier]: [...(prev[tier] ?? []), ...(r.items ?? [])] }));
    } catch { setFailed(true); } finally { setBusy(null); }
  };
  const resort = async (s: MatchSort, offset = 0, reg = region) => {
    setSort(s); setFailed(false);
    const body = { ...input, ...(reg ? { region: reg } : {}) };
    setBusy('flat');
    try {
      if (s === 'recommended') { setFlat(null); if (!offset) { setExtra({}); setView(reg ? await run({ ...body, sort: s }) : first); } return; }
      const r = await run({ ...body, sort: s, offset, limit: PAGE * 2 });
      setFlat((prev) => (offset && prev ? { ...r, items: [...(prev.items ?? []), ...(r.items ?? [])] } : r));
    } catch { setFailed(true); } finally { setBusy(null); }
  };

  const row = (it: FitItem, showTier: boolean) => (
    <FitRow key={it.slug} item={it} href={hrefFor(it)} showTier={showTier} saved={saved.has(it.slug)} onSave={() => toggleSave(it.slug)} />
  );
  const sections = DISPLAY.map((tier) => (view.sections ?? []).find((x) => x.tier === tier)).filter((x): x is NonNullable<typeof x> => !!x && x.total > 0);
  const strongest = sections.find((x) => x.tier === 'MEETS' || x.tier === 'ONE_STEP') ?? sections[0];
  const picks = strongest && strongest.tier !== 'CHALLENGE' && strongest.tier !== 'UNCLEAR' ? strongest.items.slice(0, PICKS) : [];
  const regions = Object.entries(first.regions ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="hg-fit-results" aria-live="polite">
      <header className="hg-fit-sum">
        <h2 className="hg-fit-sum__title">{t('fit.result.title', { count: view.total, formatted: formatNumber(view.total, locale) })}</h2>
        {strongest && (
          <p className="hg-fit-sum__lead">{t(`fit.summary.${strongest.tier}`, { count: strongest.total, formatted: formatNumber(strongest.total, locale) })}</p>
        )}
        <p className="hg-fit-note">{t('fit.summary.basis')}</p>
        {view.unlock && (
          <p className="hg-fit-unlock"><Languages aria-hidden size={18} />
            {t('fit.unlock', { test: t(`fit.test.${view.unlock.test}`), min: view.unlock.min, count: view.unlock.count })}</p>
        )}
      </header>

      {sort === 'recommended' && picks.length > 0 && (
        <section className="hg-fit-picks" aria-labelledby="hg-fit-picks-h">
          <h3 className="hg-fit-picks__h" id="hg-fit-picks-h">{t('fit.picks.title')}</h3>
          <ul className="hg-fit-picks__list">
            {picks.map((it) => <FitPick key={it.slug} item={it} href={hrefFor(it)} />)}
          </ul>
        </section>
      )}

      <div className="hg-fit-tools">
        {/* V30: toolbar filters are FilterSelects — `category · value ⌄`, content-sized (REPORT §409). */}
        <FilterSelect size="sm" label={t('fit.sort.label')} active={false} value={sort} onChange={(e) => void resort(e.target.value as MatchSort)}>
          {(['recommended', 'scholarship', 'region', 'name'] as MatchSort[]).map((x) => <option key={x} value={x}>{t(`fit.sort.${x}`)}</option>)}
        </FilterSelect>
        {regions.length > 1 && (
          <FilterSelect size="sm" label={t('fit.filter.region')} value={region} onChange={(e) => { setRegion(e.target.value); void resort(sort, 0, e.target.value); }}>
            <option value="">{t('fit.filter.allRegions')}</option>
            {regions.map(([r, n]) => <option key={r} value={r}>{`${t(`region.${r}`, { defaultValue: r })} (${formatNumber(n, locale)})`}</option>)}
          </FilterSelect>
        )}
        {first.gpa && <span className="hg-fit-note">{t('fit.gpa.used', { value: first.gpa.raw_value, max: first.gpa.scale_max, pct: formatNumber(first.gpa.normalized_percent, locale) })}</span>}
      </div>

      {sort === 'recommended' ? sections.map((sec) => {
        const shown = sec === strongest ? sec.items.slice(picks.length) : sec.items;
        const items = [...shown, ...(extra[sec.tier] ?? [])];
        const loaded = items.length + (sec === strongest ? picks.length : 0);
        return (
          <section key={sec.tier} className="hg-fit-group" aria-labelledby={`hg-fit-${sec.tier}`}>
            <h3 className="hg-fit-group__title" id={`hg-fit-${sec.tier}`}>{t(`fit.tier.${sec.tier}.title`)} <span className="hg-num">{formatNumber(sec.total, locale)}</span></h3>
            <p className="hg-fit-group__lede">{t(`fit.tier.${sec.tier}.lede`)}</p>
            {items.length > 0 && <ul className="hg-fit-list">{items.map((it) => row(it, false))}</ul>}
            {loaded < sec.total && (
              <Button variant="secondary" loading={busy === sec.tier} onClick={() => void more(sec.tier, loaded)}>
                {t('fit.more', { count: sec.total - loaded })}
              </Button>
            )}
          </section>
        );
      }) : flat && (
        <section className="hg-fit-group">
          <ul className="hg-fit-list">{(flat.items ?? []).map((it) => row(it, true))}</ul>
          {(flat.items?.length ?? 0) < (flat.page_total ?? 0) && (
            <Button variant="secondary" loading={busy === 'flat'} onClick={() => void resort(sort, flat.items?.length ?? 0)}>
              {t('fit.more', { count: (flat.page_total ?? 0) - (flat.items?.length ?? 0) })}
            </Button>
          )}
        </section>
      )}
      {failed && <p className="hg-error" role="alert">{t('states.errorDetail', { defaultValue: t('states.error') })}</p>}
      <p className="hg-fit-note">{t('fit.order', { verified: formatNumber(first.verified_rule_institutions, locale) })}</p>
      {after}
    </div>
  );
}

/** A first pick: the campus photograph leads, then the name and the one reason. */
function FitPick({ item, href }: { item: FitItem; href: string }) {
  const { t, locale } = useLocale('common');
  const korean = locale === 'ko';
  const name = korean || !item.name_en ? item.name_ko : item.name_en;
  const content = (item.enrichment ?? null) as Parameters<typeof resolveUniversityVisual>[2];
  const v = resolveUniversityVisual(item.slug, item.region, content);
  return (
    <li className="hg-fit-pick">
      <a href={href} className="hg-fit-pick__link">
        <span className="hg-fit-pick__visual" aria-hidden>
          {v.campus ? <UniversityPhoto media={v.campus} sizes="(min-width: 900px) 22vw, 70vw" alt="" />
            : <img className="hg-fit-row__region" src={`/media/region-mark/${item.region}.svg`} alt="" width={41} height={44} loading="lazy" decoding="async" />}
        </span>
        <span className="hg-fit-pick__name">{name}</span>
        <span className="hg-fit-pick__meta">{t(`region.${item.region}`, { defaultValue: item.region })}</span>
        <span className="hg-fit-pick__reason">{reasonText(item, t)}</span>
      </a>
    </li>
  );
}

function FitRow({ item, href, showTier, saved, onSave }: { item: FitItem; href: string; showTier: boolean; saved: boolean; onSave: () => void }) {
  const { t, locale } = useLocale('common');
  const korean = locale === 'ko';
  const name = korean || !item.name_en ? item.name_ko : item.name_en;
  const alt = korean ? item.name_en : item.name_ko;
  const content = (item.enrichment ?? null) as Parameters<typeof resolveUniversityVisual>[2];
  const v = resolveUniversityVisual(item.slug, item.region, content);
  const region = t(`region.${item.region}`, { defaultValue: item.region });
  const s = item.scholarship;
  return (
    <li className="hg-fit-row">
      <a className="hg-fit-row__link" href={href}>
        <span className="hg-fit-row__visual" aria-hidden>
          {v.campus ? <UniversityPhoto media={v.campus} sizes="96px" alt="" />
            : v.logo ? <UniversityLogo content={content} name={name} size={40} className="hg-fit-row__mark" />
              // No licensed photograph and no mark: the province outline — identity, never a stand-in campus (brief §43).
              : <img className="hg-fit-row__region" src={`/media/region-mark/${item.region}.svg`} alt="" width={41} height={44} loading="lazy" decoding="async" />}
        </span>
        <span className="hg-fit-row__main">
          <span className="hg-fit-row__name">{name}</span>
          {alt && <span className="hg-fit-row__alt" lang={korean ? 'en' : 'ko'}>{alt}</span>}
          <span className="hg-fit-row__meta">
            <span>{region}</span>
            {showTier && <span className={cx('hg-fit-tier', `is-${item.tier.toLowerCase()}`)}>{t(`fit.tier.${item.tier}.short`)}</span>}
            {item.tracks.map((tr) => <span key={tr} className="hg-fit-track">{t(`fit.track.${tr}`)}</span>)}
          </span>
          <span className="hg-fit-row__reason">{reasonText(item, t)}</span>
          {s && (s.best || s.unlock) && (
            <span className="hg-fit-row__schol">{s.best
              // The name is the university's own (often another script): isolate it so RTL sentences keep their order.
              ? t('fit.schol.best', { name: `\u2068${scholarshipName(s.best, locale)}\u2069`, pct: s.best.waiver_max ?? '', context: s.best.waiver_max ? 'pct' : undefined })
              : t('fit.schol.unlock', { test: t(`fit.test.${s.unlock!.needs.test}`, { defaultValue: s.unlock!.needs.test }), min: s.unlock!.needs.min, pct: s.unlock!.waiver_max ?? '', context: s.unlock!.waiver_max ? 'pct' : undefined })}</span>
          )}
        </span>
        <ArrowRight className="hg-fit-row__go hg-flip-rtl" aria-hidden size={18} />
      </a>
      <button type="button" className={cx('hg-fit-save', saved && 'is-on')} aria-pressed={saved} onClick={onSave}
        aria-label={t(saved ? 'fit.saved' : 'fit.save', { name })}>
        <Bookmark size={18} aria-hidden />
      </button>
    </li>
  );
}

/** The one line saying why a row is in its group — shared with native (`@hangyul/utils` fitReasonText). */
export const reasonText = fitReasonText;
