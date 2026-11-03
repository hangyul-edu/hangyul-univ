import { chart, color, font, palette, radius, space, status, type StatusTone } from '@hangyul/design-tokens';
import { I18nManager, Platform } from 'react-native';

/** Design tokens mapped for React Native. Single source: @hangyul/design-tokens. */
export type Tone = StatusTone;

export const fontFamily = {
  regular: 'Pretendard-Regular',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
} as const;
export type FontWeightName = keyof typeof fontFamily;

export const theme = {
  color,
  palette,
  status,
  chart,
  space,
  radius,
  font,
  /** Minimum touch target (Apple HIG 44pt / Material 48dp — we use 48 everywhere). */
  touch: 48,
  hairline: 1,
} as const;

export const toneColors = (tone: Tone = 'neutral') => status[tone] ?? status.neutral;

/** Platform-appropriate card elevation. */
export const elevation = (level: 0 | 1 | 2 = 1) =>
  level === 0
    ? {}
    : Platform.select({
        ios: {
          shadowColor: palette.ink[900],
          shadowOpacity: level === 1 ? 0.06 : 0.12,
          shadowRadius: level === 1 ? 6 : 14,
          shadowOffset: { width: 0, height: level === 1 ? 2 : 6 },
        },
        android: { elevation: level === 1 ? 1 : 4 },
        default: {},
      });

/** True when the native layout direction is RTL (we never force a restart; styles use start/end). */
export const isRTLLayout = () => I18nManager.isRTL;

/** Mirror directional glyphs (chevrons, arrows) for RTL layouts. */
export const flipForRTL = () => (I18nManager.isRTL ? [{ scaleX: -1 as const }] : []);
/** Style that mirrors a directional icon in RTL. In LTR it is `undefined`, never an empty transform: react-native-svg on
 *  Android cannot parse `transform: []` on an icon and crashes the screen (react-native-web tolerates it). */
export const flipStyle = () => (I18nManager.isRTL ? { transform: [{ scaleX: -1 as const }] } : undefined);
