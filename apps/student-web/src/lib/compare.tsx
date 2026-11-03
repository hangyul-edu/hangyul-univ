import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export const COMPARE_MAX = 4;
const KEY = 'hg.student.compare';

export interface CompareItem { id: string; label: string; university: string }

interface CompareCtx {
  items: CompareItem[];
  has: (id: string) => boolean;
  /** Returns false when the tray is full. */
  toggle: (item: CompareItem) => boolean;
  remove: (id: string) => void;
  clear: () => void;
}

const Ctx = createContext<CompareCtx | null>(null);

function load(): CompareItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as CompareItem[]) : [];
    return Array.isArray(v) ? v.slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode */ }
  }, [items]);
  const has = useCallback((id: string) => items.some((i) => i.id === id), [items]);
  const toggle = useCallback((item: CompareItem) => {
    if (items.some((i) => i.id === item.id)) {
      setItems((xs) => xs.filter((x) => x.id !== item.id));
      return true;
    }
    if (items.length >= COMPARE_MAX) return false;
    setItems((xs) => [...xs, item]);
    return true;
  }, [items]);
  const remove = useCallback((id: string) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(() => ({ items, has, toggle, remove, clear }), [items, has, toggle, remove, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCompare(): CompareCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCompare must be used inside <CompareProvider>');
  return c;
}
