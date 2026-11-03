// V8 metric glossary, served by the API (GET /university/glossary): for every number the console shows — numerator,
// denominator, population, intake scope, date range and the small-sample rule. Opened on demand, never in the way.
import { BookOpenText } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { GlossaryEntry } from '@hangyul/types';
import { Drawer, ErrorState, Input, SkeletonCard } from '@hangyul/ui';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useGlossary } from '../../lib/queries';

const STEP_CODES = ['SUBMITTED', 'REVIEWED', 'OFFERED', 'ACCEPTED', 'TUITION_PAID', 'VISA_ISSUED', 'ARRIVED', 'ENROLLED'];

function Entry({ g, focused, min }: { g: GlossaryEntry; focused: boolean; min: number }) {
  const { t } = useLocale('university');
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (focused) ref.current?.scrollIntoView({ block: 'start' }); }, [focused]);
  const name = t(`university:v8.gl.name.${g.key}`, { defaultValue: t(`university:af.stepName.${g.key.toUpperCase()}`, { defaultValue: g.key }) });
  // Step codes and fixed texts are translated on the client; the server's English text is the fallback and the reference.
  const term = (v: string | null, kind: 'num' | 'den') => {
    if (!v) return null;
    if (STEP_CODES.includes(v)) return t(`university:af.stepName.${v}`);
    if (v === 'DECIDED') return t('university:v8.gl.decided');
    if (v.startsWith('ADMITTED')) return t('university:v8.gl.admitted');
    return t(`university:v8.gl.${kind}.${g.key}`, { defaultValue: v });
  };
  const c = g.codes;
  const den = term(g.denominator, 'den');
  return (
    <article ref={ref} id={`gl-${g.key}`} className="uv8-gl" data-focused={focused || undefined} aria-labelledby={`gl-${g.key}-h`}>
      <h3 id={`gl-${g.key}-h`} className="uv8-gl__name">{name} <span className="uv8-gl__kind">{t(`university:v8.gl.kind.${g.kind}`)}</span></h3>
      <p className="uv8-gl__def">{t(`university:v8.gl.def.${g.key}`, { defaultValue: g.definition })}</p>
      <dl className="uv8-gl__kv">
        <dt>{t('university:v8.gl.numerator')}</dt><dd>{term(g.numerator, 'num')}</dd>
        {den && <><dt>{t('university:v8.gl.denominator')}</dt><dd>{den}</dd></>}
        <dt>{t('university:v8.gl.population')}</dt><dd>{c ? t(`university:v8.gl.pop.${c.population}`, { defaultValue: g.population }) : g.population}</dd>
        <dt>{t('university:v8.gl.intake')}</dt><dd>{c ? t(`university:v8.gl.intakeScope.${c.intake}`, { defaultValue: g.intake }) : g.intake}</dd>
        <dt>{t('university:v8.gl.range')}</dt><dd>{c ? t(`university:v8.gl.rangeText.${c.date_range}`, { defaultValue: g.date_range }) : g.date_range}</dd>
        <dt>{t('university:v8.gl.small')}</dt><dd>{c ? t(`university:v8.gl.smallText.${c.small_sample}`, { defaultValue: g.small_sample, min }) : g.small_sample}</dd>
      </dl>
    </article>
  );
}

export function GlossaryDrawer({ open, onClose, focus }: { open: boolean; onClose: () => void; focus?: string }) {
  const { t } = useLocale('university');
  const q = useGlossary();
  const [search, setSearch] = useState('');
  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data?.metrics ?? []).filter((g) => !s || `${g.key} ${g.definition} ${g.numerator} ${g.denominator ?? ''}`.toLowerCase().includes(s));
  }, [q.data, search]);
  return (
    <Drawer open={open} onClose={onClose} title={t('university:v8.gl.title')} width={520}>
      <div className="hg-stack">
        <p className="fs-13 text-muted mb-0">{t('university:v8.gl.intro', { min: q.data?.min_denominator ?? 5 })}</p>
        <Input type="search" compact value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('university:v8.gl.search')} aria-label={t('university:v8.gl.search')} />
        {q.isLoading ? <SkeletonCard lines={6} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} compact />
          : list.map((g) => <Entry key={g.key} g={g} focused={g.key === focus} min={q.data?.min_denominator ?? 5} />)}
      </div>
    </Drawer>
  );
}

/** "How we count" — opens the glossary (optionally at one metric). */
export function GlossaryButton({ focus, compact }: { focus?: string; compact?: boolean }) {
  const { t } = useLocale('university');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={compact ? 'btn btn-link btn-sm p-0 uv8-glbtn' : 'btn btn-light btn-wave uv7-btn uv8-glbtn'} onClick={() => setOpen(true)}>
        {!compact && <BookOpenText aria-hidden />}{compact ? t('university:v8.gl.definition') : t('university:v8.gl.cta')}
      </button>
      {open && <GlossaryDrawer open onClose={() => setOpen(false)} focus={focus} />}
    </>
  );
}
