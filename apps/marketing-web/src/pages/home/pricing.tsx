/**
 * The pricing section — the one movement V15 adds to the homepage (REPORT §118), recomposed in V15 b.
 *
 * It sits between 서비스 and FAQ, which is both what the brief suggested and the only position that reads:
 * the services section has just said what Hangyul does, the FAQ is about to answer TOPIK and documents, and
 * price is exactly the question in between.
 *
 * **Every number here comes from `@hangyul/types/plans`**, the manifest the server seed and the API are
 * generated from. Nothing in this file knows a price. The reason is not tidiness: before V15 the homepage,
 * the student service page and the server each held their own figures, and `npm run qa:pricing` now asserts
 * all of them agree because there is only one of them.
 *
 * ---------------------------------------------------------------------------------------------------------
 * V29: the content follows the owner's new service contract (REPORT §380); the layout is V15 b's, kept.
 *
 * What V15 b changed, and why. The first build was three rounded cards, a spreadsheet and two paragraphs of
 * exclusions: correct, and a SaaS billing page pasted into an editorial homepage. Three decisions fixed that.
 *
 *   **The cards stopped being cards.** Basic and Premium are now columns of type under one hairline — the
 *   same `kn-tri` grammar the value section uses — and **All-in-One is the only plan with a surface**. A
 *   warm panel that rises through the shared rule says "this is the one" without a ribbon, a gradient or a
 *   second colour; the other two are not demoted, they are simply not wearing anything.
 *
 *   **The comparison stopped being a table of 미포함.** Eleven flat rows became three named areas, and the
 *   absent cell is an em dash rather than the word "미포함" printed nine times. The reader's question is
 *   not "can I read every row", it is "what do I get by moving up"; the matrix is shaped around that.
 *
 *   **The exclusion and external-cost paragraphs left the homepage.** They are not deleted — the statement a
 *   buyer needs before paying lives where the buying happens: the student plan page states it above the
 *   plan chooser (`v15.services.external`, `apps/student-web/src/pages/Services.tsx`) and 제8조 of the Terms
 *   states it as a term. `npm run qa:pricing` asserts both halves: gone from here, still there. A paragraph
 *   of legal copy under a price is a conversion problem *and* reaches a reader who has not decided to care.
 *
 * What is deliberately absent, unchanged from V15: BEST ribbons, strike-through anchors, countdowns, savings
 * percentages, glow, gradients, scarcity, and the word 보장 — the business plan does not guarantee admission,
 * scholarship or visa (§8), so the section sells by being legible instead.
 */
import { Band, Reveal, SectionHead, ArrowRightIcon } from '@hangyul/koreanasha-ui';
import { useLocale } from '@hangyul/i18n';
import {
  ADD_ONS, COMPARE_GROUPS, COMPARE_ROWS, PLANS, SERVICE_NOTES, compareCell, planPresentation, planText,
  type AddOnDef, type Cell, type CompareRow, type PlanDef,
} from '@hangyul/types';
import { cx, formatMoney } from '@hangyul/utils';
import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';

import { koreanasha } from '../../lib/koreanasha-copy';
import { useStudentSession, planAction } from '../../lib/session';

type T = (k: string, o?: Record<string, unknown>) => string;

/* ------------------------------------------------------------------------------------------------ marks */

/**
 * The one mark the section uses, at one size, in one weight (brief Part 8). The previous tick was a 9×5
 * rotated border box — cheap to write and visibly not a check at 2×. A 15 px stroked path with round caps
 * is the same weight as the arrow in the buttons beside it, which is the point: the section has one line
 * quality, not one per element.
 *
 * It is never the loudest thing in a row. Colour is the plan's, not a status green, and the list item's text
 * is a full step darker than the mark.
 */
function Tick({ className }: { className?: string }) {
  return (
    <svg className={cx('kn-tick', className)} width="15" height="15" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.3 8.5 6.4 11.6 12.7 5" />
    </svg>
  );
}

/* ------------------------------------------------------------------------------------------- the plans */

/** The plan's name, from the canonical presentation rather than from a key spelled out again. */
const nameOf = (t: T, plan: PlanDef) => t(planPresentation(plan).name_key);

