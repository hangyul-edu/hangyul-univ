// PRIMARY QUESTION: What do I say, in the student's language, without retyping?
// V9 (REPORT §59 A5): kinds include payment, arrival and housing; scopes personal · team · organisation (organisation
// = owners/managers only); one template carries its language versions (group key + locale), and inserting it picks the
// student's language when a version exists.
import { useAuth } from '@hangyul/auth';
import { Copy, Languages, Pencil, Plus, Trash2 } from '@hangyul/icons';
import type { MessageTemplate, TemplateKind } from '@hangyul/types';
import { Button, EmptyState, Field, Input, Modal, PageHeader, QueryState, Section, Segmented, FilterSelect, Select, Skeleton, Textarea, useToast } from '@hangyul/ui';
import { formatRelative } from '@hangyul/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useT } from '../components/bits';
import { TEMPLATE_KEY, useServerTemplates } from '../lib/templates';

/** Show {{placeholders}} as readable tokens so the list reads like the message the student will get. */
function Body({ text }: { text: string }) {
  const parts = text.split(/(\{\{\s*\w+\s*\}\})/g);
  return <>{parts.map((p, i) => (/^\{\{/.test(p) ? <span key={i} className="ag-ph">{p.replace(/[{}\s]/g, '').replace(/_/g, ' ')}</span> : p))}</>;
}

const KINDS: TemplateKind[] = ['DOCUMENT_CORRECTION', 'APOSTILLE', 'ESSAY_FEEDBACK', 'DEADLINE_REMINDER', 'UNIVERSITY_REQUEST', 'VISA_REMINDER', 'PAYMENT', 'ARRIVAL', 'HOUSING', 'GENERAL'];
const LANGS = ['en', 'ko', 'vi', 'ne', 'my', 'uz', 'mn', 'zh', 'ja', 'th', 'id', 'ru'];
type Scope = MessageTemplate['scope'];

function langLabel(code: string, locale: string) {
  try { return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code; } catch { return code; }
}

function Editor({ open, onClose, initial, placeholders, canOrg }: { open: boolean; onClose: () => void; initial: Partial<MessageTemplate> | null; placeholders: string[]; canOrg: boolean }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<TemplateKind>('GENERAL');
  const [scope, setScope] = useState<Scope>('PERSONAL');
  const [lang, setLang] = useState('en');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? ''); setBody(initial?.body ?? ''); setKind(initial?.kind ?? 'GENERAL');
    setScope(initial?.scope ?? 'PERSONAL'); setLang(initial?.locale ?? locale.split('-')[0]); setTouched(false);
  }, [open, initial, locale]);
  const m = useMutation({
    mutationFn: () => {
      // A new language version keeps the group key of the template it belongs to.
      const payload = { title: title.trim(), body: body.trim(), kind, scope, locale: lang, ...(initial?.group_key && !initial.group_key.startsWith('t-') ? { group_key: initial.group_key } : {}) };
      return initial?.id ? api.templates.update(initial.id, payload) : api.templates.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: TEMPLATE_KEY }); toast.success(t('actions.saved')); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const save = () => { setTouched(true); if (title.trim() && body.trim()) m.mutate(); };
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? t('templatesPage.edit') : t('templatesPage.new')} width={600}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={save}>{t('actions.save')}</Button></>}>
      <div className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties}>
        <div className="ag-form-grid">
          <Field label={t('templatesPage.name')} htmlFor="tp-title" error={touched && !title.trim() ? t('validation.required') : undefined}>
            <Input id="tp-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} invalid={touched && !title.trim()} />
          </Field>
          <Field label={t('templatesPage.kind')} htmlFor="tp-kind">
            <Select id="tp-kind" value={kind} onChange={(e) => setKind(e.target.value as TemplateKind)}>
              {KINDS.map((k) => <option key={k} value={k}>{t(`templatesPage.kinds.${k}`)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t('templatesPage.body')} htmlFor="tp-body" error={touched && !body.trim() ? t('validation.required') : undefined}
          hint={t('templatesPage.placeholders', { list: placeholders.map((p) => `{{${p}}}`).join('  ') })}>
          <Textarea id="tp-body" rows={7} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} invalid={touched && !body.trim()} />
        </Field>
        <div className="ag-form-grid">
          <Field label={t('v9.tpl.language')} htmlFor="tp-lang">
            <Select id="tp-lang" value={lang} onChange={(e) => setLang(e.target.value)}>
              {[...new Set([lang, ...LANGS])].map((l) => <option key={l} value={l}>{langLabel(l, locale)}</option>)}
            </Select>
          </Field>
          <Field label={t('templatesPage.visibleTo')}>
            <Segmented label={t('templatesPage.visibleTo')} value={scope} onChange={setScope} options={[
              { value: 'PERSONAL', label: t('templatesPage.scope.PERSONAL') },
              { value: 'TEAM' as const, label: t('templatesPage.scope.TEAM') },
              ...(canOrg ? [{ value: 'ORG' as const, label: t('templatesPage.scope.ORG') }] : []),
            ]} />
          </Field>
        </div>
        <p className="hg-subtle hg-xs">{t(canOrg ? 'v9.tpl.scopeHelpMgr' : 'v9.tpl.scopeHelp')}</p>
      </div>
    </Modal>
  );
}

