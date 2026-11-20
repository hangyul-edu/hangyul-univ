import { errorText } from '@hangyul/i18n';
import { useApi } from '@hangyul/auth';
import { FileText, Lock, PenLine, Upload } from '@hangyul/icons';
import type { DocumentCategory, DossierRequestSuggestion, DossierRow } from '@hangyul/types';
import { Button, ButtonLink, Callout, EmptyState, QueryState, Section, SkeletonCard, useToast } from '@hangyul/ui';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { PageIntro } from '../components/bits';
import { DocumentDrawer } from '../components/DocumentDrawer';
import {
  AddSheet, DocItemRow, DocNavigator, DocProgressBar, DocSection, GroupSection, useGroupName, type ItemAction,
} from '../components/dossier/DocSections';
import {
  PackageItem, RequestItem, SuggestionList, useDossier, useDossierInvalidate, useDT, WhoCanSee,
} from '../components/dossier/DossierParts';
import { UploadModal, type UploadTarget } from '../components/UploadModal';
import {
  ADD_TYPES, addTypeOf, buildLayout, canHide, defaultExpanded, loadPrefs, savePrefs, type AddType, type DocGroup, type DocGroupId, type DocItem, type DocPrefs,
} from '../lib/docGroups';
import { needsCheck, type RowAction } from '../lib/dossier';

/**
 * PRIMARY QUESTION: "Which documents does each part of my application need, and what is left?"
 *
 * Owner pass 261119 (req 6): the Saramin model. Documents are grouped by what they are (academic, identity, language,
 * financial, writing, university-specific, additional), each group a section with a one-line summary and an explicit
 * `+`/`−` disclosure; a sticky section navigator on desktop carries the completion meter and `필수`/`+`/`−` per section.
 * Optional sections take no space until the student adds them; required items can collapse but never be removed.
 * University requests stay first — they are the most urgent thing on the page.
 */
