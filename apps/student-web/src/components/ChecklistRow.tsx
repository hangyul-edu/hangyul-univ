import { docLabel } from '@hangyul/i18n';
import type { ChecklistItem } from '@hangyul/types';
import { ButtonLink, StatusText } from '@hangyul/ui';
import { documentTone, formatDate } from '@hangyul/utils';
import { Link } from 'react-router';

import { useT } from '../lib/i18n';
import { checklistDetail, treatmentLine } from '../lib/workspace';

/** Where the student should go to resolve a checklist item. */
export function checklistHref(item: Pick<ChecklistItem, 'action_code' | 'document_id' | 'category'>): string | null {
  if (item.action_code === 'IN_REVIEW') return null;
  if (item.action_code === 'UPLOAD' || !item.document_id) return item.action_code ? `/documents?upload=${item.category}` : null;
  // FIX, RENEW, TOO_OLD, LEGALIZE: open the existing document (new version / legalization steps live there).
  return `/documents?doc=${item.document_id}`;
}

export function ChecklistRow({ item }: { item: ChecklistItem }) {
  const { t, locale } = useT();
  const href = checklistHref(item);
  const actionText = checklistDetail(t, item, (d) => formatDate(d, locale)) ?? '';
  const flags = [
    !item.required ? t('checklist.optional') : null,
    // V27: the specific route from the server's treatment; the V5 generic flags only for older rows without one.
    item.treatment ? treatmentLine(t, item) ?? null : item.legalization_required ? t('university.documents.apostille') : null,
    !item.treatment && item.translation_required ? t('university.documents.translation') : null,
    item.reused && item.document_id ? t('checklist.reused') : null,
    item.shared_with_university ? t('checklist.shared') : null,
  ].filter(Boolean);
  return (
    <li className="sd-row" data-ready={item.ready}>
      <div className="sd-row__main">
        <div className="sd-row__title">{docLabel(t, item)}</div>
        {!item.ready && actionText && <div className={item.action_code === 'FIX' ? 'sd-row__detail sd-row__detail--fix' : 'sd-row__detail'}>{actionText}</div>}
        {flags.length > 0 && <div className="sd-row__detail">{flags.join(' · ')}</div>}
      </div>
      <div className="sd-row__state"><StatusText tone={documentTone[item.status]} hollow={item.status === 'MISSING'}>{t(`common:docStatus.${item.status}`)}</StatusText></div>
      <div className="sd-row__action">
        {!item.ready && href && (
          <ButtonLink as={Link} to={href} size="sm" variant="secondary">
            {t(`checklist.button.${item.action_code ?? 'OPEN'}`, { defaultValue: t('checklist.button.OPEN') })}
          </ButtonLink>
        )}
      </div>
    </li>
  );
}
