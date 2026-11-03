// Agency-side YNEX helpers: tone mapping from Hangyul status tones to YNEX soft tones, initials avatars in YNEX anatomy
// (`avatar avatar-sm avatar-rounded bg-*-transparent`, util/_avatars.scss), and the soft stage badge used in lists.
import type { PipelineStage } from '@hangyul/types';
import { cx, pipelineTone, type Tone } from '@hangyul/utils';
import type { YxTone } from '@hangyul/ynex-ui';

import { useT } from './bits';

export function yxTone(tone: Tone | string | undefined): YxTone {
  switch (tone) {
    case 'success': return 'success';
    case 'warning': return 'warning';
    case 'danger': return 'danger';
    case 'info': return 'primary';
    case 'brand': return 'purple';
    case 'teal': return 'teal';
    case 'neutral': return 'light';
    default: return 'light';
  }
}

const AV_TONES: YxTone[] = ['primary', 'secondary', 'success', 'warning', 'info', 'purple', 'teal', 'orange'];
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** Initials avatar in YNEX anatomy. Decorative: the name is always printed next to it. */
export function YAvatar({ name, size = 'sm', className, square }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string; square?: boolean }) {
  const hash = [...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const tone = AV_TONES[hash % AV_TONES.length];
  return (
    <span className={cx('avatar', `avatar-${size}`, !square && 'avatar-rounded', `bg-${tone}-transparent`, 'ag7-av', className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

/** Pipeline stage as a YNEX soft badge — text + colour, never colour alone. */
export function StageSoft({ stage }: { stage: PipelineStage }) {
  const { t } = useT();
  // V24 (REPORT §295): an in-progress stage is a fact, not an alert. Tinted tangerine it read as eight
  // competing colours in one column; neutral, the colour that is left (green offer, red rejection) means something.
  const base = pipelineTone(stage);
  const tone = yxTone(base === 'info' ? 'neutral' : base);
  return <span className={cx('badge', tone === 'light' ? 'bg-light text-default' : `bg-${tone}-transparent`)}>{t(`pipeline.${stage}`)}</span>;
}
