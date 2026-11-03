import { useTranslation } from '@hangyul/i18n';
import type { ApplicationStatus, DocumentStatus, EssayStatus, MatchTier, PipelineStage, TaskPriority, TaskStatus, VisaStatus } from '@hangyul/types';
import { applicationTone, documentTone, essayTone, pipelineTone, priorityTone, tierTone, visaTone } from '@hangyul/utils';
import type { StyleProp, ViewStyle } from 'react-native';

import type { Tone } from '../theme';
import { Badge } from './Badge';
import { StatusText } from './Patterns';

type Kind =
  | { kind: 'application'; value: ApplicationStatus }
  | { kind: 'document'; value: DocumentStatus }
  | { kind: 'essay'; value: EssayStatus }
  | { kind: 'visa'; value: VisaStatus }
  | { kind: 'tier'; value: MatchTier }
  | { kind: 'priority'; value: TaskPriority }
  | { kind: 'task'; value: TaskStatus }
  | { kind: 'pipeline'; value: PipelineStage };

const taskTone: Record<TaskStatus, Tone> = { OPEN: 'info', IN_PROGRESS: 'brand', BLOCKED: 'danger', DONE: 'success', CANCELLED: 'neutral' };

/** Resolves the i18n key + tone for any domain status so every app labels states identically. */
export function statusMeta(k: Kind): { key: string; tone: Tone } {
  switch (k.kind) {
    case 'application': return { key: `common:appStatus.${k.value}`, tone: applicationTone[k.value] ?? 'neutral' };
    case 'document': return { key: `common:docStatus.${k.value}`, tone: documentTone[k.value] ?? 'neutral' };
    case 'essay': return { key: `common:essayStatus.${k.value}`, tone: essayTone[k.value] ?? 'neutral' };
    case 'visa': return { key: `common:visaStatus.${k.value}`, tone: visaTone[k.value] ?? 'neutral' };
    case 'tier': return { key: `common:tier.${k.value}`, tone: tierTone[k.value] ?? 'neutral' };
    case 'priority': return { key: `common:priority.${k.value}`, tone: priorityTone[k.value] ?? 'neutral' };
    case 'task': return { key: `common:taskStatus.${k.value}`, tone: taskTone[k.value] ?? 'neutral' };
    case 'pipeline': return { key: `common:pipeline.${k.value}`, tone: pipelineTone(k.value) };
  }
}

/** Domain status as dot + words (V3 default). Pass `filled` only where strong emphasis is needed. */
export function StatusBadge(props: Kind & { style?: StyleProp<ViewStyle>; solid?: boolean; filled?: boolean }) {
  const { t } = useTranslation();
  const m = statusMeta(props);
  const label = t(m.key, { defaultValue: String(props.value) });
  if (props.filled || props.solid) return <Badge label={label} tone={m.tone} solid={props.solid} style={props.style} />;
  return <StatusText label={label} tone={m.tone} style={props.style} />;
}
