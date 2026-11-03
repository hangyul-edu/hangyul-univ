// V9 U6: what a rule change does to currently matching prospective students — a number only when every counted profile has
// the data the changed rule needs; otherwise "Not enough data to estimate (N profiles lack X)". Never a guess.
import { useAuth } from '@hangyul/auth';
import { useLocale } from '@hangyul/i18n';
import { InfoTip } from '@hangyul/ui';
import { formatNumber } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { impactView, type Impact } from '../../lib/v9';

export function ImpactNote({ impact }: { impact: Impact | null | undefined }) {
  const { t, locale } = useLocale(['university', 'common']);
  const v = impactView(impact);
  if (v.kind === 'none' || !impact) return null;
  const n = (x: number) => formatNumber(x, locale);
  const fields = (v.kind === 'insufficient' ? v.fields : []).map((f) => t(`university:v9.impact.field.${f}`, { defaultValue: f })).join(', ');
  return (
    <div className="uv9-impact" data-kind={v.kind} data-stop={v.kind === 'estimate' && v.stop > 0 ? '1' : undefined} role="status">
      <p className="uv9-impact__head">
        {v.kind === 'empty' ? t('university:v9.impact.empty')
          : v.kind === 'insufficient' ? t('university:v9.impact.insufficient', { count: v.profiles, n: n(v.profiles), of: n(v.of), fields })
            : t('university:v9.impact.stop', { count: v.stop, n: n(v.stop), total: n(v.total) })}
        <InfoTip text={impact.definition} />
      </p>
      {v.kind === 'estimate' && v.start ? <p className="uv9-impact__sub">{t('university:v9.impact.start', { count: v.start, n: n(v.start) })}</p> : null}
      {impact.population && impact.population.total > 0 && (
        <p className="uv9-impact__sub">{t('university:v9.impact.population', {
          matched: n(impact.population.strong_or_competitive), active: n(impact.population.active_applications), saved: n(impact.population.saved),
        })}</p>
      )}
    </div>
  );
}

/** Live preview while editing the rules form (debounced; only fields that differ from the published rule count). */
export function LiveImpact({ programId, payload }: { programId: string; payload: Record<string, unknown> }) {
  const { api } = useAuth();
  const key = JSON.stringify(payload);
  const [debounced, setDebounced] = useState(key);
  useEffect(() => { const h = setTimeout(() => setDebounced(key), 400); return () => clearTimeout(h); }, [key]);
  const q = useQuery({
    queryKey: ['university', 'impact', programId, debounced],
    queryFn: () => api.post<Impact>(`/university/programs/${programId}/impact-preview`, JSON.parse(debounced)),
    staleTime: 30_000,
  });
  return <ImpactNote impact={q.data} />;
}
