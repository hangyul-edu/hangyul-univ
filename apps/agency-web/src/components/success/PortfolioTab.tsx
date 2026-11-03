import { localName } from '@hangyul/i18n';
import { useAuth } from '@hangyul/auth';
import type { PortfolioDecision } from '@hangyul/types';
import { Button, Field, QueryState, Select, Skeleton, StatusText, Textarea, useToast } from '@hangyul/ui';
import { formatDate, formatMoney } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { itemParams } from '../../lib/success';
import { useS } from './SuccessPanel';

const DECISIONS: PortfolioDecision[] = ['BALANCED', 'ADD_OPTION', 'DROP_OPTION', 'SPREAD_DEADLINES', 'BUDGET_TALK', 'DISCUSS'];

/** Student workspace → Portfolio: the six counselor questions, the set of programs, and a recorded review. */
export function PortfolioTab({ studentId }: { studentId: string }) {
  const { t, locale } = useS();
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const ids = { decision: useId(), note: useId() };
  const q = useQuery({ queryKey: ['agency', 'portfolio', studentId], queryFn: () => api.success.studentPortfolio(studentId) });
  const [decision, setDecision] = useState<PortfolioDecision>('BALANCED');
  const [note, setNote] = useState('');
  const m = useMutation({
    mutationFn: () => api.success.reviewPortfolio(studentId, { decision, note: note.trim() || undefined }),
    onSuccess: (d) => { qc.setQueryData(['agency', 'portfolio', studentId], d); setNote(''); toast.success(t('success:agency.reviewSaved')); },
    onError: (e) => toast.error((e as Error).message),
  });
  const money = (v: number | null) => (v === null ? '—' : formatMoney(v, 'KRW', locale, { compact: true }));
  return (
    <QueryState query={q} skeleton={<Skeleton h={240} />}>
      {(p) => {
        const obsFor = (codes: string[]) => p.observations.filter((o) => codes.includes(o.code));
        const QMAP: Record<string, string[]> = {
          too_few: ['FEW_OPTIONS', 'NO_APPLICATIONS'], too_difficult: ['ALL_NOT_YET', 'ALL_POSSIBLE'], unnecessary: ['SOME_NOT_YET', 'MANY_APPLICATIONS'],
          deadlines: ['SAME_DAY_DEADLINES', 'DEADLINES_CONCENTRATED'], budget: ['ALL_OVER_BUDGET', 'SOME_OVER_BUDGET', 'NO_BUDGET'],
          realistic_option: ['FEW_OPTIONS', 'ALL_NOT_YET', 'ALL_POSSIBLE', 'SAVED_STRONG_OPTION'],
        };
        const obsText = (o: (typeof p.observations)[number]) => t(`success:obs.${o.code}`, {
          ...itemParams(t, locale, o.params), universities: Array.isArray(o.params.universities) ? (o.params.universities as string[]).join(', ') : undefined, defaultValue: o.text,
        });
        return (
          <div className="hg-stack sxa-portfolio">
            <p className="hg-small hg-muted">{t('success:agency.portfolioSub')}</p>
            <ul className="sxa-q">
              {p.questions.map((qq) => (
                <li key={qq.key} data-flag={qq.flag}>
                  <span className="sxa-q__q">{t(`success:agency.questions.${qq.key}`)}</span>
                  <span className="sxa-q__a">{qq.flag ? <StatusText tone="warning">{t('success:agency.yes')}</StatusText> : <span className="hg-subtle">{t('success:agency.no')}</span>}</span>
                  {qq.flag && <span className="sxa-q__why">{obsFor(QMAP[qq.key]).map(obsText).join(' ')}</span>}
                </li>
              ))}
            </ul>
            {p.observations.filter((o) => !Object.values(QMAP).flat().includes(o.code)).map((o) => <p key={o.code} className="hg-small">{obsText(o)}</p>)}

            <section className="ag-subsection">
              <h3 className="ag-h3">{t('success:agency.entries')}</h3>
              {p.entries.length === 0 ? <p className="hg-small hg-subtle">{t('success:agency.noEntries')}</p> : <div className="sxa-table-wrap">
                <table className="sxa-table">
                  <thead><tr><th scope="col">{t('success:agency.colProgram')}</th><th scope="col">{t('success:agency.colFit')}</th><th scope="col">{t('success:agency.colDeadline')}</th><th scope="col">{t('success:agency.colCost')}</th></tr></thead>
                  <tbody>
                    {p.entries.map((e) => (
                      <tr key={`${e.source}-${e.program.id}`}>
                        <td><span className="hg-strong">{localName(e.university)}</span> <span className="hg-subtle">· {localName(e.program)}{e.source === 'saved' ? ` · ${t('success:agency.saved')}` : ''}</span></td>
                        <td><StatusText tone={e.group === 'strong' ? 'success' : e.group === 'possible' ? 'info' : e.group === 'sent' ? 'neutral' : 'warning'}>{t(`success:group.${e.group}`)}</StatusText></td>
                        <td className="hg-num">{e.deadline && e.group !== 'sent' ? formatDate(e.deadline, locale) : '—'}</td>
                        <td className="hg-num">{e.first_year.low !== null ? `${money(e.first_year.low)}–${money(e.first_year.high)}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
              {p.budget.low !== null && <p className="hg-xs hg-subtle">{t('success:agency.budgetLine', { low: money(p.budget.low), high: money(p.budget.high), budget: money(p.budget.budget), over: p.budget.over_budget })}</p>}
            </section>

            <section className="ag-subsection">
              <h3 className="ag-h3">{t('success:agency.review')}</h3>
              {p.review ? (
                <p className="hg-small">
                  {t('success:agency.lastReview', { decision: t(`success:agency.decision.${p.review.decision}`), name: p.review.reviewed_by?.full_name ?? '—', date: formatDate(p.review.reviewed_at, locale) })}
                  {p.review.note && <span className="sxa-quote">{p.review.note}</span>}
                  {p.review.stale && <span className="sxa-warn hg-xs"> {t('success:agency.stale')}</span>}
                </p>
              ) : <p className="hg-small hg-subtle">{t('success:agency.noReview')}</p>}
              {(
                <form className="sxa-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
                  <Field label={t('success:agency.decisionLabel')} htmlFor={ids.decision}>
                    <Select id={ids.decision} value={decision} onChange={(e) => setDecision(e.target.value as PortfolioDecision)}>
                      {DECISIONS.map((d) => <option key={d} value={d}>{t(`success:agency.decision.${d}`)}</option>)}
                    </Select>
                  </Field>
                  <Field label={t('success:agency.reviewNote')} htmlFor={ids.note} optional>
                    <Textarea id={ids.note} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
                  </Field>
                  <Button type="submit" size="sm" variant="primary" loading={m.isPending}>{t('success:agency.saveReview')}</Button>
                </form>
              )}
            </section>
          </div>
        );
      }}
    </QueryState>
  );
}
