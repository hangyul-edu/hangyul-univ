/**
 * Keyboard shortcut discovery (product-excellence pass, 2026-11-22).
 *
 * The console already had shortcuts on its repeated-work screens — `/` search and `J` on the work table, `J`/`K`/`V`/`C`
 * in the document review, `]` for the next essay, Ctrl+Enter to send — but they were listed only on the Settings page,
 * so a person had to know they existed to find them. `?` now opens this sheet from anywhere in the console, and the
 * work screens show a small "Shortcuts ?" button that opens the same sheet. Nothing new is bound here: the sheet lists
 * only keys that exist, for actions that happen many times a day; rare or destructive actions have no shortcut.
 */
import { Keyboard } from '@hangyul/icons';
import { Button, Modal } from '@hangyul/ui';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { useHotkeys } from '../lib/hooks';
import { Kbd, useT } from './bits';

const Ctx = createContext<() => void>(() => undefined);

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const map = useMemo(() => ({ '?': () => setOpen(true) }), []);
  useHotkeys(map);
  return (
    <Ctx.Provider value={() => setOpen(true)}>
      {children}
      {open && <ShortcutSheet onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  );
}

/** The quiet "Shortcuts ?" entry on a work screen. */
export function ShortcutsButton() {
  const { t } = useT();
  const open = useContext(Ctx);
  return (
    <Button size="sm" variant="ghost" icon={<Keyboard />} onClick={open} className="ag-sc-btn" aria-keyshortcuts="?">
      {t('settings.shortcuts')} <Kbd>?</Kbd>
    </Button>
  );
}

export function ShortcutList() {
  const { t } = useT();
  return (
    <dl className="ag-shortcuts">
      <dt><Kbd>/</Kbd></dt><dd>{t('ops.sc.search')}</dd>
      <dt><Kbd>J</Kbd> / <Kbd>K</Kbd></dt><dd>{t('ops.sc.move')}</dd>
      <dt><Kbd>V</Kbd></dt><dd>{t('docs.sc.verify')}</dd>
      <dt><Kbd>C</Kbd></dt><dd>{t('docs.sc.changes')}</dd>
      <dt><Kbd>]</Kbd></dt><dd>{t('ops.sc.nextEssay')}</dd>
      <dt><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd></dt><dd>{t('settings.scSend')}</dd>
      <dt><Kbd>↑</Kbd> <Kbd>↓</Kbd> <Kbd>Enter</Kbd></dt><dd>{t('settings.scSearch')}</dd>
      <dt><Kbd>?</Kbd></dt><dd>{t('ops.sc.help')}</dd>
    </dl>
  );
}

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  return (
    <Modal open onClose={onClose} title={t('settings.shortcuts')} width={460} footer={<Button onClick={onClose}>{t('actions.close')}</Button>}>
      <p className="hg-small hg-muted">{t('ops.sc.lead')}</p>
      <ShortcutList />
    </Modal>
  );
}
