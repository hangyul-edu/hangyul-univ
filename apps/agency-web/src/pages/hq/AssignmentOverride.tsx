import { useAuth } from '@hangyul/auth';
import { Shuffle } from '@hangyul/icons';
import { Badge, Button, Callout, Card, EmptyState, Field, PageHeader, QueryState, Textarea, useToast } from '@hangyul/ui';
import { cx, formatDate } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Person, StudentPicker, useT } from '../../components/bits';
import { usePerms } from '../../lib/hooks';

export default function AssignmentOverride() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const perms = usePerms();
  const qc = useQueryClient();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [student, setStudent] = useState<{ id: string; full_name: string } | null>(sp.get('student') ? { id: sp.get('student')!, full_name: sp.get('name') ?? '' } : null);
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const pick = (v: { id: string; full_name: string } | null) => {
    setStudent(v); setTarget(null); setReason(''); setTouched(false);
    setSp(v ? { student: v.id, name: v.full_name } : {}, { replace: true });
  };
  // V8: start from the students who most likely need a new agency or counselor — first reply late, or no counselor yet.
  const late = useQuery({ queryKey: ['agency', 'students', { sla_breached: true, page_size: 10 }], queryFn: () => api.agency.students({ sla_breached: true, page_size: 10 }), enabled: !student });
  const unassigned = useQuery({ queryKey: ['agency', 'students', { view: 'unassigned', page_size: 10 }], queryFn: () => api.agency.students({ view: 'unassigned', page_size: 10 }), enabled: !student });
  const suggestions = [
    ...(late.data?.items ?? []).map((s) => ({ s, why: t('v8.override.whyLate', { org: s.counselor?.full_name ?? t('misc.unassigned') }) })),
    ...(unassigned.data?.items ?? []).map((s) => ({ s, why: t('v8.override.whyUnassigned') })),
  ].filter((x, i, all) => all.findIndex((y) => y.s.id === x.s.id) === i);
  const ws = useQuery({ queryKey: ['agency', 'student', student?.id], queryFn: () => api.agency.student(student!.id), enabled: !!student });
  const cands = useQuery({ queryKey: ['agency', 'candidates', student?.id], queryFn: () => api.agency.assignmentCandidates(student!.id), enabled: !!student });
  const current = ws.data?.assignment;
  const reasonErr = reason.trim().length < 3 ? t('override.reasonRequired') : null;
  const m = useMutation({
    mutationFn: () => api.agency.overrideAssignment({ student_id: student!.id, organization_id: target!, reason: reason.trim() }),
    onSuccess: () => {
      toast.success(t('override.done'));
      qc.invalidateQueries({ queryKey: ['agency'] });
      setTarget(null); setReason(''); setTouched(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!perms.ops) return <div className="ag-page"><PageHeader title={t('sidebar.override')} /><Callout tone="warning">{t('override.forbidden')}</Callout></div>;

  return (
    <div className="hg-stack ag-page">
      <PageHeader title={t('sidebar.override')} subtitle={t('override.sub')} />
      <div className="ag-grid-1-2">
        <Card pad className="hg-stack">
          {!student && (
            <section aria-labelledby="ov-sugg" className="ag8-sugg">
              <h2 id="ov-sugg" className="ag-h3">{t('v8.override.suggest')}</h2>
              {late.isLoading || unassigned.isLoading ? null : suggestions.length === 0 ? <p className="hg-subtle hg-small mb-0">{t('v8.override.none')}</p> : (
                <ul className="list-unstyled mb-0">
                  {suggestions.map(({ s, why }) => (
                    <li key={s.id}><button type="button" className="hg-menu-item" onClick={() => pick({ id: s.id, full_name: s.full_name })}>
                      <span className="hg-grow hg-truncate">{s.full_name}<span className="hg-subtle hg-xs" style={{ display: 'block' }}>{why}</span></span>
                    </button></li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <Field label={t('v8.override.orSearch')}><StudentPicker value={student} onChange={pick} label={t('misc.student')} /></Field>
          {student && (
            <QueryState query={ws}>
              {(w) => (
                <div className="hg-stack" style={{ '--hg-gap': '8px' } as React.CSSProperties}>
                  <h2 className="ag-h3">{t('override.current')}</h2>
                  {current ? (
                    <>
                      <div className="hg-strong hg-small">{current.organization}</div>
                      <Person name={current.counselor?.full_name} size={22} />
                      <div className="hg-subtle hg-xs">{t('override.since', { date: formatDate(current.since, locale), by: t(`ws.by.${current.assigned_by}`, { defaultValue: current.assigned_by }) })}</div>
                    </>
                  ) : <p className="hg-subtle hg-small">{t('ws.notAssigned')}</p>}
                  <Link to={`/students/${w.student.id}`} className="hg-small">{t('override.openWorkspace')}</Link>
                </div>
              )}
            </QueryState>
          )}
        </Card>
        <Card pad className="hg-stack">
          {!student ? <EmptyState icon={<Shuffle />} title={t('override.pickStudent')} text={t('override.pickText')} /> : (
            <QueryState query={cands} isEmpty={(d) => d.length === 0} empty={<EmptyState compact title={t('override.noCandidates')} />}>
              {(list) => (
                <>
                  <div>
                    <h2 className="ag-h3">{t('override.candidates')}</h2>
                    <p className="hg-subtle hg-xs">{t('override.explain')}</p>
                  </div>
                  <ul className="ag-cands" role="radiogroup" aria-label={t('override.candidates')}>
                    {list.map((c, i) => {
                      const isCurrent = current?.organization_id === c.organization_id;
                      return (
                        <li key={c.organization_id}>
                          <button type="button" role="radio" aria-checked={target === c.organization_id} disabled={isCurrent}
                            className={cx('ag-cand', target === c.organization_id && 'is-selected')} onClick={() => setTarget(c.organization_id)}>
                            <div className="hg-row hg-between">
                              <span className="hg-row" style={{ gap: 6 }}>
                                <span className="ag-rank">{i + 1}</span>
                                <strong className="hg-small">{c.name}</strong>
                                {isCurrent && <Badge size="sm" tone="info">{t('override.currentBadge')}</Badge>}
                                {c.at_capacity && <Badge size="sm" tone="danger">{t('agencies.full')}</Badge>}
                              </span>
                              <span className="hg-num hg-strong">{Math.round(c.score)}</span>
                            </div>
                            <ul className="ag-factors ag-factors--inline">
                              {c.breakdown.map((f) => (
                                <li key={f.factor} title={f.note}>
                                  <span className="hg-xs">{t(`ws.factor.${f.factor}`, { defaultValue: f.factor })} <span className="hg-num hg-subtle">{f.points}/{f.weight}</span></span>
                                  <div className="hg-progress hg-progress--sm"><div className="hg-progress__bar" style={{ width: `${(f.points / Math.max(1, f.weight)) * 100}%` }} /></div>
                                </li>
                              ))}
                            </ul>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {target && (
                    <div className="hg-stack" style={{ '--hg-gap': '10px' } as React.CSSProperties}>
                      {list.find((c) => c.organization_id === target)?.at_capacity && <Callout tone="warning">{t('override.capacityWarn')}</Callout>}
                      <Field label={t('override.reason')} htmlFor="ov-reason" hint={t('override.reasonHint')} error={touched && reasonErr ? reasonErr : undefined}>
                        <Textarea id="ov-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} invalid={touched && !!reasonErr} />
                      </Field>
                      <div><Button variant="primary" icon={<Shuffle />} loading={m.isPending} onClick={() => { setTouched(true); if (!reasonErr) m.mutate(); }}>{t('override.confirm')}</Button></div>
                      <p className="hg-subtle hg-xs">{t('override.audited')}</p>
                    </div>
                  )}
                </>
              )}
            </QueryState>
          )}
        </Card>
      </div>
    </div>
  );
}
