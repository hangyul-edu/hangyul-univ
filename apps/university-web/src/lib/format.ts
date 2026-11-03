import { downloadBlob, toCsv } from '@hangyul/utils';
import type { useLocale } from '@hangyul/i18n';

export type TFn = ReturnType<typeof useLocale>['t'];

/** "2027-SPRING" → "Spring 2027" (localized). */
export function intakeText(label: string | null | undefined, t: TFn): string {
  if (!label) return '—';
  const [year, term] = label.split('-');
  if (!year || !term) return label;
  return t('common:intakeLabel', { term: t(`common:term.${term}`, { defaultValue: term }), year });
}

export function intakeKey(i: { year: number; term: string }): string {
  return `${i.year}-${i.term}`;
}

/** Download rows as a UTF-8 CSV with BOM (opens correctly in Excel for Korean/Vietnamese names). */
export function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  downloadBlob(new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' }), filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function todayStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
