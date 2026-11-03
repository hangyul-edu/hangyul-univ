import { Filter, X } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { DEGREE_LEVELS } from '@hangyul/types';
import { Badge, Button, Drawer, Field, FilterSelect, Select } from '@hangyul/ui';
import { countryName } from '@hangyul/utils';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { countActive, parseFilters, writeFilters, type AnalyticsFilters } from '../lib/filters';
import { intakeKey, intakeText } from '../lib/format';
import { useAgencyDirectory, useAnalytics, usePrograms } from '../lib/queries';

/** Filters persisted in the URL search params. */
export function useUrlFilters(): [AnalyticsFilters, (f: AnalyticsFilters) => void] {
  const [sp, setSp] = useSearchParams();
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const set = useCallback((f: AnalyticsFilters) => setSp(writeFilters(sp, f), { replace: true }), [sp, setSp]);
  return [filters, set];
}

export type FilterKey = keyof AnalyticsFilters;

export function useFilterOptions() {
  const programs = usePrograms();
  const base = useAnalytics({});
  const agencies = useAgencyDirectory();
  return useMemo(() => {
    const intakes = new Map<string, number>();
    (programs.data ?? []).forEach((p) => (p.intakes ?? []).forEach((i) => intakes.set(intakeKey(i), i.year * 10 + ['SPRING', 'SUMMER', 'FALL', 'WINTER'].indexOf(i.term))));
    return {
      intakes: [...intakes.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k),
      nationalities: (base.data?.by_nationality ?? []).map((r) => r.key).filter(Boolean),
      programs: (programs.data ?? []).map((p) => ({ id: p.id, name: p.name_en, degree: p.degree_level })),
      agencies: agencies.directory,
    };
  }, [programs.data, base.data, agencies.directory]);
}

/**
 * V30 (REPORT §414): in the inline row a filter is a `FilterSelect` (`모집 학기 · 전체 ⌄`, content-sized) — the row
 * used to show five wide native selects whose category labels were hidden; in the drawer it stays a labelled field.
 */
function FilterPick({ inline, id, label, value, onChange, children }: {
  inline?: boolean; id: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode;
}) {
  if (inline) return <FilterSelect id={id} size="sm" label={label} value={value} onChange={(e) => onChange(e.target.value)}>{children}</FilterSelect>;
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} compact value={value} onChange={(e) => onChange(e.target.value)}>{children}</Select>
    </Field>
  );
}

function Fields({ value, onChange, keys, idp = 'f', inline }: { value: AnalyticsFilters; onChange: (f: AnalyticsFilters) => void; keys: FilterKey[]; idp?: string; inline?: boolean }) {
  const { t, locale } = useLocale(['university', 'common']);
  const o = useFilterOptions();
  const set = (k: FilterKey, v: string) => onChange({ ...value, [k]: v || undefined });
  return (
    <>
      {keys.includes('intake') && (
        <FilterPick inline={inline} id={`${idp}-intake`} label={t('university:filters.intake')} value={value.intake ?? ''} onChange={(v) => set('intake', v)}>
            <option value="">{t('university:filters.allIntakesOption')}</option>
            {o.intakes.map((k) => <option key={k} value={k}>{intakeText(k, t)}</option>)}
        </FilterPick>
      )}
      {keys.includes('nationality') && (
        <FilterPick inline={inline} id={`${idp}-nat`} label={t('university:filters.nationality')} value={value.nationality ?? ''} onChange={(v) => set('nationality', v)}>
            <option value="">{t('university:filters.allNationalities')}</option>
            {[...new Set([...(value.nationality ? [value.nationality] : []), ...o.nationalities])].map((c) => <option key={c} value={c}>{countryName(c, locale)}</option>)}
        </FilterPick>
      )}
      {keys.includes('degree') && (
        <FilterPick inline={inline} id={`${idp}-degree`} label={t('university:filters.degree')} value={value.degree ?? ''} onChange={(v) => set('degree', v)}>
            <option value="">{t('university:filters.allDegrees')}</option>
            {DEGREE_LEVELS.map((d) => <option key={d} value={d}>{t(`common:degreeShort.${d}`)}</option>)}
        </FilterPick>
      )}
      {keys.includes('program_id') && (
        <FilterPick inline={inline} id={`${idp}-program`} label={t('university:filters.program')} value={value.program_id ?? ''} onChange={(v) => set('program_id', v)}>
            <option value="">{t('university:filters.allPrograms')}</option>
            {o.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </FilterPick>
      )}
      {keys.includes('agency_id') && (
        <FilterPick inline={inline} id={`${idp}-agency`} label={t('university:filters.agency')} value={value.agency_id ?? ''} onChange={(v) => set('agency_id', v)}>
            <option value="">{t('university:filters.allAgencies')}</option>
            {o.agencies.map((a) => <option key={a.id} value={a.id}>{a.name ?? t('university:agencies.unnamed')}</option>)}
        </FilterPick>
      )}
    </>
  );
}

/** Inline filter row on tablet/desktop; a bottom-sheet Drawer on phones. */
export function FilterBar({ value, onChange, keys = ['intake', 'nationality', 'degree', 'program_id', 'agency_id'] }: {
  value: AnalyticsFilters;
  onChange: (f: AnalyticsFilters) => void;
  keys?: FilterKey[];
}) {
  const { t } = useLocale(['university', 'common']);
  const [open, setOpen] = useState(false);
  const n = countActive(value);
  return (
    <div className="uc-filterbar" role="search" aria-label={t('university:filters.label')}>
      <div className="uc-filterbar__inline">
        <Fields value={value} onChange={onChange} keys={keys} inline />
        {n > 0 && (
          <Button variant="ghost" size="sm" icon={<X />} onClick={() => onChange({})} className="uc-filterbar__clear">{t('common:actions.clearFilters')}</Button>
        )}
      </div>
      <div className="uc-filterbar__compact">
        <Button icon={<Filter />} onClick={() => setOpen(true)} aria-haspopup="dialog">
          {t('common:actions.filter')}
          {n > 0 && <Badge tone="brand" size="sm">{n}</Badge>}
        </Button>
        {n > 0 && <Button variant="ghost" size="sm" onClick={() => onChange({})}>{t('common:actions.clearFilters')}</Button>}
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title={t('common:actions.filter')}
        footer={<Button variant="primary" block onClick={() => setOpen(false)}>{t('common:actions.done')}</Button>}>
        <div className="hg-stack">
          <Fields value={value} onChange={onChange} keys={keys} idp="fd" />
          {n > 0 && <Button variant="ghost" onClick={() => onChange({})}>{t('common:actions.clearFilters')}</Button>}
        </div>
      </Drawer>
    </div>
  );
}
