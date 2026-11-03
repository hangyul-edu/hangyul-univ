import { useAuth } from '@hangyul/auth';
import {
  Building2, ChartColumn, FileCheck, GraduationCap, LayoutDashboard, MessagesSquare,
  PlugZap, Radar, Search, Settings, Users,
} from '@hangyul/icons';
import { OrgBadge, type NavSection } from '@hangyul/ui';
import { YnexShell } from '@hangyul/ynex-ui';
import { flagEmoji } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { createContext, Suspense, useContext, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Outlet, useNavigate } from 'react-router';

import { useDebounced, usePerms } from '../lib/hooks';
import { usePrefs } from '../lib/local';
import { PageFallback } from './PageFallback';
import { StageBadge, useT } from './bits';

const ShellCtx = createContext<{ remount: () => void }>({ remount: () => undefined });
/** Lets Settings force the shell to re-read theme/sidebar prefs from storage. */
export const useShell = () => useContext(ShellCtx);

export function useNavCounts() {
  const { api } = useAuth();
  const [prefs] = usePrefs();
  const poll = prefs.pollNotifications ? 60_000 : false;
  const queue = useQuery({ queryKey: ['documents', 'review-queue', { count: true }], queryFn: () => api.documents.reviewQueue({ page_size: 1 }), refetchInterval: poll });
  const essays = useQuery({
    queryKey: ['essays', { status: ['AGENCY_REVIEW', 'FINAL_REVIEW', 'SUBMITTED'], page_size: 1 }],
    queryFn: () => api.essays.list({ status: ['AGENCY_REVIEW', 'FINAL_REVIEW', 'SUBMITTED'], page_size: 1 }),
    refetchInterval: poll,
  });
  const convs = useQuery({ queryKey: ['conversations'], queryFn: () => api.messages.conversations(), refetchInterval: poll });
  const overdue = useQuery({ queryKey: ['tasks', { scope: 'mine', overdue: true, page_size: 1 }], queryFn: () => api.tasks.list({ scope: 'mine', overdue: true, page_size: 1 }), refetchInterval: poll });
  // V9: the submissions queue across every method; the badge counts what needs the team now.
  const submissions = useQuery({ queryKey: ['submissions', 'pipeline'], queryFn: () => api.get<{ counts: Record<string, number> }>('/agency/submissions/pipeline'), refetchInterval: poll, staleTime: 30_000 });
  return {
    queue: queue.data?.total ?? 0,
    essays: essays.data?.total ?? 0,
    unread: (convs.data ?? []).reduce((a, c) => a + c.unread, 0),
    overdue: overdue.data?.total ?? 0,
    // V9: failed attempts, confirmations missing > 2 days, and authorised submissions waiting for the agency.
    submissions: ['issue', 'confirmation_missing', 'authorized'].reduce((a, k) => a + (submissions.data?.counts[k] ?? 0), 0),
  };
}