function PlanCard({ plan }: { plan: PlanDef }) {
  const { t, locale } = useLocale('marketing');
  const { authenticated } = useStudentSession();
  // V21 b — the approved description and the five lines come from `@hangyul/types`, which is also what the
  // student plan screen renders. The homepage is the source of this content; it is no longer the only
  // reader of it (REPORT §243).
  const copy = planText(t, planPresentation(plan));
  return (
    <article className="kn-plan" data-plan={plan.slug} data-recommended={plan.recommended || undefined}
      aria-labelledby={`plan-${plan.slug}`}>
      <div className="kn-plan__body">
        <header className="kn-plan__head">
          <h3 className="kn-plan__name" id={`plan-${plan.slug}`}>{copy.name}</h3>
          {/* A hairline label in the brand colour, not a filled badge. All-in-One is 주력 상품 (business plan
              §9) and a reader must see that at a glance — but the panel underneath it is already saying so,
              so the label only has to name what the panel means. */}
          {plan.recommended && <span className="kn-plan__tag">{t('v15.pricing.recommended')}</span>}
        </header>
        <p className="kn-plan__position">{koreanasha(copy.description)}</p>
        {/*
          One typographic unit — `₩249,000`, not `₩ 249,000` with a thin space and a 12 px label hung off its
          baseline. `formatMoney` without `gap` returns exactly what the locale's own currency pattern says,
          so a market that puts the symbol after the number still gets one unbroken price.
        */}
        <p className="kn-plan__price">
          {/* V20 §2 — `symbolOnly`. The headline is the number; a `US$` prefix told a Korean reader which
              dollar before it told them the price, and `USD 179` (Malay) read as a database column. The
              plan is still priced, charged and recorded in USD; this is the card only. */}
          <strong className="hg-num">{formatMoney(plan.amount_minor, plan.currency, locale, { minor: true, symbolOnly: true })}</strong>
          <span className="kn-plan__once">{t('v15.pricing.perStudent')}</span>
        </p>
        {/* Five lines, and only the five that decide between plans. Not fifteen checkmarks: a card that
            lists everything is a card nobody reads, and the full scope is one disclosure away. */}
        <ul className="kn-plan__list">
          {copy.benefits.map((line) => (
            <li key={line}><Tick /><span>{koreanasha(line)}</span></li>
          ))}
        </ul>
        <a className="kn-plan__cta" href={planAction(plan.slug, authenticated, locale)}>
          <span>{t(`v15.pricing.cta.${plan.slug}`)}</span>
          <ArrowRightIcon />
        </a>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------------------- the comparison */

/**
 * The manifest's rows, in the owner's order, read as three questions (what do you work out with me, what do you
 * actually do for my applications, what happens after I am accepted). The grouping is the manifest's own `group`
 * field — this file says nothing about which row sits where.
 */
function groupedRows(): { key: string; rows: CompareRow[] }[] {
  return COMPARE_GROUPS.map((g) => ({ key: g, rows: COMPARE_ROWS.filter((r) => r.group === g) }));
}

/**
 * One comparison cell — V29: computed by `compareCell` in `@hangyul/types`, the same function the student plan
 * table and the native services screen call. This file only draws it: an em dash for "not included", the
 * section's tick for "included", the text otherwise; a screen reader still hears the word the mark replaces.
 */
const cellText = (t: T, cell: Cell) => t(cell.key, cell.params);

/** The cell's visible form. The word the cell replaces stays in the accessibility tree. */
function CellValue({ cell, t }: { cell: Cell; t: T }) {
  const text = cellText(t, cell);
  if (cell.kind === 'value') return <>{text}</>;
  return (
    <>
      {cell.kind === 'none'
        ? <span className="kn-matrix__dash" aria-hidden>—</span>
        : <Tick className="kn-matrix__tick" />}
      <span className="hg-sr-only">{text}</span>
    </>
  );
}

/**
 * Desktop: a real `<table>`, because a comparison matrix *is* tabular data and a screen reader should be
 * able to say "자기소개서 첨삭, 올인원, 1회". What it is not is a bordered grid — there are no cell rules at
 * all, the row rhythm comes from height, and the only lines are the hairline above each area's label.
 *
 * The recommended column is tinted from the first row to the last with the page's own warm value, so the
 * eye can run down it without the column becoming a highlighted block.
 */
function Matrix({ t }: { t: T }) {
  const groups = groupedRows();
  // Which column the tint sits over, as the manifest's own index — the stylesheet is told, not told twice.
  const hi = Math.max(0, PLANS.findIndex((p) => p.recommended));
  return (
    <div className="kn-matrix__wrap" style={{ '--p-hi': hi } as CSSProperties}>
      <span className="kn-matrix__hi" aria-hidden />
      <table className="kn-matrix">
        <caption className="hg-sr-only">{t('v15.pricing.compare.caption')}</caption>
        <colgroup>
          <col className="kn-matrix__c0" />
          {PLANS.map((p) => <col key={p.code} className="kn-matrix__c" />)}
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{t('v15.pricing.compare.item')}</th>
            {PLANS.map((p) => (
              <th key={p.code} scope="col" data-recommended={p.recommended || undefined}>
                {nameOf(t, p)}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key}>
            <tr className="kn-matrix__grouprow">
              <th scope="colgroup" colSpan={PLANS.length + 1}>{t(`common:v29.pricing.compare.group.${g.key}`)}</th>
            </tr>
            {g.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{t(`common:v29.pricing.compare.row.${row.key}`)}</th>
                {PLANS.map((p) => {
                  const cell = compareCell(row, p);
                  return (
                    <td key={p.code} data-recommended={p.recommended || undefined} data-cell={cell.kind}>
                      <CellValue cell={cell} t={t} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/**
 * Phones: **one plan at a time**, chosen from a real tablist (brief Part 14, option A).
 *
 * The alternative was the desktop matrix in a horizontal scroller, which is what V15 shipped and what the
 * brief rules out by name: four columns inside 390 px is a spreadsheet nobody reads and a scroll region
 * that has to be focusable to be reachable. One column of 구분 → 값, under the same three area headings,
 * answers the same question in one screen.
 *
 * It opens on the recommended plan rather than on Basic, for the same reason the stacked cards do.
 * Keyboard support is the WAI tablist pattern — roving `tabindex`, arrows, Home/End — mirrored in RTL,
 * because an arrow key follows what the reader sees, not the array index.
 */
function MobileMatrix({ t }: { t: T }) {
  const groups = groupedRows();
  const [active, setActive] = useState(() => Math.max(0, PLANS.findIndex((p) => p.recommended)));
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = PLANS.length;
    const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
    const step = e.key === 'ArrowRight' ? (rtl ? -1 : 1) : e.key === 'ArrowLeft' ? (rtl ? 1 : -1) : 0;
    const next = step ? (active + step + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };
  const plan = PLANS[active];
  return (
    <div className="kn-matrix-m">
      <div className="kn-matrix-m__tabs" role="tablist" aria-label={t('v15.pricing.compare.caption')} onKeyDown={move}>
        {PLANS.map((p, i) => (
          <button
            key={p.code}
            ref={(el) => { tabs.current[i] = el; }}
            type="button"
            role="tab"
            id={`plan-compare-tab-${p.slug}`}
            aria-selected={i === active}
            aria-controls="plan-compare-panel"
            tabIndex={i === active ? 0 : -1}
            data-recommended={p.recommended || undefined}
            onClick={() => setActive(i)}
          >
            {nameOf(t, p)}
          </button>
        ))}
      </div>
      <div className="kn-matrix-m__panel" role="tabpanel" id="plan-compare-panel" aria-labelledby={`plan-compare-tab-${plan.slug}`} tabIndex={0}>
        {groups.map((g) => (
          <section key={g.key} className="kn-matrix-m__group">
            <h4>{t(`common:v29.pricing.compare.group.${g.key}`)}</h4>
            <dl>
              {g.rows.map((row) => {
                const cell = compareCell(row, plan);
                return (
                  <div key={row.key} data-cell={cell.kind}>
                    <dt>{t(`common:v29.pricing.compare.row.${row.key}`)}</dt>
                    <dd><CellValue cell={cell} t={t} /></dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * The comparison, still a native `<details>`: keyboard-correct with no JavaScript, open-able by a QA gate,
 * one control rather than a second page, and closed by default so the section's first read is three plans.
 *
 * Two renderings of the same data, swapped by a media query rather than by JavaScript — `display: none`
 * takes the inactive one out of the accessibility tree as well as off the screen, so neither is announced
 * twice and there is no layout to measure before deciding which to build.
 */
function Compare() {
  const { t } = useLocale('marketing');
  // V24 (REPORT §291): still the native disclosure, now drawn as a contained button. `open` only mirrors the
  // element's own state — for the label and for `aria-expanded`, which some screen readers do not derive from
  // `<details>` — so the control keeps working before hydration and without JavaScript.
  const [open, setOpen] = useState(false);
  return (
    <details className="kn-compare" id="plan-compare" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="kn-compare__toggle" aria-expanded={open}>
        <span>{open ? t('v24.pricing.compare.close') : t('v15.pricing.compare.open')}</span>
        <span className="kn-compare__chev" aria-hidden />
      </summary>
      <div className="kn-compare__body">
        <Matrix t={t} />
        <MobileMatrix t={t} />
        {/* The one qualifier the table needs in place: "no round limit" is bounded by the contract (V29 §2). */}
        <p className="kn-matrix__note">{koreanasha(t('common:v29.pricing.compare.scopeNote'))}</p>
      </div>
    </details>
  );
}

/* ----------------------------------------------------------------------------- additional services (V29) */

/**
 * The six optional services as one quiet list, not six cards (brief §16): service · unit · price. A range is shown as
 * a range — it is the operator's pricing bound, never what anyone is charged — and quote-only services say so.
 */
function addOnPrice(t: T, a: AddOnDef, locale: string): string {
  if (a.pricing.kind === 'QUOTE') return t('common:v29.addon.quote');
  const f = (n: number) => formatMoney(n, a.pricing.currency, locale, { minor: true, symbolOnly: true });
  return t('common:v29.addon.range', { min: f(a.pricing.min_minor), max: f(a.pricing.max_minor) });
}

/**
 * 추가 서비스 — V31 (REPORT §422): a service catalogue, not a spreadsheet beside a lonely accordion. Full width, two
 * columns on desktop; each row = what it is · what one unit is · the price, read in that order. Semantics and prices
 * are V29's (`ADD_ONS`); a range is never a charge — the exact amount is offered and approved before payment.
 */
function AddOns() {
  const { t, locale } = useLocale('marketing');
  return (
    <section className="kn-addons" aria-labelledby="addons-title">
      <header className="kn-addons__head">
        <h3 className="kn-addons__title" id="addons-title">{t('common:v29.pricing.addons.title')}</h3>
        <p className="kn-addons__lede">{koreanasha(t('common:v29.pricing.addons.lede'))}</p>
      </header>
      <ul className="kn-addons__grid">
        {ADD_ONS.map((a) => (
          <li key={a.code} className="kn-addons__row" data-addon={a.slug}>
            <span className="kn-addons__name">{t(`common:v29.addon.item.${a.slug}`)}</span>
            <span className="kn-addons__unit">{t(`common:v29.addon.unit.${a.unit}`)}</span>
            <span className="kn-addons__price hg-num" data-pricing={a.pricing.kind}>{addOnPrice(t, a, locale)}</span>
          </li>
        ))}
      </ul>
      <p className="kn-addons__fine">{t('common:v29.addon.premiumMock')} {t('common:v29.addon.pickupNote')}</p>
    </section>
  );
}

/** V31: the eight V29 notes, grouped by what they are about (no new policy; same keys, same words). */
const NOTE_GROUPS: { key: 'payment' | 'costs' | 'scope' | 'visa'; notes: (typeof SERVICE_NOTES)[number][] }[] = [
  { key: 'payment', notes: ['usd', 'exchange'] },
  { key: 'costs', notes: ['external', 'newDocuments'] },
  { key: 'scope', notes: ['documentsVary', 'premiumScope', 'agreement'] },
  { key: 'visa', notes: ['visaDecision'] },
];

/**
 * 이용 전에 확인해 주세요 — V31 (REPORT §422). It used to be a single FAQ-style accordion in an otherwise empty right
 * column. It now closes the pricing story at full width, under the services it qualifies: a summary line that says
 * what is inside, and — opened — four labelled groups in two columns (one column on phones). The same notes are
 * stated again at checkout, before payment.
 */
function ServiceNotes() {
  const { t } = useLocale('marketing');
  return (
    <details className="kn-notes" id="plan-notes">
      <summary className="kn-notes__toggle">
        <span className="kn-notes__heading">
          <span className="kn-notes__title">{t('common:v29.pricing.notes.title')}</span>
          <span className="kn-notes__summary">{t('common:v31.pricing.notes.summary')}</span>
        </span>
        <span className="kn-notes__chev" aria-hidden />
      </summary>
      <div className="kn-notes__groups">
        {NOTE_GROUPS.map((g) => (
          <section key={g.key} className="kn-notes__group" aria-labelledby={`notes-${g.key}`}>
            <h4 id={`notes-${g.key}`} className="kn-notes__gtitle">{t(`common:v31.pricing.notes.group.${g.key}`)}</h4>
            <ul className="kn-notes__list">
              {g.notes.map((k) => <li key={k}>{koreanasha(t(`common:v29.pricing.notes.${k}`))}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}

export function Pricing() {
  const { t } = useLocale('marketing');
  return (
    <Band id="pricing" labelledBy="pricing-title" className="kn-pricing">
      <SectionHead reveal id="pricing-title" title={koreanasha(t('v15.pricing.title'))} lede={koreanasha(t('v15.pricing.lede'))} />
      {/* The shared reveal, with the shared stagger. The plans arrive in the order they are read — which on
          a phone is not DOM order, so the delays are swapped there in CSS rather than here. */}
      <Reveal variant="stagger" className="kn-plans">
        {PLANS.map((p) => <PlanCard key={p.code} plan={p} />)}
      </Reveal>
      <Reveal variant="rise" className="kn-compare-wrap">
        <Compare />
      </Reveal>
      <div className="kn-pricing__more">
        <AddOns />
        <ServiceNotes />
      </div>
    </Band>
  );
}
