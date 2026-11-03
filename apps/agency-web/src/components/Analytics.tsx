import { parseIntake } from '../lib/logic';
import { useT } from './bits';

/** "Spring 2027" from "2027-SPRING". */
export function useIntakeLabel() {
  const { t } = useT();
  return (v: string) => { const p = parseIntake(v); return p ? t('intakeLabel', { term: t(`term.${p.term}`), year: p.year }) : v; };
}
