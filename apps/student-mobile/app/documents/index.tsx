/**
 * PRIMARY QUESTION: "Which documents does each part of my application need, and what is left?"
 *
 * Owner pass 261119 (req 6) — the native document manager on the Saramin interaction model, built from the same
 * grouping the web uses (`@hangyul/utils` docGroups: groups, status, summaries, completion, base set, required
 * protection, the "구분" add list). Each group is a section with a header (name, 필수/선택, one-line summary) and an
 * explicit `+`/`−` disclosure; optional sections take no space until the student adds them from the bottom sheet;
 * required items can collapse but are never removable; an empty optional record the student added is removable after
 * a confirmation. University requests stay first — they are the most urgent thing on the page.
 */
import { useApi, useAuth } from '@hangyul/auth';
import { localName, useTranslation } from '@hangyul/i18n';
import {
  AppText, Button, Callout, EmptyState, IconButton, ListGroup, ListItem, LoadingState, ErrorState, prefs, ProgressBar, Screen, SectionTitle, Sheet,
  StatusText, theme, UploadSheet, useFormat, v3, type PickedFile, type Tone,
} from '@hangyul/mobile-ui';
import type { DocumentCategory, Dossier } from '@hangyul/types';
import {
  ADD_TYPES, addTypeOf, buildLayout, canHide, canRemove, defaultExpanded, DOC_PREFS_KEY, groupSummary, sanitizeDocPrefs,
  type AddType, type DocGroup, type DocGroupId, type DocItem, type DocPrefs, type ItemStatus,
} from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CircleAlert, CircleCheck, FileText, Lock, Minus, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { qk } from '../../src/queries';

const STATUS_TONE: Record<ItemStatus, Tone> = {
  missing: 'neutral', uploaded: 'info', review: 'info', fix: 'danger', action: 'warning', verified: 'success', expired: 'danger',
};

/** Per-viewer state (opened optional groups, added records), kept on the device for this account. */
function useDocPrefs(userId: string | undefined) {
  const key = `${DOC_PREFS_KEY}.${userId ?? 'anon'}`;
  const [value, setValue] = useState<DocPrefs>({ opened: [], slots: [] });
  useEffect(() => {
    let live = true;
    void prefs.get(key).then((raw) => { if (live && raw) { try { setValue(sanitizeDocPrefs(JSON.parse(raw))); } catch { /* corrupt → defaults */ } } });
    return () => { live = false; };
  }, [key]);
  const update = useCallback((p: DocPrefs) => { setValue(p); void prefs.set(key, JSON.stringify(p)); }, [key]);
  return [value, update] as const;
}

type UploadPhase = { phase: 'idle' } | { phase: 'uploading'; name: string } | { phase: 'done'; name: string; id: string } | { phase: 'error'; name: string };

