import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import {
  AppText, Button, ChipGroup, IconButton, KeyValue, ListGroup, ListItem, LoadingState, QueryState, Screen, SectionTitle, StatusText,
  theme, useFormat,
} from '@hangyul/mobile-ui';
import type { Program, UniversityDetail } from '@hangyul/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ExternalLink, Heart } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ReasonLine } from '../../src/components';
import { matchMeta } from '../../src/journey';
import { qk, useDashboard, useSaved } from '../../src/queries';
import { useMatches } from '../(tabs)/explore';
import { CampusBanner } from '../../src/campus';

export default function UniversityScreen() {
  const { slug, program } = useLocalSearchParams<{ slug: string; program?: string }>();
  const api = useApi();
  const q = useQuery({ queryKey: qk.university(slug), queryFn: () => api.catalog.university(slug), enabled: !!slug, retry: false });
  // V27 (brief §14, §44): a quick-fit row can open any of the ~425 directory institutions. Only ten are in the
  // application catalogue; the rest are a directory page (verified facts), exactly as on the web — never an error.
  const notInCatalogue = q.isError && (q.error as { status?: number }).status === 404;
  return (
    <Screen onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: q.data?.name_en ?? '' }} />
      {notInCatalogue ? <DirectoryUniversity slug={slug} /> : (
        <QueryState query={q} loading={<LoadingState hero rows={4} />}>{(u) => <><Detail u={u} initialProgram={program} /><VerifiedFacts slug={slug} /></>}</QueryState>
      )}
    </Screen>
  );
}

