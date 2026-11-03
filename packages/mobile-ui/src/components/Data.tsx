import { useTranslation } from '@hangyul/i18n';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme, toneColors, type Tone } from '../theme';
import { AppText } from './AppText';

export interface KpiTileProps {
  label: string;
  value: string;
  hint?: string | null;
  /** Percentage change vs previous period. */
  delta?: number | null;
  /** When true, shows "Not enough data" instead of a misleading number. */
  insufficient?: boolean;
  minSample?: number;
  icon?: LucideIcon;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}

export function KpiTile({ label, value, hint, delta, insufficient, minSample = 5, icon: Icon, tone = 'brand', style }: KpiTileProps) {
  const { t } = useTranslation('common');
  const deltaText = delta === null || delta === undefined ? null : `${delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} ${Math.abs(Math.round(delta))}%`;
  const a11y = insufficient ? `${label}: ${t('states.insufficientData')}` : `${label}: ${value}${deltaText ? `, ${deltaText}` : ''}`;
  return (
    <View style={[styles.kpi, style]} accessible accessibilityLabel={a11y}>
      <View style={styles.kpiHead}>
        {Icon ? (
          <View style={[styles.kpiIcon, { backgroundColor: toneColors(tone).bg }]}>
            <Icon size={16} color={toneColors(tone).fg} />
          </View>
        ) : null}
        <AppText variant="caption" numberOfLines={2} style={{ flex: 1 }}>{label}</AppText>
      </View>
      {insufficient ? (
        <View style={{ gap: 2 }}>
          <AppText variant="bodyStrong" color={theme.color.textSecondary}>{t('states.insufficientData')}</AppText>
          <AppText variant="caption" color={theme.color.textTertiary} numberOfLines={3}>{t('states.insufficientDataDetail', { n: minSample })}</AppText>
        </View>
      ) : (
        <AppText variant="metric" maxFontSizeMultiplier={1.3}>{value}</AppText>
      )}
      {!insufficient && (deltaText || hint) ? (
        <AppText variant="caption" tone={delta && delta > 0 ? 'success' : delta && delta < 0 ? 'danger' : undefined} numberOfLines={2}>
          {[deltaText, hint].filter(Boolean).join(' · ')}
        </AppText>
      ) : null}
    </View>
  );
}

/** Two-column responsive KPI grid. */
export function KpiGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export interface BarDatum { key: string; label: string; value: number; note?: string | null }

/** Horizontal bar chart built from Views (no chart library). Direct labels, values at bar end. */
export function BarChart({ data, color = theme.chart.categorical[0], formatValue = String, max, accessibilityLabel }: {
  data: BarDatum[]; color?: string; formatValue?: (n: number) => string; max?: number; accessibilityLabel?: string;
}) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  const summary = accessibilityLabel ?? data.map((d) => `${d.label}: ${formatValue(d.value)}`).join(', ');
  return (
    <View style={styles.chart} accessible accessibilityLabel={summary}>
      {data.map((d) => (
        <View key={d.key} style={styles.barRow}>
          <View style={styles.barLabelRow}>
            <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>{d.label}</AppText>
            <AppText variant="bodyStrong" style={styles.num}>{formatValue(d.value)}</AppText>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.bar, { width: `${Math.max(d.value > 0 ? 2 : 0, (d.value / top) * 100)}%`, backgroundColor: color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Funnel: each stage bar relative to the first stage, with step conversion shown. */
export function FunnelBars({ stages, formatValue = String, conversionLabel }: {
  stages: BarDatum[]; formatValue?: (n: number) => string; conversionLabel?: (pct: number) => string;
}) {
  const top = Math.max(1, ...stages.map((s) => s.value));
  return (
    <View style={styles.chart} accessible accessibilityLabel={stages.map((s) => `${s.label}: ${formatValue(s.value)}`).join(', ')}>
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].value : null;
        const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        const shade = theme.chart.sequential[Math.min(theme.chart.sequential.length - 1, 2 + Math.floor((i / Math.max(1, stages.length - 1)) * 4))];
        return (
          <View key={s.key} style={styles.barRow}>
            <View style={styles.barLabelRow}>
              <AppText variant="subheading" numberOfLines={1} style={{ flex: 1 }}>{s.label}</AppText>
              <AppText variant="bodyStrong" style={styles.num}>{formatValue(s.value)}</AppText>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.bar, styles.funnelBar, { width: `${Math.max(s.value > 0 ? 2 : 0, (s.value / top) * 100)}%`, backgroundColor: shade }]} />
            </View>
            {conv !== null && conversionLabel ? <AppText variant="caption" color={theme.color.textTertiary}>{conversionLabel(conv)}</AppText> : null}
            {s.note ? <AppText variant="caption" color={theme.color.textTertiary}>{s.note}</AppText> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  kpi: {
    flexGrow: 1, flexBasis: '46%', minWidth: 150, gap: 6, padding: 14, borderRadius: theme.radius.lg,
    backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border,
  },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kpiIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chart: { gap: 12 },
  barRow: { gap: 4 },
  barLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  num: { fontVariant: ['tabular-nums'] },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: theme.color.surfaceSunken, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 5 },
  funnelBar: { borderRadius: 5 },
});