export default function DocumentsScreen() {
  const { t } = useTranslation();
  const api = useApi();
  const qc = useQueryClient();
  const { session } = useAuth();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const dossier = useQuery({ queryKey: ['dossier'], queryFn: () => api.dossier.me(), staleTime: 30_000 });
  const [docPrefs, setDocPrefs] = useDocPrefs(session?.user.id);
  const opened = useMemo(() => new Set<DocGroupId>(docPrefs.opened), [docPrefs.opened]);
  const layout = useMemo(() => (dossier.data ? buildLayout(dossier.data, docPrefs.slots, opened) : null), [dossier.data, docPrefs.slots, opened]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState(false);
  const [target, setTarget] = useState<{ category: DocumentCategory; label: string } | null>(null);
  const [status, setStatus] = useState<UploadPhase>({ phase: 'idle' });
  const groupName = (id: DocGroupId | 'requests') => t(`dossier:groups.name.${id}`);
  const itemName = (i: DocItem) => (i.slot ? t(`dossier:groups.types.${i.slot.type}`) : t(`common:docCategory.${i.category}`));

  const upload = useMutation({
    mutationFn: ({ file, category }: { file: PickedFile; category: DocumentCategory; label: string }) => v3.uploadDocument(api, file, { category }),
    onMutate: ({ label }) => setStatus({ phase: 'uploading', name: label }),
    onSuccess: (d, { label }) => {
      setStatus({ phase: 'done', name: label, id: d.id });
      ['dossier', 'documents', 'dashboard'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
      void qc.invalidateQueries({ queryKey: qk.documents });
    },
    onError: (_e, { label }) => setStatus({ phase: 'error', name: label }),
  });

  const isOpen = (g: DocGroup) => expanded[g.id] ?? (defaultExpanded(g) || (!!focus && g.items.some((i) => i.category === focus)));
  const toggle = (g: DocGroup) => setExpanded((e) => ({ ...e, [g.id]: !isOpen(g) }));
  const openGroup = (id: DocGroupId) => {
    if (!opened.has(id)) setDocPrefs({ ...docPrefs, opened: [...docPrefs.opened, id] });
    setExpanded((e) => ({ ...e, [id]: true }));
    setSheet(false);
  };
  const addSlot = (type: AddType) => {
    const a = addTypeOf(type);
    setDocPrefs({
      opened: docPrefs.opened.includes(a.group) ? docPrefs.opened : [...docPrefs.opened, a.group],
      slots: [...docPrefs.slots, { id: `${type}-${Date.now().toString(36)}`, type }],
    });
    setExpanded((e) => ({ ...e, [a.group]: true }));
    setSheet(false);
  };
  const confirm = (title: string, onYes: () => void) => Alert.alert(title, undefined, [
    { text: t('common:actions.cancel'), style: 'cancel' },
    { text: t('dossier:item.remove'), style: 'destructive', onPress: onYes },
  ]);
  const removeItem = (i: DocItem) => {
    if (!canRemove(i)) return; // required items and records holding a file are never removable
    confirm(t('dossier:item.removeConfirm', { name: itemName(i) }), () => setDocPrefs({ ...docPrefs, slots: docPrefs.slots.filter((s) => s.id !== i.slot?.id) }));
  };
  const hideGroup = (g: DocGroup) => {
    if (!canHide(g)) { setExpanded((e) => ({ ...e, [g.id]: false })); return; }
    const slots = docPrefs.slots.filter((s) => addTypeOf(s.type).group !== g.id);
    const apply = () => setDocPrefs({ opened: docPrefs.opened.filter((x) => x !== g.id), slots });
    if (slots.length !== docPrefs.slots.length) confirm(t('dossier:item.removeConfirm', { name: groupName(g.id) }), apply); else apply();
  };
  const onItem = (i: DocItem) => {
    const doc = i.row?.document;
    if (doc) { router.push(`/documents/${doc.id}`); return; }
    if (i.row?.essay) { router.push('/tasks'); return; }
    setTarget({ category: i.category, label: itemName(i) });
  };

  return (
    <Screen onRefresh={() => dossier.refetch()}>
      <Stack.Screen options={{ title: t('common:nav.documents') }} />
      {dossier.isPending ? <LoadingState rows={5} /> : dossier.isError && !dossier.data ? (
        <ErrorState error={dossier.error} onRetry={() => void dossier.refetch()} />
      ) : layout && dossier.data ? (
        <>
          <View style={{ gap: 8 }}>
            <AppText variant="title" accessibilityRole="header">{t('dossier:groups.progressLine', { done: layout.progress.done, total: layout.progress.total })}</AppText>
            <ProgressBar value={layout.progress.pct} tone="brand" height={6} accessibilityLabel={t('dossier:groups.progress', { pct: layout.progress.pct })} />
            {!layout.hasApplications ? <AppText variant="caption">{t('dossier:groups.baseNote')}</AppText> : null}
          </View>

          <UploadStatus status={status} onView={(id) => router.push(`/documents/${id}`)} onDismiss={() => setStatus({ phase: 'idle' })} />

          <Requests dossier={dossier.data} onUpload={(category, label) => setTarget({ category, label })} />

          {layout.groups.length === 0 ? <EmptyState icon={FileText} title={t('student.documents.empty')} body={t('student.documents.emptyBody')} /> : null}
          {layout.groups.map((g) => (
            <GroupSection key={g.id} group={g} name={groupName(g.id)} open={isOpen(g)} onToggle={() => toggle(g)} onHide={() => hideGroup(g)}
              itemName={itemName} onItem={onItem} onRemove={removeItem} focus={focus} />
          ))}

          <Button label={t('dossier:groups.addButton')} icon={Plus} variant="secondary" onPress={() => setSheet(true)} fullWidth />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Lock size={14} color={theme.color.textTertiary} style={{ marginTop: 2 }} />
            <AppText variant="caption" style={{ flex: 1 }}>{t('v3.upload.privacy')}</AppText>
          </View>

          <Sheet visible={sheet} title={t('dossier:groups.addTitle')} onClose={() => setSheet(false)} closeLabel={t('common:actions.cancel')}>
            <AppText variant="caption">{t('dossier:groups.addSub')}</AppText>
            <View style={{ gap: 8 }}>
              <AppText variant="subheading" accessibilityRole="header">{t('dossier:groups.type')}</AppText>
              <ListGroup>
                {ADD_TYPES.map((a) => (
                  <ListItem key={a.type} title={t(`dossier:groups.types.${a.type}`)} meta={groupName(a.group)} icon={Plus} iconColor={theme.color.primary}
                    accessibilityLabel={t('dossier:groups.quickAdd', { type: t(`dossier:groups.types.${a.type}`) })} onPress={() => addSlot(a.type)} chevron={false} />
                ))}
              </ListGroup>
            </View>
            {layout.addable.length ? (
              <View style={{ gap: 8 }}>
                <AppText variant="subheading" accessibilityRole="header">{t('dossier:groups.addSections')}</AppText>
                <ListGroup>
                  {layout.addable.map((a) => (
                    <ListItem key={a.id} title={groupName(a.id)} meta={a.optional ? t('dossier:groups.summary.suggested', { count: a.optional }) : null}
                      icon={Plus} iconColor={theme.color.primary} accessibilityLabel={t('dossier:groups.add', { name: groupName(a.id) })} onPress={() => openGroup(a.id)} chevron={false} />
                  ))}
                </ListGroup>
              </View>
            ) : null}
          </Sheet>
        </>
      ) : null}
      <UploadSheet visible={!!target} title={target ? t('v3.application.uploadFor', { item: target.label }) : ''} onClose={() => setTarget(null)}
        onPicked={(file) => target && upload.mutate({ file, category: target.category, label: target.label })} />
    </Screen>
  );
}

/** One group: header (name · 필수/선택 · one-line summary) with `+`/`−`, then its items when expanded. */
function GroupSection({ group: g, name, open, onToggle, onHide, itemName, onItem, onRemove, focus }: {
  group: DocGroup; name: string; open: boolean; onToggle: () => void; onHide: () => void; itemName: (i: DocItem) => string;
  onItem: (i: DocItem) => void; onRemove: (i: DocItem) => void; focus?: string;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const summary = groupSummary(t, g.counts);
  const Icon = open ? Minus : Plus;
  return (
    <View style={styles.section}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${open ? t('dossier:groups.close', { name }) : t('dossier:groups.open', { name })}. ${t(g.required ? 'dossier:groups.required' : 'dossier:groups.optional')}. ${summary}`}
        android_ripple={{ color: 'rgba(15,23,41,0.06)' }}
        style={({ pressed }) => [styles.sectionHead, pressed && Platform.OS === 'ios' && { opacity: 0.6 }]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <AppText variant="heading">{name}</AppText>
            <View style={[styles.chip, g.required ? styles.chipRequired : styles.chipOptional]}>
              <AppText variant="label" color={g.required ? theme.color.selected.fg : theme.color.textSecondary}>{t(g.required ? 'dossier:groups.required' : 'dossier:groups.optional')}</AppText>
            </View>
          </View>
          {summary ? <AppText variant="caption" numberOfLines={2}>{summary}</AppText> : null}
        </View>
        <View style={[styles.toggle, open && styles.toggleOpen]}>
          <Icon size={18} color={open ? theme.color.primary : theme.color.text} />
        </View>
      </Pressable>
      {open ? (
        <>
          {g.items.length ? (
            <ListGroup>
              {g.items.map((i) => {
                const label = t(`dossier:item.status.${i.row?.essay && !i.row.document && i.status === 'missing' ? 'toWrite' : i.status}`);
                const source = i.universities.length
                  ? t('dossier:item.neededBy', { list: i.universities.map((u) => localName({ name_en: u.name, name_ko: u.name_ko })).join(', ') })
                  : t(`dossier:item.source.${i.source}`, { list: '', defaultValue: '' });
                const meta = [
                  i.deadline ? t('dossier:item.deadline', { date: f.date(i.deadline) }) : null,
                  i.row && i.row.needed_count > 1 ? t('dossier:item.reused', { count: i.row.needed_count }) : null,
                  i.row?.document?.expires_on ? t('dossier:item.expires', { date: f.date(i.row.document.expires_on) }) : null,
                ].filter(Boolean).join(' · ');
                const removable = canRemove(i);
                return (
                  <ListItem key={i.key} title={itemName(i)} subtitle={source} meta={meta || null}
                    style={focus === i.category ? { backgroundColor: theme.color.selected.bg } : undefined}
                    footer={<StatusText label={label} tone={STATUS_TONE[i.status]} hollow={i.status === 'missing'} />}
                    trailing={removable ? (
                      <IconButton icon={Trash2} size={18} color={theme.color.textTertiary} accessibilityLabel={`${t('dossier:item.remove')}: ${itemName(i)}`} onPress={() => onRemove(i)} />
                    ) : undefined}
                    onPress={() => onItem(i)} />
                );
              })}
            </ListGroup>
          ) : <AppText variant="caption">{t('dossier:groups.emptyGroup')}</AppText>}
          {canHide(g) ? (
            <Button label={t('dossier:groups.hideShort')} variant="ghost" size="sm" icon={Minus} accessibilityLabel={t('dossier:groups.hide', { name })} onPress={onHide} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** University requests first: the most urgent thing on the page. */
function Requests({ dossier, onUpload }: { dossier: Dossier; onUpload: (c: DocumentCategory, label: string) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const open = dossier.requests.filter((r) => r.action !== 'SEND_EXISTING' || !r.document);
  if (!open.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle title={t('dossier:groups.name.requests')} />
      <ListGroup>
        {open.map((r) => {
          const label = r.category ? t(`common:docCategory.${r.category}`) : r.label;
          return (
            <ListItem key={r.request_id} title={label} subtitle={r.university}
              meta={r.due_date ? t('dossier:item.deadline', { date: f.date(r.due_date) }) : null}
              footer={<StatusText label={t(`dossier:item.status.${r.action === 'FIX' ? 'fix' : 'missing'}`)} tone={r.action === 'FIX' ? 'danger' : 'warning'} />}
              onPress={() => (r.document ? router.push(`/documents/${r.document.id}`) : r.category ? onUpload(r.category, label) : router.push('/messages'))} />
          );
        })}
      </ListGroup>
    </View>
  );
}

/** Uploading → done / error, said where the student is looking (and announced). */
function UploadStatus({ status, onView, onDismiss }: { status: UploadPhase; onView: (id: string) => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  if (status.phase === 'idle') return null;
  if (status.phase === 'uploading') {
    return (
      <View style={styles.status} accessibilityLiveRegion="polite" accessible accessibilityLabel={`${status.name}: ${t('common:upload.uploading')}`}>
        <ActivityIndicator color={theme.color.primary} />
        <AppText variant="body" style={{ flex: 1 }}>{`${status.name} · ${t('common:upload.uploading')}`}</AppText>
      </View>
    );
  }
  if (status.phase === 'done') {
    return (
      <View style={[styles.status, { backgroundColor: theme.status.success.bg }]} accessibilityLiveRegion="polite">
        <CircleCheck size={18} color={theme.status.success.fg} />
        <AppText variant="body" style={{ flex: 1 }}>{t('common:upload.done', { name: status.name })}</AppText>
        <Button label={t('dossier:item.view')} size="sm" variant="ghost" onPress={() => { onDismiss(); onView(status.id); }} />
      </View>
    );
  }
  return (
    <View accessibilityLiveRegion="assertive">
      <Callout tone="danger" icon={CircleAlert} title={t('common:upload.cantAdd')} body={t('mobile:v261119.upload.failed', { name: status.name })} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.pill },
  chipRequired: { backgroundColor: theme.color.selected.bg },
  chipOptional: { backgroundColor: theme.color.bgCanvas },
  toggle: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.borderStrong, backgroundColor: theme.color.surface,
  },
  toggleOpen: { borderColor: theme.color.primary, backgroundColor: theme.color.selected.bg },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: theme.radius.lg, backgroundColor: theme.color.bgCanvas },
});