/** V27: a directory-only institution — name, place, verified scholarships and language rules, official links. */
function DirectoryUniversity({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const q = useQuery({ queryKey: ['directory', slug], queryFn: () => api.directory.institution(slug) });
  return (
    <QueryState query={q} loading={<LoadingState hero rows={3} />}>
      {(inst) => (
        <>
          <Stack.Screen options={{ title: (i18n.language === 'ko' || !inst.name_en ? inst.name_ko : inst.name_en) ?? '' }} />
          <AppText variant="title">{i18n.language === 'ko' || !inst.name_en ? inst.name_ko : inst.name_en}</AppText>
          <AppText variant="body" secondary>{t(`common:region.${inst.region}`, { defaultValue: inst.region })}</AppText>
          <VerifiedFacts slug={slug} />
          {inst.website_url ? (
            <ListGroup><ListItem icon={ExternalLink} title={t('v3.university.website')} onPress={() => void Linking.openURL(inst.website_url!)} /></ListGroup>
          ) : null}
        </>
      )}
    </QueryState>
  );
}

/** V27: the same verified scholarship summary and language rules the web page shows (one endpoint, one rule). */
function VerifiedFacts({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const q = useQuery({ queryKey: ['inst-admissions', slug], queryFn: () => api.directory.admissions(slug, {}), retry: false });
  const d = q.data;
  if (!d) return null;
  const nameOf = (s: { name: string; name_en: string | null }) => (i18n.language === 'ko' || !s.name_en ? s.name : s.name_en);
  const best = [...d.scholarships].filter((s) => s.stage !== 'ENROLLED').sort((a, b) => (b.waiver_max ?? 0) - (a.waiver_max ?? 0))[0];
  const rules = d.language_rules.BACHELOR ?? d.language_rules.MASTER ?? [];
  const apply = rules.filter((r) => r.stage === 'APPLICATION' && r.test !== 'OTHER' && r.test !== 'NONE_REQUIRED');
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle title={t('common:uni27.schol.title')} />
      {best ? (
        <ListGroup>
          <ListItem title={nameOf(best)} subtitle={best.waiver_max != null ? t('common:uni27.schol.waiver', { pct: best.waiver_max }) : t('common:uni27.schol.benefitOnPage')}
            meta={t('common:uni27.schol.count', { count: d.scholarships.length })} />
        </ListGroup>
      ) : <AppText variant="body" secondary>{t('common:uni27.schol.notVerified')}</AppText>}
      {apply.length ? (
        <>
          <SectionTitle title={t('common:uni27.intl.language')} />
          <ListGroup>
            {(['KOREAN', 'ENGLISH', 'ANY'] as const).filter((tr) => apply.some((r) => r.track === tr)).map((tr) => (
              <ListItem key={tr} title={tr === 'ANY' ? t('common:uni27.intl.allTracks') : t(`common:fit.track.${tr}`)}
                subtitle={apply.filter((r) => r.track === tr).map((r) => `${t(`common:fit.test.${r.test}`, { defaultValue: r.test })}${r.min ? ` ${r.min}` : ''}`).join(t('common:fit.or'))} />
            ))}
          </ListGroup>
        </>
      ) : null}
    </View>
  );
}

/** First screen answers: right for me? eligible? how much? when? what's missing? what do I do? */
function Detail({ u, initialProgram }: { u: UniversityDetail; initialProgram?: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const qc = useQueryClient();
  const saved = useSaved();
  const matches = useMatches();
  const byProgram = useMemo(() => new Map((matches.data?.items ?? []).map((m) => [m.program_id, m])), [matches.data]);
  const ranked = useMemo(() => [...u.programs].sort((a, b) => (byProgram.get(b.id)?.score ?? -1) - (byProgram.get(a.id)?.score ?? -1)), [u.programs, byProgram]);
  const [pid, setPid] = useState<string>(initialProgram ?? ranked[0]?.id ?? '');
  const p: Program | undefined = u.programs.find((x) => x.id === pid) ?? ranked[0];
  const m = p ? byProgram.get(p.id) : undefined;
  // V4: a program the student already applied to offers "Continue your application", never a second start.
  const dash = useDashboard();
  const existing = p ? (dash.data?.applications ?? []).find((a) => a.program.id === p.id && !['WITHDRAWN', 'REJECTED'].includes(a.status)) : undefined;
  const range = m?.first_year_range_krw ?? p?.first_year_range_krw;
  const hasRange = !!(range?.low && range.high);
  const isSaved = !!saved.data?.some((s) => s.id === u.id);
  const toggle = useMutation({ mutationFn: () => (isSaved ? api.me.unsave(u.id) : api.me.save(u.id, p?.id)), onSettled: () => qc.invalidateQueries({ queryKey: qk.saved }) });
  const start = useMutation({
    mutationFn: () => api.applications.create(p!.id, m?.intake_id ?? undefined),
    onSuccess: (a) => { void qc.invalidateQueries({ queryKey: qk.applications }); void qc.invalidateQueries({ queryKey: qk.dashboard }); router.replace(`/applications/${a.id}`); },
  });

  const today = new Date().toISOString().slice(0, 10);
  const next = p ? (p.intakes ?? []).filter((i) => i.is_open && i.application_deadline >= today).sort((a, b) => a.application_deadline.localeCompare(b.application_deadline))[0] ?? p.next_intake ?? null : null;
  const tuitionYear = p?.tuition_per_semester_krw ? p.tuition_per_semester_krw * 2 : null;
  const livingYear = u.est_living_cost_monthly_krw ? u.est_living_cost_monthly_krw * 12 : null;
  const dorm = u.dormitories[0];
  const meta = m ? matchMeta(m.tier) : null;
  const reasons = m ? [...m.reasons].sort((a, b) => ({ missing: 0, warning: 1, met: 2, info: 3 })[a.kind] - ({ missing: 0, warning: 1, met: 2, info: 3 })[b.kind]) : [];
  const req = p?.requirements;

  return (
    <>
      {/* V25: the same campus photograph as the web page opens the native one (REPORT §313 S9). */}
      <CampusBanner photo={u.photo} name={u.name_en} />
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" accessibilityRole="header">{u.name_en}</AppText>
          <AppText variant="caption">{u.name_ko} · {u.city} · {t(`common:institution.${u.institution_type}`)}</AppText>
        </View>
        <IconButton icon={Heart} color={isSaved ? theme.color.primary : theme.color.textTertiary}
          accessibilityLabel={isSaved ? t('student.explore.unsave', { name: u.name_en }) : t('student.explore.save', { name: u.name_en })} onPress={() => toggle.mutate()} />
      </View>

      {ranked.length > 1 ? (
        <View style={{ gap: 6 }}>
          <AppText variant="label">{t('v3.university.program')}</AppText>
          <ChipGroup options={ranked.map((x) => ({ value: x.id, label: x.name_en }))} selected={[pid]} onToggle={setPid} />
        </View>
      ) : null}

      {p ? (
        <View style={styles.decision}>
          <AppText variant="heading">{p.name_en}</AppText>
          <AppText variant="caption">{t(`common:degree.${p.degree_level}`)} · {t(`common:instruction.${p.instruction_language}`)}</AppText>
          {meta ? (
            <View style={{ gap: 6, marginTop: 6 }}>
              <StatusText label={t(meta.key)} tone={meta.tone} />
              <AppText variant="body">{t(`v3.university.verdict.${m!.tier}`, { met: reasons.filter((r) => r.kind === 'met').length })}</AppText>
              {reasons.slice(0, 4).map((r) => <ReasonLine key={r.code} reason={r} />)}
            </View>
          ) : <AppText variant="body" secondary>{t('v3.university.noVerdict')}</AppText>}
          <View style={styles.rule} />
          <KeyValue label={t('v3.university.deadline')} value={next ? `${f.deadline(next.application_deadline)} · ${f.due(next.application_deadline)}` : t('v3.university.noIntake')} />
          <KeyValue label={t('v3.university.intake')} value={next ? t('common:intakeLabel', { term: t(`common:term.${next.term}`), year: next.year }) : '—'} />
          <KeyValue label={t('v3.university.fee')} value={p.application_fee_krw ? f.money(p.application_fee_krw) : '—'} />
          <View style={styles.rule} />
          <AppText variant="subheading">{t('v3.university.yearCost')}</AppText>
          {hasRange ? <KeyValue label={t('v4.university.firstYear')} value={range!.low === range!.high ? f.money(range!.low) : `${f.money(range!.low, 'KRW', true)}–${f.money(range!.high, 'KRW', true)}`} /> : null}
          <KeyValue label={t('v4.university.tuitionYear')} value={tuitionYear ? f.money(tuitionYear) : '—'} />
          {!hasRange ? <KeyValue label={t('v3.university.living')} value={livingYear ? f.money(livingYear) : '—'} /> : null}
          {!hasRange && dorm?.cost_per_semester_krw_min ? <KeyValue label={t('v3.university.dorm')} value={t('v3.university.dormRange', { min: f.money(dorm.cost_per_semester_krw_min, 'KRW', true), max: f.money(dorm.cost_per_semester_krw_max ?? dorm.cost_per_semester_krw_min, 'KRW', true) })} /> : null}
          {!hasRange ? <KeyValue label={t('v3.university.estimate')} value={tuitionYear && livingYear ? `≈ ${f.money(tuitionYear + livingYear, 'KRW', true)}` : '—'} /> : null}
          <AppText variant="caption" color={theme.color.textTertiary}>{p.verification_status === 'DEMO' ? t('common:freshness.unverified') : t('v3.university.estimateNote')}</AppText>
          {existing ? <Button label={t('v4.university.continue')} onPress={() => router.push(`/applications/${existing.id}`)} fullWidth style={{ marginTop: 8 }} />
            : next ? <Button label={t('v3.university.start')} onPress={() => start.mutate()} loading={start.isPending} fullWidth style={{ marginTop: 8 }} /> : null}
          {start.isError ? <AppText variant="caption" tone="danger" accessibilityRole="alert">{(start.error as Error).message}</AppText> : null}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <SectionTitle title={t('v3.university.requirements')} />
        <ListGroup>
          <ListItem title={t('v3.university.language')} subtitle={[req?.min_topik_level ? `TOPIK ${req.min_topik_level}` : null, req?.min_ielts ? `IELTS ${req.min_ielts}` : null, req?.min_toefl_ibt ? `TOEFL iBT ${req.min_toefl_ibt}` : null].filter(Boolean).join(' / ') || t('v3.discover.noLanguageMin')} />
          <ListItem title={t('v3.university.gpa')} subtitle={req?.min_gpa_percent ? t('v3.university.gpaMin', { pct: req.min_gpa_percent }) : t('v3.university.notPublished')} />
          <ListItem title={t('v3.university.documents')} subtitle={t('v3.university.documentsCount', { count: u.required_documents.length, legal: u.required_documents.filter((d) => d.legalization_required).length })} />
          {req?.requires_interview ? <ListItem title={t('v3.university.interview')} subtitle={t('v3.university.interviewYes')} /> : null}
        </ListGroup>
      </View>

      {/* V27: scholarships come from the verified record (VerifiedFacts below) — the seeded sample list is gone. */}

      <View style={{ gap: 8 }}>
        <SectionTitle title={t('v3.university.links')} />
        <ListGroup>
          {u.international_admissions_url ? <ListItem icon={ExternalLink} title={t('v3.university.admissionsSite')} onPress={() => void Linking.openURL(u.international_admissions_url!)} /> : null}
          {u.website_url ? <ListItem icon={ExternalLink} title={t('v3.university.website')} onPress={() => void Linking.openURL(u.website_url!)} /> : null}
        </ListGroup>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  decision: { backgroundColor: theme.color.surface, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.color.border, padding: 18, gap: 4 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border, marginVertical: 10 },
});
