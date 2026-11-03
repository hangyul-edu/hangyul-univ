import { useTranslation } from '@hangyul/i18n';
import { Check, ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { flipStyle, theme, toneColors, type Tone } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

/**
 * V3 composition patterns for mobile. Hierarchy comes from type, spacing and hairlines — not from
 * boxes, pills or icon chips. One primary action per area.
 */

/** Status as a coloured dot + words. The default way to show state in lists. */
export function StatusText({ label, tone = 'neutral', hollow, style }: { label: string; tone?: Tone; hollow?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = toneColors(tone);
  return (
    <View style={[styles.status, style]} accessible accessibilityLabel={label}>
      <View style={[styles.dot, hollow ? { borderWidth: 1.5, borderColor: c.solid } : { backgroundColor: c.solid }]} />
      <AppText variant="caption" weight="semibold" color={theme.color.text} numberOfLines={1}>{label}</AppText>
    </View>
  );
}

/** Small uppercase-free section label + optional trailing action link. */
export function SectionTitle({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sectionTitle, style]}>
      <AppText variant="subheading" accessibilityRole="header" style={{ flex: 1 }}>{title}</AppText>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={action} hitSlop={12} style={styles.sectionAction}>
          <AppText variant="caption" weight="semibold" color={theme.color.textSecondary}>{action}</AppText>
          <ChevronRight size={14} color={theme.color.textTertiary} style={flipStyle()} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The one dominant block on a home screen: what to do now. */
export function NextAction({ eyebrow, title, body, meta, actionLabel, onAction, secondaryLabel, onSecondary, icon: Icon }: {
  eyebrow: string; title: string; body?: string | null; meta?: string | null; actionLabel?: string; onAction?: () => void;
  secondaryLabel?: string; onSecondary?: () => void; icon?: LucideIcon;
}) {
  return (
    <View style={styles.next} accessibilityRole="summary">
      <View style={styles.nextAccent} />
      <AppText variant="caption" weight="semibold" color={theme.color.primaryText}>{eyebrow}</AppText>
      <AppText variant="title" accessibilityRole="header">{title}</AppText>
      {body ? <AppText variant="body" secondary>{body}</AppText> : null}
      {meta ? <AppText variant="caption">{meta}</AppText> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} icon={Icon} fullWidth style={{ marginTop: 6 }} /> : null}
      {secondaryLabel && onSecondary ? (
        <Pressable onPress={onSecondary} accessibilityRole="button" accessibilityLabel={secondaryLabel} hitSlop={8} style={styles.nextSecondary}>
          <AppText variant="caption" weight="semibold" color={theme.color.textSecondary}>{secondaryLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Compact journey indicator: one row of segments + "Step 3 of 6 · Apply". Tapping a stage is left to the screen. */
export function JourneySteps({ stages, current, onPress }: { stages: string[]; current: number; onPress?: () => void }) {
  const { t } = useTranslation('mobile');
  const label = t('v3.journey.step', { n: current + 1, total: stages.length, stage: stages[current] ?? '' });
  const body = (
    <View style={{ gap: 8 }}>
      <View style={styles.segments}>
        {stages.map((s, i) => (
          <View key={s} style={[styles.segment, i < current && styles.segDone, i === current && styles.segNow]} />
        ))}
      </View>
      <View style={styles.journeyLabels}>
        <AppText variant="caption" weight="semibold" color={theme.color.text}>{stages[current]}</AppText>
        <AppText variant="caption" color={theme.color.textTertiary}>{t('v3.journey.of', { n: current + 1, total: stages.length })}</AppText>
        {current + 1 < stages.length ? <AppText variant="caption" color={theme.color.textTertiary} style={{ flex: 1, textAlign: 'right' }} numberOfLines={1}>{t('v3.journey.next', { stage: stages[current + 1] })}</AppText> : null}
      </View>
    </View>
  );
  if (!onPress) return <View accessible accessibilityLabel={label}>{body}</View>;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{body}</Pressable>;
}

/** Dated row for "coming up" lists. */
export function DateRow({ day, month, title, meta, onPress, urgent }: { day: string; month: string; title: string; meta?: string | null; onPress?: () => void; urgent?: boolean }) {
  const inner = (
    <>
      <View style={styles.dateBlock}>
        <AppText variant="heading" color={urgent ? theme.status.danger.fg : theme.color.text}>{day}</AppText>
        <AppText variant="label" color={theme.color.textTertiary}>{month}</AppText>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" numberOfLines={2}>{title}</AppText>
        {meta ? <AppText variant="caption" color={urgent ? theme.status.danger.fg : theme.color.textTertiary}>{meta}</AppText> : null}
      </View>
    </>
  );
  if (!onPress) return <View style={styles.dateRow} accessible accessibilityLabel={`${title}. ${meta ?? ''}`}>{inner}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${meta ?? ''}`} android_ripple={{ color: 'rgba(24,26,31,0.06)' }}
      style={({ pressed }) => [styles.dateRow, pressed && Platform.OS === 'ios' && { opacity: 0.6 }]}>
      {inner}
    </Pressable>
  );
}

export interface LaneItem {
  label: string; state: 'done' | 'active' | 'todo' | 'blocked';
  /** V4: why / what exactly (one line), shown under the label. */
  detail?: string | null;
  /** V4: warning line (e.g. a review past its target). */
  warning?: string | null;
  /** V4: the one action for this item (a lane is the application's single checklist, so actions live here). */
  actionLabel?: string; onAction?: () => void; disabled?: boolean;
  /** Tapping the row opens it (chevron shown) when there is no action button. */
  onPress?: () => void;
}
/** Who is doing what: You · Counselor · University. Each lane lists its items with ✓ / ● / ○ / !. */
export function Lanes({ lanes }: { lanes: { title: string; summary?: string; items: LaneItem[] }[] }) {
  return (
    <View style={styles.lanes}>
      {lanes.map((l, i) => (
        <View key={l.title} style={[styles.lane, i > 0 && styles.laneDivider]}>
          <AppText variant="label" color={theme.color.text}>{l.title}</AppText>
          {l.summary ? <AppText variant="caption">{l.summary}</AppText> : null}
          {l.items.map((it, j) => {
            const body = (
              <>
                <View style={styles.laneMarkWrap}><LaneMark state={it.state} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant={it.detail || it.onAction ? 'body' : 'caption'} weight={it.state === 'blocked' || it.onAction ? 'semibold' : undefined}
                    color={it.state === 'todo' && !it.onAction ? theme.color.textTertiary : theme.color.text}>{it.label}</AppText>
                  {it.detail ? <AppText variant="caption" numberOfLines={3}>{it.detail}</AppText> : null}
                  {it.warning ? <AppText variant="caption" tone="warning">{it.warning}</AppText> : null}
                </View>
                {it.actionLabel && it.onAction ? <Button label={it.actionLabel} size="sm" variant="secondary" onPress={it.onAction} disabled={it.disabled} /> : null}
                {!it.onAction && it.onPress ? <ChevronRight size={16} color={theme.color.textTertiary} style={flipStyle()} /> : null}
              </>
            );
            return !it.onAction && it.onPress ? (
              <Pressable key={`${it.label}-${j}`} onPress={it.onPress} accessibilityRole="button" style={({ pressed }) => [styles.laneItem, (it.detail || it.warning) && styles.laneItemRich, pressed && { opacity: 0.6 }]}>{body}</Pressable>
            ) : (
              <View key={`${it.label}-${j}`} style={[styles.laneItem, (it.detail || it.warning || it.onAction) && styles.laneItemRich]} accessible={!it.onAction} accessibilityLabel={[it.label, it.detail, it.warning].filter(Boolean).join('. ')}>{body}</View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function LaneMark({ state }: { state: LaneItem['state'] }) {
  if (state === 'done') return <View style={[styles.mark, styles.markDone]}><Check size={10} color="#FFFFFF" strokeWidth={3.2} /></View>;
  if (state === 'blocked') return <View style={[styles.mark, { backgroundColor: theme.status.danger.solid, borderColor: theme.status.danger.solid }]}><AppText variant="label" color="#FFFFFF" style={styles.markBang}>!</AppText></View>;
  if (state === 'active') return <View style={[styles.mark, { borderColor: theme.color.primary }]}><View style={styles.markActive} /></View>;
  return <View style={styles.mark} />;
}

/** A defined metric: value + "numerator of denominator · population/period" + definition. Never a bare number. */
export function MetricRow({ label, value, detail, definition, insufficient, insufficientLabel }: {
  label: string; value: string; detail?: string | null; definition?: string | null; insufficient?: boolean; insufficientLabel?: string;
}) {
  return (
    <View style={styles.metric} accessible accessibilityLabel={[label, insufficient ? insufficientLabel : value, detail, definition].filter(Boolean).join('. ')}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body">{label}</AppText>
        {detail ? <AppText variant="caption" color={theme.color.textTertiary}>{detail}</AppText> : null}
        {definition ? <AppText variant="caption" color={theme.color.textTertiary} numberOfLines={2}>{definition}</AppText> : null}
      </View>
      <AppText variant={insufficient ? 'caption' : 'heading'} color={insufficient ? theme.color.textTertiary : theme.color.text} style={{ textAlign: 'right', maxWidth: '45%' }}>
        {insufficient ? insufficientLabel : value}
      </AppText>
    </View>
  );
}

/** Generic bottom sheet with a title, scrollable body and footer actions. */
export function Sheet({ visible, title, onClose, closeLabel, children, footer }: {
  visible: boolean; title: string; onClose: () => void; closeLabel: string; children: ReactNode; footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
        <View style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 8) }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <AppText variant="title" accessibilityRole="header">{title}</AppText>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 16, paddingVertical: 4 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          {footer ?? <Button label={closeLabel} variant="secondary" onPress={onClose} />}
        </View>
      </View>
    </Modal>
  );
}

/** Numbered process step: ✓ when done, number otherwise; optional toggle; source line underneath. */
export function StepRow({ n, title, detail, meta, done, blocked, onToggle, onPressMeta, disabled }: {
  n: number; title: string; detail?: string | null; meta?: string | null; done?: boolean; blocked?: boolean;
  onToggle?: (next: boolean) => void; onPressMeta?: () => void; disabled?: boolean;
}) {
  const mark = (
    <View style={[styles.stepMark, done && styles.markDone, blocked && !done && { opacity: 0.5 }]}>
      {done ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : <AppText variant="label" color={theme.color.textSecondary}>{n}</AppText>}
    </View>
  );
  return (
    <View style={[styles.step, blocked && !done && { opacity: 0.7 }]}>
      {onToggle ? (
        <Pressable onPress={() => onToggle(!done)} disabled={disabled || (blocked && !done)} accessibilityRole="checkbox" accessibilityState={{ checked: !!done, disabled: !!disabled || (!!blocked && !done) }}
          accessibilityLabel={title} hitSlop={10}>{mark}</Pressable>
      ) : <View accessible accessibilityLabel={`${n}. ${title}`}>{mark}</View>}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" color={done ? theme.color.textSecondary : theme.color.text}>{title}</AppText>
        {detail ? <AppText variant="caption">{detail}</AppText> : null}
        {meta ? (
          onPressMeta ? (
            <Pressable onPress={onPressMeta} accessibilityRole="link" accessibilityLabel={meta} hitSlop={8} style={{ minHeight: 28, justifyContent: 'center' }}>
              <AppText variant="caption" color={theme.color.textTertiary} style={{ textDecorationLine: 'underline' }}>{meta}</AppText>
            </Pressable>
          ) : <AppText variant="caption" color={theme.color.textTertiary}>{meta}</AppText>
        ) : null}
      </View>
    </View>
  );
}

/** Quiet key/value line used in detail screens. */
export function KeyValue({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <View style={styles.kv}>
      <AppText variant="caption" color={theme.color.textTertiary} style={{ flex: 1 }}>{label}</AppText>
      <AppText variant="body" weight="semibold" color={tone ? toneColors(tone).fg : theme.color.text} style={{ flexShrink: 1, textAlign: 'right' }}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingStart: 12 },
  next: {
    backgroundColor: theme.color.surface, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.color.border,
    padding: 20, paddingStart: 22, gap: 6, overflow: 'hidden',
  },
  nextAccent: { position: 'absolute', top: 20, bottom: 20, start: 0, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: theme.color.primary },
  nextSecondary: { minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.color.surfaceSunken },
  segDone: { backgroundColor: theme.color.text },
  segNow: { backgroundColor: theme.color.primary },
  journeyLabels: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 8 },
  dateBlock: { width: 40, alignItems: 'center' },
  lanes: { backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border },
  lane: { padding: 14, gap: 6 },
  laneDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },
  laneItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  laneItemRich: { alignItems: 'flex-start', paddingVertical: 4 },
  laneMarkWrap: { paddingTop: 2 },
  mark: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: theme.color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  markDone: { backgroundColor: theme.color.text, borderColor: theme.color.text },
  markActive: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.color.primary },
  markBang: { fontSize: 10, lineHeight: 12 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, paddingHorizontal: 16 },
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.color.overlay },
  sheet: { backgroundColor: theme.color.surface, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: 20, gap: 12, maxHeight: '88%' },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: theme.color.borderStrong, marginBottom: 4 },
  kv: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  step: { flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  stepMark: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: theme.color.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
