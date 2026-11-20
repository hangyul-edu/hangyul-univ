import { localName } from '@hangyul/i18n';
import { FileUp, Minus, MoreHorizontal, PenLine, Plus, Upload } from '@hangyul/icons';
import type { DossierRow } from '@hangyul/types';
import { Button, Drawer, Field, Popover, Progress, Select, StatusText } from '@hangyul/ui';
import { cx, type Tone } from '@hangyul/utils';
import { useId, useState, type ReactNode } from 'react';

import { rowAction, summaryText, type RowAction } from '../../lib/dossier';
import {
  ADD_TYPES, canHide, canRemove, groupSummary, WRITTEN, type AddType, type DocGroup, type DocGroupId, type DocItem, type GroupTone, type ItemStatus, type Layout,
} from '../../lib/docGroups';
import { FindingLine, useDT } from './DossierParts';

/**
 * Owner pass 261119 (req 6) — the Saramin-model document manager: section blocks in the main column, a sticky section
 * navigator on desktop (completion meter, `필수` / `+` / `−` per section), a compact progress line and an "add" sheet
 * on phones. Hangyul white/orange: orange only for progress, the current section and the one primary action.
 */

const STATUS_TONE: Record<ItemStatus, Tone> = { missing: 'warning', fix: 'danger', expired: 'warning', action: 'warning', review: 'info', uploaded: 'info', verified: 'success' };
const SEC_ID = (id: string) => `dg-${id}`;

export function useGroupName() {
  const { t } = useDT();
  return (id: DocGroupId | 'requests') => t(`dossier:groups.name.${id}`);
}

// ------------------------------------------------------------------ navigator (desktop) + compact progress (phone)
export function DocNavigator({ layout, requests, current, opened, onGo, onOpenGroup, onHideGroup, onAdd }: {
  layout: Layout; requests: number; current: string | null; opened: Set<DocGroupId>;
  onGo: (id: string) => void; onOpenGroup: (id: DocGroupId) => void; onHideGroup: (g: DocGroup) => void; onAdd: () => void;
}) {
  const { t } = useDT();
  const name = useGroupName();
  const p = layout.progress;
  return (
    <nav className="dg-nav" aria-label={t('dossier:groups.nav.label')}>
      <div className="dg-nav__meter">
        <div className="dg-nav__pct">{t('dossier:groups.progress', { pct: p.pct })}</div>
        <Progress value={p.pct} size="sm" label={t('dossier:groups.progress', { pct: p.pct })} />
        <p className="dg-nav__line">{t('dossier:groups.progressLine', { done: p.done, total: p.total })}</p>
      </div>
      <ul className="dg-nav__list">
        {requests > 0 && (
          <li data-current={current === 'requests' || undefined}>
            <button type="button" className="dg-nav__go" onClick={() => onGo('requests')}>{name('requests')}</button>
            <span className="dg-nav__count">{requests}</span>
          </li>
        )}
        {layout.groups.map((g) => (
          <li key={g.id} data-current={current === g.id || undefined} data-optional={!g.required || undefined}>
            <button type="button" className="dg-nav__go" onClick={() => onGo(g.id)} aria-label={t('dossier:groups.goTo', { name: name(g.id) })}>
              <span className="dg-dot" data-tone={g.tone} aria-hidden />{name(g.id)}
            </button>
            {g.required ? <span className="dg-nav__req">{t('dossier:groups.required')}</span>
              : canHide(g) && opened.has(g.id) ? <ToggleGlyph open label={t('dossier:groups.hide', { name: name(g.id) })} onClick={() => onHideGroup(g)} /> : null}
          </li>
        ))}
        {layout.addable.map((a) => (
          <li key={a.id} className="dg-nav__addable">
            <button type="button" className="dg-nav__go" onClick={() => onOpenGroup(a.id)}>{name(a.id)}</button>
            <ToggleGlyph open={false} label={t('dossier:groups.add', { name: name(a.id) })} onClick={() => onOpenGroup(a.id)} />
          </li>
        ))}
      </ul>
      <Button size="sm" block icon={<Plus />} onClick={onAdd}>{t('dossier:groups.addButton')}</Button>
    </nav>
  );
}