export default function Documents() {
  const { t } = useDT();
  const api = useApi();
  const toast = useToast();
  const nav = useNavigate();
  const name = useGroupName();
  const { hash } = useLocation();
  const [sp, setSp] = useSearchParams();
  const q = useDossier();
  const refresh = useDossierInvalidate();
  const [upload, setUpload] = useState<UploadTarget | null>(() => {
    const c = sp.get('upload');
    return c ? { category: c as DocumentCategory } : null;
  });
  const uploadParam = sp.get('upload');
  useEffect(() => { if (uploadParam) setUpload({ category: uploadParam as DocumentCategory }); }, [uploadParam]);
  const docId = sp.get('doc');
  const focusCat = sp.get('focus');

  // Per-viewer: optional sections opened with `+` and empty records added from the "구분" selector.
  const [prefs, setPrefs] = useState<DocPrefs>(loadPrefs);
  const update = (p: DocPrefs) => { setPrefs(p); savePrefs(p); };
  const opened = useMemo(() => new Set<DocGroupId>(prefs.opened), [prefs.opened]);
  const layout = useMemo(() => (q.data ? buildLayout(q.data, prefs.slots, opened) : null), [q.data, prefs.slots, opened]);

  // Expanded/collapsed per section: sections that wait for the student start open, complete ones start closed.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (g: DocGroup) => expanded[g.id] ?? (defaultExpanded(g) || (!!focusCat && g.items.some((i) => i.category === focusCat)));
  const setOpen = (id: string, v: boolean) => setExpanded((e) => ({ ...e, [id]: v }));

  const [sheet, setSheet] = useState<{ preset: DocGroupId | null } | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const main = useRef<HTMLDivElement>(null);

  const go = (id: string, expand = true) => {
    if (expand && id !== 'requests') setOpen(id, true);
    requestAnimationFrame(() => document.getElementById(`dg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const openGroup = (id: DocGroupId) => {
    if (!opened.has(id)) update({ ...prefs, opened: [...prefs.opened, id] });
    setSheet(null);
    go(id);
  };
  const hideGroup = (g: DocGroup) => {
    if (!canHide(g)) return setOpen(g.id, false);
    const slots = prefs.slots.filter((s) => addTypeOf(s.type).group !== g.id);
    if (slots.length !== prefs.slots.length && !window.confirm(t('dossier:item.removeConfirm', { name: name(g.id) }))) return;
    update({ opened: prefs.opened.filter((x) => x !== g.id), slots });
  };
  const addSlot = (type: AddType) => {
    const a = addTypeOf(type);
    const id = `${type}-${Date.now().toString(36)}`;
    update({ opened: prefs.opened.includes(a.group) ? prefs.opened : [...prefs.opened, a.group], slots: [...prefs.slots, { id, type }] });
    toast.success(t('dossier:groups.added', { name: t(`dossier:groups.types.${type}`) }));
    setSheet(null);
    go(a.group);
  };

  useEffect(() => {
    if (hash && q.data) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash, q.data]);
  // V26: a task or notification about one requirement opens that row — scrolled to and marked.
  useEffect(() => {
    if (!focusCat || !layout) return;
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.dz-page [data-focus="true"]')?.scrollIntoView({ behavior: 'auto', block: 'center' }));
  }, [focusCat, layout]);
  // The navigator marks the section in view (the "you are here" orange).
  useEffect(() => {
    if (!layout || typeof IntersectionObserver === 'undefined') return;
    const els = [...(main.current?.querySelectorAll<HTMLElement>('.dg-sec') ?? [])];
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setCurrent(top.target.id.replace(/^dg-/, ''));
    }, { rootMargin: '-80px 0px -55% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [layout]);

  const setDoc = (id: string | null) => {
    const n = new URLSearchParams(sp);
    n.delete('upload');
    if (id) n.set('doc', id); else n.delete('doc');
    setSp(n, { replace: true });
  };
  const closeUpload = () => {
    setUpload(null);
    if (sp.has('upload')) { const n = new URLSearchParams(sp); n.delete('upload'); setSp(n, { replace: true }); }
  };
  // A request answered by a new upload is fulfilled with the uploaded document.
  const fulfil = useMutation({
    mutationFn: ({ rid, doc }: { rid: string; doc: string }) => api.applications.fulfillRequest(rid, doc),
    onSuccess: () => { refresh(); toast.success(t('student:ws3.request.sent')); },
    onError: (e) => toast.error(errorText(e)),
  });

  const onRow = (row: DossierRow, action: RowAction) => {
    if ((action === 'write' || !row.document) && row.essay) return nav(`/essays/${row.essay.id}`);
    if (action === 'upload' || action === 'uploadNewer' || (action === 'addTranslation' && !row.document)) return setUpload({ category: row.category });
    if (action === 'addTranslation' && row.document) return setUpload({ documentId: row.document.id, category: row.category, title: row.document.title });
    if (row.document) setDoc(row.document.id);
  };
  const onItem = (i: DocItem, a: ItemAction) => {
    const doc = i.row?.document;
    if (a === 'remove') {
      const label = i.slot ? t(`dossier:groups.types.${i.slot.type}`) : t(`common:docCategory.${i.category}`);
      if (!window.confirm(t('dossier:item.removeConfirm', { name: label }))) return;
      update({ ...prefs, slots: prefs.slots.filter((s) => s.id !== i.slot?.id) });
      return toast.success(t('dossier:item.removed'));
    }
    if (a === 'replace' && doc) return setUpload({ documentId: doc.id, category: doc.category, title: doc.title });
    if (a === 'view' && doc) return setDoc(doc.id);
    if (i.row) return onRow(i.row, a as RowAction);
    if (a === 'write') return nav('/essays');
    // An added record: upload into its category, titled with its type (e.g. "Award or competition").
    const title = i.slot && ADD_TYPES.find((x) => x.type === i.slot!.type)?.category === 'OTHER' ? t(`dossier:groups.types.${i.slot.type}`) : undefined;
    setUpload({ category: i.category, title });
  };
  const onRequestUpload = (r: DossierRequestSuggestion) =>
    setUpload({ category: (r.category ?? 'OTHER') as DocumentCategory, title: r.label, requestId: r.request_id, applicationId: r.application_id });

  return (
    <div className="st-page dz-page dg-page">
      <PageIntro title={t('page.title')} subtitle={t('page.subtitle')}
        actions={<>
          {/* V22 (REPORT §248 S4): Writing is reached from the documents it belongs with. */}
          <ButtonLink as={Link} to="/essays" variant="ghost" icon={<PenLine />}>{t('student:v22.home.writing')}</ButtonLink>
          <Button icon={<Upload />} onClick={() => setUpload({})}>{t('page.upload')}</Button>
        </>} />
      <QueryState query={q} skeleton={<SkeletonCard lines={6} />}>
        {(d) => {
          if (!layout) return null;
          if (!d.rows.length && !d.requests.length && layout.hasApplications) {
            return <EmptyState icon={<FileText />} title={t('page.empty')} text={t('page.emptyText')}
              action={<Button variant="primary" icon={<Upload />} onClick={() => setUpload({ category: 'PASSPORT' })}>{t('page.upload')}</Button>} />;
          }
          const check = needsCheck(d.suggestions);
          // The page's one primary button: the first request, else the first item that waits for the student.
          const leadKey = d.requests.length ? null : layout.groups.flatMap((g) => g.items).find((i) => !i.done && i.required && ['missing', 'fix', 'action', 'expired'].includes(i.status))?.key;
          return (
            <div className="dg-layout">
              <div className="dg-main" ref={main}>
                <DocProgressBar layout={layout} onAdd={() => setSheet({ preset: null })} />
                {!layout.hasApplications && <Callout tone="info">{t('dossier:groups.baseNote')}</Callout>}
                {d.requests.length > 0 && (
                  <DocSection id="requests" title={name('requests')} required={null} tone="danger" expanded={expanded.requests ?? true} onToggle={() => setOpen('requests', !(expanded.requests ?? true))}
                    summary={t('dossier:groups.summary.requests', { count: d.requests.length })}>
                    <ul className="dz-list dg-items">{d.requests.map((r, i) => <RequestItem key={r.request_id} r={r} onUpload={onRequestUpload} primary={i === 0} />)}</ul>
                  </DocSection>
                )}
                {layout.groups.map((g) => {
                  const open = isOpen(g);
                  const addHere = ADD_TYPES.some((a) => a.group === g.id);
                  return (
                    <GroupSection key={g.id} g={g} expanded={open} onToggle={() => setOpen(g.id, !open)} onQuickAdd={addSlot}
                      onHide={canHide(g) && opened.has(g.id) && open ? () => hideGroup(g) : undefined}
                      footer={(addHere && g.items.length > 0) || g.id === 'writing' ? (
                        <div className="dg-sec__foot">
                          {addHere && g.items.length > 0 && <Button size="sm" variant="ghost" onClick={() => setSheet({ preset: g.id })}>+ {t('dossier:groups.addRecord')}</Button>}
                          {g.id === 'writing' && <ButtonLink as={Link} to="/essays" size="sm" variant="ghost" icon={<PenLine />}>{t('student:v22.home.writing')}</ButtonLink>}
                        </div>
                      ) : undefined}>
                      {g.items.map((i) => <DocItemRow key={i.key} item={i} lead={i.key === leadKey} focused={i.category === focusCat} onAction={onItem} />)}
                    </GroupSection>
                  );
                })}
                {(check.length > 0 || d.counts.matching > 0) && (
                  <Section title={t('check.title')} sub={t('check.sub')} id="check-section">
                    <SuggestionList items={check} matching={d.counts.matching} />
                  </Section>
                )}
                {d.packages.length > 0 && (
                  <details className="dg-fold">
                    <summary>{t('dossier:groups.byApplication')}</summary>
                    <ul className="hg-panel dz-pkgs">{d.packages.map((p) => <PackageItem key={p.application.id} p={p} />)}</ul>
                  </details>
                )}
                <p className="dz-method">{t('page.method')}</p>
              </div>
              <aside className="dg-aside">
                <DocNavigator layout={layout} requests={d.requests.length} current={current} opened={opened}
                  onGo={(id) => go(id)} onOpenGroup={openGroup} onHideGroup={hideGroup} onAdd={() => setSheet({ preset: null })} />
              </aside>
              {sheet && (
                <AddSheet open onClose={() => setSheet(null)} layout={layout} opened={opened} preset={sheet.preset}
                  onAddSlot={addSlot} onOpenGroup={openGroup} onHideGroup={hideGroup} />
              )}
            </div>
          );
        }}
      </QueryState>
      {/* V9 S4: who sees the documents — plain facts, one tap away (the drawer shows the same per document). */}
      <details className="v9-who-fold">
        <summary><Lock aria-hidden /> <span>{t('v9.who.foldTitle')}</span></summary>
        <WhoCanSee />
      </details>
      <DocumentDrawer id={docId} onClose={() => setDoc(null)} onNewVersion={(doc) => { setDoc(null); setUpload({ documentId: doc.id, category: doc.category, title: doc.title }); }} />
      {upload && (
        <UploadModal open onClose={closeUpload} target={upload}
          onUploaded={(id) => {
            if (upload.requestId) fulfil.mutate({ rid: upload.requestId, doc: id });
            else setDoc(id);
          }} />
      )}
    </div>
  );
}
