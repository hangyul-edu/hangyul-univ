import { useAuth } from '@hangyul/auth';
import { Download, ShieldCheck } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { DEGREE_LEVELS, type CohortStudent, type ExportPresetKey, type ExportPresets } from '@hangyul/types';
import { Button, Checkbox, ErrorState, Field, Input, Modal, Select, SkeletonCard, StatusText, useToast } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import { downloadBlob, formatDateTime } from '@hangyul/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { NoAccess } from '../components/common';
import { Panel } from '../components/Panel';
import { downloadApplicationsCsv } from '../lib/exports';
import { downloadCsv, intakeText, todayStamp } from '../lib/format';
import { useFilterOptions } from '../components/FilterBar';
import { latestTerm } from '../lib/metrics';
import { useAnalytics, useCohorts, useExportHistory, useExportPresets } from '../lib/queries';
import { useUniversity } from '../lib/university';

export function cohortStudentRows(data: CohortStudent[]) {
  return data.map((s) => {
    const l = latestTerm(s);
    return {
      cohort: s.cohort, student: s.student, nationality: s.nationality ?? '', program: s.program ?? '', agency: s.agency ?? '', status: s.status,
      enrolled_on: s.enrolled_on, expected_graduation: s.expected_graduation ?? '', visa_expires_on: s.visa_expires_on ?? '',
      terms_recorded: s.terms.length, last_term: l?.term ?? '', last_gpa_percent: l?.gpa_percent ?? '', last_attendance_percent: l?.attendance_percent ?? '',
      // V23 §273 U8: readable values in a file a university keeps; no internal demo flag, no raw enum.
      last_data_source: l?.data_source ? l.data_source.toLowerCase().replace(/_/g, ' ') : '',
      risk_flags: s.risk?.flags.map((f) => f.toLowerCase().replace(/_/g, ' ')).join('; ') ?? '',
    };
  });
}

type ReportRow = { key: string; title: string; body: string; personal: boolean; server: boolean; actions: ReactNode };
type Last = { at: string; rows: number; by: string | null } | null;

/** Column keys → readable names (shared by presets and saved configurations). */
function useColumnName() {
  const { t } = useLocale('university');
  return (c: string) => t(`university:v8.ex.col.${c}`, { defaultValue: c });
}

function LastRun({ last }: { last: Last }) {
  const { t, locale } = useLocale(['university', 'common']);
  if (!last) return <span className="uc-sub">{t('university:v8.ex.neverRun')}</span>;
  return <span className="uc-sub">{t('university:v8.ex.lastRun', { date: formatDateTime(last.at, locale), count: last.rows, by: last.by ?? '—' })}</span>;
}

const FILTER_FIELDS = ['intake', 'degree', 'program_id', 'agency_id'] as const;