/** The phone/tablet replacement for the navigator: one progress line and the add button. */
export function DocProgressBar({ layout, onAdd }: { layout: Layout; onAdd: () => void }) {
  const { t } = useDT();
  const p = layout.progress;
  return (
    <div className="dg-mob">
      <div className="dg-mob__text">
        <strong>{t('dossier:groups.progress', { pct: p.pct })}</strong>
        <span>{t('dossier:groups.progressLine', { done: p.done, total: p.total })}</span>
      </div>
      <Progress value={p.pct} size="sm" label={t('dossier:groups.progress', { pct: p.pct })} />
      <Button size="sm" icon={<Plus />} onClick={onAdd}>{t('dossier:groups.addButton')}</Button>
    </div>
  );
}

function ToggleGlyph({ open, label, onClick }: { open: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className="dg-glyph" data-open={open || undefined} aria-label={label} title={label} onClick={onClick}>
      {open ? <Minus aria-hidden /> : <Plus aria-hidden />}
    </button>
  );
}

// ------------------------------------------------------------------ one section
export function DocSection({ id, title, required, summary, tone, expanded, onToggle, onHide, children, footer }: {
  id: string; title: string; required: boolean | null; summary: string; tone: GroupTone; expanded: boolean; onToggle: () => void;
  /** `−` that removes an empty optional section from the page (shown only when allowed). */ onHide?: () => void;
  children: ReactNode; footer?: ReactNode;
}) {
  const { t } = useDT();
  const body = useId();
  return (
    <section className="dg-sec" id={SEC_ID(id)} aria-labelledby={`${SEC_ID(id)}-t`} data-expanded={expanded || undefined}>
      <div className="dg-sec__head" onClick={(e) => { if (!(e.target as HTMLElement).closest('button,a')) onToggle(); }}>
        <div className="dg-sec__titles">
          <h2 className="dg-sec__title" id={`${SEC_ID(id)}-t`}>{title}</h2>
          {required !== null && <span className={cx('dg-chip', required && 'dg-chip--req')}>{required ? t('dossier:groups.required') : t('dossier:groups.optional')}</span>}
        </div>
        <p className="dg-sec__sum"><span className="dg-dot" data-tone={tone} aria-hidden />{summary}</p>
        <div className="dg-sec__ctl">
          {onHide && <Button size="sm" variant="ghost" onClick={onHide} aria-label={t('dossier:groups.hide', { name: title })}>{t('dossier:groups.hideShort')}</Button>}
          <button type="button" className="dg-glyph dg-glyph--lg" data-open={expanded || undefined} aria-expanded={expanded} aria-controls={body}
            aria-label={expanded ? t('dossier:groups.close', { name: title }) : t('dossier:groups.open', { name: title })} onClick={onToggle}>
            {expanded ? <Minus aria-hidden /> : <Plus aria-hidden />}
          </button>
        </div>
      </div>
      <div id={body} className="dg-sec__body" hidden={!expanded}>
        {children}
        {footer}
      </div>
    </section>
  );
}

export function GroupSection({ g, expanded, onToggle, onHide, children, footer, onQuickAdd }: {
  g: DocGroup; expanded: boolean; onToggle: () => void; onHide?: () => void; children: ReactNode; footer?: ReactNode;
  /** An empty optional section offers its record types directly (Saramin's "구분" choices) instead of a blank box. */
  onQuickAdd?: (type: AddType) => void;
}) {
  const { t } = useDT();
  const name = useGroupName();
  return (
    <DocSection id={g.id} title={name(g.id)} required={g.required} summary={groupSummary(t, g.counts) || t('dossier:groups.emptyGroup')} tone={g.tone}
      expanded={expanded} onToggle={onToggle} onHide={onHide} footer={footer}>
      {g.items.length ? <ul className="dg-items">{children}</ul> : (
        <div className="dg-quick">
          {ADD_TYPES.filter((a) => a.group === g.id).map((a) => (
            <Button key={a.type} size="sm" variant="secondary" icon={<Plus />} onClick={() => onQuickAdd?.(a.type)}>{t(`dossier:groups.types.${a.type}`)}</Button>
          ))}
        </div>
      )}
    </DocSection>
  );
}

// ------------------------------------------------------------------ one document
export type ItemAction = RowAction | 'replace' | 'remove';

/** The one primary action of an item (Upload / Fix / Replace / Write) — 'view' means nothing waits for the student. */
export function itemAction(i: DocItem): RowAction {
  if (i.row) return rowAction(i.row as DossierRow);
  return WRITTEN.has(i.category) ? 'write' : 'upload';
}

const LEGAL_KEY: Record<string, string> = { APOSTILLE: 'dossier:item.apostille', CONSULAR_LEGALIZATION: 'dossier:item.consular' };

