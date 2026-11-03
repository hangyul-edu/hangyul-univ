import { useLocale } from '@hangyul/i18n';
import type { Application } from '@hangyul/types';
import { StatusText } from '@hangyul/ui';

import { decisionNeed, NEED_TONE } from '../../lib/v8';

/** "Ready to decide", "Below: TOPIK", "Waiting for 2 documents" — what a decision on this application needs now. */
export function NeedText({ a }: { a: Pick<Application, 'status' | 'eligibility' | 'documents' | 'open_document_requests' | 'returned_document_requests'> }) {
  const { t } = useLocale(['university', 'common']);
  const n = decisionNeed(a);
  if (n.kind === 'decided') return <span className="hg-subtle" title={t('university:v8.need.decidedHint')}>—</span>;
  const item = (x: string) => t(`university:elig.item.${x}`, { defaultValue: x });
  const text = n.kind === 'below' || n.kind === 'check'
    ? t(`university:v8.need.${n.kind}`, { what: n.items.map(item).join(', ') })
    : t(`university:v8.need.${n.kind}`, { count: 'count' in n ? n.count : 0 });
  return <StatusText tone={NEED_TONE[n.kind]} title={text}>{text}</StatusText>;
}