function SaveConfigModal({ base, data, onClose }: { base: ExportPresetKey; data: ExportPresets; onClose: () => void }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { scopeId } = useUniversity();
  const colName = useColumnName();
  const o = useFilterOptions();
  const preset = data.presets.find((p) => p.key === base)!;
  const all = base === 'enrolment' ? preset.columns : [...new Set([...preset.columns, ...data.available_columns])];
  const [name, setName] = useState('');
  const [cols, setCols] = useState<string[]>(preset.columns);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => api.university.saveExportPreset({ name: name.trim(), base, columns: cols, filters }, scopeId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['university', 'export-presets'] }); toast.success(t('university:v8.ex.saved')); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const submit = () => (name.trim().length < 2 ? setErr('validation.required') : cols.length === 0 ? setErr('university:v8.ex.pickColumns') : m.mutate());
  const set = (k: string, v: string) => setFilters((f) => { const n = { ...f }; if (v) n[k] = v; else delete n[k]; return n; });
  return (
    <Modal open onClose={onClose} title={t('university:v8.ex.saveTitle', { preset: t(`university:v8.ex.preset.${base}.title`) })}
      footer={<><Button onClick={onClose}>{t('common:actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={submit}>{t('common:actions.save')}</Button></>}>
      <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <Field label={t('university:v8.ex.name')} htmlFor="ex-name" error={err === 'validation.required' ? err : undefined}>
          <Input id="ex-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('university:v8.ex.namePlaceholder')} />
        </Field>
        <fieldset className="uv8-colpick">
          <legend className="hg-label">{t('university:v8.ex.columns')}</legend>
          {err === 'university:v8.ex.pickColumns' && <p className="text-danger fs-12 mb-1" role="alert">{t('university:v8.ex.pickColumns')}</p>}
          <div className="uv8-colpick__grid">
            {all.map((c) => <Checkbox key={c} label={colName(c)} checked={cols.includes(c)} onChange={(e) => setCols(e.target.checked ? [...cols, c] : cols.filter((x) => x !== c))} />)}
          </div>
        </fieldset>
        {base !== 'enrolment' && (
          <div className="uc-two">
            {FILTER_FIELDS.map((k) => (
              <Field key={k} label={t(`university:v8.chip.key.${k}`)} htmlFor={`ex-f-${k}`} optional>
                <Select id={`ex-f-${k}`} value={filters[k] ?? ''} onChange={(e) => set(k, e.target.value)}>
                  <option value="">{t('university:filters.all')}</option>
                  {k === 'intake' && o.intakes.map((x) => <option key={x} value={x}>{intakeText(x, t)}</option>)}
                  {k === 'degree' && DEGREE_LEVELS.map((d) => <option key={d} value={d}>{t(`common:degreeShort.${d}`)}</option>)}
                  {k === 'program_id' && o.programs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  {k === 'agency_id' && o.agencies.map((x) => <option key={x.id} value={x.id}>{x.name ?? '—'}</option>)}
                </Select>
              </Field>
            ))}
          </div>
        )}
        <p className="uc-note">{t('university:v8.ex.saveNote')}</p>
      </form>
    </Modal>
  );
}

/** V8: export jobs as presets — what each contains, whether it holds personal data, when it last ran; saved configurations; scheduling shown, disabled. */
function ExportJobs() {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { scopeId, overview } = useUniversity();
  const q = useExportPresets();
  const colName = useColumnName();
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState<ExportPresetKey | null>(null);
  const del = useMutation({
    mutationFn: (id: string) => api.university.deleteExportPreset(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['university', 'export-presets'] }); toast.success(t('university:v8.ex.deleted')); },
    onError: (e) => toast.error((e as Error).message),
  });
  const runJob = async (key: string, kind: ExportPresetKey, query: Record<string, string | undefined> = {}) => {
    setBusy(key);
    try {
      const res = await api.university.runExportPreset(kind, { university_id: scopeId, ...query });
      downloadBlob(await res.blob(), `${overview?.slug ?? 'university'}-${kind}-${todayStamp()}.csv`);
      toast.success(t('university:exports.done'));
      qc.invalidateQueries({ queryKey: ['university', 'export-presets'] });
      qc.invalidateQueries({ queryKey: ['university', 'exports'] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  if (q.isLoading) return <SkeletonCard lines={6} />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <>
      <section className="uv8-jobs" aria-labelledby="jobs-h">
        <h2 id="jobs-h" className="uv7-sechead__title">{t('university:v8.ex.jobsTitle')}</h2>
        <ul className="uv8-jobs__list">
          {d.presets.map((p) => (
            <li key={p.key} className="card custom-card uv8-job">
              <div className="card-body">
                <div className="uv8-job__head">
                  <h3 className="uv8-job__title">{t(`university:v8.ex.preset.${p.key}.title`)}</h3>
                  {p.personal_data ? <StatusText tone="warning">{t('university:exports.personal')}</StatusText> : <StatusText tone="neutral">{t('university:exports.aggregate')}</StatusText>}
                </div>
                <p className="fs-13 mb-2">{t(`university:v8.ex.preset.${p.key}.body`, { intake: d.current_intake ? intakeText(d.current_intake, t) : t('university:v8.ex.noCurrentIntake') })}</p>
                <p className="fs-12 text-muted mb-2"><span className="fw-semibold">{t('university:v8.ex.contains')}</span> {p.columns.map(colName).join(' · ')}</p>
                {p.personal_data && <p className="fs-12 uv8-job__warn mb-2"><ShieldCheck size={13} aria-hidden /> {t('university:v8.ex.personalWarning')}</p>}
                <div className="uv8-job__foot">
                  <LastRun last={p.last_run} />
                  <span className="d-flex flex-wrap gap-2">
                    {p.key !== 'outcomes' && <Button size="sm" variant="ghost" onClick={() => setSaving(p.key)}>{t('university:v8.ex.saveConfig')}</Button>}
                    <Button size="sm" variant="primary" icon={<Download />} loading={busy === p.key} onClick={() => runJob(p.key, p.key)}>{t('university:exports.csv')}</Button>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card custom-card" aria-labelledby="saved-h">
        <div className="card-body">
          <h2 id="saved-h" className="uv7-sechead__title">{t('university:v8.ex.savedTitle')}</h2>
          {d.saved.length === 0 ? <p className="text-muted fs-13 mb-0">{t('university:v8.ex.savedEmpty')}</p> : (
            <ul className="list-unstyled mb-0 uv8-saved">
              {d.saved.map((x) => (
                <li key={x.id}>
                  <div className="min-w-0">
                    <span className="fw-semibold d-block">{x.name}</span>
                    <span className="uc-sub d-block">{t(`university:v8.ex.preset.${x.base}.title`)} · {t('university:v8.ex.nColumns', { count: x.columns.length })}
                      {Object.keys(x.filters).length ? ` · ${Object.entries(x.filters).map(([k, v]) => `${t(`university:v8.chip.key.${k}`)}: ${k === 'intake' ? intakeText(v, t) : k === 'degree' ? t(`common:degreeShort.${v}`) : '…'}`).join(', ')}` : ''}
                    </span>
                    <span className="uc-sub d-block">{t('university:v8.ex.savedBy', { name: x.by ?? '—', date: formatDateTime(x.created_at, locale) })} · <LastRun last={x.last_run} /></span>
                  </div>
                  <span className="d-flex gap-2">
                    <Button size="sm" variant="ghost" loading={del.isPending && del.variables === x.id} onClick={() => del.mutate(x.id)}>{t('common:actions.delete')}</Button>
                    <Button size="sm" icon={<Download />} loading={busy === x.id} onClick={() => runJob(x.id, x.base, { saved_id: x.id })}>{t('university:v8.ex.run')}</Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      {saving && <SaveConfigModal base={saving} data={d} onClose={() => setSaving(null)} />}
    </>
  );
}

export default function Exports() {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { perms, scopeId, overview } = useUniversity();
  const cohorts = useCohorts();
  const analytics = useAnalytics({});
  const history = useExportHistory();
  const [busy, setBusy] = useState<string | null>(null);
  if (!perms.canExport) return <NoAccess />;
  const stamp = todayStamp();
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); toast.success(t('university:exports.done')); qc.invalidateQueries({ queryKey: ['university', 'exports'] }); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const server = (kind: 'outcomes' | 'metrics') => run(kind, async () => {
    const res = await api.university.exportCsv(kind, scopeId);
    downloadBlob(await res.blob(), `${overview?.slug ?? 'university'}-${kind}-${stamp}.csv`);
  });
  const rows: ReportRow[] = [
    { key: 'apps', title: t('university:exports.applicationsTitle'), body: t('university:exports.applicationsBody'), personal: true, server: true,
      actions: <Button size="sm" icon={<Download />} loading={busy === 'apps'} onClick={() => run('apps', () => downloadApplicationsCsv(api, scopeId, overview?.slug))}>{t('university:exports.csv')}</Button> },
    { key: 'metrics', title: t('university:exports.metricsTitle'), body: t('university:exports.metricsBody'), personal: false, server: true,
      actions: <Button size="sm" icon={<Download />} loading={busy === 'metrics'} onClick={() => server('metrics')}>{t('university:exports.csv')}</Button> },
    { key: 'students', title: t('university:exports.cohortStudents'), body: t('university:exports.cohortBody'), personal: true, server: false,
      actions: <Button size="sm" icon={<Download />} disabled={!cohorts.data?.length} onClick={() => downloadCsv(cohortStudentRows(cohorts.data ?? []), `cohort-students-${stamp}`)}>{t('university:exports.csv')}</Button> },
    { key: 'breakdowns', title: t('university:exports.analyticsTitle'), body: t('university:exports.analyticsBody'), personal: false, server: false,
      actions: (
        <span className="hg-row-wrap" style={{ gap: 6 }}>
          <Button size="sm" disabled={!analytics.data} onClick={() => downloadCsv((analytics.data?.by_nationality ?? []).map((r) => ({ nationality: r.key, applications: r.count })), `by-nationality-${stamp}`)}>{t('university:analytics.dim.nationality')}</Button>
          <Button size="sm" disabled={!analytics.data} onClick={() => downloadCsv((analytics.data?.by_program ?? []).map((r) => ({ program: r.key, applications: r.count })), `by-program-${stamp}`)}>{t('university:analytics.dim.program')}</Button>
          <Button size="sm" disabled={!analytics.data} onClick={() => downloadCsv((analytics.data?.by_agency ?? []).map((r) => ({
            agency: r.agency, applications: r.applications, offers: r.offers, enrolled: r.enrolled,
            offer_rate: r.offer_rate.insufficient_data ? '' : r.offer_rate.value, offer_rate_denominator: r.offer_rate.denominator,
          })), `by-agency-${stamp}`)}>{t('university:analytics.dim.agency')}</Button>
        </span>
      ) },
  ];
  const caps = history.data?.capabilities;
  const kindLabel = (k: string) => (k.startsWith('PRESET:saved') ? t('university:v8.ex.savedRun') : k.startsWith('PRESET:') ? t(`university:v8.ex.preset.${k.slice(7)}.title`, { defaultValue: k })
    : t(`university:exports.kind.${k}`, { defaultValue: k }));
  return (
    <div className="hg-stack uc-page uv7 uv8-exports">
      <PageHeader title={t('common:nav.exports')} sub={t('university:exports.subtitle')} />
      <p className="uc-note" style={{ maxInlineSize: 760 }}><ShieldCheck size={13} aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('university:exports.privacyBody')}</p>
      <ExportJobs />
      <details className="card custom-card uv8-more">
        <summary>{t('university:v8.ex.otherReports')}</summary>
        <ul className="uc-reports">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="uc-reports__main">
                <span className="hg-medium">{r.title}</span>
                <span className="uc-sub">{r.body}</span>
                <span className="uc-reports__meta">
                  {r.personal ? <StatusText tone="warning">{t('university:exports.personal')}</StatusText> : <StatusText tone="neutral">{t('university:exports.aggregate')}</StatusText>}
                  <span className="uc-sub">{r.server ? t('university:exports.logged') : t('university:exports.local')}</span>
                </span>
              </div>
              <div className="uc-reports__act">{r.actions}</div>
            </li>
          ))}
        </ul>
      </details>

      <div className="uc-split">
        <Panel id="exp-delivery" title={t('university:exports.delivery')} sub={t('university:exports.deliverySub')}>
          <ul className="uc-list">
            {(['manual', 'scheduled', 'email', 'sftp', 'api'] as const).map((k) => (
              <li key={k} className="hg-row hg-between" style={{ gap: 8, paddingBlock: 8 }}>
                <span className="hg-small">{t(`university:exports.cap.${k}`)}</span>
                {caps?.[k] ? <StatusText tone="success">{t('university:exports.available')}</StatusText> : <span className="uc-sub">{k === 'scheduled' ? t('university:v8.ex.needsWorker') : t('university:exports.notYet')}</span>}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel id="exp-history" title={t('university:exports.history')} sub={t('university:exports.historySub')}>
          {!history.data?.jobs.length ? <p className="hg-subtle hg-small">{t('university:exports.noHistory')}</p> : (
            <ul className="uc-list">
              {history.data.jobs.slice(0, 8).map((j) => (
                <li key={j.id} className="hg-row hg-between" style={{ gap: 8, paddingBlock: 8 }}>
                  <span className="hg-small"><span className="hg-medium">{kindLabel(j.kind)}</span> · {t('university:exports.rows', { count: j.rows ?? 0 })}</span>
                  <span className="uc-sub">{[j.by, formatDateTime(j.at, locale)].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <p className="uc-note">{t('university:exports.blankNote')}</p>
    </div>
  );
}
