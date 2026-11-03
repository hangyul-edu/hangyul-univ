import { useAuth } from '@hangyul/auth';
import { useLocale } from '@hangyul/i18n';
import { formatDate } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';

/** V5/V6 success: one formal line with the submission evidence (method, reference, date). Nothing about fees or notes. */
export function SubmissionEvidence({ appId }: { appId: string }) {
  const { t, locale } = useLocale(['success', 'common']);
  const { api } = useAuth();
  const q = useQuery({ queryKey: ['submission-evidence', appId], queryFn: () => api.success.evidence(appId), staleTime: 60_000 });
  const e = q.data;
  if (!e) return null;
  const r = e.record;
  // V6: AGENCY_ASSISTED was renamed AUTHORIZED_AGENCY (the API normalises it; older cached payloads may still carry it).
  const raw = String(r?.method ?? e.method);
  const method = t(`success:method.${raw === 'AGENCY_ASSISTED' ? 'AUTHORIZED_AGENCY' : raw}`);
  if (!r || r.status !== 'SUBMITTED_CONFIRMED') return <span className="hg-subtle">{t('success:university.evidenceMissing')}</span>;
  const date = r.submitted_on ? formatDate(r.submitted_on, locale) : e.submitted_at ? formatDate(e.submitted_at, locale) : '—';
  return (
    <span data-testid="submission-evidence">
      {r.external_reference ? t('success:university.evidence', { method, ref: r.external_reference, date }) : t('success:university.evidenceNoRef', { method, date })}
    </span>
  );
}
