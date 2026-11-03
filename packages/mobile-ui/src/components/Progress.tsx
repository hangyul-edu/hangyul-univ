import { useTranslation } from '@hangyul/i18n';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { theme, toneColors, type Tone } from '../theme';
import { AppText } from './AppText';

const clamp = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));

export interface ProgressBarProps {
  /** 0–100 */
  value: number;
  tone?: Tone;
  height?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({ value, tone = 'brand', height = 8, accessibilityLabel, style }: ProgressBarProps) {
  const { t } = useTranslation('common');
  const v = clamp(value);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v), text: t('a11y.progress', { value: Math.round(v) }) }}
      style={[styles.track, { height, borderRadius: height / 2 }, style]}
    >
      <View style={[styles.fill, { width: `${v}%`, backgroundColor: toneColors(tone).solid, borderRadius: height / 2 }]} />
    </View>
  );
}

export interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: Tone;
  /** Center content; defaults to "NN%". */
  children?: ReactNode;
  accessibilityLabel?: string;
}

/** Circular progress (react-native-svg). Used for readiness — never for admission probability. */
export function ProgressRing({ value, size = 96, strokeWidth = 9, tone = 'brand', children, accessibilityLabel }: ProgressRingProps) {
  const { t } = useTranslation('common');
  const v = clamp(value);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v), text: t('a11y.progress', { value: Math.round(v) }) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.color.surfaceSunken} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={toneColors(tone).solid}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - v / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} importantForAccessibility="no-hide-descendants">
        {children ?? (
          <AppText variant={size >= 88 ? 'title' : 'bodyStrong'} maxFontSizeMultiplier={1.2}>
            {Math.round(v)}%
          </AppText>
        )}
      </View>
    </View>
  );
}

/** Horizontal step indicator (journey). */
export function StepDots({ total, current, labels }: { total: number; current: number; labels?: string[] }) {
  return (
    <View style={styles.steps} accessible accessibilityLabel={labels?.[current]}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.step,
            { backgroundColor: i < current ? theme.status.brand.solid : i === current ? theme.color.primary : theme.color.surfaceSunken },
            i === current && styles.stepCurrent,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: theme.color.surfaceSunken, overflow: 'hidden', width: '100%' },
  fill: { height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
  steps: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  step: { flex: 1, height: 6, borderRadius: 3 },
  stepCurrent: { height: 8, borderRadius: 4 },
});