export default function Templates() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useServerTemplates();
  const [kind, setKind] = useState<TemplateKind | ''>('');
  const [editing, setEditing] = useState<Partial<MessageTemplate> | null>(null);
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: (id: string) => api.templates.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: TEMPLATE_KEY }); toast.success(t('templatesPage.deleted')); },
    onError: (e) => toast.error((e as Error).message),
  });
  const copy = async (tp: MessageTemplate) => {
    try { await navigator.clipboard.writeText(tp.body); toast.success(t('templatesPage.copied')); } catch { toast.error(t('templatesPage.copyFailed')); }
  };
  const list = q.groups.filter((g) => !kind || g.picked.kind === kind);
  const [pickedLang, setPickedLang] = useState<Record<string, string>>({});
  const sections: { scope: Scope; items: typeof list }[] = (['PERSONAL', 'TEAM', 'ORG'] as Scope[]).map((scope) => ({ scope, items: list.filter((g) => g.picked.scope === scope) }));
  return (
    <div className="hg-stack ag-page">
      <PageHeader title={t('nav.templates')} subtitle={t('v9.tpl.sub')}
        actions={<Button size="sm" variant="primary" icon={<Plus />} onClick={() => { setEditing(null); setOpen(true); }}>{t('templatesPage.new')}</Button>} />
      <div className="ag-filterbar">
        <FilterSelect size="sm" label={t('templatesPage.kind')} value={kind} onChange={(e) => setKind(e.target.value as TemplateKind | '')} style={{ width: 'auto' }}>
          <option value="">{t('templatesPage.allKinds')}</option>
          {KINDS.map((k) => <option key={k} value={k}>{t(`templatesPage.kinds.${k}`, { defaultValue: t(`v9.tpl.kinds.${k}`) })}</option>)}
        </FilterSelect>
      </div>
      <QueryState query={q} skeleton={<Skeleton h={240} r={10} />}>
        {() => list.length === 0 ? <EmptyState title={t('templatesPage.none')} text={t('templatesPage.noneText')} /> : (
          <div className="hg-stack" style={{ '--hg-gap': '28px' } as React.CSSProperties}>
            {sections.filter((g) => g.items.length).map((g) => (
              <Section key={g.scope} title={t(`templatesPage.groups.${g.scope}`)} sub={t(`v9.tpl.groupsSub.${g.scope}`)}>
                <ul className="ag-cards">
                  {g.items.map((grp) => {
                    const tp = grp.variants.find((v) => v.locale === pickedLang[grp.key]) ?? grp.picked;
                    const missing = LANGS.slice(0, 3).filter((l) => !grp.variants.some((v) => v.locale === l));
                    return (
                      <li key={grp.key} className="ag-tpl">
                        <div className="ag-tpl__main">
                          <div className="ag-tpl__title">{tp.title} <span className="hg-subtle hg-xs">· {t(`templatesPage.kinds.${tp.kind}`, { defaultValue: t(`v9.tpl.kinds.${tp.kind}`) })}</span></div>
                          <div className="ag9-langs" role="group" aria-label={t('v9.tpl.versions')}>
                            {grp.variants.map((v) => (
                              <button key={v.id} type="button" className="ag9-lang" aria-pressed={v.id === tp.id} onClick={() => setPickedLang({ ...pickedLang, [grp.key]: v.locale })}>{v.locale.toUpperCase()}</button>
                            ))}
                          </div>
                          <p className="ag-tpl__body" lang={tp.locale}><Body text={tp.body} /></p>
                          <div className="hg-subtle hg-xs">{t('templatesPage.updated', { when: formatRelative(tp.updated_at, locale) })}</div>
                        </div>
                        <div className="ag-tpl__actions">
                          <Button size="sm" variant="ghost" icon={<Copy />} onClick={() => copy(tp)}>{t('actions.copy')}</Button>
                          {tp.can_edit ? (
                            <>
                              <Button size="sm" variant="ghost" iconOnly icon={<Pencil />} aria-label={t('actions.edit')} onClick={() => { setEditing(tp); setOpen(true); }} />
                              <Button size="sm" variant="ghost" iconOnly icon={<Trash2 />} aria-label={t('actions.delete')} loading={del.isPending && del.variables === tp.id} onClick={() => del.mutate(tp.id)} />
                              {missing.length > 0 && <Button size="sm" variant="ghost" icon={<Languages />} onClick={() => { setEditing({ title: tp.title, body: tp.body, kind: tp.kind, scope: tp.scope, group_key: tp.group_key, locale: missing[0] }); setOpen(true); }}>{t('v9.tpl.addLang')}</Button>}
                            </>
                          ) : (
                            <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => { setEditing({ title: tp.title, body: tp.body, kind: tp.kind, locale: tp.locale, scope: 'PERSONAL' }); setOpen(true); }}>{t('templatesPage.duplicate')}</Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            ))}
          </div>
        )}
      </QueryState>
      <Editor open={open} onClose={() => setOpen(false)} initial={editing} placeholders={q.placeholders} canOrg={q.canPublishOrg} />
    </div>
  );
}
