import { useAuth } from '@hangyul/auth';
import { useLocale } from '@hangyul/i18n';
import type { DossierFinding, DossierPackageSummary } from '@hangyul/types';
import { Button, StatusText, useToast } from '@hangyul/ui';
import { formatDate } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import '../dossier.css';

/**
 * V5 dossier summary for the agency student workspace (documents tab): one line per application package and the open
 * notes from the automatic check, which staff resolve or dismiss. Dense and operational.
 */
function pkg(t: (k: string, o?: Record<string, unknown>) => string, s: DossierPackageSummary): string {
  if (s.complete) return t('agency.pkgComplete');
  return [t('agency.pkgLine', { ready: s.ready, total: s.total }), s.student && t('agency.pkgStudent', { count: s.student }),
    s.counselor && t('agency.pkgCounselor', { count: s.counselor }), s.request && t('agency.pkgRequest', { count: s.request })].filter(Boolean).join(' · ');
}

const TONE = { BLOCKER: 'danger', WARNING: 'warning', INFO: 'neutral' } as const;

export function DossierPanel({ studentId }: { studentId: string }) {
  const { api } = useAuth();
  const { t, locale } = useLocale(['dossier', 'common']);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['agency', 'dossier', studentId], queryFn: () => api.dossier.student(studentId), staleTime: 30_000 });
  const decide = useMutation({
    mutationFn: ({ f, action }: { f: DossierFinding; action: 'resolve' | 'dismiss' }) => api.dossier.finding(f.id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agency', 'dossier', studentId] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const tr = useMutation({
    mutationFn: ({ doc, status }: { doc: string; status: 'PROVIDED' | 'NEEDED' }) => api.dossier.translation(doc, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agency', 'dossier', studentId] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const d = q.data;
  if (!d) return null;
  const fmt = (iso: string) => formatDate(iso, locale, { day: 'numeric', month: 'short' });
  const findings = d.rows.flatMap((r) => r.findings.map((f) => ({ f, category: r.category })));
  const pending = d.suggestions.filter((s) => s.status === 'SUGGESTED' && !s.matches_profile).length;
  const text = (f: DossierFinding) => {
    const p: Record<string, unknown> = { ...f.params };
    for (const k of ['date', 'until', 'when', 'issued']) if (typeof p[k] === 'string' && /^\d{4}-/.test(p[k] as string)) p[k] = fmt(p[k] as string);
    if (p.detected_code) p.detected = t(`common:docCategory.${p.detected_code}`).toLowerCase();
    if (p.category_code) p.category = t(`common:docCategory.${p.category_code}`).toLowerCase();
    if (p.other_code) p.other = t(`common:docCategory.${p.other_code}`).toLowerCase();
    if (p.path_code) p.path = t(`path.${p.path_code}`);
    const s = t(`finding.${f.text_code}`, { ...p, defaultValue: '' });
    return s && !s.includes('{{') ? s : f.explanation;
  };
  return (
    <section className="ag-dossier" aria-label={t('agency.title')}>
      {d.packages.length > 0 && (
        <ul className="ag-dossier__pkgs">
          {d.packages.map((p) => (
            <li key={p.application.id}>
              <span className="hg-strong hg-small">{p.application.university}</span>
              <StatusText tone={p.summary.complete ? 'success' : p.summary.student || p.summary.request ? 'warning' : 'info'}>{pkg(t, p.summary)}</StatusText>
            </li>
          ))}
        </ul>
      )}
      <div className="ag-dossier__head">
        <span className="hg-small hg-strong">{t('agency.findings')}</span>
        <span className="hg-xs hg-subtle">{t('agency.method')}{pending ? ` · ${t('agency.suggestions', { count: pending })}` : ''}</span>
      </div>
      {findings.length === 0 ? <p className="hg-xs hg-subtle">{t('agency.findingsNone')}</p> : (
        <ul className="ag-dossier__findings">
          {findings.map(({ f, category }) => (
            <li key={f.id}>
              <StatusText tone={TONE[f.severity]}>{t(`common:docCategory.${category}`)}</StatusText>
              <span className="hg-small ag-dossier__text">{text(f)}</span>
              <span className="ag-dossier__acts">
                {(f.code === 'TRANSLATION_CHECK' || f.code === 'TRANSLATION_NEEDED') ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => tr.mutate({ doc: f.document_id, status: 'PROVIDED' })}>{t('agency.translationProvided')}</Button>
                    {f.code === 'TRANSLATION_CHECK' && <Button size="sm" variant="ghost" onClick={() => tr.mutate({ doc: f.document_id, status: 'NEEDED' })}>{t('agency.translationNeeded')}</Button>}
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => decide.mutate({ f, action: 'resolve' })}>{t('agency.resolve')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => decide.mutate({ f, action: 'dismiss' })}>{t('agency.dismiss')}</Button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