function GlobalSearch() {
  const { api } = useAuth();
  const { t } = useT();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const dq = useDebounced(q.trim(), 250);
  const listId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const res = useQuery({
    queryKey: ['agency', 'students', { q: dq, page_size: 6, search: true }],
    queryFn: () => api.agency.students({ q: dq, page_size: 6 }),
    enabled: dq.length >= 2,
  });
  const items = dq.length >= 2 ? res.data?.items ?? [] : [];
  const go = (path: string) => { setOpen(false); setQ(''); nav(path); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length, a + 1)); setOpen(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Enter' && q.trim()) {
      e.preventDefault();
      const hit = items[active - 1];
      go(hit ? `/students/${hit.id}` : `/students?q=${encodeURIComponent(q.trim())}`);
    }
  };
  return (
    <div className="ag-gsearch" onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }} onFocus={() => clearTimeout(blurTimer.current)}>
      <div className="hg-input-icon">
        <Search aria-hidden />
        <input
          type="search" className="hg-input hg-input--sm" value={q} placeholder={t('shell.searchPlaceholder')} aria-label={t('shell.searchLabel')}
          role="combobox" aria-expanded={open && q.length >= 2} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active > 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        />
      </div>
      {open && dq.length >= 2 && (
        <div className="ag-gsearch__panel hg-popover" role="listbox" id={listId}>
          {res.isLoading && <div className="hg-subtle hg-small" style={{ padding: 10 }}>{t('states.loading')}</div>}
          {!res.isLoading && items.length === 0 && <div className="hg-subtle hg-small" style={{ padding: 10 }}>{t('states.noResults')}</div>}
          {items.map((s, i) => (
            <button key={s.id} id={`${listId}-${i + 1}`} role="option" aria-selected={active === i + 1} type="button" className="hg-menu-item"
              onMouseDown={(e) => e.preventDefault()} onClick={() => go(`/students/${s.id}`)}>
              <span aria-hidden>{flagEmoji(s.nationality)}</span>
              <span className="hg-grow hg-truncate">{s.full_name}<span className="hg-subtle hg-xs" style={{ display: 'block' }}>{s.email}</span></span>
              <StageBadge stage={s.pipeline_stage} />
            </button>
          ))}
          <button type="button" role="option" aria-selected={active === 0} className="hg-menu-item ag-gsearch__all" onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(`/students?q=${encodeURIComponent(q.trim())}`)}>
            <Search aria-hidden /> {t('shell.searchAll', { q: q.trim() })}
          </button>
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const { t } = useT();
  const { session } = useAuth();
  const perms = usePerms();
  const counts = useNavCounts();
  const [shellKey, setShellKey] = useState(0);

  /**
   * V22 navigation — six destinations (REPORT §249 G2, brief §51):
   *   오늘 · 학생 관리 · 지원·서류 · 메시지 · 통계 · 설정
   * Review and Applications were stages of the same student, not places: they are modes of one area (/review, with
   * /applications kept as a route and a mode). Operations is a section of Insights (every administrator is a
   * manager now). /pipeline redirects to Today — the process strip replaced the kanban. Hangyul staff keep their own
   * section plus "University accounts".
   */
  const sections: NavSection[] = [
    { items: [
      { to: '/', end: true, label: t('v22.nav.today'), icon: <LayoutDashboard />, badge: counts.overdue, alert: counts.overdue > 0 },
      { to: '/students', label: t('v22.nav.students'), icon: <Users /> },
      { to: '/review', label: t('v22.nav.work'), icon: <FileCheck />, badge: counts.queue + counts.essays + counts.submissions, alert: counts.queue + counts.essays + counts.submissions > 0 },
      { to: '/messages', label: t('v22.nav.messages'), icon: <MessagesSquare />, badge: counts.unread, alert: counts.unread > 0 },
      { to: '/performance', label: t('v22.nav.insights'), icon: <ChartColumn /> },
      { to: '/manage', label: t('v22.nav.settings'), icon: <Settings /> },
    ] },
    ...(perms.isHangyul ? [{ title: t('sidebar.hangyul'), items: [
      { to: '/hq', end: true, label: t('sidebar.operations', { defaultValue: 'Operations' }), icon: <Radar /> },
      { to: '/hq/agencies', label: t('sidebar.agencies'), icon: <Building2 /> },
      { to: '/hq/accounts', label: t('v22.nav.hqAccounts'), icon: <GraduationCap /> },
      { to: '/hq/manage', label: t('v11.hq.title'), icon: <PlugZap /> },
    ] }] : []),
  ];

  const org = session?.active_org;
  return (
    <ShellCtx.Provider value={{ remount: () => setShellKey((k) => k + 1) }}>
      <YnexShell
        key={shellKey}
        product={perms.isHangyul ? 'hq' : 'agency'}
        productLabel={perms.isHangyul ? t('shell.hqProduct') : t('shell.product')}
        // V22: one light menu for everyone — no navy areas in the consoles (REPORT §249 G7).
        menu="light"
        sections={sections}
        search={<GlobalSearch />}
        orgLabel={org ? <OrgBadge name={org.org_name} sub={org.org_type === 'HANGYUL' ? t('shell.hqView') : t('role.AGENCY_ADMIN')} /> : null}
      >
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </YnexShell>
    </ShellCtx.Provider>
  );
}
