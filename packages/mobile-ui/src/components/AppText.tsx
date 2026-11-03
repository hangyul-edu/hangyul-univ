import { useLocale } from '@hangyul/i18n';
import { forwardRef } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { useFontsReady } from '../fonts';
import { fontFamily, theme, toneColors, type FontWeightName, type Tone } from '../theme';

export type TextVariant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'metric';

/** V3 type scale (see REPORT §19): semibold for hierarchy, bold only for rare display numbers. */
const variants: Record<TextVariant, { size: number; line: number; weight: FontWeightName; color: string; letterSpacing?: number }> = {
  display: { size: 26, line: 32, weight: 'semibold', color: theme.color.text, letterSpacing: -0.4 },
  title: { size: 20, line: 26, weight: 'semibold', color: theme.color.text, letterSpacing: -0.2 },
  heading: { size: 17, line: 24, weight: 'semibold', color: theme.color.text, letterSpacing: -0.1 },
  subheading: { size: 15, line: 22, weight: 'semibold', color: theme.color.text },
  body: { size: 15, line: 22, weight: 'regular', color: theme.color.text },
  bodyStrong: { size: 15, line: 22, weight: 'semibold', color: theme.color.text },
  caption: { size: 13, line: 18, weight: 'regular', color: theme.color.textSecondary },
  label: { size: 12, line: 16, weight: 'semibold', color: theme.color.textSecondary },
  metric: { size: 24, line: 30, weight: 'semibold', color: theme.color.text, letterSpacing: -0.3 },
};

const systemWeight: Record<FontWeightName, TextStyle['fontWeight']> = { regular: '400', semibold: '600', bold: '700' };

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  weight?: FontWeightName;
  color?: string;
  /** Colors the text with a semantic status tone (fg). */
  tone?: Tone;
  secondary?: boolean;
  align?: 'auto' | 'center' | 'start' | 'end';
}

/**
 * Typography primitive. Uses Pretendard when loaded, the platform font otherwise.
 * Dynamic Type / font scale is respected (capped so layouts don't break).
 */
export const AppText = forwardRef<Text, AppTextProps>(function AppText(
  { variant = 'body', weight, color, tone, secondary, align = 'auto', style, maxFontSizeMultiplier = 1.6, ...rest },
  ref,
) {
  const fontsReady = useFontsReady();
  const { dir } = useLocale();
  const v = variants[variant];
  const w = weight ?? v.weight;
  const textAlign: TextStyle['textAlign'] = align === 'start' ? 'left' : align === 'end' ? 'right' : align;
  return (
    <Text
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        {
          fontSize: v.size,
          lineHeight: v.line,
          letterSpacing: v.letterSpacing,
          color: color ?? (tone ? toneColors(tone).fg : secondary ? theme.color.textSecondary : v.color),
          textAlign,
          writingDirection: dir === 'rtl' ? 'rtl' : undefined,
        },
        fontsReady ? { fontFamily: fontFamily[w] } : { fontWeight: systemWeight[w] },
        styles.base,
        style,
      ]}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({ base: { includeFontPadding: false } });
