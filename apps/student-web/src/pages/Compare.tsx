import { localName } from '@hangyul/i18n';
import type { CompareRow } from '@hangyul/api-client';
import { useApi } from '@hangyul/auth';
import { Check, Columns3, Minus, X } from '@hangyul/icons';
import { Button, ButtonLink, EmptyState, FreshnessBadge, QueryState, SkeletonCard } from '@hangyul/ui';
import { formatDate, formatMoney } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { DaysLeft, Krw, PageIntro, TierLabel, sortReasons } from '../components/bits';
import { gapOf } from '../components/ProgramRow';
import { FirstYearAmount, useFirstYearText } from '../lib/cost';
import { useMyMatches, useSaved } from '../lib/queries';
import { useCompare } from '../lib/compare';
import { range, useBudget } from '../lib/budget';
import { intakeLabel, useT } from '../lib/i18n';
import { BudgetSection } from './Budget';

function YesNo({ v }: { v: boolean }) {
  const { t } = useT();
  return v ? <span className="st-yes"><Check aria-hidden />{t('compare.yes')}</span> : <span className="st-no"><Minus aria-hidden />{t('compare.no')}</span>;
}

export default function Compare() {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigate();
  const firstYear = useFirstYearText();
  const cmp = useCompare();
  const [sp] = useSearchParams();
  const saved = useSaved();
  const matches = useMyMatches();
  // A saved university without a remembered program compares the student's best-ranked program there.
  const bestAt = (uid: string) => matches.data?.items.find((m) => m.program.university_id === uid)?.program_id;
  const savedIds = (saved.data ?? []).map((u) => u.program_id ?? bestAt(u.id)).filter((x): x is string => !!x);
  const chosen = (sp.get('ids') ?? cmp.items.map((i) => i.id).join(',')).split(',').filter(Boolean).slice(0, 4);
  // V4: an empty compare set with ≥2 saved programs compares the saved ones — no trips back to the list.
  const fromSaved = chosen.length < 2 && savedIds.length >= 2;
  const ids = fromSaved ? savedIds.slice(0, 4) : chosen;
  const q = useQuery({ queryKey: ['compare', ids], queryFn: () => api.catalog.compare(ids), enabled: ids.length >= 2 });
  const budget = useBudget(ids.length >= 2 ? ids : undefined);
  const budgetOf = (id: string) => budget.data?.items.find((b) => b.program_id === id);
  const schMax = (id: string) => Math.max(0, ...(budgetOf(id)?.scholarships ?? []).map((x) => x.amount_max ?? 0));

  const removeCol = (id: string) => {
    cmp.remove(id);
    const next = ids.filter((x) => x !== id);
    nav(next.length ? `/compare?ids=${next.join(',')}` : '/compare', { replace: true });
  };

  if (ids.length < 2 && (saved.isLoading || matches.isLoading)) return <div className="st-page"><SkeletonCard lines={8} /></div>;
  if (ids.length < 2) {
    return (
      <div className="st-page">
        <PageIntro title={t('compare.title')} subtitle={t('compare.subtitle')} />
        <EmptyState icon={<Columns3 />} title={t('compare.needTwo')} text={t('compare.needTwoText')}
          action={<ButtonLink as={Link} to="/explore" variant="primary">{t('compare.explore')}</ButtonLink>} />
        {/* V22 (REPORT §248 S4): the budget lives here now; with nothing to compare it costs the shortlist. */}
        <BudgetSection ids={chosen} />
      </div>
    );
  }

  const langOf = (r: CompareRow) => [
    r.program.requirements?.min_topik_level ? t('explore.card.topik', { level: r.program.requirements.min_topik_level }) : null,
    r.program.requirements?.min_ielts ? `IELTS ${r.program.requirements.min_ielts}` : null,
    r.program.requirements?.min_toefl_ibt ? `TOEFL ${r.program.requirements.min_toefl_ibt}` : null,
  ].filter(Boolean).join(' / ') || t('discover.noLanguageMin');
  type Row = { key: string; label: string; cell: (r: CompareRow) => ReactNode; value?: (r: CompareRow) => number | string | null; best?: 'min' | 'max' };
  const rows: Row[] = [
    { key: 'fit', label: t('compare.row.fit'), value: (r) => r.match?.tier ?? null,
      cell: (r) => r.match ? <TierLabel tier={r.match.tier} /> : <span className="hg-subtle">{t('compare.noProfile')}</span> },
    { key: 'year', label: t('v4.cost.firstYear'), value: (r) => r.first_year_range_krw?.low ?? null, best: 'min',
      cell: (r) => <><strong><FirstYearAmount value={r.first_year_range_krw} /></strong><div className="hg-subtle hg-xs">{t('v4.compare.tuitionYear', { amount: r.first_year_range_krw?.tuition_year ? formatMoney(r.first_year_range_krw.tuition_year, 'KRW', locale, { compact: true }) : '—' })}</div></> },
    { key: 'scholarship', label: t('v4.compare.scholarship'), value: (r) => schMax(r.program.id) || null, best: 'max',
      cell: (r) => schMax(r.program.id) > 0 ? <>{t('compareV3.upTo', { amount: range(schMax(r.program.id), null, 'KRW', undefined, locale) })}<div className="hg-subtle hg-xs">{t('v4.compare.scholarshipHint')}</div></> : <span className="hg-subtle">{t('compare.none')}</span> },
    { key: 'missing', label: t('v4.compare.missing'), value: (r) => (r.match ? r.match.reasons.filter((x) => x.kind === 'missing').length : null),
      cell: (r) => { if (!r.match) return <span className="hg-subtle">{t('compare.noProfile')}</span>; const g = gapOf(t, sortReasons(r.match.reasons)); return g ? <>{g.gap}{g.unlock && <div className="hg-subtle hg-xs">{g.unlock}</div>}</> : <span className="st-yes"><Check aria-hidden />{t('v4.compare.nothingMissing')}</span>; } },
    { key: 'language', label: t('discover.language'), value: (r) => r.program.requirements?.min_topik_level ?? null, best: 'min', cell: (r) => <>{langOf(r)}<div className="hg-subtle hg-xs">{t(`common:instruction.${r.program.instruction_language}`)}</div></> },
    { key: 'deadline', label: t('compare.row.deadline'), value: (r) => r.next_intake?.application_deadline ?? null, best: 'min',
      cell: (r) => r.next_intake ? <><span className="hg-num">{formatDate(r.next_intake.application_deadline, locale)}</span><div className="hg-xs">{intakeLabel(t, r.next_intake.term, r.next_intake.year)} · <DaysLeft date={r.next_intake.application_deadline} /></div></> : <span className="hg-subtle">{t('explore.card.noIntake')}</span> },
    { key: 'dorm', label: t('compare.row.dorm'), value: (r) => (r.dormitory ? 1 : 0), cell: (r) => <YesNo v={r.dormitory} /> },
    { key: 'docs', label: t('compare.row.docs'), value: (r) => `${r.document_count}/${r.legalization_documents}`,
      cell: (r) => <>{t('compare.docCount', { count: r.document_count })}{r.legalization_documents > 0 && <div className="hg-xs" style={{ color: 'var(--hg-status-warning-fg)' }}>{t('compare.legalCount', { count: r.legalization_documents })}</div>}</> },
    { key: 'location', label: t('compare.row.location'), value: (r) => r.program.university?.city ?? null, cell: (r) => r.program.university?.city ?? '—' },
    { key: 'fee', label: t('compare.row.fee'), value: (r) => r.program.application_fee_krw, best: 'min', cell: (r) => <Krw value={r.program.application_fee_krw} /> },
    { key: 'partner', label: t('compare.row.partner'), value: (r) => (r.partner ? 1 : 0), cell: (r) => r.partner ? <span>{t('explore.partner')}</span> : <YesNo v={false} /> },
    { key: 'source', label: t('compare.row.source'), cell: (r) => <FreshnessBadge data={r.program} compact /> },
  ];
  const bestIds = (row: Row, data: CompareRow[]): Set<string> => {
    if (!row.best || !row.value) return new Set();
    const vals = data.map((r) => ({ id: r.program.id, v: row.value!(r) })).filter((x) => x.v !== null && x.v !== undefined);
    if (vals.length < 2) return new Set();
    const sorted = [...vals].sort((x, y) => (x.v! < y.v! ? -1 : x.v! > y.v! ? 1 : 0));
    const target = row.best === 'min' ? sorted[0].v : sorted[sorted.length - 1].v;
    if (vals.every((x) => x.v === target)) return new Set();
    return new Set(vals.filter((x) => x.v === target).map((x) => x.id));
  };
  const same = (row: Row, data: CompareRow[]) => !!row.value && data.every((r) => row.value!(r) === row.value!(data[0]));

  return (
    <div className="st-page">
      <PageIntro title={t('compare.title')} subtitle={t('v4.compare.subtitle')} />
      {fromSaved && <p className="hg-small hg-muted">{t('v4.compare.fromSaved', { count: ids.length })}</p>}
      <QueryState query={q} skeleton={<SkeletonCard lines={8} />}>
        {(data) => {
          const name = (r: CompareRow) => r.program.university?.name_en ?? localName(r.program);
          const pick = (key: string) => { const row = rows.find((x) => x.key === key)!; const ids = bestIds(row, data); return data.filter((r) => ids.has(r.program.id)); };
          const academic = (r: CompareRow) => r.match?.factors.find((f) => f.factor === 'academic')?.points ?? r.match?.score ?? 0;
          const bestFit = [...data].filter((r) => r.match?.eligible).sort((x, y) => academic(y) - academic(x))[0];
          const dorms = data.filter((r) => r.dormitory);
          const summary = [
            bestFit && data.filter((r) => r.match?.eligible && academic(r) === academic(bestFit)).length < data.length && { k: 'fit', label: t('v4.compare.bestAcademic'), who: name(bestFit), what: t(`verdict.${bestFit.match!.tier}`) },
            pick('year')[0] && { k: 'cost', label: t('v4.compare.lowestCost'), who: pick('year').map(name).join(', '), what: firstYear(pick('year')[0].first_year_range_krw) },
            pick('deadline')[0] && { k: 'deadline', label: t('compareV3.closest'), who: pick('deadline').map(name).join(', '), what: formatDate(pick('deadline')[0].next_intake!.application_deadline, locale) },
            pick('scholarship')[0] && { k: 'schol', label: t('compareV3.bestScholarship'), who: pick('scholarship').map(name).join(', '), what: t('compareV3.upTo', { amount: range(schMax(pick('scholarship')[0].program.id), null, 'KRW', undefined, locale) }) },
            pick('language')[0] && { k: 'lang', label: t('compareV3.lowestLanguage'), who: pick('language').map(name).join(', '), what: langOf(pick('language')[0]) },
            dorms.length > 0 && dorms.length < data.length && { k: 'dorm', label: t('v4.compare.dorm'), who: dorms.map(name).join(', '), what: t('v4.compare.dormText') },
          ].filter(Boolean) as { k: string; label: string; who: string; what: string }[];
          return (
            <>
              {summary.length > 0 && (
                <dl className="sc-summary">
                  {summary.map((x) => (
                    <div key={x.k}><dt>{x.label}</dt><dd><strong>{x.who}</strong><span>{x.what}</span></dd></div>
                  ))}
                </dl>
              )}
              <div className="st-compare sc-table" role="region" aria-label={t('compare.title')} tabIndex={0}>
                <table className="st-compare__table">
                  <thead>
                    <tr>
                      <th scope="col" className="st-compare__corner"><span className="hg-sr-only">{t('compare.criteria')}</span></th>
                      {data.map((r) => (
                        <th key={r.program.id} scope="col">
                          <div className="st-compare__colhead">
                            <div style={{ minWidth: 0 }}>
                              <Link to={`/universities/${r.program.university?.slug}?program=${r.program.id}`} className="hg-link hg-strong">{r.program.university?.name_en}</Link>
                              <div className="hg-muted hg-xs" style={{ fontWeight: 400 }}>{localName(r.program)}</div>
                            </div>
                            <Button variant="ghost" size="sm" iconOnly icon={<X />} aria-label={t('compare.remove', { name: r.program.university?.name_en })} onClick={() => removeCol(r.program.id)} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* V8: differences first on every width; identical rows sink to the end, still visible. */}
                    {[...rows.filter((row) => row.value && !same(row, data)), ...rows.filter((row) => row.value && same(row, data)), ...rows.filter((row) => !row.value)].map((row) => {
                      const best = bestIds(row, data);
                      const isSame = same(row, data);
                      return (
                        <tr key={row.key} data-same={isSame || undefined}>
                          <th scope="row">{row.label}{isSame && <span className="sc-same">{t('compare.same')}</span>}</th>
                          {data.map((r) => (
                            <td key={r.program.id} data-best={best.has(r.program.id) || undefined}>
                              {row.cell(r)}
                              {best.has(r.program.id) && <span className="sc-best">{t(`compare.bestTag.${row.key}`, { defaultValue: t('compare.bestTag.default') })}</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row"><span className="hg-sr-only">{t('v8.compare.next')}</span></th>
                      {data.map((r) => (
                        <td key={r.program.id}><Link to={`/universities/${r.program.university?.slug}?program=${r.program.id}`} className="hg-link-arrow">{t('v8.compare.open')}</Link></td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Under ~900px: one block per program, differences first; identical rows are listed once below. */}
              <div className="sc-cards">
                {data.map((r) => (
                  <section key={r.program.id} className="sc-card" aria-label={r.program.university?.name_en}>
                    <header className="sc-card__head">
                      <div style={{ minWidth: 0 }}>
                        <Link to={`/universities/${r.program.university?.slug}?program=${r.program.id}`} className="hg-link hg-strong">{r.program.university?.name_en}</Link>
                        <div className="hg-muted hg-xs">{localName(r.program)}</div>
                      </div>
                      <Button variant="ghost" size="sm" iconOnly icon={<X />} aria-label={t('compare.remove', { name: r.program.university?.name_en })} onClick={() => removeCol(r.program.id)} />
                    </header>
                    <dl className="sc-card__rows">
                      {rows.filter((row) => !same(row, data)).map((row) => {
                        const best = bestIds(row, data).has(r.program.id);
                        return (
                          <div key={row.key} data-best={best || undefined}>
                            <dt>{row.label}</dt>
                            <dd>{row.cell(r)}{best && <span className="sc-best">{t(`compare.bestTag.${row.key}`, { defaultValue: t('compare.bestTag.default') })}</span>}</dd>
                          </div>
                        );
                      })}
                    </dl>
                    <Link to={`/universities/${r.program.university?.slug}?program=${r.program.id}`} className="hg-link-arrow">{t('v8.compare.open')}</Link>
                  </section>
                ))}
                {rows.some((row) => same(row, data)) && (
                  <section className="sc-card sc-card--same">
                    {/* V10: h2 — this is a top-level section under the page's h1 (the per-programme cards
                        beside it are named by aria-label and carry no heading), so h3 skipped a level. */}
                    <h2 className="hg-small hg-strong">{t('compare.same')}</h2>
                    <dl className="sc-card__rows">
                      {rows.filter((row) => same(row, data)).map((row) => (
                        <div key={row.key}><dt>{row.label}</dt><dd>{row.cell(data[0])}</dd></div>
                      ))}
                    </dl>
                  </section>
                )}
              </div>
              {/* V8: the decision continues somewhere — never a winner, but always a next step. */}
              <div className="sc-next">
                <ButtonLink href="#budget" variant="primary">{t('v8.compare.budget', { count: data.length })}</ButtonLink>
                <span className="hg-small hg-muted">{t('v8.compare.noWinner')}</span>
              </div>
              <BudgetSection ids={ids} />
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
