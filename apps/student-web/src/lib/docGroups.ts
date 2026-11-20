/**
 * Owner pass 261119 (req 6) — the document manager's taxonomy. The pure logic moved to `@hangyul/utils` (`docGroups.ts`)
 * so the native Student app groups documents exactly the same way; this module re-exports it for the web imports and
 * keeps the browser-only preference storage.
 */
import { DOC_PREFS_KEY, sanitizeDocPrefs, type DocPrefs } from '@hangyul/utils';

export {
  GROUP_ORDER, HOME_GROUP, WRITTEN, groupOf, BASE_SET, ADD_TYPES, addTypeOf, itemStatus, counts, toneOf, buildLayout,
  defaultExpanded, canRemove, canHide, groupSummary, sanitizeDocPrefs,
} from '@hangyul/utils';
export type {
  DocGroupId, AddType, AddedSlot, ItemStatus, ItemSource, DocItem, GroupCounts, GroupTone, DocGroup, Layout, DocPrefs,
} from '@hangyul/utils';

// ------------------------------------------------------------------ per-viewer preferences (browser only)
export function loadPrefs(): DocPrefs {
  try {
    return sanitizeDocPrefs(JSON.parse(localStorage.getItem(DOC_PREFS_KEY) ?? 'null'));
  } catch { /* storage unavailable */ }
  return { opened: [], slots: [] };
}
export function savePrefs(p: DocPrefs) {
  try { localStorage.setItem(DOC_PREFS_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}