export function DocItemRow({ item, lead, focused, onAction }: {
  item: DocItem; lead?: boolean; focused?: boolean; onAction: (i: DocItem, a: ItemAction) => void;
}) {
  const { t, fmt } = useDT();
  const row = item.row;
  const doc = row?.document ?? null;
  const action = itemAction(item);
  const name = item.slot ? t(`dossier:groups.types.${item.slot.type}`) : t(`common:docCategory.${item.category}`);
  const uses = row?.applications ?? [];
  const statusKey = item.status === 'missing' && WRITTEN.has(item.category) ? 'toWrite' : item.status;
  const tone: Tone = item.done ? 'success' : item.status === 'missing' && !item.required ? 'neutral' : STATUS_TONE[item.status];

  // Translation / legalization only when they apply to this document.
  const attrs: string[] = [];
  if (doc?.translation === 'NEEDED' || uses.some((u) => u.status === 'NEEDS_TRANSLATION')) attrs.push(t('dossier:item.translation'));
  else if (doc?.translation === 'PROVIDED') attrs.push(t('dossier:item.translationDone'));
  const legal = doc?.legalization;
  if (legal && legal.path !== 'NONE' && legal.path !== 'UNKNOWN') {
    if (legal.status === 'REQUIRED') attrs.push(t(LEGAL_KEY[legal.path] ?? 'dossier:item.apostille'));
    else if (legal.status === 'IN_PROGRESS') attrs.push(t('dossier:item.legalizing'));
    else if (legal.status === 'COMPLETED') attrs.push(t('dossier:item.legalized'));
  } else if (uses.some((u) => u.status === 'NEEDS_LEGALIZATION')) attrs.push(t('dossier:item.apostille'));

  const meta: string[] = [];
  if (doc) meta.push(t('dossier:item.version', { n: doc.current_version }));
  if (doc?.expires_on) meta.push(t('dossier:item.expires', { date: fmt(doc.expires_on) }));
  if (item.deadline) meta.push(t('dossier:item.deadline', { date: fmt(item.deadline) }));

  const where = item.source === 'requirement'
    ? t('dossier:item.neededBy', { list: item.universities.map((u) => { const n = localName({ name_en: u.name, name_ko: u.name_ko }); return u.count > 1 ? `${n} (${u.count})` : n; }).join(' · ') })
    : item.source === 'optional' ? t('dossier:item.source.optional', { list: item.universities.map((u) => localName({ name_en: u.name, name_ko: u.name_ko })).join(' · ') })
    : t(`dossier:item.source.${item.source}`);
  const reused = doc && row && row.needed_count > 1 ? t('dossier:item.reused', { count: row.needed_count }) : null;
  const note = doc?.rejection_reason && (item.status === 'fix') ? doc.rejection_reason : null;
  const finding = !item.done && row ? row.findings.find((f) => f.severity !== 'INFO' && f.document_id === doc?.id) : undefined;
  const explain = row && (item.status === 'action' || item.status === 'expired') ? summaryText(t, row.summary, fmt) : null;

  const menu: { a: ItemAction; label: string }[] = [];
  if (doc) menu.push({ a: 'view', label: t('dossier:item.view') });
  if (doc && action !== 'uploadNewer' && action !== 'fix') menu.push({ a: 'replace', label: t('dossier:item.replace') });
  if (canRemove(item)) menu.push({ a: 'remove', label: t('dossier:item.remove') });

  const primaryLabel = action === 'write' ? (row?.essay ? t('action.write') : t('dossier:item.write'))
    : action === 'view' ? t('dossier:item.view') : t(`action.${action}`);
  const showPrimary = action !== 'view' || !!doc || !!row?.essay;

  return (
    <li className="dg-item" data-status={item.status} data-done={item.done || undefined} data-focus={focused ? 'true' : undefined}>
      <div className="dg-item__main">
        <div className="dg-item__name">
          <span className="dg-item__title">{name}</span>
          <span className={cx('dg-chip', 'dg-chip--sm', item.required && 'dg-chip--req')}>{item.required ? t('dossier:groups.required') : t('dossier:groups.optional')}</span>
        </div>
        <div className="dg-item__meta">
          <StatusText tone={tone} hollow={!doc && !row?.essay}>{t(`dossier:item.status.${statusKey}`)}</StatusText>
          {meta.map((m) => <span key={m}>{m}</span>)}
        </div>
        {attrs.length > 0 && <div className="dg-item__attrs">{attrs.map((a) => <span key={a} className="dg-attr">{a}</span>)}</div>}
        {note && (
          <p className="dg-item__note"><span className="dg-item__noteLabel">{t('dossier:item.reviewNote')}</span> <span data-user-content>{`⁨${note}⁩`}</span></p>
        )}
        {!note && finding && <FindingLine f={finding} />}
        {explain && <p className="dg-item__explain">{explain}</p>}
        <p className="dg-item__where">{[where, reused].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="dg-item__act">
        {showPrimary && (
          <Button size="sm" variant={action === 'view' ? 'ghost' : lead ? 'primary' : 'secondary'}
            icon={action === 'write' ? <PenLine /> : action === 'upload' ? <Upload /> : action === 'uploadNewer' || action === 'fix' ? <FileUp /> : undefined}
            onClick={() => onAction(item, action)}>{primaryLabel}</Button>
        )}
        {menu.length > (action === 'view' && doc ? 1 : 0) && (
          <Popover align="end" width={240}
            trigger={(p) => <button type="button" className="dg-more" aria-label={t('dossier:item.more', { name })} {...p}><MoreHorizontal aria-hidden /></button>}>
            {(close) => (
              <div role="menu" className="dg-menu">
                {menu.filter((m) => !(m.a === 'view' && action === 'view')).map((m) => (
                  <button key={m.a} type="button" role="menuitem" className="hg-menu-item" onClick={() => { close(); onAction(item, m.a); }}>{m.label}</button>
                ))}
              </div>
            )}
          </Popover>
        )}
      </div>
    </li>
  );
}

// ------------------------------------------------------------------ add sheet ("구분" selector + sections)
export function AddSheet({ open, onClose, layout, opened, preset, onAddSlot, onOpenGroup, onHideGroup }: {
  open: boolean; onClose: () => void; layout: Layout; opened: Set<DocGroupId>; preset?: DocGroupId | null;
  onAddSlot: (type: AddType) => void; onOpenGroup: (id: DocGroupId) => void; onHideGroup: (g: DocGroup) => void;
}) {
  const { t } = useDT();
  const name = useGroupName();
  const id = useId();
  const [type, setType] = useState<AddType | ''>('');
  const types = ADD_TYPES.filter((a) => !preset || a.group === preset);
  const optionalShown = layout.groups.filter((g) => !g.required);
  return (
    <Drawer open={open} onClose={() => { setType(''); onClose(); }} width={440} title={t('dossier:groups.addTitle')}
      footer={<>
        <Button variant="ghost" onClick={() => { setType(''); onClose(); }}>{t('common:actions.cancel')}</Button>
        <Button variant="primary" icon={<Plus />} disabled={!type} onClick={() => { if (type) { onAddSlot(type); setType(''); } }}>{t('dossier:groups.save')}</Button>
      </>}>
      <div className="hg-stack dg-add">
        <p className="hg-muted hg-small">{t('dossier:groups.addSub')}</p>
        <Field label={<>{t('dossier:groups.type')} <span aria-hidden className="dg-star">*</span></>} htmlFor={id}>
          <Select id={id} value={type} onChange={(e) => setType(e.target.value as AddType)}>
            <option value="">{t('dossier:groups.typeChoose')}</option>
            {types.map((a) => <option key={a.type} value={a.type}>{t(`dossier:groups.types.${a.type}`)}</option>)}
          </Select>
        </Field>
        {(layout.addable.length > 0 || optionalShown.length > 0) && (
          <div>
            <h3 className="dg-add__h">{t('dossier:groups.addSections')}</h3>
            <ul className="dg-add__list">
              {optionalShown.map((g) => (
                <li key={g.id}>
                  <span>{name(g.id)}</span>
                  {canHide(g) && opened.has(g.id) ? <ToggleGlyph open label={t('dossier:groups.hide', { name: name(g.id) })} onClick={() => onHideGroup(g)} /> : <span className="dg-add__on">{t('dossier:groups.optional')}</span>}
                </li>
              ))}
              {layout.addable.map((a) => (
                <li key={a.id}>
                  <span>{name(a.id)}{a.optional > 0 && <span className="dg-add__hint"> · {t('dossier:groups.summary.suggested', { count: a.optional })}</span>}</span>
                  <ToggleGlyph open={false} label={t('dossier:groups.add', { name: name(a.id) })} onClick={() => onOpenGroup(a.id)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Drawer>
  );
}
