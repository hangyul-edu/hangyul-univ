import { useTranslation, localName } from '@hangyul/i18n';
import { AppText, Badge, Card, Row, StatusBadge, theme, useFormat } from '@hangyul/mobile-ui';
import type { Match, MatchReason } from '@hangyul/types';
import { router } from 'expo-router';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

const reasonIcon: Record<MatchReason['kind'], { icon: LucideIcon; color: string }> = {
  met: { icon: CircleCheck, color: theme.status.success.solid },
  missing: { icon: CircleAlert, color: theme.status.danger.solid },
  warning: { icon: TriangleAlert, color: theme.status.warning.solid },
  info: { icon: Info, color: theme.status.info.solid },
};

/** Localised match reason (falls back to the server's English text). */
export function useReasonText() {
  const { t } = useTranslation();
  return (r: MatchReason) => t(`common:matchReason.${r.code}`, { ...r.params, defaultValue: r.text });
}

export function ReasonLine({ reason }: { reason: MatchReason }) {
  const text = useReasonText();
  const { icon: Icon, color } = reasonIcon[reason.kind] ?? reasonIcon.info;
  return (
    <Row gap={8} align="flex-start">
      <Icon size={16} color={color} style={{ marginTop: 2 }} />
      <AppText variant="caption" color={theme.color.text} style={{ flex: 1 }}>{text(reason)}</AppText>
    </Row>
  );
}

/** Match card: tier + reasons. Never shows an admission probability. */
export function MatchCard({ match, maxReasons = 3 }: { match: Match; maxReasons?: number }) {
  const { t } = useTranslation();
  const f = useFormat();
  const uni = match.program.university;
  const reasons = [...match.reasons].sort((a, b) => order(a.kind) - order(b.kind)).slice(0, maxReasons);
  return (
    <Card
      onPress={uni ? () => router.push(`/universities/${uni.slug}`) : undefined}
      accessibilityLabel={`${localName(match.program)}, ${uni?.name_en ?? ''}, ${t(`common:tier.${match.tier}`)}`}
    >
      <Row justify="space-between" align="flex-start">
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading" numberOfLines={2}>{localName(match.program)}</AppText>
          {uni ? <AppText variant="caption" numberOfLines={1}>{uni.name_en} · {t(`common:region.${uni.region}`, { defaultValue: uni.region })}</AppText> : null}
        </View>
      </Row>
      <Row wrap gap={6}>
        <StatusBadge kind="tier" value={match.tier} />
        {match.recommended ? <Badge label={t('common:tier.RECOMMENDED')} tone="brand" /> : null}
        <Badge label={t(`common:degreeShort.${match.program.degree_level}`)} tone="neutral" />
      </Row>
      <View style={{ gap: 6 }}>
        {reasons.map((r) => <ReasonLine key={r.code} reason={r} />)}
      </View>
      {match.intake ? (
        <AppText variant="caption">
          {t('student.matches.deadline', { date: f.deadline(match.intake.application_deadline), due: f.due(match.intake.application_deadline) })}
        </AppText>
      ) : null}
    </Card>
  );
}

const order = (k: MatchReason['kind']) => ({ missing: 0, warning: 1, met: 2, info: 3 })[k] ?? 4;
